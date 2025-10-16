import { supa } from './supa';

function cleanName(name: string) {
  const s = (name ?? '').trim();
  if (s.length < 2 || s.length > 80) return null;
  if (/[<>]/.test(s)) return null;
  return s;
}

export async function upsertPlayer(name: string): Promise<string> {
  const n = cleanName(name);
  if (!n) throw new Error('Invalid name');
  const { data, error } = await supa
    .from('players')
    .upsert({ name: n }, { onConflict: 'name' })
    .select('id')
    .single();
  if (error) throw error;
  return data!.id as string;
}

// Insert-only flow that reports a friendly error when the name is taken
export async function createPlayerOrError(rawName: string): Promise<string> {
  const name = (rawName ?? '').trim();
  if (name.length < 2 || name.length > 80) {
    throw new Error('Please enter 2–80 characters.');
  }

  const { data, error, status } = await supa
    .from('players')
    .insert({ name })
    .select('id')
    .single();

  if (error && ((error as any).code === '23505' || status === 409)) {
    throw new Error('That name is taken. Please choose a different one.');
  }
  if (error) {
    throw error;
  }
  return data!.id as string;
}

export async function submitScore(name: string, rt_ms: number) {
  // Find player by name; create if somehow missing
  const cleaned = (name ?? '').trim();
  let player_id: string | null = null;

  const { data: existing, error: findErr } = await supa
    .from('players')
    .select('id')
    .eq('name', cleaned)
    .maybeSingle();

  if (findErr) {
    throw findErr;
  }

  if (existing?.id) {
    player_id = existing.id as string;
  } else {
    player_id = await createPlayerOrError(cleaned);
  }

  const { error } = await supa.from('scores').insert({ player_id, rt_ms: Math.round(rt_ms) });
  if (error) throw error;
}

export interface LeaderboardRow {
  player_id: string;
  name: string;
  best_ms: number;
  median_ms: number;
  mean_ms: number;
  tries: number;
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supa
    .from('leaderboard')
    .select('*')
    .order('best_ms', { ascending: true });
  if (error) throw error;
  return data as LeaderboardRow[];
}

const FN_URL =
  import.meta.env.VITE_DELETE_FN_URL ??
  'https://yoqmkqqsojewrqwdjdnn.supabase.co/functions/v1/delete-player';

export async function deletePlayer(player_id: string, { soft = true } = {}) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-admin-token': import.meta.env.VITE_ADMIN_TOKEN!,
    // Always include Authorization; some projects enable "Verify JWT with legacy secret"
    ...(import.meta.env.VITE_SUPABASE_ANON_KEY
      ? { authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` }
      : {}),
  };

  const res = await fetch(FN_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ player_id, soft }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}


