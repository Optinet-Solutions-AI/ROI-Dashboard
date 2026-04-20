import { describe, it, expect, vi } from 'vitest';
import { checkRateLimit, SESSION_LIMIT, GLOBAL_LIMIT } from '../rateLimit.js';

function fakeSupabase(sessionCount: number, globalCount: number) {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: { session_count: sessionCount, global_count: globalCount, oldest_in_window: '2026-04-20T10:00:00Z' },
      error: null,
    }),
  } as any;
}

describe('checkRateLimit', () => {
  it('allows when both counts are below limits', async () => {
    const result = await checkRateLimit(fakeSupabase(29, 199), 'session-x');
    expect(result.allowed).toBe(true);
  });

  it('blocks when session count is exactly at the limit', async () => {
    const result = await checkRateLimit(fakeSupabase(SESSION_LIMIT, 100), 'session-x');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('session');
  });

  it('blocks when global count is exactly at the limit', async () => {
    const result = await checkRateLimit(fakeSupabase(5, GLOBAL_LIMIT), 'session-x');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('global');
  });

  it('blocks when both are at limit (reports session first)', async () => {
    const result = await checkRateLimit(fakeSupabase(SESSION_LIMIT, GLOBAL_LIMIT), 'session-x');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('session');
  });

  it('returns the cooldown timestamp when blocked', async () => {
    const result = await checkRateLimit(fakeSupabase(SESSION_LIMIT, 0), 'session-x');
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retry_at).toBeInstanceOf(Date);
    }
  });

  it('treats Supabase errors as fail-closed (block)', async () => {
    const broken = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
    } as any;
    const result = await checkRateLimit(broken, 'session-x');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('error');
  });
});
