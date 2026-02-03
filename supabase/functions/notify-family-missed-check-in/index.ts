// Supabase Edge Function: notify-family-missed-check-in
// Notifies family/emergency contacts when senior misses check-in
// Used by law enforcement SHIELD Program (Senior & Health-Impaired Emergency Liaison Dispatch)
// Deno runtime

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from '../_shared/auditLogger.ts'

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") || "";

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  throw new Error("[notify-family-missed-check-in] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
}

if (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM_NUMBER) {
  throw new Error("[notify-family-missed-check-in] Provide TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER");
}

interface FamilyNotificationRequest {
  seniorName: string;       // Senior's full name
  contactName: string;      // Emergency contact's name
  contactPhone: string;     // Emergency contact's phone (E.164 format)
}

serve(async (req) => {
  const logger = createLogger('notify-family-missed-check-in', req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  try {
    const { seniorName, contactName, contactPhone }: FamilyNotificationRequest = await req.json();

    logger.security('Family missed check-in notification initiated', {
      seniorName,
      contactName
    });

    // Validate inputs
    if (!seniorName || !contactName || !contactPhone) {
      const { headers } = corsFromRequest(req);
      return new Response(
        JSON.stringify({ error: "Missing required fields: seniorName, contactName, contactPhone" }),
        { status: 400, headers }
      );
    }

    // Validate phone number format (E.164)
    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(contactPhone)) {
      const { headers } = corsFromRequest(req);
      return new Response(
        JSON.stringify({
          error: "Invalid phone number format. Must be E.164 format (e.g., +15551234567)"
        }),
        { status: 400, headers }
      );
    }

    // Compose message for emergency contact
    const message = `ALERT: ${seniorName} has missed their scheduled check-in for the WellFit Community SHIELD Program. This message is being sent to you as their emergency contact. Please attempt to contact ${seniorName} or request a welfare check if you cannot reach them. If this is an emergency, please dial 911 immediately.`;

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const formData = new URLSearchParams();
    formData.set("To", contactPhone);
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
      logger.error('Twilio SMS send failed', {
        status: response.status,
        details: responseText,
        seniorName,
        contactName
      });
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
    logger.info('Family notification SMS sent successfully', {
      contactName,
      contactPhone,
      seniorName,
      sid: data.sid,
      status: data.status
    });

    const { headers } = corsFromRequest(req);
    return new Response(
      JSON.stringify({
        success: true,
        message: `Emergency contact ${contactName} notified about ${seniorName}'s missed check-in`,
        sid: data.sid,
        status: data.status
      }),
      {
        status: 200,
        headers
      }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Family missed check-in notification error', {
      error: errorMessage
    });
    const { headers } = corsFromRequest(req);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers }
    );
  }
});
