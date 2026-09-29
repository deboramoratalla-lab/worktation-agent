'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { scenarios, type ScenarioId } from '@/lib/data';

type Chapter = 'Laura decides' | 'The agent works' | 'Try it';
export type TourStep = { scenario: ScenarioId; target: string | null; chapter: Chapter | null; title: string; body: string; tryQuestion?: string };

export const TOUR: TourStep[] = [
  { scenario: 'ready', target: null, chapter: null, title: 'See how it works in 1 minute', body: 'Laura approves Workations and has to defend every decision to an auditor. An agent does the chasing and checking. She decides.' },
  { scenario: 'ready', target: '.verdict', chapter: 'Laura decides', title: 'The answer comes first', body: 'The agent reads the request and says what to do now, with the evidence. This text is written live by the AI.' },
  { scenario: 'ready', target: '.pta .steps', chapter: 'Laura decides', title: 'What is left, and who owns it', body: 'Every step has an owner. Approve unlocks by rules in code, never by the AI.' },
  { scenario: 'ready', target: '.risk-row', chapter: 'Laura decides', title: 'Risk, explained', body: 'Why it is flagged and which rule it comes from, so the decision holds up in an audit.' },
  { scenario: 'ready', target: '.activity', chapter: 'Laura decides', title: 'One audit trail', body: 'Decisions, notes and every agent action in one log, each with a reason. Agent actions can be undone.' },
  { scenario: 'working', target: '.pta .steps', chapter: 'The agent works', title: 'It chases', body: 'Suba has no business visa yet. The agent asked for it and will remind the approver. Nothing for Laura to do, so Approve stays locked.' },
  { scenario: 'check', target: '.pta .steps', chapter: 'The agent works', title: "It says when it couldn't check", body: 'The issuer did not respond, so the step goes back to Laura. She can still approve, with a note on what she checked.' },
  { scenario: 'conflict', target: '.alerts', chapter: 'The agent works', title: 'It catches bad data', body: 'Trip dates before the request date, days counted in the wrong year. Approval pauses until it is fixed.' },
  { scenario: 'ready', target: '.ask', chapter: 'Try it', title: 'Your turn', body: 'Ask the agent a question, or press Reject to watch it draft a reason. Laura always has the last word.', tryQuestion: 'Why is social security medium?' },
];

const CHAPTERS: Chapter[] = ['Laura decides', 'The agent works', 'Try it'];

