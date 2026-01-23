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
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  AlertTriangle,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  GitMerge,
  Unlink,
  Link2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Eye,
  Shield,
  BarChart3,
  Filter,
  ArrowUpRight,
} from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EAAlert,
} from '../envision-atlus';
import { mpiMatchingService, type MPIMatchCandidate, type MPIPriority } from '../../services/mpiMatchingService';
import { auditLogger } from '../../services/auditLogger';
import { supabase } from '../../lib/supabaseClient';

// =============================================================================
// TYPES
// =============================================================================

interface PatientInfo {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  phone: string | null;
  mrn: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  gender: string | null;
  email: string | null;
}

interface CandidateWithPatients extends MPIMatchCandidate {
  patientA?: PatientInfo;
  patientB?: PatientInfo;
}

type FilterStatus = 'all' | 'pending' | 'under_review' | 'confirmed_match' | 'confirmed_not_match';
type SortField = 'score' | 'priority' | 'date';

// =============================================================================
// CONSTANTS
// =============================================================================

const PRIORITY_CONFIG: Record<MPIPriority, { label: string; color: string; icon: typeof AlertTriangle }> = {
  urgent: { label: 'Urgent', color: 'text-red-600 bg-red-50 border-red-200', icon: AlertTriangle },
  high: { label: 'High', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: AlertTriangle },
  normal: { label: 'Normal', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Clock },
  low: { label: 'Low', color: 'text-gray-600 bg-gray-50 border-gray-200', icon: Clock },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800' },
  under_review: { label: 'Under Review', color: 'bg-blue-100 text-blue-800' },
  confirmed_match: { label: 'Confirmed Match', color: 'bg-green-100 text-green-800' },
  confirmed_not_match: { label: 'Not a Match', color: 'bg-gray-100 text-gray-800' },
  merged: { label: 'Merged', color: 'bg-purple-100 text-purple-800' },
  deferred: { label: 'Deferred', color: 'bg-orange-100 text-orange-800' },
};

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface ScoreBarProps {
  score: number;
  label?: string;
  showPercentage?: boolean;
}

