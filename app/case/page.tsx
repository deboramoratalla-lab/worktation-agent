import type { Metadata } from 'next';
import './landing.css';
import { Icon, type IconName } from '@/components/Icon';
import { Reveal } from '@/components/Reveal';
import { CaseTabs, type CaseTab } from '@/components/CaseTabs';

export const metadata: Metadata = {
  title: 'Workation approval, case study',
  description: 'Redesign of the Workation request approval screen. Concept by Debora Moratalla. Not a WorkFlex product.',
  robots: { index: false, follow: false },
};

const FIGMA = 'https://www.figma.com/design/cl9iO18ttAAfWUZpsvTJ0V';
const fig = (node?: string) => (node ? `${FIGMA}?node-id=${node.replace(':', '-')}` : FIGMA);

const PROBLEMS: { icon: IconName; title: string; now: string; before: string; where: string }[] = [
  { icon: 'clock', title: 'No clear next step', now: 'The header now says what to do: the agent’s suggestion, one main button and the reason.', before: 'Status in a corner, no next step.', where: 'Request header' },
  { icon: 'eye', title: 'Risk was only a label', now: 'Each risk says which check flagged it and why. The source is one click away.', before: '“Medium risk” and a PDF to open.', where: 'Risk rows · Sources' },
  { icon: 'calendar', title: 'Past dates, no warning', now: 'A banner names the conflict. To approve anyway, Laura writes a reason, and it’s logged.', before: 'A 2024 trip created in 2025, no warning.', where: 'Alert banner · Dialog' },
  { icon: 'check', title: 'Approved looked pending', now: 'Once someone decides, the step shows who, when, and an undo. Only pending steps keep buttons.', before: 'Approved steps still looked like buttons.', where: 'Approval steps' },
  { icon: 'close', title: 'Cancel next to edit', now: 'Reject and Cancel are apart from edits, say what they do, and ask for a reason.', before: 'Destructive action in the same menu as edits.', where: 'Actions · Dialog' },
  { icon: 'file', title: 'No history at all', now: 'One activity log: decisions, agent actions and comments in the same place.', before: 'No audit trail. Comments lived elsewhere.', where: 'Activity' },
];

const CASES: CaseTab[] = [
  { name: 'Lili', scenario: 'ready', tag: 'Ready', tone: 'ok', summary: 'Everything checks out. Documents are complete and the dates are in the future.', try: ['Approve, then Undo it from the toast', 'Open Social security risk and its sources'] },
  { name: 'Suba', scenario: 'working', tag: 'In progress', tone: 'warn', summary: 'The agent is still chasing a missing document. Laura can wait, or approve without coverage.', try: ['Read the reminder the agent drafted', 'Approve without coverage, or Reject'] },
  { name: 'Stefan', scenario: 'check', tag: 'Needs a check', tone: 'warn', summary: 'A certificate is missing. To approve anyway, Laura has to write why.', try: ['Approve anyway and write the reason', 'Dismiss the agent’s suggestion'] },
  { name: 'Mara', scenario: 'conflict', tag: 'Conflict', tone: 'bad', summary: 'The trip dates are in the past. Laura confirms or changes them before deciding.', try: ['Dates are correct, or Change dates', 'Then Approve or Reject'] },
];

const USES = ['A plain-words risk summary: which check, and why', 'A recommendation, with its confidence and sources', 'Flags for past dates, balance conflicts, missing documents', 'Reminder drafts. Laura writes the rejection reason herself'];
const RULES: [IconName, string, string][] = [
  ['users', 'Human decides', 'Approve, reject and cancel are Laura’s.'],
  ['sparkle', 'Labelled', 'If the agent wrote it, it says so.'],
  ['book', 'Sourced', 'Every claim links to its source.'],
  ['close', 'Dismissable', 'Laura can dismiss any suggestion.'],
  ['clock', 'Logged', 'What the agent did, and what Laura overrode, goes in the audit trail.'],
];

