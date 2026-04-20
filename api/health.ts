// Minimal smoke-test endpoint. If this 200s but /api/ask 500s, the problem
// is in ask.ts or one of its bundled dependencies — not the Vercel runtime.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  // Surface the hostname (no password!) of the readonly DB URL so we can
  // verify Vercel is reading the value we set, not a cached one.
  let readonly_host: string | null = null;
  let readonly_port: string | null = null;
  let readonly_user: string | null = null;
  try {
    const u = new URL(process.env.ASK_AI_READONLY_DATABASE_URL ?? '');
    readonly_host = u.hostname;
    readonly_port = u.port;
    readonly_user = u.username;
  } catch { /* unset or unparseable */ }

  res.status(200).json({
    ok: true,
    ts: Date.now(),
    node: process.version,
    has_openai_key:   !!process.env.OPENAI_API_KEY,
    has_supabase_url: !!process.env.SUPABASE_URL,
    has_supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    has_readonly_url: !!process.env.ASK_AI_READONLY_DATABASE_URL,
    readonly_host, readonly_port, readonly_user,
  });
}
