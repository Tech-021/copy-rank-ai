-- Migration: create pre_data table for webhook staging
-- Run this in your Postgres / Supabase database

-- enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.pre_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  website text,
  competitors jsonb,
  keywords jsonb,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pre_data_website_idx ON public.pre_data (website);
