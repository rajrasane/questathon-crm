import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { snapshotSchema, completeness, type WorkspaceResponse } from '../src/model.js';
export const privateDir = resolve(process.env.CRM_DATA_DIR || '.private');
export async function atomicWrite(path:string,value:unknown) {
  await mkdir(dirname(path),{recursive:true,mode:0o700});
  const temporary=`${path}.${randomUUID()}.tmp`;
  await writeFile(temporary,JSON.stringify(value),{mode:0o600});
  await rename(temporary,path);
}
export async function readWorkspace(dir=privateDir,now=Date.now()):Promise<WorkspaceResponse> {
  try {
    const snapshot=snapshotSchema.parse(JSON.parse(await readFile(join(dir,'snapshot.json'),'utf8')));
    const oldest=Math.min(Date.parse(snapshot.generatedAt),...snapshot.sources.filter(s=>s.retrievedAt!==null).map(s=>Date.parse(s.retrievedAt!)));
    const stale=now-oldest>24*60*60*1000;
    const partial=snapshot.accounts.length===0 || snapshot.accounts.some(a=>!completeness(a));
    return {state:stale?'stale':partial?'partial':'ready',snapshot,loadedAt:new Date(now).toISOString(),message:stale?'Evidence is over 24 hours old. Confirm time-sensitive details.':partial?'Some decisions still need evidence. Unknowns are shown explicitly.':'Evidence loaded from the private snapshot.'};
  } catch(error) {
    const absent=(error as NodeJS.ErrnoException).code==='ENOENT';
    return {state:absent?'unconfigured':'error',snapshot:null,loadedAt:null,message:absent?'Waiting for the first MCP fetch. Configure the server token and start the sole ingestion runtime.':'The private snapshot could not be validated. No unverified data is displayed.'};
  }
}
