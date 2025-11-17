-- Add geospatial indexes for efficient distance queries
-- Requires cube and earthdistance extensions (created in 000_initial.sql)

-- GIST index for geospatial queries using earthdistance
CREATE INDEX IF NOT EXISTS idx_restaurants_location_gist ON restaurants 
  USING GIST (ll_to_earth(latitude::float, longitude::float));

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_restaurants_price_rating ON restaurants 
  (price_level, google_rating) 
  WHERE is_active = true AND price_level IS NOT NULL AND google_rating IS NOT NULL;

-- GIN index for array overlap queries (cuisine filtering)
CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine_gin ON restaurants 
  USING GIN (cuisine_tags) 
  WHERE is_active = true AND cuisine_tags IS NOT NULL;

-- Index for active restaurants (already exists but ensure it's there)
CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants (is_active) 
  WHERE is_active = true;

