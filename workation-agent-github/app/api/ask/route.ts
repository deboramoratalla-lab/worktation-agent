import { streamText } from 'ai';
import { MODEL, SYSTEM, requestContext } from '@/lib/agent';
import { loadScenario } from '@/lib/scenario';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { scenario, question } = await req.json().catch(() => ({}));
  if (typeof question !== 'string' || !question.trim() || question.length > 500) return new Response('Ask a question under 500 characters.', { status: 400 });
  const r = loadScenario(scenario);
  const result = streamText({
    model: MODEL,
    system: SYSTEM + `\nAnswer Laura's question about this request in max 3 short sentences. End with a line "Sources: " listing exact names you used. If the data can't answer it, say what is missing. If she asks you to approve, reject or cancel, say that stays with her.`,
    prompt: `Today is ${r.today}.\n${requestContext(r)}\n\nLaura asks: ${question}`,
    temperature: 0.2,
    maxOutputTokens: 300,
  });
  return result.toTextStreamResponse();
}
