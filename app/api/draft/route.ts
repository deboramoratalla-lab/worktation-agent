import { streamText } from 'ai';
import { MODEL, SYSTEM, requestContext } from '@/lib/agent';
import { loadScenario } from '@/lib/scenario';

export const maxDuration = 30;

const TASKS: Record<string, string> = {
  reject: 'Draft the reason Laura sends when she rejects this request. It goes to the employee and their manager. 2 to 4 sentences. Say what is missing or wrong and what they can do to resubmit. Address the employee by first name. Sign off as Laura.',
  message: 'Draft a short message from Laura to the employee asking them to fix or confirm what is wrong in the request. 2 to 3 sentences. Be specific about the values. Address the employee by first name. Sign off as Laura.',
  'approve-note': 'Draft a one or two sentence note for the audit log explaining why Laura approves even though one source could not be verified. Leave a placeholder in [brackets] for what Laura checked herself. Don\'t claim anything was verified if the data says it wasn\'t.',
};

export async function POST(req: Request) {
  const { scenario, kind } = await req.json().catch(() => ({}));
  const task = TASKS[kind as string];
  if (!task) return new Response('Unknown draft', { status: 400 });
  const r = loadScenario(scenario);
  const result = streamText({
    model: MODEL,
    system: SYSTEM + '\nReturn only the text of the draft. No preamble, no quotes.',
    prompt: `${task}\n\n${requestContext(r)}`,
    temperature: 0.4,
    maxOutputTokens: 300,
  });
  return result.toTextStreamResponse();
}
