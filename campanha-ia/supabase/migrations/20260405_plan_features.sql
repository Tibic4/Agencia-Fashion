-- =====================================================
-- Migration: Add plan features columns and API keys table
-- CriaLook - Plan differentiation features
-- =====================================================

-- 1. Add regen_count and preview_token to campaigns
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS regen_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS preview_token TEXT DEFAULT NULL;

-- Index for preview token lookups (public preview page)
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_preview_token 
ON campaigns (preview_token) WHERE preview_token IS NOT NULL;

-- 2. Create API keys table (for Agência plan)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Chave API',
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for API key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_store_id ON api_keys (store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash);

-- 3. Add credit columns to stores (if not exist)
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS credit_campaigns INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_models INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_regenerations INTEGER DEFAULT 0;

-- 4. RLS for api_keys (admin only via service_role)
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access
CREATE POLICY IF NOT EXISTS "service_role_full_access" ON api_keys
  FOR ALL USING (true) WITH CHECK (true);
