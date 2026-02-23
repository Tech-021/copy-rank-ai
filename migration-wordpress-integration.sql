-- WordPress Integration Migration
-- Add WordPress connection and publishing support

-- Create oauth_states table for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oauth_states_state ON oauth_states(state);
CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at);

-- WordPress connections table
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

-- Indexes for WordPress connections
CREATE INDEX idx_wordpress_connections_user ON wordpress_connections(user_id);
CREATE INDEX idx_wordpress_connections_active ON wordpress_connections(user_id, is_active) WHERE is_active = true;

-- Add WordPress tracking columns to articles table
ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS wordpress_post_id TEXT,
  ADD COLUMN IF NOT EXISTS wordpress_url TEXT,
  ADD COLUMN IF NOT EXISTS wordpress_connection_id UUID REFERENCES wordpress_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_synced_to_wordpress TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_articles_wordpress ON articles(wordpress_connection_id, wordpress_post_id) WHERE wordpress_post_id IS NOT NULL;

-- RLS Policies for WordPress connections
ALTER TABLE wordpress_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own WordPress connections" ON wordpress_connections
  FOR SELECT USING (user_id IN (SELECT id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own WordPress connections" ON wordpress_connections
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can update own WordPress connections" ON wordpress_connections
  FOR UPDATE USING (user_id IN (SELECT id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own WordPress connections" ON wordpress_connections
  FOR DELETE USING (user_id IN (SELECT id FROM auth.users WHERE id = auth.uid()));

-- RLS Policies for oauth_states (service role only)
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Auto-cleanup function for expired oauth states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE wordpress_connections IS 'Stores WordPress site OAuth credentials and connection info';
COMMENT ON TABLE oauth_states IS 'Temporary storage for OAuth state tokens (CSRF protection)';
COMMENT ON COLUMN wordpress_connections.access_token IS 'Encrypted WordPress OAuth access token';
COMMENT ON COLUMN wordpress_connections.refresh_token IS 'Encrypted WordPress OAuth refresh token';
