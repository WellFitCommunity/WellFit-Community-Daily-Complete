// src/lib/supabaseClient.ts
// Do NOT create another client here.
// The single Supabase client is created in index.tsx.
// Re-export hooks so existing imports still work.

export {
  useSupabaseClient,
  useSession,
  useUser,
} from '@supabase/auth-helpers-react';
