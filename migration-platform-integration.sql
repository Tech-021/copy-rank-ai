-- ============================================
-- Websites Table for Platform Integration
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- This enables users to connect their WordPress/CMS sites
-- for automatic article publishing

-- Create websites table
CREATE TABLE IF NOT EXISTS websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  platform TEXT DEFAULT 'wordpress' CHECK (platform IN ('wordpress', 'webflow', 'ghost', 'custom')),
  
  -- Encrypted credentials
  api_username TEXT,
  api_password_encrypted TEXT,
  api_key_encrypted TEXT,
  
  -- Connection status
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_website_url UNIQUE (user_id, url)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_websites_user ON websites(user_id);
CREATE INDEX IF NOT EXISTS idx_websites_active ON websites(user_id, is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own websites" ON websites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own websites" ON websites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own websites" ON websites
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own websites" ON websites
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can manage all websites (for server-side operations)
CREATE POLICY "Service role can manage all websites" ON websites
  FOR ALL USING (true);

-- ============================================
-- Add external_post_id to articles table
-- ============================================
-- Track which WordPress post ID corresponds to each article

ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS external_post_id TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_articles_external_post ON articles(website_id, external_post_id) WHERE external_post_id IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN articles.external_post_id IS 'WordPress/CMS post ID after publishing to external platform';
COMMENT ON COLUMN articles.external_url IS 'Full URL of the published post on external platform';
COMMENT ON COLUMN articles.last_synced_at IS 'Last time this article was synced to external platform';

-- ============================================
-- Publishing Logs Table (Optional but recommended)
-- ============================================
-- Track all publishing attempts for debugging

CREATE TABLE IF NOT EXISTS publishing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  action TEXT NOT NULL CHECK (action IN ('publish', 'update', 'delete', 'sync')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  
  external_post_id TEXT,
  external_url TEXT,
  
  error_message TEXT,
  request_data JSONB,
  response_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_publishing_logs_article ON publishing_logs(article_id);
CREATE INDEX IF NOT EXISTS idx_publishing_logs_website ON publishing_logs(website_id);
CREATE INDEX IF NOT EXISTS idx_publishing_logs_user ON publishing_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_publishing_logs_status ON publishing_logs(status, created_at DESC);

-- Enable RLS
ALTER TABLE publishing_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own logs" ON publishing_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all logs" ON publishing_logs
  FOR ALL USING (true);

-- ============================================
-- Useful Views
-- ============================================

-- View: Articles with sync status
CREATE OR REPLACE VIEW articles_with_sync_status AS
SELECT 
  a.*,
  w.name as website_name,
  w.url as website_url,
  w.platform,
  CASE 
    WHEN a.external_post_id IS NOT NULL THEN 'synced'
    WHEN a.status = 'published' THEN 'ready_to_sync'
    ELSE 'not_published'
  END as sync_status,
  a.last_synced_at,
  a.external_url
FROM articles a
LEFT JOIN websites w ON a.website_id = w.id;

-- View: Publishing stats per user
CREATE OR REPLACE VIEW user_publishing_stats AS
SELECT 
  user_id,
  COUNT(DISTINCT website_id) as total_websites,
  COUNT(*) as total_articles,
  COUNT(CASE WHEN external_post_id IS NOT NULL THEN 1 END) as synced_articles,
  COUNT(CASE WHEN status = 'published' AND external_post_id IS NULL THEN 1 END) as pending_sync,
  MAX(last_synced_at) as last_sync
FROM articles
GROUP BY user_id;

-- ============================================
-- Helper Functions
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for websites table
DROP TRIGGER IF EXISTS update_websites_updated_at ON websites;
CREATE TRIGGER update_websites_updated_at
  BEFORE UPDATE ON websites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Sample Data (for testing)
-- ============================================

-- Uncomment to insert sample website for testing
-- INSERT INTO websites (user_id, name, url, platform, api_username)
-- VALUES (
--   auth.uid(),
--   'My WordPress Site',
--   'https://example.com',
--   'wordpress',
--   'admin'
-- );
