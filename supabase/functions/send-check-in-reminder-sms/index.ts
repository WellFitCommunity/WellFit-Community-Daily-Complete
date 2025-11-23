// Supabase Edge Function: send-check-in-reminder-sms
// Sends welfare check reminder SMS to seniors for law enforcement "Are You OK" program
// Deno runtime

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") || "";

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  throw new Error("[send-check-in-reminder-sms] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
}

if (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM_NUMBER) {
  throw new Error("[send-check-in-reminder-sms] Provide TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER");
}

interface CheckInReminderRequest {
  phone: string;  // E.164 format (e.g., +15551234567)
  name: string;   // Senior's first name
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  try {
    const { phone, name }: CheckInReminderRequest = await req.json();

    // Validate inputs
    if (!phone || !name) {
      const { headers } = corsFromRequest(req);
      return new Response(
        JSON.stringify({ error: "Missing required fields: phone, name" }),
        { status: 400, headers }
      );
    }

    // Validate phone number format (E.164)
    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(phone)) {
      const { headers } = corsFromRequest(req);
      return new Response(
        JSON.stringify({
          error: "Invalid phone number format. Must be E.164 format (e.g., +15551234567)"
        }),
        { status: 400, headers }
      );
    }

    // Compose message for senior welfare check
    const message = `Hi ${name}, this is your daily check-in reminder from the WellFit Community "Are You OK?" program. Please complete your check-in at your earliest convenience. If you need assistance, please contact your emergency contact or dial 911. Thank you!`;

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const formData = new URLSearchParams();
    formData.set("To", phone);
    formData.set("Body", message);

    if (TWILIO_MESSAGING_SERVICE_SID) {
      formData.set("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
    } else {
      formData.set("From", TWILIO_FROM_NUMBER);
    }

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[send-check-in-reminder-sms] Twilio error: ${response.status} ${responseText}`);
      const { headers } = corsFromRequest(req);
      return new Response(
        JSON.stringify({
          error: "Failed to send SMS",
          details: responseText
        }),
        { status: 500, headers }
      );
    }

    const data = JSON.parse(responseText);
    // PHI: Phone number not logged per HIPAA compliance - SMS sent successfully

    const { headers } = corsFromRequest(req);
    return new Response(
      JSON.stringify({
        success: true,
        message: `Check-in reminder sent to ${name}`,
        sid: data.sid,
        status: data.status
      }),
      {
        status: 200,
        headers
      }
    );

  } catch (error) {
    console.error("[send-check-in-reminder-sms] Error:", error);
    const { headers } = corsFromRequest(req);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers }
    );
  }
});
