import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SEND_EMAIL_FUNCTION_NAME = "send_email";

console.log("✅ send_welcome_email function initialized. Will call:", SEND_EMAIL_FUNCTION_NAME);

serve(async (req) => {
  try {
    const { email, full_name } = await req.json();

    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: "Missing email or full name" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Prepare payload for the generic 'send_email' function
    const subject = "Welcome to WellFit!";
    const text = `Hi ${full_name},\n\nWelcome to the WellFit Community! We're so glad you're here. If you have any questions, reach out anytime.`;
    const html = text.replace(/\n/g, '<br>'); // Simple HTML version

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
      return new Response(JSON.stringify({ error: `Failed to send welcome email: ${functionError.message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`${SEND_EMAIL_FUNCTION_NAME} invoked successfully. Response:`, functionResponse);
    return new Response(JSON.stringify({ status: "Welcome email dispatch attempted.", response: functionResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ Error in send_welcome_email function:", error.message);
    return new Response(JSON.stringify({ error: "Internal server error processing welcome email" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
