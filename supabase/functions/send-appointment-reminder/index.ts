// supabase/functions/send-appointment-reminder/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { withCORS, requireUser, requireRole } from "../_shared/auth.ts";
import { ZodIssue } from "zod"

// ---------------- ENV ----------------
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") ?? "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SB_SECRET_KEY") ??
  "";

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  throw new Error("Missing Twilio configuration (ACCOUNT_SID / AUTH_TOKEN).");
}
if (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM_NUMBER) {
  throw new Error("Provide TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER.");
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Missing Supabase configuration (SUPABASE_URL / SERVICE_ROLE_KEY).");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ---------------- VALIDATION ----------------
const appointmentReminderSchema = z.object({
  phone: z.string().regex(/^\+\d{10,15}$/, { message: "Phone must be in E.164 format (e.g., +15551234567)" }),
  patient_name: z.string().min(1, { message: "Patient name is required" }),
  appointment_date: z.string().min(1, { message: "Appointment date is required" }),
  appointment_time: z.string().min(1, { message: "Appointment time is required" }),
  provider_name: z.string().optional(),
  location: z.string().optional(),
  custom_message: z.string().max(1600, { message: "Message too long (max 1600 chars)" }).optional(),
});
type AppointmentReminderData = z.infer<typeof appointmentReminderSchema>;

// ---------------- TWILIO ----------------
async function sendSMS(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const form = new URLSearchParams();
    form.append("To", to);
    form.append("Body", body);

    if (TWILIO_MESSAGING_SERVICE_SID) {
      form.append("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
    } else {
      form.append("From", TWILIO_FROM_NUMBER);
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Twilio API error: ${text}` };
    }

    const j = await res.json();
    return { success: true, sid: j.sid };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg || "SMS sending failed" };
  }
}

// ---------------- MESSAGE BUILDER ----------------
function generateReminderMessage(data: AppointmentReminderData): string {
  if (data.custom_message?.trim()) {
    return data.custom_message.trim();
  }

  let msg = `Hi ${data.patient_name}, this is a reminder of your appointment on ${data.appointment_date} at ${data.appointment_time}`;
  if (data.provider_name) msg += ` with ${data.provider_name}`;
  if (data.location) msg += ` at ${data.location}`;
  msg += ". Please arrive 15 minutes early. Reply STOP to opt out.";

  // Twilio hard cap is 1600 chars; be safe:
  return msg.slice(0, 1600);
}

// ---------------- HANDLER ----------------
const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // AuthN + AuthZ
    const user = await requireUser(req);
    await requireRole(user.id, ["admin", "super_admin"]);

    // Parse JSON body
    const body = await req.json().catch(() => ({} as unknown));

    // Validate
    const parsed = appointmentReminderSchema.safeParse(body);
    if (!parsed.success) {
    const details = parsed.error.issues.map((issue: ZodIssue) => ({
        field: issue.path.join("."),
        message: issue.message,
        code: issue.code,
    }));
      return new Response(JSON.stringify({ error: "Validation failed", details }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = parsed.data;

    // Build message
    const message = generateReminderMessage(data);

    // Send SMS
    const sms = await sendSMS(data.phone, message);
    if (!sms.success) {
      console.error("Failed to send appointment reminder SMS:", sms.error);
      return new Response(JSON.stringify({ error: "Failed to send appointment reminder", details: sms.error }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Log the send (best-effort; don't fail the response if logging fails)
    const { error: logErr } = await supabase.from("appointment_reminders").insert({
      patient_phone: data.phone,
      patient_name: data.patient_name,
      appointment_date: data.appointment_date,
      appointment_time: data.appointment_time,
      provider_name: data.provider_name,
      location: data.location,
      message_sent: message,
      twilio_sid: sms.sid,
      sent_by: user.id,
      sent_at: new Date().toISOString(),
    });
    if (logErr) console.warn("Failed to log appointment reminder:", logErr);

    return new Response(JSON.stringify({ success: true, message: "Appointment reminder sent successfully", sid: sms.sid }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    // If requireUser/requireRole threw a Response, just return it
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Appointment reminder function error:", msg);
    return new Response(JSON.stringify({ error: "Internal server error", details: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// CORS wrapper
serve(withCORS(handler, ["POST", "OPTIONS"]));
