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
export function decodeToolResult(result:unknown):unknown {
  const payload=z.object({content:z.array(z.object({type:z.string(),text:z.string().optional()})).min(1),isError:z.boolean().optional()}).parse(result);
  if(payload.isError)throw new Error('Upstream returned a tool error');
  const first=payload.content[0];
  if(first.type!=='text' || first.text===undefined)throw new Error('Expected JSON text in the first MCP content block');
  try {return JSON.parse(first.text);} catch {throw new Error('MCP content is not valid JSON');}
}
export async function readRpcResponse(response:Response):Promise<unknown> {
 if(!response.headers.get('content-type')?.includes('text/event-stream'))return response.json();
 const reader=response.body?.getReader();if(!reader)throw new Error('Empty event stream');
 const decoder=new TextDecoder();let buffer='';let bytes=0;
 const parseEvent=(frame:string):unknown|undefined=>{const data=frame.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(!data)return undefined;const value=JSON.parse(data);return value && value.jsonrpc==='2.0' && ('result' in value || 'error' in value)?value:undefined;};
 try {while(true){const {value,done}=await reader.read();if(value){bytes+=value.byteLength;if(bytes>8*1024*1024)throw new Error('Event response exceeds limit');buffer=(buffer+decoder.decode(value,{stream:true})).replace(/\r\n/g,'\n');}
  let boundary:number;while((boundary=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const parsed=parseEvent(frame);if(parsed!==undefined)return parsed;}
  if(done){const parsed=parseEvent(buffer);if(parsed!==undefined)return parsed;throw new Error('No JSON-RPC response in event stream');}
 }}finally{await reader.cancel().catch(()=>{});}
}
export type VerifiedTool = {name:string; input:z.ZodType; output:z.ZodType; mode:'read'|'write'};
export class McpAdapter {
  private coordinator:Coordinator;
  constructor(private dir:string,private tools:VerifiedTool[],private request:typeof fetch=fetch,now=Date.now){this.coordinator=new Coordinator(dir,now);}
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
      const response=await this.request(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:`Bearer ${token}`},body:JSON.stringify({jsonrpc:'2.0',id:key,method:'tools/call',params:{name,arguments:input}}),signal:AbortSignal.timeout(25_000)});
      if(!response.ok)throw new Error(`Upstream request failed (${response.status}); no automatic retry`);
      const envelope=z.object({jsonrpc:z.literal('2.0'),id:z.unknown(),result:z.unknown().optional(),error:z.unknown().optional()}).parse(await readRpcResponse(response));
      if(envelope.error || (envelope.result as {isError?:boolean})?.isError)throw new Error('Upstream returned a tool error');
      const data=tool.output.parse(decodeToolResult(envelope.result));
      const result={data,retrievedAt:new Date().toISOString(),cached:false};
      if(tool.mode==='read')await atomicWrite(cache,result);
      return result;
    });
  }
}
