import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async () => {
  console.log("🔁 Starting notify-stale-checkins...");

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: stale, error: staleErr } = await supabase
    .from("latest_checkin")
    .select("user_id, last_checkin")
    .lt("last_checkin", cutoff);

  if (staleErr) {
    console.error("❌ Error fetching stale check-ins:", staleErr);
    return new Response("Error", { status: 500 });
  }

  if (!stale || stale.length === 0) {
    console.log("✅ No stale users found.");
    return new Response("No users to notify.", { status: 200 });
  }

  console.log(`📋 Found ${stale.length} stale check-ins.`);

  for (const row of stale) {
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("full_name, emergency_email")
      .eq("id", row.user_id)
      .single();

    if (profErr) {
      console.error(`⚠️ Failed to load profile ${row.user_id}:`, profErr);
      continue;
    }

    if (!profile?.emergency_email) {
      console.warn(`⚠️ No emergency email for user ${row.user_id}`);
      continue;
    }

    const subject = `WellFit Alert: No check-in from ${profile.full_name}`;
    const html = `
      <p>Hi there,</p>
      <p><strong>${profile.full_name}</strong> hasn’t checked in for over 7 days
      (last check-in: ${new Date(row.last_checkin).toLocaleString()}).</p>
      <p>Please reach out and ensure they’re okay.</p>
      <p>— The WellFit Community Team</p>
    `;

    const { error: mailErr } = await supabase.functions.invoke("send-email", {
      body: {
        to: profile.emergency_email,
        cc: "info@thewellfitcommunity.org",
        subject,
        html,
      },
    });

    if (mailErr) {
      console.error(`📪 Failed to send email for ${row.user_id}:`, mailErr);
    } else {
      console.log(`✅ Email sent for ${profile.full_name}`);
    }
  }

  return new Response("Stale check-ins processed.", { status: 200 });
});
