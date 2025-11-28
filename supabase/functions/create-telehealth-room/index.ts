// Supabase Edge Function: create-telehealth-room
// Creates HIPAA-compliant Daily.co video rooms for telehealth
// Integrates with WellFit encounter tracking

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DAILY_API_KEY = Deno.env.get("DAILY_API_KEY");
const DAILY_API_URL = "https://api.daily.co/v1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!DAILY_API_KEY) {
  throw new Error("DAILY_API_KEY not configured. Please add to Supabase secrets.");
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// CORS headers
const corsHeaders = {
  // CORS handled by shared module,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Parse request body
    const { encounter_id, patient_id, encounter_type } = await req.json();

    if (!encounter_id || !patient_id) {
      return new Response(
        JSON.stringify({ error: "encounter_id and patient_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify provider has access to this patient
    const { data: encounter, error: encounterError } = await sb
      .from("encounters")
      .select("id, patient_id, provider_id")
      .eq("id", encounter_id)
      .single();

    if (encounterError || !encounter || encounter.provider_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized access to this encounter" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Daily.co room
    const roomName = `telehealth-${encounter_id}-${Date.now()}`;

    // Configure room based on encounter type
    const isEmergency = encounter_type === "er" || encounter_type === "emergency";

    const roomConfig = {
      name: roomName,
      privacy: "private" as const,
      properties: {
        // HIPAA compliance features
        enable_chat: true,
        enable_screenshare: true,
        enable_recording: "cloud" as const,
        enable_knocking: !isEmergency, // Skip waiting room for ER
        enable_prejoin_ui: false,

        // Audio quality for stethoscope
        enable_advanced_audio: true,

        // Session limits
        max_participants: isEmergency ? 10 : 2, // Allow more for ER consultations

        // Auto-expire after 24 hours
        exp: Math.floor(Date.now() / 1000) + 86400,

        // Enable SFU for better quality
        sfu_switchover: 0.5,

        // Custom properties for tracking
        metadata: {
          encounter_id,
          patient_id,
          provider_id: user.id,
          encounter_type: encounter_type || "outpatient",
          created_at: new Date().toISOString(),
        },
      },
    };

    const dailyResponse = await fetch(`${DAILY_API_URL}/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify(roomConfig),
    });

    if (!dailyResponse.ok) {
      const errorText = await dailyResponse.text();
      console.error("Daily.co API error:", errorText);
      throw new Error(`Failed to create Daily.co room: ${dailyResponse.status}`);
    }

    const roomData = await dailyResponse.json();

    // Create meeting token for provider (more secure than just room URL)
    const tokenResponse = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: user.email || "Provider",
          is_owner: true,
          enable_recording: "cloud",
        },
      }),
    });

    const tokenData = await tokenResponse.json();

    // Store session in database
    const { data: session, error: sessionError } = await sb
      .from("telehealth_sessions")
      .insert({
        encounter_id,
        patient_id,
        provider_id: user.id,
        room_name: roomName,
        room_url: roomData.url,
        daily_room_id: roomData.id,
        session_token: tokenData.token,
        status: "active",
        encounter_type: encounter_type || "outpatient",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Error storing session:", sessionError);
      // Continue anyway - room is created
    }

    // Log PHI access for HIPAA compliance
    await sb.from("phi_access_logs").insert({
      user_id: user.id,
      patient_id,
      access_type: "telehealth_session",
      resource: `encounter:${encounter_id}`,
      access_reason: `Telehealth ${encounter_type} visit`,
      ip_address: req.headers.get("x-forwarded-for") || null, // inet type - use null if no IP available
    });

    return new Response(
      JSON.stringify({
        room_url: `${roomData.url}?t=${tokenData.token}`,
        room_name: roomName,
        session_id: session?.id,
        encounter_id,
        is_emergency: isEmergency,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in create-telehealth-room:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
