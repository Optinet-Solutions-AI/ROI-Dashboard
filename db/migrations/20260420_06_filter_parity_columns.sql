-- 20260420_06_filter_parity_columns.sql
-- Adds columns required to reach Excel ROI workbook filter parity.
-- Apply by pasting into the Supabase SQL Editor.

ALTER TABLE public.performance_records
  ADD COLUMN IF NOT EXISTS company_name        text,
  ADD COLUMN IF NOT EXISTS player_country      text,
  ADD COLUMN IF NOT EXISTS problematic_source  smallint,
  ADD COLUMN IF NOT EXISTS ftd_month           text;

CREATE INDEX IF NOT EXISTS idx_perf_company_name       ON public.performance_records (company_name);
CREATE INDEX IF NOT EXISTS idx_perf_player_country     ON public.performance_records (player_country);
CREATE INDEX IF NOT EXISTS idx_perf_problematic_source ON public.performance_records (problematic_source);
CREATE INDEX IF NOT EXISTS idx_perf_ftd_month          ON public.performance_records (ftd_month);
CREATE INDEX IF NOT EXISTS idx_perf_am                 ON public.performance_records (am);
CREATE INDEX IF NOT EXISTS idx_perf_source             ON public.performance_records (source);
CREATE INDEX IF NOT EXISTS idx_perf_period             ON public.performance_records (period);
