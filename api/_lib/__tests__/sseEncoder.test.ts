import { describe, it, expect } from 'vitest';
import { encodeSse } from '../sseEncoder.js';

describe('encodeSse', () => {
  it('formats a status event as a named SSE frame with JSON payload', () => {
    const out = encodeSse({ type: 'status', data: { message: 'Hi' } });
    expect(out).toBe('event: status\ndata: {"message":"Hi"}\n\n');
  });

  it('formats a token event', () => {
    const out = encodeSse({ type: 'token', data: { delta: 'Hello ' } });
    expect(out).toBe('event: token\ndata: {"delta":"Hello "}\n\n');
  });

  it('formats a done event', () => {
    const out = encodeSse({
      type: 'done',
      data: {
        answer: 'X', tools_used: ['get_kpi_summary'],
        prompt_tokens: 10, completion_tokens: 5, total_tokens: 15,
        duration_ms: 100, log_id: 'abc',
      },
    });
    expect(out).toContain('event: done\n');
    expect(out).toMatch(/^event: done\ndata: \{.*\}\n\n$/);
    expect(JSON.parse(out.split('data: ')[1])).toMatchObject({ log_id: 'abc' });
  });

  it('formats an error event', () => {
    const out = encodeSse({
      type: 'error',
      data: { code: 'RATE_LIMITED', message: 'Slow down' },
    });
    expect(out).toBe('event: error\ndata: {"code":"RATE_LIMITED","message":"Slow down"}\n\n');
  });

  it('escapes newlines inside the JSON payload', () => {
    const out = encodeSse({ type: 'token', data: { delta: 'line1\nline2' } });
    expect(out).toBe('event: token\ndata: {"delta":"line1\\nline2"}\n\n');
  });
});
