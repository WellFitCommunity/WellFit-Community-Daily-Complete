/**
 * BehavioralAnomalyPanel - Guardian behavioral-anomaly investigation queue (GA-4)
 *
 * Purpose: Surface uninvestigated behavioral anomalies (impossible travel, peer
 *   deviation, excessive PHI access) that Guardian's layer-1 detection writes to
 *   `anomaly_detections`, so a super-admin can triage and resolve them.
 * Used by: Envision super-admin Guardian monitoring ONLY (route `/guardian/anomalies`,
 *   superAdmin auth). This is internal monitoring — community/WellFit clients NEVER see
 *   this queue; they only get a high-level "healthy" indicator in their security dashboard.
 *
 * Data: behavioralAnalyticsService.getUninvestigatedAnomalies() (RPC, SECURITY DEFINER,
 *   admin-only) → resolve via markAnomalyInvestigated() (live RPC).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  behavioralAnalyticsService,
  type UninvestigatedAnomaly,
  type RiskLevel,
} from '../../services/behavioralAnalyticsService';
import { useUser } from '../../contexts/AuthContext';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EABadge } from '../envision-atlus/EABadge';
import { EAButton } from '../envision-atlus/EAButton';

// ============================================================================
// Constants
// ============================================================================

/** Terminal investigation outcomes accepted by anomaly_detections.investigation_outcome
 *  (UNDER_INVESTIGATION is a non-terminal state and is intentionally excluded from
 *  the resolve dropdown — marking investigated means the investigation concluded). */
const RESOLVE_OUTCOMES = [
  { value: 'FALSE_POSITIVE', label: 'False positive' },
  { value: 'LEGITIMATE_UNUSUAL', label: 'Legitimate but unusual' },
  { value: 'POLICY_VIOLATION', label: 'Policy violation' },
  { value: 'CONFIRMED_THREAT', label: 'Confirmed threat' },
] as const;

const MIN_SCORE = 0.5;
const FETCH_LIMIT = 100;

const RISK_BADGE: Record<RiskLevel, 'critical' | 'high' | 'elevated' | 'normal'> = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'elevated',
  LOW: 'normal',
};

// ============================================================================
// Helpers
// ============================================================================

function riskVariant(risk: string): 'critical' | 'high' | 'elevated' | 'normal' | 'neutral' {
  return RISK_BADGE[(risk?.toUpperCase() as RiskLevel)] ?? 'neutral';
}

