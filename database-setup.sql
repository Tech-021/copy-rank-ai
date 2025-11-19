-- ============================================
-- Article Jobs Queue Table Setup
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- This creates the table needed for the article generation queue system

-- Create article_jobs table
CREATE TABLE IF NOT EXISTS article_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keywords JSONB NOT NULL,
  article_number INTEGER NOT NULL,
  total_articles INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_article_jobs_status ON article_jobs(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_article_jobs_website ON article_jobs(website_id);
CREATE INDEX IF NOT EXISTS idx_article_jobs_user ON article_jobs(user_id);

-- Enable Row Level Security
ALTER TABLE article_jobs ENABLE ROW LEVEL SECURITY;

-- Create policy for service role (allows API to manage all jobs)
CREATE POLICY "Service role can manage all jobs" ON article_jobs
  FOR ALL USING (true);

-- Optional: Create policy for users to view their own jobs
-- Uncomment if you want users to query their own jobs from frontend
-- CREATE POLICY "Users can view their own jobs" ON article_jobs
--   FOR SELECT USING (auth.uid() = user_id);

