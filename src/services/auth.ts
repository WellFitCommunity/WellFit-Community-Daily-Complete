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

// Raw env
const RAW_ENDPOINT = process.env.REACT_APP_API_ENDPOINT;

// Fallback only allowed in non-production
export const API_ENDPOINT: string =
  RAW_ENDPOINT ??
  (process.env.NODE_ENV !== 'production'
    ? 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/register'
    : (() => {
        throw new Error(
          'REACT_APP_API_ENDPOINT not set in production environment.'
        );
      })());

if (!RAW_ENDPOINT && process.env.NODE_ENV !== 'production') {
  console.warn(
    '⚠️ REACT_APP_API_ENDPOINT not set—using fallback. ' +
      'Define it in your .env and in Vercel settings.'
  );
}

export async function registerUser<T = unknown>(
  payload: RegisterPayload
): Promise<T> {
  if (!payload.consent) {
    throw new Error('User consent is required before registration.');
  }

  try {
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
        errorText = res.statusText || `HTTP ${res.status}`;
      }
      throw new Error(errorText || 'Registration failed');
    }

    return (await res.json()) as T;
  } catch (err) {
    // Network / CORS / unexpected errors
    if (err instanceof Error) {
      throw new Error(`Registration request failed: ${err.message}`);
    }
    throw new Error('Registration request failed: Unknown error');
  }
}
