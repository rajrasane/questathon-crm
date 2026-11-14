import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import type { AddressInfo } from 'node:net';
test('HTTP API is read-only and private/server paths cannot be downloaded',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crm-http-'));const {app,close}=await createApp({dir,production:true});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 try{
  const response=await fetch(`${base}/api/workspace`);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).state,'unconfigured');
  for(const path of ['/.private/bundle.json','/@fs/workspace/.private/analysis.json','/server/adapter.ts','/api/write_note'])assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(`${base}/api/workspace`,{method:'POST'})).status,404);
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await close();await rm(dir,{recursive:true,force:true});}
});
