import type { Metadata } from 'next';
import './landing.css';
import { Icon, type IconName } from '@/components/Icon';

export const metadata: Metadata = {
  title: 'Workation approval, case study',
  description: 'Redesign of the Workation request approval screen. Concept by Debora Moratalla. Not a WorkFlex product.',
  robots: { index: false, follow: false },
};

const FIGMA = 'https://www.figma.com/design/cl9iO18ttAAfWUZpsvTJ0V';
const fig = (node?: string) => (node ? `${FIGMA}?node-id=${node.replace(':', '-')}` : FIGMA);
const PROTO = '/';

const DEC_ICONS: IconName[] = ['clock', 'eye', 'calendar', 'check', 'close', 'file'];
const DECISIONS = [
  { pain: 'Nobody knew what to do next', before: 'Status sat in a corner. No next step.', after: 'The header says what to do now: the agent’s suggestion, one main button and the reason.' },
  { pain: 'Risk was just a label', before: '“Medium risk” and a PDF to open.', after: 'Each risk says which check flagged it and why, with the source one click away.' },
  { pain: 'Past dates went unnoticed', before: 'A 2024 trip created in 2025, next to a 2025 balance. No warning.', after: 'A banner names the conflict. Approving anyway asks for a reason, and it’s logged.' },
  { pain: 'Approved still looked pending', before: 'Approved steps still looked like buttons.', after: 'Decided steps turn into a record: who, when, and undo. Only pending steps have buttons.' },
  { pain: 'Cancel sat next to edit', before: 'The destructive action lived in the same menu as edits.', after: 'Reject and Cancel are separate, say what they do, and ask for a reason.' },
  { pain: 'No history', before: 'No audit trail. Comments lived somewhere else.', after: 'One activity log with decisions, agent actions and comments together.' },
];

const RULE_ICONS: IconName[] = ['users', 'sparkle', 'book', 'close', 'clock'];
const USE_ICONS: IconName[] = ['eye', 'check', 'alert', 'send'];
const PAGE_ICONS: IconName[] = ['book', 'chart', 'sparkle', 'grid', 'settings', 'eye', 'arrow-right', 'file', 'message'];
const RULES = [
  ['Human decides', 'The agent suggests. Approve, reject and cancel are only Laura’s.'],
  ['Labelled', 'Anything the agent wrote says so.'],
  ['Sourced', 'Every claim links to where it came from.'],
  ['Dismissable', 'Laura can dismiss a suggestion and the screen still works.'],
  ['Logged', 'Agent actions and overrides go in the audit trail.'],
];

const USES = [
  ['Risk summary', 'Says which check is flagged and why, in plain words.'],
  ['Recommendation', 'Comes with confidence and sources, not a bare score.'],
  ['Anomaly flags', 'Past dates, balance conflicts, missing documents.'],
  ['Drafts', 'Reminders and messages. Laura writes the rejection reason herself.'],
];

const SCREEN_ICONS: IconName[] = ['grid', 'message', 'settings', 'menu'];
const PAGES = [
  ['02 · Research', '0:1', 'The current screen and Laura, from the brief.'],
  ['03 · Synthesis & strategy', '8:6', 'Pain points ranked and what ships first.'],
  ['04 · Explorations', '8:7', 'Options I tried and dropped.'],
  ['05 · Foundations', '1:2', 'Tokens, type, spacing.'],
  ['06 · Components', '8:9', '12 components with their states.'],
  ['07 · Screens', '1:3', 'Every state, dialog, settings and responsive.'],
  ['08 · Prototype & flows', '8:11', 'Four clickable flows, with toasts and undo.'],
  ['09 · Dev handoff', '8:13', 'Tokens to CSS, states, edge cases.'],
  ['10 · Presentation & rationale', '1:4', 'Why I made each decision.'],
];

const COMPONENTS = [
  ['Button', '28:38', '24 variants'], ['Risk badge', '28:52', '4'], ['Risk row', '28:101', '5'],
  ['Approval step', '28:135', '6'], ['Document row', '28:159', '3'], ['Activity item', '28:192', '7'],
  ['Autonomy setting', '31:131', '3'], ['Path step', '31:197', '6'], ['Path to approval', '32:222', '6'],
  ['Icon button', '38:147', '21'], ['Dialog', '42:230', '5'], ['Alert banner', '66:279', '3'],
];

const SCREENS = [
  ['Main states', '73:2889', 'Waiting, ready, exceptions, after your decision.'],
  ['Dialogs', '73:2890', 'Approve, reject, approve anyway, cancel.'],
  ['Agent settings', '78:3419', 'Company settings, Agent tab.'],
  ['Responsive', '171:5517', 'Tablet and mobile.'],
];

const CASE_TAG: Record<string, [string, string]> = { ready: ['Ready', 'ok'], working: ['In progress', 'warn'], check: ['Needs a check', 'warn'], conflict: ['Conflict', 'bad'] };
const CASES = [
  ['Lili', 'ready', 'All checks pass. Approve in one click, then undo it.'],
  ['Suba', 'working', 'The agent is still chasing a document. Laura can wait or approve without coverage.'],
  ['Stefan', 'check', 'A certificate is missing. Approving anyway needs a reason.'],
  ['Mara', 'conflict', 'The dates are in the past. Confirm or change them before deciding.'],
];

