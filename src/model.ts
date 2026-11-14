import { z } from 'zod';

const refs = z.array(z.string().min(1));
export const statementSchema = z.object({
  text: z.string().min(1),
  kind: z.enum(['verified', 'claim', 'told', 'reported', 'interpretation', 'unknown']),
  sourceIds: refs,
}).strict().refine(v => v.kind === 'unknown' || v.sourceIds.length > 0, 'Non-unknown statements require source evidence');
const moneySchema = z.object({
  amount: z.number().nonnegative().nullable(), currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  basis: z.enum(['booked', 'contracted', 'pipeline', 'projection', 'unknown']), sourceIds: refs,
}).strict().refine(v => v.amount === null ? v.basis === 'unknown' : v.sourceIds.length > 0 && v.basis !== 'unknown', 'Known money requires currency, basis and evidence');
// Normalized presentation schema; upstream records are mapped only after schema verification.
export const offerSchema = z.object({
  title:z.string().min(1), sourceIds:refs.min(1),
  status:z.enum(['open','declined','won','unknown']), statusSourceIds:refs,
  value:moneySchema,
}).strict().refine(v=>v.status==='unknown' || v.statusSourceIds.length>0,'Known offer status requires evidence');
export const dealSchema = z.object({
  key:z.string().min(1), title:z.string().min(1), sourceIds:refs.min(1),
  stage:statementSchema, worthUpTo:moneySchema,
  blockers:statementSchema.nullable(), deadline:z.string().nullable(), deadlineSourceIds:refs,
  offers:z.array(offerSchema).nullable(),
}).strict().refine(v=>v.deadline===null || v.deadlineSourceIds.length>0,'Deal deadline requires evidence');
export type Deal = z.infer<typeof dealSchema>;
export const accountSchema = z.object({
  key: z.string().min(1), name: z.string().min(1), nameSourceIds: refs.min(1),
  summary: statementSchema,
  facts:z.array(statementSchema).optional(),
  usageInsights:z.array(statementSchema).optional(),
  offers:z.array(offerSchema).optional(),
  existingContract:moneySchema.optional(),
  contacts:z.array(z.object({id:z.string(),name:z.string(),role:z.string(),relationship:z.string(),sourceIds:refs.min(1)})).optional(),
  signals:z.array(z.object({id:z.string(),date:z.string(),title:z.string(),summary:statementSchema})).optional(),
  analysisNeedsReview:z.boolean().optional(),
  stage: statementSchema,
  dealValue: moneySchema, bookValue: moneySchema,
  deals:z.array(dealSchema).nullable().default(null),
  stakeholders: z.array(z.object({name: z.string().min(1), nameSourceIds: refs.min(1), role: z.enum(['decides','pays','uses','blocks']), stance: statementSchema}).strict()),
  actions: z.array(z.object({title:z.string().min(1), owner:z.string().nullable(), date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), reason:z.string().min(1), outcome:z.string().min(1), sourceIds:refs}).strict()).max(3),
  risks: z.array(z.object({statement:statementSchema, deadline:z.string().nullable(), deadlineSourceIds:refs}).strict().refine(v => v.deadline === null || v.deadlineSourceIds.length > 0,'Deadlines require evidence')),
  unknowns:z.array(z.object({question:z.string().min(1),resolveBy:z.string().min(1)}).strict()),
  contradictions:z.array(z.object({topic:z.string().min(1),left:statementSchema,right:statementSchema,resolution:z.string().min(1)}).strict()),
}).strict();
export const snapshotSchema = z.object({
  version:z.literal(1), generatedAt:z.iso.datetime(), scenarioAsOf:z.string().optional(),
  sources:z.array(z.object({id:z.string().min(1),title:z.string().min(1),locator:z.string().min(1),retrievedAt:z.iso.datetime().nullable(),importedAt:z.iso.datetime().optional(),eventDate:z.string().optional(),account:z.string().optional(),origin:z.enum(['discovery','paperwork','signal','file']).optional(),excerpt:z.string().min(1)}).strict()),
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
  for(const account of data.accounts) {
    const keys=account.deals?.map(d=>d.key) || [];
    if(new Set(keys).size!==keys.length)ctx.addIssue({code:'custom',message:'Duplicate deal keys within account'});
  }
  check(data.accounts);
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Account = z.infer<typeof accountSchema>;
export type Statement = z.infer<typeof statementSchema>;
export type Source = Snapshot['sources'][number];
export type WorkspaceResponse = {state:'unconfigured'|'ready'|'partial'|'stale'|'error'; snapshot:Snapshot|null; message:string; loadedAt:string|null; ingestion?:{mode:'cached'|'live'|'unconfigured';lastCheckedAt:string|null;lastChangedAt:string|null;error:string|null}};
export function money(value:Account['dealValue']):string {
  if(value.amount === null)return 'Unknown';
  if(!value.currency)return `${value.amount.toLocaleString('en')} (currency unknown)`;
  try { return new Intl.NumberFormat('en',{style:'currency',currency:value.currency,maximumFractionDigits:2}).format(value.amount); }
  catch {return `${value.currency} ${value.amount.toLocaleString('en')}`;}
}
export function completeness(account:Account):boolean {
  return account.dealValue.amount !== null && account.bookValue.amount !== null && account.summary.kind !== 'unknown' && account.actions.length === 3 && account.actions.every(a=>a.owner!==null && a.date!==null) && ['decides','pays','uses','blocks'].every(role=>account.stakeholders.some(s=>s.role===role && s.stance.kind!=='unknown'));
}
