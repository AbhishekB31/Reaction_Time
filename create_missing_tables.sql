-- Create missing tables and views for RT60 and CPS modes
-- Run this in your Supabase SQL Editor

-- 1. Create rt60_sessions table
CREATE TABLE IF NOT EXISTS rt60_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  best_ms INTEGER,
  avg_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create cps_sessions table  
CREATE TABLE IF NOT EXISTS cps_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  set1_clicks INTEGER NOT NULL DEFAULT 0,
  set2_clicks INTEGER NOT NULL DEFAULT 0,
  set3_clicks INTEGER NOT NULL DEFAULT 0,
  set4_clicks INTEGER NOT NULL DEFAULT 0,
  duration_sec INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS on new tables
ALTER TABLE rt60_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cps_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for rt60_sessions
CREATE POLICY "Allow public read access to rt60_sessions" ON rt60_sessions
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert to rt60_sessions" ON rt60_sessions
  FOR INSERT WITH CHECK (true);

-- 5. Create RLS policies for cps_sessions
CREATE POLICY "Allow public read access to cps_sessions" ON cps_sessions
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert to cps_sessions" ON cps_sessions
  FOR INSERT WITH CHECK (true);

-- 6. Drop existing view if it exists, then create lb_rt60_overview view
DROP VIEW IF EXISTS lb_rt60_overview;
CREATE VIEW lb_rt60_overview AS
SELECT 
  p.id as player_id,
  p.name,
  COALESCE(SUM(rt.total_clicks), 0) as total_clicks,
  MIN(rt.best_ms) as best_ms,
  ROUND(AVG(rt.avg_ms)) as avg_ms
FROM players p
LEFT JOIN rt60_sessions rt ON p.id = rt.player_id AND p.deleted = false
WHERE p.deleted = false
GROUP BY p.id, p.name
HAVING SUM(rt.total_clicks) > 0
ORDER BY total_clicks DESC, best_ms ASC;

-- 7. Drop existing view if it exists, then create lb_cps_overview view
DROP VIEW IF EXISTS lb_cps_overview;
CREATE VIEW lb_cps_overview AS
SELECT 
  p.id as player_id,
  p.name,
  MAX(
    CASE 
      WHEN cs.set1_clicks > 0 THEN cs.set1_clicks / cs.duration_sec::DECIMAL
      ELSE 0 
    END +
    CASE 
      WHEN cs.set2_clicks > 0 THEN cs.set2_clicks / cs.duration_sec::DECIMAL
      ELSE 0 
    END +
    CASE 
      WHEN cs.set3_clicks > 0 THEN cs.set3_clicks / cs.duration_sec::DECIMAL
      ELSE 0 
    END +
    CASE 
      WHEN cs.set4_clicks > 0 THEN cs.set4_clicks / cs.duration_sec::DECIMAL
      ELSE 0 
    END
  ) as best_cps,
  ROUND(AVG(
    CASE 
      WHEN cs.set1_clicks > 0 THEN cs.set1_clicks / cs.duration_sec::DECIMAL
      ELSE 0 
    END +
    CASE 
      WHEN cs.set2_clicks > 0 THEN cs.set2_clicks / cs.duration_sec::DECIMAL
      ELSE 0 
    END +
    CASE 
      WHEN cs.set3_clicks > 0 THEN cs.set3_clicks / cs.duration_sec::DECIMAL
      ELSE 0 
    END +
    CASE 
      WHEN cs.set4_clicks > 0 THEN cs.set4_clicks / cs.duration_sec::DECIMAL
      ELSE 0 
    END
  ), 2) as avg_cps
FROM players p
LEFT JOIN cps_sessions cs ON p.id = cs.player_id AND p.deleted = false
WHERE p.deleted = false
GROUP BY p.id, p.name
HAVING COUNT(cs.id) > 0
ORDER BY best_cps DESC, avg_cps DESC;

-- 8. Grant permissions on views
GRANT SELECT ON lb_rt60_overview TO anon;
GRANT SELECT ON lb_cps_overview TO anon;
