-- Check all player data across all tables and views
-- Run these queries in Supabase SQL Editor

-- 1. Check all players in the players table
SELECT 
  id,
  name,
  deleted,
  created_at
FROM players 
ORDER BY created_at DESC;

-- 2. Check single reaction scores (from scores table)
SELECT 
  p.name,
  s.rt_ms,
  p.created_at as player_created_at
FROM scores s
JOIN players p ON p.id = s.player_id
WHERE p.deleted = false
ORDER BY s.rt_ms ASC;

-- 3. Check RT60 sessions data
SELECT 
  p.name,
  rt.total_clicks,
  rt.best_ms,
  rt.avg_ms,
  rt.created_at
FROM rt60_sessions rt
JOIN players p ON p.id = rt.player_id
WHERE p.deleted = false
ORDER BY rt.created_at DESC;

-- 4. Check CPS sessions data
SELECT 
  p.name,
  cs.set1_clicks,
  cs.set2_clicks,
  cs.set3_clicks,
  cs.set4_clicks,
  cs.duration_sec,
  cs.created_at
FROM cps_sessions cs
JOIN players p ON p.id = cs.player_id
WHERE p.deleted = false
ORDER BY cs.created_at DESC;

-- 5. Check leaderboard view (single reaction)
SELECT 
  player_id,
  name,
  best_ms,
  median_ms,
  mean_ms,
  tries
FROM leaderboard
ORDER BY best_ms ASC;

-- 6. Check RT60 overview view
SELECT 
  player_id,
  name,
  total_clicks,
  best_ms,
  avg_ms
FROM lb_rt60_overview
ORDER BY total_clicks DESC;

-- 7. Check CPS overview view
SELECT 
  player_id,
  name,
  best_cps,
  avg_cps
FROM lb_cps_overview
ORDER BY best_cps DESC;

-- 8. Summary: Count players and sessions
SELECT 
  'Players' as table_name,
  COUNT(*) as total_count,
  COUNT(CASE WHEN deleted = false THEN 1 END) as active_count
FROM players
UNION ALL
SELECT 
  'Single Reaction Scores',
  COUNT(*),
  COUNT(*)
FROM scores
UNION ALL
SELECT 
  'RT60 Sessions',
  COUNT(*),
  COUNT(*)
FROM rt60_sessions
UNION ALL
SELECT 
  'CPS Sessions',
  COUNT(*),
  COUNT(*)
FROM cps_sessions;

-- 9. Player activity summary
SELECT 
  p.name,
  COUNT(DISTINCT s.id) as single_reaction_tries,
  COUNT(DISTINCT rt.id) as rt60_sessions,
  COUNT(DISTINCT cs.id) as cps_sessions,
  p.created_at as player_created_at,
  MAX(GREATEST(
    COALESCE(rt.created_at, '1900-01-01'::timestamp),
    COALESCE(cs.created_at, '1900-01-01'::timestamp)
  )) as last_activity
FROM players p
LEFT JOIN scores s ON p.id = s.player_id AND p.deleted = false
LEFT JOIN rt60_sessions rt ON p.id = rt.player_id AND p.deleted = false
LEFT JOIN cps_sessions cs ON p.id = cs.player_id AND p.deleted = false
WHERE p.deleted = false
GROUP BY p.id, p.name, p.created_at
ORDER BY last_activity DESC;
