import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Zod schema for login payload
const loginSchema = z.object({
  phone: z.string().min(1, "Phone is required."),
  // Password complexity is enforced at registration. Here, we just check for presence.
  password: z.string().min(1, "Password is required."),
});

type LoginBody = z.infer<typeof loginSchema>;

// This function assumes that the Supabase project has been configured
// to allow users to sign in with their phone number and a password.
// The corresponding registration function (`../register/index.ts`)
// creates users in Supabase Auth using their phone and password.

const MAX_REQUESTS = 5; // Max attempts
const TIME_WINDOW_MINUTES = 15; // Time window in minutes

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
    const supabaseUrlForRateLimit = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL");
    const serviceRoleKeyForRateLimit = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_ROLE");

    if (!supabaseUrlForRateLimit || !serviceRoleKeyForRateLimit) {
      console.error("CRITICAL: Missing Supabase URL or Service Role Key for rate limiting in login function.");
      return new Response(JSON.stringify({ error: "Server configuration error for rate limiting." }), { status: 500, headers });
    }
    const supabaseAdminForRateLimit = createClient(supabaseUrlForRateLimit, serviceRoleKeyForRateLimit);

    const clientIp = req.headers.get("x-forwarded-for")?.split(',')[0].trim() ||
                     req.headers.get("cf-connecting-ip") || // Cloudflare
                     req.headers.get("x-real-ip") || // Nginx
                     "unknown"; // Fallback

    if (clientIp === "unknown") {
      console.warn("Could not determine client IP for rate limiting in login.");
      // Decide if you want to block or allow if IP is unknown. For now, allow but log.
    } else {
      // Log login attempt
      const { error: logError } = await supabaseAdminForRateLimit
        .from('rate_limit_logins')
        .insert({ ip_address: clientIp });

      if (logError) {
        console.error("Error logging login attempt for rate limiting:", logError);
        // Potentially allow request if logging fails
      }

      // Check rate limit
      const timeWindowStart = new Date(Date.now() - TIME_WINDOW_MINUTES * 60 * 1000).toISOString();
      const { data: attempts, error: countError } = await supabaseAdminForRateLimit
        .from('rate_limit_logins')
        .select('attempted_at', { count: 'exact' })
        .eq('ip_address', clientIp)
        .gte('attempted_at', timeWindowStart);

      if (countError) {
        console.error("Error counting login attempts for rate limiting:", countError);
        return new Response(JSON.stringify({ error: "Error checking rate limit. Please try again later." }), { status: 500, headers });
      }

      if (attempts && attempts.length >= MAX_REQUESTS) {
        return new Response(JSON.stringify({ error: "Too many login attempts. Please try again later." }), { status: 429, headers });
      }
    }

    const rawBody = await req.json();
    const validationResult = loginSchema.safeParse(rawBody);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }));
      return new Response(
        JSON.stringify({ error: "Validation failed", details: errors }),
        { status: 400, headers }
      );
    }

    const { phone, password } = validationResult.data;

    // Password complexity rules are enforced at registration, so not checked here.

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
