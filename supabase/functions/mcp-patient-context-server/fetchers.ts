// =====================================================
// MCP Patient Context Server — Data Fetchers
// Each fetcher queries one table, records its data_source
// for ATLUS Accountability, and handles its own errors.
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { withTimeout, MCP_TIMEOUT_CONFIG } from "../_shared/mcpQueryTimeout.ts";
import type {
  PatientDemographics,
  PatientContact,
  TimelineEvent,
  RiskSummary,
  DataSourceRecord,
} from "./types.ts";

// -------------------------------------------------------
// Database row shapes (system boundary casts)
// -------------------------------------------------------

interface ProfileRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  gender: string | null;
  phone: string | null;
  preferred_language: string | null;
  enrollment_type: string | null;
  tenant_id: string | null;
  mrn: string | null;
}

interface CaregiverGrantRow {
  caregiver_first_name: string | null;
  caregiver_last_name: string | null;
  caregiver_phone: string | null;
  caregiver_email: string | null;
  relationship: string | null;
  is_primary: boolean | null;
}

interface CareTeamRow {
  member_name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
}

interface CheckInRow {
  id: string;
  created_at: string;
  mood: string | null;
  notes: string | null;
}

interface SelfReportRow {
  id: string;
  created_at: string;
  symptom_category: string | null;
  severity: string | null;
}

interface RiskPredictionRow {
  risk_score: number | null;
  risk_level: string | null;
  updated_at: string | null;
}

interface FallRiskRow {
  fall_risk_score: number | null;
  risk_level: string | null;
  assessed_at: string | null;
}

// -------------------------------------------------------
// Shared helpers
// -------------------------------------------------------

const TIMEOUT = MCP_TIMEOUT_CONFIG?.standard ?? 10_000;

function now(): string {
  return new Date().toISOString();
}

function recordFailure(
  dataSources: DataSourceRecord[],
  source: string,
  err: unknown,
  fetched_at: string
): void {
  dataSources.push({
    source,
    fetched_at,
    success: false,
    record_count: 0,
    note: err instanceof Error ? err.message : String(err),
  });
}

// -------------------------------------------------------
// Demographics
// -------------------------------------------------------

export async function fetchDemographicsRow(
  sb: SupabaseClient,
  patientId: string,
  dataSources: DataSourceRecord[]
): Promise<PatientDemographics | null> {
  const fetched_at = now();
  try {
    const { data, error } = await withTimeout(
      sb
        .from("profiles")
        .select(
          "user_id, first_name, last_name, dob, gender, phone, preferred_language, enrollment_type, tenant_id, mrn"
        )
        .eq("user_id", patientId)
        .single(),
      TIMEOUT,
      "Demographics lookup"
    );

    if (error || !data) {
      dataSources.push({
        source: "profiles",
        fetched_at,
        success: false,
        record_count: 0,
        note: error?.message ?? "Not found",
      });
      return null;
    }

    const row = data as ProfileRow;
    dataSources.push({
      source: "profiles",
      fetched_at,
      success: true,
      record_count: 1,
      note: null,
    });

    return {
      patient_id: row.user_id,
      first_name: row.first_name,
      last_name: row.last_name,
      dob: row.dob,
      gender: row.gender,
      phone: row.phone,
      preferred_language: row.preferred_language,
      enrollment_type: row.enrollment_type,
      tenant_id: row.tenant_id,
      mrn: row.mrn,
    };
  } catch (err: unknown) {
    recordFailure(dataSources, "profiles", err, fetched_at);
    return null;
  }
}

// -------------------------------------------------------
// Contacts
// -------------------------------------------------------

