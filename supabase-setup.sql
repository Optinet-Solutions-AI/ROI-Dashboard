-- =============================================================================
-- ROI Dashboard — Supabase Setup
-- Run this script once in the Supabase SQL Editor to create the required table.
-- =============================================================================

-- Create the performance_records table
CREATE TABLE IF NOT EXISTS public.performance_records (
  id                    bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  affiliate_id          text,
  affiliate_name        text,
  country               text,
  campaign              text,
  brand                 text,
  am                    text,
  source                text,
  period                text,         -- stored as text to handle both string and numeric periods
  date                  text,         -- stored as text (ISO YYYY-MM-DD or Excel serial converted)
  clicks                numeric,
  registrations         numeric,
  ftds                  numeric,
  revenue               numeric,
  cost                  numeric,
  casino_real_ngr       numeric,
  sb_real_ngr           numeric,
  flats_and_adjustments numeric,
  created_at            timestamptz   DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.performance_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running this script
DROP POLICY IF EXISTS "Allow anon select"  ON public.performance_records;
DROP POLICY IF EXISTS "Allow anon insert"  ON public.performance_records;
DROP POLICY IF EXISTS "Allow anon delete"  ON public.performance_records;

-- Allow the anon key (used by the frontend) to read, insert, and delete records.
-- Tighten these policies with auth.uid() checks if you add user authentication later.
CREATE POLICY "Allow anon select"
  ON public.performance_records
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert"
  ON public.performance_records
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon delete"
  ON public.performance_records
  FOR DELETE
  TO anon
  USING (true);

-- Optional: index on commonly filtered columns
CREATE INDEX IF NOT EXISTS idx_perf_affiliate_id ON public.performance_records (affiliate_id);
CREATE INDEX IF NOT EXISTS idx_perf_brand        ON public.performance_records (brand);
CREATE INDEX IF NOT EXISTS idx_perf_country      ON public.performance_records (country);
CREATE INDEX IF NOT EXISTS idx_perf_date         ON public.performance_records (date);
