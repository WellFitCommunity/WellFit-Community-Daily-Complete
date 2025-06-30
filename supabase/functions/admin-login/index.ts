import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
// We might not need createClient from supabase-js if we're just checking an env var
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { adminKey } = await req.json();

    if (!adminKey) {
      return new Response(
        JSON.stringify({ error: "Admin key is required." }),
        { status: 400, headers }
      );
    }

    const serverAdminSecret = Deno.env.get("REACT_APP_ADMIN_SECRET");

    if (!serverAdminSecret) {
      console.error("REACT_APP_ADMIN_SECRET is not set in function environment variables.");
      return new Response(
        JSON.stringify({ error: "Server configuration error." }),
        { status: 500, headers }
      );
    }

    if (adminKey === serverAdminSecret) {
      // Admin key is valid.
      // Similar to user login, we'll return a placeholder token for now.
      // Actual session management (e.g., secure cookie, proper JWT) will be part of Step 7.
      const placeholderAdminToken = "placeholder-admin-jwt-token";

      return new Response(
        JSON.stringify({
          success: true,
          message: "Admin login successful.",
          // The frontend will need a way to identify an admin session.
          // A token is one way, even if it's a placeholder for now.
          token: placeholderAdminToken
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