export async function fetchContactsRows(
  sb: SupabaseClient,
  patientId: string,
  dataSources: DataSourceRecord[]
): Promise<PatientContact[]> {
  const contacts: PatientContact[] = [];

  // Caregiver grants
  {
    const fetched_at = now();
    try {
      const { data, error } = await withTimeout(
        sb
          .from("caregiver_view_grants")
          .select(
            "caregiver_first_name, caregiver_last_name, caregiver_phone, caregiver_email, relationship, is_primary"
          )
          .eq("patient_id", patientId)
          .eq("is_active", true),
        TIMEOUT,
        "Caregiver contacts lookup"
      );

      if (error) {
        dataSources.push({
          source: "caregiver_view_grants",
          fetched_at,
          success: false,
          record_count: 0,
          note: error.message,
        });
      } else {
        const rows = (data ?? []) as CaregiverGrantRow[];
        for (const r of rows) {
          const name =
            [r.caregiver_first_name, r.caregiver_last_name]
              .filter(Boolean)
              .join(" ")
              .trim() || null;
          contacts.push({
            contact_type: "caregiver",
            name,
            relationship: r.relationship,
            phone: r.caregiver_phone,
            email: r.caregiver_email,
            is_primary: r.is_primary,
          });
        }
        dataSources.push({
          source: "caregiver_view_grants",
          fetched_at,
          success: true,
          record_count: rows.length,
          note: null,
        });
      }
    } catch (err: unknown) {
      recordFailure(dataSources, "caregiver_view_grants", err, fetched_at);
    }
  }

  // Care team members
  {
    const fetched_at = now();
    try {
      const { data, error } = await withTimeout(
        sb
          .from("care_team_members")
          .select("member_name, role, phone, email")
          .eq("patient_id", patientId),
        TIMEOUT,
        "Care team lookup"
      );

      if (error) {
        dataSources.push({
          source: "care_team_members",
          fetched_at,
          success: false,
          record_count: 0,
          note: error.message,
        });
      } else {
        const rows = (data ?? []) as CareTeamRow[];
        for (const r of rows) {
          contacts.push({
            contact_type: "care_team_member",
            name: r.member_name,
            relationship: r.role,
            phone: r.phone,
            email: r.email,
            is_primary: null,
          });
        }
        dataSources.push({
          source: "care_team_members",
          fetched_at,
          success: true,
          record_count: rows.length,
          note: null,
        });
      }
    } catch (err: unknown) {
      recordFailure(dataSources, "care_team_members", err, fetched_at);
    }
  }

  return contacts;
}

// -------------------------------------------------------
// Timeline
// -------------------------------------------------------

export async function fetchTimelineEvents(
  sb: SupabaseClient,
  patientId: string,
  days: number,
  maxEvents: number,
  dataSources: DataSourceRecord[]
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Check-ins
  {
    const fetched_at = now();
    try {
      const { data, error } = await withTimeout(
        sb
          .from("check_ins")
          .select("id, created_at, mood, notes")
          .eq("user_id", patientId)
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(Math.min(maxEvents, 100)),
        TIMEOUT,
        "Check-in timeline"
      );

      if (error) {
        dataSources.push({
          source: "check_ins",
          fetched_at,
          success: false,
          record_count: 0,
          note: error.message,
        });
      } else {
        const rows = (data ?? []) as CheckInRow[];
        for (const r of rows) {
          events.push({
            event_type: "check_in",
            occurred_at: r.created_at,
            summary: r.mood ? `Mood: ${r.mood}` : "Check-in recorded",
            metadata: { check_in_id: r.id },
          });
        }
        dataSources.push({
          source: "check_ins",
          fetched_at,
          success: true,
          record_count: rows.length,
          note: null,
        });
      }
    } catch (err: unknown) {
      recordFailure(dataSources, "check_ins", err, fetched_at);
    }
  }

  // Self-reports
  {
    const fetched_at = now();
    try {
      const { data, error } = await withTimeout(
        sb
          .from("self_reports")
          .select("id, created_at, symptom_category, severity")
          .eq("user_id", patientId)
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(Math.min(maxEvents, 100)),
        TIMEOUT,
        "Self-report timeline"
      );

      if (error) {
        dataSources.push({
          source: "self_reports",
          fetched_at,
          success: false,
          record_count: 0,
          note: error.message,
        });
      } else {
        const rows = (data ?? []) as SelfReportRow[];
        for (const r of rows) {
          events.push({
            event_type: "self_report",
            occurred_at: r.created_at,
            summary:
              r.symptom_category && r.severity
                ? `${r.symptom_category} (${r.severity})`
                : r.symptom_category ?? "Self-report",
            metadata: { self_report_id: r.id },
          });
        }
        dataSources.push({
          source: "self_reports",
          fetched_at,
          success: true,
          record_count: rows.length,
          note: null,
        });
      }
    } catch (err: unknown) {
      recordFailure(dataSources, "self_reports", err, fetched_at);
    }
  }

  // Sort combined events by time descending, cap total
  events.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
  return events.slice(0, maxEvents);
}

