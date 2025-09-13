// api/_lib/env.ts
export const SUPABASE_URL = process.env.SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Keep your existing exports too
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase envs');
}


const req = (name: string): string => {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`[ENV] Missing required server env: ${name}`);
  return v.trim();
};

// ---- MailerSend (server-only) ----
export const MAILERSEND_API_KEY = req("MAILERSEND_API_KEY");      // example: mlsn.xxxxx
export const MAILERSEND_FROM_EMAIL = req("MAILERSEND_FROM_EMAIL"); // e.g. no-reply@thewellfitcommunity.org
export const MAILERSEND_FROM_NAME = process.env.MAILERSEND_FROM_NAME?.trim() || "WellFit";
export const MAILERSEND_REPLY_TO = process.env.MAILERSEND_REPLY_TO?.trim() || MAILERSEND_FROM_EMAIL;

// ---- Twilio (server-only) ----
export const TWILIO_ACCOUNT_SID = req("TWILIO_ACCOUNT_SID");             // ACxxxxxxxx
export const TWILIO_AUTH_TOKEN  = req("TWILIO_AUTH_TOKEN");              // secret
export const TWILIO_MESSAGING_SERVICE_SID = req("TWILIO_MESSAGING_SERVICE_SID"); // MGxxxxxxxx (preferred)
// or set TWILIO_FROM_NUMBER if you don’t use a Messaging Service
export const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER?.trim() || "";

// ---- Supabase Admin (server-only, if needed) ----
export const SB_URL_SERVER = req("SUPABASE_URL");           // no REACT_APP_
export const SB_SECRET_KEY = req("SB_SECRET_KEY");          // service role (keep server-side)

// ---- hCaptcha (server-only) ----
export const HCAPTCHA_SECRET = req("HCAPTCHA_SECRET");      // secret key for server verify

// Optional helpers:
export const assertEither = (msgSvcSid: string, fromNumber: string) => {
  if (!msgSvcSid && !fromNumber) {
    throw new Error("[ENV] Provide TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER");
  }
};
