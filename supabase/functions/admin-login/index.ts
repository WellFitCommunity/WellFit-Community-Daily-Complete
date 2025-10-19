import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const { headers } = cors(origin, { methods: ["POST", "OPTIONS"] });

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

      // HIPAA AUDIT LOGGING: Log successful admin login
      try {
        await supabaseAdmin.from('audit_logs').insert({
          event_type: 'ADMIN_LOGIN_SUCCESS',
          event_category: 'AUTHENTICATION',
          actor_user_id: user.id,
          actor_ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          actor_user_agent: req.headers.get('user-agent'),
          action: 'ADMIN_LOGIN',
          success: true,
          metadata: {
            expires_in: expiresIn,
            admin_key_hash: adminKey.substring(0, 8) + '...' // First 8 chars only
          }
        });
      } catch (logError) {
        console.error('[Audit Log Error]:', logError);
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
      // HIPAA AUDIT LOGGING: Log failed admin login (invalid key)
      try {
        await supabaseAdmin.from('audit_logs').insert({
          event_type: 'ADMIN_LOGIN_FAILED',
          event_category: 'AUTHENTICATION',
          actor_user_id: user.id,
          actor_ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          actor_user_agent: req.headers.get('user-agent'),
          action: 'ADMIN_LOGIN',
          success: false,
          error_code: 'INVALID_ADMIN_KEY',
          error_message: 'Invalid admin key provided',
          metadata: {
            attempted_key_hash: adminKey.substring(0, 8) + '...'
          }
        });
      } catch (logError) {
        console.error('[Audit Log Error]:', logError);
      }

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
