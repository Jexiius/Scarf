CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  name TEXT,
  default_latitude NUMERIC(10,8),
  default_longitude NUMERIC(11,8),
  default_city TEXT,
  taste_profile JSONB,
  favorite_cuisines TEXT[],
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  subscription_starts_at TIMESTAMP WITH TIME ZONE,
  subscription_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE,
  last_active_at TIMESTAMP WITH TIME ZONE,
  query_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS saved_restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  notes TEXT,
  tags TEXT[],
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  personal_rating INTEGER,
  visited BOOLEAN NOT NULL DEFAULT false,
  visited_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT saved_restaurants_user_restaurant_unique UNIQUE (user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS saved_restaurants_user_idx ON saved_restaurants(user_id);
CREATE INDEX IF NOT EXISTS saved_restaurants_restaurant_idx ON saved_restaurants(restaurant_id);

CREATE TABLE IF NOT EXISTS user_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  query_text TEXT NOT NULL,
  parsed_query JSONB,
  filters_applied JSONB,
  search_latitude NUMERIC(10,7),
  search_longitude NUMERIC(10,7),
  search_radius_miles NUMERIC(5,2),
  results_returned JSONB,
  selected_restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  selection_position INTEGER,
  time_to_selection INTEGER,
  user_rating INTEGER,
  user_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_queries_user_idx ON user_queries(user_id);
CREATE INDEX IF NOT EXISTS user_queries_created_idx ON user_queries(created_at);
