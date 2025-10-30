DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'feature_extractions_review_unique'
      AND conrelid = 'feature_extractions'::regclass
  ) THEN
    -- Desired constraint already present, nothing to do.
    NULL;
  ELSIF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'feature_extractions_review_id_unique'
      AND conrelid = 'feature_extractions'::regclass
  ) THEN
    -- Older constraint name still in place; rename it so new and old databases match.
    ALTER TABLE feature_extractions
      RENAME CONSTRAINT feature_extractions_review_id_unique TO feature_extractions_review_unique;
  ELSE
    -- No matching constraint found, create it.
    ALTER TABLE feature_extractions
      ADD CONSTRAINT feature_extractions_review_unique UNIQUE (review_id);
  END IF;
END
$$ LANGUAGE plpgsql;
