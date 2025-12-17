// src/utils/register.ts - UPDATED VERSION
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
    body: {
      phone: payload.phone,
      password: payload.password,
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email || null,
      consent: true,
      hcaptcha_token: payload.hcaptchaToken,
    },
  });

  if (error) {
    throw new Error(error.message || 'Registration failed');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Registration failed');
  }

  return data;
}

// Enhanced login utility
export async function loginUser(phone: string, password: string) {
  const { data, error } = await supabase.functions.invoke('login', {
    body: { phone, password },
  });

  if (error) {
    throw new Error(error.message || 'Login failed');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Login failed');
  }

  return data;
}