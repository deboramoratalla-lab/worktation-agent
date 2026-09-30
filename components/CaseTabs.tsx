'use client';
import { useState } from 'react';
import { Icon } from './Icon';

export type CaseTab = { name: string; scenario: string; tag: string; tone: 'ok' | 'warn' | 'bad'; summary: string; try: string[] };

// Pill tabs that switch between the four prototype cases.
export function CaseTabs({ cases }: { cases: CaseTab[] }) {
  const [i, setI] = useState(0);
  const c = cases[i];
  return (
    <div className="lp-tabs">
      <div className="lp-tablist" role="tablist" aria-label="Prototype cases">
        {cases.map((x, k) => (
          <button key={x.name} role="tab" id={`tab-${x.scenario}`} aria-selected={k === i} aria-controls="case-panel" tabIndex={k === i ? 0 : -1}
            className="lp-tab" onClick={() => setI(k)}
            onKeyDown={(e) => { if (e.key === 'ArrowRight') setI((i + 1) % cases.length); if (e.key === 'ArrowLeft') setI((i + cases.length - 1) % cases.length); }}>
            {x.name}
          </button>
        ))}
      </div>
      <div className="lp-panel" role="tabpanel" id="case-panel" aria-labelledby={`tab-${c.scenario}`}>
        <div className="lp-panel-l">
          <span className={`lp-pill lp-pill-${c.tone}`}>{c.tag}</span>
          <h3>{c.name}’s request</h3>
          <p>{c.summary}</p>
          <p className="lp-try-h">Things to try</p>
          <ul className="lp-checks">
            {c.try.map((t) => (<li key={t}><Icon name="check" size={16} />{t}</li>))}
          </ul>
          <a className="lp-btn lp-btn-pink" href={`/?s=${c.scenario}`}>Open {c.name}’s request<Icon name="arrow-right" size={16} /></a>
        </div>
        <div className="lp-panel-r" aria-hidden="true">
          <div className="lp-win">
            <div className="lp-win-bar"><i /><i /><i /><span>workation-agent.vercel.app/?s={c.scenario}</span></div>
            <div className="lp-win-body">
              <p className="lp-mock-label">Summary by the agent · Sources</p>
              <p className="lp-win-text">{c.summary}</p>
              <div className="lp-mock-btns"><span className="lp-mock-b1">Approve</span><span className="lp-mock-b2">Reject</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
