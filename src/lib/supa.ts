import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL!;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// temporary guard to surface mistakes
if (!url || !anon) {
  console.error('Missing Supabase envs', { url, anonPresent: !!anon });
}

export const supa = createClient(url, anon);
