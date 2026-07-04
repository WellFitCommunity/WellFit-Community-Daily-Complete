/**
 * rpm-weekly-report — scheduled RPM / vitals report pipeline (BLE/RPM tracker Session E)
 *
 * Cron-triggered (weekly). For every tenant with an active rpm_report_settings row:
 *   for each ACTIVE enrollment -> build a per-senior report (weekly vital averages +
 *   out-of-range counts + the 16-day transmission / CPT 99454 trail), persist it to
 *   rpm_reports, render an HTML summary, and email it to the tenant's configured
 *   recipient (§1.9 — never hardcoded; falls back to ADMIN_EMAILS).
 *
 * Auth: server-to-server only. Accepts X-Cron-Secret or Bearer == CRON_SECRET /
 * SB_SECRET_KEY (mirrors guardian-agent). verify_jwt is pinned false in config.toml.
 *
 * NOTE: end-to-end delivery is not yet live-proven (0 enrollments + 0 device rows as
 * of 2026-07-04). The empty run (0 reports) is provable now; real reports flow once
 * seniors are enrolled with device data (week of 2026-07-07).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("rpm-weekly-report");

// The four BLE-scope vitals, with the same clinical bounds as vitalsSummaryService.
const VITALS: ReadonlyArray<{ type: string; label: string; unit: string; low?: number; high?: number }> = [
  { type: "blood_pressure", label: "Blood Pressure (systolic)", unit: "mmHg", low: 90, high: 140 },
  { type: "blood_glucose", label: "Blood Glucose", unit: "mg/dL", low: 70, high: 200 },
  { type: "oxygen_saturation", label: "Oxygen Saturation", unit: "%", low: 92 },
  { type: "weight", label: "Weight", unit: "lbs" },
];

const REQUIRED_DAYS_99454 = 16;
const PERIOD_DAYS = 30;

interface VitalRow { value: number | null; measured_at: string; }
interface EnrollmentRow {
  id: string;
  patient_id: string;
  tenant_id: string;
  total_monitoring_minutes: number | null;
}
interface SettingRow { tenant_id: string; recipient_emails: string[] | null; }

interface VitalSection {
  type: string;
  label: string;
  unit: string;
  count: number;
  avg: number;
  outOfRangeCount: number;
}

function isAuthorizedServerCaller(req: Request): boolean {
  const headerSecret = req.headers.get("X-Cron-Secret");
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const candidate = headerSecret ?? bearer;
  if (!candidate) return false;
  const accepted = [Deno.env.get("CRON_SECRET"), SB_SECRET_KEY].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  return accepted.some((s) => s === candidate);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function outOfRange(v: number, low?: number, high?: number): boolean {
  if (typeof high === "number" && v > high) return true;
  if (typeof low === "number" && v < low) return true;
  return false;
}

type AdminClient = ReturnType<typeof createClient>;

/** Build one senior's vital sections for the period. */
async function buildVitalSections(
  supabase: AdminClient,
  patientId: string,
  cutoffIso: string,
): Promise<VitalSection[]> {
  const sections: VitalSection[] = [];
  for (const v of VITALS) {
    const { data, error } = await supabase
      .from("wearable_vital_signs")
      .select("value, measured_at")
      .eq("user_id", patientId)
      .eq("vital_type", v.type)
      .gte("measured_at", cutoffIso)
      .limit(2000);
    if (error) {
      logger.error("vital query failed", { vital: v.type, message: error.message });
      continue;
    }
    const rows = (data ?? []) as VitalRow[];
    const values = rows
      .map((r) => r.value)
      .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
    const count = values.length;
    const avg = count > 0 ? round1(values.reduce((s, x) => s + x, 0) / count) : 0;
    const oor = values.filter((x) => outOfRange(x, v.low, v.high)).length;
    sections.push({ type: v.type, label: v.label, unit: v.unit, count, avg, outOfRangeCount: oor });
  }
  return sections;
}

/** Distinct transmission days across check-ins + wearable readings in the period. */
async function countTransmissionDays(
  supabase: AdminClient,
  patientId: string,
  cutoffIso: string,
): Promise<number> {
  const days = new Set<string>();

  const { data: checkins } = await supabase
    .from("check_ins")
    .select("timestamp")
    .eq("user_id", patientId)
    .gte("timestamp", cutoffIso);
  for (const row of (checkins ?? []) as { timestamp: string }[]) {
    days.add(row.timestamp.split("T")[0]);
  }

  const { data: wearables } = await supabase
    .from("wearable_vital_signs")
    .select("measured_at")
    .eq("user_id", patientId)
    .gte("measured_at", cutoffIso);
  for (const row of (wearables ?? []) as { measured_at: string }[]) {
    days.add(row.measured_at.split("T")[0]);
  }

  return days.size;
}

