import type { Metadata } from 'next';
import './landing.css';

export const metadata: Metadata = {
  title: 'Workation approval, case study',
  description: 'Redesign of the Workation request approval screen. Concept by Debora Moratalla. Not a WorkFlex product.',
  robots: { index: false, follow: false },
};

const FIGMA = 'https://www.figma.com/design/cl9iO18ttAAfWUZpsvTJ0V';
const fig = (node?: string) => (node ? `${FIGMA}?node-id=${node.replace(':', '-')}` : FIGMA);
const PROTO = '/';

const DECISIONS = [
  { pain: 'Status and next action were buried', before: 'Status label in a corner, no next step.', after: 'One header answers “what do I do now”: the agent’s recommendation, one primary button, the reason.' },
  { pain: 'Risk was a label and a PDF', before: '“Medium risk” and a document to open.', after: 'Each risk row says which check flagged it, why, and links to the source.' },
  { pain: 'Past dates and balance mismatch went unseen', before: 'Trip in 2024, created in 2025, balance shown for 2025. No warning.', after: 'A banner names the conflict. Approving needs a confirmation, and the reason is logged.' },
  { pain: 'Approvals looked actionable after approval', before: 'Approved steps still looked like buttons.', after: 'Decided steps become a quiet record with who, when and undo. Only pending steps are actions.' },
  { pain: 'Cancel sat next to edits', before: 'Destructive action in the same menu.', after: 'Reject and Cancel are separate, worded plainly, and ask for a reason.' },
  { pain: 'No history, comments apart from decisions', before: 'No audit trail. Comments in another place.', after: 'One activity log. Every decision, agent action and comment sits in it.' },
];

const RULES = [
  ['Human decides', 'The agent recommends. Approve, reject and cancel are locked to Laura.'],
  ['Labelled', 'Everything the agent writes says “Summary by the agent”.'],
  ['Sourced', 'Each claim links to a source. No source, no claim.'],
  ['Dismissable', 'Laura can dismiss any suggestion. The screen still works without it.'],
  ['Logged', 'Agent actions and overrides go to the audit trail.'],
];

const USES = [
  ['Plain-language risk summary', 'Which check is flagged and why, in two lines.'],
  ['Recommended action', 'With confidence and sources. Never a bare score.'],
  ['Anomaly flags', 'Past dates, balance conflicts, missing documents.'],
  ['Drafts', 'Reminders and messages. The rejection reason is always written by Laura.'],
];

