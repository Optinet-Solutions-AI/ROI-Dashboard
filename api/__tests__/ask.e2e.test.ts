// api/__tests__/ask.e2e.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all deps
vi.mock('../_lib/db/logsClient.js', () => ({
  getLogsClient: () => ({}),
  insertLog: vi.fn().mockResolvedValue({ id: 'log-uuid' }),
}));
vi.mock('../_lib/rateLimit.js', async () => ({
  ...(await vi.importActual<any>('../_lib/rateLimit.js')),
  checkRateLimit: vi.fn(),
}));
vi.mock('../_lib/safety/relevanceGuard.js', () => ({
  runRelevanceGuard: vi.fn(),
}));
vi.mock('../_lib/agent.js', () => ({
  runAgent: vi.fn(),
}));
vi.mock('openai', () => ({
  default: class { constructor() {} },
}));

import handler from '../ask.js';
import { checkRateLimit } from '../_lib/rateLimit.js';
import { runRelevanceGuard } from '../_lib/safety/relevanceGuard.js';
import { runAgent } from '../_lib/agent.js';

function fakeReq(body: any, headers: Record<string,string> = {}) {
  return { method: 'POST', body, headers: { 'x-session-id': 's1', ...headers } } as any;
}
function fakeRes() {
  const chunks: string[] = [];
  return {
    statusCode: 200,
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: (s: string) => { chunks.push(s); return true; },
    end: vi.fn(),
    status(code: number) { (this as any).statusCode = code; return this; },
    json(obj: any) { chunks.push(JSON.stringify(obj)); },
    chunks,
  } as any;
}

beforeEach(() => {
  (checkRateLimit as any).mockReset();
  (runRelevanceGuard as any).mockReset();
  (runAgent as any).mockReset();
});

describe('/api/ask', () => {
  it('streams status → token → done on a successful run', async () => {
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
    (runRelevanceGuard as any).mockResolvedValue({ verdict: 'on_topic', tokens: 50 });
    (runAgent as any).mockImplementation(async (input: any) => {
      input.onStatus('Crunching the numbers…');
      input.onToken('Revenue ');
      input.onToken('is $100K.');
      return {
        status: 'ok', answer: 'Revenue is $100K.',
        tools_used: [{ name: 'get_kpi_summary', args: '{}', result_bytes: 100, ms: 50 }],
        iterations: 1, prompt_tokens: 100, completion_tokens: 20, total_tokens: 120,
      };
    });

    const req = fakeReq({ question: 'Revenue?' });
    const res = fakeRes();
    await handler(req, res);

    const out = res.chunks.join('');
    expect(out).toContain('event: status');
    expect(out).toContain('event: token');
    expect(out).toContain('event: done');
    expect(out).toContain('"log_id":"log-uuid"');
  });

  it('emits RATE_LIMITED when rate limit blocks', async () => {
    (checkRateLimit as any).mockResolvedValue({
      allowed: false, reason: 'session', retry_at: new Date('2026-04-20T11:00:00Z'),
    });
    const req = fakeReq({ question: 'q' });
    const res = fakeRes();
    await handler(req, res);
    const out = res.chunks.join('');
    expect(out).toMatch(/event: error[\s\S]*RATE_LIMITED/);
  });

  it('emits OFF_TOPIC when relevance guard rejects', async () => {
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
    (runRelevanceGuard as any).mockResolvedValue({ verdict: 'off_topic', tokens: 30 });
    const req = fakeReq({ question: 'write a poem' });
    const res = fakeRes();
    await handler(req, res);
    const out = res.chunks.join('');
    expect(out).toMatch(/event: error[\s\S]*OFF_TOPIC/);
  });

  it('emits ITERATION_CAP when agent returns iteration_cap', async () => {
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
    (runRelevanceGuard as any).mockResolvedValue({ verdict: 'on_topic', tokens: 50 });
    (runAgent as any).mockResolvedValue({
      status: 'iteration_cap', answer: '', tools_used: [], iterations: 5,
      prompt_tokens: 200, completion_tokens: 100, total_tokens: 300,
    });
    const req = fakeReq({ question: 'q' });
    const res = fakeRes();
    await handler(req, res);
    const out = res.chunks.join('');
    expect(out).toMatch(/event: error[\s\S]*ITERATION_CAP/);
  });

  it('rejects requests with no x-session-id', async () => {
    const req = fakeReq({ question: 'q' }, { 'x-session-id': '' });
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects empty questions', async () => {
    const req = fakeReq({ question: '' });
    const res = fakeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
});
