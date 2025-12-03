// src/services/authService.ts
import { supabase } from '../lib/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';
import type { ServiceResult } from './_base';
import { success, failure, withServiceWrapper } from './_base';

export function toE164(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`; // US default
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

// Narrow type to exactly what we return: the .data payload
export type AuthData = { user: User | null; session: Session | null };

/**
 * Login user with phone number and password
 * @returns ServiceResult<AuthData> with user and session
 */
export const loginUserWithPhoneResult = withServiceWrapper(
  async (phone: string, password: string): Promise<AuthData> => {
    const e164 = toE164(phone);
    const res = await supabase.auth.signInWithPassword({ phone: e164, password });
    if (res.error) throw res.error;
    return res.data;
  },
  { operationName: 'loginUserWithPhone' }
);

/**
 * Login user with phone (legacy)
 * @deprecated Use loginUserWithPhoneResult for better error handling
 */
export async function loginUserWithPhone(phone: string, password: string): Promise<AuthData> {
  const result = await loginUserWithPhoneResult(phone, password);
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}

/**
 * Login admin with email and password
 * @returns ServiceResult<AuthData> with user and session
 */
export const loginAdminWithEmailResult = withServiceWrapper(
  async (email: string, password: string): Promise<AuthData> => {
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (res.error) throw res.error;
    return res.data;
  },
  { operationName: 'loginAdminWithEmail' }
);

/**
 * Login admin with email (legacy)
 * @deprecated Use loginAdminWithEmailResult for better error handling
 */
export async function loginAdminWithEmail(email: string, password: string): Promise<AuthData> {
  const result = await loginAdminWithEmailResult(email, password);
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}

/**
 * Assert admin role or sign out
 * @returns ServiceResult<void>
 */
export const assertAdminRoleOrSignOutResult = withServiceWrapper(
  async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    const role = user?.user_metadata?.role;
    const isAdmin = role === 'admin' || role === 'super_admin';
    if (!isAdmin) {
      await supabase.auth.signOut();
      throw new Error('Admin access required.');
    }
  },
  { operationName: 'assertAdminRoleOrSignOut' }
);

/**
 * Assert admin role or sign out (legacy)
 * @deprecated Use assertAdminRoleOrSignOutResult for better error handling
 */
export async function assertAdminRoleOrSignOut(): Promise<void> {
  const result = await assertAdminRoleOrSignOutResult();
  if (!result.success) throw new Error(result.error.message);
}

/**
 * Get the next route for user after login
 * @returns ServiceResult<string> with route path
 */
export const nextRouteForUserResult = withServiceWrapper(
  async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return '/login';

    const { data, error } = await supabase
      .from('profiles')
      .select('force_password_change, consent, demographics_complete, role, role_code')
      .eq('id', uid)
      .single();

    if (error || !data) return '/login';

    // Check standard profile completion first
    if (data.force_password_change) return '/change-password';
    if (!data.consent) return '/consent-photo';
    if (!data.demographics_complete) return '/demographics';

    // Role-based routing after profile completion
    const role = data.role || '';
    const roleCode = data.role_code || 0;

    // Admin users need PIN authentication
    if (role === 'admin' || role === 'super_admin' || roleCode === 1 || roleCode === 2) {
      return '/admin-login';
    }

    // Caregivers get special dashboard with senior PIN entry
    if (role === 'caregiver' || roleCode === 6) {
      return '/caregiver-dashboard';
    }

    // Seniors and other users get standard dashboard
    return '/dashboard';
  },
  { operationName: 'nextRouteForUser' }
);

/**
 * Get the next route for user (legacy)
 * @deprecated Use nextRouteForUserResult for better error handling
 */
export async function nextRouteForUser(): Promise<string> {
  const result = await nextRouteForUserResult();
  return result.success ? result.data : '/login';
}

/**
 * Sign out from everywhere
 * @returns ServiceResult<void>
 */
export const signOutEverywhereResult = withServiceWrapper(
  async (): Promise<void> => {
    await supabase.auth.signOut();
  },
  { operationName: 'signOutEverywhere' }
);

/**
 * Sign out from everywhere (legacy)
 * @deprecated Use signOutEverywhereResult for better error handling
 */
export async function signOutEverywhere(): Promise<void> {
  await signOutEverywhereResult();
}
