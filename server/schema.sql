PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  deleted    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY, -- random hex/uuid
  player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  consent    INTEGER NOT NULL DEFAULT 0,
  completed  INTEGER NOT NULL DEFAULT 0,
  user_agent TEXT,
  screen_w   INTEGER,
  screen_h   INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  trial_idx   INTEGER NOT NULL DEFAULT 1,  -- single try
  rt_ms_raw   INTEGER NOT NULL CHECK (rt_ms_raw > 0),
  rt_ms_clean INTEGER,                     -- NULL if <80 or >2000
  ts          TEXT NOT NULL DEFAULT (datetime('now')),
  deleted     INTEGER NOT NULL DEFAULT 0
);

-- Leaderboard view (ignore soft-deleted)
CREATE VIEW IF NOT EXISTS leaderboard AS
SELECT
  p.id AS player_id,
  p.name,
  MIN(CASE WHEN s.deleted=0 THEN s.rt_ms_raw END)            AS best_ms,
  CAST(AVG(CASE WHEN s.deleted=0 THEN s.rt_ms_raw END) AS INT) AS mean_ms,
  SUM(CASE WHEN s.deleted=0 THEN 1 ELSE 0 END)               AS tries
FROM players p
LEFT JOIN scores s ON s.player_id = p.id
WHERE p.deleted = 0
GROUP BY p.id, p.name
HAVING best_ms IS NOT NULL;
