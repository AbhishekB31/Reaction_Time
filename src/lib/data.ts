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

export async function deletePlayer(player_id: string, { soft = false } = {}) {
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


// 60s Reaction overview (4 columns): name, total_clicks, best_ms, avg_ms
export async function fetchLB_RT60_Overview() {
  try {
    const { data, error } = await supa
      .from("lb_rt60_overview")
      .select("*")
      .order("total_clicks", { ascending: false });
    if (error) throw error;
    return data as {
      player_id: string;
      name: string;
      total_clicks: number;
      best_ms: number | null;
      avg_ms: number | null;
    }[];
  } catch (error) {
    console.warn("RT60 overview view not found or error:", error);
    return [];
  }
}

// CPS overview (3 columns): name, best_cps, avg_cps
export async function fetchLB_CPS_Overview() {
  try {
    const { data, error } = await supa
      .from("lb_cps_overview")
      .select("*")
      .order("best_cps", { ascending: false });
    if (error) throw error;
    return data as {
      player_id: string;
      name: string;
      best_cps: number | null;
      avg_cps: number | null;
    }[];
  } catch (error) {
    console.warn("CPS overview view not found or error:", error);
    return [];
  }
}


/** Find or create a player by name, returns player_id */
export async function getOrCreatePlayerId(name: string) {
  const n = name.trim();
  try {
    // First try to find existing player
    const { data: existing, error: findError } = await supa
      .from("players")
      .select("id")
      .eq("name", n)
      .eq("deleted", false)
      .maybeSingle();
    
    if (findError) throw findError;
    
    if (existing?.id) {
      return existing.id as string;
    }
    
    // If not found, create new player
    const { data, error } = await supa
      .from("players")
      .insert({ name: n })
      .select("id")
      .single();
    
    if (error) throw error;
    return data.id as string;
  } catch (error) {
    console.warn("Failed to get/create player:", error);
    // Return a fallback ID for now
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/** Save a finished 60s Reaction session */
export async function submitRT60Session(name: string, stats: {
  totalClicks: number;
  bestMs: number | null;
  avgMs: number | null;
}) {
  try {
    const player_id = await getOrCreatePlayerId(name);
    const { error } = await supa.from("rt60_sessions").insert({
      player_id,
      total_clicks: stats.totalClicks,
      best_ms: stats.bestMs,
      avg_ms: stats.avgMs
    });
    if (error) throw error;
    console.log("RT60 session saved successfully");
  } catch (error) {
    console.warn("Failed to save RT60 session (table may not exist):", error);
    // Don't throw - just log the warning
  }
}

/** Save a finished CPS 4×10s session */
export async function submitCPSSession(name: string, payload: {
  set1: number; set2: number; set3: number; set4: number;
  durationSec?: number; // default 10 if not provided
}) {
  try {
    const player_id = await getOrCreatePlayerId(name);
    const { error } = await supa.from("cps_sessions").insert({
      player_id,
      set1_clicks: payload.set1,
      set2_clicks: payload.set2,
      set3_clicks: payload.set3,
      set4_clicks: payload.set4,
      duration_sec: payload.durationSec ?? 10
    });
    if (error) throw error;
    console.log("CPS session saved successfully");
  } catch (error) {
    console.warn("Failed to save CPS session (table may not exist):", error);
    // Don't throw - just log the warning
  }
}


