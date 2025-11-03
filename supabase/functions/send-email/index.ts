// Supabase Edge Function: send-email
// Sends emails via MailerSend for patient handoff notifications
// Deno runtime

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const MAILERSEND_API_KEY = Deno.env.get("MAILERSEND_API_KEY");
const MAILERSEND_FROM_EMAIL = Deno.env.get("MAILERSEND_FROM_EMAIL");
const MAILERSEND_FROM_NAME = Deno.env.get("MAILERSEND_FROM_NAME") || "WellFit Patient Handoff";

if (!MAILERSEND_API_KEY || !MAILERSEND_FROM_EMAIL) {
  throw new Error("[send-email] Missing MAILERSEND_API_KEY or MAILERSEND_FROM_EMAIL");
}

interface EmailRequest {
  to: { email: string; name: string }[];
  subject: string;
  html: string;
  priority?: 'normal' | 'high' | 'urgent';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html, priority = 'normal' }: EmailRequest = await req.json();

    // Validate inputs
    if (!to || to.length === 0 || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email via MailerSend
    const response = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MAILERSEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: {
          email: MAILERSEND_FROM_EMAIL,
          name: MAILERSEND_FROM_NAME
        },
        to: to,
        subject: subject,
        html: html,
        text: html.replace(/<[^>]*>/g, ''), // Strip HTML for text fallback
        settings: {
          track_clicks: false,
          track_opens: false
        },
        // Priority handling (MailerSend doesn't have native priority, but we log it)
        tags: [priority, 'patient-handoff']
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[send-email] MailerSend error: ${response.status} ${responseText}`);
      return new Response(
        JSON.stringify({
          error: "Failed to send email",
          details: responseText
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    console.log(`[send-email] Successfully sent email to ${to.length} recipient(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sent to ${to.length} recipient(s)`,
        priority
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("[send-email] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
