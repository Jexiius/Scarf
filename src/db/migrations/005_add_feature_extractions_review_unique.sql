ALTER TABLE feature_extractions
  ADD CONSTRAINT feature_extractions_review_unique UNIQUE (review_id);
