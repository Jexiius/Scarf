ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS default_latitude NUMERIC(10,8),
  ADD COLUMN IF NOT EXISTS default_longitude NUMERIC(11,8),
  ADD COLUMN IF NOT EXISTS default_city TEXT,
  ADD COLUMN IF NOT EXISTS taste_profile JSONB,
  ADD COLUMN IF NOT EXISTS favorite_cuisines TEXT[],
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS query_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
  ALTER COLUMN subscription_tier TYPE TEXT,
  ALTER COLUMN subscription_tier SET DEFAULT 'free',
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE IF EXISTS saved_restaurants
  ADD COLUMN IF NOT EXISTS personal_rating INTEGER,
  ADD COLUMN IF NOT EXISTS visited BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visited_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE IF EXISTS user_queries
  ALTER COLUMN user_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS user_queries_user_id_fkey,
  ADD CONSTRAINT user_queries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS results_returned JSONB,
  ADD COLUMN IF NOT EXISTS selected_restaurant_id UUID,
  ADD COLUMN IF NOT EXISTS selection_position INTEGER,
  ADD COLUMN IF NOT EXISTS time_to_selection INTEGER,
  ADD COLUMN IF NOT EXISTS user_rating INTEGER,
  ADD COLUMN IF NOT EXISTS user_feedback TEXT;

ALTER TABLE IF EXISTS user_queries
  DROP CONSTRAINT IF EXISTS user_queries_selected_restaurant_id_fkey;

ALTER TABLE IF EXISTS user_queries
  ADD CONSTRAINT user_queries_selected_restaurant_id_fkey FOREIGN KEY (selected_restaurant_id)
    REFERENCES restaurants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS saved_restaurants_user_idx ON saved_restaurants(user_id);
CREATE INDEX IF NOT EXISTS saved_restaurants_restaurant_idx ON saved_restaurants(restaurant_id);
