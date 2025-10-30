CREATE TABLE IF NOT EXISTS feature_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  features JSONB NOT NULL,
  extraction_confidence NUMERIC(3,2),
  model_used TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  extracted_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  tokens_used INTEGER,
  cost_usd NUMERIC(10,6),
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT feature_extractions_review_id_unique UNIQUE (review_id)
);

CREATE INDEX IF NOT EXISTS feature_extractions_restaurant_idx
  ON feature_extractions (restaurant_id);

CREATE INDEX IF NOT EXISTS feature_extractions_extracted_idx
  ON feature_extractions (extracted_at);
