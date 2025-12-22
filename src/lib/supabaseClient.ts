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
 * Session Storage Strategy for Supabase Auth
 *
 * IMPORTANT: We use localStorage (not sessionStorage) because:
 * - sessionStorage clears on navigation/back button (especially on mobile)
 * - This caused users to get logged out every time they used back button
 * - Session security is enforced server-side via JWT expiry (30 min)
 *
 * HIPAA Compliance is maintained via:
 * - Server-side session expiry (configured in Supabase dashboard)
 * - JWT tokens only contain user_id and role, NOT PHI
 * - Auto-logout on token refresh failure
 * - Proper sign-out clears all tokens
 *
 * Note: For shared/public computers, users should explicitly log out.
 */
export const supabase = createClient(url as string, key as string, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Use localStorage (default) - sessions persist across navigation
    // Server-side JWT expiry handles session timeout (not client storage)
    storage: localStorage,
    // Let Supabase use its default storage key format (sb-<project-ref>-auth-token)
    // Do not override storageKey as it must match what the SDK expects
  },
  global: {
    // Auth-aware fetch intercepts invalid refresh token errors at the transport layer
    // and handles them cleanly before they cascade into multiple 400 errors
    fetch: createAuthAwareFetch(),
  },
});

export type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
