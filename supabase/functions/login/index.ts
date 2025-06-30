import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// This function assumes that the Supabase project has been configured
// to allow users to sign in with their phone number and a password.
// The corresponding registration function (`../register/index.ts`)
// creates users in Supabase Auth using their phone and password.

serve(async (req: Request) => {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": req.headers.get("Origin") || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Apikey",
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    const { phone, password } = await req.json();

    if (!phone || !password) {
      return new Response(
        JSON.stringify({ error: "Phone and password are required." }),
        { status: 400, headers }
      );
    }

    // Frontend should ideally enforce this, but a check here is good defense.
    const passwordRules = [
      { test: (pw: string) => pw.length >= 8, message: "at least 8 characters" },
      { test: (pw: string) => /[A-Z]/.test(pw), message: "one uppercase letter" },
      { test: (pw: string) => /\d/.test(pw), message: "one number" },
      { test: (pw: string) => /[^A-Za-z0-9]/.test(pw), message: "one special character" },
    ];
    const failedPasswordRules = passwordRules
      .filter(rule => !rule.test(password))
      .map(rule => rule.message);

    if (failedPasswordRules.length > 0) {
      return new Response(
        JSON.stringify({ error: `Password must contain ${failedPasswordRules.join(", ")}.` }),
        { status: 400, headers }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("CRITICAL: Missing Supabase URL or Anon Key for login function.");
      return new Response(
        JSON.stringify({ error: "Server configuration error. Please try again later." }),
        { status: 500, headers }
      );
    }

    const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    // Attempt to sign in using phone and password.
    // This relies on Supabase Auth being configured to use phone as an identifier for password auth.
    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      phone: phone,
      password: password,
    });

    if (signInError) {
      console.warn(`Login attempt failed for phone ${phone}: ${signInError.message} (Status: ${signInError.status})`);

      let errorMessage = "Invalid phone number or password."; // Default user-facing error
      let errorStatus = 401; // Unauthorized

      if (signInError.message.toLowerCase().includes("invalid login credentials")) {
        // Specific message for this common case
      } else if (signInError.message.toLowerCase().includes("user not found")) {
        // Handled by "invalid login credentials" generally
      } else if (signInError.message.toLowerCase().includes("email not confirmed") || signInError.message.toLowerCase().includes("phone not confirmed")) {
        errorMessage = "Account not confirmed. Please check your email/messages for a confirmation link.";
        errorStatus = 403; // Forbidden
      } else {
        // For other Supabase errors, log them but return a generic message to the user
        console.error("Unexpected Supabase signInError:", signInError);
        errorMessage = "An error occurred during login. Please try again.";
        errorStatus = 500; // Internal Server Error
      }

      return new Response(
        JSON.stringify({ error: errorMessage, details: signInError.message }), // Include details for debugging if needed, but error for client
        { status: errorStatus, headers }
      );
    }

    if (!sessionData || !sessionData.session || !sessionData.user) {
      console.error("Supabase signInWithPassword returned no error but also no session/user for phone:", phone);
      return new Response(
        JSON.stringify({ error: "Login failed due to an unexpected issue. Please try again." }),
        { status: 500, headers }
      );
    }

    // Login successful
    console.log(`User ${sessionData.user.id} (phone: ${phone}) logged in successfully.`);
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          userId: sessionData.user.id,
          token: sessionData.session.access_token,
          refreshToken: sessionData.session.refresh_token,
          expiresAt: sessionData.session.expires_at,
          // Include user details if needed by the client immediately after login
          // user: { id: sessionData.user.id, phone: sessionData.user.phone, email: sessionData.user.email }
        }
      }),
      { status: 200, headers }
    );

  } catch (err) {
    console.error("Unhandled error in login function:", err);
    // Check if err has a message property
    const detailMessage = (err instanceof Error) ? err.message : "Unknown error structure";
    return new Response(
      JSON.stringify({ error: "Internal Server Error. Please try again later.", details: detailMessage }),
      { status: 500, headers }
    );
  }
});
