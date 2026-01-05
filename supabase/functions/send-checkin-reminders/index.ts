// supabase/functions/send-checkin-reminders/index.ts
import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import {
  createLogger,
  getChicagoTime,
  isWithinWindowChicago,
  validateEnvVars,
  type DatabaseTypes,
} from "../shared/types.ts";

// --- Config ---
const RUN_HOUR_CT = 9; // 9:00–9:05 AM CT (change if you prefer)
const FCM_ENDPOINT = "https://fcm.googleapis.com/fcm/send";
const MAX_TOKENS_PER_BATCH = 500; // FCM legacy supports up to 1000, we keep a safety margin

// --- Setup ---
const logger = createLogger("send-checkin-reminders");
validateEnvVars(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FCM_SERVER_KEY"]);

const supabase = createClient<DatabaseTypes>(
  SUPABASE_URL,
  SB_SECRET_KEY);

const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY");

// --- Helpers ---
type TokenRow = {
  user_id: string;
  token: string | null;
  profiles: {
    id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchUsersWithTokens(): Promise<TokenRow[]> {
  const { data, error } = await supabase
    .from("fcm_tokens")
    .select(`
      user_id,
      token,
      profiles ( id, full_name, first_name, last_name )
    `)
    .not("token", "is", null);

  if (error) throw new Error(`Fetch tokens failed: ${error.message}`);
  return (data as TokenRow[]) ?? [];
}

function buildNotificationBody(name: string | null) {
  const friendly = name?.trim() || "there";
  return {
    notification: {
      title: "WellFit Check-in Reminder",
      body: `Hi ${friendly}, it's time for your check-in! Please log your well-being today.`,
    },
    // Optional: add data payload for client-side routing
    // data: { type: "checkin_reminder", navigateTo: "/check-in" },
  };
}

async function sendBatch(tokens: string[], nameForLog = "user") {
  const payload = {
    registration_ids: tokens,
    ...buildNotificationBody(null), // same message for all
  };

  const res = await fetch(FCM_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `key=${FCM_SERVER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`FCM HTTP error ${res.status}: ${JSON.stringify(result).slice(0, 500)}`);
  }
  logger.info("FCM batch sent", {
    tokens: tokens.length,
    success: result.success,
    failure: result.failure,
  });
  return result; // contains per-result errors
}

async function removeInvalidToken(userId: string, token: string) {
  const { error } = await supabase
    .from("fcm_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("token", token);
  if (error) {
    logger.warn("Failed to delete invalid token", { userId, token, error: error.message });
  } else {
    logger.info("Deleted invalid token", { userId, token });
  }
}

// --- Main handler ---
serve(async (req) => {
  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method === "OPTIONS") return handleOptions(req);

  try {
    logger.info("Function invoked", { chicagoTime: getChicagoTime().toISOString() });

    // Time-gate to avoid hourly cron spam
    if (!isWithinWindowChicago(RUN_HOUR_CT, 5)) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Outside scheduled time window",
          chicagoTime: getChicagoTime().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows = await fetchUsersWithTokens();
    if (rows.length === 0) {
      logger.info("No users with FCM tokens found");
      return new Response(JSON.stringify({ success: true, message: "No tokens to send." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare tokens and a log map: index → { userId, token }
    const validRows = rows.filter((r) => !!r.token);
    const tokens = validRows.map((r) => r.token) as string[];
    const batches = chunk(tokens, MAX_TOKENS_PER_BATCH);

    logger.info("Prepared tokens", { totalTokens: tokens.length, batches: batches.length });

    let totalSuccess = 0;
    let totalFailure = 0;
    let removedTokenCount = 0;

    // Send each batch and clean up invalid tokens by mapping indices back to users
    let offset = 0;
    for (const batch of batches) {
      const result = await sendBatch(batch);

      // FCM legacy returns "results": [{message_id: "..."} | {error: "..."}]
      const results: Array<{ message_id?: string; error?: string }> = result.results || [];

      for (let i = 0; i < results.length; i++) {
        const item = results[i];
        const globalIndex = offset + i;
        const row = validRows[globalIndex];
        if (!row) continue;

        if (item.message_id) {
          totalSuccess++;
        } else {
          totalFailure++;
          const code = item.error || "unknown";
          logger.warn("FCM send failure", { userId: row.user_id, token: row.token, code });

          // Remove “unregistered/invalid” tokens
          if (
            code === "NotRegistered" ||
            code === "InvalidRegistration" ||
            code === "MismatchSenderId"
          ) {
            await removeInvalidToken(row.user_id, row.token);
            removedTokenCount++;
          }
        }
      }

      offset += batch.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Check-in reminders processed.",
        sentCount: totalSuccess,
        failedCount: totalFailure,
        removedTokenCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Function error", { message: errorMessage.slice(0, 500) });
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
