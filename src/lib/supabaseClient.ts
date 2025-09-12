// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import {
  SB_URL,
  SB_PUBLISHABLE_API_KEY,
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_API_KEY,
  assertClientSupabaseEnv, // 👈 add
} from '../settings/settings';

// Prefer SB_*; fall back to SUPABASE_* if you ever switch import style
const url = SB_URL || SUPABASE_URL;
const key = SB_PUBLISHABLE_API_KEY || SUPABASE_PUBLISHABLE_API_KEY;

// ✅ Fail fast (dev & prod). Clear error beats hidden white screen.
assertClientSupabaseEnv();

export const supabase = createClient(url as string, key as string, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