type Rect = { top: number; left: number; width: number; height: number };
type Side = 'left' | 'bottom' | 'top' | 'center';

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

  // Scroll first, then show the spotlight once the page has stopped moving. Avoids a flicker.
  const [moving, setMoving] = useState(true);
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    setMoving(true);
    if (!s.target) { setRect(null); setMoving(false); return; }
    let scrolled = false, stable = 0, last = '', shown = false, shownTop = 0;
    const measure = () => {
      const el = document.querySelector(s.target!) as HTMLElement | null;
      if (!el) return;
      if (!scrolled) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); scrolled = true; }
      const r = el.getBoundingClientRect();
      const key = `${Math.round(r.top)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}`;
      if (key !== last) {
        stable = 0;
        if (shown) {
          // Content changed size in place (e.g. the AI answer arrived): let the spotlight resize smoothly.
          // Only a big jump hides it until things settle again.
          if (Math.abs(r.top - 8 - shownTop) < 120) {
            last = key;
            setResizing(true);
            setRect({ top: r.top - 8, left: r.left - 8, width: r.width + 16, height: Math.min(r.height + 16, window.innerHeight - 120) });
            return;
          }
          shown = false; setMoving(true);
        }
      } else stable++;
      last = key;
      if (stable < 6 || shown) return;
      // Settled. Re-centre if the request re-rendered and pushed the target away.
      if (r.top < 72 || r.top > window.innerHeight - 120) { el.scrollIntoView({ block: 'center' }); stable = 0; return; }
      const next = { top: r.top - 8, left: r.left - 8, width: r.width + 16, height: Math.min(r.height + 16, window.innerHeight - 120) };
      setResizing(false);
      setRect(next);
      setMoving(false);
      shown = true;
      shownTop = next.top;
    };
    let raf = 0;
    const loop = () => { measure(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
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

  const [pos, setPos] = useState<{ top: number; left: number; side: Side; arrow: number }>({ top: 0, left: 0, side: 'center', arrow: 0 });
  useLayoutEffect(() => {
    const w = box.current?.offsetWidth ?? 360, h = box.current?.offsetHeight ?? 220, vw = window.innerWidth, vh = window.innerHeight, gap = 16;
    if (!rect) return setPos({ top: vh / 2 - h / 2, left: vw / 2 - w / 2, side: 'center', arrow: 0 });
    const clampY = (y: number) => Math.min(Math.max(56, y), vh - h - 16);
    const clampX = (x: number) => Math.min(Math.max(16, x), vw - w - 16);
    if (rect.left - w - gap >= 16) {
      const top = clampY(rect.top + Math.min(rect.height, 160) / 2 - 40);
      const arrow = Math.min(Math.max(24, rect.top + Math.min(rect.height, 160) / 2 - top), h - 24);
      return setPos({ top, left: rect.left - w - gap, side: 'left', arrow });
    }
    const left = clampX(rect.left + rect.width / 2 - w / 2);
    const arrow = Math.min(Math.max(24, rect.left + rect.width / 2 - left), w - 24);
    if (rect.top + rect.height + gap + h < vh) return setPos({ top: rect.top + rect.height + gap, left, side: 'bottom', arrow });
    return setPos({ top: clampY(rect.top - h - gap), left, side: 'top', arrow });
  }, [rect, step]);

  const last = step === TOUR.length - 1;
  const intro = step === 0;
  const chapterIdx = s.chapter ? CHAPTERS.indexOf(s.chapter) : -1;

  return (
    <>
      <div className={`tour-block ${!rect ? 'dim' : ''}`} />
      {rect && <div className={`tour-spot ${moving ? 'moving' : ''} ${resizing ? 'resizing' : ''}`} style={rect} />}
      <div
        ref={box}
        className={`tour-pop side-${pos.side} ${intro ? 'intro' : ''} ${moving ? 'moving' : ''} ${resizing ? 'resizing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        style={{ top: pos.top, left: pos.left, ['--arrow' as string]: `${pos.arrow}px` }}
      >
        {!intro && (
          <div className="tour-progress" aria-label={`Step ${step} of ${TOUR.length - 1}`}>
            {CHAPTERS.map((c, ci) => {
              const steps = TOUR.map((t, i) => ({ t, i })).filter(({ t }) => t.chapter === c);
              return (
                <div key={c} className={`tour-chapter ${ci === chapterIdx ? 'current' : ''}`}>
                  <div className="tour-segs">{steps.map(({ i }) => <i key={i} className={i < step ? 'done' : i === step ? 'on' : ''} />)}</div>
                  <span>{c}</span>
                </div>
              );
            })}
          </div>
        )}
        {!intro && <span key={s.scenario} className={`tour-req ${changed ? 'changed' : ''}`}><b>{who[s.scenario]}</b> · {scenarios[s.scenario].label}</span>}
        <h2 id="tour-title" className="tour-title">{s.title}</h2>
        <p id="tour-body" className="tour-body">{s.body}</p>
        <div className="tour-actions">
          {intro ? (
            <>
              <button className="tour-btn ghost" onClick={() => onClose(true)}>Explore on my own</button>
              <button className="tour-btn solid" onClick={() => onStep(1)}>Start walkthrough</button>
            </>
          ) : (
            <>
              <button className="tour-btn ghost" onClick={() => onClose(false)}>Close</button>
              <span style={{ flex: 1 }} />
              {step > 1 && <button className="tour-btn ghost" onClick={() => onStep(step - 1)}>Back</button>}
              {s.tryQuestion
                ? <button className="tour-btn solid" onClick={() => onTry(s.tryQuestion!)}>Ask “{s.tryQuestion}”</button>
                : <button className="tour-btn solid" onClick={() => (last ? onClose(true) : onStep(step + 1))}>{last ? 'Explore on my own' : 'Next'}</button>}
            </>
          )}
        </div>
        {intro && <p className="tour-hint">Use ← → to move, Esc to leave. You can restart it from the top bar.</p>}
      </div>
    </>
  );
}
