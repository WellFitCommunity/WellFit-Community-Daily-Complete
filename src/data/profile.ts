// src/data/profile.ts
import { supabase } from '../lib/supabaseClient';

export type Profile = {
  user_id: string;
  email?: string | null;
  role_code?: number | null;  // Fixed: was role_id, should be role_code
  role?: string | null;       // Text role from database (senior, admin, etc.)
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  phone_verified?: boolean | null;
  // add other columns you actually have:
  // disabled_at?: string | null; etc.
};

async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null; // ✅ don't throw in UI
  return data.user.id;
}

export async function fetchMyProfile(): Promise<Profile | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null; // ✅ no session yet
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle(); // ✅ no exception when missing
  if (error) {
    // PGRST116 = no rows; treat as null
    if ((error as any).code !== 'PGRST116') // Removed console statement
    return null;
  }
  return (data as Profile) ?? null;
}

// Note: Profile creation happens server-side during registration (via handle_new_user trigger
// or verify-hcaptcha edge function). Client-side code should only UPDATE existing profiles.
// Using upsert from client fails due to RLS INSERT policy requiring tenant_id.

export async function updateMyProfile(patch: Partial<Profile>): Promise<Profile | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('user_id', uid)
    .select()
    .single();
  if (error) {

    return null;
  }
  return data as Profile;
}
