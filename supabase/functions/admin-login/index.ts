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

      // Extract client IP for logging
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                       req.headers.get('cf-connecting-ip') ||
                       req.headers.get('x-real-ip') ||
                       'unknown';

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
        await supabase.from('audit_logs').insert({
          event_type: 'ADMIN_LOGIN_SUCCESS',
          event_category: 'AUTHENTICATION',
          actor_user_id: null, // Admin user (special case - no user_id)
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'LOGIN',
          resource_type: 'admin_session',
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
      // Extract client IP for logging
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                       req.headers.get('cf-connecting-ip') ||
                       req.headers.get('x-real-ip') ||
                       'unknown';

      // Initialize Supabase client for logging
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // HIPAA AUDIT LOGGING: Log failed admin login (invalid key)
        try {
          await supabase.from('audit_logs').insert({
            event_type: 'ADMIN_LOGIN_FAILED',
            event_category: 'AUTHENTICATION',
            actor_user_id: null, // Unknown - login failed
            actor_ip_address: clientIp,
            actor_user_agent: req.headers.get('user-agent'),
            operation: 'LOGIN',
            resource_type: 'admin_session',
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

        // SOC 2 SECURITY EVENT LOGGING: Detect failed admin login bursts
        try {
          // Check for multiple failed admin login attempts in last 5 minutes
          const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { count: failedCount } = await supabase
            .from('audit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('event_type', 'ADMIN_LOGIN_FAILED')
            .eq('actor_ip_address', clientIp)
            .gte('timestamp', since);

          // Log security event if 2+ failed admin attempts in 5 minutes (stricter than regular login)
          if (failedCount && failedCount >= 2) {
            await supabase.rpc('log_security_event', {
              p_event_type: 'ADMIN_LOGIN_BURST',
              p_severity: failedCount >= 3 ? 'CRITICAL' : 'HIGH',
              p_description: `${failedCount} failed admin login attempts detected in 5 minutes from IP ${clientIp}`,
              p_source_ip_address: clientIp,
              p_user_id: null,
              p_action_taken: failedCount >= 3 ? 'REQUIRES_INVESTIGATION' : 'MONITORING',
              p_metadata: {
                failed_attempt_count: failedCount,
                time_window_minutes: 5,
                user_agent: req.headers.get('user-agent')
              }
            });
          }
        } catch (burstCheckError) {
          console.error('[Failed Admin Login Burst Detection Error]:', burstCheckError);
        }
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