export default function Landing() {
  return (
    <div className="lp">
      <a className="lp-skip" href="#main">Skip to content</a>
      <header className="lp-top"><div className="lp-topin">
        <span className="lp-tag">Case study</span>
        <nav aria-label="Sections">
          <a href="#decisions">Decisions</a>
          <a href="#ai">AI</a>
          <a href="#figma">Figma</a>
          <a href="#try">Try it</a>
        </nav>
      </div></header>

      <main id="main">
        <section className="lp-hero">
          <div>
            <p className="lp-eyebrow">Case study for the Senior Product Designer role</p>
            <h1>Decide fast. Defend it later.</h1>
            <p className="lp-lead">I redesigned the Workation request detail screen for Global Mobility. It tells Laura what to do next, explains each risk, and keeps a record she can show an auditor. The agent suggests. She decides.</p>
            <div className="lp-cta">
              <a className="lp-btn lp-btn-primary" href="#try">Try the prototype</a>
              <a className="lp-btn" href={fig()} target="_blank" rel="noreferrer">Open the Figma file</a>
              <a className="lp-btn" href="#video">Watch the video</a>
            </div>
            <p className="lp-meta">Concept by Debora Moratalla. Not a WorkFlex product. Sample data. The prototype is password protected: use the one I sent you.</p>
          </div>
          <div className="lp-stage" aria-hidden="true">
          <span className="lp-blob lp-blob-a" /><span className="lp-blob lp-blob-b" />
          <div className="lp-toast"><Icon name="check" size={16} /><span>Approved by Laura</span><b>Undo</b></div>
          <div className="lp-mock">
            <div className="lp-mock-head"><span className="lp-mock-chip">Ready to approve</span><span>Sample request</span></div>
            <p className="lp-mock-label">Summary by the agent · Sources</p>
            <p className="lp-mock-text">All checks pass. Documents are complete and the dates are in the future. Nothing needs your attention.</p>
            <div className="lp-mock-rows"><span>Social security</span><b>Low</b><span>Tax</span><b>Low</b><span>Documents</span><b>Complete</b></div>
            <div className="lp-mock-btns"><span className="lp-mock-b1">Approve</span><span className="lp-mock-b2">Reject</span></div>
          </div>
          <div className="lp-ai"><Icon name="sparkle" size={16} /><span>Suggested by the agent. You decide.</span></div>
          </div>
        </section>
        <ul className="lp-stats" aria-label="At a glance">
          <li><b>10</b><span>Figma pages</span></li>
          <li><b>12</b><span>components</span></li>
          <li><b>116</b><span>variables in 3 collections</span></li>
          <li><b>4</b><span>clickable flows</span></li>
        </ul>

        <section id="video" className="lp-sec" aria-labelledby="h-video">
          <h2 id="h-video"><span className="lp-hi"><Icon name="eye" size={20} /></span>Video</h2>
          <div className="lp-video" role="img" aria-label="Video placeholder">
            <span className="lp-play"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></span><span>Video coming soon</span>
          </div>
          <p className="lp-cap">9 minutes. I explain first, then walk through the prototype, then the Figma file.</p>
        </section>

        <section id="try" className="lp-sec" aria-labelledby="h-try">
          <h2 id="h-try"><span className="lp-hi"><Icon name="arrow-right" size={20} /></span>Try four requests</h2>
          <ul className="lp-cards lp-cards-4">
            {CASES.map(([n, s, b]) => (
              <li key={n}><a className="lp-case" href={`/?s=${s}`}>
                <span className="lp-avatar" aria-hidden="true">{n[0]}</span>
                <span className="lp-case-body"><strong>{n}</strong><span>{b}</span></span>
                <span className={`lp-pill lp-pill-${CASE_TAG[s][1]}`}>{CASE_TAG[s][0]}</span>
                <Icon name="arrow-right" size={18} className="lp-go" />
              </a></li>
            ))}
          </ul>
          <p className="lp-cap">Use the switch at the top to see the screen as Global Mobility or HR. Reload to reset a case. Also: <a href="/?v=settings">Company settings</a>.</p>
        </section>

        <section className="lp-sec" aria-labelledby="h-user">
          <h2 id="h-user"><span className="lp-hi"><Icon name="users" size={20} /></span>Who it’s for</h2>
          <div className="lp-two">
            <div>
              <p className="lp-big">Laura Müller, Global Mobility & Compliance Manager at a company with 1,000+ people.</p>
              <p>She wants to avoid fines, approve at scale and answer to auditors. She’d use automation if it lowers risk. She needs to trust it, not just save time.</p>
            </div>
            <ul className="lp-list">
              <li><strong>How I judged each idea</strong>Does it help her decide faster or defend the decision better? If not, it’s out.</li>
              <li><strong>What’s an assumption</strong>Laura comes from the brief. I didn’t run new research.</li>
            </ul>
          </div>
        </section>

        <section id="decisions" className="lp-sec" aria-labelledby="h-dec">
          <h2 id="h-dec"><span className="lp-hi"><Icon name="check" size={20} /></span>What changed on the screen</h2>
          <ul className="lp-dec">
            {DECISIONS.map((d, i) => (
              <li key={d.pain}>
                <span className="lp-ico"><Icon name={DEC_ICONS[i]} size={22} /></span>
                <h3>{d.pain}</h3>
                <p className="lp-before"><span>Before</span>{d.before}</p>
                <p className="lp-after"><span>Now</span>{d.after}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="ai" className="lp-band" aria-labelledby="h-ai">
          <div className="lp-band-in">
            <h2 id="h-ai"><span className="lp-hi lp-hi-inv"><Icon name="sparkle" size={20} /></span>Where the AI helps, and where it stops</h2>
            <h3>What it does</h3>
            <ul className="lp-tiles">{USES.map(([t, b], i) => (<li key={t}><Icon name={USE_ICONS[i]} size={22} /><strong>{t}</strong><span>{b}</span></li>))}</ul>
            <h3>Rules it follows</h3>
            <ul className="lp-tiles lp-tiles-5">{RULES.map(([t, b], i) => (<li key={t}><Icon name={RULE_ICONS[i]} size={22} /><strong>{t}</strong><span>{b}</span></li>))}</ul>
            <p className="lp-cap">Laura chooses how far the agent goes for each task: <b>Auto</b>, <b>Ask me</b> or <b>Never</b>. It’s in Company settings, Agent tab.</p>
          </div>
        </section>

        <section id="figma" className="lp-sec" aria-labelledby="h-fig">
          <h2 id="h-fig"><span className="lp-hi"><Icon name="grid" size={20} /></span>How the Figma file is organised</h2>
          <p className="lp-lead-sm">Ten pages, from research to handoff. Everything uses auto-layout, spacing follows an 8px scale, and layers are named the way a team would name them.</p>

          <h3>Pages</h3>
          <ul className="lp-cards">
            {PAGES.map(([n, id, b], i) => (
              <li key={n}><a className="lp-pg" href={fig(id)} target="_blank" rel="noreferrer"><span className="lp-ico lp-ico-sm"><Icon name={PAGE_ICONS[i]} size={18} /></span><span><strong>{n}</strong><span>{b}</span></span></a></li>
            ))}
          </ul>

          <h3>System</h3>
          <div className="lp-two">
            <ul className="lp-list">
              <li><strong>Three variable collections</strong>Core (50), Semantic (46), Component (20).</li>
              <li><strong>Names match the code</strong><span>Figma <code>bg/inverse</code> is <code>--color-bg-inverse</code> in CSS. Spacing and radius follow the same rule.</span></li>
            </ul>
            <ul className="lp-list">
              <li><strong>Type</strong>Figtree, four weights.</li>
              <li><strong>Spacing and radius</strong>8px scale. Radius 4, 8, 16 and full.</li>
              <li><strong>Accessibility</strong>Aiming for WCAG 2.1 AA. Status always has a label or icon, never colour alone, and focus is visible.</li>
            </ul>
          </div>

          <h3>Components</h3>
          <ul className="lp-chips">
            {COMPONENTS.map(([n, id, v]) => (<li key={n}><a href={fig(id)} target="_blank" rel="noreferrer">{n}<span>{v}</span></a></li>))}
          </ul>

          <h3>Screens (page 07)</h3>
          <ul className="lp-cards lp-cards-4">
            {SCREENS.map(([n, id, b], i) => (
              <li key={n}><a className="lp-pg" href={fig(id)} target="_blank" rel="noreferrer"><span className="lp-ico lp-ico-sm"><Icon name={SCREEN_ICONS[i]} size={18} /></span><span><strong>{n}</strong><span>{b}</span></span></a></li>
            ))}
          </ul>
          <p className="lp-cap">Each screen has notes, numbered pins and a link to its live prototype state.</p>

          <h3>Handoff (page 09)</h3>
          <p>Web classes map to Figma frames. For example, <code>.sp-page</code> is Company settings, Agent tab. Each component lists its states and edge cases.</p>
        </section>

        <section className="lp-sec" aria-labelledby="h-out">
          <h2 id="h-out"><span className="lp-hi"><Icon name="alert" size={20} /></span>What I didn’t do</h2>
          <ul className="lp-list">
            <li><strong>Other Company settings tabs</strong>They come from the WorkFlex Help Center. Only Agent is designed.</li>
            <li><strong>Real risk scoring</strong>The agent’s output is sample data. I show how it explains, not how it scores.</li>
            <li><strong>Still to validate</strong>Whether Auto, Ask me and Never are the right levels. I’d test with real approvers.</li>
          </ul>
        </section>
      </main>

      <footer className="lp-foot"><hr className="lp-hr" />Debora Moratalla · Madrid · Concept only, not a WorkFlex product.</footer>
    </div>
  );
}
