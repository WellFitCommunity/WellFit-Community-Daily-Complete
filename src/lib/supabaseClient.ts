import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_API_KEY,
} from '../settings/settings';

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_API_KEY) {
  throw new Error(
    'Supabase misconfigured. Set REACT_APP_SB_URL and REACT_APP_SB_PUBLISHABLE_API_KEY.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_API_KEY, {
  auth: {
    // 🔒 in-memory only — no localStorage
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // no storageKey
  },
});

// one-time migration cleanup if legacy key exists
try { localStorage.removeItem('wellfit-auth'); } catch {}
export type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

