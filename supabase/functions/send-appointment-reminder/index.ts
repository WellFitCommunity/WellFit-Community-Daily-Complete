// supabase/functions/send-appointment-reminder/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { z, ZodIssue } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { withCORS, requireUser, requireRole } from "../_shared/auth.ts";

// -------------- Utils --------------
const getEnv = (k: string, ...alts: string[]) => {
  for (const key of [k, ...alts]) {
    const v = Deno.env.get(key);
    if (v && v.trim()) return v.trim();
  }
  return "";
};
const isE164 = (s: string) => /^\+[1-9]\d{6,14}$/.test(s || ""); // 7–15 digits, no leading 0 after +
const json = (body: unknown, status = 200, extra: Record<string,string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...extra } });

// -------------- Env (lazy-checked) --------------
const TWILIO_ACCOUNT_SID = getEnv("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN  = getEnv("TWILIO_AUTH_TOKEN");
const TWILIO_MESSAGING_SERVICE_SID = getEnv("TWILIO_MESSAGING_SERVICE_SID");
const TWILIO_FROM_NUMBER = getEnv("TWILIO_FROM_NUMBER");
const TWILIO_STATUS_CALLBACK_URL = getEnv("TWILIO_STATUS_CALLBACK_URL"); // optional delivery receipts

const SUPABASE_URL = getEnv("SB_URL", "SUPABASE_URL");
const SUPABASE_SERVICE_KEY = getEnv("SB_SERVICE_ROLE_KEY", "SB_SECRET_KEY");

// Create lazily inside handler only if we have creds
const makeSupabase = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// -------------- Validation --------------
const appointmentReminderSchema = z.object({
  phone: z.string().refine(isE164, { message: "Phone must be E.164, e.g., +15551234567" }),
  patient_name: z.string().min(1, { message: "Patient name is required" }),
  appointment_date: z.string().min(1, { message: "Appointment date is required" }), // keep free-form as you had
  appointment_time: z.string().min(1, { message: "Appointment time is required" }), // keep free-form as you had
  provider_name: z.string().optional(),
  location: z.string().optional(),
  custom_message: z.string().max(1600, { message: "Message too long (max 1600 chars)" }).optional(),
});
type AppointmentReminderData = z.infer<typeof appointmentReminderSchema>;

// -------------- Twilio --------------
async function sendSMS(to: string, body: string): Promise<{ ok: boolean; sid?: string; status?: string; error?: string; twilio_code?: number; }> {
  const account = TWILIO_ACCOUNT_SID;
  const token   = TWILIO_AUTH_TOKEN;

  if (!account || !token) return { ok: false, error: "Twilio credentials missing" };
  if (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM_NUMBER) {
    return { ok: false, error: "Provide TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`;
  const form = new URLSearchParams({
    To: to,
    Body: body,
  });

  if (TWILIO_MESSAGING_SERVICE_SID) form.append("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
  else form.append("From", TWILIO_FROM_NUMBER);

  if (TWILIO_STATUS_CALLBACK_URL) form.append("StatusCallback", TWILIO_STATUS_CALLBACK_URL);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${account}:${token}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    // Twilio error is JSON: { code, message, more_info, status }
    try {
      const err = JSON.parse(text);
      return {
        ok: false,
        error: `Twilio ${err?.status ?? res.status}: ${err?.message ?? "Unknown error"}`,
        twilio_code: err?.code,
      };
    } catch {
      return { ok: false, error: `Twilio ${res.status}: ${text}` };
    }
  }

  try {
    const j = JSON.parse(text);
    return { ok: true, sid: j.sid, status: j.status };
  } catch {
    return { ok: true, sid: undefined, status: "queued" };
  }
}

// -------------- Message Builder --------------
function buildMessage(d: AppointmentReminderData): string {
  if (d.custom_message?.trim()) return d.custom_message.trim().slice(0, 1600);
  let msg = `Hi ${d.patient_name}, this is a reminder of your appointment on ${d.appointment_date} at ${d.appointment_time}`;
  if (d.provider_name) msg += ` with ${d.provider_name}`;
  if (d.location) msg += ` at ${d.location}`;
  msg += ". Please arrive 15 minutes early. Reply STOP to opt out.";
  return msg.slice(0, 1600);
}

// -------------- Handler --------------
const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // AuthN + AuthZ
  const user = await requireUser(req);
  await requireRole(user.id, ["admin", "super_admin"]);

  // Parse + validate
  const body = await req.json().catch(() => ({}));
  const parsed = appointmentReminderSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i: ZodIssue) => ({
      field: i.path.join("."), message: i.message, code: i.code,
    }));
    return json({ error: "Validation failed", details }, 400);
  }
  const data = parsed.data;

  // Env safety (no top-level throw)
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM_NUMBER)) {
    return json({ error: "SERVER_NOT_CONFIGURED", message: "Twilio envs missing (ACCOUNT_SID/AUTH_TOKEN and MessagingService or From)" }, 500);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    // We can still send SMS; just skip DB log
    console.warn("Supabase envs missing (will send SMS but skip logging).");
  }

  // Build + send
  const message = buildMessage(data);
  const sms = await sendSMS(data.phone, message);
  if (!sms.ok) {
    console.error("Appointment reminder SMS failed:", sms.error);
    return json({ error: "TWILIO_ERROR", details: sms.error, twilio_code: sms.twilio_code }, 502);
  }

  // Best-effort log
  try {
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const supabase = makeSupabase();
      const { error: logErr } = await supabase.from("appointment_reminders").insert({
        patient_phone: data.phone,
        patient_name: data.patient_name,
        appointment_date: data.appointment_date,
        appointment_time: data.appointment_time,
        provider_name: data.provider_name,
        location: data.location,
        message_sent: message,
        twilio_sid: sms.sid,
        status: sms.status ?? "queued",
        sent_by: user.id,
        sent_at: new Date().toISOString(),
      });
      if (logErr) console.warn("Failed to log appointment reminder:", logErr);
    }
  } catch (e) {
    console.warn("Logging skipped/failed:", e instanceof Error ? e.message : String(e));
  }

  return json({ success: true, sid: sms.sid, status: sms.status ?? "queued" }, 200);
};

// CORS wrapper
serve(withCORS(handler, ["POST", "OPTIONS"]));
