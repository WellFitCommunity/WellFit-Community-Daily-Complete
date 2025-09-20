import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "https://thewellfitcommunity.org",
  "https://wellfitcommunity.live",
  "http://localhost:3100",
  "https://localhost:3100"
];

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const headers = getCorsHeaders(origin, ALLOWED_ORIGINS);

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
    const { adminKey } = await req.json();

    if (!adminKey) {
      return new Response(
        JSON.stringify({ error: "Admin key is required." }),
        { status: 400, headers }
      );
    }

    const serverAdminSecret = Deno.env.get("ADMIN_SECRET");

    if (!serverAdminSecret) {
      console.error("ADMIN_SECRET is not set in function environment variables.");
      return new Response(
        JSON.stringify({ error: "Server configuration error." }),
        { status: 500, headers }
      );
    }

    if (adminKey === serverAdminSecret) {
      // Initialize Supabase client for admin operations
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing Supabase configuration");
        return new Response(
          JSON.stringify({ error: "Server configuration error." }),
          { status: 500, headers }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Create a secure admin session token using Supabase Auth
      const expiresIn = 60 * 60 * 8; // 8 hours
      const { data: adminSession, error: sessionError } = await supabase.auth.admin.createSession({
        user_id: "admin", // Special admin user ID
        expires_in: expiresIn
      });

      if (sessionError) {
        console.error("Failed to create admin session:", sessionError);
        return new Response(
          JSON.stringify({ error: "Failed to create admin session." }),
          { status: 500, headers }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Admin login successful.",
          token: adminSession.access_token,
          expires_in: expiresIn
        }),
        { status: 200, headers }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid admin key." }),
        { status: 401, headers }
      );
    }

  } catch (err) {
    console.error("Admin login error:", err);
    // Check if err is an instance of Error before accessing err.message
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: errorMessage }),
      { status: 500, headers }
    );
  }
});
