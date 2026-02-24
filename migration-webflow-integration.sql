-- Webflow Integration Migration
-- Add Webflow connection table and article tracking columns

-- Webflow connections table (per-user connections)
CREATE TABLE IF NOT EXISTS webflow_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  site_id TEXT NOT NULL,
  collection_id TEXT,
  site_name TEXT,
  api_key_encrypted TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_webflow_site UNIQUE (user_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_webflow_connections_user ON webflow_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_webflow_connections_active ON webflow_connections(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_webflow_connections_default ON webflow_connections(user_id, is_default) WHERE is_default = true;

-- RLS: restrict access to own connections
ALTER TABLE webflow_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Webflow connections" ON webflow_connections
  FOR SELECT USING (user_id IN (SELECT id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own Webflow connections" ON webflow_connections
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can update own Webflow connections" ON webflow_connections
  FOR UPDATE USING (user_id IN (SELECT id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own Webflow connections" ON webflow_connections
  FOR DELETE USING (user_id IN (SELECT id FROM auth.users WHERE id = auth.uid()));

-- Add Webflow tracking columns to articles table
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS webflow_item_id TEXT,
  ADD COLUMN IF NOT EXISTS webflow_url TEXT,
  ADD COLUMN IF NOT EXISTS webflow_connection_id UUID REFERENCES webflow_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_synced_to_webflow TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_articles_webflow ON articles(webflow_connection_id, webflow_item_id) WHERE webflow_item_id IS NOT NULL;

-- Documentation
COMMENT ON TABLE webflow_connections IS 'Stores per-user Webflow site connections and encrypted API keys';
COMMENT ON COLUMN webflow_connections.api_key_encrypted IS 'Encrypted Webflow API token (aes-256-cbc)';