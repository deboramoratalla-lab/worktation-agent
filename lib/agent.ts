import { z } from 'zod';
import type { WorkationRequest } from './data';

export const MODEL = process.env.AI_MODEL || 'openai/gpt-4.1';

// Rule-based checks. These decide whether Approve is available.
// The model explains them; it can't switch them off.
export type Check = { id: string; severity: 'blocking' | 'warning'; title: string; detail: string };

export function ruleChecks(r: WorkationRequest): Check[] {
  const all = rawChecks(r);
  return all.filter((c) => !r.confirmedRules?.includes(c.id));
}

function rawChecks(r: WorkationRequest): Check[] {
  const out: Check[] = [];
  if (r.dates.start < r.submitted) {
    out.push({ id: 'past-dates', severity: 'blocking', title: 'Trip dates are before the request was submitted', detail: `Trip starts ${r.dates.start}, request submitted ${r.submitted}.` });
  }
  const tripYear = Number(r.dates.start.slice(0, 4));
  if (tripYear !== r.daysAbroad.year) {
    out.push({ id: 'year-mismatch', severity: 'blocking', title: 'Days abroad counted against the wrong year', detail: `Trip is in ${tripYear}, balance shown for ${r.daysAbroad.year}.` });
  }
  const unreachable = r.sourceChecks.filter((s) => s.status === 'unreachable');
  for (const s of unreachable) out.push({ id: 'unreachable-' + s.name, severity: 'warning', title: `${s.name} couldn't be verified`, detail: 'Source did not respond.' });
  return out;
}

export function canApprove(r: WorkationRequest) {
  const stepsOk = r.steps.every((s) => s.state === 'Done' || s.state === 'Needs you');
  const blocking = ruleChecks(r).some((c) => c.severity === 'blocking');
  const waiting = r.steps.some((s) => s.state === 'Working' || s.state === 'Waiting' || s.state === 'Overdue' || s.state === 'Blocked');
  return stepsOk && !blocking && !waiting;
}

export const SYSTEM = `You are the approvals agent inside a Workation (work abroad) tool used by Global Mobility and HR admins.
Your reader is Laura, a Global Mobility and Compliance Manager. She must be able to defend every decision to an auditor.

Rules you never break:
- You never approve, reject or cancel. Laura decides. Don't tell her what to decide; tell her what is true and what is missing.
- Use only the request data you are given. Never invent documents, dates, people, laws or numbers.
- Risk levels come from the rules engine. Don't change them. Explain them.
- If something could not be verified, say so plainly. An incomplete summary must say it is incomplete.
- Cite sources by their exact names from the data (documents, steps, rules like BT_WE_12).
- The only person requesting is the employee named in the facts. Never mention anyone else as the employee.
- A step with state "Done" is complete. A document with status "ready" is present and valid. Never report these as missing or unverified.
- Rule checks are already shown to Laura as their own banners. Never repeat a rule check as an anomaly; only add problems the rules did not catch.
- Steps that are Working or Waiting and documents that are requested are normal progress the agent is already handling. They are not anomalies; mention them in the summary instead.
- The 183-day limit is per destination country under the applicable tax treaty (daysAbroad counts days in that country only). Never add up days across countries or call it a yearly total abroad.
- Report an anomaly only if a rule check, a step state, a document status or a source check in the data shows it. Otherwise return an empty list.

Writing style: plain English, short sentences, action first. No filler, no hedging words like "it seems". No em dashes.`;

export const AssessmentSchema = z.object({
  headline: z.string().describe('Max 8 words. What Laura should know first. Examples: "Ready for your decision", "Not approvable yet", "Check one thing before you decide", "Approval paused: dates need a fix". If steps are still Working or Waiting and the agent is handling them, use "Not approvable yet" and never call them missing. If a blocking rule check fails, say approval is paused and why, like "Approval paused: dates need a fix".'),
  summary: z.string().describe('1 or 2 sentences, max 35 words. Why, in plain words.'),
  confidenceNote: z.string().describe('One line about evidence, like "4 of 4 sources checked and current." or "3 of 4 sources checked. 1 couldn\'t be reached, so this summary is incomplete." or "2 of 4 sources checked so far. The rest arrive with the missing documents."'),
  anomalies: z
    .array(
      z.object({
        title: z.string().describe('Max 8 words'),
        detail: z.string().describe('One sentence with the concrete values from the data'),
        suggestedAction: z.string().describe('What Laura can do next, starting with a verb'),
      }),
    )
    .describe('Data problems: past dates, balance for the wrong year, missing or unverified documents, anything inconsistent. Empty if none.'),
  sources: z.array(z.string()).describe('Exact names of the documents, steps and rules you relied on'),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

// Plain facts first, so the model reads state rather than guessing it from raw JSON
export function requestContext(r: WorkationRequest) {
  const checks = ruleChecks(r);
  const facts = [
    `Employee: ${r.employee}`,
    `Trip: ${r.dates.label} (${r.dates.start} to ${r.dates.end}). Submitted ${r.submitted}.`,
    `Steps: ${r.steps.map((s) => `${s.title} = ${s.state}`).join('; ')}`,
    `Documents: ${r.documents.map((d) => `${d.name} = ${d.status}`).join('; ')}`,
    `Sources: ${r.sourceChecks.filter((s) => s.status === 'current').length} of ${r.sourceChecks.length} current. ${r.sourceChecks.filter((s) => s.status !== 'current').map((s) => `${s.name} = ${s.status}`).join('; ') || 'None missing.'}`,
    `Rule checks: ${checks.length ? checks.map((c) => `[${c.severity}] ${c.title}`).join('; ') : 'none'}`,
    `Approve available (decided by rules): ${canApprove(r) ? 'yes' : 'no'}`,
    ...(r.confirmedRules?.length ? [`Laura confirmed and lifted these rule checks: ${r.confirmedRules.join(', ')}. Treat the data as correct; don't flag it again.`] : []),
  ].join('\n');
  return `FACTS\n${facts}\n\nFULL DATA\n${JSON.stringify({ request: r, ruleChecks: checks, approveAvailable: canApprove(r) }, null, 2)}`;
}
