// supabase/functions/notify-stale-checkins/index.ts
import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.4";
import {
  createLogger,
  getChicagoTime,
  isWithinWindowChicago,
  validateEnvVars,
  type DatabaseTypes,
} from "../shared/types.ts";

// Optional: cooldown log table name (reuse existing for idempotency by date/week)
const COOLDOWN_TABLE = "inactivity_reminder_log";
const RUN_HOUR_CT = 11; // 11:00–11:05 AM CT window

const logger = createLogger("notify-stale-checkins");

// Validate env upfront
validateEnvVars(["SB_URL", "SB_SERVICE_ROLE_KEY"]);

const supabase = createClient<DatabaseTypes>(
  SUPABASE_URL,
  SB_SECRET_KEY);

type StaleRow = { user_id: string; last_checkin: string | null };
type Profile = { full_name: string | null; emergency_email: string | null };

async function fetchStale(): Promise<StaleRow[]> {
  const cutoffISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("latest_checkin")
    .select("user_id, last_checkin")
    .lt("last_checkin", cutoffISO);

  if (error) throw new Error(`Fetch stale failed: ${error.message}`);
  return data ?? [];
}

// Optional idempotency using week_start_date (same as weekly reminders)
function currentWeekStart(): string {
  // Sunday-start week using Chicago time
  const d = getChicagoTime();
  const day = d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.toISOString().split("T")[0];
}

async function alreadyNotifiedThisWeek(userId: string, weekStart: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(COOLDOWN_TABLE)
    .select("id")
    .eq("user_id", userId)
    .eq("week_start_date", weekStart)
    .maybeSingle();

  if (error) {
    logger.warn("Cooldown check error", { userId, error: error.message });
  }
  return !!data;
}

async function logNotified(userId: string, weekStart: string) {
  const { error } = await supabase.from(COOLDOWN_TABLE).insert({
    user_id: userId,
    week_start_date: weekStart,
    sent_at: new Date().toISOString(),
  });

  if (error) logger.warn("Cooldown log insert error", { userId, error: error.message });
}

async function fetchProfiles(userIds: string[]): Promise<Map<string, Profile>> {
  if (userIds.length === 0) return new Map();

  // Batch fetch profiles
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, emergency_email")
    .in("id", userIds);

  if (error) throw new Error(`Fetch profiles failed: ${error.message}`);

  const map = new Map<string, Profile>();
  for (const row of data ?? []) {
    // @ts-ignore (row.id present in selected columns)
    map.set(row.id, {
      // @ts-ignore
      full_name: row.full_name ?? null,
      // @ts-ignore
      emergency_email: row.emergency_email ?? null,
    });
  }
  return map;
}

async function sendEmergencyEmail(to: string, fullName: string | null, lastCheckin: string | null) {
  const subject = `WellFit Alert: No check-in from ${fullName ?? "a community member"}`;
  const lastStr = lastCheckin ? new Date(lastCheckin).toLocaleString() : "unknown";

  const text = `Hi there,

${fullName ?? "A WellFit member"} hasn’t checked in for over 7 days (last check-in: ${lastStr}).
Please reach out and ensure they’re okay.

— The WellFit Community Team`;

  const html = `
    <p>Hi there,</p>
    <p><strong>${fullName ?? "A WellFit member"}</strong> hasn’t checked in for over 7 days
    (last check-in: ${lastStr}).</p>
    <p>Please reach out and ensure they’re okay.</p>
    <p>— The WellFit Community Team</p>
  `;

  // ✅ underscore name to match folder (supabase/functions/send_email/)
  const { error } = await supabase.functions.invoke("send_email", {
    body: { to, subject, text, html },
  });

  if (error) throw new Error(`send_email function failed: ${error.message}`);
}

serve(async () => {
  try {
    logger.info("Function invoked", { chicagoTime: getChicagoTime().toISOString() });

    // Gate: only run within a tiny window (prevents hourly cron spam)
    if (!isWithinWindowChicago(RUN_HOUR_CT, 5)) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Outside scheduled time window",
          chicagoTime: getChicagoTime().toISOString(),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const stale = await fetchStale();
    if (stale.length === 0) {
      logger.info("No stale users found");
      return new Response(JSON.stringify({ success: true, message: "No users to notify." }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    logger.info("Found stale users", { count: stale.length });

    // Batch profile lookup
    const userIds = Array.from(new Set(stale.map((s) => s.user_id)));
    const profiles = await fetchProfiles(userIds);
    const weekStart = currentWeekStart();

    let sent = 0,
      skipped = 0,
      errors = 0;

    for (const row of stale) {
      const prof = profiles.get(row.user_id);
      if (!prof) {
        logger.warn("Missing profile", { userId: row.user_id });
        skipped++;
        continue;
      }
      if (!prof.emergency_email) {
        logger.warn("No emergency email", { userId: row.user_id });
        skipped++;
        continue;
      }

      // Weekly cooldown
      const done = await alreadyNotifiedThisWeek(row.user_id, weekStart);
      if (done) {
        logger.info("Already notified this week", { userId: row.user_id, weekStart });
        skipped++;
        continue;
      }

      try {
        await sendEmergencyEmail(prof.emergency_email, prof.full_name, row.last_checkin);
        await logNotified(row.user_id, weekStart);
        sent++;
        logger.info("Email sent", { userId: row.user_id, email: prof.emergency_email });
      } catch (err: any) {
        errors++;
        logger.error("Email send failed", {
          userId: row.user_id,
          message: String(err?.message || err).slice(0, 500),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Stale check-ins processed.",
        results: { sent, skipped, errors },
        timestamp: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    logger.error("Execution failed", { message: String(err?.message || err).slice(0, 500) });
    return new Response(JSON.stringify({ success: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