function renderHtml(
  patientLabel: string,
  periodStart: string,
  periodEnd: string,
  sections: VitalSection[],
  transmissionDays: number,
  billable: boolean,
): string {
  const rows = sections
    .map(
      (s) =>
        `<tr><td>${s.label}</td><td style="text-align:right">${s.count}</td>` +
        `<td style="text-align:right">${s.count > 0 ? `${s.avg} ${s.unit}` : "—"}</td>` +
        `<td style="text-align:right">${s.outOfRangeCount}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>RPM Weekly Report</title></head>
<body style="font-family:Arial,sans-serif;color:#111">
<h2>Remote Patient Monitoring — Weekly Report</h2>
<p><strong>Patient:</strong> ${patientLabel}<br/>
<strong>Period:</strong> ${periodStart} to ${periodEnd}</p>
<p><strong>Transmission days:</strong> ${transmissionDays} / ${REQUIRED_DAYS_99454}
${billable ? "✅ meets CPT 99454" : "— below the 99454 threshold"}</p>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
<thead><tr><th>Vital</th><th>Readings</th><th>Average</th><th>Out of range</th></tr></thead>
<tbody>${rows}</tbody></table>
<p style="color:#666;font-size:12px">Generated by Envision ATLUS RPM. Averages are over the last ${PERIOD_DAYS} days.</p>
</body></html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const { headers: corsHeaders } = corsFromRequest(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (!isAuthorizedServerCaller(req)) {
    return json({ error: "Forbidden" }, 403);
  }

  const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);
  const adminEmails = (Deno.env.get("ADMIN_EMAILS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const cutoffIso = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const periodEnd = new Date().toISOString().split("T")[0];
  const periodStart = cutoffIso.split("T")[0];

  let reportsGenerated = 0;
  let reportsSent = 0;

  try {
    // Tenants opted-in via an active settings row.
    const { data: settings, error: settingsErr } = await supabase
      .from("rpm_report_settings")
      .select("tenant_id, recipient_emails")
      .eq("is_active", true);
    if (settingsErr) {
      logger.error("settings load failed", { message: settingsErr.message });
      return json({ error: "settings_load_failed" }, 500);
    }

    for (const setting of (settings ?? []) as SettingRow[]) {
      const recipients = (setting.recipient_emails && setting.recipient_emails.length > 0)
        ? setting.recipient_emails
        : adminEmails;

      const { data: enrollments, error: enrErr } = await supabase
        .from("rpm_enrollments")
        .select("id, patient_id, tenant_id, total_monitoring_minutes")
        .eq("tenant_id", setting.tenant_id)
        .eq("status", "active");
      if (enrErr) {
        logger.error("enrollment load failed", { tenant: setting.tenant_id, message: enrErr.message });
        continue;
      }

      for (const enr of (enrollments ?? []) as EnrollmentRow[]) {
        const sections = await buildVitalSections(supabase, enr.patient_id, cutoffIso);
        const transmissionDays = await countTransmissionDays(supabase, enr.patient_id, cutoffIso);
        const monitoringMinutes = enr.total_monitoring_minutes ?? 0;
        const billable = transmissionDays >= REQUIRED_DAYS_99454;

        const { data: inserted, error: insErr } = await supabase
          .from("rpm_reports")
          .insert({
            tenant_id: enr.tenant_id,
            enrollment_id: enr.id,
            patient_id: enr.patient_id,
            period_start: periodStart,
            period_end: periodEnd,
            transmission_days: transmissionDays,
            required_days: REQUIRED_DAYS_99454,
            is_billable_99454: billable,
            monitoring_minutes: monitoringMinutes,
            payload: { vitals: sections },
            recipients,
          })
          .select("id")
          .single();
        if (insErr) {
          logger.error("report insert failed", { enrollment: enr.id, message: insErr.message });
          continue;
        }
        reportsGenerated += 1;

        if (recipients.length === 0) {
          logger.warn("no recipients configured; report stored but not emailed", {
            tenant: enr.tenant_id,
            report: inserted?.id,
          });
          continue;
        }

        const html = renderHtml(
          `Patient ${enr.patient_id.slice(0, 8)}`,
          periodStart,
          periodEnd,
          sections,
          transmissionDays,
          billable,
        );
        const { error: emailErr } = await supabase.functions.invoke("send-email", {
          body: {
            to: recipients.map((email) => ({ email, name: "RPM Report Recipient" })),
            subject: `RPM Weekly Report — ${periodStart} to ${periodEnd}`,
            html,
          },
        });
        if (emailErr) {
          logger.error("send-email failed", { report: inserted?.id, message: emailErr.message });
          continue;
        }

        await supabase.from("rpm_reports").update({ sent_at: new Date().toISOString() }).eq("id", inserted?.id);
        reportsSent += 1;
      }
    }

    logger.info("rpm weekly report run complete", { reportsGenerated, reportsSent });
    return json({ ok: true, reportsGenerated, reportsSent });
  } catch (err: unknown) {
    logger.error("rpm weekly report run failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return json({ error: "run_failed" }, 500);
  }
});
