// src/services/auth.ts
export interface RegisterPayload {
  first_name: string;
  last_name: string;
  phone: string;
  email?: string | null;
  password: string;
  consent: boolean;
  hcaptcha_token: string;
}

// 1. Grab raw env var
const RAW_ENDPOINT = process.env.REACT_APP_API_ENDPOINT;

// 2. Build a guaranteed string (fallback only in dev)
export const API_ENDPOINT: string =
  RAW_ENDPOINT ??
  'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/register';

if (!RAW_ENDPOINT && process.env.NODE_ENV !== 'production') {
  console.warn(
    '⚠️ REACT_APP_API_ENDPOINT not set—using fallback. ' +
    'Define it in your .env and in Vercel settings.'
  );
}

// 3. Export a function to register
export async function registerUser(payload: RegisterPayload) {
  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errorText: string;
    try {
      const errJson = await res.json();
      errorText = errJson.error || JSON.stringify(errJson);
    } catch {
      errorText = res.statusText;
    }
    throw new Error(errorText || 'Registration failed');
  }

  return res.json();
}