const ScoreBar: React.FC<ScoreBarProps> = ({ score, label, showPercentage = true }) => {
  const getScoreColor = (s: number) => {
    if (s >= 95) return 'bg-red-500';
    if (s >= 85) return 'bg-orange-500';
    if (s >= 75) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className="w-full">
      {label && <div className="text-xs text-gray-500 mb-1">{label}</div>}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${getScoreColor(score)} transition-all duration-300`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
        {showPercentage && (
          <span className="text-sm font-medium text-gray-700 w-12 text-right">
            {score.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
};

interface PatientComparisonCardProps {
  patientA: PatientInfo | undefined;
  patientB: PatientInfo | undefined;
  fieldScores: Record<string, number>;
}

const PatientComparisonCard: React.FC<PatientComparisonCardProps> = ({
  patientA,
  patientB,
  fieldScores,
}) => {
  const fields = [
    { key: 'first_name', label: 'First Name', aValue: patientA?.first_name, bValue: patientB?.first_name },
    { key: 'last_name', label: 'Last Name', aValue: patientA?.last_name, bValue: patientB?.last_name },
    { key: 'date_of_birth', label: 'Date of Birth', aValue: patientA?.dob, bValue: patientB?.dob },
    { key: 'phone', label: 'Phone', aValue: patientA?.phone, bValue: patientB?.phone },
    { key: 'mrn', label: 'MRN', aValue: patientA?.mrn, bValue: patientB?.mrn },
    { key: 'address', label: 'Address', aValue: patientA?.address, bValue: patientB?.address },
    { key: 'gender', label: 'Gender', aValue: patientA?.gender, bValue: patientB?.gender },
  ];

  const getMatchIndicator = (fieldKey: string, aVal: string | null | undefined, bVal: string | null | undefined) => {
    const score = fieldScores[fieldKey];
    if (score !== undefined) {
      if (score >= 95) return <CheckCircle className="w-4 h-4 text-green-500" />;
      if (score >= 80) return <div className="w-4 h-4 rounded-full bg-yellow-400" />;
      return <XCircle className="w-4 h-4 text-red-400" />;
    }
    if (aVal && bVal && aVal.toLowerCase() === bVal.toLowerCase()) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    return <div className="w-4 h-4" />;
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr,auto,1fr] bg-gray-50 border-b">
        <div className="p-3 font-medium text-gray-700 text-center">Patient A</div>
        <div className="p-3 font-medium text-gray-500 text-center border-x bg-white">Match</div>
        <div className="p-3 font-medium text-gray-700 text-center">Patient B</div>
      </div>
      {fields.map((field) => (
        <div key={field.key} className="grid grid-cols-[1fr,auto,1fr] border-b last:border-b-0">
          <div className="p-3 text-sm">
            <div className="text-xs text-gray-500">{field.label}</div>
            <div className="font-medium text-gray-800">{field.aValue || '—'}</div>
          </div>
          <div className="p-3 flex items-center justify-center border-x bg-gray-50 w-16">
            {getMatchIndicator(field.key, field.aValue, field.bValue)}
          </div>
          <div className="p-3 text-sm">
            <div className="text-xs text-gray-500">{field.label}</div>
            <div className="font-medium text-gray-800">{field.bValue || '—'}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

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
      // Get candidates
      const result = await mpiMatchingService.getPendingCandidates(tenantId, {
        limit: 100,
        priority: filterPriority !== 'all' ? filterPriority : undefined,
      });

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      // Fetch patient info for each candidate
      const candidatesWithPatients: CandidateWithPatients[] = [];

      for (const candidate of result.data) {
        const [patientAResult, patientBResult] = await Promise.all([
          supabase.from('profiles').select('*').eq('user_id', candidate.patient_id_a).single(),
          supabase.from('profiles').select('*').eq('user_id', candidate.patient_id_b).single(),
        ]);

        candidatesWithPatients.push({
          ...candidate,
          patientA: patientAResult.data as PatientInfo | undefined,
          patientB: patientBResult.data as PatientInfo | undefined,
        });
      }

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

  // Handle review decision
  const handleReview = async (
    candidateId: string,
    decision: 'confirmed_match' | 'confirmed_not_match' | 'deferred',
    notes?: string
  ) => {
    setActionLoading(candidateId);

    try {
      // Get current user
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

      // Refresh list
      await fetchCandidates();

      // If confirmed match, navigate to merge wizard
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
            <Users className="w-7 h-7 text-blue-600" />
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
        <EACard className="bg-gradient-to-br from-blue-50 to-blue-100">
          <EACardContent className="p-4">
            <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
            <div className="text-sm text-blue-600">Total Candidates</div>
          </EACardContent>
        </EACard>

        <EACard className="bg-gradient-to-br from-yellow-50 to-yellow-100">
          <EACardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
            <div className="text-sm text-yellow-600">Pending Review</div>
          </EACardContent>
        </EACard>

        <EACard className="bg-gradient-to-br from-orange-50 to-orange-100">
          <EACardContent className="p-4">
            <div className="text-2xl font-bold text-orange-700">{stats.highPriority}</div>
            <div className="text-sm text-orange-600">High Priority</div>
          </EACardContent>
        </EACard>

        <EACard className="bg-gradient-to-br from-red-50 to-red-100">
          <EACardContent className="p-4">
            <div className="text-2xl font-bold text-red-700">{stats.urgentPriority}</div>
            <div className="text-sm text-red-600">Urgent</div>
          </EACardContent>
        </EACard>

        <EACard className="bg-gradient-to-br from-purple-50 to-purple-100">
          <EACardContent className="p-4">
            <div className="text-2xl font-bold text-purple-700">{stats.merged}</div>
            <div className="text-sm text-purple-600">Merged</div>
          </EACardContent>
        </EACard>

        <EACard className="bg-gradient-to-br from-gray-50 to-gray-100">
          <EACardContent className="p-4">
            <div className="text-2xl font-bold text-gray-700">{stats.confirmedNotMatch}</div>
            <div className="text-sm text-gray-600">Not Matches</div>
          </EACardContent>
        </EACard>

        <EACard className="bg-gradient-to-br from-green-50 to-green-100">
          <EACardContent className="p-4">
            <div className="text-2xl font-bold text-green-700">{stats.underReview}</div>
            <div className="text-sm text-green-600">Under Review</div>
          </EACardContent>
        </EACard>
      </div>

      {/* Filters */}
      <EACard>
        <EACardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by patient name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="confirmed_match">Confirmed Match</option>
                <option value="confirmed_not_match">Not a Match</option>
              </select>
            </div>

            {/* Priority Filter */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as MPIPriority | 'all')}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>

            {/* Sort */}
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
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
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
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
                  onClick={() => setExpandedId(isExpanded ? null : candidate.id)}
                >
                  <div className="flex items-center gap-4">
                    {/* Priority Badge */}
                    <div className={`px-2 py-1 rounded-full border text-xs font-medium ${priorityConfig.color}`}>
                      {priorityConfig.label}
                    </div>

                    {/* Patient Names */}
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

                    {/* Match Score */}
                    <div className="w-32">
                      <ScoreBar score={candidate.overall_match_score} label="Match Score" />
                    </div>

                    {/* Status Badge */}
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                      {statusConfig.label}
                    </div>

                    {/* Expand Icon */}
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
                    {/* Field Scores */}
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

                    {/* Patient Comparison */}
                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="font-medium text-gray-900 mb-3">Patient Comparison</h4>
                      <PatientComparisonCard
                        patientA={candidate.patientA}
                        patientB={candidate.patientB}
                        fieldScores={candidate.field_scores}
                      />
                    </div>

                    {/* Actions */}
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

                    {/* Additional Info */}
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
