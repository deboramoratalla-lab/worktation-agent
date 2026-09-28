'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Logo, ShieldSolid, type IconName } from '@/components/Icon';
import { scenarios, type ActivityEntry, type Level, type ScenarioId, type Step, type WorkationRequest } from '@/lib/data';
import { canApprove, ruleChecks, type Assessment } from '@/lib/agent';
import { Tour, TOUR } from '@/components/Tour';

const ORDER: ScenarioId[] = ['ready', 'working', 'check', 'conflict'];
const rank: Record<Level, number> = { Low: 0, Medium: 1, High: 2 };

type AssessState = { status: 'loading' } | { status: 'ok'; data: Assessment; model: string } | { status: 'error' };
type DialogState =
  | null
  | { kind: 'reject' | 'message' | 'approve-anyway'; text: string; streaming: boolean }
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

const now = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
let seq = 0;
const uid = () => `x${++seq}`;

export default function Page() {
  const [scenario, setScenario] = useState<ScenarioId>('ready');
  const req = useMemo<WorkationRequest>(() => scenarios[scenario].build(), [scenario]);
  const [activity, setActivity] = useState<ActivityEntry[]>(req.activity);
  const [assess, setAssess] = useState<AssessState>({ status: 'loading' });
  const [approved, setApproved] = useState(false);
  const [open, setOpen] = useState(true);
  const [openRisk, setOpenRisk] = useState<Record<string, boolean>>({ ss: true });
  const [showAll, setShowAll] = useState(false);
  const [dismissed, setDismissed] = useState<Record<number, boolean>>({});
  const [undone, setUndone] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ q: string; text: string; streaming: boolean; error?: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [tour, setTour] = useState<number | null>(null);
  const goTour = useCallback((i: number) => { setMenu(false); setDialog(null); setOpen(true); setScenario(TOUR[i].scenario); setTour(i); }, []);
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

  const runAssessment = useCallback(async (id: ScenarioId) => {
    setAssess({ status: 'loading' });
    try {
      const res = await fetch('/api/assess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: id }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAssess({ status: 'ok', data: json.assessment, model: json.model });
      log({ kind: 'agent', title: 'Agent checked the request', body: json.assessment.summary, time: `Today, ${now()} · auto`, source: json.assessment.sources.join(', ') });
    } catch {
      setAssess({ status: 'error' });
      log({ kind: 'agent-failed', title: "Agent couldn't run the check", body: 'The summary below is missing. Rules still decide if Approve is available.', time: `Today, ${now()} · auto` });
    }
  }, [log]);

  // Reset on scenario change
  useEffect(() => {
    setActivity(req.activity);
    setApproved(false);
    setDismissed({});
    setUndone({});
    setAnswer(null);
    setShowAll(false);
    setOpenRisk({ [req.risks.slice().sort((a, b) => rank[b.level] - rank[a.level])[0].id]: true });
    runAssessment(scenario);
  }, [scenario, req, runAssessment]);

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
  function openDraft(kind: 'reject' | 'message' | 'approve-anyway') {
    lastFocus.current = document.activeElement as HTMLElement;
    setMenu(false);
    setDialog({ kind, text: '', streaming: true });
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const apiKind = kind === 'approve-anyway' ? 'approve-note' : kind;
    streamText('/api/draft', { scenario, kind: apiKind }, (full) => setDialog((d) => (d && 'text' in d ? { ...d, text: full } : d)), ctrl.signal)
      .then(() => setDialog((d) => (d && 'text' in d ? { ...d, streaming: false } : d)))
      .catch(() => setDialog((d) => (d && 'text' in d ? { ...d, streaming: false, text: d.text || '' } : d)));
  }
  function closeDialog() {
    abortRef.current?.abort();
    setDialog(null);
    lastFocus.current?.focus();
  }

  function approve(reason?: string) {
    setApproved(true);
    log({ kind: 'decision', title: 'You approved the request', body: reason ? `Reason: ${reason}` : undefined, time: `Today, ${now()}` });
    showToast(`Request approved. ${firstName} and Tom were notified.`, () => {
      setApproved(false);
      log({ kind: 'decision', title: 'You undid the approval', time: `Today, ${now()}` });
    });
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setQuestion('');
    setAnswer({ q, text: '', streaming: true });
    try {
      const full = await streamText('/api/ask', { scenario, question: q }, (t) => setAnswer({ q, text: t, streaming: true }));
      setAnswer({ q, text: full, streaming: false });
      log({ kind: 'agent', title: `Agent answered: “${q}”`, body: full, time: `Today, ${now()} · on request` });
    } catch {
      setAnswer({ q, text: "The agent couldn't answer right now. Try again in a moment.", streaming: false, error: true });
    }
  }

  const aiAnomalies = assess.status === 'ok' ? assess.data.anomalies : [];
  const banners =
    assess.status === 'ok'
      ? aiAnomalies.map((a, i) => ({ i, title: a.title, detail: a.detail, action: a.suggestedAction, by: 'Flagged by the agent' }))
      : assess.status === 'error'
        ? checks.map((c, i) => ({ i, title: c.title, detail: c.detail, action: '', by: 'Flagged by rules' }))
        : [];

  const visibleActivity = showAll ? activity : activity.slice(0, 2);

  return (
    <>
      <div className="shell" aria-hidden={open}>
        <Sidebar />
        <main className="list">
          <p className="t-heading-l">Employee requests</p>
          <div className="tabs t-label-m">
            <span className="c-link">Workations 17</span>
            <span className="c-secondary">Business travel 24</span>
            <span className="c-secondary">Assignments 11</span>
          </div>
          <div className="table">
            {ORDER.map((id) => {
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
                <span className="t-caption c-secondary">{ORDER.indexOf(scenario) + 1} of {ORDER.length} needing you</span>
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
                    <div className="menu" role="menu">
                      <button role="menuitem" onClick={() => { setMenu(false); showToast('Changing dates is not part of this prototype.'); }}><Icon name="calendar" /> Change dates</button>
                      <button role="menuitem" onClick={() => openDraft('message')}><Icon name="message" /> Message {firstName}</button>
                      <hr />
                      <button role="menuitem" className="danger" onClick={() => { lastFocus.current = document.activeElement as HTMLElement; setMenu(false); setDialog({ kind: 'cancel' }); }}><Icon name="close" /> Cancel request</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="body">
                <div className="content">
                  {banners.filter((b) => !dismissed[b.i]).map((b) => (
                    <div key={b.i} className="alert" role="status">
                      <span className="ic"><Icon name="alert" size={20} /></span>
                      <div className="alert-text">
                        <p className="t-heading-s">{b.title}</p>
                        <p className="c-secondary">{b.detail}{b.action ? ` ${b.action}.` : ''}</p>
                        <div className="alert-actions">
                          <button className="btn btn-secondary" onClick={() => openDraft('message')}><Icon name="message" /> Ask {firstName} to confirm</button>
                          <span className="t-caption" style={{ color: 'var(--color-agent-fg)' }}>{b.by}</span>
                          <button className="link-btn t-caption" onClick={() => { setDismissed((d) => ({ ...d, [b.i]: true })); log({ kind: 'decision', title: `You dismissed a flag: ${b.title}`, time: `Today, ${now()}` }); }}>Dismiss</button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="card card-flush">
                    <div className="card-header pad">
                      <p className="t-heading-s">Risk assessment</p>
                      <button className="btn btn-ghost"><Icon name="external-link" /> Full report</button>
                    </div>
                    <p className="pad c-secondary">{scenario === 'working' ? 'Checked on 1 Apr. Waiting for the business visa.' : `Re-checked on 3 Apr after ${firstName} uploaded the visa.`} {req.risks.filter((r) => r.level !== 'Low').length} {topLevel === 'High' ? 'high' : 'medium'}, {req.lowCount + req.risks.filter((r) => r.level === 'Low').length} low.</p>
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
                    <form className="note-input" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; log({ kind: 'comment', title: 'You added a note', body: note.trim(), time: `Today, ${now()}` }); setNote(''); }}>
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
                              <span className="t-label-m" style={undone[a.id] ? { textDecoration: 'line-through' } : undefined}>{a.title}</span>
                              <span className="t-caption c-muted">{a.time}</span>
                              {a.undoable && !undone[a.id] && (
                                <button className="link-btn t-label-s" onClick={() => { setUndone((u) => ({ ...u, [a.id]: true })); log({ kind: 'decision', title: 'You undid an agent action', body: a.title, time: `Today, ${now()}` }); }}>Undo</button>
                              )}
                              {a.kind === 'agent-failed' && scenario === 'check' && a.id === 'a-fail' && (
                                <button className="link-btn t-label-s" onClick={() => { setScenario('ready'); showToast('Agent is trying again.'); }}>Try again</button>
                              )}
                            </div>
                            {a.body && <p className="c-secondary">{undone[a.id] ? 'Undone by you.' : a.body}</p>}
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
                          <p className="c-secondary">You approved this request today. {firstName} and Tom were notified.</p>
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
                          <button className="link-btn t-label-s" onClick={() => runAssessment(scenario)}>Try again</button>
                        </>
                      ) : (
                        <>
                          <p className="t-heading-m">{assess.data.headline}</p>
                          <p className="c-secondary">{assess.data.summary}</p>
                          <p className={`conf ${needsYou || !approvable ? 'warn' : ''}`}>{needsYou || !approvable ? '! ' : '✓ '}{assess.data.confidenceNote}</p>
                          <div className="src-line">
                            <span>Summary by the agent</span><span aria-hidden="true">·</span>
                            <button className="link-btn" onClick={() => showToast(`Sources: ${assess.data.sources.join(', ')}`)}>Sources</button><span aria-hidden="true">·</span>
                            <span>{assess.model}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div className="t-overline c-secondary" style={{ display: 'flex' }}><span style={{ flex: 1 }}>Path to approval</span><span className="t-label-s" style={{ textTransform: 'none', letterSpacing: 0 }}>{done} of {req.steps.length} done</span></div>
                      <div className="progress"><i style={{ width: `${(done / req.steps.length) * 100}%` }} /></div>
                      <ol className="steps">{req.steps.map((s) => <PathStep key={s.id} step={s} />)}</ol>
                    </div>

                    <Days req={req} blocked={checks.some((c) => c.id === 'year-mismatch')} />

                    {approved ? (
                      <div className="done-box"><Icon name="check" /> Approved today</div>
                    ) : (
                      <div className="actions">
                        <button className="btn btn-primary btn-block" disabled={!approvable} aria-describedby={!approvable ? 'why-locked' : undefined} onClick={() => (needsYou ? openDraft('approve-anyway') : approve())}>
                          <Icon name="check" /> {needsYou ? 'Approve anyway' : 'Approve'}
                        </button>
                        <button className="btn btn-secondary btn-block" onClick={() => openDraft('reject')}><Icon name="close" /> Reject</button>
                        <p id="why-locked" className="t-caption c-muted">
                          {!approvable ? (checks.some((c) => c.severity === 'blocking') ? 'Approve is paused until the data is fixed.' : 'Approve unlocks when every step is done.') : `Rejecting asks for a reason. ${firstName} and their manager see it.`}
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
          {dialog.kind === 'cancel' ? (
            <>
              <h2 id="dlg-title" className="t-heading-m" style={{ margin: 0 }}>Cancel {firstName}&apos;s request?</h2>
              <p className="c-secondary">{firstName} and Tom are notified. The approvals already given are kept in Activity. This can&apos;t be undone.</p>
              <div className="dialog-actions">
                <button className="btn btn-secondary" autoFocus onClick={closeDialog}>Keep request</button>
                <button className="btn btn-danger" onClick={() => { closeDialog(); log({ kind: 'decision', title: 'You cancelled the request', time: `Today, ${now()}` }); showToast('Request cancelled.'); }}>Cancel request</button>
              </div>
            </>
          ) : (
            <>
              <h2 id="dlg-title" className="t-heading-m" style={{ margin: 0 }}>
                {dialog.kind === 'reject' ? `Reject ${firstName}'s Workation?` : dialog.kind === 'message' ? `Message ${firstName}` : 'Approve without a verified A1 certificate?'}
              </h2>
              <p className="c-secondary">
                {dialog.kind === 'reject' ? `${firstName} and Tom get your reason by email.` : dialog.kind === 'message' ? `${firstName} gets this by email. The message is saved in Activity.` : "The agent couldn't reach the issuer. Say what you checked yourself. It goes into the audit log."}
              </p>
              <div className="draft-note"><Icon name="sparkle" size={14} />{dialog.streaming ? 'The agent is drafting…' : 'Draft by the agent. Edit before sending.'}
                <button className="link-btn t-caption" style={{ marginLeft: 'auto' }} onClick={() => setDialog({ ...dialog, text: '', streaming: false })}>Clear draft</button>
              </div>
              <label htmlFor="dlg-text" className="sr-only">Message</label>
              <textarea id="dlg-text" autoFocus value={dialog.text} onChange={(e) => setDialog({ ...dialog, text: e.target.value, streaming: false })} />
              <div className="dialog-actions">
                <button className="btn btn-secondary" onClick={closeDialog}>{dialog.kind === 'reject' ? 'Keep request' : 'Go back'}</button>
                {dialog.kind === 'reject' && (
                  <button className="btn btn-danger" disabled={!dialog.text.trim() || dialog.streaming} onClick={() => { closeDialog(); log({ kind: 'decision', title: 'You rejected the request', body: dialog.text, time: `Today, ${now()}` }); showToast(`Request rejected. ${firstName} and Tom were notified.`); }}>Reject request</button>
                )}
                {dialog.kind === 'message' && (
                  <button className="btn btn-primary" disabled={!dialog.text.trim() || dialog.streaming} onClick={() => { closeDialog(); log({ kind: 'comment', title: `You messaged ${firstName}`, body: dialog.text, time: `Today, ${now()}` }); showToast('Message sent.'); }}><Icon name="send" /> Send</button>
                )}
                {dialog.kind === 'approve-anyway' && (
                  <button className="btn btn-primary" disabled={!dialog.text.trim() || dialog.streaming || /\[.*\]/.test(dialog.text)} onClick={() => { closeDialog(); approve(dialog.text); }}>Approve anyway</button>
                )}
              </div>
              {dialog.kind === 'approve-anyway' && /\[.*\]/.test(dialog.text) && <p className="t-caption c-muted">Replace the part in [brackets] to continue.</p>}
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
        <span className="t-caption c-muted cs-hint">{ORDER.length} requests need you · ‹ › or J K to move</span>
        <button className="btn btn-secondary cs-tour" onClick={() => goTour(0)}><Icon name="sparkle" /> Walkthrough</button>
      </header>
      {tour !== null && <Tour step={tour} onStep={goTour} onClose={() => setTour(null)} />}
    </>
  );
}

function Sidebar() {
  const items: [string, IconName, boolean?][][] = [
    [['Employee requests', 'grid', true], ['Analytics', 'chart'], ['Employee management', 'users'], ['Company settings', 'settings'], ['Travel calendar', 'calendar']],
    [['My requests', 'file'], ['My calendar', 'calendar'], ['Policy overview', 'book']],
    [['Tracking & alerts', 'map-pin']],
  ];
  const titles = ['Admin', 'My workspace', 'SOS'];
  return (
    <nav className="sidebar" aria-label="Main">
      <div className="logo"><Logo /></div>
      {items.map((g, gi) => (
        <div key={gi} className="nav-group">
          <div className="nav-title t-overline">{titles[gi]}</div>
          {g.map(([label, icon, active]) => (
            <a key={label} href="#" onClick={(e) => e.preventDefault()} className={`nav-item t-label-m ${active ? 'active' : ''}`} style={{ textDecoration: 'none' }}>
              <Icon name={icon} /> {label} {active && <span className="count t-label-s">3</span>}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}

function RiskBadge({ level }: { level: Level }) {
  return <span className={`badge ${level}`}><ShieldSolid /> {level} risk</span>;
}

function PathStep({ step }: { step: Step }) {
  const cls = step.state === 'Needs you' ? 'Needs' : step.state;
  const icon: Partial<Record<Step['state'], IconName>> = { Done: 'check', 'Needs you': 'alert', Blocked: 'close', Waiting: 'clock' };
  return (
    <li className="step">
      <span className={`step-ic ${cls}`}>{icon[step.state] ? <Icon name={icon[step.state]!} size={14} /> : null}</span>
      <div className="step-text">
        <div className="step-top">
          <span className="t-label-m c-secondary">{step.title}</span>
          <span className={`owner ${step.owner}`}>{step.owner}</span>
        </div>
        <span className="t-caption c-secondary">{step.meta}</span>
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
        <span className="t-caption c-secondary" style={{ flex: 1 }}>Days abroad in {year}{blocked ? ` (trip is in ${req.dates.start.slice(0, 4)})` : ''}</span>
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
      const f = Array.from(el.querySelectorAll<HTMLElement>('button:not(:disabled), textarea'));
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
  return <span className="flag"><i style={{ height: 5, background: '#cc212e' }} /><i style={{ height: 4, background: '#fff' }} /><i style={{ height: 5, background: '#cc212e' }} /></span>;
}
function FlagTH() {
  return <span className="flag"><i style={{ height: 2, background: '#cc212e' }} /><i style={{ height: 2, background: '#fff' }} /><i style={{ height: 6, background: '#2e3373' }} /><i style={{ height: 2, background: '#fff' }} /><i style={{ height: 2, background: '#cc212e' }} /></span>;
}
