/**
 * useValidationData — Data hook for Clinical Validation Dashboard
 *
 * Fetches validation_hook_results and reference_data_versions
 * from Supabase with date range filtering.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient } from '../../../contexts/AuthContext';
import type {
  ValidationHookResult,
  ValidationSummary,
  RejectionLogEntry,
  ReferenceDataSource,
  ValidationFilters,
} from './ClinicalValidationDashboard.types';

interface UseValidationDataReturn {
  summary: ValidationSummary | null;
  rejectionLog: RejectionLogEntry[];
  referenceData: ReferenceDataSource[];
  loading: boolean;
  error: string | null;
  filters: ValidationFilters;
  setFilters: (filters: ValidationFilters) => void;
  refresh: () => void;
}

/** Calculate the start date from a date range filter */
function getStartDate(range: '7d' | '30d' | '90d'): string {
  const now = new Date();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

/** Compute summary from raw results */
function computeSummary(results: ValidationHookResult[]): ValidationSummary {
  if (results.length === 0) {
    return {
      totalRuns: 0,
      totalCodesChecked: 0,
      totalCodesRejected: 0,
      totalCodesSuppressed: 0,
      rejectionRate: 0,
      avgResponseTimeMs: 0,
      topHallucinatedCode: null,
      topHallucinatedCount: 0,
    };
  }

  let totalChecked = 0;
  let totalRejected = 0;
  let totalSuppressed = 0;
  let totalResponseTime = 0;
  const codeCounts = new Map<string, number>();

  for (const r of results) {
    totalChecked += r.codes_checked;
    totalRejected += r.codes_rejected;
    totalSuppressed += r.codes_suppressed;
    totalResponseTime += r.response_time_ms;

    // Count rejected codes for "top hallucinated"
    if (Array.isArray(r.rejected_details)) {
      for (const d of r.rejected_details) {
        const key = `${d.system}:${d.code}`;
        codeCounts.set(key, (codeCounts.get(key) ?? 0) + 1);
      }
    }
  }

  // Find top hallucinated code
  let topCode: string | null = null;
  let topCount = 0;
  for (const [key, count] of codeCounts) {
    if (count > topCount) {
      topCode = key;
      topCount = count;
    }
  }

  return {
    totalRuns: results.length,
    totalCodesChecked: totalChecked,
    totalCodesRejected: totalRejected,
    totalCodesSuppressed: totalSuppressed,
    rejectionRate: totalChecked > 0 ? (totalRejected / totalChecked) * 100 : 0,
    avgResponseTimeMs: Math.round(totalResponseTime / results.length),
    topHallucinatedCode: topCode,
    topHallucinatedCount: topCount,
  };
}

/** Build rejection log entries from raw results */
function buildRejectionLog(
  results: ValidationHookResult[],
  filters: ValidationFilters
): RejectionLogEntry[] {
  const entries: RejectionLogEntry[] = [];

  for (const r of results) {
    if (!Array.isArray(r.rejected_details) || r.rejected_details.length === 0) continue;

    for (const d of r.rejected_details) {
      // Apply code system filter
      if (filters.codeSystem && d.system !== filters.codeSystem) continue;
      // Apply reason filter
      if (filters.reason && d.reason !== filters.reason) continue;

      entries.push({
        id: `${r.id}-${d.code}`,
        date: r.created_at,
        sourceFunction: r.source_function,
        code: d.code,
        system: d.system,
        reason: d.reason,
        detail: d.detail,
      });
    }
  }

  // Sort by date descending
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return entries;
}

export function useValidationData(): UseValidationDataReturn {
  const supabase = useSupabaseClient();
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [rejectionLog, setRejectionLog] = useState<RejectionLogEntry[]>([]);
  const [referenceData, setReferenceData] = useState<ReferenceDataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ValidationFilters>({
    dateRange: '30d',
    sourceFunction: null,
    codeSystem: null,
    reason: null,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const startDate = getStartDate(filters.dateRange);

      // Build query
      let query = supabase
        .from('validation_hook_results')
        .select('id, created_at, source_function, patient_id, tenant_id, codes_checked, codes_validated, codes_rejected, codes_suppressed, rejected_details, validation_method, response_time_ms')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false })
        .limit(1000);

      // Apply source function filter
      if (filters.sourceFunction) {
        query = query.eq('source_function', filters.sourceFunction);
      }

      const { data: results, error: queryError } = await query;

      if (queryError) {
        setError(queryError.message);
        return;
      }

      const typedResults = (results ?? []) as ValidationHookResult[];
      setSummary(computeSummary(typedResults));
      setRejectionLog(buildRejectionLog(typedResults, filters));

      // Fetch reference data health
      const { data: refData, error: refError } = await supabase
        .from('reference_data_versions')
        .select('id, source_name, source_type, last_updated, version, status, next_expected_update, notes')
        .order('source_name');

      if (refError) {
        setError(refError.message);
        return;
      }

      setReferenceData((refData ?? []) as ReferenceDataSource[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filters, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    summary,
    rejectionLog,
    referenceData,
    loading,
    error,
    filters,
    setFilters,
    refresh: fetchData,
  };
}
