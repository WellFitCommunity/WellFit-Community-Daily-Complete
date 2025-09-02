// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL as string;
const key = (process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY ||
             process.env.REACT_APP_SUPABASE_ANON_KEY) as string;

if (!url || !key) {
  throw new Error('Missing REACT_APP_SUPABASE_URL or SUPABASE key envs');
}

// Single, shared client for the whole app
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'wellfit-auth',
  },
});

// Re-export the auth helpers so existing imports keep working
export {
  SessionContextProvider,
  useSupabaseClient,
  useSession,
  useUser,
} from '@supabase/auth-helpers-react';
