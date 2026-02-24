// ============================================================================
// Smart Shift Handoff Dashboard - AI-Assisted Nurse Handoff
// ============================================================================
// Purpose: One-click nurse review of auto-scored patient risks
// Design: System does 80% (auto-score), nurse does 20% (confirm/adjust)
// Architecture: Thin orchestrator — UI sections in shift-handoff/ submodules
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useUser } from '../../contexts/AuthContext';
import { usePatientContext, SelectedPatient } from '../../contexts/PatientContext';
import { useKeyboardShortcutsContextSafe } from '../envision-atlus/EAKeyboardShortcutsProvider';
import { ShiftHandoffService } from '../../services/shiftHandoffService';
import type { AIShiftSummary } from '../../services/shiftHandoffService';
import HandoffCelebration from './HandoffCelebration';
import HandoffBypassModal, { BypassFormData } from './HandoffBypassModal';
import PersonalizedGreeting from '../shared/PersonalizedGreeting';
import { auditLogger } from '../../services/auditLogger';
import { getProviderAffirmation, AffirmationCategory } from '../../services/providerAffirmations';
import { EAAffirmationToast } from '../envision-atlus/EAAffirmationToast';
import { usePresence } from '../../hooks/usePresence';
import { ActivityFeed, useActivityBroadcast } from '../collaboration';
import { HandoffHeader, HighAcuitySection, StandardAcuitySection, AISummaryPanel } from './shift-handoff';
import type { RiskFilter, PatientCardActions } from './shift-handoff';
import type {
  ShiftHandoffSummary,
  HandoffDashboardMetrics,
  ShiftType,
  RiskLevel,
} from '../../types/shiftHandoff';
import { sortHandoffByPriority } from '../../types/shiftHandoff';

