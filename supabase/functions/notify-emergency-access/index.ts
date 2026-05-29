/**
 * notify-emergency-access — ONC 170.315(d)(6) supervisor notification
 *
 * Dispatches the supervisor notification for a break-the-glass grant. The grant
 * itself is recorded by grant_emergency_access (which returns
 * should_notify_supervisor=true and leaves supervisors_notified=false). This
 * function resolves the tenant's admins server-side (their email addresses are
 * PHI-adjacent and must never reach the browser), emails them via send-email,
 * then flips supervisors_notified=true.
 *
 * Auth (per .claude/rules/adversarial-audit-lessons.md §2):
 *   - JWT verified via auth.getUser(token)
 *   - Authorization: the caller MUST be the accessor on the grant row
 *   - Tenant isolation: admins resolved only within the grant's tenant
 *   - Input validation: access_id (uuid) required
 */

import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/auditLogger.ts";

interface NotifyRequest {
  access_id: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

serve(async (req) => {
  const logger = createLogger("notify-emergency-access", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }
  const { headers: corsHeaders } = corsFromRequest(req);
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // 1. Require Bearer token
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "Missing authorization" });
  }
  const token = authHeader.replace("Bearer ", "");

  // Admin client (service role) — used for verification, lookups, and the
  // RLS-bypassing flag update. auth.getUser(token) validates the JWT.
  const admin = createClient(SUPABASE_URL, SB_SECRET_KEY);

  const { data: userData, error: authError } = await admin.auth.getUser(token);
  const caller = userData?.user;
  if (authError || !caller) {
    return json(401, { error: "Invalid token" });
  }

  // 2. Input validation
  let payload: NotifyRequest;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  if (!payload?.access_id || !UUID_RE.test(payload.access_id)) {
    return json(400, { error: "access_id (uuid) is required" });
  }

  // 3. Load the grant row
  const { data: grant, error: grantErr } = await admin
    .from("emergency_access_log")
    .select(
      "id, tenant_id, accessing_user_id, accessing_user_name, patient_name, access_reason, access_explanation, granted_at, expires_at, supervisors_notified"
    )
    .eq("id", payload.access_id)
    .single();

  if (grantErr || !grant) {
    return json(404, { error: "Emergency-access grant not found" });
  }

  // 4. Authorization — only the accessor may trigger their own notification
  if (grant.accessing_user_id !== caller.id) {
    logger.warn("Rejected notify by non-accessor", {
      access_id: payload.access_id,
      caller: caller.id,
    });
    return json(403, { error: "Only the accessor may notify supervisors for this grant" });
  }

  if (grant.supervisors_notified === true) {
    return json(200, { notified: 0, already_notified: true });
  }

  // 5. Resolve tenant admins (within the grant's tenant only)
  const { data: admins, error: adminErr } = await admin
    .from("profiles")
    .select("user_id, first_name, last_name, email, role_id, roles!inner(name)")
    .eq("tenant_id", grant.tenant_id)
    .in("roles.name", ["admin", "super_admin"]);

  if (adminErr) {
    logger.error("Failed to resolve tenant admins", { error: adminErr.message });
    return json(500, { error: "Failed to resolve supervisors" });
  }

  interface AdminRow {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }
  const recipients = (admins ?? [])
    .map((a) => a as unknown as AdminRow)
    .filter((a) => !!a.email);

  // 6. Compose + send. Email body escapes all interpolated values (G-3).
  const subject = "🚨 Break-the-glass emergency access recorded";
  const html =
    `<p>An emergency-access ("break-the-glass") grant was recorded.</p>` +
    `<ul>` +
    `<li><strong>Accessed by:</strong> ${escapeHtml(grant.accessing_user_name ?? "Unknown")}</li>` +
    `<li><strong>Patient:</strong> ${escapeHtml(grant.patient_name ?? "Unknown")}</li>` +
    `<li><strong>Reason:</strong> ${escapeHtml(grant.access_reason ?? "")}</li>` +
    (grant.access_explanation
      ? `<li><strong>Explanation:</strong> ${escapeHtml(grant.access_explanation)}</li>`
      : "") +
    `<li><strong>Granted:</strong> ${escapeHtml(String(grant.granted_at ?? ""))}</li>` +
    `<li><strong>Expires:</strong> ${escapeHtml(String(grant.expires_at ?? ""))}</li>` +
    `</ul>` +
    `<p>This access is time-limited and fully audited. If it was not appropriate, review it in the admin console.</p>`;

  let notified = 0;
  for (const r of recipients) {
    try {
      const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Administrator";
      await admin.functions.invoke("send-email", {
        body: { to: [{ email: r.email, name }], subject, html },
      });
      notified++;
    } catch (err: unknown) {
      logger.error("send-email failed for supervisor", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 7. Flag the grant as notified (service role bypasses the read-only RLS)
  const { error: flagErr } = await admin
    .from("emergency_access_log")
    .update({ supervisors_notified: true })
    .eq("id", grant.id);
  if (flagErr) {
    logger.error("Failed to set supervisors_notified", { error: flagErr.message });
  }

  logger.info("Emergency-access supervisors notified", {
    access_id: grant.id,
    recipients: notified,
  });
  return json(200, { notified });
});
