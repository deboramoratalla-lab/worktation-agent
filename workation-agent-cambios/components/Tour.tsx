'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { scenarios, type ScenarioId } from '@/lib/data';

export type TourStep = { scenario: ScenarioId; target: string; title: string; body: string; tryQuestion?: string };

export const TOUR: TourStep[] = [
  { scenario: 'ready', target: '.verdict', title: 'Start with the answer', body: 'The agent reads the request and tells Laura what to do now, with the evidence behind it. This summary is written live by the AI. If the AI is down, it says so here and the rules keep working.' },
  { scenario: 'ready', target: '.pta .steps', title: 'What is left, and who owns it', body: 'Every step has an owner. Approve unlocks by rules in code, never by the AI.' },
  { scenario: 'ready', target: '.risk-row', title: 'Risk, explained', body: 'Each risk says why it is flagged and which rule it comes from, so Laura can defend the decision to an auditor.' },
  { scenario: 'ready', target: '.activity', title: 'One audit trail', body: 'Decisions, comments and every agent action in one log, with the reason and an Undo.' },
  { scenario: 'working', target: '.pta .steps', title: 'Next request: the agent is chasing', body: 'Suba has no business visa yet. The agent asked for it and will remind the approver. Nothing for Laura to do, so Approve stays locked.' },
  { scenario: 'check', target: '.pta .steps', title: "When the agent can't verify", body: "It says so and hands the step back to Laura. She can still approve, but must write down what she checked herself." },
  { scenario: 'conflict', target: '.alerts', title: 'Bad data, caught before the decision', body: 'Trip dates are before the request date and the days count against the wrong year. Approval pauses until it is fixed.' },
  { scenario: 'ready', target: '.ask', title: 'Your turn', body: 'Ask the agent anything about this request, or press Reject to see it draft a reason. Laura always has the last word.', tryQuestion: 'Why is social security medium?' },
];

type Rect = { top: number; left: number; width: number; height: number };

const who: Record<ScenarioId, string> = Object.fromEntries(
  (Object.keys(scenarios) as ScenarioId[]).map((id) => [id, scenarios[id].build().employee]),
) as Record<ScenarioId, string>;

export function Tour({ step, onStep, onClose, onTry }: { step: number; onStep: (i: number) => void; onClose: (finished: boolean) => void; onTry: (q: string) => void }) {
  const s = TOUR[step];
  const prev = useRef(s.scenario);
  const changed = prev.current !== s.scenario;
  useEffect(() => { prev.current = s.scenario; }, [s.scenario]);
  const [rect, setRect] = useState<Rect | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Find and follow the target
  useEffect(() => {
    let scrolled = false;
    const measure = () => {
      const el = document.querySelector(s.target) as HTMLElement | null;
      if (!el) return setRect(null);
      let r = el.getBoundingClientRect();
      // Keep the target in view while the request re-renders under it
      const off = r.top < 72 || r.bottom > window.innerHeight - 16;
      if (!scrolled || off) { el.scrollIntoView({ block: 'center', behavior: scrolled ? 'auto' : 'smooth' }); scrolled = true; r = el.getBoundingClientRect(); }
      setRect((p) => p && p.top === r.top - 8 && p.left === r.left - 8 && p.width === r.width + 16 && p.height === r.height + 16 ? p : { top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 });
    };
    let raf = 0;
    const loop = () => { measure(); raf = requestAnimationFrame(loop); };
    const t0 = setTimeout(loop, 150);
    return () => { clearTimeout(t0); cancelAnimationFrame(raf); };
  }, [s.target, step]);

  useEffect(() => { box.current?.focus(); }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(false); }
      if (e.key === 'ArrowRight' && step < TOUR.length - 1) onStep(step + 1);
      if (e.key === 'ArrowLeft' && step > 0) onStep(step - 1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [step, onStep, onClose]);

  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 80, left: 80 });
  useLayoutEffect(() => {
    const w = 340, h = box.current?.offsetHeight ?? 200, vw = window.innerWidth, vh = window.innerHeight;
    if (!rect) return setPos({ top: vh / 2 - h / 2, left: vw / 2 - w / 2 });
    let left = rect.left - w - 16; // prefer left of target
    let top = rect.top;
    if (left < 16) { left = Math.min(Math.max(16, rect.left), vw - w - 16); top = rect.top + rect.height + 12; if (top + h > vh - 16) top = rect.top - h - 12; }
    top = Math.min(Math.max(56, top), vh - h - 16);
    setPos({ top, left });
  }, [rect]);

  const last = step === TOUR.length - 1;
  return (
    <>
      <div className="tour-block" />
      {rect && <div className="tour-spot" style={rect} />}
      <div ref={box} className="tour-pop" role="dialog" aria-modal="true" aria-labelledby="tour-title" tabIndex={-1} style={pos}>
        <div className="tour-top">
          <span className="t-overline c-muted">Walkthrough · {step + 1} of {TOUR.length}</span>
          <button className="link-btn t-caption" onClick={() => onClose(false)}>Close</button>
        </div>
        <span key={s.scenario} className={`tour-req ${changed ? 'changed' : ''}`}><b>{who[s.scenario]}</b> · {scenarios[s.scenario].label}</span>
        <h2 id="tour-title" className="t-heading-s" style={{ margin: 0 }}>{s.title}</h2>
        <p className="c-secondary">{s.body}</p>
        <div className="tour-dots" aria-hidden="true">{TOUR.map((_, i) => <i key={i} className={i === step ? 'on' : ''} />)}</div>
        {s.tryQuestion && <button className="btn btn-secondary tour-try" onClick={() => onTry(s.tryQuestion!)}>Try: “{s.tryQuestion}”</button>}
        <div className="tour-actions">
          {step > 0 && <button className="btn btn-secondary" onClick={() => onStep(step - 1)}>Back</button>}
          <button className="btn btn-primary" onClick={() => (last ? onClose(true) : onStep(step + 1))}>{last ? 'Explore on my own' : 'Next'}</button>
        </div>
      </div>
    </>
  );
}
