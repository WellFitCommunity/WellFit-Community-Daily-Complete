import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const URL = SUPABASE_URL;
const KEY = SB_SECRET_KEY;
const supabaseService = createClient(URL, KEY);
const logger = createLogger("update-profile-note");

serve(async (req) => {
  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method === "OPTIONS") return handleOptions(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { id, notes } = await req.json();
    const { error } = await supabaseService
      .from("profiles")
      .update({ notes })
      .eq("id", id);

    if (error) {
      logger.error("Failed to update profile note", { profileId: id, error: error.message });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Unhandled error in update-profile-note", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
