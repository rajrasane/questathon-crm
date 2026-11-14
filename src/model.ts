import { z } from 'zod';

const refs = z.array(z.string().min(1));
export const statementSchema = z.object({
  text: z.string().min(1),
  kind: z.enum(['verified', 'reported', 'interpretation', 'unknown']),
  sourceIds: refs,
}).strict().refine(v => v.kind === 'unknown' || v.sourceIds.length > 0, 'Non-unknown statements require source evidence');
const moneySchema = z.object({
  amount: z.number().nonnegative().nullable(), currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  basis: z.enum(['booked', 'pipeline', 'projection', 'unknown']), sourceIds: refs,
}).strict().refine(v => v.amount === null ? v.basis === 'unknown' : v.currency !== null && v.sourceIds.length > 0 && v.basis !== 'unknown', 'Known money requires currency, basis and evidence');
export const accountSchema = z.object({
  key: z.string().min(1), name: z.string().min(1), nameSourceIds: refs.min(1),
  summary: statementSchema,
  stage: statementSchema,
  dealValue: moneySchema, bookValue: moneySchema,
  stakeholders: z.array(z.object({name: z.string().min(1), nameSourceIds: refs.min(1), role: z.enum(['decides','pays','uses','blocks']), stance: statementSchema}).strict()),
  actions: z.array(z.object({title:z.string().min(1), owner:z.string().nullable(), date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), reason:z.string().min(1), outcome:z.string().min(1), sourceIds:refs}).strict()).max(3),
  risks: z.array(z.object({statement:statementSchema, deadline:z.string().nullable(), deadlineSourceIds:refs}).strict().refine(v => v.deadline === null || v.deadlineSourceIds.length > 0,'Deadlines require evidence')),
  unknowns:z.array(z.object({question:z.string().min(1),resolveBy:z.string().min(1)}).strict()),
  contradictions:z.array(z.object({topic:z.string().min(1),left:statementSchema,right:statementSchema,resolution:z.string().min(1)}).strict()),
}).strict();
export const snapshotSchema = z.object({
  version:z.literal(1), generatedAt:z.iso.datetime(),
  sources:z.array(z.object({id:z.string().min(1),title:z.string().min(1),locator:z.string().min(1),retrievedAt:z.iso.datetime(),excerpt:z.string().min(1)}).strict()),
  accounts:z.array(accountSchema),
}).strict().superRefine((data,ctx)=>{
  const ids = new Set(data.sources.map(s=>s.id));
  if(ids.size !== data.sources.length) ctx.addIssue({code:'custom',message:'Duplicate source IDs'});
  if(new Set(data.accounts.map(a=>a.key)).size !== data.accounts.length) ctx.addIssue({code:'custom',message:'Duplicate account keys'});
  function check(value:unknown):void {
    if(!value || typeof value!=='object') return;
    for(const [key,child] of Object.entries(value)) {
      if(key.endsWith('SourceIds') || key==='sourceIds') {
        for(const id of child as string[]) {
          if(!ids.has(id))ctx.addIssue({code:'custom',message:`Unresolved source reference: ${id}`});
        }
      }
      if(typeof child==='object')check(child);
    }
  }
  check(data.accounts);
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Account = z.infer<typeof accountSchema>;
export type Statement = z.infer<typeof statementSchema>;
export type Source = Snapshot['sources'][number];
export type WorkspaceResponse = {state:'unconfigured'|'ready'|'partial'|'stale'|'error'; snapshot:Snapshot|null; message:string; loadedAt:string|null};
export function money(value:Account['dealValue']):string {
  if(value.amount === null || !value.currency)return 'Unknown';
  try { return new Intl.NumberFormat('en',{style:'currency',currency:value.currency,maximumFractionDigits:2}).format(value.amount); }
  catch {return `${value.currency} ${value.amount.toLocaleString('en')}`;}
}
export function completeness(account:Account):boolean {
  return account.dealValue.amount !== null && account.bookValue.amount !== null && account.summary.kind !== 'unknown' && account.actions.length === 3 && account.actions.every(a=>a.owner!==null && a.date!==null) && ['decides','pays','uses','blocks'].every(role=>account.stakeholders.some(s=>s.role===role && s.stance.kind!=='unknown'));
}
