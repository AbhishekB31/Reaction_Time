# Reaction Time — (https://abhishekb31.github.io/Reaction_Time/)

A fast, single-try visual reaction test with a Flash/Reverse-Flash themed UI. Click (or press SPACE/ENTER) the moment the panel turns green. Results are saved to a public leaderboard powered by Supabase.

## Features

- One-try reaction test with random wait (0.8s–5s)
- Clear states: idle → wait → go → result
- “Too soon!” handling: clicking during wait shows a short message, then returns to idle
- Short beep when the panel turns green (Web Audio API)
- Public leaderboard (best, median, mean, tries) sorted by best ms
- Admin “Edit” mode with a red ❌ per row (soft delete via Edge Function)
- Beautiful, responsive UI with Flash/Reverse-Flash background art

## Tech Stack

- Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui
- Backend: Supabase (Postgres + RLS) with an Edge Function for admin deletes

## How it works

- When you press start, the app waits a random 800–5000 ms and then turns green.
- When it turns green, an 880 Hz beep plays briefly. Your click/keypress time is measured and stored.
- Scores are saved to Supabase under the player created by your name.
- The leaderboard is a view that aggregates best, median, mean and tries per player.
- Deletion is soft (marks rows as deleted) and is executed via a secure Supabase Edge Function.

## Getting Started (local)

1) Install dependencies

   ```bash
   npm install
   ```

2) Environment

Create a `.env.local` file in the project root:

```ini
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ADMIN_TOKEN=choose-a-secret
VITE_DELETE_FN_URL=https://<project-ref>.supabase.co/functions/v1/delete-player
```

3) Run the app

   ```bash
   npm run dev
   ```

The app will start on http://localhost:8080 (or another free port).

## Supabase Setup

Run the following in the Supabase SQL editor (tables + view + RLS policies):

```sql
-- players
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);

-- scores
create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  rt_ms int not null check (rt_ms > 0),
  ts timestamptz not null default now(),
  deleted boolean not null default false
);

-- leaderboard view (best/median/mean/tries), ignoring soft-deleted
create or replace view leaderboard as
select
  p.id as player_id,
  p.name,
  min(s.rt_ms) as best_ms,
  percentile_cont(0.5) within group (order by s.rt_ms) as median_ms,
  avg(s.rt_ms)::int as mean_ms,
  count(*) filter (where not s.deleted) as tries
from players p
join scores  s on s.player_id = p.id
where not p.deleted and not s.deleted
group by p.id, p.name;

-- RLS
alter table players enable row level security;
alter table scores  enable row level security;

-- public read
create policy if not exists "public read players" on players for select using (true);
create policy if not exists "public read scores"  on scores  for select using (true);

-- public insert (anyone can play)
create policy if not exists "insert players" on players for insert with check (true);
create policy if not exists "insert scores"  on scores  for insert with check (true);
```

Optional: If you use soft delete and want to allow reusing names after deletion, replace the unique constraint with a partial index:

```sql
alter table public.players drop constraint if exists players_name_key;
create unique index if not exists players_name_active_idx
  on public.players (lower(name))
  where not deleted;
```

## Edge Function: delete-player

Create an Edge Function named `delete-player` with CORS and token validation. It soft-deletes a player (and that player’s scores) or hard-deletes if requested.

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-admin-token, authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const adminToken = req.headers.get("x-admin-token") ?? "";
  if (adminToken !== Deno.env.get("ADMIN_TOKEN")) {
    return new Response(JSON.stringify({ code: 401, message: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const { player_id, soft = true } = await req.json();

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (soft) {
    const { error: e1 } = await supa.from("players").update({ deleted: true }).eq("id", player_id);
    const { error: e2 } = await supa.from("scores").update({ deleted: true }).eq("player_id", player_id);
    if (e1 || e2) {
      return new Response((e1 || e2)!.message, { status: 400, headers: corsHeaders });
    }
  } else {
    const { error } = await supa.from("players").delete().eq("id", player_id);
    if (error) return new Response(error.message, { status: 400, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
```

Function env vars (Settings → Environment Variables):

- `SUPABASE_URL` — your project URL
- `SUPABASE_SERVICE_ROLE_KEY` — service role key
- `ADMIN_TOKEN` — must match `VITE_ADMIN_TOKEN`

## Admin Delete from the App

The frontend calls the function URL from `VITE_DELETE_FN_URL` and sends two headers:
- `x-admin-token: VITE_ADMIN_TOKEN`
- `authorization: Bearer VITE_SUPABASE_ANON_KEY` (harmless if JWT verification is off; required if it’s on)

## Scripts

```bash
npm run dev       # start local dev server
npm run build     # build for production
npm run preview   # preview production build locally
```

## Notes

- Assets: the project uses a large GIF (`images/flashyflash.gif`). Consider compressing or using Git LFS if you plan to keep very large media in the repo.
- Security: the Edge Function protects deletion with a shared token. Keep `VITE_ADMIN_TOKEN` secret and rotate if needed.

