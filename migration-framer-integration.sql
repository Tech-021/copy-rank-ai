-- Framer Integration Migration
-- Add Framer connection table and article tracking columns

-- Framer connections table (per-user connections)
CREATE TABLE IF NOT EXISTS framer_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_url TEXT NOT NULL,
  api_key_encrypted TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_framer_project UNIQUE (user_id, project_url)
);

CREATE INDEX IF NOT EXISTS idx_framer_connections_user ON framer_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_framer_connections_active ON framer_connections(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_framer_connections_default ON framer_connections(user_id, is_default) WHERE is_default = true;

-- RLS: restrict access to own connections
ALTER TABLE framer_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Framer connections" ON framer_connections
  FOR SELECT USING (user_id IN (SELECT id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own Framer connections" ON framer_connections
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can update own Framer connections" ON framer_connections
  FOR UPDATE USING (user_id IN (SELECT id FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own Framer connections" ON framer_connections
  FOR DELETE USING (user_id IN (SELECT id FROM auth.users WHERE id = auth.uid()));

-- Add Framer tracking columns to articles table
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS framer_item_id TEXT,
  ADD COLUMN IF NOT EXISTS framer_url TEXT,
  ADD COLUMN IF NOT EXISTS framer_connection_id UUID REFERENCES framer_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_synced_to_framer TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_articles_framer ON articles(framer_connection_id, framer_item_id) WHERE framer_item_id IS NOT NULL;

-- Documentation
COMMENT ON TABLE framer_connections IS 'Stores per-user Framer project connections and encrypted API keys';
COMMENT ON COLUMN framer_connections.api_key_encrypted IS 'Encrypted Framer Server API key (aes-256-cbc)';
