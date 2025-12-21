// supabase/functions/send-telehealth-appointment-notification/index.ts
// Sends SMS and push notifications when a telehealth appointment is scheduled

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4?dts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") || "";

const SUPABASE_URL = SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = SB_SECRET_KEY || "";

const FIREBASE_SERVER_KEY = Deno.env.get("FIREBASE_SERVER_KEY") || "";

// Helper to send SMS via Twilio
async function sendSMS(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { ok: false, error: "Twilio credentials missing" };
  }
  if (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM_NUMBER) {
    return { ok: false, error: "No Twilio from number or messaging service configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const form = new URLSearchParams({
    To: to,
    Body: body,
  });

  if (TWILIO_MESSAGING_SERVICE_SID) {
    form.append("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
  } else {
    form.append("From", TWILIO_FROM_NUMBER);
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const text = await res.text();
    if (!res.ok) {
      const err = JSON.parse(text);
      return { ok: false, error: err?.message || "Twilio error" };
    }

    const result = JSON.parse(text);
    return { ok: true, sid: result.sid };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

// Helper to send Firebase push notification
async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  if (!FIREBASE_SERVER_KEY) {
    return { ok: false, error: "Firebase server key not configured" };
  }

  try {
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${FIREBASE_SERVER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: fcmToken,
        notification: {
          title,
          body,
          icon: "/logo192.png",
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
        data: data || {},
        priority: "high",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `FCM error: ${res.status} ${text}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

// Format appointment time
function formatAppointmentTime(isoString: string): { date: string; time: string } {
  const date = new Date(isoString);
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return {
    date: dateFormatter.format(date),
    time: timeFormatter.format(date),
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { appointment_id } = await req.json();

    if (!appointment_id) {
      return new Response(JSON.stringify({ error: "appointment_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Get appointment details with patient and provider info
    const { data: appointment, error: aptError } = await supabase
      .from("telehealth_appointments")
      .select(
        `
        id,
        appointment_time,
        encounter_type,
        reason_for_visit,
        patient:profiles!patient_id(
          user_id,
          full_name,
          first_name,
          last_name,
          phone,
          email
        ),
        provider:profiles!provider_id(
          full_name,
          first_name,
          last_name,
          specialty
        )
      `
      )
      .eq("id", appointment_id)
      .single();

    if (aptError || !appointment) {
      return new Response(
        JSON.stringify({ error: "Appointment not found", details: aptError }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const patientPhone = appointment.patient?.phone;
    const patientName =
      appointment.patient?.full_name ||
      `${appointment.patient?.first_name || ""} ${appointment.patient?.last_name || ""}`.trim() ||
      "Patient";
    const providerName =
      appointment.provider?.full_name ||
      `${appointment.provider?.first_name || ""} ${appointment.provider?.last_name || ""}`.trim() ||
      "Your Doctor";
    const providerSpecialty = appointment.provider?.specialty || "";

    const { date, time } = formatAppointmentTime(appointment.appointment_time);

    // Build SMS message
    const smsMessage = `Hi ${patientName}! You have a video appointment scheduled with ${providerName}${providerSpecialty ? ` (${providerSpecialty})` : ""} on ${date} at ${time}. You can join the call from the WellFit app 15 minutes before your appointment. See you then!`;

    // Send SMS if phone number is available
    let smsResult = null;
    if (patientPhone && patientPhone.trim()) {
      smsResult = await sendSMS(patientPhone, smsMessage);
      if (!smsResult.ok) {
        console.error("SMS failed:", smsResult.error);
      }
    }

    // Get FCM tokens for push notification
    const { data: fcmTokens } = await supabase
      .from("fcm_tokens")
      .select("fcm_token")
      .eq("user_id", appointment.patient?.user_id)
      .eq("platform", "web");

    // Send push notifications
    const pushResults = [];
    if (fcmTokens && fcmTokens.length > 0) {
      for (const tokenRecord of fcmTokens) {
        const pushResult = await sendPushNotification(
          tokenRecord.fcm_token,
          "Appointment Scheduled",
          `Video visit with ${providerName} on ${date} at ${time}`,
          {
            appointment_id: appointment.id,
            type: "telehealth_appointment",
            route: "/telehealth-appointments",
          }
        );
        pushResults.push(pushResult);
      }
    }

    // Mark notification as sent
    await supabase
      .from("telehealth_appointments")
      .update({ notification_sent: true })
      .eq("id", appointment_id);

    return new Response(
      JSON.stringify({
        success: true,
        sms_sent: smsResult?.ok || false,
        sms_sid: smsResult?.sid,
        push_sent: pushResults.filter((r) => r.ok).length,
        push_failed: pushResults.filter((r) => !r.ok).length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Notification error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
