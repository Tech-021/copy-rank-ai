-- Add missing website columns for onboarding
ALTER TABLE websites
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS competitors jsonb,
  ADD COLUMN IF NOT EXISTS total_competitors int4 DEFAULT 0;
