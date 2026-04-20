import type { SupabaseClient } from '@supabase/supabase-js';

export const SESSION_LIMIT = 30;
export const GLOBAL_LIMIT  = 200;
export const WINDOW_MINUTES = 60;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: 'session' | 'global' | 'error'; retry_at?: Date };

export async function checkRateLimit(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('ask_ai_count_window', {
    p_session_id: sessionId,
    p_window_minutes: WINDOW_MINUTES,
  });

  if (error || !data) {
    return { allowed: false, reason: 'error' };
  }

  const sessionCount = Number(data.session_count ?? 0);
  const globalCount  = Number(data.global_count  ?? 0);
  const oldest       = data.oldest_in_window ? new Date(data.oldest_in_window) : undefined;
  const retry_at     = oldest
    ? new Date(oldest.getTime() + WINDOW_MINUTES * 60_000)
    : undefined;

  if (sessionCount >= SESSION_LIMIT) {
    return { allowed: false, reason: 'session', retry_at };
  }
  if (globalCount >= GLOBAL_LIMIT) {
    return { allowed: false, reason: 'global', retry_at };
  }
  return { allowed: true };
}
