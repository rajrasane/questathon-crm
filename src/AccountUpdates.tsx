import type { ReactNode } from 'react';
import { money, type Account, type Statement } from './model';
export function AccountUpdates({account,statement}:{account:Account;citations:(ids:string[])=>ReactNode;statement:(s:Statement)=>ReactNode}) {
 return <>
 {account.analysisNeedsReview&&<div className="notice" role="status">New or changed signals are loaded. The editorial brief and ranked actions need review against the latest evidence.</div>}
 {!!account.usageInsights?.length&&<details className="panel update-panel"><summary>Operational evidence · dated usage analysis</summary>{account.usageInsights.map((s,i)=><div key={i} className="list-item">{statement(s)}</div>)}</details>}
 {!!account.signals?.length&&<section className="panel update-panel"><div className="section-heading"><div><div className="eyebrow">WHAT CHANGED</div><h2>Incoming signals</h2></div><span className="outline-tag">Scenario chronology</span></div>{account.signals.map(s=><article className="signal-row" key={s.id}><time>{s.date}</time><div><h3>{s.title}</h3>{statement(s.summary)}</div></article>)}</section>}
 </>;
}
export function AccountDetails({account,citations,statement}:{account:Account;citations:(ids:string[])=>ReactNode;statement:(s:Statement)=>ReactNode}) {
 return <>
 {!!account.offers?.length&&<section className="panel update-panel"><div className="section-heading"><div><div className="eyebrow">PITCHES / SEPARATE FROM REVENUE</div><h2>Account offers</h2></div></div><p className="muted">The export does not link these offers to individual deals. No value is counted as booked revenue, and missing currency remains unknown.</p>{account.offers.map((o,i)=><div className="offer-row" key={i}><div><h3>{o.title}</h3>{citations(o.sourceIds)}</div><div><span className={`label offer-${o.status}`}>{o.status}</span>{citations(o.statusSourceIds)}</div><div>{money(o.value)}{citations(o.value.sourceIds)}</div></div>)}</section>}
 {!!account.facts?.length&&<details className="panel update-panel"><summary>Discovery evidence · {account.facts.length} statements</summary><p className="muted">These are statements discovered during the game. Their original claim, told or verified status is preserved.</p>{account.facts.map((s,i)=><div className="list-item" key={i}>{statement(s)}</div>)}</details>}
 {!!account.contacts?.length&&<details className="panel update-panel"><summary>Known contacts · {account.contacts.length}</summary><p className="muted">A relationship or title alone does not establish purchasing authority.</p>{account.contacts.map(p=><div className="list-item" key={p.id}><h3>{p.name}</h3><p className="muted">{p.role} · Discovery relationship: {p.relationship}</p>{citations(p.sourceIds)}</div>)}</details>}
 </>;
}
