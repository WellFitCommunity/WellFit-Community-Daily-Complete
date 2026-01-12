// supabase/functions/detect-no-shows/index.ts
// Automated no-show detection processor - called by scheduler/cron

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";
import { withCORS } from "../_shared/auth.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("detect-no-shows");

// -------------- Utils --------------
const getEnv = (k: string, ...alts: string[]) => {
  for (const key of [k, ...alts]) {
    const v = Deno.env.get(key);
    if (v && v.trim()) return v.trim();
  }
  return "";
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });

// -------------- Env --------------
const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = getEnv(
  "SB_SECRET_KEY",
  "SB_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
);
const CRON_SECRET = getEnv("CRON_SECRET");

// Twilio for SMS notifications
const TWILIO_ACCOUNT_SID = getEnv("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = getEnv("TWILIO_AUTH_TOKEN");
const TWILIO_MESSAGING_SERVICE_SID = getEnv("TWILIO_MESSAGING_SERVICE_SID");
const TWILIO_FROM_NUMBER = getEnv("TWILIO_FROM_NUMBER");

// -------------- Types --------------
interface ExpiredAppointment {
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  provider_id: string;
  provider_name: string;
  appointment_time: string;
  duration_minutes: number;
  grace_period_minutes: number;
  minutes_overdue: number;
  patient_no_show_count: number;
  patient_phone: string | null;
  patient_email: string | null;
  tenant_id: string | null;
}

interface NoShowResult {
  appointmentId: string;
  patientName: string;
  providerName: string;
  appointmentTime: string;
  minutesOverdue: number;
  previousNoShowCount: number;
  newNoShowCount: number;
  isRestricted: boolean;
  notificationsSent: {
    patientSms: boolean;
    providerNotified: boolean;
  };
  status: "marked" | "failed" | "skipped";
  error?: string;
}

// -------------- Supabase Client --------------
const makeSupabase = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

// -------------- SMS Notification --------------
const isE164 = (s: string) => /^\+[1-9]\d{6,14}$/.test(s || "");

async function sendSMS(
  to: string,
  body: string
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { ok: false, error: "Twilio credentials missing" };
  }
  if (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM_NUMBER) {
    return { ok: false, error: "Twilio routing not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const form = new URLSearchParams({ To: to, Body: body });

  if (TWILIO_MESSAGING_SERVICE_SID) {
    form.append("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
  } else {
    form.append("From", TWILIO_FROM_NUMBER);
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const text = await res.text();
    if (!res.ok) {
      try {
        const err = JSON.parse(text);
        return { ok: false, error: `Twilio ${err?.status}: ${err?.message}` };
      } catch {
        return { ok: false, error: `Twilio ${res.status}: ${text}` };
      }
    }

    const j = JSON.parse(text);
    return { ok: true, sid: j.sid };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Twilio error: ${msg}` };
  }
}

// -------------- Build No-Show Message --------------
function buildNoShowMessage(patientName: string, appointmentTime: string): string {
  const firstName = patientName.split(" ")[0];
  const date = new Date(appointmentTime);
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `Hi ${firstName}, we missed you at your appointment on ${formatter.format(date)}. Please call us to reschedule at your earliest convenience.`;
}

// -------------- Process Single No-Show --------------
async function processNoShow(
  supabase: SupabaseClient,
  apt: ExpiredAppointment
): Promise<NoShowResult> {
  const result: NoShowResult = {
    appointmentId: apt.appointment_id,
    patientName: apt.patient_name,
    providerName: apt.provider_name,
    appointmentTime: apt.appointment_time,
    minutesOverdue: apt.minutes_overdue,
    previousNoShowCount: apt.patient_no_show_count,
    newNoShowCount: apt.patient_no_show_count + 1,
    isRestricted: false,
    notificationsSent: {
      patientSms: false,
      providerNotified: false,
    },
    status: "failed",
  };

  try {
    // Mark as no-show
    const { data: markResult, error: markError } = await supabase.rpc(
      "mark_appointment_no_show",
      {
        p_appointment_id: apt.appointment_id,
        p_detection_method: "automatic",
        p_notes: `Automatically detected ${apt.minutes_overdue} minutes after appointment end + grace period`,
        p_marked_by: null,
      }
    );

    if (markError) {
      logger.error("Failed to mark no-show", {
        appointmentId: apt.appointment_id,
        error: markError.message,
      });
      result.error = markError.message;
      return result;
    }

    if (!markResult?.success) {
      result.error = markResult?.error || "Unknown error";
      result.status = "skipped";
      return result;
    }

    result.newNoShowCount = markResult.new_no_show_count;
    result.isRestricted = markResult.is_restricted;
    result.status = "marked";

    // Send patient SMS notification if enabled and phone available
    if (
      markResult.should_notify_patient &&
      apt.patient_phone &&
      isE164(apt.patient_phone)
    ) {
      const message = buildNoShowMessage(apt.patient_name, apt.appointment_time);
      const smsResult = await sendSMS(apt.patient_phone, message);
      result.notificationsSent.patientSms = smsResult.ok;

      if (!smsResult.ok) {
        logger.warn("Failed to send no-show SMS", {
          appointmentId: apt.appointment_id,
          error: smsResult.error,
        });
      }
    }

    // Update no-show log with notification status
    await supabase
      .from("no_show_log")
      .update({
        patient_notified: result.notificationsSent.patientSms,
        provider_notified: result.notificationsSent.providerNotified,
      })
      .eq("appointment_id", apt.appointment_id)
      .order("detected_at", { ascending: false })
      .limit(1);

    logger.info("No-show processed", {
      appointmentId: apt.appointment_id,
      patientName: apt.patient_name,
      newNoShowCount: result.newNoShowCount,
      isRestricted: result.isRestricted,
    });

    return result;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.error = msg;
    logger.error("Error processing no-show", {
      appointmentId: apt.appointment_id,
      error: msg,
    });
    return result;
  }
}

// -------------- Main Handler --------------
const handler = async (req: Request): Promise<Response> => {
  // Allow GET for health checks, POST for actual processing
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  // For GET requests, just return health status
  if (req.method === "GET") {
    return json({
      status: "healthy",
      service: "detect-no-shows",
      timestamp: new Date().toISOString(),
    });
  }

  // Security: Verify cron secret or admin auth
  const authHeader = req.headers.get("Authorization");
  const cronSecretHeader = req.headers.get("X-Cron-Secret");

  if (CRON_SECRET && cronSecretHeader === CRON_SECRET) {
    // Valid cron secret - proceed
  } else if (authHeader?.startsWith("Bearer ")) {
    // Verify JWT - must be admin/super_admin
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return json({ error: "Server not configured" }, 500);
    }
    const supabase = makeSupabase();
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Check if admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return json({ error: "Forbidden - admin access required" }, 403);
    }
  } else {
    return json({ error: "Unauthorized" }, 401);
  }

  // Parse request body
  let tenantId: string | null = null;
  let batchSize = 100;
  let dryRun = false;

  try {
    const body = await req.json();
    if (body.tenant_id) {
      tenantId = body.tenant_id;
    }
    if (body.batch_size && typeof body.batch_size === "number") {
      batchSize = Math.min(Math.max(body.batch_size, 1), 500);
    }
    if (body.dry_run === true) {
      dryRun = true;
    }
  } catch {
    // Use defaults
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return json({ error: "Server not configured" }, 500);
  }

  const supabase = makeSupabase();

  logger.info("Starting no-show detection", { tenantId, batchSize, dryRun });

  // Get expired appointments
  const { data: expiredAppointments, error: fetchErr } = await supabase.rpc(
    "detect_expired_appointments",
    {
      p_tenant_id: tenantId,
      p_batch_size: batchSize,
    }
  );

  if (fetchErr) {
    logger.error("Failed to fetch expired appointments", {
      error: fetchErr.message,
    });
    return json({ error: "Failed to fetch expired appointments" }, 500);
  }

  if (!expiredAppointments || expiredAppointments.length === 0) {
    logger.info("No expired appointments found");
    return json({
      success: true,
      timestamp: new Date().toISOString(),
      dryRun,
      summary: {
        detected: 0,
        marked: 0,
        failed: 0,
        skipped: 0,
      },
      results: [],
    });
  }

  logger.info(`Found ${expiredAppointments.length} expired appointments`);

  // If dry run, just return what would be processed
  if (dryRun) {
    return json({
      success: true,
      timestamp: new Date().toISOString(),
      dryRun: true,
      summary: {
        detected: expiredAppointments.length,
        wouldMark: expiredAppointments.length,
      },
      appointments: expiredAppointments.map((apt: ExpiredAppointment) => ({
        appointmentId: apt.appointment_id,
        patientName: apt.patient_name,
        providerName: apt.provider_name,
        appointmentTime: apt.appointment_time,
        minutesOverdue: apt.minutes_overdue,
        previousNoShowCount: apt.patient_no_show_count,
      })),
    });
  }

  // Process each expired appointment
  const results: NoShowResult[] = [];
  let marked = 0;
  let failed = 0;
  let skipped = 0;

  for (const apt of expiredAppointments) {
    const result = await processNoShow(supabase, apt);
    results.push(result);

    if (result.status === "marked") {
      marked++;
    } else if (result.status === "failed") {
      failed++;
    } else {
      skipped++;
    }
  }

  logger.info("No-show detection completed", {
    detected: expiredAppointments.length,
    marked,
    failed,
    skipped,
  });

  return json({
    success: true,
    timestamp: new Date().toISOString(),
    dryRun: false,
    summary: {
      detected: expiredAppointments.length,
      marked,
      failed,
      skipped,
    },
    results,
  });
};

// CORS wrapper with POST and GET
serve(withCORS(handler, ["POST", "GET", "OPTIONS"]));
