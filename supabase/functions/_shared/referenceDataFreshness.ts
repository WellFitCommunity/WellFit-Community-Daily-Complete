// =====================================================
// Reference Data Freshness Checker
// Monitors CMS/AMA reference data versions and alerts
// when data is stale. Used by health-monitor and
// DRG grouper (hard-fail on stale MS-DRG data).
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Row shape from reference_data_versions table */
interface ReferenceDataVersion {
  id: string;
  data_source: string;
  fiscal_year: number;
  version_label: string;
  record_count: number;
  loaded_at: string;
  expected_update_date: string | null;
  update_frequency: string;
  is_current: boolean;
  notes: string | null;
}

/** Result of a single data source freshness check */
export interface FreshnessCheckResult {
  dataSource: string;
  fiscalYear: number;
  versionLabel: string;
  recordCount: number;
  loadedAt: string;
  expectedUpdateDate: string | null;
  daysPastExpected: number | null;
  status: 'current' | 'warning' | 'stale' | 'critical' | 'empty';
  message: string;
}

/** Aggregate freshness report */
export interface FreshnessReport {
  checkedAt: string;
  totalSources: number;
  currentCount: number;
  warningCount: number;
  staleCount: number;
  criticalCount: number;
  emptyCount: number;
  results: FreshnessCheckResult[];
  blockDRG: boolean;
}

/** Thresholds for freshness status */
const WARNING_DAYS = 30;
const STALE_DAYS = 60;
const CRITICAL_DAYS = 90;

/**
 * Check freshness of all reference data sources.
 * Returns a report with per-source status and an
 * aggregate flag for whether DRG grouping should
 * be blocked (MS-DRG data from prior fiscal year).
 */
export async function checkReferenceDataFreshness(
  sb: SupabaseClient
): Promise<FreshnessReport> {
  const now = new Date();
  const currentFiscalYear = getFiscalYear(now);

  const { data, error } = await sb
    .from('reference_data_versions')
    .select('*')
    .eq('is_current', true)
    .order('data_source');

  if (error) {
    throw new Error(`Failed to query reference_data_versions: ${String(error)}`);
  }

  const versions = (data || []) as ReferenceDataVersion[];
  const results: FreshnessCheckResult[] = [];

  for (const v of versions) {
    const result = evaluateSource(v, now, currentFiscalYear);
    results.push(result);
  }

  const currentCount = results.filter(r => r.status === 'current').length;
  const warningCount = results.filter(r => r.status === 'warning').length;
  const staleCount = results.filter(r => r.status === 'stale').length;
  const criticalCount = results.filter(r => r.status === 'critical').length;
  const emptyCount = results.filter(r => r.status === 'empty').length;

  // Block DRG if MS-DRG data is from a prior fiscal year
  const msDrgResult = results.find(r => r.dataSource === 'ms_drg');
  const blockDRG = msDrgResult
    ? msDrgResult.fiscalYear < currentFiscalYear || msDrgResult.status === 'empty'
    : true; // No MS-DRG record at all = block

  return {
    checkedAt: now.toISOString(),
    totalSources: results.length,
    currentCount,
    warningCount,
    staleCount,
    criticalCount,
    emptyCount,
    results,
    blockDRG,
  };
}

/**
 * Quick check for a single data source.
 * Use this in edge functions that depend on specific reference data
 * (e.g., DRG grouper checks 'ms_drg' before running).
 */
export async function checkSingleSource(
  sb: SupabaseClient,
  dataSource: string
): Promise<FreshnessCheckResult | null> {
  const { data } = await sb
    .from('reference_data_versions')
    .select('*')
    .eq('data_source', dataSource)
    .eq('is_current', true)
    .single();

  if (!data) return null;

  const now = new Date();
  return evaluateSource(data as ReferenceDataVersion, now, getFiscalYear(now));
}

// -------------------------------------------------------
// Internal helpers
// -------------------------------------------------------

function evaluateSource(
  v: ReferenceDataVersion,
  now: Date,
  currentFiscalYear: number
): FreshnessCheckResult {
  // Empty data
  if (v.record_count === 0) {
    return {
      dataSource: v.data_source,
      fiscalYear: v.fiscal_year,
      versionLabel: v.version_label,
      recordCount: 0,
      loadedAt: v.loaded_at,
      expectedUpdateDate: v.expected_update_date,
      daysPastExpected: null,
      status: 'empty',
      message: `${v.data_source}: No data loaded (0 records). Server using this data will return incomplete results.`,
    };
  }

  // Check fiscal year for annual sources
  if (v.update_frequency === 'annual' && v.fiscal_year < currentFiscalYear) {
    return {
      dataSource: v.data_source,
      fiscalYear: v.fiscal_year,
      versionLabel: v.version_label,
      recordCount: v.record_count,
      loadedAt: v.loaded_at,
      expectedUpdateDate: v.expected_update_date,
      daysPastExpected: null,
      status: 'critical',
      message: `${v.data_source}: Data is from FY${v.fiscal_year} but current fiscal year is FY${currentFiscalYear}. Update required.`,
    };
  }

  // Check days past expected update
  if (v.expected_update_date) {
    const expectedDate = new Date(v.expected_update_date);
    const diffMs = now.getTime() - expectedDate.getTime();
    const daysPast = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (daysPast > CRITICAL_DAYS) {
      return makeResult(v, daysPast, 'critical',
        `${v.data_source}: ${daysPast} days past expected update (${v.expected_update_date}). Immediate update required.`);
    }
    if (daysPast > STALE_DAYS) {
      return makeResult(v, daysPast, 'stale',
        `${v.data_source}: ${daysPast} days past expected update. Data may be outdated.`);
    }
    if (daysPast > WARNING_DAYS) {
      return makeResult(v, daysPast, 'warning',
        `${v.data_source}: ${daysPast} days past expected update. Check for new CMS release.`);
    }
    if (daysPast > 0) {
      return makeResult(v, daysPast, 'warning',
        `${v.data_source}: Update expected ${v.expected_update_date} — ${daysPast} days ago. Verify if new version available.`);
    }

    return makeResult(v, daysPast, 'current',
      `${v.data_source}: Current (FY${v.fiscal_year}, ${v.record_count} records). Next update expected ${v.expected_update_date}.`);
  }

  // No expected date (ongoing sources like LCD/NCD)
  return makeResult(v, null, 'current',
    `${v.data_source}: ${v.record_count} records loaded (${v.update_frequency} updates, no fixed schedule).`);
}

function makeResult(
  v: ReferenceDataVersion,
  daysPast: number | null,
  status: FreshnessCheckResult['status'],
  message: string
): FreshnessCheckResult {
  return {
    dataSource: v.data_source,
    fiscalYear: v.fiscal_year,
    versionLabel: v.version_label,
    recordCount: v.record_count,
    loadedAt: v.loaded_at,
    expectedUpdateDate: v.expected_update_date,
    daysPastExpected: daysPast,
    status,
    message,
  };
}

/**
 * CMS fiscal year runs Oct 1 → Sep 30.
 * FY2026 starts October 1, 2025.
 */
function getFiscalYear(date: Date): number {
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();
  return month >= 9 ? year + 1 : year; // Oct (9) or later = next FY
}
