// ============================================================================
// Discharged Patient Dashboard - Care Team View
// ============================================================================
// Purpose: Monitor all discharged patients' wellness check-ins and readmission risk
// Methodist Demo: This is the dashboard they'll love
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { DischargeToWellnessBridgeService } from '../../services/dischargeToWellnessBridge';
import type {
  CareTeamDashboardMetrics,
  DischargedPatientSummary,
} from '../../types/dischargeToWellness';

interface DischargedPatientDashboardProps {
  autoRefresh?: boolean;
  refreshIntervalSeconds?: number;
}

export const DischargedPatientDashboard: React.FC<DischargedPatientDashboardProps> = ({
  autoRefresh = true,
  refreshIntervalSeconds = 300, // 5 minutes
}) => {
  const [metrics, setMetrics] = useState<CareTeamDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterNeedsAttention, setFilterNeedsAttention] = useState(false);
  const [filterHighRisk, setFilterHighRisk] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<DischargedPatientSummary | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const result = await DischargeToWellnessBridgeService.getCareTeamDashboard({
        needs_attention_only: filterNeedsAttention,
        high_risk_only: filterHighRisk,
        days_since_discharge: 90,
      });

      if (result.success && result.data) {
        setMetrics(result.data);
      } else {
        setError(result.error || 'Failed to load dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [filterNeedsAttention, filterHighRisk]);

  useEffect(() => {
    loadDashboard();

    if (autoRefresh) {
      const interval = setInterval(loadDashboard, refreshIntervalSeconds * 1000);
      return () => clearInterval(interval);
    }
  }, [filterNeedsAttention, filterHighRisk, autoRefresh, refreshIntervalSeconds, loadDashboard]);

  const getRiskColor = (category: string) => {
    switch (category) {
      case 'very_high':
        return 'bg-red-100 text-red-800 border-red-500';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-500';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-500';
      default:
        return 'bg-green-100 text-green-800 border-green-500';
    }
  };

  const getMoodTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return '📈 Improving';
      case 'declining':
        return '📉 Declining';
      case 'stable':
        return '➡️ Stable';
      default:
        return '❓ Unknown';
    }
  };

  if (loading && !metrics) {
    return (
      <div className="p-8 animate-pulse">
        <div className="h-8 bg-gray-200 rounded-sm w-1/3 mb-6"></div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-sm"></div>
          ))}
        </div>
        <div className="h-96 bg-gray-200 rounded-sm"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Dashboard Error</h3>
          <p className="text-red-700">{error}</p>
          <button
            onClick={loadDashboard}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="discharged-patient-dashboard p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Discharged Patient Monitoring
            </h1>
            <p className="text-gray-600">
              Real-time wellness tracking and readmission risk management
            </p>
          </div>
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="px-4 py-2 bg-[#1BA39C] text-white rounded-lg hover:bg-[#158A84] font-medium flex items-center gap-2 disabled:opacity-50"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4 shadow-md">
          <div className="text-3xl font-bold text-gray-800">{metrics.total_discharged_patients}</div>
          <div className="text-sm text-gray-600">Total Discharged (90 days)</div>
        </div>

        <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 shadow-md">
          <div className="text-3xl font-bold text-green-700">{metrics.enrollment_rate_percentage}%</div>
          <div className="text-sm text-green-700">Wellness Enrollment Rate</div>
          <div className="text-xs text-gray-600 mt-1">
            {metrics.patients_enrolled_in_wellness} of {metrics.total_discharged_patients} enrolled
          </div>
        </div>

        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 shadow-md">
          <div className="text-3xl font-bold text-red-700">{metrics.patients_needing_attention}</div>
          <div className="text-sm text-red-700">Need Attention</div>
          <div className="text-xs text-gray-600 mt-1">
            {metrics.critical_alerts} critical alerts
          </div>
        </div>

        <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-4 shadow-md">
          <div className="text-3xl font-bold text-blue-700">{metrics.avg_check_in_adherence}%</div>
          <div className="text-sm text-blue-700">Avg Check-In Adherence</div>
          <div className="text-xs text-gray-600 mt-1">
            Risk Score Avg: {metrics.avg_readmission_risk_score}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Filter by:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterNeedsAttention}
              onChange={(e) => setFilterNeedsAttention(e.target.checked)}
              className="w-4 h-4 text-red-600 border-gray-300 rounded-sm focus:ring-red-500"
            />
            <span className="text-sm text-gray-700">Needs Attention Only</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterHighRisk}
              onChange={(e) => setFilterHighRisk(e.target.checked)}
              className="w-4 h-4 text-orange-600 border-gray-300 rounded-sm focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">High Risk Only</span>
          </label>
        </div>
      </div>

      {/* Patient List */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-md">
        <div className="p-4 border-b border-gray-200 bg-linear-to-r from-[#E0F7F6] to-white">
          <h2 className="text-xl font-bold text-gray-800">
            Patients ({metrics.patients_list.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Discharge Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Diagnosis</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Risk Level</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Check-In Adherence</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Last Check-In</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Mood Trend</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {metrics.patients_list.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No discharged patients match your filters
                  </td>
                </tr>
              ) : (
                metrics.patients_list.map((patient) => (
                  <tr
                    key={patient.patient_id}
                    className={`hover:bg-gray-50 ${patient.needs_attention ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{patient.patient_name}</div>
                      {!patient.wellness_enrolled && (
                        <span className="text-xs text-gray-500">Not enrolled</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(patient.discharge_date).toLocaleDateString()}
                      <div className="text-xs text-gray-500">
                        ({Math.floor((Date.now() - new Date(patient.discharge_date).getTime()) / (1000 * 60 * 60 * 24))} days ago)
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {patient.discharge_diagnosis}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getRiskColor(patient.readmission_risk_category)}`}>
                        {patient.readmission_risk_category.toUpperCase()}
                      </span>
                      <div className="text-xs text-gray-500 mt-1">
                        Score: {patient.readmission_risk_score}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              patient.check_in_adherence_percentage >= 80
                                ? 'bg-green-600'
                                : patient.check_in_adherence_percentage >= 50
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${patient.check_in_adherence_percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{patient.check_in_adherence_percentage}%</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {patient.total_check_ins_completed} of {patient.total_check_ins_expected}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {patient.last_check_in_date ? (
                        <>
                          {new Date(patient.last_check_in_date).toLocaleDateString()}
                          {patient.days_since_last_check_in !== null && patient.days_since_last_check_in !== undefined && (
                            <div className={`text-xs mt-1 ${
                              patient.days_since_last_check_in >= 3 ? 'text-red-600 font-semibold' : 'text-gray-500'
                            }`}>
                              {patient.days_since_last_check_in === 0 ? 'Today' : `${patient.days_since_last_check_in} day${patient.days_since_last_check_in > 1 ? 's' : ''} ago`}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getMoodTrendIcon(patient.mood_trend)}
                      {patient.phq9_score_latest !== null && (
                        <div className="text-xs text-gray-500 mt-1">PHQ-9: {patient.phq9_score_latest}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {patient.needs_attention ? (
                        <div>
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-sm text-xs font-semibold">
                            ⚠️ NEEDS ATTENTION
                          </span>
                          <div className="text-xs text-gray-600 mt-1">
                            {patient.attention_reason}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">OK</span>
                      )}
                      {patient.active_alerts_count > 0 && (
                        <div className="text-xs text-red-600 font-semibold mt-1">
                          {patient.active_alerts_count} active alert{patient.active_alerts_count > 1 ? 's' : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedPatient(patient)}
                        className="text-sm text-[#1BA39C] hover:text-[#158A84] font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Detail Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 bg-linear-to-r from-[#E0F7F6] to-white">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">{selectedPatient.patient_name}</h2>
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Discharge Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Discharge Date</div>
                    <div className="font-medium">{new Date(selectedPatient.discharge_date).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Diagnosis</div>
                    <div className="font-medium">{selectedPatient.discharge_diagnosis}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Readmission Risk</div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getRiskColor(selectedPatient.readmission_risk_category)}`}>
                      {selectedPatient.readmission_risk_category.toUpperCase()} ({selectedPatient.readmission_risk_score})
                    </span>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Wellness Enrolled</div>
                    <div className="font-medium">{selectedPatient.wellness_enrolled ? '✅ Yes' : '❌ No'}</div>
                  </div>
                </div>
              </div>

              {/* Check-In Metrics */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Check-In Activity</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Adherence Rate</div>
                    <div className="text-2xl font-bold text-gray-800">{selectedPatient.check_in_adherence_percentage}%</div>
                    <div className="text-xs text-gray-500">
                      {selectedPatient.total_check_ins_completed} of {selectedPatient.total_check_ins_expected} completed
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Last Check-In</div>
                    <div className="font-medium">
                      {selectedPatient.last_check_in_date
                        ? new Date(selectedPatient.last_check_in_date).toLocaleDateString()
                        : 'Never'}
                    </div>
                    {selectedPatient.days_since_last_check_in !== null && selectedPatient.days_since_last_check_in !== undefined && (
                      <div className="text-xs text-gray-500">
                        {selectedPatient.days_since_last_check_in} day{selectedPatient.days_since_last_check_in !== 1 ? 's' : ''} ago
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Consecutive Missed</div>
                    <div className={`text-2xl font-bold ${selectedPatient.consecutive_missed_check_ins >= 3 ? 'text-red-600' : 'text-gray-800'}`}>
                      {selectedPatient.consecutive_missed_check_ins}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Active Alerts</div>
                    <div className={`text-2xl font-bold ${selectedPatient.active_alerts_count > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                      {selectedPatient.active_alerts_count}
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning Signs */}
              {selectedPatient.warning_signs_detected && selectedPatient.warning_signs_detected.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Warning Signs Detected</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedPatient.warning_signs_detected.map((sign, idx) => (
                      <span key={idx} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                        ⚠️ {sign}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mental Health */}
              {(selectedPatient.phq9_score_latest !== null || selectedPatient.gad7_score_latest !== null) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Mental Health Screening</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedPatient.phq9_score_latest !== null && selectedPatient.phq9_score_latest !== undefined && (
                      <div>
                        <div className="text-sm text-gray-600">PHQ-9 (Depression)</div>
                        <div className="text-2xl font-bold text-gray-800">{selectedPatient.phq9_score_latest}</div>
                        <div className="text-xs text-gray-500">
                          {selectedPatient.phq9_score_latest >= 15 ? 'Severe' : selectedPatient.phq9_score_latest >= 10 ? 'Moderate' : selectedPatient.phq9_score_latest >= 5 ? 'Mild' : 'Minimal'}
                        </div>
                      </div>
                    )}
                    {selectedPatient.gad7_score_latest !== null && selectedPatient.gad7_score_latest !== undefined && (
                      <div>
                        <div className="text-sm text-gray-600">GAD-7 (Anxiety)</div>
                        <div className="text-2xl font-bold text-gray-800">{selectedPatient.gad7_score_latest}</div>
                        <div className="text-xs text-gray-500">
                          {selectedPatient.gad7_score_latest >= 15 ? 'Severe' : selectedPatient.gad7_score_latest >= 10 ? 'Moderate' : selectedPatient.gad7_score_latest >= 5 ? 'Mild' : 'Minimal'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Trends */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Wellness Trends</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Mood Trend</div>
                    <div className="text-lg">{getMoodTrendIcon(selectedPatient.mood_trend)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Stress Trend</div>
                    <div className="text-lg">{getMoodTrendIcon(selectedPatient.stress_trend)}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-6 border-t border-gray-200">
                <div className="flex gap-3">
                  <button className="px-4 py-2 bg-[#1BA39C] text-white rounded-lg hover:bg-[#158A84] font-medium">
                    📞 Call Patient
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                    📧 Send Message
                  </button>
                  <button className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                    📋 View Full Chart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DischargedPatientDashboard;
