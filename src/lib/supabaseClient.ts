// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_API_KEY,
} from '../settings/settings';

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_API_KEY) {
  throw new Error('Missing Supabase URL or publishable key in settings.ts');
}

// Single shared client
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_API_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'wellfit-auth',
  },
});

// Re-export hooks + provider so you can import them from this module
export {
  SessionContextProvider,
  useSupabaseClient,
  useSession,
  useUser,
} from '@supabase/auth-helpers-react';