export const ShiftHandoffDashboard: React.FC = () => {
  const user = useUser();
  const { selectPatient } = usePatientContext();
  const keyboardShortcuts = useKeyboardShortcutsContextSafe();

  // Real-time presence
  const { otherUsers } = usePresence({
    roomId: 'dashboard:shift-handoff',
    componentName: 'ShiftHandoffDashboard',
  });
  const { broadcast } = useActivityBroadcast('dashboard:shift-handoff');

  // Core state
  const [shiftType, setShiftType] = useState<ShiftType>('night');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [unitFilter, setUnitFilter] = useState<string>('');
  const [availableUnits, setAvailableUnits] = useState<string[]>([]);
  const [handoffSummary, setHandoffSummary] = useState<ShiftHandoffSummary[]>([]);
  const [metrics, setMetrics] = useState<HandoffDashboardMetrics | null>(null);
  const [aiSummary, setAiSummary] = useState<AIShiftSummary | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());

  // Modal state
  const [showCelebration, setShowCelebration] = useState(false);
  const [showBypassModal, setShowBypassModal] = useState(false);
  const [bypassUsed, setBypassUsed] = useState(false);
  const [bypassNumber, setBypassNumber] = useState(0);
  const [currentBypassCount, setCurrentBypassCount] = useState(0);

  // Time tracking
  const [sessionStartTime] = useState<number>(Date.now());
  const [timeSavings, setTimeSavings] = useState<{
    time_saved_minutes: number;
    efficiency_percent: number;
  } | null>(null);

  // Affirmation toast
  const [affirmationToast, setAffirmationToast] = useState<{
    message: string;
    type: 'success' | 'info' | 'achievement';
  } | null>(null);

  const showAffirmation = (category: AffirmationCategory) => {
    const message = getProviderAffirmation(category);
    setAffirmationToast({ message, type: category === 'milestone_reached' ? 'achievement' : 'success' });
  };

  // Sync filter with keyboard shortcuts
  useEffect(() => {
    if (keyboardShortcuts?.currentFilter) {
      setRiskFilter(keyboardShortcuts.currentFilter);
    }
  }, [keyboardShortcuts?.currentFilter]);

  // Filter patients
  const getFilteredPatients = useCallback((patients: ShiftHandoffSummary[]) => {
    if (riskFilter === 'all') return patients;
    if (riskFilter === 'critical') return patients.filter(p => p.final_risk_level === 'CRITICAL');
    if (riskFilter === 'high') return patients.filter(p => p.final_risk_level === 'CRITICAL' || p.final_risk_level === 'HIGH');
    return patients;
  }, [riskFilter]);

  // Load handoff data
  const loadHandoffData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [summary, dashboardMetrics, bypassCount, units] = await Promise.all([
        ShiftHandoffService.getCurrentShiftHandoff(shiftType),
        ShiftHandoffService.getHandoffDashboardMetrics(shiftType),
        ShiftHandoffService.getNurseBypassCount(),
        ShiftHandoffService.getAvailableUnits(),
      ]);

      setHandoffSummary(sortHandoffByPriority(summary));
      setMetrics(dashboardMetrics);
      setCurrentBypassCount(bypassCount);
      setAvailableUnits(units);
    } catch (err: unknown) {
      auditLogger.error('HANDOFF_LOAD_FAILED', err instanceof Error ? err : new Error('Failed to load handoff data'), { shiftType });
      setError(err instanceof Error ? err.message : 'Failed to load handoff data');
    } finally {
      setLoading(false);
    }
  }, [shiftType]);

  // Load AI summary
  const loadAISummary = useCallback(async () => {
    setAiSummaryLoading(true);
    try {
      const summary = await ShiftHandoffService.getAIShiftSummary(shiftType, unitFilter || undefined);
      setAiSummary(summary);
    } catch {
      setAiSummary(null);
    } finally {
      setAiSummaryLoading(false);
    }
  }, [shiftType, unitFilter]);

  useEffect(() => {
    if (user) {
      loadHandoffData();
      loadAISummary();
      const interval = setInterval(loadHandoffData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadHandoffData/loadAISummary are stable via useCallback
  }, [user, shiftType, unitFilter]);

  // Patient selection → PatientContext
  const handlePatientSelect = useCallback((patient: ShiftHandoffSummary) => {
    const riskLevel = patient.final_risk_level === 'CRITICAL' ? 'critical'
      : patient.final_risk_level === 'HIGH' ? 'high'
      : patient.final_risk_level === 'MEDIUM' ? 'medium'
      : 'low' as const;

    const selected: SelectedPatient = {
      id: patient.patient_id,
      firstName: patient.patient_name.split(' ')[0] || patient.patient_name,
      lastName: patient.patient_name.split(' ').slice(1).join(' ') || '',
      roomNumber: patient.room_number ?? undefined,
      riskLevel,
      snapshot: {
        primaryDiagnosis: patient.clinical_snapshot.diagnosis,
        unit: 'Handoff',
      },
    };
    selectPatient(selected);
  }, [selectPatient]);

  // Confirm auto-score
  const handleConfirm = async (riskScoreId: string, patientId: string) => {
    try {
      await ShiftHandoffService.nurseReviewHandoffRisk({ risk_score_id: riskScoreId, nurse_risk_level: null });
      setHandoffSummary(prev => prev.map(p =>
        p.patient_id === patientId ? { ...p, nurse_reviewed: true, nurse_adjusted: false } : p
      ));
      const updatedMetrics = await ShiftHandoffService.getHandoffDashboardMetrics(shiftType);
      setMetrics(updatedMetrics);
      auditLogger.clinical('HANDOFF_RISK_CONFIRMED', true, { patientId, riskScoreId });
      showAffirmation('patient_assessed');
    } catch (err: unknown) {
      auditLogger.error('HANDOFF_CONFIRM_FAILED', err instanceof Error ? err : new Error('Failed'), { patientId });
      alert('Failed to confirm risk score');
    }
  };

  // Escalate risk
  const handleEscalate = async (riskScoreId: string, patientId: string) => {
    const currentLevel = handoffSummary.find(p => p.patient_id === patientId)?.final_risk_level;
    const newLevel: RiskLevel = currentLevel === 'LOW' ? 'MEDIUM' : currentLevel === 'MEDIUM' ? 'HIGH' : 'CRITICAL';
    const reason = prompt(`Escalating to ${newLevel}. Why? (optional)`);
    try {
      await ShiftHandoffService.nurseReviewHandoffRisk({
        risk_score_id: riskScoreId,
        nurse_risk_level: newLevel,
        nurse_adjustment_reason: reason || undefined,
      });
      loadHandoffData();
    } catch {
      alert('Failed to escalate risk');
    }
  };

  // De-escalate risk
  const handleDeEscalate = async (riskScoreId: string, patientId: string) => {
    const currentLevel = handoffSummary.find(p => p.patient_id === patientId)?.final_risk_level;
    const newLevel: RiskLevel = currentLevel === 'CRITICAL' ? 'HIGH' : currentLevel === 'HIGH' ? 'MEDIUM' : 'LOW';
    const reason = prompt(`De-escalating to ${newLevel}. Why? (optional)`);
    try {
      await ShiftHandoffService.nurseReviewHandoffRisk({
        risk_score_id: riskScoreId,
        nurse_risk_level: newLevel,
        nurse_adjustment_reason: reason || undefined,
      });
      loadHandoffData();
    } catch {
      alert('Failed to de-escalate risk');
    }
  };

  // Bulk confirm
  const handleBulkConfirm = async () => {
    if (selectedPatients.size === 0) { alert('No patients selected'); return; }
    const riskScoreIds = handoffSummary
      .filter(p => selectedPatients.has(p.patient_id))
      .map(p => p.risk_score_id);
    try {
      await ShiftHandoffService.bulkConfirmAutoScores(riskScoreIds);
      setSelectedPatients(new Set());
      loadHandoffData();
      showAffirmation('milestone_reached');
    } catch {
      alert('Failed to bulk confirm');
    }
  };

  // Toggle selection
  const toggleSelection = (patientId: string) => {
    setSelectedPatients(prev => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  };

  // Accept handoff
  const handleAcceptHandoff = async () => {
    if (!metrics || metrics.pending_nurse_review > 0) {
      setShowBypassModal(true);
      return;
    }

    const timeSpentSeconds = Math.round((Date.now() - sessionStartTime) / 1000);
    const patientCount = metrics.total_patients;

    try {
      const savings = await ShiftHandoffService.recordHandoffTimeSavings(timeSpentSeconds, patientCount, true);
      setTimeSavings({ time_saved_minutes: savings.time_saved_minutes, efficiency_percent: savings.efficiency_percent });
    } catch (err: unknown) {
      auditLogger.warn('TIME_TRACKING_FAILED', { error: err });
    }

    setBypassUsed(false);
    setBypassNumber(0);
    setShowCelebration(true);
    showAffirmation('handoff_complete');
    broadcast('update', 'handoff', `Accepted shift handoff for ${patientCount} patients`, undefined,
      `${shiftType.charAt(0).toUpperCase() + shiftType.slice(1)} Shift`);
  };

  // Emergency bypass
  const handleBypass = async (bypassData: BypassFormData) => {
    const pendingPatients = handoffSummary.filter(p => !p.nurse_reviewed);
    const result = await ShiftHandoffService.logEmergencyBypass(
      new Date().toISOString().split('T')[0], shiftType, pendingPatients.length,
      pendingPatients.map(p => p.patient_id),
      pendingPatients.map(p => `${p.room_number ? `Room ${p.room_number}` : 'No Room'} - ${p.patient_name}`),
      bypassData.override_reason, bypassData.override_explanation, bypassData.nurse_signature
    );
    setShowBypassModal(false);
    setBypassUsed(true);
    setBypassNumber(result.bypass_number);
    setShowCelebration(true);
    setCurrentBypassCount(result.weekly_total);
  };

  // Patient card actions
  const cardActions: PatientCardActions = {
    onConfirm: handleConfirm,
    onEscalate: handleEscalate,
    onDeEscalate: handleDeEscalate,
    onSelect: handlePatientSelect,
    onToggleSelection: toggleSelection,
  };

  // Loading state
  if (loading && !handoffSummary.length) {
    return (
      <div className="shift-handoff-dashboard p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded-sm w-1/3 mb-4"></div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (<div key={i} className="h-32 bg-gray-200 rounded-sm"></div>))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="shift-handoff-dashboard p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Failed to load shift handoff</p>
          <p className="text-sm mt-1">{error}</p>
          <button onClick={loadHandoffData} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const filteredPatients = getFilteredPatients(handoffSummary);

  return (
    <div className="shift-handoff-dashboard">
      {affirmationToast && (
        <EAAffirmationToast
          message={affirmationToast.message}
          type={affirmationToast.type}
          onDismiss={() => setAffirmationToast(null)}
          position="bottom-right"
        />
      )}

      <PersonalizedGreeting userName={user?.email || user?.user_metadata?.full_name} userRole="nurse" />

      <HandoffHeader
        shiftType={shiftType}
        riskFilter={riskFilter}
        metrics={metrics}
        selectedCount={selectedPatients.size}
        unitFilter={unitFilter}
        availableUnits={availableUnits}
        otherUsers={otherUsers}
        onShiftChange={setShiftType}
        onRiskFilterChange={setRiskFilter}
        onAcceptHandoff={handleAcceptHandoff}
        onBulkConfirm={handleBulkConfirm}
        onClearSelection={() => setSelectedPatients(new Set())}
        onUnitFilterChange={setUnitFilter}
      />

      <AISummaryPanel summary={aiSummary} loading={aiSummaryLoading} />

      {handoffSummary.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">
          <p>No patients for this shift. Click &quot;Refresh Auto-Scores&quot; to generate scores.</p>
          <button
            onClick={() => ShiftHandoffService.refreshAllAutoScores(shiftType).then(() => loadHandoffData())}
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Refresh Auto-Scores
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <HighAcuitySection patients={filteredPatients} selectedPatients={selectedPatients} actions={cardActions} />
          <StandardAcuitySection patients={filteredPatients} selectedPatients={selectedPatients} actions={cardActions} />
        </div>
      )}

      {showBypassModal && (
        <HandoffBypassModal
          onClose={() => setShowBypassModal(false)}
          onBypass={handleBypass}
          pendingCount={metrics?.pending_nurse_review || 0}
          pendingPatients={handoffSummary
            .filter(p => !p.nurse_reviewed)
            .map(p => ({ patient_id: p.patient_id, patient_name: p.patient_name, room_number: p.room_number }))}
          currentBypassCount={currentBypassCount}
        />
      )}

      {showCelebration && (
        <HandoffCelebration
          onClose={() => setShowCelebration(false)}
          nurseWhoAccepted={user?.email?.split('@')[0] || 'Nurse'}
          bypassUsed={bypassUsed}
          bypassNumber={bypassNumber}
          timeSavedMinutes={timeSavings?.time_saved_minutes}
          efficiencyPercent={timeSavings?.efficiency_percent}
          patientCount={metrics?.total_patients}
        />
      )}

      <ActivityFeed roomId="dashboard:shift-handoff" floating maxEvents={15} />
    </div>
  );
};

export default ShiftHandoffDashboard;
