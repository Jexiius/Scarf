-- enable_rls.sql
-- Enables (and forces) row-level security on every user table in the public schema.
-- Run this after creating all tables to ensure RLS is consistently applied.

DO $$
DECLARE
    tbl record;
BEGIN
    FOR tbl IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT LIKE 'pg\_%'
          AND tablename NOT LIKE 'sql\_%'
    LOOP
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', tbl.schemaname, tbl.tablename);
        EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY;', tbl.schemaname, tbl.tablename);
    END LOOP;
END $$;

