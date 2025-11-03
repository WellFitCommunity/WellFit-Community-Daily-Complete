// supabase/functions/weekly-inactivity-reminders/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createLogger,
  getChicagoTime,
  getWeekStart,
  isWithinWindowChicago,
  validateEnvVars,
  type DatabaseTypes,
  type Logger,
} from "../shared/types.ts";

interface FCMMessage {
  to: string;
  notification: { title: string; body: string };
  data?: Record<string, string>;
}

class InactivityReminderService {
  private supabase;
  private logger: Logger;
  private fcmServerKey: string;

  constructor() {
    this.logger = createLogger("weekly-inactivity-reminders");

    validateEnvVars(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FCM_SERVER_KEY"]);

    this.supabase = createClient<DatabaseTypes>(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

    this.fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
  }

  async findInactiveUsers(): Promise<
    { userId: string; email: string; daysSinceLastCheckin: number }[]
  > {
    // Fetch non-admin users; compute inactivity threshold in app (clear & safe)
    const { data, error } = await this.supabase
      .from("users")
      .select("id, email, last_checkin_at, is_admin")
      .eq("is_admin", false);

    if (error) throw new Error(`Failed to fetch users: ${error.message}`);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const out = (data ?? [])
      .filter((u) => {
        const last = u.last_checkin_at ? new Date(u.last_checkin_at) : null;
        return !last || last < sevenDaysAgo;
      })
      .map((u) => {
        const last = u.last_checkin_at ? new Date(u.last_checkin_at) : null;
        const days = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : 999;
        return { userId: u.id, email: u.email, daysSinceLastCheckin: days };
      });

    this.logger.info("Found inactive users", { count: out.length });
    return out;
  }

  async checkCooldown(userId: string, weekStartDate: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("inactivity_reminder_log")
      .select("id")
      .eq("user_id", userId)
      .eq("week_start_date", weekStartDate)
      .maybeSingle();

    if (error) {
      this.logger.warn("Error checking cooldown", { userId, error: error.message });
    }
    return !!data;
  }

  async getDeviceTokens(userId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (error) {
      this.logger.warn("Failed to fetch device tokens", { userId, error: error.message });
      return [];
    }
    return (data ?? []).map((row) => row.token);
  }

  async sendFCMNotification(token: string, message: Omit<FCMMessage, "to">): Promise<boolean> {
    try {
      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          Authorization: `key=${this.fcmServerKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...message, to: token }),
      });

      const result = await res.json().catch(() => ({} as any));
      if (!res.ok || (result && result.failure === 1)) {
        this.logger.warn("FCM send failed", {
          token: token.slice(0, 10) + "...",
          status: res.status,
          result,
        });
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.error("FCM request failed", { message: String(err?.message || err).slice(0, 500) });
      return false;
    }
  }

  async logReminderSent(userId: string, weekStartDate: string): Promise<void> {
    const { error } = await this.supabase.from("inactivity_reminder_log").insert({
      user_id: userId,
      week_start_date: weekStartDate,
      sent_at: new Date().toISOString(),
    });

    if (error) this.logger.error("Failed to log reminder", { userId, error: error.message });
  }

  async processReminders(): Promise<{ sent: number; skipped: number; errors: number }> {
    const chicagoTime = getChicagoTime();
    const weekStartDate = getWeekStart(chicagoTime);

    this.logger.info("Starting reminder processing", {
      chicagoTime: chicagoTime.toISOString(),
      weekStartDate,
    });

    const inactiveUsers = await this.findInactiveUsers();
    let sent = 0,
      skipped = 0,
      errors = 0;

    for (const user of inactiveUsers) {
      try {
        const alreadySent = await this.checkCooldown(user.userId, weekStartDate);
        if (alreadySent) {
          this.logger.info("Skipping user - reminder already sent this week", { userId: user.userId });
          skipped++;
          continue;
        }

        const tokens = await this.getDeviceTokens(user.userId);
        if (tokens.length === 0) {
          this.logger.warn("No active device tokens found", { userId: user.userId });
          skipped++;
          continue;
        }

        const message = {
          notification: {
            title: "We miss you at WellFit!",
            body:
              user.daysSinceLastCheckin === 999
                ? "Take a moment to check in and let us know how you're doing."
                : `It's been ${user.daysSinceLastCheckin} days since your last check-in. How are you feeling today?`,
          },
          data: {
            type: "inactivity_reminder",
            days_since_checkin: String(user.daysSinceLastCheckin),
          },
        };

        const unique = Array.from(new Set(tokens));
        let ok = 0,
          fail = 0;
        for (const token of unique) {
          (await this.sendFCMNotification(token, message)) ? ok++ : fail++;
        }

        if (ok > 0) {
          await this.logReminderSent(user.userId, weekStartDate);
          sent++;
          this.logger.info("Reminder sent", { userId: user.userId, ok, fail, tokens: unique.length });
        } else {
          errors++;
          this.logger.error("All FCM sends failed for user", { userId: user.userId, fail });
        }
      } catch (err: any) {
        errors++;
        this.logger.error("Error processing user reminder", {
          userId: user.userId,
          message: String(err?.message || err).slice(0, 500),
        });
      }
    }

    return { sent, skipped, errors };
  }
}

serve(async () => {
  const service = new InactivityReminderService();
  const logger = createLogger("weekly-inactivity-reminders");

  try {
    logger.info("Function invoked", {
      chicagoTime: getChicagoTime().toISOString(),
    });

    // Gate: only 10:00–10:05 AM America/Chicago
    if (!isWithinWindowChicago(10, 5)) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Outside scheduled time window",
          chicagoTime: getChicagoTime().toISOString(),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const results = await service.processReminders();

    logger.info("Reminder processing completed", results);
    return new Response(
      JSON.stringify({
        success: true,
        message: "Weekly inactivity reminders processed",
        results,
        timestamp: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    logger.error("Function execution failed", { message: String(err?.message || err).slice(0, 500) });
    return new Response(
      JSON.stringify({
        success: false,
        error: String(err?.message || err),
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
