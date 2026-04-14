-- Add backdrop season column to stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS backdrop_season TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN stores.backdrop_season IS 'Season lighting mood for backdrop: primavera, verao, outono, inverno';
