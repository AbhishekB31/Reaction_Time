import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { openDb } from './db';

type Cfg = { PORT: number; DB_PATH: string; ADMIN_TOKEN: string };
const cfg: Cfg = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'server', 'server.config.json'), 'utf-8')
);

const dbPromise = openDb(path.join(process.cwd(), 'server', cfg.DB_PATH));
const app = express();
app.use(express.json());

// Security headers
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'");
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

function cleanName(name: string) {
  const s = (name || '').trim();
  if (s.length < 2 || s.length > 80) return null;
  if (/[<>]/.test(s)) return null;
  return s;
}

// POST /api/start  {name}
app.post('/api/start', async (req, res) => {
  const db = await dbPromise;
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'invalid name' });

  let player = db.prepare('SELECT id FROM players WHERE name=? AND deleted=0').get(name) as
    | { id: number }
    | undefined;
  if (!player) {
    const info = db.prepare('INSERT INTO players(name) VALUES (?)').run(name);
    player = { id: Number(info.lastInsertRowid) };
  }

  const session = crypto.randomBytes(16).toString('hex');
  db.prepare(`INSERT INTO sessions(id, player_id) VALUES (?, ?)`).run(session, player.id);
  res.json({ session, player_id: player.id });
});

// POST /api/consent  {session, agree:true}
app.post('/api/consent', async (req, res) => {
  const db = await dbPromise;
  const { session, agree } = req.body || {};
  if (!session || !agree) return res.status(400).json({ error: 'bad request' });
  const row = db.prepare('SELECT id, completed FROM sessions WHERE id=?').get(session) as any;
  if (!row || row.completed) return res.status(400).json({ error: 'invalid session' });
  db.prepare('UPDATE sessions SET consent=1 WHERE id=?').run(session);
  res.json({ ok: true });
});

// POST /api/submit { session, rt_ms, ua, screen:{w,h} }
app.post('/api/submit', async (req, res) => {
  const db = await dbPromise;
  const { session, rt_ms, ua, screen } = req.body || {};
  if (!session || typeof rt_ms !== 'number') return res.status(400).json({ error: 'bad request' });

  const sess = db
    .prepare('SELECT id, player_id, consent, completed FROM sessions WHERE id=?')
    .get(session) as any;
  if (!sess || !sess.consent || sess.completed) return res.status(400).json({ error: 'invalid session' });

  const clean = rt_ms < 80 || rt_ms > 2000 ? null : Math.round(rt_ms);
  const raw = Math.max(1, Math.round(rt_ms));

  db.prepare(
    `INSERT INTO scores(player_id, session_id, trial_idx, rt_ms_raw, rt_ms_clean)
              VALUES (?, ?, 1, ?, ?)`
  ).run(sess.player_id, session, raw, clean);

  db.prepare('UPDATE sessions SET completed=1, user_agent=?, screen_w=?, screen_h=? WHERE id=?')
    .run(String(ua || '').slice(0, 300), Number(screen?.w || 0), Number(screen?.h || 0), session);

  res.json({ ok: true });
});

// GET /api/leaderboard
app.get('/api/leaderboard', async (_req, res) => {
  const db = await dbPromise;
  const rows = db
    .prepare(
      `
    SELECT
      p.id AS player_id,
      p.name AS name,
      MIN(CASE WHEN s.deleted=0 THEN s.rt_ms_raw END) AS best_ms,
      CAST(AVG(CASE WHEN s.deleted=0 THEN s.rt_ms_raw END) AS INT) AS mean_ms,
      SUM(CASE WHEN s.deleted=0 THEN 1 ELSE 0 END) AS tries
    FROM players p
    LEFT JOIN scores s ON s.player_id = p.id
    WHERE p.deleted = 0
    GROUP BY p.id, p.name
    HAVING best_ms IS NOT NULL
    ORDER BY best_ms ASC
  `
    )
    .all();
  res.json(rows);
});

// DELETE /api/players/:id   header X-Admin-Token
app.delete('/api/players/:id', async (req, res) => {
  const db = await dbPromise;
  const token = req.header('X-Admin-Token') || '';
  if (!cfg.ADMIN_TOKEN || token !== cfg.ADMIN_TOKEN) return res.status(401).end('Unauthorized');
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad id' });
  const tx = db.transaction((pid: number) => {
    db.prepare('UPDATE players SET deleted=1 WHERE id=?').run(pid);
    db.prepare('UPDATE scores SET deleted=1 WHERE player_id=?').run(pid);
  });
  tx(id);
  res.json({ ok: true });
});

// CSV export
app.get('/api/export.csv', (_req, res) => {
  const rows = db
    .prepare(
      `
    SELECT p.name, MIN(s.rt_ms_raw) AS best_ms, CAST(AVG(s.rt_ms_raw) AS INT) AS mean_ms,
           SUM(CASE WHEN s.deleted=0 THEN 1 ELSE 0 END) AS tries
    FROM players p JOIN scores s ON s.player_id=p.id
    WHERE p.deleted=0 AND s.deleted=0
    GROUP BY p.name ORDER BY best_ms ASC
  `
    )
    .all() as any[];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="leaderboard.csv"');
  res.write('name,best_ms,mean_ms,tries\n');
  for (const r of rows) res.write(`${r.name},${r.best_ms},${r.mean_ms},${r.tries}\n`);
  res.end();
});

app.listen(cfg.PORT, '127.0.0.1', () => {
  console.log(`[server] listening http://127.0.0.1:${cfg.PORT}`);
});


