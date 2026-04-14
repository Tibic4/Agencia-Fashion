-- Migration: Add backdrop reference columns to stores table
-- These columns store the AI-generated studio backdrop image used as visual
-- reference for VTO generation, ensuring consistent backgrounds across photos.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS backdrop_ref_url TEXT DEFAULT NULL;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS backdrop_color TEXT DEFAULT NULL;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS backdrop_updated_at TIMESTAMPTZ DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN stores.backdrop_ref_url IS 'Public URL of the AI-generated empty studio backdrop image';
COMMENT ON COLUMN stores.backdrop_color IS 'Hex color used to generate the current backdrop (e.g. #7B2EBF)';
COMMENT ON COLUMN stores.backdrop_updated_at IS 'Timestamp of last backdrop generation (30-day cooldown for manual regeneration)';
