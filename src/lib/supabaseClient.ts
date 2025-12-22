// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import {
  SB_URL,
  SB_PUBLISHABLE_API_KEY,
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_API_KEY,
  assertClientSupabaseEnv,
} from '../settings/settings';
import { createAuthAwareFetch } from './authAwareFetch';

// Prefer SB_*; fall back to SUPABASE_* if you ever switch import style
const url = SB_URL || SUPABASE_URL;
const key = SB_PUBLISHABLE_API_KEY || SUPABASE_PUBLISHABLE_API_KEY;

// ✅ Fail fast (dev & prod). Clear error beats hidden white screen.
assertClientSupabaseEnv();

/**
 * HIPAA-Compliant Storage Adapter for Supabase Auth
 *
 * Uses sessionStorage instead of localStorage:
 * - Session clears when browser closes (no persistent tokens on disk)
 * - Reduces risk of token theft from unattended devices
 * - Complies with HIPAA minimum necessary principle
 *
 * Note: Auth tokens (JWTs) contain user ID and role, not PHI.
 * But sessionStorage is still preferred for healthcare apps.
 */
const hipaaCompliantStorage = {
  getItem: (key: string): string | null => {
    return sessionStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    sessionStorage.setItem(key, value);
  },
  removeItem: (key: string): void => {
    sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(url as string, key as string, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Use sessionStorage instead of localStorage for HIPAA compliance
    storage: hipaaCompliantStorage,
    // Storage key prefix for Supabase auth
    storageKey: 'sb-auth',
  },
  global: {
    // Auth-aware fetch intercepts invalid refresh token errors at the transport layer
    // and handles them cleanly before they cascade into multiple 400 errors
    fetch: createAuthAwareFetch(),
  },
});

export type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
