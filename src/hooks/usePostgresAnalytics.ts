/**
 * usePostgresAnalytics — React hook for MCP Postgres Analytics queries
 *
 * Wraps the 14 whitelisted analytics queries from mcp-postgres-server
 * with React state management (loading, error, data).
 *
 * Usage:
 *   const { dashboardMetrics, loading, error, refresh } = usePostgresAnalytics(tenantId);
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getDashboardMetrics,
  getPatientRiskDistribution,
  getReadmissionRiskSummary,
  getEncounterSummary,
  getSDOHFlagsSummary,
  getMedicationAdherenceStats,
  getClaimsStatusSummary,
  getBillingRevenueSummary,
  getCarePlanSummary,
  getTaskCompletionRate,
  getReferralSummary,
  getBedAvailability,
  getShiftHandoffSummary,
  getQualityMetrics,
} from '../services/mcp/mcpPostgresClient';

// =====================================================
// Types
// =====================================================

export interface DashboardKPIs {
  active_members: number;
  high_risk_patients: number;
  todays_encounters: number;
  pending_tasks: number;
  active_sdoh_flags: number;
}

export interface RiskDistribution {
  risk_level: string;
  count: number;
}

export interface ReadmissionRisk {
  risk_category: string;
  patient_count: number;
}

export interface EncounterData {
  encounter_type: string;
  status: string;
  count: number;
  date: string;
}

export interface SDOHFlag {
  flag_type: string;
  severity: string;
  count: number;
}

export interface AdherenceStat {
  adherence_category: string;
  patient_count: number;
}

export interface ClaimStatus {
  status: string;
  count: number;
  total_charges: number;
}

export interface RevenueTrend {
  date: string;
  claim_count: number;
  charges: number;
  collected: number;
}

export interface CarePlanStatus {
  status: string;
  count: number;
}

export interface TaskCompletion {
  date: string;
  completed: number;
  total: number;
}

export interface ReferralData {
  organization_name: string;
  status: string;
  count: number;
}

export interface BedStatus {
  unit: string;
  status: string;
  count: number;
}

export interface HandoffData {
  shift_type: string;
  status: string;
  count: number;
  avg_duration_minutes: number;
}

export interface QualityMeasure {
  measure_code: string;
  measure_name: string;
  numerator: number;
  denominator: number;
  performance_rate: number;
}

// =====================================================
// Hook: useDashboardKPIs (top-level metrics)
// =====================================================

export function useDashboardKPIs(tenantId: string | null) {
  const [data, setData] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getDashboardMetrics(tenantId);
      if (!mountedRef.current) return;
      if (result.success && result.data && result.data.length > 0) {
        setData(result.data[0]);
      } else {
        setError(result.error || 'No dashboard metrics available');
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => { mountedRef.current = false; };
  }, [refresh]);

  return { data, loading, error, refresh };
}

// =====================================================
// Hook: useAnalyticsQuery (generic single-query hook)
// =====================================================

type QueryFn<T> = (tenantId: string) => Promise<{
  success: boolean;
  data?: T[];
  error?: string;
}>;

function useAnalyticsQuery<T>(
  queryFn: QueryFn<T>,
  tenantId: string | null,
  autoLoad = true
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await queryFn(tenantId);
      if (!mountedRef.current) return;
      if (result.success) {
        setData(result.data || []);
      } else {
        setError(result.error || 'Query failed');
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [queryFn, tenantId]);

  useEffect(() => {
    mountedRef.current = true;
    if (autoLoad) refresh();
    return () => { mountedRef.current = false; };
  }, [refresh, autoLoad]);

  return { data, loading, error, refresh };
}

// =====================================================
// Specialized Query Hooks
// =====================================================

export function usePatientRiskDistribution(tenantId: string | null) {
  return useAnalyticsQuery<RiskDistribution>(getPatientRiskDistribution, tenantId);
}

export function useReadmissionRiskSummary(tenantId: string | null) {
  return useAnalyticsQuery<ReadmissionRisk>(getReadmissionRiskSummary, tenantId);
}

export function useEncounterSummary(tenantId: string | null) {
  return useAnalyticsQuery<EncounterData>(getEncounterSummary, tenantId);
}

export function useSDOHFlagsSummary(tenantId: string | null) {
  return useAnalyticsQuery<SDOHFlag>(getSDOHFlagsSummary, tenantId);
}

export function useMedicationAdherence(tenantId: string | null) {
  return useAnalyticsQuery<AdherenceStat>(getMedicationAdherenceStats, tenantId);
}

export function useClaimsStatusSummary(tenantId: string | null) {
  return useAnalyticsQuery<ClaimStatus>(getClaimsStatusSummary, tenantId);
}

export function useBillingRevenueTrend(tenantId: string | null) {
  return useAnalyticsQuery<RevenueTrend>(getBillingRevenueSummary, tenantId);
}

export function useCarePlanSummary(tenantId: string | null) {
  return useAnalyticsQuery<CarePlanStatus>(getCarePlanSummary, tenantId);
}

export function useTaskCompletionRate(tenantId: string | null) {
  return useAnalyticsQuery<TaskCompletion>(getTaskCompletionRate, tenantId);
}

export function useReferralSummary(tenantId: string | null) {
  return useAnalyticsQuery<ReferralData>(getReferralSummary, tenantId);
}

export function useBedAvailability(tenantId: string | null) {
  return useAnalyticsQuery<BedStatus>(getBedAvailability, tenantId);
}

export function useShiftHandoffSummary(tenantId: string | null) {
  return useAnalyticsQuery<HandoffData>(getShiftHandoffSummary, tenantId);
}

export function useQualityMetrics(tenantId: string | null) {
  return useAnalyticsQuery<QualityMeasure>(getQualityMetrics, tenantId);
}
