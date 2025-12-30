// Supabase Edge Function: create-patient-telehealth-token
// Creates secure meeting token for patients to join telehealth sessions

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("create-patient-telehealth-token");

const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
const DAILY_API_URL = "https://api.daily.co/v1";

const SERVICE_KEY = SB_SECRET_KEY;

if (!DAILY_API_KEY) {
  throw new Error("DAILY_API_KEY not configured");
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

serve(async (req: Request) => {
  // Handle CORS preflight with dynamic origin validation
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  // Get CORS headers for this request's origin
  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Authenticate request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await sb.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { session_id, patient_name } = await req.json();

    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get session details
    const { data: session, error: sessionError } = await sb
      .from("telehealth_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is the patient for this session
    if (session.patient_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized access to this session" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Daily.co meeting token for patient
    const tokenResponse = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: session.room_name,
          user_name: patient_name || user.email || "Patient",
          is_owner: false,
          enable_recording: false, // Patients cannot control recording
          start_audio_off: false,
          start_video_off: false,
        },
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error("Daily.co token error", { errorText, status: tokenResponse.status });
      throw new Error("Failed to create patient token");
    }

    const tokenData = await tokenResponse.json();

    // Log patient joining session
    await sb.from("phi_access_logs").insert({
      user_id: user.id,
      patient_id: user.id,
      access_type: "telehealth_patient_join",
      resource: `session:${session_id}`,
      access_reason: "Patient joining telehealth session",
      ip_address: req.headers.get("x-forwarded-for") || null, // inet type - use null if no IP available
    });

    return new Response(
      JSON.stringify({
        token: tokenData.token,
        room_url: session.room_url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logger.error("Error in create-patient-telehealth-token", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
