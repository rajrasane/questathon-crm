import {useMemo,useState,useId} from 'react';
import type {Account,Source} from './model';
import {usageSeries} from './usageChart';
import './visuals.css';
export function AccountVisuals({account,sources,openSources,onDeals}:{account:Account;sources:Source[];openSources:(ids:string[])=>void;onDeals:()=>void}){
 const {points,invalid}=useMemo(()=>usageSeries(sources,account.key),[sources,account.key]);
 const [selected,setSelected]=useState<number|null>(null);
 const gradient=useId();
 const active=points[selected===null?points.length-1:selected]||points.at(-1);
 const max=Math.max(1,...points.map(p=>p.flights));
 const first=Date.parse(points[0]?.week||'2000-01-01');
 const span=Math.max(86400000,Date.parse(points.at(-1)?.week||'2000-01-01')-first);
 const x=(i:number)=>45+(points.length===1?245:(Date.parse(points[i].week)-first)/span*490);
 const y=(value:number)=>145-value/max*110;
 const path=points.map((p,i)=>`${i===0||Date.parse(p.week)-Date.parse(points[i-1].week)>7*86400000?'M':'L'}${x(i)},${y(p.flights)}`).join(' ');
 const date=(s:string)=>new Date(s+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
 const stages=['identified','qualified','cleared','agreed'];
 const deals=account.deals||[];
 return <div className="account-visuals">
  <section className="visual-card"><div className="visual-heading"><div><h2>Flight activity</h2><p>Recorded flights by week · this account</p></div>{active&&<button className="source-link" onClick={()=>openSources(active.sourceIds)}>View evidence</button>}</div>
   {active?<><div className="chart-readout" aria-live="polite"><strong>{active.flights.toLocaleString()}</strong><span>flights · week of {date(active.week)}<small>{active.docks} devices represented</small></span></div>
    <svg className="usage-chart" viewBox="0 0 570 180" role="group" aria-label="Weekly recorded flights. Focus or select a point to inspect its values and evidence.">
    <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8274db" stopOpacity=".16"/><stop offset="100%" stopColor="#8274db" stopOpacity="0"/></linearGradient></defs>
    {[0,.5,1].map(v=><g key={v}><line x1="45" x2="535" y1={y(v*max)} y2={y(v*max)} stroke="#ececf3" strokeDasharray={v?'3 4':undefined}/><text x="34" y={y(v*max)+4} textAnchor="end">{Math.round(v*max)}</text></g>)}
    {points.length>1&&points.every((p,i)=>i===0||Date.parse(p.week)-Date.parse(points[i-1].week)<=7*86400000)&&<path d={`${path} L${x(points.length-1)},145 L${x(0)},145 Z`} fill={`url(#${gradient})`}/>}
    <path d={path} fill="none" stroke="#7765d2" strokeWidth="2.5" strokeLinejoin="round"/>
    {points.map((p,i)=><g key={p.week}><circle cx={x(i)} cy={y(p.flights)} r="10" fill="transparent" tabIndex={0} role="button" aria-label={`Week ${p.week}: ${p.flights} flights from ${p.docks} devices. Open evidence.`} onMouseEnter={()=>setSelected(i)} onFocus={()=>setSelected(i)} onClick={()=>openSources(p.sourceIds)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openSources(p.sourceIds);}}}/><circle cx={x(i)} cy={y(p.flights)} r={active.week===p.week?5:3} fill="white" stroke="#7765d2" strokeWidth="2" pointerEvents="none"/></g>)}
    <text x="45" y="169">{date(points[0].week)}</text>{points.length>1&&<text x="535" y="169" textAnchor="end">{date(points.at(-1)!.week)}</text>}
    </svg><details className="chart-table"><summary>Weekly values & coverage</summary><table><thead><tr><th>Week starting</th><th>Flights</th><th>Devices</th></tr></thead><tbody>{points.map(p=><tr key={p.week}><td><button onClick={()=>openSources(p.sourceIds)}>{p.week}</button></td><td>{p.flights}</td><td>{p.docks}</td></tr>)}</tbody></table></details><p className="visual-note">Totals cover reported device rows. Coverage may vary; missing weeks are not zero.</p></>:<p className="visual-empty">{invalid?'Usage records need validation before they can be charted.':'Weekly usage records are not available for this account yet.'}</p>}
  </section>
  <section className="visual-card"><div className="visual-heading"><div><h2>Opportunity journey</h2><p>Where the recorded opportunities stand</p></div><button className="source-link" onClick={onDeals}>View deals</button></div><div className="journey">{stages.map((s,i)=>{const items=deals.filter(d=>d.stage.text.toLowerCase()===s);return <button className={`journey-step ${items.length?'has-deals':''}`} key={s} onClick={()=>items.length?openSources(items.flatMap(d=>d.stage.sourceIds)):onDeals()} aria-label={`${items.length} ${s} opportunities. ${items.length?'Open evidence':'View deals'}`}><span className="journey-node">{i+1}</span><strong>{items.length}</strong><span>{s}</span></button>;})}</div><p className="visual-note">Stage counts describe current records. They do not imply conversion probability or booked revenue.</p></section>
 </div>;
}
