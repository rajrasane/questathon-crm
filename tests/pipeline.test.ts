import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { bundleSchema, parseCsv } from '../server/raw.js';
import { normalizeBundle, digest, mergeTables } from '../server/normalize.js';
import { importBundle, importRuntime, mergeSignals, pollOnce } from '../server/pipeline.js';
import { readWorkspace } from '../server/storage.js';
function fixture(){return bundleSchema.parse({accounts:{format:'account-quest-v2-export/1',exported_at:'2025-01-01T00:00:00.000Z',accounts:[{id:'TEST',name:'Synthetic integration account',stakeholders:[],facts:[{id:'test-fact',text:'Synthetic claim',said_by:'Synthetic speaker',status:'claim',learned_at_minute:1}],opportunities:[{id:'test-deal',title:'Synthetic opportunity',stage:'identified',worth_up_to:null,blocker:null,deadline:null,evidence:['test-fact']}],offers:[{id:'test-offer',title:'Synthetic offer',value:17,status:'open'}]}],files:[]},paperwork_test:{account:'TEST',records:[{path:'usage_weekly.csv',kind:'usage',text:'week_start,dock_id,flights,days_online\n2030-01-07,TEST-DOCK,3,7\n2030-01-14,TEST-DOCK,4,7\n'},{path:'requests.csv',kind:'requests',text:'request_id,summary,status\nTEST-REQ,"Hello, world",Open\n'}]},signals:{signals:[]},tools:{tools:[{name:'get_signals',inputSchema:{type:'object',properties:{},additionalProperties:false}}]}});}
function events(){return {signals:[{id:'test-signal',account:'TEST',dated:'2030-02-01',title:'Synthetic signal',summary:'Synthetic change',records:[{path:'TEST/usage_weekly.csv',kind:'usage',text:'week_start,dock_id,flights,days_online\n2030-01-21,TEST-DOCK,0,7\n2030-01-28,TEST-DOCK,0,7\n'},{path:'TEST/requests.csv',kind:'request',text:'request_id,summary,status\nTEST-REQ,"Hello, world",Closed\n'}]}]};}
async function temp(run:(dir:string)=>Promise<void>){const dir=await mkdtemp(join(tmpdir(),'crm-pipeline-'));try{await run(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('raw format imports identities, claims, per-deal unknowns and currency-less offers honestly',()=>{
 const s=normalizeBundle(fixture());const a=s.accounts[0];assert.equal(a.facts?.[0].kind,'claim');assert.equal(a.deals?.[0].worthUpTo.amount,null);assert.equal(a.offers?.[0].value.amount,17);assert.equal(a.offers?.[0].value.currency,null);assert.equal(a.bookValue.amount,null);assert.equal(a.deals?.[0].offers,null);assert.ok(s.sources.some(x=>x.id==='test-fact'));assert.equal(s.sources[0].retrievedAt,null);
});
test('CSV parsing preserves quoted commas, newlines and escaped quotes',()=>{
 assert.deepEqual(parseCsv('id,text\n1,"hello,\n""world"""\n'),[{id:'1',text:'hello,\n"world"'}]);assert.throws(()=>parseCsv('id,text\n1,"oops'));
});
test('signal rows merge by natural keys and reanalysis is deterministic',()=>{
 const once=mergeSignals(fixture(),events()),twice=mergeSignals(once,events());assert.equal(digest(once),digest(twice));
 const tables=mergeTables(twice);assert.equal(tables.usage.length,4);assert.equal(tables.requests.length,1);assert.equal(tables.requests[0].row.status,'Closed');assert.equal(tables.requests[0].sourceIds.length,2);
 const s=normalizeBundle(twice);assert.equal(s.scenarioAsOf,'2030-02-01');assert.ok(s.accounts[0].usageInsights?.some(i=>i.text.includes('7 flights')));assert.ok(s.accounts[0].usageInsights?.some(i=>i.text.includes('Cause and physical site are unconfirmed')));
});
test('canonical fingerprint ignores key order; unknown raw evidence is rejected',()=>{
 assert.equal(digest({a:1,b:2}),digest({b:2,a:1}));const b=fixture();b.accounts.accounts[0].opportunities[0].evidence=['missing'];assert.throws(()=>normalizeBundle(b),/Unresolved source/);
});
test('import repeats do not rewrite snapshots; invalid data preserves last valid snapshot',()=>temp(async dir=>{
 const b=fixture();assert.equal((await importBundle(b,dir)).changed,true);const first=await readFile(join(dir,'snapshot.json'),'utf8');assert.equal((await importBundle(b,dir)).changed,false);assert.equal(await readFile(join(dir,'snapshot.json'),'utf8'),first);
 b.accounts.accounts[0].opportunities[0].evidence=['missing'];await assert.rejects(importBundle(b,dir));assert.equal(await readFile(join(dir,'snapshot.json'),'utf8'),first);
}));
test('new signals invalidate editorial review without overwriting discovery outcomes',()=>temp(async dir=>{
 const b=fixture();const analysis={basedOnSignals:digest([]),accounts:{TEST:{summary:{text:'Synthetic interpretation',kind:'interpretation',sourceIds:['test-fact']}}}};
 await importRuntime({bundle:b,analysis},dir);assert.equal((await readWorkspace(dir)).snapshot?.accounts[0].analysisNeedsReview,false);
 await importBundle(mergeSignals(b,events()),dir);const s=(await readWorkspace(dir)).snapshot!;assert.equal(s.accounts[0].analysisNeedsReview,true);assert.equal(s.accounts[0].deals?.[0].stage.text,'identified');assert.equal(s.accounts[0].signals?.length,1);
}));
test('polling is gated and uses the same global rate budget; mocked update reaches snapshot',()=>temp(async dir=>{
 const previousOwner=process.env.CRM_INGESTION_OWNER,previousToken=process.env.AQ_TOKEN;let calls=0;
 const request:typeof fetch=async()=>{calls++;return new Response(JSON.stringify({jsonrpc:'2.0',id:'test',result:{content:[{type:'text',text:JSON.stringify(events())}],isError:false}}),{status:200});};
 try {delete process.env.CRM_INGESTION_OWNER;delete process.env.AQ_TOKEN;await importBundle(fixture(),dir);await pollOnce(dir,request);assert.equal(calls,0);
 process.env.CRM_INGESTION_OWNER='this-process';process.env.AQ_TOKEN='synthetic-only-secret';await pollOnce(dir,request);assert.equal(calls,1);assert.equal((await readWorkspace(dir)).snapshot?.accounts[0].signals?.length,1);await pollOnce(dir,request);assert.equal(calls,1);
 }finally{if(previousOwner===undefined)delete process.env.CRM_INGESTION_OWNER;else process.env.CRM_INGESTION_OWNER=previousOwner;if(previousToken===undefined)delete process.env.AQ_TOKEN;else process.env.AQ_TOKEN=previousToken;}
}));
