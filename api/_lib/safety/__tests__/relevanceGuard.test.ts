import { describe, it, expect, vi } from 'vitest';
import { runRelevanceGuard } from '../relevanceGuard.js';

function fakeOpenAi(reply: string) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: reply } }],
          usage: { prompt_tokens: 100, completion_tokens: 1, total_tokens: 101 },
        }),
      },
    },
  } as any;
}

describe('runRelevanceGuard', () => {
  it('returns on_topic for "on"', async () => {
    const r = await runRelevanceGuard(fakeOpenAi('on'), 'What is my revenue?');
    expect(r.verdict).toBe('on_topic');
  });

  it('returns off_topic for "off"', async () => {
    const r = await runRelevanceGuard(fakeOpenAi('off'), 'Write me a poem');
    expect(r.verdict).toBe('off_topic');
  });

  it('treats whitespace and punctuation around "on" as on_topic', async () => {
    const r = await runRelevanceGuard(fakeOpenAi(' On.\n'), 'How is ROI calculated?');
    expect(r.verdict).toBe('on_topic');
  });

  it('defaults to on_topic when reply is unrecognised (fail-open)', async () => {
    const r = await runRelevanceGuard(fakeOpenAi('maybe'), 'Hello');
    expect(r.verdict).toBe('on_topic');
  });

  it('returns the token usage', async () => {
    const r = await runRelevanceGuard(fakeOpenAi('on'), 'X');
    expect(r.tokens).toBe(101);
  });
});
