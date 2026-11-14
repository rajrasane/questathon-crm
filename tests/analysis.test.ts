import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundleSchema } from '../server/raw.js';
import { normalizeBundle, digest } from '../server/normalize.js';
import { mergeSignals, persistBundle, reanalyzeCached } from '../server/pipeline.js';

// Entirely invented records, unrelated to any private account or game export.
function fixture() {
 return bundleSchema.parse({accounts:{format:'account-quest-v2-export/1',exported_at:'2032-04-02T00:00:00.000Z',accounts:[{
  id:'SYNTH',name:'Synthetic analysis account',official_story:'Everything is ready',
  stakeholders:[{id:'synthetic-lead',name:'Example Lead',role:'Programme manager',relationship:'warm'},{id:'synthetic-tech',name:'Example Technician',role:'IT manager',relationship:'neutral'}],
  facts:[{id:'synthetic-claim',text:'The programme saved 400 units.',said_by:'synthetic-lead',status:'claim',learned_at_minute:1},{id:'synthetic-qualified',text:'This is a savings model, not booked savings.',said_by:'synthetic-lead',status:'verified',verified_by:'synthetic-model',learned_at_minute:2}],
  opportunities:[{id:'synthetic-deal',title:'Synthetic opportunity',stage:'identified',worth_up_to:null,blocker:null,deadline:null,evidence:[]}],offers:[],
 }],files:[{id:'synthetic-model',title:'Synthetic model',path:'synthetic.csv',account:'SYNTH'}]},
 fetched_files:[{id:'synthetic-model',name:'Synthetic model',text:'input,amount\nmodel,400'}],
 paperwork_synthetic:{account:'SYNTH',records:[
  {path:'profile.json',kind:'profile',data:{currency:'USD',renewal:{annual_value:123,term_ends:'2032-06-30'},not_on_file:['Current finance approver.']}},
  {path:'contract.txt',kind:'contract',text:'Signed: 1 January 2032, by Example Lead\nOne invoice a year, to Synthetic Billing.\nNo automatic renewal.'},
  {path:'requests.csv',kind:'requests',text:'request_id,opened,from,summary,status,owner\nSYNTH-REQ,2032-03-01,Synthetic finance,Please send a renewal quote,Open,\nSYNTH-CLOSED,2032-03-02,Synthetic operations,Urgent public event training,Closed,\n'},
 ]}, signals:{signals:[]}});
}
function change(status='Open') {
 return {signals:[{id:'synthetic-change',account:'SYNTH',dated:'2032-04-10',title:'Urgent synthetic request',summary:'Urgent training before a public event.',records:[{path:'SYNTH/requests.csv',kind:'requests',text:`request_id,opened,from,summary,status,owner\nSYNTH-EVENT,2032-04-10,Synthetic operations,Urgent training before a public event,${status},\nSYNTH-REQ,2032-03-01,Synthetic finance,Please send a renewal quote,Closed,\n`}]}]};
}
test('fresh records derive authority, ranked actions and contract risk without an analysis file',()=>{
 const a=normalizeBundle(fixture()).accounts[0];
 assert.equal(a.actions.length,3);
 assert.equal(a.actions[0].title,'Resolve the outstanding commercial request');
 assert.equal(a.actions[0].date,'2032-04-03');
 assert.ok(a.actions.every(x=>x.owner && x.date && x.sourceIds.length));
 assert.ok(a.stakeholders.find(p=>p.role==='decides')?.stance.text.includes('Current renewal authority'));
 assert.ok(a.stakeholders.find(p=>p.role==='pays')?.stance.text.includes('does not establish the budget approver'));
 assert.ok(a.stakeholders.find(p=>p.name==='Example Technician')?.stance.text.includes('veto authority and current position are unconfirmed'));
 assert.ok(a.risks.some(r=>r.deadline==='2032-06-30' && r.deadlineSourceIds.length));
 assert.ok(a.unknowns.some(u=>u.question.includes('finance approver')));
 assert.equal(a.deals?.[0].worthUpTo.amount,null);assert.equal(a.bookValue.amount,null);
 assert.equal(a.deals?.[0].stage.text,'identified');
 assert.ok(!a.actions.some(x=>x.reason.includes('Urgent public event training')));
});
test('titles alone establish neither current decision nor budget authority',()=>{
 const b=fixture();b.paperwork_synthetic={account:'SYNTH',records:[]};
 const a=normalizeBundle(b).accounts[0];
 assert.equal(a.stakeholders.find(s=>s.role==='decides')?.stance.kind,'unknown');
 assert.equal(a.stakeholders.find(s=>s.role==='pays')?.stance.kind,'unknown');
 assert.ok(a.stakeholders.filter(s=>s.name==='Example Lead').every(s=>s.role!=='decides'));
});
test('same-speaker savings qualification keeps the original claim and verified evidence separate',()=>{
 const b=fixture();let a=normalizeBundle(b).accounts[0];
 assert.equal(a.contradictions.length,1);
 assert.equal(a.contradictions[0].left.kind,'claim');assert.equal(a.contradictions[0].right.kind,'verified');
 assert.ok(a.contradictions[0].right.sourceIds.includes('synthetic-model'));
 b.accounts.accounts[0].facts[1].said_by='synthetic-tech';a=normalizeBundle(b).accounts[0];
 assert.equal(a.contradictions.length,0);
});
test('new signals re-rank actions; closing the same request removes it despite its historical urgent signal',()=>{
 const fresh=mergeSignals(fixture(),change());
 const a=normalizeBundle(fresh).accounts[0];
 assert.equal(a.actions[0].title,'Agree a written plan for the time-sensitive request');
 assert.equal(a.actions[0].date,'2032-04-11');
 assert.ok(a.actions[0].sourceIds.includes('local:signal-record:SYNTH:synthetic-change:SYNTH/requests.csv'));
 assert.ok(!a.actions.some(x=>x.reason.includes('Please send a renewal quote')));
 const closed=normalizeBundle(mergeSignals(fresh,change('Closed'))).accounts[0];
 assert.ok(!closed.actions.some(x=>/urgent|public event/i.test(x.reason)));
 assert.equal(digest(normalizeBundle(fresh,'2032-04-10T00:00:00.000Z')),digest(normalizeBundle(mergeSignals(fresh,change()),'2032-04-10T00:00:00.000Z')));
});
test('older signal dates do not move the scenario backward',()=>{
 const b=fixture();b.signals={signals:[{id:'old',account:'SYNTH',dated:'2031-01-01',title:'Old',summary:'Historical change',records:[]}]};
 const s=normalizeBundle(b);assert.equal(s.scenarioAsOf,'2032-04-02');assert.equal(s.accounts[0].actions[0].date,'2032-04-03');
});
test('empty paperwork remains useful without fabricating contacts or customer deadlines',()=>{
 const b=fixture();b.accounts.accounts[0].stakeholders=[];b.accounts.accounts[0].facts=[];b.accounts.files=[];b.paperwork_synthetic={account:'SYNTH',records:[]};
 const a=normalizeBundle(b).accounts[0];
 assert.equal(a.actions.length,3);assert.ok(a.stakeholders.every(s=>s.stance.kind==='unknown'));
 assert.ok(a.risks.every(r=>r.deadline===null));assert.equal(a.bookValue.amount,null);
});
test('offline cache migration regenerates analysis once and ignores legacy overrides',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crm-analysis-'));
 try {
  await persistBundle(fixture(),dir);
  const ledger=JSON.parse(await readFile(join(dir,'ledger.json'),'utf8'));ledger.fingerprint='older-normalizer';
  await writeFile(join(dir,'ledger.json'),JSON.stringify(ledger));
  await writeFile(join(dir,'analysis.json'),'{"obsolete":"ignored"}');
  assert.equal((await reanalyzeCached(dir)).changed,true);
  const first=await readFile(join(dir,'snapshot.json'),'utf8');
  assert.equal((await reanalyzeCached(dir)).changed,false);
  assert.equal(await readFile(join(dir,'snapshot.json'),'utf8'),first);
  assert.equal(JSON.parse(first).accounts[0].actions.length,3);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('request chronology wins over array order and explicit deadlines retain their source wording',()=>{
 const newer=change('Closed').signals[0];newer.id='newer';newer.dated='2032-04-12';
 const older=change().signals[0];older.id='older';older.summary='Urgent request';older.records[0].text=older.records[0].text.replace('before a public event','before a public event on 14 April');
 const b=fixture();b.signals={signals:[newer,older]};
 const closed=normalizeBundle(b).accounts[0];assert.ok(!closed.actions.some(a=>a.reason.includes('public event')));
 b.signals={signals:[older]};
 const open=normalizeBundle(b).accounts[0];const risk=open.risks.find(r=>r.deadline==='14 April');
 assert.ok(risk);assert.ok(risk.deadlineSourceIds.includes('local:signal-record:SYNTH:older:SYNTH/requests.csv'));
});
test('latest named contact update is included with signal evidence, without changing authority',()=>{
 const b=fixture();b.signals={signals:[{id:'departure',account:'SYNTH',dated:'2032-04-10',title:'Contact change',summary:'Example Lead is leaving. No successor is named.',records:[]}]};
 const a=normalizeBundle(b).accounts[0];
 const contact=a.stakeholders.find(s=>s.name==='Example Lead' && s.role==='uses');
 assert.ok(contact?.stance.text.includes('No successor is named'));
 assert.ok(contact?.stance.sourceIds.includes('local:signal:SYNTH:departure'));
 assert.equal(a.actions[0].title,'Secure a successor and decision-maker introductions');
});
test('usage escalation needs activity in both preceding weeks and stays explicit about unknown causes',()=>{
 const b=fixture();
 b.paperwork_usage={account:'SYNTH',records:[{path:'usage_weekly.csv',kind:'usage',text:'week_start,dock_id,flights,days_online\n2032-03-01,SYNTH-DEVICE,0,7\n2032-03-08,SYNTH-DEVICE,2,7\n2032-03-15,SYNTH-DEVICE,0,7\n2032-03-22,SYNTH-DEVICE,0,7\n'}]};
 assert.ok(!normalizeBundle(b).accounts[0].actions.some(a=>a.title==='Investigate the measured usage stoppage'));
 (b.paperwork_usage as {records:{text:string}[]}).records[0].text=(b.paperwork_usage as {records:{text:string}[]}).records[0].text.replace('2032-03-01,SYNTH-DEVICE,0','2032-03-01,SYNTH-DEVICE,3');
 const a=normalizeBundle(b).accounts[0];assert.equal(a.actions[0].title,'Investigate the measured usage stoppage');
 assert.ok(a.actions[0].reason.includes('Cause and physical site remain unconfirmed'));
});
