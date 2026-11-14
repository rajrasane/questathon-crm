import { mkdir, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { McpAdapter, RateLimitError } from './adapter.js';
import { exportSchema, paperworkSchema, fileSchema, bundleSchema, type Bundle } from './raw.js';
import { atomicWrite, privateDir } from './storage.js';
import { readOptional, persistBundle, pollOnce } from './pipeline.js';
// Tool names and inputs were verified against the supplied tools/list, not guessed.
const tools=[
 {name:'get_my_accounts',input:z.object({}).strict(),output:exportSchema,mode:'read' as const},
 {name:'get_all_paperwork',input:z.object({account:z.string()}).strict(),output:paperworkSchema,mode:'read' as const},
 {name:'get_file',input:z.object({id:z.string()}).strict(),output:fileSchema,mode:'read' as const},
];
export function pendingFetch(bundle:Bundle|null):{name:string;args:Record<string,string>}|null {
 if(!bundle)return {name:'get_my_accounts',args:{}};
 const packs=Object.values(bundle).flatMap(v=>{const p=paperworkSchema.safeParse(v);return p.success?[p.data]:[];});
 for(const account of bundle.accounts.accounts)if(!packs.some(p=>p.account===account.id))return {name:'get_all_paperwork',args:{account:account.id}};
 for(const file of bundle.accounts.files)if(!bundle.fetched_files?.some(f=>f.id===file.id) && bundle.roi_file?.id!==file.id)return {name:'get_file',args:{id:file.id}};
 return null;
}
export async function ingestionStep(dir=privateDir,request:typeof fetch=fetch,now=Date.now) {
 if(process.env.CRM_INGESTION_OWNER!=='this-process' || !process.env.AQ_TOKEN)return {mode:'cached',changed:false};
 await mkdir(dir,{recursive:true,mode:0o700});const lock=join(dir,'bootstrap.lock');
 try{await mkdir(lock);}catch{return {mode:'busy',changed:false};}
 try {
  const stored=await readOptional(join(dir,'bundle.json'));
  let bundle=stored===undefined?null:bundleSchema.parse(stored);
  const task=pendingFetch(bundle);
  if(!task)return await pollOnce(dir,request,now);
  const adapter=new McpAdapter(dir,tools,request,now);
  const result=await adapter.call(task.name,task.args);
  if(task.name==='get_my_accounts')bundle={accounts:exportSchema.parse(result.data)};
  else if(task.name==='get_all_paperwork') {
   const pack=paperworkSchema.parse(result.data);
   if(pack.account!==task.args.account)throw new Error('Paperwork account mismatch');
   bundle={...bundle!,[`paperwork_${pack.account}`]:pack};
  } else {
   const file=fileSchema.parse(result.data);if(file.id!==task.args.id)throw new Error('File identity mismatch');
   bundle={...bundle!,fetched_files:[...(bundle!.fetched_files||[]),file]};
  }
  await persistBundle(bundle,dir);
  await atomicWrite(join(dir,'bootstrap-status.json'),{phase:pendingFetch(bundle)?'fetching':'ready',lastCompletedTool:task.name,lastCompletedAt:result.retrievedAt,error:null});
  return {mode:'initializing',changed:true};
 }catch(error){
  await atomicWrite(join(dir,'bootstrap-status.json'),{phase:'error',error:error instanceof RateLimitError?'Shared MCP cooldown; waiting for the next cycle.':'Initial MCP fetch failed. Retaining validated cached data; retrying next cycle.'});
  return {mode:'error',changed:false};
 }finally{await rmdir(lock);}
}
export function startIngestion(dir=privateDir) {
 if(process.env.CRM_INGESTION_OWNER!=='this-process' || !process.env.AQ_TOKEN)return ()=>{};
 let stopped=false;let timer:ReturnType<typeof setTimeout>;
 const tick=async()=>{try{await ingestionStep(dir);}catch{console.error('MCP ingestion unavailable; retrying on next interval.');}finally{if(!stopped){timer=setTimeout(()=>void tick(),65_000);timer.unref();}}};
 timer=setTimeout(()=>void tick(),65_000);timer.unref();
 return ()=>{stopped=true;clearTimeout(timer);};
}
