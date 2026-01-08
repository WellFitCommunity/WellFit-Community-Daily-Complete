/**
 * NeuroSuite Dashboard - Provider View
 *
 * Features:
 * - Active stroke patients monitoring
 * - Dementia care patient list
 * - Parkinson's disease tracking (UPDRS, medications, DBS)
 * - Fall detection alerts from wearables
 * - NIHSS tracking timeline
 * - Cognitive decline monitoring
 * - Caregiver burden alerts
 *
 * For: Neurologists, Stroke Coordinators, Memory Clinic Staff, Movement Disorder Specialists
 */

import React, { useState, useEffect, useCallback } from 'react';
import { NeuroSuiteService } from '../../services/neuroSuiteService';
import { ParkinsonsService } from '../../services/parkinsonsService';
import { useAuth } from '../../contexts/AuthContext';
import { usePatientContext, SelectedPatient } from '../../contexts/PatientContext';
import type { ParkinsonsDashboardMetrics, ParkinsonsPatientSummary } from '../../types/parkinsons';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EAMetricCard,
  EABadge,
  EATabs,
  EATabsList,
  EATabsTrigger,
  EATabsContent,
  EAAlert,
} from '../envision-atlus';
import AdminHeader from '../admin/AdminHeader';
import {
  Brain,
  Activity,
  AlertTriangle,
  Watch,
  Users,
  FileText,
  Plus,
  Eye,
  ClipboardList,
} from 'lucide-react';

interface PatientAlert {
  patientId: string;
  patientName: string;
  alertType: 'fall' | 'vital' | 'cognitive_decline' | 'caregiver_burden';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: string;
}

/** Interface for active stroke patient data returned from RPC */
interface ActiveStrokePatient {
  patient_id: string;
  patient_name: string;
  mrn?: string;
  room_number?: string;
  stroke_type: string;
  nihss_score: number;
  days_since_stroke: number;
  next_assessment_due: string;
  tpa_eligible?: boolean;
  tpa_administered?: boolean;
}

/** Interface for dementia patient needing reassessment returned from RPC */
interface DementiaPatient {
  patient_id: string;
  patient_name: string;
  mrn?: string;
  room_number?: string;
  dementia_stage: string;
  last_assessment_date: string;
  days_overdue: number;
}

/** Interface for high-burden caregiver data returned from RPC */
interface HighBurdenCaregiver {
  patient_id: string;
  caregiver_name: string;
  zarit_score: number;
  respite_care_needed?: boolean;
}

