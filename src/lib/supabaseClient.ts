import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url  = process.env.REACT_APP_SUPABASE_URL || '';
const anon = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Keep exactly one instance across hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __supabase__: SupabaseClient | undefined;
}

export const supabase: SupabaseClient =
  (globalThis as any).__supabase__ ?? createClient(url, anon);

if (!(globalThis as any).__supabase__) (globalThis as any).__supabase__ = supabase;
