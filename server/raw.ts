import { z } from 'zod';
const record=z.object({path:z.string().min(1),kind:z.string(),text:z.string().optional(),data:z.unknown().optional()}).passthrough();
export const signalsSchema=z.object({signals:z.array(z.object({id:z.string(),account:z.string(),dated:z.string(),title:z.string(),summary:z.string(),records:z.array(record),set_off_at:z.string().optional()}).passthrough())});
export const exportSchema=z.object({format:z.literal('account-quest-v2-export/1'),exported_at:z.iso.datetime(),accounts:z.array(z.object({
 id:z.string(),name:z.string(),official_story:z.string().optional(),
 stakeholders:z.array(z.object({id:z.string(),name:z.string(),role:z.string(),relationship:z.string()})),
 facts:z.array(z.object({id:z.string(),text:z.string(),said_by:z.string(),status:z.enum(['claim','told','verified']),verified_by:z.string().optional(),learned_at_minute:z.number()})),
 opportunities:z.array(z.object({id:z.string(),title:z.string(),stage:z.enum(['identified','qualified','cleared','agreed']),worth_up_to:z.number().nullable().optional(),blocker:z.object({text:z.string(),status:z.string()}).nullable().optional(),evidence:z.array(z.string()),deadline:z.object({text:z.string(),minute:z.number()}).nullable().optional()})),
 offers:z.array(z.object({id:z.string(),title:z.string(),value:z.number(),pitch_to:z.string().optional(),status:z.enum(['open','won','declined'])})).default([]),
}).passthrough()),files:z.array(z.object({id:z.string(),title:z.string(),path:z.string(),account:z.string().optional()})).default([])}).passthrough();
export const bundleSchema=z.object({accounts:exportSchema,signals:signalsSchema.optional(),tools:z.object({tools:z.array(z.object({name:z.string(),inputSchema:z.unknown()}).passthrough())}).optional(),schema:z.unknown().optional(),fetched_files:z.array(z.object({id:z.string(),name:z.string(),text:z.string()})).optional(),roi_file:z.object({id:z.string(),name:z.string(),text:z.string()}).optional()}).catchall(z.unknown());
export const paperworkSchema=z.object({account:z.string(),records:z.array(record)});
export type Bundle=z.infer<typeof bundleSchema>;
export type Signal=z.infer<typeof signalsSchema>['signals'][number];
// Handles quoted commas, newlines and doubled quotes without interpreting cells as code.
export function parseCsv(text:string):Record<string,string>[] {
 const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;
 for(let i=0;i<text.length;i++) {const c=text[i];if(c==='"'){if(quoted && text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('Unclosed CSV quote');if(cell || row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}const headers=rows.shift()||[];
 return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]||''])));
}
export const fileSchema=z.object({id:z.string(),name:z.string(),text:z.string()});

export const accessSchema=z.object({new_accounts:z.array(z.object({id:z.string(),name:z.string()}).passthrough()).default([])}).passthrough();