export const NeuroSuiteDashboard: React.FC = () => {
  const { user } = useAuth();
  const { selectPatient } = usePatientContext();
  const [activeStrokePatients, setActiveStrokePatients] = useState<ActiveStrokePatient[]>([]);
  const [dementiaPatients, setDementiaPatients] = useState<DementiaPatient[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<PatientAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('stroke');

  /**
   * Handle patient selection - sets PatientContext for cross-dashboard persistence
   * ATLUS: Unity - Patient context persists when navigating between dashboards
   */
  const handlePatientSelect = useCallback((patient: {
    patient_id: string;
    patient_name: string;
    mrn?: string;
    room_number?: string;
  }, riskLevel?: 'low' | 'medium' | 'high' | 'critical') => {
    // Parse patient name (expected format: "Last, First" or "First Last")
    const nameParts = patient.patient_name.includes(',')
      ? patient.patient_name.split(',').map(s => s.trim()).reverse()
      : patient.patient_name.split(' ');

    const selectedPatient: SelectedPatient = {
      id: patient.patient_id,
      firstName: nameParts[0] || '',
      lastName: nameParts[1] || nameParts[0] || '',
      mrn: patient.mrn,
      roomNumber: patient.room_number,
      riskLevel: riskLevel,
      snapshot: {
        unit: 'Neuro',
      },
    };

    selectPatient(selectedPatient);
  }, [selectPatient]);

  // Parkinson's state
  const [parkinsonsMetrics, setParkinsonsMetrics] = useState<ParkinsonsDashboardMetrics | null>(null);
  const [parkinsonsPatients, setParkinsonsPatients] = useState<ParkinsonsPatientSummary[]>([]);

  const loadDashboardData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Load active stroke patients
      const strokeResponse = await NeuroSuiteService.getActiveStrokePatients(user.id);
      if (strokeResponse.success && strokeResponse.data) {
        // Cast at boundary from RPC response - types verified against database schema
        setActiveStrokePatients(strokeResponse.data as unknown as ActiveStrokePatient[]);
      }

      // Load dementia patients needing reassessment
      const dementiaResponse = await NeuroSuiteService.getDementiaPatientsNeedingReassessment();
      if (dementiaResponse.success && dementiaResponse.data) {
        // Cast at boundary from RPC response - types verified against database schema
        setDementiaPatients(dementiaResponse.data as unknown as DementiaPatient[]);
      }

      // Load high-burden caregivers
      const caregiversResponse = await NeuroSuiteService.identifyHighBurdenCaregivers();
      if (caregiversResponse.success && caregiversResponse.data) {
        // Convert to alerts - cast at boundary from RPC response
        const caregivers = caregiversResponse.data as unknown as HighBurdenCaregiver[];
        const caregiverAlerts: PatientAlert[] = caregivers.map((cg) => ({
          patientId: cg.patient_id,
          patientName: 'Patient',
          alertType: 'caregiver_burden' as const,
          severity: cg.zarit_score > 30 ? 'high' : 'medium' as const,
          message: `Caregiver burden score: ${cg.zarit_score}. ${cg.respite_care_needed ? 'Respite care needed.' : ''}`,
          timestamp: new Date().toISOString(),
        }));
        setRecentAlerts((prev) => [...prev, ...caregiverAlerts]);
      }

      // Load Parkinson's data
      const parkinsonsMetricsResponse = await ParkinsonsService.getDashboardMetrics(user.id);
      if (parkinsonsMetricsResponse.success && parkinsonsMetricsResponse.data) {
        setParkinsonsMetrics(parkinsonsMetricsResponse.data);
      }

      const parkinsonsPatientsResponse = await ParkinsonsService.getPatientSummaries(user.id);
      if (parkinsonsPatientsResponse.success && parkinsonsPatientsResponse.data) {
        setParkinsonsPatients(parkinsonsPatientsResponse.data);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, loadDashboardData]);

  const calculateStrokeQualityMetrics = () => {
    const totalPatients = activeStrokePatients.length;
    const tpaEligible = activeStrokePatients.filter((p) => p.tpa_eligible).length;
    const tpaAdministered = activeStrokePatients.filter((p) => p.tpa_administered).length;

    return {
      totalPatients,
      tpaEligibleRate: totalPatients > 0 ? ((tpaEligible / totalPatients) * 100).toFixed(1) : '0',
      tpaAdministrationRate: tpaEligible > 0 ? ((tpaAdministered / tpaEligible) * 100).toFixed(1) : '0',
    };
  };

  const getAlertVariant = (severity: string): 'critical' | 'warning' | 'info' => {
    switch (severity) {
      case 'high':
        return 'critical';
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getRiskBadgeVariant = (risk: string): 'critical' | 'high' | 'normal' => {
    switch (risk) {
      case 'high':
        return 'critical';
      case 'moderate':
        return 'high';
      default:
        return 'normal';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800">
        <AdminHeader title="NeuroSuite" />
        <div className="flex items-center justify-center h-96">
          <div className="text-xl text-slate-300">Loading NeuroSuite dashboard...</div>
        </div>
      </div>
    );
  }

  const metrics = calculateStrokeQualityMetrics();

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800">
      <AdminHeader title="NeuroSuite" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">NeuroSuite Dashboard</h1>
            <p className="text-slate-400">Stroke, Dementia & Movement Disorder Care Management</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400">Last updated</div>
            <div className="font-semibold text-white">{new Date().toLocaleTimeString()}</div>
          </div>
        </div>

        {/* Quality Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <EAMetricCard
            label="Active Stroke Patients"
            value={metrics.totalPatients}
            icon={<Activity className="h-5 w-5" />}
          />
          <EAMetricCard
            label="tPA Eligible Rate"
            value={`${metrics.tpaEligibleRate}%`}
            icon={<FileText className="h-5 w-5" />}
            sublabel="Quality metric"
          />
          <EAMetricCard
            label="tPA Admin Rate"
            value={`${metrics.tpaAdministrationRate}%`}
            icon={<ClipboardList className="h-5 w-5" />}
            sublabel="Quality metric"
          />
          <EAMetricCard
            label="Dementia Reassessments Due"
            value={dementiaPatients.length}
            icon={<Brain className="h-5 w-5" />}
            sublabel={dementiaPatients.length > 0 ? 'Action needed' : 'All current'}
          />
        </div>

        {/* Tabs */}
        <EATabs defaultValue="stroke" value={activeTab} onValueChange={setActiveTab}>
          <EATabsList>
            <EATabsTrigger value="stroke">
              <Activity className="h-4 w-4 mr-2" />
              Stroke
            </EATabsTrigger>
            <EATabsTrigger value="dementia">
              <Brain className="h-4 w-4 mr-2" />
              Dementia
            </EATabsTrigger>
            <EATabsTrigger value="parkinsons">
              <Users className="h-4 w-4 mr-2" />
              Parkinson&apos;s
            </EATabsTrigger>
            <EATabsTrigger value="alerts">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alerts
            </EATabsTrigger>
            <EATabsTrigger value="wearables">
              <Watch className="h-4 w-4 mr-2" />
              Wearables
            </EATabsTrigger>
          </EATabsList>

          {/* Stroke Tab */}
          <EATabsContent value="stroke">
            <EACard>
              <EACardHeader>
                <h2 className="text-xl font-semibold text-white">Active Stroke Patients</h2>
              </EACardHeader>
              <EACardContent>
                {activeStrokePatients.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-slate-900/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Patient</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Stroke Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">NIHSS Score</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Days Since Stroke</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Next Assessment</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {activeStrokePatients.map((patient) => (
                          <tr key={patient.patient_id} className="hover:bg-slate-700/30 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                className="font-medium text-white hover:text-teal-400 transition-colors text-left"
                                onClick={() => handlePatientSelect(patient, 'high')}
                              >
                                {patient.patient_name}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <EABadge variant="info">{patient.stroke_type}</EABadge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-bold text-lg text-white">{patient.nihss_score}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-300">{patient.days_since_stroke}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                              {new Date(patient.next_assessment_due).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <EAButton
                                variant="ghost"
                                size="sm"
                                icon={<Eye className="h-4 w-4" />}
                                onClick={() => handlePatientSelect(patient, 'high')}
                              >
                                View Chart
                              </EAButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-8">No active stroke patients</p>
                )}
              </EACardContent>
            </EACard>
          </EATabsContent>

          {/* Dementia Tab */}
          <EATabsContent value="dementia">
            <EACard>
              <EACardHeader>
                <h2 className="text-xl font-semibold text-white">Dementia Patients - Reassessments Due</h2>
              </EACardHeader>
              <EACardContent>
                {dementiaPatients.length > 0 ? (
                  <div className="space-y-4">
                    {dementiaPatients.map((patient) => (
                      <div key={patient.patient_id} className="p-4 bg-slate-700/30 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-bold text-lg text-white">{patient.patient_name}</div>
                            <div className="text-sm text-slate-400">
                              Last assessment: {new Date(patient.last_assessment_date).toLocaleDateString()}
                            </div>
                            <div className="text-sm text-slate-400">
                              Stage: <span className="font-semibold text-slate-200">{patient.dementia_stage}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-red-400 font-bold">{patient.days_overdue} days overdue</div>
                            <EAButton variant="primary" size="sm" className="mt-2">
                              Schedule Assessment
                            </EAButton>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-8">All patients up to date with assessments</p>
                )}
              </EACardContent>
            </EACard>
          </EATabsContent>

          {/* Parkinson's Tab */}
          <EATabsContent value="parkinsons">
            <div className="space-y-6">
              {/* Parkinson's Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <EAMetricCard
                  label="PD Patients"
                  value={parkinsonsMetrics?.totalPatients || 0}
                  icon={<Users className="h-5 w-5" />}
                />
                <EAMetricCard
                  label="On DBS"
                  value={parkinsonsMetrics?.patientsOnDBS || 0}
                  icon={<Activity className="h-5 w-5" />}
                />
                <EAMetricCard
                  label="Avg UPDRS Score"
                  value={parkinsonsMetrics?.averageUPDRSScore || '--'}
                  icon={<ClipboardList className="h-5 w-5" />}
                />
                <EAMetricCard
                  label="High Risk (H&Y 3+)"
                  value={parkinsonsMetrics?.highRiskPatients || 0}
                  icon={<AlertTriangle className="h-5 w-5" />}
                  sublabel="Monitor closely"
                />
              </div>

              {/* Parkinson's Patient List */}
              <EACard>
                <EACardHeader className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-white">Parkinson&apos;s Patients</h2>
                  <EAButton variant="primary" size="sm" icon={<Plus className="h-4 w-4" />}>
                    Enroll Patient
                  </EAButton>
                </EACardHeader>
                <EACardContent>
                  {parkinsonsPatients.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-slate-900/50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Patient</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">H&Y Stage</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Last UPDRS</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Medications</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">DBS</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Risk</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {parkinsonsPatients.map((patient) => {
                            // Map risk level string to typed value
                            const riskLevel = patient.risk_level === 'high' ? 'high'
                              : patient.risk_level === 'moderate' ? 'medium'
                              : 'low' as const;

                            return (
                            <tr key={patient.patient_id} className="hover:bg-slate-700/30 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <button
                                  className="font-medium text-white hover:text-teal-400 transition-colors text-left"
                                  onClick={() => handlePatientSelect({
                                    patient_id: patient.patient_id,
                                    patient_name: patient.patient_name,
                                  }, riskLevel)}
                                >
                                  {patient.patient_name}
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <EABadge variant="info">Stage {patient.hoehn_yahr_stage || '--'}</EABadge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-bold text-lg text-white">{patient.last_updrs_score ?? '--'}</span>
                                {patient.last_updrs_date && (
                                  <div className="text-xs text-slate-500">
                                    {new Date(patient.last_updrs_date).toLocaleDateString()}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                                {patient.medication_count} active
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {patient.has_dbs ? (
                                  <EABadge variant="normal">Yes</EABadge>
                                ) : (
                                  <EABadge variant="neutral">No</EABadge>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <EABadge variant={getRiskBadgeVariant(patient.risk_level)}>
                                  {patient.risk_level}
                                </EABadge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap space-x-2">
                                <EAButton
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePatientSelect({
                                    patient_id: patient.patient_id,
                                    patient_name: patient.patient_name,
                                  }, riskLevel)}
                                >
                                  View
                                </EAButton>
                                <EAButton variant="ghost" size="sm">UPDRS</EAButton>
                              </td>
                            </tr>
                          );})}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-400">No Parkinson&apos;s patients enrolled</p>
                      <p className="text-slate-500 text-sm mt-2">
                        Click &quot;Enroll Patient&quot; to add patients to the PD tracking program
                      </p>
                    </div>
                  )}
                </EACardContent>
              </EACard>

              {/* ROBERT & FORBES Framework Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <EACard className="bg-linear-to-br from-[#00857a]/20 to-slate-800 border-[#00857a]/30">
                  <EACardContent>
                    <h3 className="text-lg font-bold text-[#33bfb7] mb-3">ROBERT Framework</h3>
                    <ul className="text-sm space-y-2 text-slate-300">
                      <li><span className="font-bold text-[#00857a]">R</span>hythm & Movement Monitoring</li>
                      <li><span className="font-bold text-[#00857a]">O</span>ptimization of Medication</li>
                      <li><span className="font-bold text-[#00857a]">B</span>radykinesia & Rigidity Tracking</li>
                      <li><span className="font-bold text-[#00857a]">E</span>xercise & Physical Therapy</li>
                      <li><span className="font-bold text-[#00857a]">R</span>eal-time Wearable Monitoring</li>
                      <li><span className="font-bold text-[#00857a]">T</span>herapeutic Interventions</li>
                    </ul>
                  </EACardContent>
                </EACard>
                <EACard className="bg-linear-to-br from-blue-500/20 to-slate-800 border-blue-500/30">
                  <EACardContent>
                    <h3 className="text-lg font-bold text-blue-400 mb-3">FORBES Framework</h3>
                    <ul className="text-sm space-y-2 text-slate-300">
                      <li><span className="font-bold text-blue-400">F</span>unctional Assessment (Freezing, Falls)</li>
                      <li><span className="font-bold text-blue-400">O</span>ngoing Clinical Monitoring</li>
                      <li><span className="font-bold text-blue-400">R</span>ehabilitation (LSVT BIG/LOUD)</li>
                      <li><span className="font-bold text-blue-400">B</span>ehavioral & Cognitive Screening</li>
                      <li><span className="font-bold text-blue-400">E</span>ducation & Caregiver Support</li>
                      <li><span className="font-bold text-blue-400">S</span>peech & Swallowing Evaluation</li>
                    </ul>
                  </EACardContent>
                </EACard>
              </div>
            </div>
          </EATabsContent>

          {/* Alerts Tab */}
          <EATabsContent value="alerts">
            <EACard>
              <EACardHeader>
                <h2 className="text-xl font-semibold text-white">Patient Alerts</h2>
              </EACardHeader>
              <EACardContent>
                {recentAlerts.length > 0 ? (
                  <div className="space-y-3">
                    {recentAlerts.map((alert, index) => (
                      <EAAlert
                        key={index}
                        variant={getAlertVariant(alert.severity)}
                        title={alert.patientName}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm">{alert.message}</div>
                            <div className="text-xs mt-1 opacity-70">
                              {alert.alertType.replace('_', ' ')} · {new Date(alert.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <EAButton variant="secondary" size="sm">
                            Review
                          </EAButton>
                        </div>
                      </EAAlert>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-400 text-lg">No active alerts</p>
                    <p className="text-slate-500 text-sm mt-2">All patients stable</p>
                  </div>
                )}
              </EACardContent>
            </EACard>
          </EATabsContent>

          {/* Wearables Tab */}
          <EATabsContent value="wearables">
            <EACard>
              <EACardHeader>
                <h2 className="text-xl font-semibold text-white">Wearable Device Monitoring</h2>
              </EACardHeader>
              <EACardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-6 bg-slate-700/30 rounded-lg border border-slate-600">
                    <Watch className="h-8 w-8 text-blue-400 mb-2" />
                    <div className="text-2xl font-bold text-white">--</div>
                    <div className="text-sm text-slate-400">Patients with Wearables</div>
                  </div>
                  <div className="p-6 bg-slate-700/30 rounded-lg border border-slate-600">
                    <AlertTriangle className="h-8 w-8 text-red-400 mb-2" />
                    <div className="text-2xl font-bold text-white">--</div>
                    <div className="text-sm text-slate-400">Fall Alerts (24h)</div>
                  </div>
                  <div className="p-6 bg-slate-700/30 rounded-lg border border-slate-600">
                    <Activity className="h-8 w-8 text-yellow-400 mb-2" />
                    <div className="text-2xl font-bold text-white">--</div>
                    <div className="text-sm text-slate-400">Vital Sign Alerts (24h)</div>
                  </div>
                </div>
                <div className="text-center text-slate-400">
                  <p>Wearable monitoring data will appear here</p>
                  <p className="text-sm mt-2 text-slate-500">Patients must connect their devices from their patient dashboard</p>
                </div>
              </EACardContent>
            </EACard>
          </EATabsContent>
        </EATabs>

        {/* Quick Actions */}
        <EACard className="bg-linear-to-r from-[#00857a] to-[#006d64] border-none">
          <EACardContent>
            <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <button className="bg-white/10 hover:bg-white/20 rounded-lg p-4 text-center transition-colors">
                <FileText className="h-6 w-6 mx-auto mb-2 text-white" />
                <div className="text-sm font-semibold text-white">New Stroke Assessment</div>
              </button>
              <button className="bg-white/10 hover:bg-white/20 rounded-lg p-4 text-center transition-colors">
                <Brain className="h-6 w-6 mx-auto mb-2 text-white" />
                <div className="text-sm font-semibold text-white">Cognitive Screening</div>
              </button>
              <button className="bg-white/10 hover:bg-white/20 rounded-lg p-4 text-center transition-colors">
                <Users className="h-6 w-6 mx-auto mb-2 text-white" />
                <div className="text-sm font-semibold text-white">Caregiver Assessment</div>
              </button>
              <button
                onClick={() => setActiveTab('parkinsons')}
                className="bg-white/10 hover:bg-white/20 rounded-lg p-4 text-center transition-colors"
              >
                <ClipboardList className="h-6 w-6 mx-auto mb-2 text-white" />
                <div className="text-sm font-semibold text-white">Parkinson&apos;s UPDRS</div>
              </button>
              <button className="bg-white/10 hover:bg-white/20 rounded-lg p-4 text-center transition-colors">
                <Activity className="h-6 w-6 mx-auto mb-2 text-white" />
                <div className="text-sm font-semibold text-white">Quality Reports</div>
              </button>
            </div>
          </EACardContent>
        </EACard>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs text-slate-600 text-center">
            Envision Atlus NeuroSuite &bull; Powered by Envision VirtualEdge Group
          </p>
        </div>
      </footer>
    </div>
  );
};

export default NeuroSuiteDashboard;
