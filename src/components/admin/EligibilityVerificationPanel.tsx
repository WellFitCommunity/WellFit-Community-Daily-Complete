/**
 * EligibilityVerificationPanel - Insurance Eligibility Verification
 *
 * Purpose: Shows encounter coverage verification status and enables
 * one-click eligibility checks (270/271) before billing.
 *
 * Used by: sectionDefinitions.tsx (revenue category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  RefreshCw,
  Filter,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Clock,
  Lock,
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
  eligibilityVerificationService,
} from '../../services/eligibilityVerificationService';
import type {
  EncounterEligibility,
  EligibilityStats,
  CoverageStatus,
} from '../../services/eligibilityVerificationService';
import {
  checkPriorAuthRequired,
} from '../../services/mcp/mcpCMSCoverageClient';
import { auditLogger } from '../../services/auditLogger';

// =============================================================================
// TYPES
// =============================================================================

type StatusFilter = 'all' | CoverageStatus;

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

function getCoverageBadge(status: CoverageStatus): {
  label: string;
  variant: 'info' | 'neutral' | 'elevated' | 'critical';
  icon: React.ReactNode;
} {
  switch (status) {
    case 'active':
      return { label: 'Active', variant: 'info', icon: <CheckCircle className="w-3 h-3" /> };
    case 'inactive':
      return { label: 'Inactive', variant: 'critical', icon: <XCircle className="w-3 h-3" /> };
    case 'expired':
      return { label: 'Expired', variant: 'critical', icon: <XCircle className="w-3 h-3" /> };
    case 'error':
      return { label: 'Error', variant: 'elevated', icon: <AlertTriangle className="w-3 h-3" /> };
    case 'unverified':
    default:
      return { label: 'Unverified', variant: 'neutral', icon: <Clock className="w-3 h-3" /> };
  }
}

function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return '--';
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function EligibilityStatCard({ label, value, color }: {
  label: string;
  value: number;
  color: 'green' | 'amber' | 'red' | 'gray';
}) {
  const colorMap = {
    green: 'bg-green-50 border-green-200 text-green-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    gray: 'bg-gray-50 border-gray-200 text-gray-900',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function CoverageDetailsPanel({ encounter }: { encounter: EncounterEligibility }) {
  const details = encounter.coverage_details;
  if (!details) return null;

  return (
    <div className="bg-blue-50 rounded-md p-3 mt-2 text-sm">
      <div className="grid grid-cols-2 gap-2">
        {details.plan_name && (
          <div>
            <span className="text-gray-500">Plan:</span>{' '}
            <span className="font-medium">{details.plan_name}</span>
          </div>
        )}
        {details.subscriber_id && (
          <div>
            <span className="text-gray-500">Subscriber:</span>{' '}
            <span className="font-medium">{details.subscriber_id}</span>
          </div>
        )}
        {details.copay !== undefined && (
          <div>
            <span className="text-gray-500">Copay:</span>{' '}
            <span className="font-medium">{formatCurrency(details.copay)}</span>
          </div>
        )}
        {details.coinsurance_percent !== undefined && (
          <div>
            <span className="text-gray-500">Coinsurance:</span>{' '}
            <span className="font-medium">{details.coinsurance_percent}%</span>
          </div>
        )}
        {details.deductible_remaining !== undefined && (
          <div>
            <span className="text-gray-500">Deductible Remaining:</span>{' '}
            <span className="font-medium">{formatCurrency(details.deductible_remaining)}</span>
          </div>
        )}
        {details.effective_date && (
          <div>
            <span className="text-gray-500">Effective:</span>{' '}
            <span className="font-medium">{formatDate(details.effective_date)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// CMS COVERAGE ALERT SUB-COMPONENT
// =============================================================================

function CMSCoverageAlertPanel({ alert }: { alert: { priorAuthCodes: string[]; documentationNeeded: string[] } }) {
  if (alert.priorAuthCodes.length === 0 && alert.documentationNeeded.length === 0) return null;

  return (
    <div className="bg-amber-50 rounded-md p-3 mt-2 text-sm border border-amber-200">
      <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
        <AlertTriangle className="w-3.5 h-3.5" />
        CMS Coverage Alert
      </div>
      {alert.priorAuthCodes.length > 0 && (
        <div className="mb-1">
          <span className="text-amber-900 font-medium">Prior Auth Required: </span>
          <span className="font-mono text-amber-800">
            {alert.priorAuthCodes.join(', ')}
          </span>
        </div>
      )}
      {alert.documentationNeeded.length > 0 && (
        <div>
          <span className="text-amber-900 font-medium">Documentation Needed:</span>
          <ul className="list-disc list-inside text-amber-800 mt-1">
            {alert.documentationNeeded.map((doc, i) => (
              <li key={i}>{doc}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const EligibilityVerificationPanel: React.FC = () => {
  const [encounters, setEncounters] = useState<EncounterEligibility[]>([]);
  const [stats, setStats] = useState<EligibilityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [patientSearch, setPatientSearch] = useState('');
  const [verifying, setVerifying] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [coverageAlerts, setCoverageAlerts] = useState<Record<string, {
    priorAuthCodes: string[];
    documentationNeeded: string[];
  }>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [encRes, statsRes] = await Promise.all([
      eligibilityVerificationService.getEncountersForVerification(),
      eligibilityVerificationService.getEligibilityStats(),
    ]);

    if (!encRes.success) {
      setError(encRes.error.message);
      setEncounters([]);
    } else {
      setEncounters(encRes.data);
    }

    if (statsRes.success) {
      setStats(statsRes.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVerify = async (enc: EncounterEligibility) => {
    setVerifying(enc.encounter_id);
    const result = await eligibilityVerificationService.verifyEncounterEligibility(enc.encounter_id);

    if (!result.success) {
      setError(result.error.message);
    } else {
      await fetchData();

      // Run CMS coverage check for encounter procedure codes
      try {
        const procedureCodes = enc.procedure_codes ?? [];
        if (procedureCodes.length > 0) {
          const authPromises = procedureCodes.map(code =>
            checkPriorAuthRequired(code)
          );
          const authResults = await Promise.all(authPromises);
          const priorAuthCodes: string[] = [];
          const docNeeded: string[] = [];

          for (const res of authResults) {
            if (res.success && res.data?.requires_prior_auth) {
              priorAuthCodes.push(res.data.cpt_code);
              if (res.data.documentation_required) {
                docNeeded.push(...res.data.documentation_required);
              }
            }
          }

          setCoverageAlerts(prev => ({
            ...prev,
            [enc.encounter_id]: {
              priorAuthCodes,
              documentationNeeded: [...new Set(docNeeded)],
            },
          }));

          await auditLogger.info('ELIGIBILITY_CMS_COVERAGE_CHECKED', {
            encounterId: enc.encounter_id,
            procedureCount: procedureCodes.length,
            priorAuthRequired: priorAuthCodes.length,
          });
        }
      } catch (err: unknown) {
        await auditLogger.error(
          'ELIGIBILITY_CMS_COVERAGE_CHECK_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { encounterId: enc.encounter_id }
        );
      }
    }
    setVerifying(null);
  };

  // Client-side filtering
  const filteredEncounters = encounters.filter(enc => {
    if (filter !== 'all' && enc.coverage_status !== filter) return false;
    if (patientSearch) {
      const q = patientSearch.toLowerCase();
      if (!enc.patient_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const unverifiedCount = stats?.unverified ?? 0;

  // --- Loading state ---
  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center p-12">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600 mr-3" />
          <span className="text-gray-600">Loading eligibility data...</span>
        </EACardContent>
      </EACard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alert Banner */}
      {unverifiedCount > 0 && (
        <EAAlert variant="warning">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {unverifiedCount} encounter{unverifiedCount !== 1 ? 's' : ''} with unverified coverage approaching billing.
            </span>
          </div>
        </EAAlert>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <EligibilityStatCard label="Verified Active" value={stats.verified_active} color="green" />
          <EligibilityStatCard label="Unverified" value={stats.unverified} color="amber" />
          <EligibilityStatCard label="Inactive / Expired" value={stats.inactive_or_expired} color="red" />
          <EligibilityStatCard label="Errors" value={stats.errors} color="gray" />
        </div>
      )}

      {/* Error */}
      {error && (
        <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>
          {error}
        </EAAlert>
      )}

      {/* Encounters Table */}
      <EACard>
        <EACardHeader
          icon={<Shield className="w-5 h-5" />}
          action={
            <EAButton variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </EAButton>
          }
        >
          Eligibility Verification
        </EACardHeader>

        <EACardContent className="p-0">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-gray-50">
            <Filter className="w-4 h-4 text-gray-400" />

            <select
              value={filter}
              onChange={e => setFilter(e.target.value as StatusFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
              aria-label="Filter by coverage status"
            >
              <option value="all">All Statuses</option>
              <option value="unverified">Unverified</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
              <option value="error">Error</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                placeholder="Search patient..."
                className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 w-44 pl-7"
                aria-label="Search by patient name"
              />
            </div>
          </div>

          {/* Table Header */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
            <span className="w-40">Patient</span>
            <span className="w-32">Payer</span>
            <span className="w-28">Date of Service</span>
            <span className="w-24">Coverage</span>
            <span className="w-28">Prior Auth</span>
            <span className="w-28">Verified At</span>
            <span className="flex-1 text-right">Actions</span>
          </div>

          {/* Rows */}
          {filteredEncounters.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-300" />
              <p className="text-sm font-medium">No encounters need verification</p>
              <p className="text-xs mt-1">
                {encounters.length === 0
                  ? 'No billable encounters found.'
                  : 'No encounters match the current filters.'}
              </p>
            </div>
          ) : (
            filteredEncounters.map(enc => {
              const badge = getCoverageBadge(enc.coverage_status);
              const isVerifying = verifying === enc.encounter_id;
              const isExpanded = expandedId === enc.encounter_id;

              return (
                <div key={enc.encounter_id}>
                  <div
                    className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : enc.encounter_id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Toggle details for ${enc.patient_name}`}
                    onKeyDown={e => { if (e.key === 'Enter') setExpandedId(isExpanded ? null : enc.encounter_id); }}
                  >
                    <span className="text-sm text-gray-900 w-40 truncate font-medium" title={enc.patient_name}>
                      {enc.patient_name}
                    </span>

                    <span className="text-sm text-gray-600 w-32 truncate" title={enc.payer_name}>
                      {enc.payer_name}
                    </span>

                    <span className="text-sm text-gray-600 w-28">
                      {formatDate(enc.date_of_service)}
                    </span>

                    <span className="w-24">
                      <EABadge variant={badge.variant} size="sm">
                        <span className="flex items-center gap-1">
                          {badge.icon} {badge.label}
                        </span>
                      </EABadge>
                    </span>

                    {/* Prior Auth Badge */}
                    <span className="w-28">
                      {coverageAlerts[enc.encounter_id] ? (
                        coverageAlerts[enc.encounter_id].priorAuthCodes.length > 0 ? (
                          <a
                            href="/admin/prior-auth"
                            className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded-full hover:bg-red-200 transition-colors font-medium"
                            title={`PA required for: ${coverageAlerts[enc.encounter_id].priorAuthCodes.join(', ')}`}
                            onClick={e => e.stopPropagation()}
                          >
                            <Lock className="w-2.5 h-2.5" />
                            PA Required
                          </a>
                        ) : (
                          <EABadge variant="normal" size="sm">No PA Needed</EABadge>
                        )
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </span>

                    <span className="w-28 text-xs text-gray-500">
                      {formatDate(enc.coverage_verified_at)}
                    </span>

                    <span className="flex-1 flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                      <EAButton
                        variant={enc.coverage_status === 'unverified' ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => handleVerify(enc)}
                        disabled={isVerifying}
                      >
                        {isVerifying ? (
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Shield className="w-3 h-3 mr-1" />
                        )}
                        {enc.coverage_status === 'unverified' ? 'Verify' : 'Re-verify'}
                      </EAButton>
                    </span>
                  </div>

                  {/* Expanded Coverage Details */}
                  {isExpanded && enc.coverage_details && (
                    <div className="px-4 pb-3">
                      <CoverageDetailsPanel encounter={enc} />
                    </div>
                  )}

                  {/* CMS Coverage Alerts (prior auth requirements) */}
                  {isExpanded && coverageAlerts[enc.encounter_id] && (
                    <div className="px-4 pb-3">
                      <CMSCoverageAlertPanel alert={coverageAlerts[enc.encounter_id]} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </EACardContent>
      </EACard>
    </div>
  );
};

export default EligibilityVerificationPanel;
