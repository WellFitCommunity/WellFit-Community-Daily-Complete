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
  try {
    console.log('[register] calling Edge Function...');
    
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
      console.error('[register] Edge Function error:', error);
      throw new Error(error.message || 'Registration failed');
    }

    if (!data?.success) {
      console.error('[register] Function returned error:', data);
      throw new Error(data?.error || 'Registration failed');
    }

    console.log('[register] success:', data);
    return data;
  } catch (error) {
    console.error('[register] unexpected error:', error);
    throw error;
  }
}

// Enhanced login utility
export async function loginUser(phone: string, password: string) {
  try {
    console.log('[login] calling Edge Function...');
    
    const { data, error } = await supabase.functions.invoke('login', {
      body: { phone, password },
    });

    if (error) {
      console.error('[login] Edge Function error:', error);
      throw new Error(error.message || 'Login failed');
    }

    if (!data?.success) {
      console.error('[login] Function returned error:', data);
      throw new Error(data?.error || 'Login failed');
    }

    console.log('[login] success');
    return data;
  } catch (error) {
    console.error('[login] unexpected error:', error);
    throw error;
  }
}