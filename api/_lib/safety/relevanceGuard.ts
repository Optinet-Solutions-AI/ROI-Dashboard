import type OpenAI from 'openai';

const SYSTEM_PROMPT = `You classify whether a user's question is on-topic for an
affiliate-marketing performance dashboard.

ON-TOPIC examples: revenue, profit, ROI, top affiliates, conversion funnel,
campaign performance, country breakdowns, brand comparisons, "what can you do",
"how do I use this", greetings.

OFF-TOPIC examples: writing poetry, general world knowledge, coding help,
political opinions, anything unrelated to the dashboard data.

Respond with EXACTLY one word: "on" or "off". No punctuation, no explanation.`;

export type GuardResult = {
  verdict: 'on_topic' | 'off_topic';
  tokens: number;
};

export async function runRelevanceGuard(
  client: OpenAI,
  question: string,
): Promise<GuardResult> {
  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 2,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: question },
    ],
  });

  const raw    = resp.choices[0]?.message?.content ?? '';
  const tokens = resp.usage?.total_tokens ?? 0;
  const norm   = raw.trim().toLowerCase().replace(/[^a-z]/g, '');

  if (norm === 'off') return { verdict: 'off_topic', tokens };
  // 'on' AND any unrecognised reply → fail open. Cheap to let through;
  // expensive to wrongly block a real question.
  return { verdict: 'on_topic', tokens };
}
