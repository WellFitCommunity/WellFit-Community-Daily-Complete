// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import {
  SB_URL,
  SB_PUBLISHABLE_API_KEY,
  // keep aliases available if you decide to swap import style later
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_API_KEY,
} from '../settings/settings';

// Prefer SB_*; fall back to SUPABASE_* if you ever switch import style
const url = SB_URL || SUPABASE_URL;
const key = SB_PUBLISHABLE_API_KEY || SUPABASE_PUBLISHABLE_API_KEY;

// In dev, surface misconfig loudly; in prod, log and limp instead of hard-crashing UI
if (!url || !key) {
  console.error('[SB CONFIG MISSING]', {
    url_set: !!url,
    key_set: !!key,
    expect_url_envs: ['REACT_APP_SB_URL', 'REACT_APP_SUPABASE_URL'],
    expect_key_envs: ['REACT_APP_SB_PUBLISHABLE_API_KEY', 'REACT_APP_SUPABASE_ANON_KEY'],
  });
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    throw new Error('Supabase misconfigured. See console for expected env names.');
  }
}

// Tip: persistSession=true to keep the user logged in on refresh
export const supabase = createClient(url as string, key as string, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Temporary sanity log (comment out later)
// console.info('[Supabase init]', { url_ok: !!url, key_ok: !!key });

export type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
