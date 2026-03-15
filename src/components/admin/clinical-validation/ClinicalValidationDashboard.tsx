/**
 * ClinicalValidationDashboard — Admin panel for AI code validation monitoring
 *
 * Purpose: Displays validation hook results — rejection rates, top hallucinated codes,
 *          reference data health, and a filterable rejection log.
 * Used by: Admin panel (sectionDefinitions.tsx)
 *
 * Visual acceptance required: Maria must see this rendered before "done."
 */

import React, { useCallback, useState } from 'react';
import { EACard, EACardContent } from '../../envision-atlus/EACard';
import { EAAlert } from '../../envision-atlus/EAAlert';
import { ValidationSummaryCards } from './ValidationSummaryCards';
import { RejectionLogTable } from './RejectionLogTable';
import { ReferenceDataHealthPanel } from './ReferenceDataHealthPanel';
import { ClinicalContentReviewPanel } from './ClinicalContentReviewPanel';
import { useValidationData } from './useValidationData';
import { exportValidationReportPDF, exportDRGReferencePDF } from './pdfExportService';
import type { DRGReferenceEntry } from './pdfExportService';
import type { ValidationFilters } from './ClinicalValidationDashboard.types';
import { useSupabaseClient } from '../../../contexts/AuthContext';

/** AI functions that are wired with validation hooks */
const SOURCE_FUNCTIONS = [
  { value: 'coding-suggest', label: 'Coding Suggest' },
  { value: 'sdoh-coding-suggest', label: 'SDOH Coding' },
  { value: 'ai-soap-note-generator', label: 'SOAP Note Generator' },
  { value: 'ai-discharge-summary', label: 'Discharge Summary' },
  { value: 'ai-fall-risk-predictor', label: 'Fall Risk Predictor' },
  { value: 'ai-care-escalation-scorer', label: 'Care Escalation Scorer' },
  { value: 'ai-medication-reconciliation', label: 'Medication Reconciliation' },
  { value: 'ai-treatment-pathway', label: 'Treatment Pathway' },
  { value: 'mcp-drg-grouper', label: 'DRG Grouper' },
  { value: 'mcp-revenue-optimizer', label: 'Revenue Optimizer' },
];

const CODE_SYSTEMS = [
  { value: 'icd10', label: 'ICD-10' },
  { value: 'cpt', label: 'CPT' },
  { value: 'hcpcs', label: 'HCPCS' },
  { value: 'drg', label: 'DRG' },
  { value: 'z-code', label: 'Z-Code' },
  { value: 'rxnorm', label: 'RxNorm' },
];

const REJECTION_REASONS = [
  { value: 'code_not_found', label: 'Code Not Found' },
  { value: 'code_inactive', label: 'Code Inactive' },
  { value: 'invalid_format', label: 'Invalid Format' },
  { value: 'wrong_fiscal_year', label: 'Wrong Fiscal Year' },
  { value: 'allergy_conflict', label: 'Allergy Conflict' },
  { value: 'out_of_range', label: 'Out of Range' },
  { value: 'system_mismatch', label: 'System Mismatch' },
];

export const ClinicalValidationDashboard: React.FC = () => {
  const supabase = useSupabaseClient();
  const {
    summary,
    rejectionLog,
    referenceData,
    loading,
    error,
    filters,
    setFilters,
    refresh,
  } = useValidationData();
  const [exporting, setExporting] = useState(false);

  const handleFilterChange = useCallback(
    (key: keyof ValidationFilters, value: string | null) => {
      setFilters({ ...filters, [key]: value });
    },
    [filters, setFilters]
  );

  /** Export validation report as PDF */
  const handleExportReport = useCallback(() => {
    if (!summary) return;
    exportValidationReportPDF({
      summary,
      rejectionLog,
      referenceData,
      dateRange: filters.dateRange,
    });
  }, [summary, rejectionLog, referenceData, filters.dateRange]);

  /** Fetch DRG reference data and export as PDF */
  const handleExportDRG = useCallback(async () => {
    setExporting(true);
    try {
      const { data, error: drgError } = await supabase
        .from('ms_drg_reference')
        .select('drg_code, description, relative_weight, mdc, type')
        .order('drg_code');

      if (drgError) {
        throw new Error(drgError.message);
      }

      const entries = (data ?? []) as DRGReferenceEntry[];
      if (entries.length === 0) {
        return; // No data to export
      }
      exportDRGReferencePDF(entries);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Show error via alert since this is a user action
      window.alert(`Failed to export DRG table: ${msg}`);
    } finally {
      setExporting(false);
    }
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--ea-primary)]" />
        <span className="ml-3 text-slate-400">Loading validation data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <EAAlert variant="warning" title="Error Loading Validation Data">
        {error}. <button onClick={refresh} className="underline text-[var(--ea-primary)] min-h-[44px]">Retry</button>
      </EAAlert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <EACard>
        <EACardContent>
          <div className="flex flex-wrap items-center gap-4">
            {/* Date range */}
            <div>
              <label htmlFor="validation-date-range" className="text-xs text-slate-400 block mb-1">
                Time Range
              </label>
              <select
                id="validation-date-range"
                value={filters.dateRange}
                onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white min-h-[44px]"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>

            {/* AI Function filter */}
            <div>
              <label htmlFor="validation-source" className="text-xs text-slate-400 block mb-1">
                AI Function
              </label>
              <select
                id="validation-source"
                value={filters.sourceFunction ?? ''}
                onChange={(e) => handleFilterChange('sourceFunction', e.target.value || null)}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white min-h-[44px]"
              >
                <option value="">All Functions</option>
                {SOURCE_FUNCTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Code System filter */}
            <div>
              <label htmlFor="validation-system" className="text-xs text-slate-400 block mb-1">
                Code System
              </label>
              <select
                id="validation-system"
                value={filters.codeSystem ?? ''}
                onChange={(e) => handleFilterChange('codeSystem', e.target.value || null)}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white min-h-[44px]"
              >
                <option value="">All Systems</option>
                {CODE_SYSTEMS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Reason filter */}
            <div>
              <label htmlFor="validation-reason" className="text-xs text-slate-400 block mb-1">
                Rejection Reason
              </label>
              <select
                id="validation-reason"
                value={filters.reason ?? ''}
                onChange={(e) => handleFilterChange('reason', e.target.value || null)}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white min-h-[44px]"
              >
                <option value="">All Reasons</option>
                {REJECTION_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="ml-auto self-end flex gap-2">
              <button
                onClick={handleExportReport}
                disabled={!summary}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm font-medium min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export Report PDF
              </button>
              <button
                onClick={handleExportDRG}
                disabled={exporting}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? 'Exporting...' : 'Export DRG Table'}
              </button>
              <button
                onClick={refresh}
                className="bg-[var(--ea-primary)] hover:bg-[var(--ea-primary-hover)] text-white px-4 py-2 rounded text-sm font-medium min-h-[44px]"
              >
                Refresh
              </button>
            </div>
          </div>
        </EACardContent>
      </EACard>

      {/* Summary cards */}
      {summary && <ValidationSummaryCards summary={summary} />}

      {/* Reference Data Health (Phase 5-2) */}
      <ReferenceDataHealthPanel sources={referenceData} />

      {/* Rejection Log Table */}
      <RejectionLogTable entries={rejectionLog} />

      {/* Clinical Content Review (Phase 7-2) */}
      <ClinicalContentReviewPanel />
    </div>
  );
};

export default ClinicalValidationDashboard;
