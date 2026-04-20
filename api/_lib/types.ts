// api/_lib/types.ts
// Types shared across the API code AND copied to frontend in Task 22.
// Keep this file dependency-free.

export type Dim =
  | 'affiliate_id' | 'affiliate_name' | 'country' | 'campaign'
  | 'brand'        | 'am'             | 'source';

export type Metric =
  | 'revenue' | 'cost' | 'profit' | 'roi' | 'ftds' | 'clicks'
  | 'registrations' | 'cpa' | 'conversion_rate'
  | 'casino_real_ngr' | 'sb_real_ngr' | 'flats_and_adjustments';

export type Filters = {
  affiliate_id?:   string | string[];
  affiliate_name?: string | string[];
  country?:        string | string[];
  campaign?:       string | string[];
  brand?:          string | string[];
  am?:             string | string[];
  source?:         string | string[];
  period?:         string | string[];
  date_from?:      string;   // 'YYYY-MM-DD'
  date_to?:        string;   // 'YYYY-MM-DD'
};

export type ErrorCode =
  | 'RATE_LIMITED' | 'OFF_TOPIC' | 'ITERATION_CAP' | 'TOKEN_BUDGET'
  | 'TOOL_FAILED'  | 'MODEL_FAILED' | 'SQL_REJECTED';

export type LogStatus =
  | 'ok' | 'rate_limited' | 'off_topic' | 'iteration_cap'
  | 'token_budget' | 'tool_failed' | 'model_failed' | 'sql_rejected';

export type ToolUseRecord = {
  name: string;
  args: unknown;
  result_bytes: number;
  ms: number;
};

export type ChatTurn = { role: 'user' | 'assistant'; text: string };

export type AskRequest = {
  question: string;
  history?: ChatTurn[];
};

export type DonePayload = {
  answer: string;
  tools_used: string[];
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  duration_ms: number;
  log_id: string;
};

export type SseEvent =
  | { type: 'status'; data: { message: string } }
  | { type: 'token';  data: { delta: string } }
  | { type: 'done';   data: DonePayload }
  | { type: 'error';  data: { code: ErrorCode; message: string } };