const PAGES = [
  ['02 · Research', '0:1', 'What we know about the current screen and the persona.'],
  ['03 · Synthesis & strategy', '8:6', 'Pain points ranked. What ships first.'],
  ['04 · Explorations', '8:7', 'Options tried and dropped.'],
  ['05 · Foundations', '1:2', 'Tokens, type, spacing, grid.'],
  ['06 · Components', '8:9', '12 component sets with states.'],
  ['07 · Screens', '1:3', 'Every state, dialog, settings and responsive.'],
  ['08 · Prototype & flows', '8:11', 'Four clickable flows, with toasts and undo.'],
  ['09 · Dev handoff', '8:13', 'Tokens to CSS, states, edge cases, notes.'],
  ['10 · Presentation & rationale', '1:4', 'The why behind each decision.'],
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

const CASES = [
  ['Lili', 'ready', 'Everything checks out. Approve in one click, then undo.'],
  ['Suba', 'working', 'The agent is still chasing a document. Laura can wait or approve without coverage.'],
  ['Stefan', 'check', 'A certificate is missing. Approve anyway needs a reason.'],
  ['Mara', 'conflict', 'Past dates. Confirm them or change them before deciding.'],
];

export default function Landing() {
  return (
    <div className="lp">
      <a className="lp-skip" href="#main">Skip to content</a>
      <header className="lp-top">
        <span className="lp-tag">Case study</span>
        <nav aria-label="Sections">
          <a href="#decisions">Decisions</a>
          <a href="#ai">AI</a>
          <a href="#figma">Figma</a>
          <a href="#try">Try it</a>
        </nav>
      </header>

      <main id="main">
        <section className="lp-hero">
          <p className="lp-eyebrow">Senior Product Designer case study · Workation approval</p>
          <h1>Laura decides in a minute. And can defend it in a year.</h1>
          <p className="lp-lead">A redesign of the request detail screen for Global Mobility. One clear next step, risk that explains itself, an agent that suggests and never decides, and a record an auditor can read.</p>
          <div className="lp-cta">
            <a className="lp-btn lp-btn-primary" href={PROTO}>Open the prototype</a>
            <a className="lp-btn" href={fig()} target="_blank" rel="noreferrer">Open the Figma file</a>
            <a className="lp-btn" href="#video">Watch the video</a>
          </div>
          <p className="lp-meta">Concept by Debora Moratalla. Not a WorkFlex product. Sample data. The prototype asks for a password, shared with reviewers.</p>
        </section>

        <section id="video" className="lp-sec" aria-labelledby="h-video">
          <h2 id="h-video">Video</h2>
          <div className="lp-video" role="img" aria-label="Video placeholder">
            <span>Video coming soon</span>
          </div>
          <p className="lp-cap">9 minutes. Me first, then the prototype live, then the Figma file.</p>
        </section>

        <section className="lp-sec" aria-labelledby="h-user">
          <h2 id="h-user">Who it is for</h2>
          <div className="lp-two">
            <div>
              <p className="lp-big">Laura Müller, Global Mobility & Compliance Manager, 1000+ employees.</p>
              <p>She avoids fines, approves at scale, and answers to auditors. She is open to automation if it lowers risk. She needs to trust it, not just get speed.</p>
            </div>
            <ul className="lp-list">
              <li><strong>Test for every decision</strong> Does it help her decide faster or defend better? If not, it is out.</li>
              <li><strong>Assumption</strong> The persona comes from the brief. I did not run new research.</li>
            </ul>
          </div>
        </section>

        <section id="decisions" className="lp-sec" aria-labelledby="h-dec">
          <h2 id="h-dec">Nine pain points, six decisions</h2>
          <div className="lp-table" role="table" aria-label="Before and after">
            <div className="lp-row lp-head" role="row"><span role="columnheader">Problem</span><span role="columnheader">Before</span><span role="columnheader">After</span></div>
            {DECISIONS.map((d) => (
              <div className="lp-row" role="row" key={d.pain}>
                <strong role="cell">{d.pain}</strong>
                <span role="cell">{d.before}</span>
                <span role="cell">{d.after}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="ai" className="lp-sec" aria-labelledby="h-ai">
          <h2 id="h-ai">AI that earns its place</h2>
          <div className="lp-two">
            <div>
              <h3>Where it helps</h3>
              <ul className="lp-list">{USES.map(([t, b]) => (<li key={t}><strong>{t}</strong>{b}</li>))}</ul>
            </div>
            <div>
              <h3>Five rules it never breaks</h3>
              <ol className="lp-list lp-num">{RULES.map(([t, b]) => (<li key={t}><strong>{t}</strong>{b}</li>))}</ol>
            </div>
          </div>
          <p className="lp-cap">Laura sets how far the agent goes per task: Auto, Ask me or Never. See Company settings, Agent tab, in the prototype.</p>
        </section>

        <section id="figma" className="lp-sec" aria-labelledby="h-fig">
          <h2 id="h-fig">How the Figma file is built</h2>
          <p className="lp-lead-sm">Ten pages, from discovery to handoff. Auto-layout everywhere, spacing in multiples of 8, layers named like a product team would.</p>

          <h3>Pages</h3>
          <ul className="lp-cards">
            {PAGES.map(([n, id, b]) => (
              <li key={n}><a href={fig(id)} target="_blank" rel="noreferrer"><strong>{n}</strong><span>{b}</span></a></li>
            ))}
          </ul>

          <h3>System</h3>
          <div className="lp-two">
            <ul className="lp-list">
              <li><strong>Three variable collections</strong>Core (50), Semantic (46), Component (20). Components only use component and semantic tokens.</li>
              <li><strong>Naming maps to code</strong>Figma <code>bg/inverse</code> is <code>--color-bg-inverse</code>. Same rule for spacing and radius.</li>
            </ul>
            <ul className="lp-list">
              <li><strong>Type</strong>Figtree, 4 weights.</li>
              <li><strong>Spacing and radius</strong>8px scale. Radius 4, 8, 16, full.</li>
              <li><strong>Accessibility</strong>WCAG 2.1 AA. Status always has a label or icon, never colour alone. Visible focus ring.</li>
            </ul>
          </div>

          <h3>Components and their states</h3>
          <ul className="lp-chips">
            {COMPONENTS.map(([n, id, v]) => (<li key={n}><a href={fig(id)} target="_blank" rel="noreferrer">{n}<span>{v}</span></a></li>))}
          </ul>

          <h3>Screens (page 07)</h3>
          <ul className="lp-cards lp-cards-4">
            {SCREENS.map(([n, id, b]) => (
              <li key={n}><a href={fig(id)} target="_blank" rel="noreferrer"><strong>{n}</strong><span>{b}</span></a></li>
            ))}
          </ul>
          <p className="lp-cap">Every screen has notes, numbered pins and a link to the live prototype state.</p>

          <h3>Handoff (page 09)</h3>
          <p>Each web class maps to a Figma frame, for example <code>.sp-page</code> is Company settings, Agent tab. States, edge cases and responsive notes are listed per component.</p>
        </section>

        <section id="try" className="lp-sec" aria-labelledby="h-try">
          <h2 id="h-try">Try it: four requests, four situations</h2>
          <ul className="lp-cards lp-cards-4">
            {CASES.map(([n, s, b]) => (
              <li key={n}><a href={`/?s=${s}`}><strong>{n}</strong><span>{b}</span></a></li>
            ))}
          </ul>
          <p className="lp-cap">Switch between Global Mobility and HR approver at the top. Reload a case to reset it. Settings: <a href="/?v=settings">Company settings</a>.</p>
        </section>

        <section className="lp-sec" aria-labelledby="h-out">
          <h2 id="h-out">What I left out, on purpose</h2>
          <ul className="lp-list">
            <li><strong>Other Company settings tabs</strong>Taken from the WorkFlex Help Center. Only Agent is designed.</li>
            <li><strong>Real risk scoring</strong>The agent’s output is a sample. The design shows how it explains, not how it scores.</li>
            <li><strong>Needs validation</strong>Auto, Ask me and Never as the right levels. I would test them with real approvers.</li>
          </ul>
        </section>
      </main>

      <footer className="lp-foot">Debora Moratalla · Madrid · Concept only, not a WorkFlex product.</footer>
    </div>
  );
}
