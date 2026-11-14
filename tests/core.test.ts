import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshotSchema, money, type Snapshot } from '../src/model.js';
import { atomicWrite, readWorkspace } from '../server/storage.js';
import { Coordinator, RateLimitError, McpAdapter } from '../server/adapter.js';
import { z } from 'zod';
// Intentionally synthetic and test-only: never imported by the app.
function fixture():Snapshot {return {version:1,generatedAt:new Date().toISOString(),sources:[{id:'synthetic-source',title:'Synthetic test source',locator:'test://fixture',retrievedAt:new Date().toISOString(),excerpt:'Artificial test evidence only.'}],accounts:[{key:'synthetic-account',name:'Synthetic test account',nameSourceIds:['synthetic-source'],summary:{text:'Synthetic summary',kind:'reported',sourceIds:['synthetic-source']},stage:{text:'Unknown',kind:'unknown',sourceIds:[]},dealValue:{amount:null,currency:null,basis:'unknown',sourceIds:[]},bookValue:{amount:null,currency:null,basis:'unknown',sourceIds:[]},deals:null,stakeholders:[],actions:[],risks:[],unknowns:[],contradictions:[]}]};}
async function temporary(run:(dir:string)=>Promise<void>){const dir=await mkdtemp(join(tmpdir(),'crm-test-'));try{await run(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('unknown money is not zero; projections retain their classification',()=>{
 const data=fixture();assert.equal(money(data.accounts[0].dealValue),'Unknown');
 data.accounts[0].dealValue={amount:120,currency:'EUR',basis:'projection',sourceIds:['synthetic-source']};
 assert.equal(snapshotSchema.parse(data).accounts[0].dealValue.basis,'projection');assert.equal(money(data.accounts[0].dealValue),'€120.00');
});
test('all factual references must resolve and non-unknown claims need evidence',()=>{
 const data=fixture();data.accounts[0].summary.sourceIds=['missing'];assert.equal(snapshotSchema.safeParse(data).success,false);
 data.accounts[0].summary.sourceIds=[];assert.equal(snapshotSchema.safeParse(data).success,false);
 data.accounts[0].summary.kind='unknown';assert.equal(snapshotSchema.safeParse(data).success,true);
});
test('money, names and deadlines cannot bypass provenance',()=>{
 const data=fixture();data.accounts[0].dealValue={amount:0,currency:'EUR',basis:'booked',sourceIds:[]};assert.equal(snapshotSchema.safeParse(data).success,false);
 const other=fixture();other.accounts[0].nameSourceIds=['missing'];assert.equal(snapshotSchema.safeParse(other).success,false);
 const deadline=fixture();deadline.accounts[0].risks=[{statement:{text:'test risk',kind:'reported',sourceIds:['synthetic-source']},deadline:'2026-01-01',deadlineSourceIds:[]}];assert.equal(snapshotSchema.safeParse(deadline).success,false);
});
test('duplicate sources are rejected and contradictory reports remain separate',()=>{
 const data=fixture();data.sources.push(data.sources[0]);assert.equal(snapshotSchema.safeParse(data).success,false);
 const other=fixture();other.accounts[0].contradictions=[{topic:'Synthetic conflict',left:{text:'yes',kind:'reported',sourceIds:['synthetic-source']},right:{text:'no',kind:'reported',sourceIds:['synthetic-source']},resolution:'Inspect the original evidence'}];
 assert.equal(snapshotSchema.parse(other).accounts[0].contradictions[0].right.text,'no');
});
test('unconfigured, partial, stale, invalid and updated snapshots are honest',()=>temporary(async dir=>{
 assert.equal((await readWorkspace(dir)).state,'unconfigured');const data=fixture();await atomicWrite(join(dir,'snapshot.json'),data);
 assert.equal((await readWorkspace(dir)).state,'partial');assert.equal((await readWorkspace(dir,Date.now()+86_400_001)).state,'stale');
 data.accounts[0].summary.text='Updated synthetic summary';await atomicWrite(join(dir,'snapshot.json'),data);assert.equal((await readWorkspace(dir)).snapshot?.accounts[0].summary.text,data.accounts[0].summary.text);
 await atomicWrite(join(dir,'snapshot.json'),{unexpected:true});const invalid=await readWorkspace(dir);assert.equal(invalid.state,'error');assert.equal(invalid.snapshot,null);
}));
test('durable limiter blocks concurrent processes and restart bypasses; failures consume budget',()=>temporary(async dir=>{
 let now=1000;const a=new Coordinator(dir,()=>now),b=new Coordinator(dir,()=>now);let count=0;
 const results=await Promise.allSettled([a.run(async()=>{count++;return 1;}),b.run(async()=>{count++;return 2;})]);
 assert.equal(count,1);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 await assert.rejects(new Coordinator(dir,()=>now).run(async()=>3),RateLimitError);now+=61_001;
 await assert.rejects(a.run(async()=>{throw new Error('simulated upstream failure');}));await assert.rejects(b.run(async()=>4),RateLimitError);
}));
test('adapter requires ownership, verified schema, explicit notes; cached reads use no network',()=>temporary(async dir=>{
 const oldOwner=process.env.CRM_INGESTION_OWNER,oldToken=process.env.AQ_TOKEN;
 let calls=0;const request:typeof fetch=async(_url,init)=>{assert.equal(new Headers(init?.headers).get('Accept'),'application/json, text/event-stream');calls++;return new Response(JSON.stringify({jsonrpc:'2.0',id:'test',result:{content:[{type:'text',text:JSON.stringify({value:7})}],isError:false}}),{status:200});};
 const adapter=new McpAdapter(dir,[{name:'synthetic_read',input:z.object({}).strict(),output:z.object({value:z.number()}),mode:'read'},{name:'write_note',input:z.object({}),output:z.unknown(),mode:'write'}],request);
 try {
  delete process.env.CRM_INGESTION_OWNER;await assert.rejects(adapter.call('synthetic_read',{}),/ownership/);assert.equal(calls,0);
  process.env.CRM_INGESTION_OWNER='this-process';process.env.AQ_TOKEN='synthetic-test-secret';
  await assert.rejects(adapter.call('unverified',{}),/schema/);await assert.rejects(adapter.call('write_note',{}),/explicitly/);
  const first=await adapter.call('synthetic_read',{}),second=await adapter.call('synthetic_read',{});assert.equal(first.cached,false);assert.equal(second.cached,true);assert.equal(calls,1);
  assert.equal((await readFile(join(dir,'rate.json'),'utf8')).includes('synthetic-test-secret'),false);
 } finally {if(oldOwner===undefined)delete process.env.CRM_INGESTION_OWNER;else process.env.CRM_INGESTION_OWNER=oldOwner;if(oldToken===undefined)delete process.env.AQ_TOKEN;else process.env.AQ_TOKEN=oldToken;}
}));
test('old underlying evidence stays stale after a fresh snapshot export',()=>temporary(async dir=>{
 const data=fixture();data.sources[0].retrievedAt='2020-01-01T00:00:00.000Z';await atomicWrite(join(dir,'snapshot.json'),data);assert.equal((await readWorkspace(dir)).state,'stale');
}));
test('stakeholder identity needs its own evidence even when stance is unknown',()=>{
 const data=fixture();data.accounts[0].stakeholders=[{name:'Synthetic person',nameSourceIds:[],role:'decides',stance:{text:'Unknown',kind:'unknown',sourceIds:[]}}];assert.equal(snapshotSchema.safeParse(data).success,false);
});
