/**
 * chw-kiosk — server-side proxy for the public CHW kiosk (/kiosk/check-in).
 *
 * The kiosk is a shared, unauthenticated device in a library/community
 * center. It must never hold user credentials or query PHI tables directly.
 * Instead it authenticates as a DEVICE: a registered kiosk presents its
 * device token (SHA-256 hash stored on chw_kiosk_devices, migration
 * 20260723238000), and this function performs identity verification and
 * check-in server-side, tenant-scoped to the device's tenant.
 *
 * Identity model (Maria approved 2026-07-23): name + DOB finds the record;
 * a verified phone gets a Twilio Verify SMS one-time code (possession
 * factor); seniors without a phone at hand match their phone's last 4
 * digits (knowledge fallback). No SSN — none is stored, by design.
 *
 * Actions:
 *   lookup  {kiosk_id, device_token, first_name, last_name, dob}
 *           -> {found, method: 'sms'|'phone_last4'|'none', masked_phone?}
 *   verify  {kiosk_id, device_token, first_name, last_name, dob,
 *            code? | phone_last4?, language?}
 *           -> {verified, visit_id, patient_first_name}
 *
 * Fail-closed: the phi_access_logs insert happens BEFORE the visit is
 * created; if the audit write fails, the check-in is refused.
 */

import { createAdminClient } from "../_shared/supabaseClient.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";
import { createLogger } from "../_shared/auditLogger.ts";

interface KioskDevice {
  id: string;
  tenant_id: string | null;
  location_name: string;
  is_active: boolean | null;
  device_token_hash: string | null;
}

