// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import { SB_URL, SB_PUBLISHABLE_API_KEY } from '../settings/settings';

if (!SB_URL || !SB_PUBLISHABLE_API_KEY) {
  console.error('[SB CONFIG]', { hasUrl: !!SB_URL, hasPublishableKey: !!SB_PUBLISHABLE_API_KEY });
  throw new Error('SB misconfigured. Set REACT_APP_SB_URL and REACT_APP_SB_PUBLISHABLE_API_KEY.');
}

export const supabase = createClient(SB_URL, SB_PUBLISHABLE_API_KEY, {
  auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: true },
});

export type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
