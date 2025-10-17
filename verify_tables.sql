-- Check if tables and views were created successfully
-- Run these queries in Supabase SQL Editor to verify

-- 1. Check if rt60_sessions table exists
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name = 'rt60_sessions';

-- 2. Check if cps_sessions table exists
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name = 'cps_sessions';

-- 3. Check if views exist
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name IN ('lb_rt60_overview', 'lb_cps_overview');

-- 4. Check table structure of rt60_sessions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'rt60_sessions'
ORDER BY ordinal_position;

-- 5. Check table structure of cps_sessions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'cps_sessions'
ORDER BY ordinal_position;

-- 6. Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('rt60_sessions', 'cps_sessions');

-- 7. Test the views (should return empty results initially)
SELECT * FROM lb_rt60_overview LIMIT 5;
SELECT * FROM lb_cps_overview LIMIT 5;
