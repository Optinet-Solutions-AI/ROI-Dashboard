-- 20260420_02_ask_ai_readonly_role.sql
-- Dedicated low-privilege role used by the Ask AI tool layer.
-- Replace <PASSWORD_FROM_VAULT> with a generated password before running.
-- After running, store that password in Vercel as ASK_AI_READONLY_DATABASE_URL
-- (full Postgres URL with this role + password).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ask_ai_readonly') THEN
    CREATE ROLE ask_ai_readonly LOGIN PASSWORD '<PASSWORD_FROM_VAULT>';
  END IF;
END$$;

REVOKE ALL ON SCHEMA public FROM ask_ai_readonly;
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM ask_ai_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ask_ai_readonly;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ask_ai_readonly;

GRANT CONNECT ON DATABASE postgres                  TO ask_ai_readonly;
GRANT USAGE   ON SCHEMA public                      TO ask_ai_readonly;
GRANT SELECT  ON public.performance_records         TO ask_ai_readonly;

ALTER ROLE ask_ai_readonly SET statement_timeout = '5s';
ALTER ROLE ask_ai_readonly SET idle_in_transaction_session_timeout = '5s';

-- Make sure ask_ai_logs is NOT readable by this role.
REVOKE ALL ON public.ask_ai_logs FROM ask_ai_readonly;
