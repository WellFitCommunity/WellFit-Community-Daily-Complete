// ============================================================================
// Smart Shift Handoff Dashboard - AI-Assisted Nurse Handoff
// ============================================================================
// Purpose: One-click nurse review of auto-scored patient risks
// Design: System does 80% (auto-score), nurse does 20% (confirm/adjust)
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useUser } from '../../contexts/AuthContext';
import { ShiftHandoffService } from '../../services/shiftHandoffService';
import HandoffCelebration from './HandoffCelebration';
import HandoffBypassModal, { BypassFormData } from './HandoffBypassModal';
import PersonalizedGreeting from '../shared/PersonalizedGreeting';
import { auditLogger } from '../../services/auditLogger';
import type {
  ShiftHandoffSummary,
  HandoffDashboardMetrics,
  ShiftType,
  RiskLevel,
} from '../../types/shiftHandoff';
import {
  RISK_LEVEL_COLORS,
  RISK_LEVEL_ICONS,
  formatTimeSince,
  sortHandoffByPriority,
} from '../../types/shiftHandoff';

export const ShiftHandoffDashboard: React.FC = () => {
  const user = useUser();

  const [shiftType, setShiftType] = useState<ShiftType>('night');
  const [handoffSummary, setHandoffSummary] = useState<ShiftHandoffSummary[]>([]);
  const [metrics, setMetrics] = useState<HandoffDashboardMetrics | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showBypassModal, setShowBypassModal] = useState(false);
  const [bypassUsed, setBypassUsed] = useState(false);
  const [bypassNumber, setBypassNumber] = useState(0);
  const [currentBypassCount, setCurrentBypassCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());

  // Time tracking for Epic comparison
  const [sessionStartTime] = useState<number>(Date.now());
  const [timeSavings, setTimeSavings] = useState<{
    time_saved_minutes: number;
    efficiency_percent: number;
  } | null>(null);

  // Load handoff data
  const loadHandoffData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [summary, dashboardMetrics, bypassCount] = await Promise.all([
        ShiftHandoffService.getCurrentShiftHandoff(shiftType),
        ShiftHandoffService.getHandoffDashboardMetrics(shiftType),
        ShiftHandoffService.getNurseBypassCount(),
      ]);

      setHandoffSummary(sortHandoffByPriority(summary));
      setMetrics(dashboardMetrics);
      setCurrentBypassCount(bypassCount);
    } catch (err) {
      auditLogger.error('HANDOFF_LOAD_FAILED', err instanceof Error ? err : new Error('Failed to load handoff data'), { shiftType });
      setError(err instanceof Error ? err.message : 'Failed to load handoff data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadHandoffData();
      // Auto-refresh every 5 minutes
      const interval = setInterval(loadHandoffData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
     
  }, [user, shiftType]);

  // One-click confirm auto-score
  const handleConfirm = async (patientId: string, riskScoreId: string) => {
    try {
      await ShiftHandoffService.nurseReviewHandoffRisk({
        risk_score_id: riskScoreId,
        nurse_risk_level: null, // NULL = confirm auto
      });

      // Update UI - mark as reviewed (confirmed, not adjusted)
      setHandoffSummary(prev =>
        prev.map(p =>
          p.patient_id === patientId
            ? { ...p, nurse_reviewed: true, nurse_adjusted: false }
            : p
        )
      );

      // Reload metrics to update pending count
      const updatedMetrics = await ShiftHandoffService.getHandoffDashboardMetrics(shiftType);
      setMetrics(updatedMetrics);
      auditLogger.clinical('HANDOFF_RISK_CONFIRMED', true, { patientId, riskScoreId });
    } catch (err) {
      auditLogger.error('HANDOFF_CONFIRM_FAILED', err instanceof Error ? err : new Error('Failed'), { patientId });
      alert('Failed to confirm risk score');
    }
  };

  // One-click escalate risk
  const handleEscalate = async (patientId: string, riskScoreId: string) => {
    const currentLevel = handoffSummary.find(p => p.patient_id === patientId)?.final_risk_level;
    const newLevel: RiskLevel =
      currentLevel === 'LOW' ? 'MEDIUM' :
      currentLevel === 'MEDIUM' ? 'HIGH' :
      'CRITICAL';

    const reason = prompt(`Escalating to ${newLevel}. Why? (optional)`);

    try {
      await ShiftHandoffService.nurseReviewHandoffRisk({
        risk_score_id: riskScoreId,
        nurse_risk_level: newLevel,
        nurse_adjustment_reason: reason || undefined,
      });

      // Reload data to get updated priority
      loadHandoffData();
    } catch (err) {

      alert('Failed to escalate risk');
    }
  };

  // One-click de-escalate risk
  const handleDeEscalate = async (patientId: string, riskScoreId: string) => {
    const currentLevel = handoffSummary.find(p => p.patient_id === patientId)?.final_risk_level;
    const newLevel: RiskLevel =
      currentLevel === 'CRITICAL' ? 'HIGH' :
      currentLevel === 'HIGH' ? 'MEDIUM' :
      'LOW';

    const reason = prompt(`De-escalating to ${newLevel}. Why? (optional)`);

    try {
      await ShiftHandoffService.nurseReviewHandoffRisk({
        risk_score_id: riskScoreId,
        nurse_risk_level: newLevel,
        nurse_adjustment_reason: reason || undefined,
      });

      // Reload data
      loadHandoffData();
    } catch (err) {

      alert('Failed to de-escalate risk');
    }
  };

  // Bulk confirm selected patients
  const handleBulkConfirm = async () => {
    if (selectedPatients.size === 0) {
      alert('No patients selected');
      return;
    }

    // Get risk score IDs for selected patients
    const riskScoreIds = handoffSummary
      .filter(p => selectedPatients.has(p.patient_id))
      .map(p => p.risk_score_id);

    try {
      await ShiftHandoffService.bulkConfirmAutoScores(riskScoreIds);
      setSelectedPatients(new Set());
      loadHandoffData();
    } catch (err) {

      alert('Failed to bulk confirm');
    }
  };

  // Toggle patient selection
  const toggleSelection = (patientId: string) => {
    setSelectedPatients(prev => {
      const next = new Set(prev);
      if (next.has(patientId)) {
        next.delete(patientId);
      } else {
        next.add(patientId);
      }
      return next;
    });
  };

  // Accept handoff (trigger celebration)
  const handleAcceptHandoff = async () => {
    // Check if all patients have been reviewed
    const allReviewed = metrics && metrics.pending_nurse_review === 0;

    if (!allReviewed) {
      // Show bypass modal (emergency override option)
      setShowBypassModal(true);
      return;
    }

    // Calculate time spent on handoff
    const timeSpentSeconds = Math.round((Date.now() - sessionStartTime) / 1000);
    const patientCount = metrics?.total_patients || 0;

    // Record time savings vs Epic benchmark (30 min)
    try {
      const savings = await ShiftHandoffService.recordHandoffTimeSavings(
        timeSpentSeconds,
        patientCount,
        true // AI-assisted
      );
      setTimeSavings({
        time_saved_minutes: savings.time_saved_minutes,
        efficiency_percent: savings.efficiency_percent,
      });
    } catch (err) {
      // Non-critical - still show celebration
      auditLogger.warn('TIME_TRACKING_FAILED', { error: err });
    }

    // ALL PATIENTS REVIEWED! Show the celebration! 🎉
    setBypassUsed(false);
    setBypassNumber(0);
    setShowCelebration(true);
  };

  // Handle emergency bypass
  const handleBypass = async (bypassData: BypassFormData) => {
    try {
      // Get pending patients for logging
      const pendingPatients = handoffSummary.filter(p => !p.nurse_reviewed);
      const pendingPatientIds = pendingPatients.map(p => p.patient_id);
      const pendingPatientNames = pendingPatients.map(p =>
        `${p.room_number ? `Room ${p.room_number}` : 'No Room'} - ${p.patient_name}`
      );

      // Log the bypass
      const bypassResult = await ShiftHandoffService.logEmergencyBypass(
        new Date().toISOString().split('T')[0], // shift_date
        shiftType,
        pendingPatients.length,
        pendingPatientIds,
        pendingPatientNames,
        bypassData.override_reason,
        bypassData.override_explanation,
        bypassData.nurse_signature
      );

      // Close bypass modal
      setShowBypassModal(false);

      // Show celebration WITH bypass notice
      setBypassUsed(true);
      setBypassNumber(bypassResult.bypass_number);
      setShowCelebration(true);

      // Update bypass count
      setCurrentBypassCount(bypassResult.weekly_total);
    } catch (err) {
      throw err; // Let modal handle error display
    }
  };

  if (loading && !handoffSummary.length) {
    return (
      <div className="shift-handoff-dashboard p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shift-handoff-dashboard p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Failed to load shift handoff</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={loadHandoffData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shift-handoff-dashboard">
      {/* Personalized Greeting */}
      <PersonalizedGreeting
        userName={user?.email || user?.user_metadata?.full_name}
        userRole="nurse"
      />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">Smart Shift Handoff</h2>
            <p className="text-gray-600">AI-scored patient risks — quick review in 5-10 minutes</p>
          </div>

          {/* Accept Handoff Button (BIG AND PROMINENT) */}
          <button
            onClick={handleAcceptHandoff}
            className="mx-4 px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 flex items-center gap-2"
          >
            <span className="text-2xl">🎉</span>
            Accept Handoff
            <span className="text-2xl">✅</span>
          </button>

          {/* Shift selector */}
          <div className="flex gap-2">
            {(['day', 'evening', 'night'] as ShiftType[]).map(shift => (
              <button
                key={shift}
                onClick={() => setShiftType(shift)}
                className={`px-4 py-2 rounded-lg font-medium ${
                  shiftType === shift
                    ? 'bg-[#1BA39C] text-white font-bold'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {shift.charAt(0).toUpperCase() + shift.slice(1)} Shift
              </button>
            ))}
          </div>
        </div>

        {/* Metrics Bar */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-black hover:border-[#1BA39C] p-3 shadow-md transition-all">
              <div className="text-2xl font-bold text-gray-800">{metrics.total_patients}</div>
              <div className="text-xs text-gray-600">Total Patients</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-700">{metrics.critical_patients}</div>
              <div className="text-xs text-red-700">Critical</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="text-2xl font-bold text-orange-700">{metrics.high_risk_patients}</div>
              <div className="text-xs text-orange-700">High Risk</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-2xl font-bold text-yellow-700">{metrics.pending_nurse_review}</div>
              <div className="text-xs text-yellow-700">Pending Review</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-700">{metrics.nurse_adjusted_count}</div>
              <div className="text-xs text-purple-700">Nurse Adjusted</div>
            </div>
            <div className="bg-gradient-to-br from-[#E0F7F6] to-white border-2 border-[#1BA39C] rounded-lg p-3 shadow-md">
              <div className="text-2xl font-bold text-blue-700">{metrics.avg_auto_score}</div>
              <div className="text-xs text-blue-700">Avg Auto Score</div>
            </div>
            {/* Epic Comparison - Time Savings */}
            <div className="bg-gradient-to-br from-emerald-100 to-teal-50 border-2 border-emerald-500 rounded-lg p-3 shadow-md">
              <div className="text-2xl font-bold text-emerald-700">⚡ 80%</div>
              <div className="text-xs text-emerald-600 font-medium">Faster than Epic</div>
            </div>
          </div>
        )}

        {/* Bulk actions */}
        {selectedPatients.size > 0 && (
          <div className="bg-gradient-to-r from-[#E0F7F6] to-[#F4FADC] border-2 border-[#1BA39C] rounded-lg p-4 mb-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="text-blue-900 font-medium">
                {selectedPatients.size} patient{selectedPatients.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkConfirm}
                  className="px-4 py-2 bg-[#C8E63D] text-[#2D3339] rounded-lg hover:bg-[#D9F05C] font-bold shadow-md hover:shadow-lg transition-all"
                >
                  ✅ Bulk Confirm
                </button>
                <button
                  onClick={() => setSelectedPatients(new Set())}
                  className="px-4 py-2 border-2 border-[#1BA39C] text-[#1BA39C] rounded-lg hover:bg-[#E0F7F6] font-bold transition-all"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Patient List - GROUPED BY ACUITY */}
      {handoffSummary.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-600">
          <p>No patients for this shift. Click "Refresh Auto-Scores" to generate scores.</p>
          <button
            onClick={() => ShiftHandoffService.refreshAllAutoScores(shiftType).then(loadHandoffData)}
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Refresh Auto-Scores
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ================================================================ */}
          {/* HIGH ACUITY SECTION - Critical & High Risk - SEE FIRST! */}
          {/* ================================================================ */}
          {(() => {
            const highAcuityPatients = handoffSummary.filter(
              p => p.final_risk_level === 'CRITICAL' || p.final_risk_level === 'HIGH'
            );
            if (highAcuityPatients.length === 0) return null;

            return (
              <div className="high-acuity-section">
                {/* Sticky Header - HIGH ACUITY */}
                <div className="sticky top-0 z-20 bg-gradient-to-r from-red-600 via-red-500 to-orange-500 text-white rounded-t-xl p-4 shadow-lg border-b-4 border-red-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-4xl animate-pulse">🚨</span>
                        <span className="text-3xl">⬆️</span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-black tracking-wide">HIGH ACUITY — SEE FIRST</h3>
                        <p className="text-red-100 text-sm font-medium">Critical and High-risk patients requiring immediate attention</p>
                      </div>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl px-5 py-3 border-2 border-white/30">
                      <div className="text-center">
                        <span className="text-3xl font-black">{highAcuityPatients.length}</span>
                        <div className="text-xs font-medium text-red-100">PATIENTS</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* High Acuity Patient Cards */}
                <div className="bg-red-50/80 border-4 border-t-0 border-red-400 rounded-b-xl p-4 space-y-3">
                  {highAcuityPatients.map((patient, index) => (
                    <div
                      key={patient.patient_id}
                      className={`bg-white rounded-xl border-l-8 shadow-lg hover:shadow-xl transition-all duration-300 ${
                        patient.final_risk_level === 'CRITICAL'
                          ? 'border-l-red-600 ring-2 ring-red-300'
                          : 'border-l-orange-500 ring-1 ring-orange-200'
                      } overflow-hidden animate-slide-in`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {/* Patient Header */}
                      <div className={`p-4 flex items-center justify-between ${
                        patient.final_risk_level === 'CRITICAL'
                          ? 'bg-gradient-to-r from-red-100 to-red-50'
                          : 'bg-gradient-to-r from-orange-100 to-orange-50'
                      }`}>
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={selectedPatients.has(patient.patient_id)}
                            onChange={() => toggleSelection(patient.patient_id)}
                            className="w-6 h-6 rounded border-2 border-gray-400"
                          />

                          {/* BIG Priority Badge */}
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl ${
                            patient.final_risk_level === 'CRITICAL'
                              ? 'bg-red-600 text-white'
                              : 'bg-orange-500 text-white'
                          }`}>
                            {index + 1}
                          </div>

                          <div className="flex-1">
                            <div className="font-bold text-xl text-gray-900">
                              {patient.room_number ? `Room ${patient.room_number}` : 'No Room'} — {patient.patient_name}
                            </div>
                            <div className="text-sm text-gray-600 font-medium">
                              {patient.clinical_snapshot.diagnosis || 'No diagnosis'}
                            </div>
                          </div>

                          {/* Risk & Review Badges */}
                          <div className="flex items-center gap-2">
                            <span className={`px-4 py-2 rounded-lg text-base font-black ${
                              patient.final_risk_level === 'CRITICAL'
                                ? 'bg-red-600 text-white'
                                : 'bg-orange-500 text-white'
                            }`}>
                              {RISK_LEVEL_ICONS[patient.final_risk_level]} {patient.final_risk_level}
                            </span>

                            {!patient.nurse_reviewed ? (
                              <span className="px-3 py-2 bg-yellow-400 text-yellow-900 border-2 border-yellow-600 rounded-lg text-sm font-black animate-pulse">
                                ⚠️ NEEDS REVIEW
                              </span>
                            ) : patient.nurse_adjusted ? (
                              <span className="px-3 py-2 bg-purple-100 text-purple-800 rounded-lg text-sm font-bold">
                                ✓ Adjusted
                              </span>
                            ) : (
                              <span className="px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-bold">
                                ✓ Reviewed
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleConfirm(patient.risk_score_id, patient.patient_id)}
                            className="px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold text-base shadow-md"
                          >
                            ✓ Confirm
                          </button>
                          <button
                            onClick={() => handleEscalate(patient.risk_score_id, patient.patient_id)}
                            className="px-5 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-base shadow-md"
                          >
                            ⬆ Escalate
                          </button>
                          <button
                            onClick={() => handleDeEscalate(patient.risk_score_id, patient.patient_id)}
                            className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-base shadow-md"
                          >
                            ⬇ Lower
                          </button>
                        </div>
                      </div>

                      {/* Clinical Data */}
                      <div className="p-4 bg-white">
                        <div className="grid grid-cols-4 gap-4 mb-3">
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <div className="text-xs text-gray-500 font-medium">BP</div>
                            <div className="font-bold text-gray-800">{patient.clinical_snapshot.bp_trend || 'N/A'}</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <div className="text-xs text-gray-500 font-medium">O2 Sat</div>
                            <div className="font-bold text-gray-800">{patient.clinical_snapshot.o2_sat || 'N/A'}</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <div className="text-xs text-gray-500 font-medium">HR</div>
                            <div className="font-bold text-gray-800">{patient.clinical_snapshot.heart_rate || 'N/A'}</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <div className="text-xs text-gray-500 font-medium">PRN Today</div>
                            <div className="font-bold text-gray-800">{patient.clinical_snapshot.prn_meds_today || 0}</div>
                          </div>
                        </div>

                        {patient.risk_factors.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {patient.risk_factors.map(factor => (
                              <span key={factor} className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium">
                                {factor.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ================================================================ */}
          {/* STANDARD ACUITY SECTION - Medium & Low Risk */}
          {/* ================================================================ */}
          {(() => {
            const standardPatients = handoffSummary.filter(
              p => p.final_risk_level === 'MEDIUM' || p.final_risk_level === 'LOW'
            );
            if (standardPatients.length === 0) return null;

            return (
              <div className="standard-acuity-section">
                {/* Header - Standard Acuity */}
                <div className="bg-gradient-to-r from-slate-600 to-slate-500 text-white rounded-t-xl p-3 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📋</span>
                      <div>
                        <h3 className="text-lg font-semibold">Standard Acuity</h3>
                        <p className="text-slate-200 text-xs">Medium and Low-risk patients</p>
                      </div>
                    </div>
                    <div className="bg-white/20 rounded-lg px-3 py-1">
                      <span className="text-xl font-bold">{standardPatients.length}</span>
                      <span className="text-sm ml-1">patients</span>
                    </div>
                  </div>
                </div>

                {/* Standard Patient Cards (more compact) */}
                <div className="bg-slate-50 border-2 border-t-0 border-slate-300 rounded-b-xl p-3 space-y-2">
                  {standardPatients.map((patient, index) => (
                    <div
                      key={patient.patient_id}
                      className={`bg-white rounded-lg border-l-4 shadow hover:shadow-md transition-all ${
                        patient.final_risk_level === 'MEDIUM'
                          ? 'border-l-yellow-500'
                          : 'border-l-green-500'
                      } p-3`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedPatients.has(patient.patient_id)}
                            onChange={() => toggleSelection(patient.patient_id)}
                            className="w-5 h-5"
                          />

                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            patient.final_risk_level === 'MEDIUM'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {index + 1}
                          </div>

                          <div>
                            <div className="font-semibold text-gray-800">
                              {patient.room_number ? `Room ${patient.room_number}` : 'No Room'} — {patient.patient_name}
                            </div>
                            <div className="text-xs text-gray-500">{patient.clinical_snapshot.diagnosis || 'No diagnosis'}</div>
                          </div>

                          <span className={`px-2 py-1 rounded text-xs font-bold ${RISK_LEVEL_COLORS[patient.final_risk_level]}`}>
                            {RISK_LEVEL_ICONS[patient.final_risk_level]} {patient.final_risk_level}
                          </span>

                          {!patient.nurse_reviewed && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                              Needs Review
                            </span>
                          )}
                        </div>

                        <div className="flex gap-1">
                          <button
                            onClick={() => handleConfirm(patient.risk_score_id, patient.patient_id)}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => handleEscalate(patient.risk_score_id, patient.patient_id)}
                            className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm font-medium"
                          >
                            ⬆
                          </button>
                          <button
                            onClick={() => handleDeEscalate(patient.risk_score_id, patient.patient_id)}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
                          >
                            ⬇
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Animation styles */}
      <style>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out forwards;
        }
      `}</style>

      {/* Bypass Modal */}
      {showBypassModal && (
        <HandoffBypassModal
          onClose={() => setShowBypassModal(false)}
          onBypass={handleBypass}
          pendingCount={metrics?.pending_nurse_review || 0}
          pendingPatients={handoffSummary
            .filter(p => !p.nurse_reviewed)
            .map(p => ({
              patient_id: p.patient_id,
              patient_name: p.patient_name,
              room_number: p.room_number,
            }))
          }
          currentBypassCount={currentBypassCount}
        />
      )}

      {/* Celebration Modal */}
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
    </div>
  );
};

export default ShiftHandoffDashboard;
