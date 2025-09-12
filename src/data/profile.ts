// src/data/profile.ts
import { supabase } from '../lib/supabaseClient';

export type Profile = {
  user_id: string;
  email?: string | null;
  role_id?: number | null;
  // add other columns you actually have:
  // phone_verified?: boolean | null;
  // disabled_at?: string | null; etc.
};

export async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Not authenticated');
  return data.user.id;
}

export async function fetchMyProfile(): Promise<Profile | null> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', uid)
    .single(); // returns row or error
  if (error && error.code !== 'PGRST116') throw error; // not found
  return (data as Profile) ?? null;
}

export async function upsertMyProfile(patch: Partial<Profile>): Promise<Profile> {
  const uid = await getCurrentUserId();
  const payload = { ...patch, user_id: uid };
  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function updateMyProfile(patch: Partial<Profile>): Promise<Profile> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('user_id', uid)
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}