const START: [IconName, string, string][] = [
  ['grid', 'Foundations', '1:2'], ['settings', 'Components', '8:9'], ['eye', 'Screens', '1:3'], ['arrow-right', 'Prototype', '8:11'], ['file', 'Dev handoff', '8:13'],
];
const PAGES: [string, string, string][] = [
  ['02 · Research', '0:1', 'The current screen and Laura, from the brief.'], ['03 · Synthesis & strategy', '8:6', 'Pain points ranked and what ships first.'],
  ['04 · Explorations', '8:7', 'Options I tried and dropped.'], ['05 · Foundations', '1:2', 'Tokens, type, spacing.'],
  ['06 · Components', '8:9', '12 components with their states.'], ['07 · Screens', '1:3', 'Every state, dialog, settings and responsive.'],
  ['08 · Prototype & flows', '8:11', 'Four clickable flows, with toasts and undo.'], ['09 · Dev handoff', '8:13', 'Tokens to CSS, states, edge cases.'],
  ['10 · Presentation & rationale', '1:4', 'Why I made each decision.'],
];
const COMPONENTS: [string, string, string][] = [
  ['Button', '28:38', '24'], ['Risk badge', '28:52', '4'], ['Risk row', '28:101', '5'], ['Approval step', '28:135', '6'], ['Document row', '28:159', '3'], ['Activity item', '28:192', '7'],
  ['Autonomy setting', '31:131', '3'], ['Path step', '31:197', '6'], ['Path to approval', '32:222', '6'], ['Icon button', '38:147', '21'], ['Dialog', '42:230', '5'], ['Alert banner', '66:279', '3'],
];

const Mark = ({ children }: { children: React.ReactNode }) => <mark className="lp-mark">{children}</mark>;

function Head({ eyebrow, children, sub, dark }: { eyebrow: string; children: React.ReactNode; sub?: string; dark?: boolean }) {
  return (
    <header className={`lp-head${dark ? ' lp-head-dark' : ''}`}>
      <p className="lp-eyebrow">{eyebrow}</p>
      <h2>{children}</h2>
      {sub && <p className="lp-sub">{sub}</p>}
    </header>
  );
}

