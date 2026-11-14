import { readFile, mkdir, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite, privateDir } from './storage.js';
import { bundleSchema, signalsSchema, type Bundle } from './raw.js';
import { normalizeBundle, mergeTables, digest, type PrivateAnalysis } from './normalize.js';
import { McpAdapter, RateLimitError } from './adapter.js';
import { z } from 'zod';
export async function readOptional(path:string):Promise<unknown|undefined> {try{return JSON.parse(await readFile(path,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error;}}
export function mergeSignals(bundle:Bundle,incoming:unknown):Bundle {
 const parsed=signalsSchema.parse(incoming);const byId=new Map((bundle.signals?.signals||[]).map(s=>[`${s.account}:${s.id}`,s]));
 for(const s of parsed.signals)byId.set(`${s.account}:${s.id}`,s);
 return {...bundle,signals:{signals:[...byId.values()].sort((a,b)=>a.dated.localeCompare(b.dated)||a.id.localeCompare(b.id))}};
}
export async function rebuild(bundleInput:unknown,dir=privateDir) {
 const bundle=bundleSchema.parse(bundleInput);const analysis=await readOptional(join(dir,'analysis.json')) as PrivateAnalysis|undefined;
 const fingerprint=digest({normalizerVersion:2,bundle,analysis});
 const prior=await readOptional(join(dir,'ledger.json')) as {fingerprint?:string;events?:Array<{account:string;id:string;hash:string}>}|undefined;
 if(prior?.fingerprint===fingerprint)return {changed:false};
 const importedAt=new Date().toISOString();const snapshot=normalizeBundle(bundle,importedAt,analysis);const tables=mergeTables(bundle);
 // Snapshot is the atomic visible commit; ledger records only successful reanalysis.
 await atomicWrite(join(dir,'merged-tables.json'),tables);
 await atomicWrite(join(dir,'snapshot.json'),snapshot);
 const events=new Map((prior?.events||[]).map(e=>[`${e.account}:${e.id}:${e.hash}`,e]));
 for(const s of bundle.signals?.signals||[])events.set(`${s.account}:${s.id}:${digest(s)}`,{account:s.account,id:s.id,hash:digest(s)});
 await atomicWrite(join(dir,'ledger.json'),{fingerprint,analyzedAt:importedAt,events:[...events.values()]});
 return {changed:true};
}
export async function importBundle(input:unknown,dir=privateDir,providedAnalysis?:PrivateAnalysis) {
 await mkdir(dir,{recursive:true,mode:0o700});
 const lock=join(dir,'import.lock');
 try{await mkdir(lock);}catch{throw new Error('Another importer owns the snapshot lock');}
 try {
 const bundle=bundleSchema.parse(input);
 // Validate before replacing authoritative private input.
 const analysis=providedAnalysis || await readOptional(join(dir,'analysis.json')) as PrivateAnalysis|undefined;
 normalizeBundle(bundle,new Date().toISOString(),analysis);
 if(providedAnalysis)await atomicWrite(join(dir,'analysis.json'),providedAnalysis);
 await atomicWrite(join(dir,'bundle.json'),bundle);return await rebuild(bundle,dir);
 } finally {await rmdir(lock);}
}
export async function importRuntime(input:unknown,dir=privateDir) {
 const wrapped=z.object({bundle:bundleSchema,analysis:z.object({basedOnSignals:z.string(),accounts:z.record(z.string(),z.unknown())})}).safeParse(input);
 return wrapped.success?importBundle(wrapped.data.bundle,dir,wrapped.data.analysis as PrivateAnalysis):importBundle(input,dir);
}
export async function pollOnce(dir=privateDir,request:typeof fetch=fetch) {
 if(process.env.CRM_INGESTION_OWNER!=='this-process' || !process.env.AQ_TOKEN)return {mode:'cached' as const,changed:false};
 await mkdir(dir,{recursive:true,mode:0o700});const lock=join(dir,'poll.lock');
 try{await mkdir(lock);}catch{return {mode:'live' as const,changed:false};}
 try {
  const bundle=bundleSchema.parse(await readOptional(join(dir,'bundle.json')));
  const declaration=bundle.tools?.tools.find(t=>t.name==='get_signals');
  const expected={type:'object',properties:{},additionalProperties:false};
  if(!declaration || digest(declaration.inputSchema)!==digest(expected))throw new Error('Signal input schema must be verified before polling');
  const adapter=new McpAdapter(dir,[{name:'get_signals',input:z.object({}).strict(),output:signalsSchema,mode:'read'}],request);
  const result=await adapter.call('get_signals',{}, {refresh:true});
  const merged=mergeSignals(bundle,result.data);const resultState=await importBundle(merged,dir);
  const old=await readOptional(join(dir,'poll-status.json')) as {lastChangedAt?:string}|undefined;
  await atomicWrite(join(dir,'poll-status.json'),{mode:'live',lastCheckedAt:new Date().toISOString(),lastChangedAt:resultState.changed?new Date().toISOString():old?.lastChangedAt||null,error:null});
  return {mode:'live' as const,...resultState};
 } catch(error) {
  const old=await readOptional(join(dir,'poll-status.json')) as Record<string,unknown>|undefined;
  await atomicWrite(join(dir,'poll-status.json'),{...old,mode:'live',error:error instanceof RateLimitError?'Shared upstream cooldown; waiting for next cycle.':'Signal check failed. Retaining the last validated snapshot.'});
  return {mode:'live' as const,changed:false};
 } finally {await rmdir(lock);}
}
export function startSignalPolling(dir=privateDir) {
 if(process.env.CRM_INGESTION_OWNER!=='this-process' || !process.env.AQ_TOKEN)return ()=>{};
 let stopped=false;let timer:ReturnType<typeof setTimeout>|undefined;
 const tick=async()=>{try{await pollOnce(dir);}catch{console.error('Signal polling unavailable; retrying on next interval.');}finally{if(!stopped){timer=setTimeout(()=>void tick(),65_000);timer.unref();}}};
 // Delay first request too; never create a burst on server startup.
 timer=setTimeout(()=>void tick(),65_000);timer.unref();return ()=>{stopped=true;if(timer)clearTimeout(timer);};
}
export async function ingestionStatus(dir=privateDir) {
 const live=process.env.CRM_INGESTION_OWNER==='this-process' && !!process.env.AQ_TOKEN;
 const previous=await readOptional(join(dir,'poll-status.json')) as {lastCheckedAt?:string;lastChangedAt?:string;error?:string}|undefined;
 return {mode:live?'live' as const:'cached' as const,lastCheckedAt:previous?.lastCheckedAt||null,lastChangedAt:previous?.lastChangedAt||null,error:live?previous?.error||null:null};
}
