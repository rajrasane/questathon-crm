import { z } from 'zod';
import type { Account, Source, Statement } from '../src/model.js';
import type { Bundle } from './raw.js';

type RawAccount = Bundle['accounts']['accounts'][number];
type RequestRow = {account:string; row:Record<string,string>; sourceIds:string[]};
type Analysis = Pick<Account,'summary'|'stakeholders'|'actions'|'risks'|'unknowns'|'contradictions'>;
type Candidate = Account['actions'][number] & {priority:number; key:string};
const unique = (ids:string[]) => [...new Set(ids)];
const statement = (text:string, sourceIds:string[], kind:Statement['kind']='interpretation'):Statement => ({text,sourceIds:unique(sourceIds),kind});
const profileSchema = z.object({
 renewal:z.object({term_ends:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).passthrough().optional(),
 not_on_file:z.array(z.string()).optional(),
}).passthrough();
const isOpen = (status:string) => /^(open|pending(?:\s.*)?|in progress|unresolved)$/i.test(status.trim());
const dateAfter = (date:string,days:number) => {
 const time=Date.parse(`${date}T00:00:00Z`);
 return Number.isFinite(time)?new Date(time+days*86400000).toISOString().slice(0,10):null;
};

/** Conservative, deterministic analysis of available records. No inferred buying authority,
 * monetary values, physical site mappings or customer commitments. All actions are proposals. */
export function deriveAnalysis(account:Account, raw:RawAccount, sources:Source[], requests:RequestRow[], profileInput:unknown, scenarioDate:string):Analysis {
 const refs=account.nameSourceIds;
 const own=sources.filter(s=>s.account===account.key);
 const contract=own.find(s=>s.origin==='paperwork' && s.title==='contract.txt');
 const profile=own.find(s=>s.origin==='paperwork' && s.title==='profile.json');
 const parsed=profileSchema.safeParse(profileInput);
 const term=parsed.success?parsed.data.renewal?.term_ends:undefined;
 const risks:Account['risks']=[...(account.signals||[]).map(s=>({statement:s.summary,deadline:null,deadlineSourceIds:[]}))];
 const unknowns:Account['unknowns']=[
  {question:'Who can approve the next order, release the budget and veto it?',resolveBy:'Ask the existing contact to introduce the current signatory, finance and procurement owners. Record their authority and position directly; a title or previous signature is insufficient.'},
  {question:'What is each opportunity worth, and what clears its next stage?',resolveBy:'Qualify each opportunity separately with its buyer: scope, currency, budget, acceptance criteria, blockers and decision date. Keep missing values unknown until evidenced.'},
 ];
 const stakeholders:Account['stakeholders']=[];
 const candidates:Candidate[]=[];
 function action(key:string,priority:number,title:string,reason:string,outcome:string,sourceIds:string[],owner='Customer success') {
  candidates.push({key,priority,title,reason,outcome,sourceIds:unique(sourceIds),owner,date:null});
 }
 function person(name:string,nameSourceIds:string[],role:Account['stakeholders'][number]['role'],text:string,evidence:string[],kind:Statement['kind']='interpretation') {
  stakeholders.push({name,nameSourceIds,role,stance:statement(text,evidence,kind)});
 }
 const signature=contract?.excerpt.match(/^Signed:\s*(.+)$/im)?.[1];
 const signer=signature?.match(/\bby\s+(.+)$/i)?.[1]?.trim().replace(/\.$/,'');
 if(contract && signer) {
  const contact=raw.stakeholders.find(p=>signer.toLowerCase().includes(p.name.toLowerCase()));
  person(contact?.name||signer,contact?[contact.id]:[contract.id],'decides',`Historical signature: ${signature}. This establishes the previous order's signatory only. Current renewal authority and buying position remain unconfirmed.`,[contract.id,...contact?[contact.id]:[]]);
 } else person('Decision authority unconfirmed',refs,'decides','No current buying mandate has been established by this analysis. Confirm the signatory and approval process.',refs,'unknown');
 const billingLine=contract?.excerpt.split('\n').find(line=>/one invoice.*\bto\b/i.test(line));
 if(contract && billingLine) {
  const payer=billingLine.match(/\bto\s+(.+?)[.]?$/i)?.[1]||'Recorded billing recipient';
  person(payer,[contract.id],'pays',`Recorded invoicing arrangement: ${billingLine.replace(/^[-\s]+/,'')}. This does not establish the budget approver, internal cost allocation or renewal support.`,[contract.id]);
 } else person('Budget and billing owners unconfirmed',contract?[contract.id]:refs,'pays','Obtain the billing schedule and finance introduction. Invoice payment or an existing contract does not establish who approves the next budget.',contract?[contract.id]:refs,'unknown');
 for(const contact of raw.stakeholders) {
  const related=raw.facts.filter(f=>f.said_by===contact.id || f.said_by.toLowerCase()===contact.name.toLowerCase());
  const factText=related.slice(0,2).map(f=>` ${f.status}: ${f.text}`).join('');
  const recordedName=contact.name.replace(/^(?:Insp\.|Dr\.|Mr\.|Ms\.)\s+/i,'').toLowerCase();
  const updates=(account.signals||[]).filter(s=>s.summary.text.toLowerCase().includes(recordedName)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,1);
  const updateText=updates.map(s=>` Dated update (${s.date}): ${s.summary.text}`).join('');
  const evidence=[contact.id,...related.slice(0,2).map(f=>f.id),...updates.flatMap(s=>s.summary.sourceIds)];
  const technical=/\bIT\b|procurement|legal|compliance|finance/i.test(contact.role);
  person(contact.name,[contact.id],technical?'blocks':'uses',`Recorded role: ${contact.role}; relationship: ${contact.relationship}.${factText}${updateText} ${technical?'Potential dependency contact; veto authority and current position are unconfirmed.':'Operational contact to consult; actual use, purchase authority and current support must be confirmed.'}`,evidence);
 }
 if(!stakeholders.some(s=>s.role==='uses'))person('Operational users unconfirmed',refs,'uses','Identify the operators and local managers, then confirm actual use and support needs.',refs,'unknown');
 if(!stakeholders.some(s=>s.role==='blocks'))person('Veto and dependency owners unconfirmed',refs,'blocks','Confirm procurement, technical, operational and compliance approval requirements with the customer.',refs,'unknown');

 if(term && profile) {
  const renewalRefs=[profile.id,...contract?[contract.id]:[]];
  const noAuto=contract && /no automatic renewal/i.test(contract.excerpt);
  risks.push({statement:statement(`Recorded contract term ends ${term}.${noAuto?' The contract states there is no automatic renewal.':''} Confirm the new order process and budget owner before this date.`,renewalRefs),deadline:term,deadlineSourceIds:[profile.id]});
  action('renewal',70,'Confirm the renewal decision and budget route',`The recorded term ends ${term}.${noAuto?' A new order is required rather than automatic renewal.':''} Historical contacts and signatures do not confirm current authority.`, 'A named signatory, budget approver, procurement steps and a mutually agreed decision timetable.',renewalRefs,'Commercial owner');
 }
 const openRequests=requests.filter(r=>r.account===account.key && isOpen(r.row.status||''));
 for(const request of openRequests) {
  const r=request.row;
  const text=r.summary||'Request details are missing';
  const finance=/renewal|quote|cost.*plant|budget/i.test(text);
  const safety=/batter|failure|night shift|coverage|cover\b/i.test(text);
  const technical=/network|offline|connection/i.test(text);
  const urgent=/urgent|public event|this week|before.*event/i.test(text);
  const deadline=text.match(/\b(?:on|by|before)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?)\b/i)?.[1];
  if(deadline)risks.push({statement:statement(`Recorded ${r.status} request: ${text}`,request.sourceIds,'reported'),deadline,deadlineSourceIds:request.sourceIds});
  const document=/document/i.test(text);
  const priority=urgent?110:finance?90:safety?85:technical?80:document?75:40;
  const title=urgent?'Agree a written plan for the time-sensitive request':finance?'Resolve the outstanding commercial request':safety?'Agree an operational support response':technical?'Assign and diagnose the technical dependency':document?'Recover and answer the outstanding document request':'Close the unresolved customer request';
  action(`request:${r.request_id && r.request_id!=='(none)'?r.request_id:JSON.stringify([r.opened,r.from,r.summary])}`,priority,title,
   `Recorded ${r.status} request${r.from?` from ${r.from}`:''}: ${text}`,
   finance?'An acknowledged response, confirmed cost allocation and an introduction to the budget approver.':technical?'A named technical owner, tested diagnosis and a dated customer update; do not assume a cause for other sites.':'Confirmed scope, a responsible owner, an agreed response date and customer acknowledgement.',request.sourceIds,r.owner?.trim()||'Customer success');
 }
 for(const signal of account.signals||[]) {
  const text=`${signal.title} ${signal.summary.text}`;
  const departure=/leav(?:e|es|ing)|depart(?:ure|ing)|successor|stepping down/i.test(text);
  const urgent=/urgent|public event|this week|failure.cover|training/i.test(text);
  const stopped=/zero|not flying|stop(?:ped|s)? flying|usage.*drop/i.test(text);
  // A signal with a request row is ranked using that row's latest merged status.
  // Closing a request must not leave the older event promoted as unresolved work.
  const signalRecords=own.filter(s=>s.origin==='signal' && s.id.startsWith(`local:signal-record:${account.key}:${signal.id}:`));
  const hasRequestRows=signalRecords.some(s=>s.title.endsWith('requests.csv'));
  if(hasRequestRows && !departure && !stopped)continue;
  if(departure)action(`signal:${signal.id}`,100,'Secure a successor and decision-maker introductions',`Dated ${signal.date}: ${signal.summary.text}`,'A confirmed successor, handover meeting and direct introductions to the current decision and budget owners.',signal.summary.sourceIds);
  else if(urgent)action(`signal:${signal.id}`,105,'Agree a written response to the time-sensitive request',`Dated ${signal.date}: ${signal.summary.text}`,'Confirm the event date, training needs and failure coverage with the customer; agree written responsibilities and acceptance criteria.',signal.summary.sourceIds);
  else if(!stopped)action(`signal:${signal.id}`,60,'Validate the latest account change',`Dated ${signal.date}: ${signal.summary.text}`,'Confirm who is affected, the decision impact and a responsible follow-up owner.',signal.summary.sourceIds);
 }
 const stopped=(account.usageInsights||[]).filter(s=>s.text.includes('then zero over'));
 if(stopped.length) {
  const evidence=unique(stopped.flatMap(s=>s.sourceIds));
  const detail=`${stopped.length} docks have flights in both preceding weeks, followed by two zero-flight weeks while online seven days per week. The dated usage analysis identifies the dock IDs and supporting rows. Cause and physical site remain unconfirmed.`;
  risks.push({statement:statement(detail,evidence),deadline:null,deadlineSourceIds:[]});
  action('usage',95,'Investigate the measured usage stoppage',detail,'Map the affected dock IDs to sites; check operator availability, schedules, alerts and network logs with local owners. Establish the cause before proposing expansion.',evidence,'Customer success with technical support');
 }
 const contradictions:Account['contradictions']=[];
 // Only pair explicit savings claims with a same-speaker, file-backed qualification.
 // This does not attempt general natural-language contradiction detection.
 for(const claim of raw.facts.filter(f=>f.status==='claim' && /sav(?:ing|ed|es)|\bROI\b/i.test(f.text))) {
  const qualification=raw.facts.find(f=>f.status==='verified' && f.said_by===claim.said_by && !!f.verified_by && /sav(?:ing|ed|es)|\bROI\b/i.test(f.text) && /model|project|no\b|not\b/i.test(f.text));
  if(!qualification)continue;
  const evidence=[qualification.id,qualification.verified_by!];
  contradictions.push({topic:'Savings claim and file-backed qualification',left:statement(claim.text,[claim.id],'claim'),right:statement(qualification.text,evidence,'verified'),resolution:'Reconcile the claim with the underlying model and finance records. Separate projected capacity savings, contract reductions and booked savings.'});
  action('savings',82,'Reconcile the savings claim with finance',`Claim: ${claim.text} File-backed qualification: ${qualification.text}`,'A reconciled model and finance-confirmed realized savings, or an explicit statement that realized value remains unverified.',[claim.id,...evidence],'Commercial owner with finance');
 }
 if(parsed.success)for(const gap of parsed.data.not_on_file||[])unknowns.push({question:`Historical handover gap: ${gap}`,resolveBy:'Reconcile this historical gap against the current contact list and new evidence; ask the account contact for any still-missing introduction or source document.'});
 if(openRequests.length)risks.push({statement:statement(`${openRequests.length} recorded requests remain open or pending in the merged request table. Confirm their current status and customer impact before making further commitments.`,unique(openRequests.flatMap(r=>r.sourceIds))),deadline:null,deadlineSourceIds:[]});
 // Evidence-gathering fallbacks also work when only discovery has arrived.
 action('authority',35,'Verify buying authority and stakeholder positions','Current decision, budget and veto authority require direct confirmation. Recorded titles and relationships alone cannot establish them.','An authority map with each person’s mandate, position and supporting source.',refs,'Commercial owner');
 action('qualify',25,'Qualify each opportunity with its buyer',account.stage.text,'For each opportunity: documented scope, value and currency, blockers, decision date and evidence for its stage.',account.deals?.flatMap(d=>d.sourceIds).length?account.deals.flatMap(d=>d.sourceIds):refs,'Commercial owner');
 action('adoption',20,'Validate operational use with local owners','Account-level discovery does not establish each site’s use, operator readiness or success criteria.','A site-to-device map, local owner introductions and an agreed operational success measure.',refs);
 const ranked=candidates.sort((a,b)=>b.priority-a.priority||a.key.localeCompare(b.key)).slice(0,3);
 const actions=ranked.map((candidate,index)=>({title:candidate.title,owner:candidate.owner,date:dateAfter(scenarioDate,index+1),reason:candidate.reason,outcome:candidate.outcome,sourceIds:candidate.sourceIds}));
 const summary=statement(`${account.stage.text}.${term?` Existing contract term ends ${term}.`:''} First priority: ${actions[0].title}. Opportunity values and buying authority need separate confirmation; the actions below are proposals.`,unique([...account.stage.sourceIds,...term && profile?[profile.id]:[],...actions[0].sourceIds]));
 return {summary,stakeholders,actions,risks,unknowns,contradictions};
}
