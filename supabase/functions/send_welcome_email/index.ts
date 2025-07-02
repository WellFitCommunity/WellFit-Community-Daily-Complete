import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Zod schema for send_welcome_email payload
const welcomeEmailSchema = z.object({
  email: z.string().email("Invalid 'email' address."),
  full_name: z.string().min(1, "'full_name' is required."),
});

type WelcomeEmailPayload = z.infer<typeof welcomeEmailSchema>;

const SEND_EMAIL_FUNCTION_NAME = "send_email";

console.log("✅ send_welcome_email function initialized. Will call:", SEND_EMAIL_FUNCTION_NAME);

serve(async (req) => {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  try {
    const rawBody = await req.json();
    const validationResult = welcomeEmailSchema.safeParse(rawBody);


    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }));
      return new Response(
        JSON.stringify({ error: "Validation failed", details: errors }),
        { status: 400, headers }
      );

    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: "Missing email or full name" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

    }
    const { email, full_name } = validationResult.data;

    // Prepare payload for the generic 'send_email' function
    const subject = "Welcome to WellFit!";
    const text = `Hi ${full_name},\n\nWelcome to the WellFit Community! We're so glad you're here. If you have any questions, reach out anytime.`;
    const html = text.replace(/\n/g, '<br>'); // Simple HTML version
 phase-1-security-auth-fixes

    const emailPayload = {
      to: email,
      subject,
      text,
      html,
    };

    // Get Supabase client to invoke the other function
    // Note: This requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set in this function's environment
    // if we want to ensure the call is made with admin privileges.
    // Or, if called from client with user's token, it would use that.
    // For backend-to-backend, service role is safer.
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const emailPayload = {
      to: email,
      subject,
      text,
      html,
    };

    // Get Supabase client to invoke the other function
    // Note: This requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set in this function's environment
    // if we want to ensure the call is made with admin privileges.
    // Or, if called from client with user's token, it would use that.
    // For backend-to-backend, service role is safer.
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );


    console.log(`Attempting to invoke ${SEND_EMAIL_FUNCTION_NAME} for welcome email to: ${email}`);
    const { data: functionResponse, error: functionError } = await supabaseClient.functions.invoke(
      SEND_EMAIL_FUNCTION_NAME,
      { body: emailPayload }
    );

    if (functionError) {
      console.error(`Error invoking ${SEND_EMAIL_FUNCTION_NAME}:`, functionError.message);

      // Attempt to provide more specific error if the invoked function returned structured error
      let detail = `Failed to send welcome email via ${SEND_EMAIL_FUNCTION_NAME}: ${functionError.message}`;
      if (functionError.context && typeof functionError.context.error === 'string') {
        detail = functionError.context.error;
      } else if (functionError.context && typeof functionError.context.details === 'string') {
         detail = functionError.context.details;
      }
      return new Response(JSON.stringify({ error: detail }), {
        status: 500, // Or determine status from functionError if possible
        headers,

      return new Response(JSON.stringify({ error: `Failed to send welcome email: ${functionError.message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" },

      });
    }

    console.log(`${SEND_EMAIL_FUNCTION_NAME} invoked successfully. Response:`, functionResponse);
    return new Response(JSON.stringify({ status: "Welcome email dispatch attempted.", response: functionResponse }), {
      status: 200,

      headers,

      headers: { "Content-Type": "application/json" },

    });

  } catch (error) {
    console.error("❌ Error in send_welcome_email function:", error.message);
    return new Response(JSON.stringify({ error: "Internal server error processing welcome email" }), {
      status: 500,

      headers,

      headers: { "Content-Type": "application/json" },

    });
  }
});
