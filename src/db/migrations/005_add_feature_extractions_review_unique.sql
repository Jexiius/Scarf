ALTER TABLE feature_extractions
  DROP CONSTRAINT IF EXISTS feature_extractions_review_unique;

ALTER TABLE feature_extractions
  DROP CONSTRAINT IF EXISTS feature_extractions_review_id_unique;

ALTER TABLE feature_extractions
  ADD CONSTRAINT feature_extractions_review_unique UNIQUE (review_id);
