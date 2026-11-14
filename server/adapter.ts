/** Server-only transport. No browser route calls this module. Work owns ingestion until explicitly transferred. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from './storage.js';
import { z } from 'zod';
const endpoint='https://questathon.aihackerscollective.com/api/public/mcp';
export class RateLimitError extends Error { constructor(public retryAt:number){super('Upstream cooldown is active');} }
export class Coordinator {
  constructor(private directory:string,private now=Date.now){}
  async run<T>(operation:()=>Promise<T>):Promise<T> {
    await mkdir(this.directory,{recursive:true,mode:0o700});
    const lock=join(this.directory,'upstream.lock');
    try {await mkdir(lock);} catch {throw new Error('Another ingestion process owns the lock; no upstream request sent');}
    try {
      let next=0;
      try {next=JSON.parse(await readFile(join(this.directory,'rate.json'),'utf8')).next;} catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('Invalid rate-limit state; manual review required');}
      if(!Number.isFinite(next))throw new Error('Invalid rate-limit state');
      if(this.now()<next)throw new RateLimitError(next);
      // Reserve before network I/O; failed calls consume the same budget.
      await atomicWrite(join(this.directory,'rate.json'),{next:this.now()+61_000});
      return await operation();
    } finally {await rmdir(lock);}
  }
}
export type VerifiedTool = {name:string; input:z.ZodType; output:z.ZodType; mode:'read'|'write'};
export class McpAdapter {
  private coordinator:Coordinator;
  constructor(private dir:string,private tools:VerifiedTool[],private request:typeof fetch=fetch){this.coordinator=new Coordinator(dir);}
  async call(name:string,args:unknown,options:{refresh?:boolean;explicitNoteWrite?:boolean}={}) {
    if(process.env.CRM_INGESTION_OWNER!=='this-process')throw new Error('Ingestion is disabled: ownership has not been transferred');
    const token=process.env.AQ_TOKEN;
    if(!token)throw new Error('Server runtime credential is not configured');
    const tool=this.tools.find(t=>t.name===name);
    if(!tool)throw new Error('Tool schema has not been verified');
    if(tool.mode==='write' && (name!=='write_note' || !options.explicitNoteWrite))throw new Error('An explicitly initiated note is required');
    const input=tool.input.parse(args);
    const key=createHash('sha256').update(JSON.stringify({name,input})).digest('hex');
    const cache=join(this.dir,'responses',`${key}.json`);
    if(tool.mode==='read' && !options.refresh) {
      try {const cached=JSON.parse(await readFile(cache,'utf8'));return {data:tool.output.parse(cached.data),retrievedAt:cached.retrievedAt,cached:true};}
      catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('Cached upstream response failed validation');}
    }
    return this.coordinator.run(async()=>{
      const response=await this.request(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({jsonrpc:'2.0',id:key,method:'tools/call',params:{name,arguments:input}}),signal:AbortSignal.timeout(25_000)});
      if(!response.ok)throw new Error(`Upstream request failed (${response.status}); no automatic retry`);
      const envelope=z.object({jsonrpc:z.literal('2.0'),id:z.unknown(),result:z.unknown().optional(),error:z.unknown().optional()}).parse(await response.json());
      if(envelope.error || (envelope.result as {isError?:boolean})?.isError)throw new Error('Upstream returned a tool error');
      const data=tool.output.parse(envelope.result);
      const result={data,retrievedAt:new Date().toISOString(),cached:false};
      if(tool.mode==='read')await atomicWrite(cache,result);
      return result;
    });
  }
}
