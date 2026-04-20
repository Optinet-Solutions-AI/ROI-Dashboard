// Mirrors api/_lib/types.ts (kept in sync manually for phase 0).
export type ErrorCode =
  | 'RATE_LIMITED' | 'OFF_TOPIC' | 'ITERATION_CAP' | 'TOKEN_BUDGET'
  | 'TOOL_FAILED'  | 'MODEL_FAILED' | 'SQL_REJECTED';

export type DonePayload = {
  answer: string;
  tools_used: string[];
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  duration_ms: number;
  log_id: string;
};

export type ChatTurn = { role: 'user' | 'assistant'; text: string };

export type Message =
  | { role: 'user';            text: string; ts: number }
  | { role: 'assistant';       text: string; tools_used: string[];
      prompt_tokens: number; completion_tokens: number; total_tokens: number;
      duration_ms: number; log_id: string; ts: number }
  | { role: 'assistant_error'; code: ErrorCode; message: string; ts: number };

export type StreamEvent =
  | { type: 'status'; message: string }
  | { type: 'token';  delta: string }
  | { type: 'done';   payload: DonePayload }
  | { type: 'error';  code: ErrorCode; message: string };
