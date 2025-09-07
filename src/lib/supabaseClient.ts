// src/lib/supabaseClient.ts
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

// One shared client for the whole app
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_API_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'wellfit-auth',
  },
});

// (Optional) If you use auth-helpers hooks elsewhere, you can still re-export them.
// Remove if not used.


export type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

