import { describe, it, expect, vi } from 'vitest';
import { runAgent, ITERATION_CAP, TOKEN_BUDGET, MAX_TOOL_BYTES } from '../agent.js';

const usage = (p: number, c: number) => ({ prompt_tokens: p, completion_tokens: c, total_tokens: p + c });

// Build a content-only chunk (model emits an answer, no tool call)
function chunkContent(content: string, u = usage(50, 20)): any {
  return {
    id: 'c', model: 'm', created: 0, object: 'chat.completion.chunk',
    choices: [{ index: 0, delta: { content }, finish_reason: 'stop' }],
    usage: u,
  };
}

// Build a tool-call chunk (model wants to invoke a tool)
function chunkToolCall(id: string, name: string, args: object, u = usage(50, 20)): any {
  return {
    id: 'c', model: 'm', created: 0, object: 'chat.completion.chunk',
    choices: [{
      index: 0,
      delta: {
        tool_calls: [{ index: 0, id, type: 'function',
                       function: { name, arguments: JSON.stringify(args) } }],
      },
      finish_reason: 'tool_calls',
    }],
    usage: u,
  };
}

// Each "turn" is a list of chunks the SDK would yield for one create() call.
function fakeOpenAi(transcript: any[][]) {
  let i = 0;
  return {
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async () => {
          const chunks = transcript[i++];
          return (async function* () { for (const c of chunks) yield c; })();
        }),
      },
    },
  } as any;
}

describe('runAgent', () => {
  it('streams content tokens via onToken when the model emits text', async () => {
    const ai = fakeOpenAi([[
      chunkContent('Hello, '),
      chunkContent('world.', usage(50, 20)),
    ]]);
    const tokens: string[] = [];
    const r = await runAgent({
      openai: ai, question: 'q', history: [],
      onStatus: () => {}, onToken: (d) => tokens.push(d),
      tools: { fake: async () => ({}) } as any,
    });
    expect(r.status).toBe('ok');
    expect(r.answer).toBe('Hello, world.');
    expect(tokens).toEqual(['Hello, ', 'world.']);
  });

  it('executes a tool call then returns the model\'s next answer', async () => {
    const ai = fakeOpenAi([
      [chunkToolCall('1', 'fake', { x: 1 })],
      [chunkContent('Done.')],
    ]);
    const fakeTool = vi.fn().mockResolvedValue({ result: 'ok' });
    const r = await runAgent({
      openai: ai, question: 'q', history: [],
      onStatus: () => {}, onToken: () => {},
      tools: { fake: fakeTool } as any,
    });
    expect(r.status).toBe('ok');
    expect(r.answer).toBe('Done.');
    expect(fakeTool).toHaveBeenCalledWith({ x: 1 });
    expect(r.tools_used.map((t) => t.name)).toEqual(['fake']);
  });

  it('hits ITERATION_CAP when the model never emits a final answer', async () => {
    const transcript = Array.from(
      { length: ITERATION_CAP + 1 },
      (_, i) => [chunkToolCall(String(i), 'fake', {})],
    );
    const ai = fakeOpenAi(transcript);
    const r = await runAgent({
      openai: ai, question: 'q', history: [],
      onStatus: () => {}, onToken: () => {},
      tools: { fake: async () => ({}) } as any,
    });
    expect(r.status).toBe('iteration_cap');
  });

  it('hits TOKEN_BUDGET when cumulative usage exceeds budget', async () => {
    const ai = fakeOpenAi([[chunkToolCall('1','fake',{}, usage(TOKEN_BUDGET, 0))]]);
    const r = await runAgent({
      openai: ai, question: 'q', history: [],
      onStatus: () => {}, onToken: () => {},
      tools: { fake: async () => ({}) } as any,
    });
    expect(r.status).toBe('token_budget');
  });

  it('truncates a tool result that exceeds MAX_TOOL_BYTES', async () => {
    const big = { rows: Array.from({ length: 1000 }, (_, i) => ({ i, val: 'X'.repeat(50) })) };
    const ai = fakeOpenAi([
      [chunkToolCall('1','fake',{})],
      [chunkContent('Done.')],
    ]);
    const r = await runAgent({
      openai: ai, question: 'q', history: [],
      onStatus: () => {}, onToken: () => {},
      tools: { fake: async () => big } as any,
    });
    const used = r.tools_used[0];
    expect(used.result_bytes).toBeLessThanOrEqual(MAX_TOOL_BYTES);
  });

  it('returns tool_failed when a tool throws (non-SQL_REJECTED)', async () => {
    const ai = fakeOpenAi([[chunkToolCall('1','fake',{})]]);
    const r = await runAgent({
      openai: ai, question: 'q', history: [],
      onStatus: () => {}, onToken: () => {},
      tools: { fake: async () => { throw new Error('boom'); } } as any,
    });
    expect(r.status).toBe('tool_failed');
  });

  it('does NOT abort on SQL_REJECTED — feeds the rejection back to the model', async () => {
    const ai = fakeOpenAi([
      [chunkToolCall('1','run_safe_sql',{ query: 'DELETE x', reason: 'r' })],
      [chunkContent('Sorry, I can\'t do that.')],
    ]);
    const sqlErr = new Error('SQL_REJECTED: non_select');
    (sqlErr as any).code = 'SQL_REJECTED';
    const r = await runAgent({
      openai: ai, question: 'q', history: [],
      onStatus: () => {}, onToken: () => {},
      tools: { run_safe_sql: async () => { throw sqlErr; } } as any,
    });
    expect(r.status).toBe('ok');
    expect(r.answer).toMatch(/can't/i);
  });
});
