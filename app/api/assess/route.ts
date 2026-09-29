import { generateObject } from 'ai';
import { AssessmentSchema, MODEL, SYSTEM, canApprove, requestContext, ruleChecks } from '@/lib/agent';
import { loadScenario } from '@/lib/scenario';

export const maxDuration = 30;

// Scenario data is fixed, so one good assessment per scenario is enough. Saves calls on rate-limited plans.
// Drop agent anomalies that restate a rule check (they already show as their own banner)
const STOP = new Set(['the', 'was', 'are', 'for', 'and', 'not', 'be', 'is', 'to', 'of', 'in', 'on', 'before', 'against']);
const words = (t: string) => new Set((t.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []).filter((w) => !STOP.has(w)));
function dedupe<T extends { title: string }>(anomalies: T[], rules: { title: string }[]) {
  return anomalies.filter((a) => !rules.some((c) => { const w = words(c.title); return [...words(a.title)].filter((x) => w.has(x)).length >= 2; }));
}

const cache = new Map<string, { assessment: unknown; at: string }>();

export async function POST(req: Request) {
  const { scenario } = await req.json().catch(() => ({}));
  const r = loadScenario(scenario);
  const key = `${MODEL}:${scenario}`;
  const hit = cache.get(key);
  if (hit) return Response.json({ assessment: hit.assessment, checks: ruleChecks(r), approveAvailable: canApprove(r), model: MODEL, at: hit.at });
  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: AssessmentSchema,
      system: SYSTEM,
      prompt: `Assess this Workation request for Laura's decision panel. Today is ${r.today}.\n\n${requestContext(r)}`,
      temperature: 0.2,
    });
    // Steps the agent is already working on are progress, not anomalies
    const inProgress = [...r.steps.filter((x) => x.state === 'Working' || x.state === 'Waiting').map((x) => ({ title: x.title })), ...r.documents.filter((d) => d.status === 'requested').map((d) => ({ title: d.name }))];
    object.anomalies = dedupe(dedupe(object.anomalies, ruleChecks(r)), inProgress);
    const at = new Date().toISOString();
    cache.set(key, { assessment: object, at });
    return Response.json({ assessment: object, checks: ruleChecks(r), approveAvailable: canApprove(r), model: MODEL, at });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'The agent could not run the check.', checks: ruleChecks(r), approveAvailable: canApprove(r) }, { status: 503 });
  }
}
