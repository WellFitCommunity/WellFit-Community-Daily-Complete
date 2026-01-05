import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const supabase = createClient(
  SUPABASE_URL,
  SB_SECRET_KEY);

const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY");
const logger = createLogger("send-stale-reminders");

function isTuesdayOrFriday(): boolean {
  const today = new Date().getUTCDay(); // 0 = Sunday
  return today === 2 || today === 5;    // 2 = Tuesday, 5 = Friday
}

serve(async (req) => {
  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method === "OPTIONS") return handleOptions(req);

  try {
    if (!isTuesdayOrFriday()) {
      return new Response(
        JSON.stringify({ success: true, message: "Not Tuesday or Friday - skipping" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(); // 72 hours ago

    const { data: stale, error } = await supabase
      .from("latest_checkin")
      .select("user_id")
      .lte("last_checkin", cutoff);

    if (error) {
      logger.error("Error fetching stale check-ins", { error: error.message, code: error.code });
      return new Response(
        JSON.stringify({ success: false, error: "Query failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!stale?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "Everyone is fresh - no reminders sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: tokens } = await supabase
      .from("device_tokens")
      .select("token")
      .in("user_id", stale.map((u) => u.user_id));

    await Promise.all(
      (tokens ?? []).map(({ token }) =>
        fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${FCM_SERVER_KEY}`,
          },
          body: JSON.stringify({
            to: token,
            notification: {
              title: "We Miss You!",
              body: "It's been a few days since your last check-in. Tap to log today's update.",
            },
          }),
        })
      )
    );

    logger.info("Stale reminders sent", { count: tokens?.length ?? 0 });
    return new Response(
      JSON.stringify({ success: true, sentCount: tokens?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Unhandled error in send-stale-reminders", { error: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
