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
import type { ParkinsonsDashboardMetrics, ParkinsonsPatientSummary } from '../../types/parkinsons';

interface PatientAlert {
  patientId: string;
  patientName: string;
  alertType: 'fall' | 'vital' | 'cognitive_decline' | 'caregiver_burden';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: string;
}

export const NeuroSuiteDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeStrokePatients, setActiveStrokePatients] = useState<any[]>([]);
  const [dementiaPatients, setDementiaPatients] = useState<any[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<PatientAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stroke' | 'dementia' | 'parkinsons' | 'alerts' | 'wearables'>('stroke');

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
        setActiveStrokePatients(strokeResponse.data);
      }

      // Load dementia patients needing reassessment
      const dementiaResponse = await NeuroSuiteService.getDementiaPatientsNeedingReassessment();
      if (dementiaResponse.success && dementiaResponse.data) {
        setDementiaPatients(dementiaResponse.data);
      }

      // Load high-burden caregivers
      const caregiversResponse = await NeuroSuiteService.identifyHighBurdenCaregivers();
      if (caregiversResponse.success && caregiversResponse.data) {
        // Convert to alerts
        const caregiverAlerts: PatientAlert[] = caregiversResponse.data.map((cg: any) => ({
          patientId: cg.patient_id,
          patientName: 'Patient', // Would come from patient lookup
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
    } catch (error) {

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
    // Calculate quality metrics from stroke patients
    const totalPatients = activeStrokePatients.length;
    const tpaEligible = activeStrokePatients.filter((p) => p.tpa_eligible).length;
    const tpaAdministered = activeStrokePatients.filter((p) => p.tpa_administered).length;

    return {
      totalPatients,
      tpaEligibleRate: totalPatients > 0 ? ((tpaEligible / totalPatients) * 100).toFixed(1) : '0',
      tpaAdministrationRate: tpaEligible > 0 ? ((tpaAdministered / tpaEligible) * 100).toFixed(1) : '0',
    };
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 border-red-400 text-red-800';
      case 'medium':
        return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      case 'low':
        return 'bg-blue-100 border-blue-400 text-blue-800';
      default:
        return 'bg-gray-100 border-gray-400 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-xl">Loading NeuroSuite dashboard...</div>
      </div>
    );
  }

  const metrics = calculateStrokeQualityMetrics();

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">NeuroSuite Dashboard</h1>
          <p className="text-gray-600">Stroke & Dementia Care Management</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">Last updated</div>
          <div className="font-semibold">{new Date().toLocaleTimeString()}</div>
        </div>
      </div>

      {/* Quality Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-600">
          <div className="text-gray-600 text-sm mb-1">Active Stroke Patients</div>
          <div className="text-3xl font-bold">{metrics.totalPatients}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-600">
          <div className="text-gray-600 text-sm mb-1">tPA Eligible Rate</div>
          <div className="text-3xl font-bold">{metrics.tpaEligibleRate}%</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-600">
          <div className="text-gray-600 text-sm mb-1">tPA Admin Rate</div>
          <div className="text-3xl font-bold">{metrics.tpaAdministrationRate}%</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-orange-600">
          <div className="text-gray-600 text-sm mb-1">Dementia Reassessments Due</div>
          <div className="text-3xl font-bold">{dementiaPatients.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b-2 border-gray-200 overflow-x-auto">
        {['stroke', 'dementia', 'parkinsons', 'alerts', 'wearables'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={`px-6 py-3 text-lg font-semibold ${
              activeTab === tab
                ? 'border-b-4 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'stroke' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Active Stroke Patients</h2>
            {activeStrokePatients.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Stroke Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        NIHSS Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Days Since Stroke
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Next Assessment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activeStrokePatients.map((patient) => (
                      <tr key={patient.patient_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{patient.patient_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {patient.stroke_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-bold text-lg">{patient.nihss_score}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{patient.days_since_stroke}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(patient.next_assessment_due).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button className="text-blue-600 hover:text-blue-900 font-medium">
                            View Chart
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No active stroke patients</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'dementia' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Dementia Patients - Reassessments Due</h2>
            {dementiaPatients.length > 0 ? (
              <div className="space-y-4">
                {dementiaPatients.map((patient) => (
                  <div key={patient.patient_id} className="p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-bold text-lg">{patient.patient_name}</div>
                        <div className="text-sm text-gray-600">
                          Last assessment: {new Date(patient.last_assessment_date).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-600">
                          Stage: <span className="font-semibold">{patient.dementia_stage}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-red-600 font-bold">{patient.days_overdue} days overdue</div>
                        <button className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                          Schedule Assessment
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">All patients up to date with assessments</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'parkinsons' && (
        <div className="space-y-6">
          {/* Parkinson's Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-indigo-600">
              <div className="text-gray-600 text-sm mb-1">PD Patients</div>
              <div className="text-3xl font-bold">{parkinsonsMetrics?.totalPatients || 0}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-600">
              <div className="text-gray-600 text-sm mb-1">On DBS</div>
              <div className="text-3xl font-bold">{parkinsonsMetrics?.patientsOnDBS || 0}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-600">
              <div className="text-gray-600 text-sm mb-1">Avg UPDRS Score</div>
              <div className="text-3xl font-bold">{parkinsonsMetrics?.averageUPDRSScore || '--'}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-600">
              <div className="text-gray-600 text-sm mb-1">High Risk (H&Y 3+)</div>
              <div className="text-3xl font-bold">{parkinsonsMetrics?.highRiskPatients || 0}</div>
            </div>
          </div>

          {/* Parkinson's Patient List */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Parkinson's Patients</h2>
              <button className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
                + Enroll Patient
              </button>
            </div>
            {parkinsonsPatients.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        H&Y Stage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Last UPDRS
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Medications
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        DBS
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Risk
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {parkinsonsPatients.map((patient) => (
                      <tr key={patient.patient_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{patient.patient_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                            Stage {patient.hoehn_yahr_stage || '--'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-bold text-lg">{patient.last_updrs_score ?? '--'}</span>
                          {patient.last_updrs_date && (
                            <div className="text-xs text-gray-500">
                              {new Date(patient.last_updrs_date).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {patient.medication_count} active
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {patient.has_dbs ? (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Yes
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              patient.risk_level === 'high'
                                ? 'bg-red-100 text-red-800'
                                : patient.risk_level === 'moderate'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {patient.risk_level}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button className="text-blue-600 hover:text-blue-900 font-medium mr-3">
                            View
                          </button>
                          <button className="text-indigo-600 hover:text-indigo-900 font-medium">
                            UPDRS
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No Parkinson's patients enrolled</p>
                <p className="text-gray-400 text-sm mt-2">
                  Click &quot;Enroll Patient&quot; to add patients to the PD tracking program
                </p>
              </div>
            )}
          </div>

          {/* ROBERT & FORBES Framework Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-indigo-800 mb-3">ROBERT Framework</h3>
              <ul className="text-sm space-y-2 text-gray-700">
                <li><span className="font-bold text-indigo-600">R</span>hythm & Movement Monitoring</li>
                <li><span className="font-bold text-indigo-600">O</span>ptimization of Medication</li>
                <li><span className="font-bold text-indigo-600">B</span>radykinesia & Rigidity Tracking</li>
                <li><span className="font-bold text-indigo-600">E</span>xercise & Physical Therapy</li>
                <li><span className="font-bold text-indigo-600">R</span>eal-time Wearable Monitoring</li>
                <li><span className="font-bold text-indigo-600">T</span>herapeutic Interventions</li>
              </ul>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-blue-800 mb-3">FORBES Framework</h3>
              <ul className="text-sm space-y-2 text-gray-700">
                <li><span className="font-bold text-blue-600">F</span>unctional Assessment (Freezing, Falls)</li>
                <li><span className="font-bold text-blue-600">O</span>ngoing Clinical Monitoring</li>
                <li><span className="font-bold text-blue-600">R</span>ehabilitation (LSVT BIG/LOUD)</li>
                <li><span className="font-bold text-blue-600">B</span>ehavioral & Cognitive Screening</li>
                <li><span className="font-bold text-blue-600">E</span>ducation & Caregiver Support</li>
                <li><span className="font-bold text-blue-600">S</span>peech & Swallowing Evaluation</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Patient Alerts</h2>
            {recentAlerts.length > 0 ? (
              <div className="space-y-3">
                {recentAlerts.map((alert, index) => (
                  <div
                    key={index}
                    className={`p-4 border-l-4 rounded ${getAlertColor(alert.severity)}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold">{alert.patientName}</div>
                        <div className="text-sm">{alert.message}</div>
                        <div className="text-xs mt-1">
                          {alert.alertType.replace('_', ' ')} · {new Date(alert.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <button className="text-sm bg-white px-3 py-1 rounded shadow hover:shadow-md">
                        Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-lg">No active alerts</p>
                <p className="text-gray-400 text-sm mt-2">All patients stable</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'wearables' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Wearable Device Monitoring</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 bg-blue-50 rounded-lg">
                <div className="text-3xl mb-2">📱</div>
                <div className="text-2xl font-bold">--</div>
                <div className="text-sm text-gray-600">Patients with Wearables</div>
              </div>
              <div className="p-6 bg-red-50 rounded-lg">
                <div className="text-3xl mb-2">🚨</div>
                <div className="text-2xl font-bold">--</div>
                <div className="text-sm text-gray-600">Fall Alerts (24h)</div>
              </div>
              <div className="p-6 bg-yellow-50 rounded-lg">
                <div className="text-3xl mb-2">⚠️</div>
                <div className="text-2xl font-bold">--</div>
                <div className="text-sm text-gray-600">Vital Sign Alerts (24h)</div>
              </div>
            </div>
            <div className="mt-6 text-center text-gray-500">
              <p>Wearable monitoring data will appear here</p>
              <p className="text-sm mt-2">Patients must connect their devices from their patient dashboard</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <button className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-4 text-center transition">
            <div className="text-2xl mb-2">📝</div>
            <div className="font-semibold">New Stroke Assessment</div>
          </button>
          <button className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-4 text-center transition">
            <div className="text-2xl mb-2">🧠</div>
            <div className="font-semibold">Cognitive Screening</div>
          </button>
          <button className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-4 text-center transition">
            <div className="text-2xl mb-2">👨‍👩‍👧</div>
            <div className="font-semibold">Caregiver Assessment</div>
          </button>
          <button
            onClick={() => setActiveTab('parkinsons')}
            className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-4 text-center transition"
          >
            <div className="text-2xl mb-2">🤲</div>
            <div className="font-semibold">Parkinson&apos;s UPDRS</div>
          </button>
          <button className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-4 text-center transition">
            <div className="text-2xl mb-2">📊</div>
            <div className="font-semibold">Quality Reports</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NeuroSuiteDashboard;
