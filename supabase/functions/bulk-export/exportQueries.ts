// Tenant-scoped query builders for each export type.
//
// Count queries use head:true (no rows transferred), so the select list is
// irrelevant to PHI. Batch queries resolve their column list at runtime via
// get_exportable_columns() — exports stay complete on schema changes and there
// is no literal SELECT * (.claude/rules/supabase.md §9).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { resolveSelectColumns, resolveSelectColumnsWithEmbed } from "../_shared/exportColumns.ts";
import type { ExportFilters } from "./types.ts";

const TENANT_EMBED = "profiles!inner(tenant_id)";

/** Build the head:true count query for the export type. Returns null for unknown types. */
export function buildCountQuery(
  admin: SupabaseClient,
  exportType: string,
  filters: ExportFilters,
  tenantId: string,
) {
  switch (exportType) {
    case "check_ins": {
      let q = admin
        .from("check_ins")
        .select(`*, ${TENANT_EMBED}`, { count: "exact", head: true })
        .eq("profiles.tenant_id", tenantId);
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
      if (filters.dateTo) q = q.lte("created_at", filters.dateTo);
      return q;
    }
    case "risk_assessments": {
      let q = admin
        .from("ai_risk_assessments")
        .select(`*, ${TENANT_EMBED}`, { count: "exact", head: true })
        .eq("profiles.tenant_id", tenantId);
      if (filters.dateFrom) q = q.gte("assessed_at", filters.dateFrom);
      if (filters.dateTo) q = q.lte("assessed_at", filters.dateTo);
      return q;
    }
    case "users_profiles":
      return admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
    case "billing_claims": {
      let q = admin
        .from("claims")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
      if (filters.dateTo) q = q.lte("created_at", filters.dateTo);
      return q;
    }
    case "fhir_resources":
      return admin
        .from("encounters")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
    case "audit_logs": {
      let q = admin
        .from("admin_audit_logs")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
      if (filters.dateTo) q = q.lte("created_at", filters.dateTo);
      return q;
    }
    default:
      return null;
  }
}

/** Build the data-fetch query for a batch. Resolves explicit columns at runtime. */
export async function buildBatchQuery(
  admin: SupabaseClient,
  exportType: string,
  filters: ExportFilters,
  tenantId: string,
  offset: number,
  limit: number,
  batchSize: number,
) {
  switch (exportType) {
    case "check_ins": {
      const cols = await resolveSelectColumnsWithEmbed(admin, "check_ins", TENANT_EMBED);
      let q = admin
        .from("check_ins")
        .select(cols)
        .eq("profiles.tenant_id", tenantId)
        .range(offset, offset + limit - 1);
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
      if (filters.dateTo) q = q.lte("created_at", filters.dateTo);
      return q;
    }
    case "risk_assessments": {
      const cols = await resolveSelectColumnsWithEmbed(admin, "ai_risk_assessments", TENANT_EMBED);
      let q = admin
        .from("ai_risk_assessments")
        .select(cols)
        .eq("profiles.tenant_id", tenantId)
        .range(offset, offset + limit - 1);
      if (filters.dateFrom) q = q.gte("assessed_at", filters.dateFrom);
      if (filters.dateTo) q = q.lte("assessed_at", filters.dateTo);
      return q;
    }
    case "users_profiles": {
      const cols = await resolveSelectColumns(admin, "profiles");
      return admin
        .from("profiles")
        .select(cols)
        .eq("tenant_id", tenantId)
        .range(offset, offset + limit - 1);
    }
    case "billing_claims": {
      const cols = await resolveSelectColumns(admin, "claims");
      let q = admin
        .from("claims")
        .select(cols)
        .eq("tenant_id", tenantId)
        .range(offset, offset + limit - 1);
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
      if (filters.dateTo) q = q.lte("created_at", filters.dateTo);
      return q;
    }
    case "fhir_resources": {
      // First batch = profiles; subsequent batches = self_reports.
      if (offset === 0) {
        const cols = await resolveSelectColumns(admin, "profiles");
        return admin
          .from("profiles")
          .select(cols)
          .eq("tenant_id", tenantId)
          .range(offset, offset + limit - 1);
      }
      const cols = await resolveSelectColumnsWithEmbed(admin, "self_reports", TENANT_EMBED);
      let q = admin
        .from("self_reports")
        .select(cols)
        .eq("profiles.tenant_id", tenantId)
        .range(offset - batchSize, offset + limit - batchSize - 1);
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
      if (filters.dateTo) q = q.lte("created_at", filters.dateTo);
      return q;
    }
    case "audit_logs": {
      const cols = await resolveSelectColumns(admin, "admin_audit_logs");
      let q = admin
        .from("admin_audit_logs")
        .select(cols)
        .eq("tenant_id", tenantId)
        .range(offset, offset + limit - 1);
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom);
      if (filters.dateTo) q = q.lte("created_at", filters.dateTo);
      return q;
    }
    default:
      throw new Error(`Unknown export type: ${exportType}`);
  }
}