// -------------------------------------------------------
// Risk summary
// -------------------------------------------------------

export async function fetchRiskSummaryData(
  sb: SupabaseClient,
  patientId: string,
  dataSources: DataSourceRecord[]
): Promise<RiskSummary> {
  const summary: RiskSummary = {
    readmission_risk: { score: null, level: null, last_updated: null },
    fall_risk: { score: null, level: null, last_updated: null },
    overall_severity: "unknown",
  };

  // Readmission risk
  {
    const fetched_at = now();
    try {
      const { data, error } = await withTimeout(
        sb
          .from("readmission_risk_predictions")
          .select("risk_score, risk_level, updated_at")
          .eq("patient_id", patientId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        TIMEOUT,
        "Readmission risk lookup"
      );

      if (error) {
        dataSources.push({
          source: "readmission_risk_predictions",
          fetched_at,
          success: false,
          record_count: 0,
          note: error.message,
        });
      } else if (data) {
        const row = data as RiskPredictionRow;
        summary.readmission_risk = {
          score: row.risk_score,
          level: row.risk_level,
          last_updated: row.updated_at,
        };
        dataSources.push({
          source: "readmission_risk_predictions",
          fetched_at,
          success: true,
          record_count: 1,
          note: null,
        });
      } else {
        dataSources.push({
          source: "readmission_risk_predictions",
          fetched_at,
          success: true,
          record_count: 0,
          note: "No predictions on file",
        });
      }
    } catch (err: unknown) {
      recordFailure(dataSources, "readmission_risk_predictions", err, fetched_at);
    }
  }

  // Fall risk
  {
    const fetched_at = now();
    try {
      const { data, error } = await withTimeout(
        sb
          .from("ai_fall_risk_assessments")
          .select("fall_risk_score, risk_level, assessed_at")
          .eq("patient_id", patientId)
          .order("assessed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        TIMEOUT,
        "Fall risk lookup"
      );

      if (error) {
        dataSources.push({
          source: "ai_fall_risk_assessments",
          fetched_at,
          success: false,
          record_count: 0,
          note: error.message,
        });
      } else if (data) {
        const row = data as FallRiskRow;
        summary.fall_risk = {
          score: row.fall_risk_score,
          level: row.risk_level,
          last_updated: row.assessed_at,
        };
        dataSources.push({
          source: "ai_fall_risk_assessments",
          fetched_at,
          success: true,
          record_count: 1,
          note: null,
        });
      } else {
        dataSources.push({
          source: "ai_fall_risk_assessments",
          fetched_at,
          success: true,
          record_count: 0,
          note: "No assessments on file",
        });
      }
    } catch (err: unknown) {
      recordFailure(dataSources, "ai_fall_risk_assessments", err, fetched_at);
    }
  }

  // Overall severity = worst of the two
  const readmissionLevel = (summary.readmission_risk.level ?? "").toLowerCase();
  const fallLevel = (summary.fall_risk.level ?? "").toLowerCase();
  const rank: Record<string, number> = {
    low: 1,
    moderate: 2,
    medium: 2,
    high: 3,
    critical: 4,
  };
  const worst = Math.max(rank[readmissionLevel] ?? 0, rank[fallLevel] ?? 0);
  summary.overall_severity =
    worst === 4
      ? "critical"
      : worst === 3
        ? "high"
        : worst === 2
          ? "moderate"
          : worst === 1
            ? "low"
            : "unknown";

  return summary;
}

// -------------------------------------------------------
// Existence check (thin wrapper for patient_exists tool)
// -------------------------------------------------------

export async function patientExistsCheck(
  sb: SupabaseClient,
  patientId: string
): Promise<boolean> {
  try {
    const { data, error } = await withTimeout(
      sb.from("profiles").select("user_id").eq("user_id", patientId).maybeSingle(),
      TIMEOUT,
      "patient_exists check"
    );
    return !error && !!data;
  } catch {
    return false;
  }
}
