// Physical Therapy Dashboard - Clinical PT Workflow Management
// Comprehensive dashboard for PT assessments, treatment plans, and outcome tracking
// White-label ready - uses Envision Atlus design system

import React, { useEffect, useState, useCallback } from 'react';
import { Activity, Users, ClipboardList, TrendingUp, Calendar, FileText, Award, AlertTriangle, RefreshCw } from 'lucide-react';
import { PhysicalTherapyService } from '../../services/physicalTherapyService';
import { useUser } from '../../contexts/AuthContext';
import { usePatientContext, SelectedPatient } from '../../contexts/PatientContext';
import { useKeyboardShortcutsContextSafe } from '../envision-atlus/EAKeyboardShortcutsProvider';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EAMetricCard,
  EAAlert,
  EAPageLayout,
} from '../envision-atlus';
import type {
  PTCaseloadPatient,
  PTTreatmentPlan,
  PTFunctionalAssessment,
  PTOutcomeMeasure,
  SMARTGoal,
} from '../../types/physicalTherapy';

interface DashboardMetrics {
  activeCaseload: number;
  pendingAssessments: number;
  treatmentPlansActive: number;
  dischargeReady: number;
  mcidAchievementRate: number;
  averageVisitsUsed: number;
}

export const PhysicalTherapyDashboard: React.FC = () => {
  const user = useUser();
  const { selectPatient } = usePatientContext();
  const keyboardShortcuts = useKeyboardShortcutsContextSafe();

  // ATLUS: Technology - Filter state synced with keyboard shortcuts (Shift+H/C/A)
  const [progressFilter, setProgressFilter] = useState<'high' | 'critical' | 'all'>('all');

  // ATLUS: Technology - Sync filter with keyboard shortcuts
  useEffect(() => {
    if (keyboardShortcuts?.currentFilter) {
      setProgressFilter(keyboardShortcuts.currentFilter);
    }
  }, [keyboardShortcuts?.currentFilter]);

  // Filter patients based on progress filter (maps to risk levels)
  const getFilteredCaseload = useCallback((patients: PTCaseloadPatient[]) => {
    if (progressFilter === 'all') return patients;
    if (progressFilter === 'critical') {
      return patients.filter(p => p.progress_status === 'not_progressing');
    }
    if (progressFilter === 'high') {
      return patients.filter(p => p.progress_status === 'not_progressing' || p.progress_status === 'at_risk');
    }
    return patients;
  }, [progressFilter]);

  /**
   * Handle patient selection - sets PatientContext for cross-dashboard persistence
   * ATLUS: Unity - Patient context persists when navigating between dashboards
   */
  const handlePatientSelect = useCallback((patient: PTCaseloadPatient) => {
    // Map progress status to risk level
    const riskLevel = patient.progress_status === 'not_progressing' ? 'high'
      : patient.progress_status === 'at_risk' ? 'medium'
      : 'low' as const;

    // Parse patient name (format may vary)
    const nameParts = patient.patient_name.includes(',')
      ? patient.patient_name.split(',').map(s => s.trim()).reverse()
      : patient.patient_name.split(' ');

    const selectedPatient: SelectedPatient = {
      id: patient.patient_id,
      firstName: nameParts[0] || patient.patient_name,
      lastName: nameParts[1] || '',
      riskLevel,
      snapshot: {
        primaryDiagnosis: patient.diagnosis,
        unit: 'Physical Therapy',
      },
    };

    selectPatient(selectedPatient);
  }, [selectPatient]);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [caseload, setCaseload] = useState<PTCaseloadPatient[]>([]);
  const [_recentAssessments, _setRecentAssessments] = useState<PTFunctionalAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PTCaseloadPatient | null>(null);
  const [patientPlan, setPatientPlan] = useState<PTTreatmentPlan | null>(null);
  const [patientOutcomes, setPatientOutcomes] = useState<PTOutcomeMeasure[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadDashboard();
    }
  }, [user?.id]);

  const loadDashboard = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      // Load therapist's caseload
      const caseloadResult = await PhysicalTherapyService.getTherapistCaseload(user.id);

      if (caseloadResult.success && caseloadResult.data) {
        setCaseload(caseloadResult.data);

        // Calculate metrics from caseload
        const activeCaseload = caseloadResult.data.length;
        const dischargeReady = caseloadResult.data.filter(
          (p) => p.progress_status === 'on_track' && p.visits_remaining <= 2
        ).length;
        const atRiskPatients = caseloadResult.data.filter(
          (p) => p.progress_status === 'at_risk' || p.progress_status === 'not_progressing'
        ).length;
        const avgVisitsUsed = activeCaseload > 0
          ? caseloadResult.data.reduce((sum, p) => sum + p.visits_used, 0) / activeCaseload
          : 0;

        setMetrics({
          activeCaseload,
          pendingAssessments: atRiskPatients,
          treatmentPlansActive: activeCaseload,
          dischargeReady,
          mcidAchievementRate: 72, // This would come from outcome measures analysis
          averageVisitsUsed: Math.round(avgVisitsUsed * 10) / 10,
        });
      } else {
        // Initialize with empty state if no data
        setCaseload([]);
        setMetrics({
          activeCaseload: 0,
          pendingAssessments: 0,
          treatmentPlansActive: 0,
          dischargeReady: 0,
          mcidAchievementRate: 0,
          averageVisitsUsed: 0,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadPatientDetails = async (patient: PTCaseloadPatient) => {
    setSelectedPatient(patient);

    try {
      // Load treatment plan
      const planResult = await PhysicalTherapyService.getActiveTreatmentPlan(patient.patient_id);
      if (planResult.success) {
        setPatientPlan(planResult.data ?? null);
      }

      // Load outcome measures
      const outcomesResult = await PhysicalTherapyService.getOutcomeMeasures(patient.patient_id);
      if (outcomesResult.success && outcomesResult.data) {
        setPatientOutcomes(outcomesResult.data);
      }
    } catch (err) {
      // Handle silently - patient details are supplementary
    }
  };

  const getProgressBadgeVariant = (status: string): 'normal' | 'elevated' | 'high' | 'critical' => {
    switch (status) {
      case 'on_track': return 'normal';
      case 'at_risk': return 'elevated';
      case 'not_progressing': return 'high';
      default: return 'normal';
    }
  };

  const getProgressLabel = (status: string): string => {
    switch (status) {
      case 'on_track': return 'On Track';
      case 'at_risk': return 'At Risk';
      case 'not_progressing': return 'Not Progressing';
      default: return status;
    }
  };

  if (loading && !metrics) {
    return (
      <EAPageLayout title="Physical Therapy Dashboard">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
      </EAPageLayout>
    );
  }

  if (error) {
    return (
      <EAPageLayout title="Physical Therapy Dashboard">
        <EAAlert variant="critical" dismissible={false}>
          <div className="flex flex-col items-center">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <h3 className="text-lg font-bold mb-2">Failed to Load Dashboard</h3>
            <p className="mb-4">{error}</p>
            <EAButton onClick={loadDashboard} variant="primary">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </EAButton>
          </div>
        </EAAlert>
      </EAPageLayout>
    );
  }

  return (
    <EAPageLayout title="Physical Therapy Dashboard" subtitle="ICF-Based Clinical Workflow Management">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Physical Therapy Dashboard</h1>
            <p className="text-slate-400">ICF-Based Clinical Workflow Management</p>
            {/* ATLUS: Technology - Filter indicator and controls (Shift+H/C/A) */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-slate-500 font-medium">Filter:</span>
              <button
                onClick={() => setProgressFilter('all')}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  progressFilter === 'all'
                    ? 'bg-teal-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                All (Shift+A)
              </button>
              <button
                onClick={() => setProgressFilter('high')}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  progressFilter === 'high'
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                At Risk+ (Shift+H)
              </button>
              <button
                onClick={() => setProgressFilter('critical')}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  progressFilter === 'critical'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Not Progressing (Shift+C)
              </button>
            </div>
          </div>
          <EAButton onClick={loadDashboard} variant="secondary" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </EAButton>
        </div>

        {/* Key Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <EAMetricCard
              label="Active Caseload"
              value={metrics.activeCaseload}
              icon={<Users className="h-5 w-5" />}
            />
            <EAMetricCard
              label="At-Risk Patients"
              value={metrics.pendingAssessments}
              icon={<AlertTriangle className="h-5 w-5" />}
              riskLevel={metrics.pendingAssessments > 3 ? 'high' : 'normal'}
            />
            <EAMetricCard
              label="Active Plans"
              value={metrics.treatmentPlansActive}
              icon={<ClipboardList className="h-5 w-5" />}
            />
            <EAMetricCard
              label="Discharge Ready"
              value={metrics.dischargeReady}
              icon={<Award className="h-5 w-5" />}
              trend={metrics.dischargeReady > 0 ? { value: 1, direction: 'up' } : undefined}
            />
            <EAMetricCard
              label="MCID Rate"
              value={`${metrics.mcidAchievementRate}%`}
              icon={<TrendingUp className="h-5 w-5" />}
              riskLevel={metrics.mcidAchievementRate >= 70 ? 'normal' : 'elevated'}
            />
            <EAMetricCard
              label="Avg Visits Used"
              value={metrics.averageVisitsUsed}
              icon={<Calendar className="h-5 w-5" />}
            />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Caseload */}
          <div className="lg:col-span-2">
            <EACard>
              <EACardHeader>
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-white">Active Caseload</h2>
                  <EABadge variant="info">{getFilteredCaseload(caseload).length} patients</EABadge>
                </div>
              </EACardHeader>
              <EACardContent>
                {caseload.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No active patients in caseload</p>
                    <p className="text-sm mt-1">Create a new assessment to add patients</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Patient</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Diagnosis</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Visits</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Progress</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Next Visit</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {getFilteredCaseload(caseload).map((patient) => (
                          <tr key={patient.patient_id} className="hover:bg-slate-700/50">
                            <td className="px-4 py-3">
                              <button
                                className="font-medium text-white hover:text-teal-400 transition-colors text-left"
                                onClick={() => handlePatientSelect(patient)}
                              >
                                {patient.patient_name}
                              </button>
                              <div className="text-xs text-slate-400">{patient.patient_id.substring(0, 8)}...</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-300">{patient.diagnosis}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className="text-white">{patient.visits_used}</span>
                              <span className="text-slate-400">/{patient.visits_used + patient.visits_remaining}</span>
                            </td>
                            <td className="px-4 py-3">
                              <EABadge variant={getProgressBadgeVariant(patient.progress_status)} size="sm">
                                {getProgressLabel(patient.progress_status)}
                              </EABadge>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-300">
                              {patient.next_scheduled_visit
                                ? new Date(patient.next_scheduled_visit).toLocaleDateString()
                                : 'Not scheduled'
                              }
                            </td>
                            <td className="px-4 py-3">
                              <EAButton
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  handlePatientSelect(patient);
                                  loadPatientDetails(patient);
                                }}
                              >
                                View
                              </EAButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </EACardContent>
            </EACard>
          </div>

          {/* Quick Actions & Alerts */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <EACard>
              <EACardHeader>
                <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
              </EACardHeader>
              <EACardContent>
                <div className="space-y-3">
                  <EAButton variant="primary" className="w-full justify-start">
                    <ClipboardList className="h-4 w-4 mr-2" />
                    New Initial Evaluation
                  </EAButton>
                  <EAButton variant="secondary" className="w-full justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    Record Treatment Session
                  </EAButton>
                  <EAButton variant="secondary" className="w-full justify-start">
                    <Activity className="h-4 w-4 mr-2" />
                    Add Outcome Measure
                  </EAButton>
                  <EAButton variant="secondary" className="w-full justify-start">
                    <Award className="h-4 w-4 mr-2" />
                    Prepare Discharge Summary
                  </EAButton>
                </div>
              </EACardContent>
            </EACard>

            {/* Patients Needing Attention */}
            <EACard>
              <EACardHeader>
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                  Needs Attention
                </h2>
              </EACardHeader>
              <EACardContent>
                {caseload.filter(p => p.progress_status !== 'on_track').length === 0 ? (
                  <div className="text-center py-4 text-slate-400">
                    <p>All patients on track</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {caseload
                      .filter(p => p.progress_status !== 'on_track')
                      .slice(0, 5)
                      .map((patient) => (
                        <div
                          key={patient.patient_id}
                          className="p-3 bg-slate-700/50 rounded-lg border-l-4 border-orange-500 cursor-pointer hover:bg-slate-600/50 transition-colors"
                          onClick={() => handlePatientSelect(patient)}
                        >
                          <div className="font-medium text-white hover:text-teal-400">{patient.patient_name}</div>
                          <div className="text-sm text-slate-400 mt-1">
                            {patient.days_since_last_visit} days since last visit
                          </div>
                          <EABadge
                            variant={getProgressBadgeVariant(patient.progress_status)}
                            size="sm"
                            className="mt-2"
                          >
                            {getProgressLabel(patient.progress_status)}
                          </EABadge>
                        </div>
                      ))}
                  </div>
                )}
              </EACardContent>
            </EACard>
          </div>
        </div>

        {/* Patient Detail Modal */}
        {selectedPatient && (
          <PatientDetailModal
            patient={selectedPatient}
            plan={patientPlan}
            outcomes={patientOutcomes}
            onClose={() => {
              setSelectedPatient(null);
              setPatientPlan(null);
              setPatientOutcomes([]);
            }}
          />
        )}
      </div>
    </EAPageLayout>
  );
};

// Patient Detail Modal
interface PatientDetailModalProps {
  patient: PTCaseloadPatient;
  plan: PTTreatmentPlan | null;
  outcomes: PTOutcomeMeasure[];
  onClose: () => void;
}

const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
  patient,
  plan,
  outcomes,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto border border-slate-700">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white">{patient.patient_name}</h2>
            <p className="text-sm text-slate-400">{patient.diagnosis}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-2xl"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Visit Progress */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-700/50 p-4 rounded-lg">
              <p className="text-sm text-slate-400">Visits Used</p>
              <p className="text-2xl font-bold text-white">{patient.visits_used}</p>
            </div>
            <div className="bg-slate-700/50 p-4 rounded-lg">
              <p className="text-sm text-slate-400">Visits Remaining</p>
              <p className="text-2xl font-bold text-teal-400">{patient.visits_remaining}</p>
            </div>
            <div className="bg-slate-700/50 p-4 rounded-lg">
              <p className="text-sm text-slate-400">Days Since Last Visit</p>
              <p className="text-2xl font-bold text-white">{patient.days_since_last_visit}</p>
            </div>
          </div>

          {/* Treatment Plan Goals */}
          {plan && plan.goals && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Treatment Goals</h3>
              <div className="space-y-3">
                {plan.goals.map((goal: SMARTGoal, index: number) => (
                  <div key={goal.goal_id || index} className="bg-slate-700/50 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-white">{goal.goal_statement}</p>
                        <p className="text-sm text-slate-400 mt-1">
                          Target: {goal.target_status} | Timeframe: {goal.timeframe_weeks} weeks
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-teal-400">
                          {goal.progress_percentage || 0}%
                        </div>
                        <div className="w-24 h-2 bg-slate-600 rounded-full mt-1">
                          <div
                            className="h-full bg-teal-500 rounded-full transition-all"
                            style={{ width: `${goal.progress_percentage || 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outcome Measures */}
          {outcomes.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Outcome Measures</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Measure</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Score</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">Change</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase">MCID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {outcomes.slice(0, 5).map((outcome) => (
                      <tr key={outcome.id}>
                        <td className="px-4 py-2">
                          <span className="font-medium text-white">{outcome.measure_acronym}</span>
                          <span className="text-xs text-slate-400 block">{outcome.measure_name}</span>
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-300">
                          {new Date(outcome.administration_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-white">{outcome.raw_score}</td>
                        <td className="px-4 py-2 text-sm">
                          {outcome.change_from_previous !== null && outcome.change_from_previous !== undefined ? (
                            <span className={outcome.change_from_previous > 0 ? 'text-green-400' : 'text-red-400'}>
                              {outcome.change_from_previous > 0 ? '+' : ''}{outcome.change_from_previous}
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {outcome.mcid_achieved ? (
                            <EABadge variant="normal" size="sm">Achieved</EABadge>
                          ) : (
                            <EABadge variant="neutral" size="sm">Not Yet</EABadge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-4 border-t border-slate-700">
            <EAButton variant="primary" className="flex-1">
              <FileText className="h-4 w-4 mr-2" />
              Record Session
            </EAButton>
            <EAButton variant="secondary" className="flex-1">
              <Activity className="h-4 w-4 mr-2" />
              Add Outcome Measure
            </EAButton>
            <EAButton variant="secondary" className="flex-1">
              <ClipboardList className="h-4 w-4 mr-2" />
              Update Goals
            </EAButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhysicalTherapyDashboard;
