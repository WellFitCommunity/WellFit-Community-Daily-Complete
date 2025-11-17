// Supabase Edge Function: send-sms
// Sends SMS via Twilio for patient handoff notifications
// Deno runtime

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") || "";

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  throw new Error("[send-sms] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
}

if (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM_NUMBER) {
  throw new Error("[send-sms] Provide TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER");
}

interface SMSRequest {
  to: string[]; // Array of phone numbers in E.164 format
  message: string;
  priority?: 'normal' | 'high' | 'urgent';
}

/**
 * Validate phone number in E.164 format
 */
function validatePhone(phone: string): { valid: boolean; error?: string } {
  if (!phone) {
    return { valid: false, error: "Phone number is required" };
  }

  // E.164 format: +[country code][number] (e.g., +14155552671)
  const e164Regex = /^\+[1-9]\d{1,14}$/;

  if (!e164Regex.test(phone)) {
    return { valid: false, error: "Phone must be in E.164 format (e.g., +14155552671)" };
  }

  return { valid: true };
}

serve(async (req) => {
  const logger = createLogger('send-sms', req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, message, priority = 'normal' }: SMSRequest = await req.json();

    // Validate inputs
    if (!to || to.length === 0 || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate all phone numbers before sending
    const invalidPhones: string[] = [];
    for (const phone of to) {
      const validation = validatePhone(phone);
      if (!validation.valid) {
        invalidPhones.push(`${phone}: ${validation.error}`);
      }
    }

    if (invalidPhones.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid phone numbers detected",
          invalid_numbers: invalidPhones
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate message length (Twilio limit is 1600 chars for long SMS)
    if (message.length > 1600) {
      return new Response(
        JSON.stringify({ error: "Message exceeds 1600 character limit" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const results = [];
    const errors = [];

    // Send SMS to each recipient
    for (const phoneNumber of to) {
      const formData = new URLSearchParams();
      formData.set("To", phoneNumber);
      formData.set("Body", message);

      if (TWILIO_MESSAGING_SERVICE_SID) {
        formData.set("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
      } else {
        formData.set("From", TWILIO_FROM_NUMBER);
      }

      // Add status callback for delivery tracking (optional)
      // formData.set("StatusCallback", `${Deno.env.get("SUPABASE_URL")}/functions/v1/sms-status-callback`);

      try {
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
          logger.error("Twilio SMS send failed", {
            phone: phoneNumber,
            status: response.status,
            error: responseText
          });
          errors.push({ phone: phoneNumber, error: responseText });
        } else {
          const data = JSON.parse(responseText);
          results.push({
            phone: phoneNumber,
            sid: data.sid,
            status: data.status
          });
          logger.info("SMS sent successfully", {
            phone: phoneNumber,
            sid: data.sid,
            status: data.status
          });
        }
      } catch (error) {
        logger.error("SMS send exception", {
          phone: phoneNumber,
          error: error instanceof Error ? error.message : String(error)
        });
        errors.push({ phone: phoneNumber, error: error.message });
      }
    }

    // Return response
    if (errors.length === to.length) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to send SMS to all recipients",
          errors
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `SMS sent to ${results.length} of ${to.length} recipient(s)`,
        priority,
        results,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    logger.error("Fatal error in send-sms", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
