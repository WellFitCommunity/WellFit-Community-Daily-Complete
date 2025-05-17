import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY")!;

function isTuesdayOrFriday(): boolean {
  const today = new Date().getUTCDay(); // 0 = Sunday
  return today === 2 || today === 5;    // 2 = Tuesday, 5 = Friday
}

serve(async () => {
  if (!isTuesdayOrFriday()) {
    return new Response("⏱ Not Tuesday or Friday – skipping.");
  }

  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(); // 72 hours ago

  const { data: stale, error } = await supabase
    .from("latest_checkin")
    .select("user_id")
    .lte("last_checkin", cutoff);

  if (error) {
    console.error("❌ Error fetching stale check-ins:", error);
    return new Response("Query failed", { status: 500 });
  }

  if (!stale?.length) {
    return new Response("✅ Everyone is fresh – no reminders sent.");
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
            title: "👋 We Miss You!",
            body: "It’s been a few days since your last check-in. Tap to log today’s update.",
          },
        }),
      })
    )
  );

  return new Response(`🚀 Sent ${tokens?.length ?? 0} reminders.`);
});
