-- 20260420_05_ask_ai_readonly_rls.sql
-- RLS fix for the Ask AI tool layer.
--
-- Migration 02 granted SELECT on performance_records to ask_ai_readonly,
-- but RLS is enabled on the table and the existing policies only target the
-- `anon` role. Result: every query the agent runs returns 0 rows even though
-- the underlying SELECT permission is fine.
--
-- This migration adds a single permissive SELECT policy scoped to
-- ask_ai_readonly. The role still cannot INSERT/UPDATE/DELETE because no
-- such grant exists, and it still cannot read ask_ai_logs (revoked in
-- migration 02).

DROP POLICY IF EXISTS ask_ai_readonly_select ON public.performance_records;

CREATE POLICY ask_ai_readonly_select
ON public.performance_records
FOR SELECT
TO ask_ai_readonly
USING (true);
