-- 006_drop_duplicate_indexes.sql
-- Removes legacy indexes that duplicate newer Drizzle-created ones.

DROP INDEX IF EXISTS idx_extractions_restaurant;
DROP INDEX IF EXISTS idx_reviews_restaurant;
DROP INDEX IF EXISTS idx_reviews_unprocessed;
DROP INDEX IF EXISTS idx_saved_user;
DROP INDEX IF EXISTS idx_saved_restaurant;
DROP INDEX IF EXISTS idx_queries_user;

