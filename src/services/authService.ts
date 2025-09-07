// src/services/authService.ts
import { supabase } from '../lib/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

export function toE164(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`; // US default
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

// Narrow type to exactly what we return: the .data payload
export type AuthData = { user: User | null; session: Session | null };

export async function loginUserWithPhone(phone: string, password: string): Promise<AuthData> {
  const e164 = toE164(phone);
  const res = await supabase.auth.signInWithPassword({ phone: e164, password });
  if (res.error) throw res.error;
  return res.data; // { user, session }
}

export async function loginAdminWithEmail(email: string, password: string): Promise<AuthData> {
  const res = await supabase.auth.signInWithPassword({ email, password });
  if (res.error) throw res.error;
  return res.data; // { user, session }
}

// Optional: guard route after admin login
export async function assertAdminRoleOrSignOut(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.user_metadata?.role;
  const isAdmin = role === 'admin' || role === 'super_admin';
  if (!isAdmin) {
    await supabase.auth.signOut();
    throw new Error('Admin access required.');
  }
}

// Post-login routing helper
export async function nextRouteForUser(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return '/login';

  const { data, error } = await supabase
    .from('profiles')
    .select('force_password_change, consent, demographics_complete')
    .eq('id', uid)
    .single();

  if (error || !data) return '/login';
  if (data.force_password_change) return '/change-password';
  if (!data.consent) return '/consent';
  if (!data.demographics_complete) return '/demographics';
  return '/dashboard';
}

export async function signOutEverywhere(): Promise<void> {
  await supabase.auth.signOut();
}