export default function Landing() {
  return (
    <div className="lp">
      <Reveal />
      <a className="lp-skip" href="#main">Skip to content</a>

      

      <header className="lp-nav">
        <div className="lp-nav-in">
          <a className="lp-brand" href="#top"><span className="lp-brand-mark" aria-hidden="true"><Icon name="check" size={14} /></span>Workation approval</a>
          <nav aria-label="Sections">
            <a href="#problem">Problem</a><a href="#prototype">Prototype</a><a href="#video">Video</a><a href="#ai">AI</a><a href="#figma">Figma file</a>
          </nav>
          <div className="lp-nav-r">
            <a className="lp-btn lp-btn-pink lp-btn-sm lp-nav-cta" href="#prototype">Try the prototype</a>
          </div>
        </div>
      </header>

      <main id="main">
        <section id="top" className="lp-hero">
          <div className="lp-in lp-hero-in">
            <div>
              <span className="lp-chip"><Icon name="sparkle" size={12} />My case study for WorkFlex</span>
              <h1>Decide fast. <Mark>Defend it</Mark> later.</h1>
              <p className="lp-lead">This is my redesign of the Workation request screen. I wanted Laura, who approves these for Global Mobility, to know what to do next, understand every risk, and have a record she can show an auditor. The agent suggests. She decides.</p>
              <div className="lp-cta">
                <a className="lp-btn lp-btn-pink" href="#prototype">Try the prototype</a>
                <a className="lp-btn lp-btn-line" href={fig()} target="_blank" rel="noreferrer">See the Figma file</a>
                <a className="lp-watch" href="#video"><span className="lp-watch-i"><svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></span>Watch me walk through it (9 min)</a>
              </div>
              <p className="lp-meta">I’m Debora, and this is a concept, not a WorkFlex product. The prototype asks for a password: it’s the one I sent you.</p>
            </div>
            <div className="lp-win lp-win-hero" aria-hidden="true">
              <div className="lp-win-bar"><i /><i /><i /><span>workation-agent.vercel.app</span></div>
              <div className="lp-win-tabs"><b>Lili</b><span>Suba</span><span>Stefan</span><span>Mara</span></div>
              <div className="lp-win-who"><span className="lp-avatar">L</span><div><b>Lili’s workation request</b><small>Summary by the agent · ready</small></div><span className="lp-win-count">Sample data</span></div>
              <div className="lp-win-line"><Icon name="sparkle" size={14} />Checked by the agent<span>4 / 4</span></div>
              <ul className="lp-win-rows">
                {([['shield', 'Risk assessment', 'Checked'], ['users', 'Social security', 'Low risk'], ['file', 'Documents', 'Complete'], ['calendar', 'Dates', 'In the future']] as [IconName, string, string][]).map(([ic, l, s]) => (
                  <li key={l}><Icon name={ic} size={16} /><span>{l}</span><em>{s}</em></li>
                ))}
              </ul>
              <div className="lp-mock-btns lp-win-act"><span className="lp-mock-b1">Approve</span><span className="lp-mock-b2">Reject</span></div>
            </div>
          </div>
          <div className="lp-in lp-built">
            <span>Built with</span>
            <ul><li>Figma</li><li>Next.js</li><li>Vercel AI Gateway</li><li>Figtree</li><li>WCAG 2.1 AA target</li></ul>
          </div>
        </section>

        <section id="problem" data-reveal className="lp-sec lp-tone-b" aria-labelledby="h-problem">
          <div className="lp-in">
            <Head eyebrow="Where I started" sub="The current screen hides the next step, shows risk as a label and keeps no record. The brief lists nine problems. I grouped them into six.">
              <span id="h-problem">Laura couldn’t tell what to do next, or <Mark>defend what she did</Mark>.</span>
            </Head>
            <ul className="lp-grid3">
              {PROBLEMS.map((p) => (
                <li className="lp-card" key={p.title}>
                  <span className="lp-tile"><Icon name={p.icon} size={20} /></span>
                  <h3>{p.title}</h3>
                  <p>{p.now}</p>
                  <div className="lp-card-foot"><b>Before</b> · {p.before}<br /><b>Changed in</b> · {p.where}</div>
                </li>
              ))}
              <li className="lp-card lp-card-more">
                <span className="lp-tile"><Icon name="book" size={20} /></span>
                <h3>The rest of the list</h3>
                <p>I kept asking one question: does this help Laura decide faster, or defend her decision better? If not, I left it out.</p>
              </li>
            </ul>
          </div>
        </section>

        <section id="prototype" data-reveal className="lp-sec" aria-labelledby="h-proto">
          <div className="lp-in">
            <Head eyebrow="The prototype" sub="You play Laura and handle four requests. The agent writes a summary when you open one, drafts reminders and answers questions. Approve, reject and undo all work.">
              <span id="h-proto">A prototype with a <Mark>real AI agent</Mark> inside.</span>
            </Head>
            <div className="lp-strip lp-strip-tour">
              <div>
                <h3>Not sure where to start? Take the tour.</h3>
                <p>It walks you through the screen one chapter at a time and explains each decision as you see it. It ends on Company settings.</p>
              </div>
              <a className="lp-btn lp-btn-pink" href="/?tour=1" target="_blank" rel="noopener noreferrer">Start the tour<Icon name="arrow-right" size={16} /></a>
            </div>
            <p className="lp-or">Or open a request</p>
            <div className="lp-box">
              <CaseTabs cases={CASES} />
            </div>
            <ul className="lp-facts">
              <li><Icon name="sparkle" size={18} /><span><b>Live AI</b>The agent writes summaries, drafts and answers when you open a request.</span></li>
              <li><Icon name="users" size={18} /><span><b>You decide</b>The agent never approves or rejects, and you can undo anything.</span></li>
              <li><Icon name="file" size={18} /><span><b>Sample data</b>The requests are invented and the risk results are samples, not a real check.</span></li>
            </ul>
            <div className="lp-strip">
              <div>
                <h3>Decide how far the agent goes</h3>
                <p>In Company settings, Agent tab, each task is Auto, Ask me or Never. Approve, reject and cancel always stay with Laura.</p>
              </div>
              <a className="lp-btn lp-btn-pink" href="/?v=settings" target="_blank" rel="noopener noreferrer">Open Company settings<Icon name="arrow-right" size={16} /></a>
            </div>
          </div>
        </section>

        <section id="video" data-reveal className="lp-sec lp-tone-b" aria-labelledby="h-video">
          <div className="lp-in">
            <Head eyebrow="The video" sub="First the idea, then the prototype, then the Figma file.">
              <span id="h-video">Nine minutes, <Mark>in my own words</Mark>.</span>
            </Head>
            <div className="lp-video" role="img" aria-label="Video placeholder">
              <span className="lp-play"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></span>
              <span>Video coming soon</span>
            </div>
          </div>
        </section>

        <section id="ai" data-reveal className="lp-sec lp-dark" aria-labelledby="h-ai">
          <div className="lp-in lp-ai">
            <div>
              <p className="lp-eyebrow">How I used AI</p>
              <h2 id="h-ai">The agent suggests. <Mark>Laura decides.</Mark></h2>
              <p className="lp-sub">I wanted the AI to cut the reading, not the responsibility. So it has four jobs and five rules.</p>
              <ul className="lp-checks lp-checks-dark">{USES.map((u) => (<li key={u}><Icon name="check" size={16} />{u}</li>))}</ul>
            </div>
            <ul className="lp-rules">
              {RULES.map(([ic, t, b]) => (<li key={t}><Icon name={ic} size={20} /><b>{t}</b><span>{b}</span></li>))}
            </ul>
          </div>
        </section>

        <section id="figma" data-reveal className="lp-sec" aria-labelledby="h-figma">
          <div className="lp-in">
            <Head eyebrow="The Figma file" sub="Ten pages, from research to handoff. Auto-layout everywhere, an 8px spacing scale, and layers named the way a team would.">
              <span id="h-figma">A file a developer can <Mark>build from</Mark>.</span>
            </Head>
            <div className="lp-strip lp-strip-start">
              <div>
                <h3>Start with these five</h3>
                <p>The design system, the screens, the prototype and the handoff notes.</p>
                <a className="lp-btn lp-btn-pink" href={fig()} target="_blank" rel="noreferrer">Open in Figma<Icon name="external-link" size={16} /></a>
              </div>
              <ul className="lp-mini">
                {START.map(([ic, n, id]) => (
                  <li key={n}><a href={fig(id)} target="_blank" rel="noreferrer"><Icon name={ic} size={20} /><span>{n}</span><em>Open <Icon name="arrow-right" size={12} /></em></a></li>
                ))}
              </ul>
            </div>
            <ul className="lp-grid3 lp-stats3">
              <li className="lp-card"><p className="lp-big">116</p><p className="lp-cap">variables in 3 collections</p><p>Core 50, Semantic 46, Component 20. Names match the CSS tokens, so <code>bg/inverse</code> becomes <code>--color-bg-inverse</code>.</p></li>
              <li className="lp-card"><p className="lp-big">12</p><p className="lp-cap">components with states</p><p>Button alone has 24 variants. The rest cover risk, approval steps, documents, dialogs and settings.</p></li>
              <li className="lp-card"><p className="lp-big">4</p><p className="lp-cap">clickable flows</p><p>Lili, Suba, Stefan and Mara, with toasts and undo.</p></li>
            </ul>
            <details className="lp-more">
              <summary>All ten pages and twelve components</summary>
              <ul className="lp-grid3 lp-pages">
                {PAGES.map(([n, id, b]) => (<li key={n}><a className="lp-card" href={fig(id)} target="_blank" rel="noreferrer"><b>{n}</b><span>{b}</span></a></li>))}
              </ul>
              <ul className="lp-chips">{COMPONENTS.map(([n, id, v]) => (<li key={n}><a href={fig(id)} target="_blank" rel="noreferrer">{n}<span>{v}</span></a></li>))}</ul>
            </details>
            <p className="lp-foot-note">Accessibility: I’m aiming for WCAG 2.1 AA. Status always has a label or icon, never colour alone, and focus is visible. I haven’t audited it with a screen reader.</p>
          </div>
        </section>

        <section data-reveal className="lp-sec lp-tone-b" aria-labelledby="h-out">
          <div className="lp-in">
            <Head eyebrow="Limits"><span id="h-out">What I <Mark>didn’t do</Mark>.</span></Head>
            <ul className="lp-grid3">
              <li className="lp-card"><span className="lp-tile"><Icon name="settings" size={20} /></span><h3>Other settings tabs</h3><p>I took them from the WorkFlex Help Center. I only designed the Agent tab.</p></li>
              <li className="lp-card"><span className="lp-tile"><Icon name="chart" size={20} /></span><h3>Real risk scoring</h3><p>The agent’s output is sample data. I show how it explains a risk, not how it scores one.</p></li>
              <li className="lp-card"><span className="lp-tile"><Icon name="users" size={20} /></span><h3>Validation</h3><p>I haven’t tested with anyone. First I’d try Auto, Ask me and Never with real approvers.</p></li>
            </ul>
          </div>
        </section>

        <section data-reveal className="lp-sec lp-final" aria-labelledby="h-final">
          <div className="lp-in lp-final-in">
            <h2 id="h-final">Happy to <Mark>defend every choice</Mark>.</h2>
            <p className="lp-sub">Try the prototype, look at the Figma file, then ask me about anything.</p>
            <div className="lp-cta lp-cta-c">
              <a className="lp-btn lp-btn-pink" href="#prototype">Try the prototype</a>
              <a className="lp-btn lp-btn-line" href={fig()} target="_blank" rel="noreferrer">See the Figma file</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer"><div className="lp-in">Debora Moratalla · Madrid · A concept, not a WorkFlex product.</div></footer>
    </div>
  );
}
