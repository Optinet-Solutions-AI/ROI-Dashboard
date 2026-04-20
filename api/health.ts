// Minimal smoke-test endpoint. If this 200s but /api/ask 500s, the problem
// is in ask.ts or one of its bundled dependencies — not the Vercel runtime.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    ts: Date.now(),
    node: process.version,
    has_openai_key:   !!process.env.OPENAI_API_KEY,
    has_supabase_url: !!process.env.SUPABASE_URL,
    has_supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    has_readonly_url: !!process.env.ASK_AI_READONLY_DATABASE_URL,
  });
}
