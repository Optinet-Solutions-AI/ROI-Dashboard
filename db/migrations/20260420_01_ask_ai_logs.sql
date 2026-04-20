-- 20260420_01_ask_ai_logs.sql
-- Stores every Ask AI request for analytics + rate limiting.
-- Apply by pasting into the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.ask_ai_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        text NOT NULL,
  question          text NOT NULL,
  answer            text,
  status            text NOT NULL,
  error_code        text,
  tools_used        jsonb NOT NULL DEFAULT '[]'::jsonb,
  iterations        smallint NOT NULL DEFAULT 0,
  prompt_tokens     integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens      integer NOT NULL DEFAULT 0,
  duration_ms       integer NOT NULL,
  client_ip         inet,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ask_ai_logs_status_check CHECK (status IN (
    'ok','rate_limited','off_topic','iteration_cap',
    'token_budget','tool_failed','model_failed','sql_rejected'
  ))
);

CREATE INDEX IF NOT EXISTS idx_ask_logs_session_created
  ON public.ask_ai_logs (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ask_logs_created
  ON public.ask_ai_logs (created_at DESC);

ALTER TABLE public.ask_ai_logs ENABLE ROW LEVEL SECURITY;
-- No policies in phase 0 — writes go through the service role from /api/ask.
-- Phase 1 will add an auth.uid()-scoped SELECT policy.
