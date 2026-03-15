/**
 * MPI Review Queue - Master Patient Index Duplicate Review Dashboard
 *
 * Purpose: Review potential duplicate patient matches and manage MPI operations
 * Features:
 * - Pending duplicate candidates queue
 * - Match score visualization
 * - Side-by-side patient comparison
 * - Quick actions for merge, link, or reject
 * - Statistics and metrics tracking
 *
 * Data access:
 * - Demographics via patientContextService.getBatchDemographics() (Phase 5)
 * - Address/email lazy-loaded on expand (not in PatientDemographics)
 *
 * Copyright © 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  RefreshCw,
  Search,
  CheckCircle,
  Clock,
  GitMerge,
  Unlink,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import {
  EACard,
  EACardContent,
  EAButton,
  EAAlert,
} from '../../envision-atlus';
import { mpiMatchingService, type MPIPriority } from '../../../services/mpiMatchingService';
import { auditLogger } from '../../../services/auditLogger';
import { supabase } from '../../../lib/supabaseClient';
import { patientContextService } from '../../../services/patient-context';
import type { PatientDemographics } from '../../../types/patientContext';
import ScoreBar from './ScoreBar';
import PatientComparisonCard from './PatientComparisonCard';
import {
  type CandidateWithPatients,
  type PatientAddressFields,
  type FilterStatus,
  type SortField,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  mapToPatientInfo,
} from './types';

interface MPIReviewQueueProps {
  tenantId: string;
}

const MPIReviewQueue: React.FC<MPIReviewQueueProps> = ({ tenantId }) => {
  const navigate = useNavigate();

  // State
  const [candidates, setCandidates] = useState<CandidateWithPatients[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [filterPriority, setFilterPriority] = useState<MPIPriority | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('score');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [detailsLoaded, setDetailsLoaded] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    underReview: 0,
    merged: 0,
    confirmedNotMatch: 0,
    highPriority: 0,
    urgentPriority: 0,
  });

  // Fetch candidates and their patient info
  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await mpiMatchingService.getPendingCandidates(tenantId, {
        limit: 100,
        priority: filterPriority !== 'all' ? filterPriority : undefined,
      });

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      // Batch-fetch demographics via patientContextService (single IN query)
      const allPatientIds = [...new Set(
        result.data.flatMap(c => [c.patient_id_a, c.patient_id_b])
      )];
      const batchResult = await patientContextService.getBatchDemographics(allPatientIds);
      const demoMap = batchResult.success ? batchResult.data : new Map<string, PatientDemographics>();

      const candidatesWithPatients: CandidateWithPatients[] = result.data.map(candidate => ({
        ...candidate,
        patientA: mapToPatientInfo(demoMap.get(candidate.patient_id_a)),
        patientB: mapToPatientInfo(demoMap.get(candidate.patient_id_b)),
      }));

      setCandidates(candidatesWithPatients);

      // Fetch stats
      const statsResult = await mpiMatchingService.getCandidateStats(tenantId);
      if (statsResult.success) {
        setStats(statsResult.data);
      }

      await auditLogger.info('MPI_QUEUE_VIEWED', {
        tenantId,
        candidateCount: candidatesWithPatients.length,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
      await auditLogger.error('MPI_QUEUE_FETCH_FAILED', error, { tenantId });
    } finally {
      setLoading(false);
    }
  }, [tenantId, filterPriority]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Lazy-load address/email on expand (task 5.2)
  const handleExpand = useCallback(async (candidateId: string) => {
    if (expandedId === candidateId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(candidateId);

    if (detailsLoaded.has(candidateId)) return;

    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;

    const [aRes, bRes] = await Promise.all([
      supabase.from('profiles').select('address, city, state, zip, email')
        .eq('user_id', candidate.patient_id_a).single(),
      supabase.from('profiles').select('address, city, state, zip, email')
        .eq('user_id', candidate.patient_id_b).single(),
    ]);

    setCandidates(prev => prev.map(c => {
      if (c.id !== candidateId) return c;
      const aFields = (aRes.data ?? {}) as PatientAddressFields;
      const bFields = (bRes.data ?? {}) as PatientAddressFields;
      return {
        ...c,
        patientA: c.patientA ? { ...c.patientA, ...aFields } : c.patientA,
        patientB: c.patientB ? { ...c.patientB, ...bFields } : c.patientB,
      };
    }));
    setDetailsLoaded(prev => new Set(prev).add(candidateId));
  }, [expandedId, detailsLoaded, candidates]);

  // Handle review decision
  const handleReview = async (
    candidateId: string,
    decision: 'confirmed_match' | 'confirmed_not_match' | 'deferred',
    notes?: string
  ) => {
    setActionLoading(candidateId);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to review candidates');
        return;
      }

      const result = await mpiMatchingService.reviewMatchCandidate(
        candidateId,
        user.id,
        decision,
        notes
      );

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      await fetchCandidates();

      if (decision === 'confirmed_match') {
        const candidate = candidates.find((c) => c.id === candidateId);
        if (candidate) {
          navigate(`/admin/mpi/merge?candidateId=${candidateId}&patientA=${candidate.patient_id_a}&patientB=${candidate.patient_id_b}`);
        }
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter and sort candidates
  const filteredCandidates = candidates
    .filter((c) => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterPriority !== 'all' && c.priority !== filterPriority) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const aName = `${c.patientA?.first_name || ''} ${c.patientA?.last_name || ''}`.toLowerCase();
        const bName = `${c.patientB?.first_name || ''} ${c.patientB?.last_name || ''}`.toLowerCase();
        return aName.includes(search) || bName.includes(search);
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortField) {
        case 'score':
          return b.overall_match_score - a.overall_match_score;
        case 'priority': {
          const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        case 'date':
          return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-[var(--ea-primary)]" />
            MPI Review Queue
          </h1>
          <p className="text-gray-500 mt-1">
            Review and manage potential duplicate patient records
          </p>
        </div>
        <EAButton
          variant="secondary"
          onClick={fetchCandidates}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </EAButton>
      </div>

      {/* Error Alert */}
      {error && (
        <EAAlert variant="critical" onDismiss={() => setError(null)} dismissible>
          {error}
        </EAAlert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { value: stats.total, label: 'Total Candidates', from: 'blue' },
          { value: stats.pending, label: 'Pending Review', from: 'yellow' },
          { value: stats.highPriority, label: 'High Priority', from: 'orange' },
          { value: stats.urgentPriority, label: 'Urgent', from: 'red' },
          { value: stats.merged, label: 'Merged', from: 'purple' },
          { value: stats.confirmedNotMatch, label: 'Not Matches', from: 'gray' },
          { value: stats.underReview, label: 'Under Review', from: 'green' },
        ].map(({ value, label, from }) => (
          <EACard key={label} className={`bg-gradient-to-br from-${from}-50 to-${from}-100`}>
            <EACardContent className="p-4">
              <div className={`text-2xl font-bold text-${from}-700`}>{value}</div>
              <div className={`text-sm text-${from}-600`}>{label}</div>
            </EACardContent>
          </EACard>
        ))}
      </div>

      {/* Filters */}
      <EACard>
        <EACardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by patient name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--ea-primary)] focus:border-[var(--ea-primary)]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--ea-primary)]"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="confirmed_match">Confirmed Match</option>
                <option value="confirmed_not_match">Not a Match</option>
              </select>
            </div>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as MPIPriority | 'all')}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--ea-primary)]"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>

            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-[var(--ea-primary)]"
            >
              <option value="score">Sort by Score</option>
              <option value="priority">Sort by Priority</option>
              <option value="date">Sort by Date</option>
            </select>
          </div>
        </EACardContent>
      </EACard>

      {/* Candidates List */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[var(--ea-primary)]" />
          <p className="mt-4 text-gray-500">Loading candidates...</p>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <EACard>
          <EACardContent className="p-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No Candidates Found</h3>
            <p className="text-gray-500 mt-2">
              {filterStatus === 'pending'
                ? 'All potential duplicates have been reviewed!'
                : 'No candidates match your current filters.'}
            </p>
          </EACardContent>
        </EACard>
      ) : (
        <div className="space-y-4">
          {filteredCandidates.map((candidate) => {
            const isExpanded = expandedId === candidate.id;
            const priorityConfig = PRIORITY_CONFIG[candidate.priority];
            const statusConfig = STATUS_CONFIG[candidate.status];

            return (
              <EACard key={candidate.id} className="overflow-hidden">
                {/* Summary Row */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleExpand(candidate.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`px-2 py-1 rounded-full border text-xs font-medium ${priorityConfig.color}`}>
                      {priorityConfig.label}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {candidate.patientA?.first_name} {candidate.patientA?.last_name}
                        </span>
                        <GitMerge className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="font-medium text-gray-900 truncate">
                          {candidate.patientB?.first_name} {candidate.patientB?.last_name}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        Detected {new Date(candidate.detected_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="w-32">
                      <ScoreBar score={candidate.overall_match_score} label="Match Score" />
                    </div>

                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                      {statusConfig.label}
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4 space-y-4">
                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="font-medium text-gray-900 mb-3">Field Match Scores</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(candidate.field_scores).map(([field, score]) => (
                          <ScoreBar
                            key={field}
                            score={score}
                            label={field.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="font-medium text-gray-900 mb-3">Patient Comparison</h4>
                      <PatientComparisonCard
                        patientA={candidate.patientA}
                        patientB={candidate.patientB}
                        fieldScores={candidate.field_scores}
                      />
                    </div>

                    {candidate.status === 'pending' && (
                      <div className="flex justify-end gap-3">
                        <EAButton
                          variant="secondary"
                          onClick={() => handleReview(candidate.id, 'deferred', 'Deferred for later review')}
                          disabled={actionLoading === candidate.id}
                        >
                          <Clock className="w-4 h-4 mr-2" />
                          Defer
                        </EAButton>

                        <EAButton
                          variant="secondary"
                          onClick={() => handleReview(candidate.id, 'confirmed_not_match', 'Confirmed as different patients')}
                          disabled={actionLoading === candidate.id}
                        >
                          <Unlink className="w-4 h-4 mr-2" />
                          Not a Match
                        </EAButton>

                        <EAButton
                          variant="primary"
                          onClick={() => handleReview(candidate.id, 'confirmed_match', 'Confirmed as same patient')}
                          disabled={actionLoading === candidate.id}
                        >
                          {actionLoading === candidate.id ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <GitMerge className="w-4 h-4 mr-2" />
                          )}
                          Confirm Match & Merge
                        </EAButton>
                      </div>
                    )}

                    <div className="text-sm text-gray-500 flex items-center gap-4">
                      <span>Algorithm: {candidate.match_algorithm_version}</span>
                      <span>•</span>
                      <span>Blocking Key: {candidate.blocking_key || 'N/A'}</span>
                      <span>•</span>
                      <span>Auto-merge eligible: {candidate.auto_match_eligible ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                )}
              </EACard>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MPIReviewQueue;
