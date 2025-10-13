-- Run this in Supabase SQL Editor to check what tables exist
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('check_ins', 'risk_assessments')
ORDER BY tablename;