// api/_lib/db/logsClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { LogStatus, ToolUseRecord, ErrorCode } from '../types.js';

let client: SupabaseClient | null = null;

export function getLogsClient(): SupabaseClient {
  if (!client) {
    const url  = process.env.SUPABASE_URL;
    const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export type LogRow = {
  session_id:        string;
  question:          string;
  answer:            string | null;
  status:            LogStatus;
  error_code:        ErrorCode | null;
  tools_used:        ToolUseRecord[];
  iterations:        number;
  prompt_tokens:     number;
  completion_tokens: number;
  total_tokens:      number;
  duration_ms:       number;
  client_ip:         string | null;
};

export async function insertLog(row: LogRow): Promise<{ id: string }> {
  const supabase = getLogsClient();
  const { data, error } = await supabase
    .from('ask_ai_logs')
    .insert(row)
    .select('id')
    .single();
  if (error || !data) throw new Error(`insertLog failed: ${error?.message ?? 'no data'}`);
  return { id: data.id as string };
}
