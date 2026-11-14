import { createHash } from 'node:crypto';
import { z } from 'zod';
import { accountSchema, snapshotSchema, type Account, type Snapshot, type Source, type Statement } from '../src/model.js';
import { deriveAnalysis } from './analyze.js';
import { bundleSchema, paperworkSchema, parseCsv, type Bundle } from './raw.js';
function canonical(value:unknown):unknown {
 if(Array.isArray(value))return value.map(canonical);
 if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
 return value;
}
export const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export const unknownMoney=()=>({amount:null,currency:null,basis:'unknown' as const,sourceIds:[] as string[]});
const stated=(text:string,sourceIds:string[],kind:Statement['kind']='reported'):Statement=>({text,sourceIds,kind});
export function paperworkId(account:string,path:string){return `local:paperwork:${account}:${path}`;}
export function normalizeBundle(input:unknown,importedAt=new Date().toISOString()):Snapshot {
 const bundle=bundleSchema.parse(input);const sources:Source[]=[];
 const source=(id:string,title:string,locator:string,excerpt:unknown,account:string,origin:Source['origin'],eventDate?:string)=>{
  sources.push({id,title,locator,excerpt:typeof excerpt==='string'?excerpt:JSON.stringify(excerpt,null,2),account,origin,retrievedAt:null,importedAt,...eventDate?{eventDate}:{}});return id;
 };
 const paperwork=Object.values(bundle).flatMap(value=>{const p=paperworkSchema.safeParse(value);return p.success?[p.data]:[];});
 for(const pack of paperwork)for(const r of pack.records)source(paperworkId(pack.account,r.path),r.path,JSON.stringify({tool:'get_paperwork_record',arguments:{account:pack.account,path:r.path},localCompositeId:true}),r.text ?? r.data ?? r,pack.account,'paperwork');
 for(const file of bundle.accounts.files){const loaded=bundle.fetched_files?.find(f=>f.id===file.id) || (bundle.roi_file?.id===file.id?bundle.roi_file:undefined);source(file.id,file.title,JSON.stringify({tool:'get_file',arguments:{id:file.id},contentAvailable:!!loaded}),loaded?.text || `File reference only: ${file.path}. Content not loaded.`,file.account||'','file');}
 const signals=bundle.signals?.signals || [];
 const scenarioAsOf=[bundle.accounts.exported_at.slice(0,10),...signals.map(s=>s.dated)].sort().at(-1)!;
 const tables=mergeTables(bundle);
 for(const signal of signals){source(`local:signal:${signal.account}:${signal.id}`,signal.title,JSON.stringify({tool:'get_signals',signalId:signal.id,account:signal.account}),signal,signal.account,'signal',signal.dated);for(const r of signal.records)source(`local:signal-record:${signal.account}:${signal.id}:${r.path}`,r.path,JSON.stringify({tool:'get_signals',signalId:signal.id,path:r.path,localCompositeId:true}),r.text??r.data??r,signal.account,'signal',signal.dated);}
 const accounts:Account[]=bundle.accounts.accounts.map(a=>{
  const accountRef=source(`local:discovery:${a.id}`,a.name,JSON.stringify({tool:'get_my_accounts',accountId:a.id,exportedAt:bundle.accounts.exported_at}),{id:a.id,name:a.name,official_story:a.official_story,opportunities:a.opportunities},a.id,'discovery');
  for(const f of a.facts)source(f.id,`${f.said_by}: ${f.status}`,JSON.stringify({tool:'get_my_accounts',accountId:a.id,factId:f.id,learnedAtMinute:f.learned_at_minute}),f,a.id,'discovery');
  for(const p of a.stakeholders)source(p.id,p.name,JSON.stringify({tool:'get_my_accounts',accountId:a.id,personId:p.id}),p,a.id,'discovery');
  for(const o of a.opportunities)source(o.id,o.title,JSON.stringify({tool:'get_my_accounts',accountId:a.id,dealId:o.id}),o,a.id,'discovery');
  for(const o of a.offers)source(o.id,o.title,JSON.stringify({tool:'get_my_accounts',accountId:a.id,offerId:o.id}),o,a.id,'discovery');
  const pack=paperwork.find(p=>p.account===a.id);
  const profile=pack?.records.find(r=>r.path==='profile.json');
  const profileData=z.object({currency:z.string(),renewal:z.object({annual_value:z.number(),term_ends:z.string()})}).safeParse(profile?.data);
  const facts=a.facts.map(f=>stated(f.text,[f.id,...f.verified_by?[f.verified_by]:[]],f.status));
  const accountSignals=signals.filter(s=>s.account===a.id).map(s=>({id:s.id,date:s.dated,title:s.title,summary:stated(s.summary,[`local:signal:${a.id}:${s.id}`])}));
  const mapped:Account=accountSchema.parse({key:a.id,name:a.name,nameSourceIds:[accountRef],summary:a.official_story?stated(a.official_story,[accountRef],'claim'):stated('Account brief not supplied',[],'unknown'),stage:stated(`${a.opportunities.filter(o=>o.stage==='agreed').length} agreed of ${a.opportunities.length} discovered opportunities`,[accountRef]),dealValue:unknownMoney(),bookValue:unknownMoney(),existingContract:profileData.success?{amount:profileData.data.renewal.annual_value,currency:profileData.data.currency,basis:'contracted',sourceIds:[paperworkId(a.id,'profile.json'),...pack?.records.some(r=>r.path==='contract.txt')?[paperworkId(a.id,'contract.txt')]:[]]}:unknownMoney(),facts,contacts:a.stakeholders.map(p=>({id:p.id,name:p.name,role:p.role,relationship:p.relationship,sourceIds:[p.id]})),signals:accountSignals,
   deals:a.opportunities.map(o=>({key:o.id,title:o.title,sourceIds:[o.id,...o.evidence],stage:stated(o.stage,[o.id]),worthUpTo:o.worth_up_to===null || o.worth_up_to===undefined?unknownMoney():{amount:o.worth_up_to,currency:null,basis:'pipeline',sourceIds:[o.id]},blockers:o.blocker?stated(`${o.blocker.text} (${o.blocker.status})`,[o.id]):null,deadline:o.deadline?`${o.deadline.text} · discovery minute ${o.deadline.minute}`:null,deadlineSourceIds:o.deadline?[o.id]:[],offers:null})),
   offers:a.offers.map(o=>({title:o.title,sourceIds:[o.id],status:o.status,statusSourceIds:[o.id],value:{amount:o.value,currency:null,basis:'pipeline',sourceIds:[o.id]}})),stakeholders:[],actions:[],risks:accountSignals.map(s=>({statement:s.summary,deadline:null,deadlineSourceIds:[]})),unknowns:[{question:'Who decides, pays and can block?',resolveBy:'Confirm authority directly; a contact title or relationship is not proof of authority.'}],contradictions:[]});
  mapped.usageInsights=usageInsights(bundle,a.id);
  Object.assign(mapped,deriveAnalysis(mapped,a,sources,tables.requests,profile?.data,scenarioAsOf));
  return mapped;
 });
 return snapshotSchema.parse({version:1,generatedAt:importedAt,scenarioAsOf,sources,accounts});
}
export type MergedRow={account:string;row:Record<string,string>;sourceIds:string[]};
export function mergeTables(bundle:Bundle):{usage:MergedRow[];requests:MergedRow[]} {
 const usage=new Map<string,MergedRow>(),requests=new Map<string,MergedRow>();
 function add(account:string,path:string,text:string,sourceId:string){
  const map=path.endsWith('usage_weekly.csv')?usage:path.endsWith('requests.csv')?requests:null;if(!map)return;
  for(const row of parseCsv(text)){
   const key=map===usage?`${account}:${row.week_start}:${row.dock_id}`:row.request_id && row.request_id!=='(none)'?`${account}:${row.request_id}`:`${account}:local:${digest([row.opened,row.from,row.summary])}`;
   const previous=map.get(key);map.set(key,{account,row,sourceIds:[...new Set([...(previous?.sourceIds||[]),sourceId])]});
  }
 }
 for(const value of Object.values(bundle)){const pack=paperworkSchema.safeParse(value);if(pack.success)for(const r of pack.data.records)if(r.text)add(pack.data.account,r.path,r.text,paperworkId(pack.data.account,r.path));}
 for(const s of [...bundle.signals?.signals||[]].sort((a,b)=>a.dated.localeCompare(b.dated)||a.id.localeCompare(b.id)))for(const r of s.records)if(r.text)add(s.account,r.path,r.text,`local:signal-record:${s.account}:${s.id}:${r.path}`);
 return {usage:[...usage.values()],requests:[...requests.values()]};
}
export function usageInsights(bundle:Bundle,account:string):Statement[] {
 const rows=mergeTables(bundle).usage.filter(r=>r.account===account);
 if(!rows.length)return [];
 const dates=[...new Set(rows.map(r=>r.row.week_start))].sort();const docks=[...new Set(rows.map(r=>r.row.dock_id))];
 const refs=[...new Set(rows.flatMap(r=>r.sourceIds))];
 const total=(items:MergedRow[])=>items.reduce((sum,r)=>sum+Number(r.row.flights),0);
 if(rows.some(r=>!r.row.week_start || !r.row.dock_id || !/^\d+$/.test(r.row.flights)))return [stated('Usage rows need validation before numeric analysis.',refs,'interpretation')];
 const idle=docks.filter(d=>total(rows.filter(r=>r.row.dock_id===d))===0);
 const results=[stated(`${rows.length} unique dock-week rows cover week starts ${dates[0]} to ${dates.at(-1)} across ${docks.length} docks. ${idle.length} docks have no flights in these rows. Coverage does not establish physical site mapping or continuous adoption.`,refs,'interpretation')];
 if(dates.length>=4){const recent=dates.slice(-4);const consecutive=recent.every((date,i)=>i===0 || Date.parse(date)-Date.parse(recent[i-1])===7*86400000);
  if(consecutive)for(const dock of docks){const subset=recent.map(date=>rows.find(r=>r.row.dock_id===dock && r.row.week_start===date));if(subset.some(r=>!r))continue;const valid=subset as MergedRow[];
   const baseline=total(valid.slice(0,2));if(valid.slice(0,2).every(r=>Number(r.row.flights)>0) && total(valid.slice(2))===0 && valid.slice(2).every(r=>r.row.days_online==='7'))results.push(stated(`${dock}: ${baseline} flights over week starts ${recent[0]} and ${recent[1]}, then zero over ${recent[2]} and ${recent[3]} with seven days online in each later row. Cause and physical site are unconfirmed.`,[...new Set(valid.flatMap(r=>r.sourceIds))],'interpretation'));
  }
 }
 return results;
}
