import {useId} from 'react';
import {opportunityMix, opportunityStages, type OpportunityStage} from './portfolioModel';
import type {Account} from './model';

const colors = ['#7865d2', '#b3a3ef', '#89b8b0', '#3f8476', '#c5c8d3'];
export function OpportunityMix({accounts, selected, onSelect}: {accounts: Account[]; selected: OpportunityStage | null; onSelect: (stage: OpportunityStage | null) => void}) {
  const {counts, total, missing} = opportunityMix(accounts);
  const title = useId();
  let offset = 0;
  return <section className="portfolio-panel pipeline-panel">
    <div className="panel-title"><div><h2>Opportunity mix</h2><p>Recorded stages across your portfolio</p></div></div>
    <div className="mix-chart">
      <svg viewBox="0 0 200 200" role="img" aria-labelledby={title}>
        <title id={title}>{total} recorded opportunities. {opportunityStages.map(s => `${counts[s]} ${s}`).join(', ')}.</title>
        <circle cx="100" cy="100" r="79" fill="none" stroke="#eeedf5" strokeWidth="17"/>
        {opportunityStages.map((s, i) => {
          const fraction = total ? counts[s] / total * 100 : 0;
          const start = offset; offset += fraction;
          return fraction > 0 && <circle key={s} cx="100" cy="100" r="79" fill="none" stroke={colors[i]} strokeWidth="17" pathLength="100" strokeDasharray={`${fraction} ${100 - fraction}`} strokeDashoffset={-start} transform="rotate(-90 100 100)" opacity={selected && selected !== s ? .22 : 1}/>;
        })}
      </svg>
      <div className="mix-center"><strong>{selected ? counts[selected] : total}</strong><span>{selected === 'other' ? 'other / unknown' : selected || 'opportunities'}</span></div>
    </div>
    <div className="mix-legend" aria-label="Filter accounts by opportunity stage">
      {opportunityStages.filter(s => s !== 'other' || counts.other > 0).map((s, i) => <button key={s} className={selected === s ? 'selected' : ''} aria-pressed={selected === s} onClick={() => onSelect(selected === s ? null : s)}><span className="legend-dot" style={{background: colors[i]}}/><span>{s === 'other' ? 'Other / unknown' : s}</span><strong>{counts[s]}</strong></button>)}
    </div>
    <p className="panel-footnote">Select a stage to find its accounts. {missing > 0 ? `${missing} account${missing === 1 ? ' has' : 's have'} no deal records yet. ` : ''}Agreement is separate from booked revenue.</p>
  </section>;
}
