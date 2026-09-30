'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Logo, ShieldSolid, type IconName } from '@/components/Icon';
import { scenarios, type ActivityEntry, type Level, type ScenarioId, type Step, type WorkationRequest } from '@/lib/data';
import { canApprove, ruleChecks, type Assessment } from '@/lib/agent';
import { Tour, TOUR } from '@/components/Tour';
import { applyEdits, datesLabel, shortDay, editsKey, formatDay, workingDays, type Edits } from '@/lib/scenario';

const ORDER: ScenarioId[] = ['ready', 'working', 'check', 'conflict'];
const rank: Record<Level, number> = { Low: 0, Medium: 1, High: 2 };

type AssessState = { status: 'loading' } | { status: 'ok'; data: Assessment; model: string; at: string } | { status: 'error' };
type DialogState =
  | null
  | { kind: 'reject' | 'message' | 'reminder'; text: string; streaming: boolean; reason?: string }
  | { kind: 'settings' }
  | { kind: 'dates'; start: string; end: string }
  // Approving past a rule. The reason is always written by Laura; the agent only suggests checks.
  | { kind: 'override'; variant: 'no-coverage' | 'approve-anyway'; text: string; checked: boolean[] }
  | { kind: 'cancel' };

async function streamText(url: string, body: object, onChunk: (full: string) => void, signal?: AbortSignal) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) throw new Error(await res.text());
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += dec.decode(value, { stream: true });
    onChunk(full);
  }
  return full;
}

// Checks the agent suggests before approving past a rule. Laura ticks them; the reason stays hers.
const OVERRIDE_CHECKS: Record<'no-coverage' | 'approve-anyway', (first: string) => string[]> = {
  'no-coverage': (first) => ['Visa appointment is booked before the trip', 'Tom knows the company carries the risk', `${first} won't work until the visa is issued`],
  'approve-anyway': () => ['A1 checked with payroll', 'Certificate number noted'],
};
const RULES_VERSION = 'WorkFlex engine, Sep 2026';
type Role = 'gm' | 'hr';

const now = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
let seq = 0;
const uid = () => `x${++seq}`;

