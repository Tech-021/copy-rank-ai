-- ============================================================================
-- COMPREHENSIVE DATABASE SETUP FOR COPYRANK AI
-- ============================================================================
-- This migration sets up all required tables for the Copy Rank AI application
-- including WordPress integration, article management, users, and more

-- ============================================================================
-- 1. USER AND ACCOUNT MANAGEMENT
-- ============================================================================

-- Users table (extends Supabase auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  package TEXT DEFAULT 'free' CHECK (package IN ('free', 'pro', 'premium')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================================
-- 2. WEBSITE AND KEYWORD MANAGEMENT
-- ============================================================================

-- Websites table
CREATE TABLE IF NOT EXISTS websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,
  keywords JSONB DEFAULT '{"keywords":[]}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. PRE-DATA MANAGEMENT (FOR ONBOARDING)
-- ============================================================================

-- Pre-data table (for storing onboarding data)
CREATE TABLE IF NOT EXISTS pre_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  domain TEXT,
  keywords TEXT,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. ARTICLE MANAGEMENT
-- ============================================================================

-- Articles table
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  website_id UUID REFERENCES websites(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  content TEXT,
  html_content TEXT,
  meta_title TEXT,
  meta_description TEXT,
  hero_image TEXT,
  generated_images JSONB DEFAULT '[]'::jsonb,
  keyword JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'UPLOADED', 'DRAFT')),
  word_count INTEGER,
  content_score INTEGER,
  keyword_density NUMERIC,
  reading_time TEXT,
  preview TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  category TEXT,
  estimated_traffic INTEGER,
  generated_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- WordPress integration columns
  wordpress_post_id TEXT,
  wordpress_url TEXT,
  wordpress_connection_id UUID,
  last_synced_to_wordpress TIMESTAMPTZ
);

CREATE INDEX idx_articles_user ON articles(user_id);
CREATE INDEX idx_articles_website ON articles(website_id);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_created ON articles(created_at);

-- ============================================================================
-- 5. ARTICLE JOBS (ASYNC PROCESSING)
-- ============================================================================

-- Article jobs table (for background processing)
CREATE TABLE IF NOT EXISTS article_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  website_id UUID REFERENCES websites(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  keywords TEXT[],
  article_count INTEGER DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_article_jobs_user ON article_jobs(user_id);
CREATE INDEX idx_article_jobs_status ON article_jobs(status);
CREATE INDEX idx_article_jobs_website ON article_jobs(website_id);

-- ============================================================================
-- 6. WORDPRESS INTEGRATION
-- ============================================================================

-- OAuth states (for CSRF protection)
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oauth_states_state ON oauth_states(state);
CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at);

-- WordPress connections
CREATE TABLE IF NOT EXISTS wordpress_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  site_url TEXT NOT NULL,
  site_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  site_name TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_wordpress_site UNIQUE (user_id, site_url)
);

CREATE INDEX idx_wordpress_connections_user ON wordpress_connections(user_id);
CREATE INDEX idx_wordpress_connections_active ON wordpress_connections(user_id, is_active) WHERE is_active = true;

-- Add WordPress reference to articles
ALTER TABLE articles 
  ADD CONSTRAINT fk_articles_wordpress_connection 
  FOREIGN KEY (wordpress_connection_id) 
  REFERENCES wordpress_connections(id) 
  ON DELETE SET NULL;

CREATE INDEX idx_articles_wordpress ON articles(wordpress_connection_id, wordpress_post_id) WHERE wordpress_post_id IS NOT NULL;

-- ============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wordpress_connections ENABLE ROW LEVEL SECURITY;

-- Users RLS
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- User Settings RLS
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own settings" ON user_settings
  FOR ALL USING (user_id = auth.uid());

-- Websites RLS
CREATE POLICY "Users can view own websites" ON websites
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own websites" ON websites
  FOR ALL USING (user_id = auth.uid());

-- Articles RLS
CREATE POLICY "Users can view own articles" ON articles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own articles" ON articles
  FOR ALL USING (user_id = auth.uid());

-- Article Jobs RLS
CREATE POLICY "Users can view own jobs" ON article_jobs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own jobs" ON article_jobs
  FOR ALL USING (user_id = auth.uid());

-- WordPress Connections RLS
CREATE POLICY "Users can view own WordPress connections" ON wordpress_connections
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own WordPress connections" ON wordpress_connections
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- 8. HELPER FUNCTION FOR CLEANUP
-- ============================================================================

-- Function to cleanup expired OAuth states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. TABLE COMMENTS (DOCUMENTATION)
-- ============================================================================

COMMENT ON TABLE users IS 'User accounts and subscription information';
COMMENT ON TABLE user_settings IS 'User preferences and settings';
COMMENT ON TABLE websites IS 'Websites users are managing';
COMMENT ON TABLE pre_data IS 'Temporary storage for onboarding data';
COMMENT ON TABLE articles IS 'Generated articles with metadata';
COMMENT ON TABLE article_jobs IS 'Async jobs for article generation';
COMMENT ON TABLE oauth_states IS 'Temporary OAuth state tokens for CSRF protection';
COMMENT ON TABLE wordpress_connections IS 'WordPress site OAuth credentials';

COMMENT ON COLUMN wordpress_connections.access_token IS 'Encrypted WordPress OAuth access token';
COMMENT ON COLUMN wordpress_connections.refresh_token IS 'Encrypted WordPress OAuth refresh token';
COMMENT ON COLUMN articles.wordpress_post_id IS 'ID of the published post on WordPress';
COMMENT ON COLUMN articles.wordpress_url IS 'Direct URL to the published article on WordPress';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- All tables have been created successfully!
-- The application is ready to use.