function formatAge(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

// ============================================================================
// Resolve form (inline per row)
// ============================================================================

interface ResolveFormProps {
  anomaly: UninvestigatedAnomaly;
  submitting: boolean;
  error: string | null;
  onSubmit: (outcome: string, notes: string) => void;
  onCancel: () => void;
}

const ResolveForm: React.FC<ResolveFormProps> = ({ anomaly, submitting, error, onSubmit, onCancel }) => {
  const [outcome, setOutcome] = useState<string>(RESOLVE_OUTCOMES[0].value);
  const [notes, setNotes] = useState('');
  const outcomeId = `anomaly-outcome-${anomaly.id}`;
  const notesId = `anomaly-notes-${anomaly.id}`;

  return (
    <div className="mt-3 border-t border-slate-700 pt-3 space-y-3" data-testid="resolve-form">
      <div>
        <label htmlFor={outcomeId} className="block text-sm text-slate-300 mb-1">
          Investigation outcome
        </label>
        <select
          id={outcomeId}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          disabled={submitting}
          className="w-full min-h-[44px] bg-slate-900 border border-slate-600 rounded-md px-3 text-white focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
        >
          {RESOLVE_OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={notesId} className="block text-sm text-slate-300 mb-1">
          Notes <span className="text-slate-500">(optional)</span>
        </label>
        <textarea
          id={notesId}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={submitting}
          rows={2}
          className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
          placeholder="What did you find?"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <EAButton
          variant="primary"
          size="sm"
          loading={submitting}
          onClick={() => onSubmit(outcome, notes.trim())}
        >
          Confirm investigated
        </EAButton>
        <EAButton variant="ghost" size="sm" disabled={submitting} onClick={onCancel}>
          Cancel
        </EAButton>
      </div>
    </div>
  );
};

// ============================================================================
// Anomaly row
// ============================================================================

interface AnomalyRowProps {
  anomaly: UninvestigatedAnomaly;
  isResolving: boolean;
  submitting: boolean;
  error: string | null;
  onOpenResolve: () => void;
  onCancelResolve: () => void;
  onSubmitResolve: (outcome: string, notes: string) => void;
}

const AnomalyRow: React.FC<AnomalyRowProps> = ({
  anomaly,
  isResolving,
  submitting,
  error,
  onOpenResolve,
  onCancelResolve,
  onSubmitResolve,
}) => (
  <div className="bg-slate-800 rounded-lg p-4 border-l-4 border-slate-600">
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <EABadge variant={riskVariant(anomaly.risk_level)} pulse={anomaly.risk_level?.toUpperCase() === 'CRITICAL'}>
            {anomaly.risk_level}
          </EABadge>
          <span className="text-sm text-slate-400">
            score {anomaly.aggregate_score.toFixed(2)}
          </span>
          {anomaly.event_type && (
            <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-sm text-slate-200">
              {anomaly.event_type}
            </span>
          )}
        </div>
        <p className="text-white font-medium truncate">{anomaly.user_email}</p>
        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
          <span>role: {anomaly.user_role}</span>
          <span>· detected {formatAge(anomaly.days_since_detection)}</span>
        </div>
      </div>
      {!isResolving && (
        <EAButton variant="secondary" size="sm" onClick={onOpenResolve}>
          Mark investigated
        </EAButton>
      )}
    </div>
    {isResolving && (
      <ResolveForm
        anomaly={anomaly}
        submitting={submitting}
        error={error}
        onSubmit={onSubmitResolve}
        onCancel={onCancelResolve}
      />
    )}
  </div>
);

// ============================================================================
// Main panel
// ============================================================================

export const BehavioralAnomalyPanel: React.FC = () => {
  const user = useUser();
  const [anomalies, setAnomalies] = useState<UninvestigatedAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await behavioralAnalyticsService.getUninvestigatedAnomalies(MIN_SCORE, FETCH_LIMIT);
      setAnomalies(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load anomalies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openResolve = (id: string) => {
    setRowError(null);
    setResolvingId(id);
  };

  const cancelResolve = () => {
    setRowError(null);
    setResolvingId(null);
  };

  const submitResolve = async (anomaly: UninvestigatedAnomaly, outcome: string, notes: string) => {
    if (!user?.id) {
      setRowError('Your session has no user id — re-authenticate to resolve anomalies.');
      return;
    }
    setSubmitting(true);
    setRowError(null);
    try {
      await behavioralAnalyticsService.markAnomalyInvestigated(
        anomaly.id,
        outcome,
        user.id,
        notes || undefined
      );
      setAnomalies((prev) => prev.filter((a) => a.id !== anomaly.id));
      setResolvingId(null);
    } catch (err: unknown) {
      setRowError(err instanceof Error ? err.message : 'Failed to mark investigated');
    } finally {
      setSubmitting(false);
    }
  };

  const criticalCount = anomalies.filter((a) => a.risk_level?.toUpperCase() === 'CRITICAL').length;

  return (
    <div className="p-6 bg-slate-900 min-h-screen text-white" aria-label="Behavioral Anomaly Queue">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-4xl" aria-hidden="true">🛡️</span>
          <div>
            <h1 className="text-2xl font-bold">Behavioral Anomalies</h1>
            <p className="text-slate-400 text-sm">
              Uninvestigated security anomalies (score ≥ {MIN_SCORE}) — Guardian monitoring
            </p>
          </div>
        </div>
        <EAButton variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
          Refresh
        </EAButton>
      </div>

      <EACard>
        <EACardHeader icon={<span aria-hidden="true">🔍</span>}>
          Investigation queue ({anomalies.length}
          {criticalCount > 0 ? `, ${criticalCount} critical` : ''})
        </EACardHeader>
        <EACardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12" role="status" aria-label="Loading anomalies">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--ea-primary,#00857a)]" />
            </div>
          ) : error ? (
            <div role="alert" className="text-center py-10">
              <p className="text-red-400 mb-3">{error}</p>
              <EAButton variant="secondary" size="sm" onClick={() => void load()}>
                Try again
              </EAButton>
            </div>
          ) : anomalies.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-2" aria-hidden="true">✨</div>
              <p>No uninvestigated anomalies — behavior looks healthy.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {anomalies.map((anomaly) => (
                <AnomalyRow
                  key={anomaly.id}
                  anomaly={anomaly}
                  isResolving={resolvingId === anomaly.id}
                  submitting={submitting}
                  error={resolvingId === anomaly.id ? rowError : null}
                  onOpenResolve={() => openResolve(anomaly.id)}
                  onCancelResolve={cancelResolve}
                  onSubmitResolve={(outcome, notes) => void submitResolve(anomaly, outcome, notes)}
                />
              ))}
            </div>
          )}
        </EACardContent>
      </EACard>
    </div>
  );
};

export default BehavioralAnomalyPanel;