export default function Page() {
  const [scenario, setScenario] = useState<ScenarioId>('ready');
  const baseReq = useMemo<WorkationRequest>(() => scenarios[scenario].build(), [scenario]);
  // Laura's changes in this session (confirmed dates, new dates). Rules re-run on the edited request.
  const [edits, setEdits] = useState<Partial<Record<ScenarioId, Edits>>>({});
  const ed = useMemo<Edits>(() => edits[scenario] ?? {}, [edits, scenario]);
  const edKey = editsKey(ed);
  const req = useMemo<WorkationRequest>(() => applyEdits(baseReq, ed), [baseReq, ed]);
  // The demo runs on the request's own calendar (req.today), not the machine clock, so the log stays in order.
  const at = () => `${shortDay(req.today)}, ${now()}`;
  const [activity, setActivity] = useState<ActivityEntry[]>(req.activity);
  const [assess, setAssess] = useState<AssessState>({ status: 'loading' });
  const [approved, setApproved] = useState(false);
  const [noCoverage, setNoCoverage] = useState(false);
  // Demo only: who is looking. Only Global Mobility may approve past a rule.
  const [role, setRole] = useState<Role>('gm');
  const [sentToGM, setSentToGM] = useState(false);
  const [open, setOpen] = useState(true);
  const [openRisk, setOpenRisk] = useState<Record<string, boolean>>({ ss: true });
  const [showAll, setShowAll] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [undone, setUndone] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ q: string; text: string; streaming: boolean; error?: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [tour, setTour] = useState<number | null>(null);
  const tourResume = useRef(0);
  const goTour = useCallback((i: number) => { setMenu(false); setDialog(null); setOpen(true); setScenario(TOUR[i].scenario); setTour(i); tourResume.current = i; }, []);
  const closeTour = useCallback((finished: boolean) => { setTour(null); if (finished) tourResume.current = 0; }, []);
  const tryQuestion = useCallback((q: string) => {
    closeTour(true);
    setQuestion(q);
    setTimeout(() => { const el = document.getElementById('ask'); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); el?.focus(); }, 50);
  }, [closeTour]);
  useEffect(() => {
    try { if (!localStorage.getItem('tour-seen')) { localStorage.setItem('tour-seen', '1'); setTimeout(() => goTour(0), 600); } } catch {}
  }, [goTour]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastFocus = useRef<HTMLElement | null>(null);

  const log = useCallback((e: Omit<ActivityEntry, 'id'>) => setActivity((a) => [{ id: uid(), ...e }, ...a]), []);
  const showToast = useCallback((msg: string, undo?: () => void) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, undo });
    toastTimer.current = setTimeout(() => setToast(null), 10000);
  }, []);

  // Only the latest request may write. A slow answer for another request is dropped.
  const assessRun = useRef(0);
  const assessCache = useRef<Record<string, { data: Assessment; model: string; at: string }>>({});
  const runAssessment = useCallback(async (id: ScenarioId, e: Edits = {}, force = false) => {
    const run = ++assessRun.current;
    const ck = `${id}|${editsKey(e)}`;
    const cached = assessCache.current[ck];
    if (cached && !force) { setAssess({ status: 'ok', ...cached }); return; }
    setAssess({ status: 'loading' });
    // Wait a moment so skipping quickly through requests doesn't fire a call for each one
    await new Promise((ok) => setTimeout(ok, 500));
    if (run !== assessRun.current) return;
    try {
      const res = await fetch('/api/assess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: id, edits: e }) });
      const json = await res.json();
      if (run !== assessRun.current) return;
      if (!res.ok) throw new Error(json.error);
      assessCache.current[ck] = { data: json.assessment, model: json.model, at: json.at };
      setAssess({ status: 'ok', data: json.assessment, model: json.model, at: json.at });
      log({ kind: 'agent', title: 'Agent checked the request', body: json.assessment.summary, time: `${at()} · auto`, source: json.assessment.sources.join(', ') });
    } catch {
      if (run !== assessRun.current) return;
      setAssess({ status: 'error' });
      log({ kind: 'agent-failed', title: "Agent couldn't run the check", body: 'The summary below is missing. Rules still decide if Approve is available.', time: `${at()} · auto` });
    }
  }, [log]);

  // When the walkthrough starts, fetch the other requests' assessments in the background,
  // so each step shows the finished answer instead of loading and then shifting.
  const prefetched = useRef(false);
  useEffect(() => {
    if (tour === null || prefetched.current) return;
    prefetched.current = true;
    const empty = editsKey({});
    const ids = [...new Set(TOUR.map((t) => t.scenario))].filter((id) => id !== scenario && !assessCache.current[`${id}|${empty}`]);
    ids.forEach((id, i) => setTimeout(async () => {
      try {
        const res = await fetch('/api/assess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: id }) });
        const json = await res.json();
        if (res.ok && !assessCache.current[`${id}|${empty}`]) assessCache.current[`${id}|${empty}`] = { data: json.assessment, model: json.model, at: json.at };
      } catch { /* the step will load it normally */ }
    }, 300 * (i + 1)));
  }, [tour, scenario]);

  // Reset on scenario change
  useEffect(() => {
    setActivity(baseReq.activity);
    setApproved(false);
    setNoCoverage(false);
    setSentToGM(false);
    setDismissed({});
    setUndone({});
    setAnswer(null);
    setShowAll(false);
    setOpenRisk({ [baseReq.risks.slice().sort((a, b) => rank[b.level] - rank[a.level])[0].id]: true });
  }, [scenario, baseReq]);

  // The agent re-checks whenever the request or Laura's edits change
  useEffect(() => {
    runAssessment(scenario, ed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, edKey, runAssessment]);

  // Keyboard: Esc closes drawer or dialog, J/K move through the queue
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        if (dialog) closeDialog();
        else if (menu) setMenu(false);
        else if (open) setOpen(false);
      }
      if (open && !dialog && (e.key === 'j' || e.key === 'k')) move(e.key === 'j' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const move = (d: number) => setScenario(ORDER[(ORDER.indexOf(scenario) + d + ORDER.length) % ORDER.length]);

  const checks = ruleChecks(req);
  const approvable = canApprove(req);
  const needsYou = req.steps.some((s) => s.state === 'Needs you');
  const topLevel = req.risks.reduce<Level>((m, r) => (rank[r.level] > rank[m] ? r.level : m), 'Low');
  const done = req.steps.filter((s) => s.state === 'Done').length;
  const firstName = req.employee.split(' ')[0];

  // ----- Dialog helpers -----
  const abortRef = useRef<AbortController | null>(null);
  function openDraft(kind: 'reject' | 'message' | 'reminder', reason?: string) {
    lastFocus.current = document.activeElement as HTMLElement;
    setMenu(false);
    setDialog({ kind, text: '', streaming: true, reason });
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    streamText('/api/draft', { scenario, kind, reason, edits: ed }, (full) => setDialog((d) => (d && 'text' in d ? { ...d, text: full } : d)), ctrl.signal)
      .then(() => setDialog((d) => (d && 'text' in d ? { ...d, streaming: false } : d)))
      .catch(() => setDialog((d) => (d && 'text' in d ? { ...d, streaming: false, text: d.text || '' } : d)));
  }
  function closeDialog() {
    abortRef.current?.abort();
    setDialog(null);
    lastFocus.current?.focus();
  }

  // ----- Dates: rules pause, Laura decides -----
  function confirmDates() {
    const sc = scenario, prev = ed;
    setEdits((all) => ({ ...all, [sc]: { ...prev, confirmed: [...new Set([...(prev.confirmed ?? []), 'past-dates'])] } }));
    log({ kind: 'decision', title: 'You confirmed the dates are correct', body: `Trip ${req.dates.label}. This rule no longer pauses Approve.`, time: `${at()}`, source: 'Rule: trip dates before the request was submitted (past-dates)' });
    showToast('Dates confirmed. The agent is re-checking the request.', () => {
      setEdits((all) => ({ ...all, [sc]: prev }));
      log({ kind: 'decision', title: 'You undid the date confirmation', time: `${at()}` });
    });
  }
  function openDates() {
    lastFocus.current = document.activeElement as HTMLElement;
    setMenu(false);
    setDialog({ kind: 'dates', start: req.dates.start, end: req.dates.end });
  }
  function saveDates(start: string, end: string) {
    const sc = scenario, prev = ed, before = req.dates.label;
    const changedDays = workingDays(start, end) !== req.workingDays;
    setEdits((all) => ({ ...all, [sc]: { dates: { start, end }, reopen: changedDays ? ['mgr'] : [] } }));
    closeDialog();
    log({ kind: 'decision', title: `You changed the dates to ${datesLabel(start, end)}`, body: `Before: ${before}.${changedDays ? ' Manager approval reopens.' : ''} The agent re-checks the risk.`, time: `${at()}` });
    showToast(`Dates changed. ${firstName} and Tom were notified.`, () => {
      setEdits((all) => ({ ...all, [sc]: prev }));
      log({ kind: 'decision', title: 'You undid the change of dates', time: `${at()}` });
    });
  }

  // ----- Decision snapshot: what Laura saw when she decided. Locked; Undo adds a new entry. -----
  function logDecision(entry: Omit<ActivityEntry, 'id'>) {
    const current = req.sourceChecks.filter((s) => s.status === 'current').length;
    const checkedAt = assess.status === 'ok' ? new Date(assess.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null;
    const dims = req.risks.slice().sort((a, b) => rank[b.level] - rank[a.level]).map((r) => `${r.name} ${r.level.toLowerCase()}`).join(', ');
    const { before, thisTrip, limit, year } = req.daysAbroad;
    const snapshot = [
      `Risk after mitigation: ${topLevel.toLowerCase()} (${dims}, ${req.lowCount} more low)`,
      `Sources: ${current} of ${req.sourceChecks.length} current${checkedAt ? `, checked ${checkedAt}` : ''}`,
      `Rules: ${RULES_VERSION}. ${checks.length ? `Open: ${checks.map((c) => c.title).join('; ')}` : 'No open rule checks'}${req.confirmedRules?.length ? `. Confirmed by you: ${req.confirmedRules.join(', ')}` : ''}`,
      `Days in ${req.to.country}, ${year}: ${before + thisTrip} of ${limit}`,
      assess.status === 'ok' ? `Agent summary saved as shown: “${assess.data.headline}. ${assess.data.summary}”` : 'Agent summary: not available, the agent couldn’t run the check',
    ];
    const time = `${at()}`;
    log({ kind: 'decision', title: 'Decision snapshot', body: 'What you saw when you decided', time, snapshot });
    log({ ...entry, time });
  }

  // ----- Approving past a rule (Global Mobility only) -----
  function openOverride(variant: 'no-coverage' | 'approve-anyway') {
    lastFocus.current = document.activeElement as HTMLElement;
    setDialog({ kind: 'override', variant, text: '', checked: OVERRIDE_CHECKS[variant](firstName).map(() => false) });
  }
  function confirmOverride(variant: 'no-coverage' | 'approve-anyway', reason: string, checked: boolean[]) {
    const items = OVERRIDE_CHECKS[variant](firstName);
    const ticked = items.filter((_, i) => checked[i]);
    const checksLine = `Checked before approving: ${ticked.length ? ticked.join('; ') : 'none'} (${ticked.length} of ${items.length} suggested)`;
    closeDialog();
    setApproved(true);
    setNoCoverage(variant === 'no-coverage');
    if (variant === 'no-coverage') log({ kind: 'agent', title: 'Agent keeps chasing the business visa', body: 'The visa step stays with the agent. WorkFlex coverage starts when the visa is issued.', time: `${at()} · auto` });
    logDecision(variant === 'no-coverage'
      ? { kind: 'decision', title: 'You approved without WorkFlex coverage', body: `Reason: ${reason}\n${checksLine}`, time: '', source: 'Work entitlement: high risk, business visa not issued (WE_TH_03)' }
      : { kind: 'decision', title: 'You approved without a verified A1 certificate', body: `Reason: ${reason}\n${checksLine}`, time: '', source: 'Social security: A1 not verified with the issuer (BT_WE_12)' });
    showToast(variant === 'no-coverage' ? `Approved without coverage. ${firstName} and Tom were notified.` : `Request approved. ${firstName} and Tom were notified.`, () => {
      setApproved(false);
      setNoCoverage(false);
      log({ kind: 'decision', title: 'You undid the approval', body: 'The decision and its snapshot stay in the log.', time: `${at()}` });
    });
  }
  function sendToGlobalMobility() {
    setSentToGM(true);
    log({ kind: 'decision', title: 'You sent the request to Global Mobility', body: 'Approving past a rule needs Global Mobility. They get the request with its current risk and sources.', time: `${at()}`, source: 'Permission: only Global Mobility can approve past a rule' });
    showToast('Sent to Global Mobility.', () => {
      setSentToGM(false);
      log({ kind: 'decision', title: 'You took the request back from Global Mobility', time: `${at()}` });
    });
  }

  function approve() {
    setApproved(true);
    logDecision({ kind: 'decision', title: 'You approved the request', time: '' });
    showToast(`Request approved. ${firstName} and Tom were notified.`, () => {
      setApproved(false);
      log({ kind: 'decision', title: 'You undid the approval', body: 'The decision and its snapshot stay in the log.', time: `${at()}` });
    });
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setQuestion('');
    setAnswer({ q, text: '', streaming: true });
    try {
      const full = await streamText('/api/ask', { scenario, question: q, edits: ed }, (t) => setAnswer({ q, text: t, streaming: true }));
      setAnswer({ q, text: full, streaming: false });
      log({ kind: 'agent', title: `Agent answered: “${q}”`, body: full, time: `${at()} · on request` });
    } catch {
      setAnswer({ q, text: "The agent couldn't answer right now. Try again in a moment.", streaming: false, error: true });
    }
  }

  const aiAnomalies = assess.status === 'ok' ? assess.data.anomalies : [];
  // Rule checks always show. The agent's anomalies add to them, never replace them.
  // Date conflicts use the fixed Figma copy, never AI text. One banner covers both date rules.
  const pastDates = checks.some((c) => c.id === 'past-dates');
  type Banner = { title: string; detail: string; action: string; by: string; kind: 'dates' | 'rule' | 'info' | 'agent' | 'error' };
  const tripYear = Number(req.dates.start.slice(0, 4));
  const banners: Banner[] = [
    // Rules are deterministic: show them at once, even while the agent is still checking
    ...(checks.filter((c) => !(pastDates && c.id === 'year-mismatch')).map((c): Banner => c.id === 'past-dates'
      ? { title: 'These dates are in the past', detail: `The trip was ${req.dates.label}, but the request was created on ${formatDay(req.submitted)}. The risk check and day balance use these dates, so check them with ${firstName} before deciding.`, action: '', by: 'Flagged by rules', kind: 'dates' }
      : { title: c.title, detail: c.detail, action: '', by: 'Flagged by rules', kind: 'rule' })),
    ...(ed.confirmed?.includes('past-dates') && tripYear !== Number(req.today.slice(0, 4)) ? [{ title: `Balance shown for ${tripYear}`, detail: 'Showing the year of the trip, not the current year.', action: '', by: 'Flagged by rules', kind: 'info' as const }] : []),
    ...(assess.status === 'ok' ? aiAnomalies.map((a): Banner => ({ title: a.title, detail: a.detail, action: a.suggestedAction, by: 'Flagged by the agent', kind: 'agent' })) : []),
  ];
  const blocking = checks.some((c) => c.severity === 'blocking');
  // Visa not issued and nothing else blocking: Laura may approve, but WorkFlex won't cover it
  const canApproveWithoutCoverage = !approvable && !blocking && req.steps.some((s) => s.id === 'visa' && s.state !== 'Done');

  const [filter, setFilter] = useState<'all' | 'needs'>('all');
  const needsYouCount = ORDER.filter((id) => id !== 'working').length;
  const visibleActivity = showAll ? activity : activity.slice(0, 2);

  return (
    <>
      <div className="shell" aria-hidden={open}>
        <Sidebar needsYou={needsYouCount} />
        <main className="list">
          <p className="t-heading-l">Employee requests</p>
          <div className="tabs t-label-m"><span className="tab-active"><Icon name="briefcase" /> Workations <span className="pill">{ORDER.length}</span></span></div>
          <div className="filters" role="group" aria-label="Filter requests">
            <button className="filter" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All requests <span className="pill">{ORDER.length}</span></button>
            <button className="filter" aria-pressed={filter === 'needs'} onClick={() => setFilter('needs')}>Needs you <span className="pill">{needsYouCount}</span></button>
          </div>
          <div className="table">
            {ORDER.filter((id) => filter === 'all' || id !== 'working').map((id) => {
              const q = scenarios[id].build();
              const lvl = q.risks.reduce<Level>((m, x) => (rank[x.level] > rank[m] ? x.level : m), 'Low');
              return (
                <button key={id} className={`table-row ${id === scenario ? 'selected' : ''}`} onClick={() => { setScenario(id); setOpen(true); }}>
                  <span className="n">{q.employee}</span>
                  <span className="r">{q.from.country} to {q.to.country} · {q.dates.label}</span>
                  <RiskBadge level={lvl} />
                </button>
              );
            })}
          </div>
        </main>
      </div>

      {open && (
        <>
          <div className="scrim" onClick={() => setOpen(false)} />
          <section className="drawer" role="dialog" aria-modal="true" aria-labelledby="req-name">
            <div className="topbar">
              <div className="crumb t-label-m">
                <span className="briefcase"><Icon name="briefcase" size={20} /></span>
                <span className="c-link">Workations</span>
                <Icon name="chevron-right" className="c-secondary" />
                <span>{req.id}</span>
              </div>
              <div className="queue">
                <span className="t-caption c-secondary">{ORDER.indexOf(scenario) + 1} of {ORDER.length} requests</span>
                <button className="icon-btn bordered" aria-label="Previous request (K)" onClick={() => move(-1)}><Icon name="chevron-left" /></button>
                <button className="icon-btn bordered" aria-label="Next request (J)" onClick={() => move(1)}><Icon name="chevron-right" /></button>
              </div>
              <span className="divider" />
              <button className="icon-btn bordered" aria-label="Close" onClick={() => setOpen(false)}><Icon name="close" /></button>
            </div>

            <div className="drawer-body">
              <div className="req-header">
                <div className="identity">
                  <h1 id="req-name" className="t-heading-l" style={{ margin: 0 }}>{req.employee}</h1>
                  <div className="meta">
                    <span className="route t-label-m"><FlagAT /> {req.from.country} <Icon name="arrow-right" className="c-secondary" /> <FlagTH /> {req.to.country}</span>
                    <span className={`chip ${checks.some((c) => c.id === 'past-dates') ? 'warn' : ''}`}>
                      {checks.some((c) => c.id === 'past-dates') && <Icon name="alert" size={12} />}
                      {req.dates.label}
                    </span>
                    <span className="chip">{req.workingDays} working days</span>
                    <span className="chip">Workation</span>
                    <span className="chip">Submitted 31 Mar</span>
                    <a className="t-label-s c-link" href="#" onClick={(e) => e.preventDefault()} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', textDecoration: 'none' }}>Thailand guide <Icon name="external-link" size={14} /></a>
                  </div>
                </div>
                <div className="menu-wrap">
                  <button className="btn btn-secondary" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                    <Icon name="more-vertical" /> Actions
                  </button>
                  {menu && (
                    <div className="menu" role="menu" onKeyDown={(e) => {
                      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                      e.preventDefault();
                      const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
                      const i = items.indexOf(document.activeElement as HTMLElement);
                      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
                    }}>
                      <button role="menuitem" onClick={openDates}><Icon name="calendar" /> Change dates</button>
                      <button role="menuitem" onClick={() => openDraft('message')}><Icon name="message" /> Message {firstName}</button>
                      <hr />
                      <button role="menuitem" className="danger" onClick={() => { lastFocus.current = document.activeElement as HTMLElement; setMenu(false); setDialog({ kind: 'cancel' }); }}><Icon name="close" /> Cancel request</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="body">
                <div className="content">
                  {banners.some((b) => !dismissed[b.title]) && (
                  <div className="alerts">
                  {banners.filter((b) => !dismissed[b.title]).map((b) => (
                    <div key={b.title} className={`alert ${b.kind === 'info' ? 'info' : b.kind === 'error' ? 'error' : ''}`} role={b.kind === 'error' ? 'alert' : 'status'}>
                      <span className="ic"><Icon name="alert" size={20} /></span>
                      <div className="alert-text">
                        <p className="t-heading-s">{b.title}</p>
                        <p className="c-secondary">{b.detail}{b.action ? ` ${b.action}.` : ''}</p>
                        {b.kind === 'rule' && <div className="alert-actions"><button className="btn btn-secondary" onClick={() => openDraft('message')}><Icon name="message" /> Ask {firstName} to confirm</button></div>}
                        <div className="alert-meta t-caption">
                          {b.kind === 'agent' && <span style={{ color: 'var(--color-agent-fg)', display: 'inline-flex' }}><Icon name="sparkle" size={12} /></span>}
                          <span style={{ color: b.kind === 'agent' ? 'var(--color-agent-fg)' : undefined }}>{b.by}</span><span aria-hidden="true">·</span>
                          <button className="link-btn t-caption" onClick={() => { setDismissed((d) => ({ ...d, [b.title]: true })); log({ kind: 'decision', title: `You dismissed a flag: ${b.title}`, time: `${at()}` }); }}>Dismiss</button>
                        </div>
                      </div>
                      {b.kind === 'dates' && (
                        <div className="alert-side">
                          <button className="btn btn-ghost" onClick={confirmDates}>Dates are correct</button>
                          <button className="btn btn-secondary" onClick={openDates}>Change dates</button>
                        </div>
                      )}
                    </div>
                  ))}
                  </div>
                  )}

                  <div className="card card-flush">
                    <div className="card-header pad">
                      <p className="t-heading-s">Risk assessment</p>
                      <button className="btn btn-ghost"><Icon name="external-link" /> Full report</button>
                    </div>
                    <p className="pad c-secondary">{scenario === 'working' ? 'Checked on 1 Apr. Waiting for the business visa.' : `Re-checked on 3 Apr after ${firstName} uploaded the visa.`} {(['High', 'Medium'] as const).map((l) => req.risks.filter((r) => r.level === l).length ? `${req.risks.filter((r) => r.level === l).length} ${l.toLowerCase()}, ` : '').join('')}{req.lowCount + req.risks.filter((r) => r.level === 'Low').length} low.</p>
                    <div>
                      {req.risks.slice().sort((a, b) => rank[b.level] - rank[a.level]).map((r) => (
                        <div key={r.id} className={`risk-row ${openRisk[r.id] ? 'open' : ''}`}>
                          <button className="risk-head" aria-expanded={!!openRisk[r.id]} onClick={() => setOpenRisk((o) => ({ ...o, [r.id]: !o[r.id] }))}>
                            <RiskBadge level={r.level} />
                            <span className="name t-heading-s">{r.name}</span>
                            <span className="c-link t-label-m">{openRisk[r.id] ? 'Hide' : 'Details'}</span>
                          </button>
                          {openRisk[r.id] && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                              <p className="c-secondary">{r.why}</p>
                              <p className="t-caption c-muted">Rule {r.rule} · View in report · Next step is in the path to approval</p>
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="risk-row">
                        <div className="risk-head"><RiskBadge level="Low" /><span className="name t-heading-s">{req.lowCount} more, all low</span><span className="c-link t-label-m">Details</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <p className="t-heading-s">Documents</p>
                      <button className="btn btn-tonal"><Icon name="download" /> Download all ({req.documents.filter((d) => d.status !== 'requested').length})</button>
                    </div>
                    <div>
                      {req.documents.map((d) => (
                        <div key={d.id} className="doc-row">
                          <span className={`doc-ic ${d.status === 'unverified' ? 'warn' : d.status === 'requested' ? 'pending' : ''}`}><Icon name={d.status === 'requested' ? 'clock' : d.status === 'unverified' ? 'alert' : 'file'} /></span>
                          <span className="doc-text"><span className="t-label-m">{d.name}</span><span className="t-caption c-secondary">{d.meta}</span></span>
                          {d.status !== 'requested' && (
                            <span style={{ display: 'flex' }}>
                              <button className="icon-btn" aria-label={`Download ${d.name}`}><Icon name="download" /></button>
                              <button className="icon-btn" aria-label={`View ${d.name}`}><Icon name="eye" /></button>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card" style={{ gap: 24 }}>
                    <div className="card-header">
                      <p className="t-heading-s">Activity</p>
                      <button className="btn btn-ghost"><Icon name="download" /> Export audit pack</button>
                    </div>
                    <form className="note-input" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; log({ kind: 'comment', title: 'You added a note', body: note.trim(), time: `${at()}` }); setNote(''); }}>
                      <label htmlFor="note" className="sr-only">Add a note for the record</label>
                      <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the record…" />
                      <button className="btn btn-ghost" type="submit">Save</button>
                    </form>
                    <ul className="activity" aria-live="polite">
                      {visibleActivity.map((a) => (
                        <li key={a.id} className={`act ${a.kind}`}>
                          <span className="rail"><i /></span>
                          <div className="act-text">
                            <div className="act-top">
                              {(a.kind === 'agent' || a.kind === 'agent-failed') && <span className="agent-chip">Agent</span>}
                              <span className="t-label-m">{a.title}</span>
                              {a.snapshot && <span className="locked-chip">Locked</span>}
                              <span className="t-caption c-muted">{a.time}</span>
                              {/* Undo never edits the original: it adds a new entry */}
                              {a.undoable && !undone[a.id] && (
                                <button className="link-btn t-label-s" onClick={() => { setUndone((u) => ({ ...u, [a.id]: true })); log({ kind: 'decision', title: 'You undid an agent action', body: a.title, time: `${at()}` }); }}>Undo</button>
                              )}
                              {a.kind === 'agent-failed' && scenario === 'check' && a.id === 'a-fail' && (
                                <button className="link-btn t-label-s" onClick={() => { setScenario('ready'); showToast('Agent is trying again.'); }}>Try again</button>
                              )}
                            </div>
                            {a.body && <p className="c-secondary" style={{ whiteSpace: 'pre-line' }}>{a.body}</p>}
                            {a.snapshot && <ul className="snapshot t-caption c-secondary">{a.snapshot.map((l) => <li key={l}>{l}</li>)}</ul>}
                            {a.source && <p className="t-caption c-muted">Sources: {a.source}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {activity.length > 2 && (
                      <button className="link-btn" style={{ alignSelf: 'flex-start', paddingLeft: 24 }} onClick={() => setShowAll((s) => !s)}>{showAll ? 'Show less' : `Show ${activity.length - 2} more`}</button>
                    )}
                  </div>
                </div>

                <aside className="decision" aria-label="Decision">
                  <div className="pta">
                    <div className="verdict">
                      <RiskBadge level={topLevel} />
                      {approved ? (
                        <>
                          <p className="t-heading-m">Approved</p>
                          <p className="c-secondary">{noCoverage ? `You approved this request today without WorkFlex coverage. ${firstName} and Tom were notified. The agent keeps chasing the visa.` : `You approved this request today. ${firstName} and Tom were notified.`}</p>
                        </>
                      ) : assess.status === 'loading' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }} aria-busy="true">
                          <p className="t-heading-m">The agent is checking…</p>
                          <div className="skeleton" style={{ width: '100%' }} />
                          <div className="skeleton" style={{ width: '70%' }} />
                        </div>
                      ) : assess.status === 'error' ? (
                        <>
                          <p className="t-heading-m">The agent couldn&apos;t run the check</p>
                          <p className="c-secondary">Review the steps and documents yourself. Approve still follows the rules.</p>
                          <button className="link-btn t-label-s" onClick={() => runAssessment(scenario, ed, true)}>Try again</button>
                        </>
                      ) : (
                        <>
                          <p className="t-heading-m">{assess.data.headline}</p>
                          <p className="c-secondary">{assess.data.summary}</p>
                          <p className={`conf ${needsYou || !approvable ? 'warn' : ''}`}>{needsYou || !approvable ? '! ' : '✓ '}{assess.data.confidenceNote} Last check {shortDay(req.today)}, {new Date(assess.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.</p>
                          <div className="src-line">
                            <span>Summary by the agent</span><span aria-hidden="true">·</span>
                            <button className="link-btn" onClick={() => showToast(`Sources: ${assess.data.sources.join(', ')}`)}>Sources</button><span aria-hidden="true">·</span>
                            <button className="link-btn" onClick={() => { lastFocus.current = document.activeElement as HTMLElement; setDialog({ kind: 'settings' }); }}>Agent settings</button>
                          </div>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div className="t-overline c-secondary" style={{ display: 'flex' }}><span style={{ flex: 1 }}>Path to approval</span><span className="t-label-s" style={{ textTransform: 'none', letterSpacing: 0 }}>{done} of {req.steps.length} done</span></div>
                      <div className="progress"><i style={{ width: `${(done / req.steps.length) * 100}%` }} /></div>
                      <ol className="steps">{req.steps.map((s) => <PathStep key={s.id} step={s} onReview={() => openDraft('reminder')} />)}</ol>
                    </div>

                    <Days req={req} blocked={checks.some((c) => c.id === 'year-mismatch')} />

                    {approved ? (
                      <div className="done-box"><Icon name="check" /> Approved today</div>
                    ) : canApproveWithoutCoverage ? (
                      <div className="actions stacked">
                        <button className="btn btn-secondary btn-block" onClick={() => openDraft('reject')}><Icon name="close" /> Reject</button>
                        {role === 'gm' ? (
                          <button className="btn btn-ghost btn-block" onClick={() => openOverride('no-coverage')}>Approve without coverage</button>
                        ) : (
                          <button className="btn btn-ghost btn-block" disabled={sentToGM} onClick={sendToGlobalMobility}>{sentToGM ? 'Sent to Global Mobility' : 'Send to Global Mobility'}</button>
                        )}
                        <p className="t-caption c-danger">{role === 'gm' ? 'Approving now means WorkFlex won’t cover this trip until the visa is issued.' : 'Only Global Mobility can approve without WorkFlex coverage.'}</p>
                      </div>
                    ) : (
                      <div className="actions">
                        {needsYou && approvable && role === 'hr' ? (
                          <button className="btn btn-secondary btn-block" disabled={sentToGM} onClick={sendToGlobalMobility}>{sentToGM ? 'Sent to Global Mobility' : 'Send to Global Mobility'}</button>
                        ) : (
                          <button className="btn btn-primary btn-block" disabled={!approvable} aria-describedby={!approvable ? 'why-locked' : undefined} onClick={() => (needsYou ? openOverride('approve-anyway') : approve())}>
                            <Icon name="check" /> {needsYou ? 'Approve anyway' : 'Approve'}
                          </button>
                        )}
                        <button className="btn btn-secondary btn-block" onClick={() => openDraft('reject')}><Icon name="close" /> Reject</button>
                        <p id="why-locked" className="t-caption c-muted">
                          {!approvable ? (pastDates ? 'Approving is paused until the dates are confirmed or corrected.' : blocking ? 'Approve is paused until the data is fixed.' : 'Approve unlocks when every step is done.') : `Rejecting asks for a reason. ${firstName} and their manager see it.`}
                        </p>
                      </div>
                    )}

                    <div className="ask">
                      <label htmlFor="ask" className="t-label-m" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ color: 'var(--color-agent-fg)' }}><Icon name="sparkle" /></span> Ask the agent about this request</label>
                      <form onSubmit={ask}>
                        <input id="ask" value={question} maxLength={500} onChange={(e) => setQuestion(e.target.value)} placeholder="Why is social security medium?" />
                        <button className="btn btn-secondary" type="submit" aria-label="Ask" disabled={!question.trim() || !!answer?.streaming}><Icon name="send" /></button>
                      </form>
                      {answer && (
                        <div className="answer" aria-live="polite">
                          <p className="t-caption c-muted" style={{ marginBottom: 4 }}>You asked: {answer.q}</p>
                          {answer.text || <span className="c-muted">Thinking…</span>}
                        </div>
                      )}
                      <p className="t-caption c-muted">Answers use only this request&apos;s data. The agent can&apos;t approve or reject.</p>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </section>
        </>
      )}

      {dialog && (
        <Dialog onClose={closeDialog}>
          {dialog.kind === 'settings' ? (
            <>
              <h2 id="dlg-title" className="t-heading-m" style={{ margin: 0 }}>Agent settings</h2>
              <p className="c-secondary">What the agent does on its own for Workation requests. Set by your company admin.</p>
              <ul className="settings-list">
                {([['Ask for missing documents', 'Auto'], ['Remind approvers after 2 days', 'Ask me'], ['Re-run the risk check when data changes', 'Auto'], ['Message the employee or manager', 'Ask me'], ['Approve, reject or cancel', 'Only you']] as const).map(([a, l]) => (
                  <li key={a}><span>{a}</span><span className={`level ${l.replace(' ', '-')}`}>{l}</span></li>
                ))}
              </ul>
              <p className="t-caption c-muted">Every agent action is logged in Activity with the setting that allowed it.</p>
              <div className="dialog-actions"><button className="btn btn-secondary" autoFocus onClick={closeDialog}>Close</button></div>
            </>
          ) : dialog.kind === 'dates' ? (() => {
            const nd = workingDays(dialog.start, dialog.end);
            const delta = nd - req.workingDays;
            const unchanged = dialog.start === req.dates.start && dialog.end === req.dates.end;
            const { before, limit } = req.daysAbroad;
            return (
              <>
                <h2 id="dlg-title" className="t-heading-m" style={{ margin: 0 }}>Change trip dates</h2>
                <p className="c-secondary">The agent re-checks the risk before anything is saved.</p>
                <div className="date-fields">
                  <label className="field"><span className="t-caption c-secondary">From</span><input type="date" autoFocus value={dialog.start} onChange={(e) => setDialog({ ...dialog, start: e.target.value })} /></label>
                  <label className="field"><span className="t-caption c-secondary">To</span><input type="date" value={dialog.end} min={dialog.start} onChange={(e) => setDialog({ ...dialog, end: e.target.value })} /></label>
                </div>
                <div className="impact" aria-live="polite">
                  <p className="t-overline">Impact</p>
                  {unchanged ? <p>Pick new dates to see what changes.</p> : nd > 0 ? (
                    <>
                      <p>{delta === 0 ? `Same ${nd} working days` : `${delta > 0 ? '+' : ''}${delta} ${Math.abs(delta) === 1 ? 'day' : 'days'}`}: uses {before + nd} of {limit} in {req.to.country}, {dialog.start.slice(0, 4)}</p>
                      <p>Risk stays {topLevel.toLowerCase()}, no new dimensions</p>
                      <p>{delta === 0 ? 'Reopens: nothing. Same working days, so approvals stay valid' : 'Reopens: Manager approval. IT security stays approved'}</p>
                      {dialog.start < req.submitted && <p className="c-danger">Still before the request date ({formatDay(req.submitted)})</p>}
                    </>
                  ) : <p>Pick an end date on or after the start date, with at least one working day.</p>}
                </div>
                <div className="dialog-actions">
                  <button className="btn btn-secondary" onClick={closeDialog}>Cancel</button>
                  <button className="btn btn-primary" disabled={nd === 0 || unchanged} onClick={() => saveDates(dialog.start, dialog.end)}><Icon name="check" /> Save and notify</button>
                </div>
              </>
            );
          })() : dialog.kind === 'override' ? (() => {
            const nc = dialog.variant === 'no-coverage';
            const items = OVERRIDE_CHECKS[dialog.variant](firstName);
            return (
              <>
                <h2 id="dlg-title" className="t-heading-m" style={{ margin: 0 }}>{nc ? 'Approve without WorkFlex coverage?' : 'Approve without a verified A1 certificate?'}</h2>
                <p className="c-secondary">{nc ? `${firstName}'s visa isn't issued yet. If you approve now, WorkFlex won't cover this trip for work entitlement until it is.` : "The agent couldn't reach the issuer, so the A1 certificate isn't verified. You approve on your own checks."}</p>
                {nc && (
                  <div className="changes">
                    <p className="t-overline">What changes</p>
                    <p>Liability for work entitlement stays with your company</p>
                    <p>{firstName} and Tom are told the trip is approved</p>
                    <p>The agent keeps chasing the visa</p>
                  </div>
                )}
                <fieldset className="checks">
                  <legend className="t-caption c-secondary">Before you approve, check <span style={{ color: 'var(--color-agent-fg)' }}>(suggested by the agent)</span></legend>
                  {items.map((it, i) => (
                    <label key={it} className="check-row">
                      <input type="checkbox" checked={dialog.checked[i]} onChange={(e) => setDialog({ ...dialog, checked: dialog.checked.map((c, j) => (j === i ? e.target.checked : c)) })} />
                      <span>{it}</span>
                    </label>
                  ))}
                </fieldset>
                <label htmlFor="dlg-text" className="t-caption c-secondary">Your reason (required, written by you, saved to the audit log)</label>
                <textarea id="dlg-text" autoFocus value={dialog.text} placeholder={nc ? 'Why is it safe to approve before the visa is issued?' : 'What did you check yourself, and with whom?'} onChange={(e) => setDialog({ ...dialog, text: e.target.value })} />
                <p className="t-caption c-muted">The agent never drafts override reasons.</p>
                <div className="dialog-actions">
                  <button className="btn btn-secondary" onClick={closeDialog}>Cancel</button>
                  <button className={`btn ${nc ? 'btn-danger' : 'btn-primary'}`} disabled={!dialog.text.trim()} onClick={() => confirmOverride(dialog.variant, dialog.text.trim(), dialog.checked)}>{nc ? 'Approve without coverage' : 'Approve anyway'}</button>
                </div>
              </>
            );
          })() : dialog.kind === 'cancel' ? (
            <>
              <h2 id="dlg-title" className="t-heading-m" style={{ margin: 0 }}>Cancel {firstName}&apos;s request?</h2>
              <p className="c-secondary">{firstName} and Tom are notified. The approvals already given are kept in Activity. This can&apos;t be undone.</p>
              <div className="dialog-actions">
                <button className="btn btn-secondary" autoFocus onClick={closeDialog}>Keep request</button>
                <button className="btn btn-danger" onClick={() => { closeDialog(); log({ kind: 'decision', title: 'You cancelled the request', time: `${at()}` }); showToast('Request cancelled.'); }}>Cancel request</button>
              </div>
            </>
          ) : (
            <>
              <h2 id="dlg-title" className="t-heading-m" style={{ margin: 0 }}>
                {dialog.kind === 'reject' ? `Reject ${firstName}'s Workation?` : dialog.kind === 'message' ? `Message ${firstName}` : 'Send reminder to Anna Roth?'}
              </h2>
              <p className="c-secondary">
                {dialog.kind === 'reject' ? `${firstName} and Tom get your reason by email. ${firstName} can submit a new request.` : dialog.kind === 'reminder' ? 'Your settings say to ask before messaging approvers. To: Anna Roth, IT security.' : `${firstName} gets this by email. The message is saved in Activity.`}
              </p>
              <div className="draft-note"><Icon name="sparkle" size={14} />{dialog.streaming ? 'The agent is drafting…' : 'Draft by the agent. Edit before sending.'}
                <button className="link-btn t-caption" style={{ marginLeft: 'auto' }} onClick={() => setDialog({ ...dialog, text: '', streaming: false })}>Clear draft</button>
              </div>
              {dialog.kind === 'reject' && (
                <div className="reason-chips" role="radiogroup" aria-label="Reason">
                  {['Visa not possible in time', 'Against company policy', 'Dates overlap another trip', 'Other'].map((r) => (
                    <button key={r} role="radio" aria-checked={dialog.reason === r} className="reason-chip" onClick={() => openDraft('reject', r)}>{r}</button>
                  ))}
                </div>
              )}
              {dialog.kind === 'reminder' && <p className="t-caption c-muted">Why now: no reply for 3 days. Based on your rule “remind approvers after 2 days”.</p>}
              <label htmlFor="dlg-text" className="sr-only">Message</label>
              <textarea id="dlg-text" autoFocus value={dialog.text} onChange={(e) => setDialog({ ...dialog, text: e.target.value, streaming: false })} />
              <div className="dialog-actions">
                <button className="btn btn-secondary" onClick={closeDialog}>{dialog.kind === 'reject' ? 'Keep request' : dialog.kind === 'reminder' ? 'Don’t send' : 'Go back'}</button>
                {dialog.kind === 'reject' && (
                  <button className="btn btn-danger" disabled={!dialog.text.trim() || dialog.streaming} onClick={() => { closeDialog(); logDecision({ kind: 'decision', title: 'You rejected the request', body: dialog.text, time: '' }); showToast(`Request rejected. ${firstName} and Tom were notified.`); }}>Reject request</button>
                )}
                {dialog.kind === 'reminder' && (
                  <button className="btn btn-primary" disabled={!dialog.text.trim() || dialog.streaming} onClick={() => { closeDialog(); log({ kind: 'comment', title: 'You sent the agent’s reminder to Anna Roth', body: dialog.text, time: `${at()}`, source: 'Rule: remind approvers after 2 days (Ask me)' }); showToast('Reminder sent to Anna Roth.'); }}><Icon name="send" /> Send reminder</button>
                )}
                {dialog.kind === 'message' && (
                  <button className="btn btn-primary" disabled={!dialog.text.trim() || dialog.streaming} onClick={() => { closeDialog(); log({ kind: 'comment', title: `You messaged ${firstName}`, body: dialog.text, time: `${at()}` }); showToast('Message sent.'); }}><Icon name="send" /> Send</button>
                )}
              </div>
            </>
          )}
        </Dialog>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.msg}</span>
          {toast.undo && <button onClick={() => { toast.undo?.(); setToast(null); }}>Undo</button>}
        </div>
      )}

      <header className="cs-bar">
        <span className="t-caption cs-note">Case study concept by Debora Moratalla · Not a WorkFlex product · Sample data</span>
        <span className="t-caption c-muted cs-hint">{ORDER.length} requests in the queue · ‹ › or J K to move</span>
        <label className="cs-role t-caption">
          <span className="c-muted">Viewing as</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="gm">Global Mobility</option>
            <option value="hr">HR approver</option>
          </select>
        </label>
        <button className="btn btn-secondary cs-tour" onClick={() => goTour(tourResume.current)}><Icon name="book" /> Walkthrough</button>
      </header>
      {tour !== null && <Tour step={tour} onStep={goTour} onClose={closeTour} onTry={tryQuestion} />}
    </>
  );
}

function Sidebar({ needsYou }: { needsYou: number }) {
  const items: [string, IconName, boolean?][][] = [
    [['Employee requests', 'grid', true], ['Analytics', 'chart'], ['Employee management', 'users'], ['Company settings', 'settings']],
    [['My requests', 'file'], ['Policy overview', 'book']],
  ];
  const titles = ['Admin management', 'My workspace'];
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="sidebar-head"><div className="logo"><Logo /></div><button className="icon-btn" aria-label="Collapse menu"><Icon name="menu" /></button></div>
      {items.map((g, gi) => (
        <div key={gi} className="nav-group">
          <div className="nav-title t-label-s">{titles[gi]}</div>
          {g.map(([label, icon, active]) => (
            <a key={label} href="#" onClick={(e) => e.preventDefault()} className={`nav-item t-label-m ${active ? 'active' : ''}`} style={{ textDecoration: 'none' }} aria-current={active ? 'page' : undefined}>
              <Icon name={icon} /> {label}
              {active && <span className="count t-label-s" aria-label={`${needsYou} requests need you`}>{needsYou}</span>}
            </a>
          ))}
        </div>
      ))}
      <div className="sidebar-foot">
        <button className="chat-fab" aria-label="Open chat"><Icon name="message" size={20} /></button>
        <span className="t-label-m">Laura Müller</span><Icon name="chevron-right" size={12} />
      </div>
    </nav>
  );
}

function RiskBadge({ level }: { level: Level | 'Pending' }) {
  return <span className={`badge ${level}`}><ShieldSolid /> {level === 'Pending' ? 'Risk pending' : `${level} risk`}</span>;
}

function PathStep({ step, onReview }: { step: Step; onReview?: () => void }) {
  const cls = step.state === 'Needs you' ? 'Needs' : step.state;
  const icon: Partial<Record<Step['state'], IconName>> = { Done: 'check', 'Needs you': 'alert', Blocked: 'close', Waiting: 'clock', Overdue: 'alert' };
  return (
    <li className="step">
      <span className={`step-ic ${cls}`}>{icon[step.state] ? <Icon name={icon[step.state]!} size={14} /> : null}</span>
      <div className="step-text">
        <div className="step-top">
          <span className="t-label-m c-secondary">{step.title}</span>
          <span className={`owner ${step.owner}`}>{step.owner}</span>
        </div>
        <span className={`t-caption ${step.state === 'Overdue' ? 'step-meta-overdue' : 'c-secondary'}`}>{step.meta}</span>
        {(step.state === 'Waiting' || step.state === 'Overdue') && step.owner === 'Approver' && onReview && (
          <button className="agent-proposal" onClick={onReview}><span className="agent-chip">Agent</span> Drafted a reminder · <span className="c-link">Review</span></button>
        )}
        <span className="sr-only">Status: {step.state}</span>
      </div>
    </li>
  );
}

function Days({ req, blocked }: { req: WorkationRequest; blocked: boolean }) {
  const { before, thisTrip, limit, year } = req.daysAbroad;
  const left = limit - before - thisTrip;
  return (
    <div className="days" style={blocked ? { background: 'var(--color-status-warning-bg)' } : undefined}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span className="t-caption c-secondary" style={{ flex: 1 }}>Days in {req.to.country}, {year}{blocked ? ` (trip is in ${req.dates.start.slice(0, 4)})` : ''}</span>
        <span className="t-label-m">{before + thisTrip} of {limit}</span>
      </div>
      <div className="days-bar" role="img" aria-label={`${before} days before, ${thisTrip} this trip, ${left} left`}>
        <i style={{ width: `${(before / limit) * 100}%`, background: 'var(--color-text-muted)' }} />
        <i style={{ width: `${(thisTrip / limit) * 100}%`, background: 'var(--color-action-primary-bg)' }} />
      </div>
      <div className="legend t-caption c-secondary">
        <span><i style={{ background: 'var(--color-text-muted)' }} />{before} before</span>
        <span><i style={{ background: 'var(--color-action-primary-bg)' }} />{thisTrip} this trip</span>
        <span><i style={{ background: 'var(--color-border-default)' }} />{left} left</span>
      </div>
      <p className="t-caption c-muted">
        {req.from.country}–{req.to.country} tax treaty. {limit} days per host country;{' '}
        <span className="tip">
          <button type="button" className="link-btn t-caption" aria-describedby="days-rule">counting rule</button>
          <span id="days-rule" role="tooltip">Counted per host country under the applicable tax treaty. Some treaties use the calendar year, others any 12 months.</span>
        </span>{' '}
        in the tooltip.
      </p>
    </div>
  );
}

function Dialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const f = Array.from(el.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, input, a[href]'));
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="dialog-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title">{children}</div>
    </div>
  );
}

function FlagAT() {
  // Illustrative national flags: intentionally outside the token system
  return <span className="flag"><i style={{ height: 5, background: '#cc212e' }} /><i style={{ height: 4, background: '#fff' }} /><i style={{ height: 5, background: '#cc212e' }} /></span>;
}
function FlagTH() {
  return <span className="flag"><i style={{ height: 2, background: '#cc212e' }} /><i style={{ height: 2, background: '#fff' }} /><i style={{ height: 6, background: '#2e3373' }} /><i style={{ height: 2, background: '#fff' }} /><i style={{ height: 2, background: '#cc212e' }} /></span>;
}
