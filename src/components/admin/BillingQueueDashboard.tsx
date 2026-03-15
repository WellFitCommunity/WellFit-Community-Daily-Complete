/**
 * BillingQueueDashboard - Encounter-to-Superbill Billing Queue
 *
 * Purpose: Shows encounters in billable states (signed/ready_for_billing/billed/completed)
 * and their superbill status. Enables one-click superbill generation from signed encounters.
 *
 * Used by: sectionDefinitions.tsx (revenue category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  RefreshCw,
  Filter,
  AlertTriangle,
  CheckCircle,
  Plus,
  Search,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  EACard,
  EACardContent,
  EACardHeader,
  EAButton,
  EAAlert,
  EABadge,
} from '../envision-atlus';
import {
  encounterBillingBridgeService,
} from '../../services/encounterBillingBridgeService';
import type {
  BillingQueueEncounter,
  BillingQueueStats,
  SuperbillStatus,
} from '../../services/encounterBillingBridgeService';
import { useBillingCodeValidation, type CodeValidationState } from '../../hooks/useBillingCodeValidation';
import MedicalCodeSearch, { type CodeType } from './MedicalCodeSearch';
import { validateBillingCodes } from '../../services/mcp/mcpMedicalCodesClient';
import { auditLogger } from '../../services/auditLogger';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';

// =============================================================================
// TYPES
// =============================================================================

type QueueFilter = 'all' | 'awaiting' | 'draft' | 'pending_review' | 'approved' | 'claimed';

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getSuperbillBadge(status: SuperbillStatus | null): { label: string; variant: 'neutral' | 'info' | 'elevated' | 'critical' } {
  if (!status) return { label: 'No Superbill', variant: 'neutral' };
  switch (status) {
    case 'draft': return { label: 'Draft', variant: 'info' };
    case 'pending_review': return { label: 'Pending Review', variant: 'elevated' };
    case 'approved': return { label: 'Approved', variant: 'info' };
    case 'claimed': return { label: 'Claimed', variant: 'info' };
    case 'rejected': return { label: 'Rejected', variant: 'critical' };
    default: return { label: status, variant: 'neutral' };
  }
}

function matchesFilter(enc: BillingQueueEncounter, filter: QueueFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'awaiting') return !enc.superbill_status;
  return enc.superbill_status === filter;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatCard({ label, value, color }: {
  label: string;
  value: number;
  color: 'amber' | 'blue' | 'indigo' | 'green' | 'gray';
}) {
  const colorMap = {
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    gray: 'bg-gray-50 border-gray-200 text-gray-900',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const BillingQueueDashboard: React.FC = () => {
  useDashboardTheme();
  const [queue, setQueue] = useState<BillingQueueEncounter[]>([]);
  const [stats, setStats] = useState<BillingQueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [patientSearch, setPatientSearch] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, CodeValidationState>>({});
  const [codeLookupOpen, setCodeLookupOpen] = useState(false);
  const [lookupSelectedCPT, setLookupSelectedCPT] = useState<string[]>([]);
  const [lookupSelectedICD10, setLookupSelectedICD10] = useState<string[]>([]);
  const [lookupValidation, setLookupValidation] = useState<{ valid: boolean; issues: string[] } | null>(null);
  const codeValidation = useBillingCodeValidation();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [queueRes, statsRes] = await Promise.all([
      encounterBillingBridgeService.getBillingQueue(),
      encounterBillingBridgeService.getBillingQueueStats(),
    ]);

    if (!queueRes.success) {
      setError(queueRes.error.message);
      setQueue([]);
    } else {
      setQueue(queueRes.data);
    }

    if (statsRes.success) {
      setStats(statsRes.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCodeSelect = useCallback(async (code: string, codeType: CodeType, _description: string) => {
    const newCPT = codeType === 'cpt' ? [...lookupSelectedCPT, code] : lookupSelectedCPT;
    const newICD10 = codeType === 'icd10' ? [...lookupSelectedICD10, code] : lookupSelectedICD10;

    if (codeType === 'cpt') setLookupSelectedCPT(newCPT);
    if (codeType === 'icd10') setLookupSelectedICD10(newICD10);

    if (newCPT.length > 0 || newICD10.length > 0) {
      try {
        const res = await validateBillingCodes(newCPT, newICD10);
        if (res.success && res.data) {
          const issues = res.data.bundling_issues.map(i => i.issue);
          setLookupValidation({ valid: res.data.is_valid, issues });
        }
      } catch (err: unknown) {
        await auditLogger.error(
          'CODE_LOOKUP_VALIDATION_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { cptCodes: newCPT, icd10Codes: newICD10 }
        );
      }
    }
  }, [lookupSelectedCPT, lookupSelectedICD10]);

  const handleGenerate = async (enc: BillingQueueEncounter) => {
    setGenerating(enc.encounter_id);
    const result = await encounterBillingBridgeService.generateSuperbillDraft(
      enc.encounter_id,
      '', // tenant resolved from RLS context
    );

    if (!result.success) {
      setError(result.error.message);
    } else {
      // Auto-validate codes after superbill generation
      const superbill = result.data;
      const cptCodes = superbill.procedure_codes.map(p => p.code);
      const icd10Codes = superbill.diagnosis_codes.map(d => d.code);
      const modifiers = superbill.procedure_codes
        .flatMap(p => p.modifiers || [])
        .filter(Boolean);

      if (cptCodes.length > 0 || icd10Codes.length > 0) {
        const validation = await codeValidation.validateCodes(cptCodes, icd10Codes, modifiers);
        setValidationResults(prev => ({ ...prev, [enc.encounter_id]: validation }));
      }

      await fetchData();
    }
    setGenerating(null);
  };

  // Client-side filtering
  const filteredQueue = queue.filter(enc => {
    if (!matchesFilter(enc, filter)) return false;
    if (patientSearch) {
      const q = patientSearch.toLowerCase();
      if (!enc.patient_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const awaitingCount = stats?.awaiting_superbill ?? 0;

  // --- Loading state ---
  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center p-12">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--ea-primary,#00857a)] mr-3" />
          <span className="text-gray-600">Loading billing queue...</span>
        </EACardContent>
      </EACard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alert Banner */}
      {awaitingCount > 0 && (
        <EAAlert variant="warning">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {awaitingCount} signed encounter{awaitingCount !== 1 ? 's' : ''} awaiting superbill generation.
            </span>
          </div>
        </EAAlert>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <StatCard label="Awaiting Superbill" value={stats.awaiting_superbill} color="amber" />
          <StatCard label="Draft" value={stats.draft} color="blue" />
          <StatCard label="Pending Review" value={stats.pending_review} color="indigo" />
          <StatCard label="Approved" value={stats.approved} color="green" />
          <StatCard label="Claimed" value={stats.claimed} color="gray" />
        </div>
      )}

      {/* Error */}
      {error && (
        <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>
          {error}
        </EAAlert>
      )}

      {/* Code Lookup Panel */}
      <EACard>
        <button
          type="button"
          onClick={() => setCodeLookupOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          aria-expanded={codeLookupOpen}
        >
          <span className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            Code Lookup
            {lookupSelectedCPT.length > 0 && (
              <span className="text-xs bg-[var(--ea-primary,#00857a)]/10 text-[var(--ea-primary,#00857a)] px-2 py-0.5 rounded-full">
                {lookupSelectedCPT.length} CPT{lookupSelectedICD10.length > 0 ? `, ${lookupSelectedICD10.length} ICD-10` : ''}
              </span>
            )}
          </span>
          {codeLookupOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {codeLookupOpen && (
          <EACardContent className="pt-0 pb-4 px-4 space-y-3">
            <MedicalCodeSearch
              onCodeSelect={handleCodeSelect}
              selectedCodes={[...lookupSelectedCPT, ...lookupSelectedICD10]}
            />

            {/* Selected Codes Summary */}
            {(lookupSelectedCPT.length > 0 || lookupSelectedICD10.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {lookupSelectedCPT.map(c => (
                  <span key={c} className="text-xs bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-mono">CPT: {c}</span>
                ))}
                {lookupSelectedICD10.map(c => (
                  <span key={c} className="text-xs bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded font-mono">ICD: {c}</span>
                ))}
                <button
                  type="button"
                  onClick={() => { setLookupSelectedCPT([]); setLookupSelectedICD10([]); setLookupValidation(null); }}
                  className="text-xs text-gray-500 hover:text-red-600 underline ml-1"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Validation Badge */}
            {lookupValidation && (
              <div className={`flex items-center gap-1.5 text-sm ${lookupValidation.valid ? 'text-green-700' : 'text-amber-700'}`}>
                {lookupValidation.valid ? (
                  <><CheckCircle className="w-4 h-4" /> Codes valid ✓</>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    {lookupValidation.issues.length} code issue{lookupValidation.issues.length !== 1 ? 's' : ''}:
                    {lookupValidation.issues.map((issue, i) => (
                      <span key={i} className="text-xs"> {issue}</span>
                    ))}
                  </>
                )}
              </div>
            )}
          </EACardContent>
        )}
      </EACard>

      {/* Queue Table */}
      <EACard>
        <EACardHeader
          icon={<FileText className="w-5 h-5" />}
          action={
            <EAButton variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </EAButton>
          }
        >
          Billing Queue
        </EACardHeader>

        <EACardContent className="p-0">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-gray-50">
            <Filter className="w-4 h-4 text-gray-400" />

            <select
              value={filter}
              onChange={e => setFilter(e.target.value as QueueFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)]"
              aria-label="Filter by status"
            >
              <option value="all">All</option>
              <option value="awaiting">Awaiting Superbill</option>
              <option value="draft">Draft</option>
              <option value="pending_review">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="claimed">Claimed</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                placeholder="Search patient..."
                className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)] w-44 pl-7"
                aria-label="Search by patient name"
              />
            </div>
          </div>

          {/* Table Header */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
            <span className="w-40">Patient</span>
            <span className="w-28">Date of Service</span>
            <span className="w-24">Encounter</span>
            <span className="w-14 text-center">Dx</span>
            <span className="w-14 text-center">Px</span>
            <span className="w-28">Superbill</span>
            <span className="flex-1 text-right">Actions</span>
          </div>

          {/* Rows */}
          {filteredQueue.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-300" />
              <p className="text-sm font-medium">No encounters in billing queue</p>
              <p className="text-xs mt-1">
                {queue.length === 0
                  ? 'No signed encounters are waiting for billing.'
                  : 'No encounters match the current filters.'}
              </p>
            </div>
          ) : (
            filteredQueue.map(enc => {
              const badge = getSuperbillBadge(enc.superbill_status);
              const isGenerating = generating === enc.encounter_id;
              const validation = validationResults[enc.encounter_id];

              return (
                <div
                  key={enc.encounter_id}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm text-gray-900 w-40 truncate font-medium" title={enc.patient_name}>
                    {enc.patient_name}
                  </span>

                  <span className="text-sm text-gray-600 w-28">
                    {formatDate(enc.date_of_service)}
                  </span>

                  <span className="w-24">
                    <EABadge variant="info" size="sm">{enc.status}</EABadge>
                  </span>

                  <span className="w-14 text-center text-sm text-gray-700">
                    {enc.diagnosis_count}
                  </span>

                  <span className="w-14 text-center text-sm text-gray-700">
                    {enc.procedure_count}
                  </span>

                  <span className="w-28">
                    <EABadge variant={badge.variant} size="sm">
                      {badge.label}
                    </EABadge>
                    {validation && validation.status === 'warnings' && (
                      <span className="ml-1" title={`${validation.warningCount} code issue${validation.warningCount !== 1 ? 's' : ''} found`}>
                        <EABadge variant="elevated" size="sm">
                          {validation.warningCount} issue{validation.warningCount !== 1 ? 's' : ''}
                        </EABadge>
                      </span>
                    )}
                    {validation && validation.status === 'valid' && (
                      <span className="ml-1" title="All codes validated">
                        <EABadge variant="normal" size="sm">Codes OK</EABadge>
                      </span>
                    )}
                  </span>

                  <span className="flex-1 flex gap-2 justify-end">
                    {!enc.superbill_status && (
                      <EAButton
                        variant="primary"
                        size="sm"
                        onClick={() => handleGenerate(enc)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Plus className="w-3 h-3 mr-1" />
                        )}
                        Generate
                      </EAButton>
                    )}
                    {enc.superbill_status === 'draft' && (
                      <>
                      <EAButton variant="ghost" size="sm" disabled>
                        <ArrowRight className="w-3 h-3 mr-1" />
                        Submit
                      </EAButton>
                      <EAButton
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          // Navigate to HL7 Message Lab with Generate 837P mode
                          window.dispatchEvent(new CustomEvent('navigate-to-section', {
                            detail: { section: 'hl7-message-test', mode: 'generate_837p' },
                          }));
                        }}
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Generate X12
                      </EAButton>
                      </>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </EACardContent>
      </EACard>
    </div>
  );
};

export default BillingQueueDashboard;
