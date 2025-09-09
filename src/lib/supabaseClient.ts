// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import { SB_URL, SB_PUBLISHABLE_API_KEY } from '../settings/settings';

if (!SB_URL || !SB_PUBLISHABLE_API_KEY) {
  throw new Error(
    'SB misconfigured. Set REACT_APP_SB_URL and REACT_APP_SB_PUBLISHABLE_API_KEY (or legacy SUPABASE variants).'
  );
}

export const supabase = createClient(SB_URL, SB_PUBLISHABLE_API_KEY, {
  auth: {
    // in-memory only — no localStorage (HIPAA safer)
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// one-time cleanup if any legacy keys existed
try { localStorage.removeItem('wellfit-auth'); } catch {}

export type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
