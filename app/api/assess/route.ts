import { generateObject } from 'ai';
import { AssessmentSchema, MODEL, SYSTEM, canApprove, requestContext, ruleChecks } from '@/lib/agent';
import { loadScenario } from '@/lib/scenario';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { scenario } = await req.json().catch(() => ({}));
  const r = loadScenario(scenario);
  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: AssessmentSchema,
      system: SYSTEM,
      prompt: `Assess this Workation request for Laura's decision panel. Today is ${r.today}.\n\n${requestContext(r)}`,
      temperature: 0.2,
    });
    return Response.json({ assessment: object, checks: ruleChecks(r), approveAvailable: canApprove(r), model: MODEL, at: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'The agent could not run the check.', checks: ruleChecks(r), approveAvailable: canApprove(r) }, { status: 503 });
  }
}
