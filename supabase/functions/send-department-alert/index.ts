/**
 * Send Department Alert Edge Function
 *
 * Purpose: Page a hospital department when an EMS dispatch row is created.
 * Triggered by trg_notify_department_dispatch (AFTER INSERT ON
 * ems_department_dispatches, migration 20260722120000) via async pg_net.
 * Delivery: SMS via send-sms (Twilio) + email via send-email, addressed to
 * hospital_departments.alert_phone / alert_email for the dispatch's tenant.
 *
 * verify_jwt=false so the DB trigger can reach us — therefore gated the same
 * way as ld-alert-notifier: X-Cron-Secret or Bearer equal to
 * CRON_SECRET / SB_SECRET_KEY (the trigger sends the Vault sb_secret_key).
 *
 * NO PHI leaves this function: messages carry alert type, ETA, and department
 * instructions only — never patient name/DOB/complaint details.
 */

import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { createLogger } from "../_shared/auditLogger.ts";

interface DepartmentAlertRequest {
  dispatch_id: string;
  handoff_id: string;
  tenant_id: string | null;
  department_code: string;
  department_name: string;
  alert_type: string;
  alert_priority: number;
}

function isAuthorizedServerCaller(req: Request): boolean {
  const headerSecret = req.headers.get("X-Cron-Secret");
  const bearerToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const candidate = headerSecret ?? bearerToken;
  if (!candidate) return false;

  const accepted = [Deno.env.get("CRON_SECRET") ?? "", SB_SECRET_KEY ?? ""]
    .filter((s) => s.length > 0);

  return accepted.some((s) => s === candidate);
}

/** Alert label without emojis — this is a clinical channel (governance: System B). */
function buildMessage(alertType: string, departmentName: string, etaMinutes: number | null): string {
  const labels: Record<string, string> = {
    stroke: "STROKE ALERT",
    stemi: "STEMI ALERT",
    trauma: "TRAUMA ALERT",
    sepsis: "SEPSIS ALERT",
    cardiac_arrest: "CARDIAC ARREST",
    general: "EMS INCOMING",
  };
  const label = labels[alertType] ?? labels.general;
  const eta = etaMinutes !== null && etaMinutes >= 0 ? `ETA ${etaMinutes} min` : "ETA unknown";
  return `${label} — incoming EMS patient, ${eta}. ${departmentName}: mobilize per protocol and acknowledge in the dispatch dashboard.`;
}

serve(async (req) => {
  const logger = createLogger("send-department-alert", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  if (!isAuthorizedServerCaller(req)) {
    logger.warn("Unauthorized caller rejected");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  try {
    const body = (await req.json()) as DepartmentAlertRequest;
    const { dispatch_id, handoff_id, tenant_id, department_code, department_name, alert_type } = body;

    if (!dispatch_id || !handoff_id || !department_code) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL ?? "", SB_SECRET_KEY ?? "", {
      auth: { persistSession: false },
    });

    // ETA from the handoff row (no PHI pulled — timing only)
    let etaMinutes: number | null = null;
    const { data: handoff } = await supabaseAdmin
      .from("prehospital_handoffs")
      .select("eta_hospital")
      .eq("id", handoff_id)
      .single();
    if (handoff?.eta_hospital) {
      etaMinutes = Math.round((new Date(handoff.eta_hospital).getTime() - Date.now()) / 60000);
    }

    // Department contact registry (D1 — Twilio paging; columns added 20260722120000)
    let deptQuery = supabaseAdmin
      .from("hospital_departments")
      .select("alert_phone, alert_email, name")
      .eq("code", department_code)
      .eq("is_active", true);
    if (tenant_id) {
      deptQuery = deptQuery.eq("tenant_id", tenant_id);
    }
    const { data: departments, error: deptError } = await deptQuery.limit(1);

    if (deptError) {
      logger.error("Department lookup failed", { department_code, error: deptError.message });
      return new Response(JSON.stringify({ error: "Department lookup failed" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const dept = departments?.[0];
    const message = buildMessage(alert_type, dept?.name ?? department_name, etaMinutes);
    const sent: string[] = [];

    if (dept?.alert_phone) {
      const { error: smsError } = await supabaseAdmin.functions.invoke("send-sms", {
        body: { phone: dept.alert_phone, message },
      });
      if (smsError) {
        logger.error("Department SMS failed", { department_code, error: smsError.message });
      } else {
        sent.push("sms");
      }
    }

    if (dept?.alert_email) {
      const { error: emailError } = await supabaseAdmin.functions.invoke("send-email", {
        body: {
          to: dept.alert_email,
          subject: `${message.split(" — ")[0]} — department dispatch`,
          html: `<p>${message}</p>`,
        },
      });
      if (emailError) {
        logger.error("Department email failed", { department_code, error: emailError.message });
      } else {
        sent.push("email");
      }
    }

    if (sent.length === 0) {
      // No contact configured — dashboard remains the notification surface.
      logger.info("No alert contacts configured for department; dashboard-only", {
        department_code,
        dispatch_id,
      });
    }

    // Canonical audit_logs shape: event_type + metadata (no PHI)
    await supabaseAdmin.from("audit_logs").insert({
      event_type: "EMS_DEPARTMENT_ALERT_DISPATCHED",
      metadata: {
        dispatch_id,
        handoff_id,
        department_code,
        alert_type,
        channels: sent,
        source: "send-department-alert",
      },
    });

    return new Response(JSON.stringify({ success: true, channels: sent }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Department alert failed", { error: message });
    return new Response(JSON.stringify({ error: "Department alert failed" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
