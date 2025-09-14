// src/utils/register.ts
import { supabase } from '../lib/supabaseClient';

export type RegisterPayload = {
  firstName: string;
  lastName: string;
  phone: string;          // +1XXXXXXXXXX
  password: string;
  email?: string;
  hcaptchaToken: string;
};

export async function registerUser(payload: RegisterPayload) {
  const { data, error } = await supabase.functions.invoke('register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });

  if (error) throw new Error(error.message || 'Register call failed');
  return data;
}
