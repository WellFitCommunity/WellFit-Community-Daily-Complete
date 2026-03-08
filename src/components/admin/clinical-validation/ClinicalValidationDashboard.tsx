/**
 * ClinicalValidationDashboard — Admin panel for AI code validation monitoring
 *
 * Purpose: Displays validation hook results — rejection rates, top hallucinated codes,
 *          reference data health, and a filterable rejection log.
 * Used by: Admin panel (sectionDefinitions.tsx)
 *
 * Visual acceptance required: Maria must see this rendered before "done."
 */

import React, { useCallback } from 'react';
import { EACard, EACardContent } from '../../envision-atlus/EACard';
import { EAAlert } from '../../envision-atlus/EAAlert';
import { ValidationSummaryCards } from './ValidationSummaryCards';
import { RejectionLogTable } from './RejectionLogTable';
import { ReferenceDataHealthPanel } from './ReferenceDataHealthPanel';
import { useValidationData } from './useValidationData';
import type { ValidationFilters } from './ClinicalValidationDashboard.types';

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

  const handleFilterChange = useCallback(
    (key: keyof ValidationFilters, value: string | null) => {
      setFilters({ ...filters, [key]: value });
    },
    [filters, setFilters]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <span className="ml-3 text-slate-400">Loading validation data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <EAAlert variant="warning" title="Error Loading Validation Data">
        {error}. <button onClick={refresh} className="underline text-blue-400 min-h-[44px]">Retry</button>
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

            {/* Refresh */}
            <div className="ml-auto self-end">
              <button
                onClick={refresh}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium min-h-[44px]"
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
    </div>
  );
};

export default ClinicalValidationDashboard;
