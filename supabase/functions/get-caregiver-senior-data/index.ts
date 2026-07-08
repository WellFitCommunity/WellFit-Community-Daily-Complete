// supabase/functions/get-caregiver-senior-data/index.ts
//
// Server-side BFF for caregiver PHI access (T2 fix).
//
// Caregivers do NOT have a Supabase auth session — they hold an app-level
// caregiver session token (issued by the /caregiver-access PIN flow). The old
// SeniorViewPage / SeniorReportsPage validated that token client-side but then
// fetched PHI with the ANON key — which RLS correctly blocks (profiles → 401,
// check_ins → 0 rows). So the pages were secure-by-accident but non-functional.
//
// This function is the correct pattern:
//   1. validate the caregiver session token SERVER-SIDE (authoritative),
//   2. derive the authorized senior_id FROM THE SESSION (never from client input),
//   3. return ONLY that senior's data using the service role.
//
// The browser must never query PHI with the anon key again.
//
// Auth model: verify_jwt = false (no Supabase JWT exists for caregivers); the
// caregiver session token IS the credential, validated in-code below.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseClient.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

interface RequestBody {
  sessionToken?: string;
  pageName?: string;
  days?: number; // check-in look-back window (default 30, clamped 1..366)
}

// Shape returned by validate_caregiver_session (public RPC, verified live).
interface SessionValidation {
  valid?: boolean;
  senior_id?: string;
  senior_name?: string;
  caregiver_name?: string;
  expires_at?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;
const CHECKIN_LIMIT = 1000; // safety cap for report periods

serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const { headers: corsHeaders } = corsFromRequest(req);
  const logger = createLogger("get-caregiver-senior-data", req);
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const sessionToken = body.sessionToken?.trim();
    if (!sessionToken) return json(400, { error: "Missing sessionToken" });

    const admin = createAdminClient();

    // 1. Validate the caregiver session SERVER-SIDE — authoritative senior_id.
    const { data: validation, error: validationError } = await admin.rpc(
      "validate_caregiver_session",
      { p_session_token: sessionToken },
    );
    if (validationError) {
      logger.error("caregiver session validation errored", { error: validationError.message });
      return json(500, { error: "Session validation failed" });
    }

    const session = (validation ?? null) as SessionValidation | null;
    if (!session?.valid || !session.senior_id) {
      logger.security("caregiver data access denied — invalid/expired session");
      return json(401, { error: "Session invalid or expired" });
    }
    // The senior comes from the validated SESSION, never from client input —
    // a caregiver with a valid session for senior A cannot request senior B.
    const seniorId = session.senior_id;

    // 2. Best-effort page-view audit (non-fatal).
    const { error: auditError } = await admin.rpc("log_caregiver_page_view", {
      p_session_token: sessionToken,
      p_page_name: body.pageName ?? "senior_dashboard",
    });
    if (auditError) {
      logger.warn("caregiver page-view audit failed", { error: auditError.message });
    }

    // 3. Fetch ONLY this senior's data with the service role.
    const days = Math.min(MAX_DAYS, Math.max(1, Math.floor(body.days ?? DEFAULT_DAYS)));
    const sinceIso = new Date(Date.now() - days * DAY_MS).toISOString();
    const [profileRes, checkInsRes] = await Promise.all([
      admin
        .from("profiles")
        .select(
          "first_name, last_name, phone, email, dob, emergency_contact_phone, caregiver_first_name, caregiver_last_name, caregiver_phone, caregiver_relationship",
        )
        .eq("user_id", seniorId)
        .maybeSingle(),
      admin
        .from("check_ins")
        .select(
          "id, timestamp, label, notes, emotional_state, heart_rate, bp_systolic, bp_diastolic, pulse_oximeter, glucose_mg_dl",
        )
        .eq("user_id", seniorId)
        .gte("timestamp", sinceIso)
        .order("timestamp", { ascending: false })
        .limit(CHECKIN_LIMIT),
    ]);

    if (profileRes.error) {
      logger.error("caregiver profile fetch failed", { error: profileRes.error.message });
    }
    if (checkInsRes.error) {
      logger.error("caregiver check-ins fetch failed", { error: checkInsRes.error.message });
    }

    logger.info("caregiver data served", {
      seniorId,
      checkIns: checkInsRes.data?.length ?? 0,
    });

    return json(200, {
      session: {
        seniorId,
        seniorName: session.senior_name ?? null,
        caregiverName: session.caregiver_name ?? null,
        expiresAt: session.expires_at ?? null,
      },
      profile: profileRes.data ?? null,
      checkIns: checkInsRes.data ?? [],
      // `medication_reminders` currently has only (id, user_id, time_of_day)
      // live — the medication_name/dosage/frequency the UI expects do not exist.
      // Returned empty until that table/feature is reconciled (separate item).
      medications: [] as unknown[],
    });
  } catch (err: unknown) {
    logger.error("get-caregiver-senior-data failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return json(500, { error: "Internal error" });
  }
});
