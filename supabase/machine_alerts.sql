-- ============================================================
-- TABLE: machine_alerts (Persistent Alert & Fault Tracking)
-- Run this in Supabase SQL Editor if you wish to store alerts
-- in your PostgreSQL database permanently.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.machine_alerts (
  id TEXT PRIMARY KEY,
  machine_code TEXT NOT NULL,
  error_code TEXT NOT NULL,
  details TEXT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_machine_alerts_code ON public.machine_alerts(machine_code);
CREATE INDEX IF NOT EXISTS idx_machine_alerts_resolved ON public.machine_alerts(resolved);

-- Enable RLS
ALTER TABLE public.machine_alerts ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access machine_alerts" ON public.machine_alerts;
CREATE POLICY "Service role full access machine_alerts"
  ON public.machine_alerts FOR ALL
  USING (true)
  WITH CHECK (true);