interface PatientMatch {
  user_id: string;
  first_name: string | null;
  phone: string | null;
  phone_verified: boolean | null;
  tenant_id: string;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: Record<string, unknown>, status: number, headers: Headers | Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(headers instanceof Headers ? Object.fromEntries(headers) : headers), "Content-Type": "application/json" },
  });
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function maskPhone(phone: string): string {
  const digits = digitsOnly(phone);
  return digits.length >= 4 ? `•••-•••-${digits.slice(-4)}` : "•••";
}

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger("chw-kiosk", req);
  if (req.method === "OPTIONS") return handleOptions(req);
  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, corsHeaders);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";
    const kioskId = typeof body.kiosk_id === "string" ? body.kiosk_id.slice(0, 100) : "";
    const deviceToken = typeof body.device_token === "string" ? body.device_token : "";
    const firstName = typeof body.first_name === "string" ? body.first_name.trim().slice(0, 100) : "";
    const lastName = typeof body.last_name === "string" ? body.last_name.trim().slice(0, 100) : "";
    const dob = typeof body.dob === "string" ? body.dob.trim() : "";

    if (!["lookup", "verify"].includes(action)) {
      return json({ error: "Invalid action" }, 400, corsHeaders);
    }
    if (!kioskId || !deviceToken) {
      return json({ error: "Missing device credentials" }, 401, corsHeaders);
    }
    if (!firstName || !lastName || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return json({ error: "Missing or invalid identity fields" }, 400, corsHeaders);
    }
    // Reject HTML metacharacters and ilike wildcards in names. Apostrophes
    // are allowed — O'Brien is a real name and .ilike() is parameterized.
    if (/[<>;"\\%_]/.test(firstName + lastName)) {
      return json({ error: "Invalid characters in name" }, 400, corsHeaders);
    }

    const admin = createAdminClient();

    // ── Device authentication ────────────────────────────────────────────
    const { data: device, error: deviceError } = await admin
      .from("chw_kiosk_devices")
      .select("id, tenant_id, location_name, is_active, device_token_hash")
      .eq("kiosk_id", kioskId)
      .maybeSingle<KioskDevice>();

    const tokenHash = await sha256Hex(deviceToken);
    if (
      deviceError ||
      !device ||
      !device.is_active ||
      !device.tenant_id ||
      !device.device_token_hash ||
      device.device_token_hash !== tokenHash
    ) {
      logger.warn("Kiosk device auth failed", { kiosk_id: kioskId, known: Boolean(device) });
      await admin.from("security_events").insert({
        event_type: "kiosk_device_auth_failed",
        severity: "HIGH",
        description: "CHW kiosk presented an unknown, inactive, or mis-tokened device credential",
        detected_by: "chw-kiosk",
        tenant_id: device?.tenant_id ?? null,
        metadata: { kiosk_id: kioskId },
      });
      return json({ error: "Device not authorized" }, 401, corsHeaders);
    }

    // ── Rate limiting (per kiosk + surname) ──────────────────────────────
    const rate = await checkRateLimit(`chw-kiosk:${kioskId}:${lastName.toLowerCase()}`, RATE_LIMITS.AUTH);
    if (!rate.allowed) {
      await admin.from("security_events").insert({
        event_type: "kiosk_rate_limited",
        severity: "MEDIUM",
        description: "CHW kiosk lookup rate limit exceeded",
        detected_by: "chw-kiosk",
        tenant_id: device.tenant_id,
        metadata: { kiosk_id: kioskId },
      });
      return json({ error: "Too many attempts. Please wait and try again." }, 429, corsHeaders);
    }

    // ── Patient lookup (tenant-scoped to the device) ─────────────────────
    const { data: candidates, error: lookupError } = await admin
      .from("profiles")
      .select("user_id, first_name, phone, phone_verified, tenant_id")
      .eq("tenant_id", device.tenant_id)
      .ilike("first_name", firstName)
      .ilike("last_name", lastName)
      .eq("dob", dob)
      .limit(2);

    if (lookupError) {
      logger.error("Kiosk patient lookup failed", { error: lookupError.message });
      return json({ error: "Lookup failed. Please see staff." }, 500, corsHeaders);
    }

    // Exactly-one match required; ambiguous or missing both read as not found
    const patient: PatientMatch | undefined = candidates?.length === 1 ? candidates[0] : undefined;
    if (!patient) {
      await admin.from("security_events").insert({
        event_type: "kiosk_patient_lookup_no_match",
        severity: "LOW",
        description: "CHW kiosk lookup found no unique match",
        detected_by: "chw-kiosk",
        tenant_id: device.tenant_id,
        metadata: { kiosk_id: kioskId, candidate_count: candidates?.length ?? 0 },
      });
      // Same response shape/timing for no-match and ambiguous — no enumeration oracle
      return json({ found: false }, 200, corsHeaders);
    }

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
    const VERIFY_SID = Deno.env.get("TWILIO_VERIFY_SERVICE_SID") ?? "";
    const twilioConfigured = Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && VERIFY_SID);
    const twilioAuth = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const smsEligible = twilioConfigured && Boolean(patient.phone && patient.phone_verified);

    // ── lookup: report the verification method and (for SMS) send the code ─
    if (action === "lookup") {
      if (smsEligible && patient.phone) {
        const resp = await fetch(
          `https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`,
          {
            method: "POST",
            headers: { Authorization: twilioAuth, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ To: patient.phone, Channel: "sms" }),
          }
        );
        if (resp.ok) {
          return json({ found: true, method: "sms", masked_phone: maskPhone(patient.phone) }, 200, corsHeaders);
        }
        logger.warn("Twilio Verify start failed; falling back to phone_last4", { status: resp.status });
      }
      if (patient.phone) {
        return json({ found: true, method: "phone_last4" }, 200, corsHeaders);
      }
      // No phone on file — nothing the senior can verify against unattended
      return json({ found: true, method: "none" }, 200, corsHeaders);
    }

    // ── verify: check the presented factor, then check in ────────────────
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const phoneLast4 = typeof body.phone_last4 === "string" ? digitsOnly(body.phone_last4) : "";

    let verified = false;
    if (code && smsEligible && patient.phone) {
      const resp = await fetch(
        `https://verify.twilio.com/v2/Services/${VERIFY_SID}/VerificationCheck`,
        {
          method: "POST",
          headers: { Authorization: twilioAuth, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ To: patient.phone, Code: code }),
        }
      );
      const result: unknown = await resp.json().catch(() => null);
      verified =
        resp.ok &&
        typeof result === "object" &&
        result !== null &&
        (result as { status?: string }).status === "approved";
    } else if (phoneLast4.length === 4 && patient.phone) {
      verified = digitsOnly(patient.phone).slice(-4) === phoneLast4;
    }

    if (!verified) {
      await admin.from("security_events").insert({
        event_type: "kiosk_identity_verification_failed",
        severity: "MEDIUM",
        description: "CHW kiosk identity verification failed (SMS code or phone match)",
        detected_by: "chw-kiosk",
        tenant_id: device.tenant_id,
        metadata: { kiosk_id: kioskId, factor: code ? "sms" : "phone_last4" },
      });
      return json({ verified: false, error: "Verification failed" }, 401, corsHeaders);
    }

    // Fail-closed PHI audit BEFORE any check-in state is created
    const { error: auditError } = await admin.from("phi_access_logs").insert({
      action: "KIOSK_CHECK_IN",
      patient_id: patient.user_id,
      tenant_id: device.tenant_id,
      user_role: "kiosk_system",
      kiosk_id: kioskId,
      device_id: device.id,
      data_types: ["demographics"],
      timestamp: new Date().toISOString(),
    });
    if (auditError) {
      logger.error("Kiosk PHI audit insert failed — refusing check-in", { error: auditError.message });
      return json({ error: "Check-in unavailable. Please see staff." }, 500, corsHeaders);
    }

    // Tenant's active CHW provider owns kiosk visits
    const { data: specialist } = await admin
      .from("specialist_providers")
      .select("id")
      .eq("tenant_id", device.tenant_id)
      .eq("specialist_type", "CHW")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!specialist) {
      logger.error("No active CHW specialist for tenant", { tenant_id: device.tenant_id });
      return json({ error: "Check-in unavailable. Please see staff." }, 503, corsHeaders);
    }

    const { data: visit, error: visitError } = await admin
      .from("field_visits")
      .insert({
        tenant_id: device.tenant_id,
        patient_id: patient.user_id,
        specialist_id: specialist.id,
        visit_type: "kiosk-check-in",
        workflow_template_id: "chw-rural-v1",
        check_in_time: new Date().toISOString(),
        current_step: 1,
        completed_steps: [],
        data: { kiosk_id: kioskId, location_name: device.location_name },
        status: "in_progress",
        offline_captured: false,
      })
      .select("id")
      .single();

    if (visitError || !visit) {
      logger.error("Kiosk visit insert failed", { error: visitError?.message ?? "no row" });
      return json({ error: "Check-in failed. Please see staff." }, 500, corsHeaders);
    }

    await admin.from("chw_kiosk_devices").update({ last_online_at: new Date().toISOString() }).eq("id", device.id);

    return json(
      { verified: true, visit_id: visit.id, patient_first_name: patient.first_name ?? "" },
      200,
      corsHeaders
    );
  } catch (err: unknown) {
    logger.error("chw-kiosk unhandled error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return json({ error: "Internal error" }, 500, corsHeaders);
  }
});
