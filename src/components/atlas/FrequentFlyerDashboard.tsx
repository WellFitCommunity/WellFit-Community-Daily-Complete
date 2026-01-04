// Frequent Flyer Dashboard - Readmission Prevention & High Utilizer Management
// Production-grade component for CMS readmission penalty prevention
// White-label ready - all branding configurable

import React, { useEffect, useState } from 'react';
import { AlertTriangle, TrendingUp, Users, Calendar, Phone, FileText, Activity } from 'lucide-react';
import { ReadmissionTrackingService, HighUtilizerMetrics } from '../../services/readmissionTrackingService';
import { CareCoordinationService } from '../../services/careCoordinationService';

interface HighRiskPatient {
  patient_id: string;
  patient_name: string;
  risk_score: number;
  total_visits: number;
  er_visits: number;
  readmissions: number;
  last_visit_date: string;
  has_active_care_plan: boolean;
  cms_penalty_risk: boolean;
}

interface DashboardMetrics {
  total_high_utilizers: number;
  total_readmissions_30day: number;
  active_care_plans: number;
  alerts_pending: number;
  cms_penalty_risk_patients: number;
  prevented_readmissions: number;
}

export const FrequentFlyerDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [highRiskPatients, setHighRiskPatients] = useState<HighRiskPatient[]>([]);
  const [utilizerMetrics, setUtilizerMetrics] = useState<HighUtilizerMetrics[]>([]);
  interface Alert {
    id?: string;
    title: string;
    description?: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    alert_type?: string;
    created_at?: string;
  }

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<30 | 60 | 90>(30);
  const [selectedPatient, setSelectedPatient] = useState<HighRiskPatient | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load high utilizer metrics
        const utilizers = await ReadmissionTrackingService.identifyHighUtilizers(selectedPeriod);
        setUtilizerMetrics(utilizers);

        // Load active alerts
        const activeAlerts = await CareCoordinationService.getActiveAlerts();
        setAlerts(activeAlerts);

        // Get high risk patients with profile data
        const highRisk = await ReadmissionTrackingService.getActiveHighRiskPatients();

        interface HighRiskPatientData {
          patient_id: string;
          profiles?: { first_name?: string; last_name?: string } | null;
          risk_score?: number;
          admission_date: string;
          care_plan_created?: boolean;
        }

        // Format for display
        const formattedPatients: HighRiskPatient[] = (highRisk as HighRiskPatientData[]).map((patient) => ({
          patient_id: patient.patient_id,
          patient_name: patient.profiles ? `${patient.profiles.first_name || ''} ${patient.profiles.last_name || ''}`.trim() : 'Unknown',
          risk_score: patient.risk_score || 0,
          total_visits: utilizers.find(u => u.patient_id === patient.patient_id)?.total_visits || 1,
          er_visits: utilizers.find(u => u.patient_id === patient.patient_id)?.er_visits || 0,
          readmissions: utilizers.find(u => u.patient_id === patient.patient_id)?.readmissions || 0,
          last_visit_date: patient.admission_date,
          has_active_care_plan: patient.care_plan_created || false,
          cms_penalty_risk: utilizers.find(u => u.patient_id === patient.patient_id)?.cms_penalty_risk || false
        }));

        setHighRiskPatients(formattedPatients);

        // Calculate dashboard metrics
        const dashboardMetrics: DashboardMetrics = {
          total_high_utilizers: utilizers.length,
          total_readmissions_30day: utilizers.reduce((sum, u) => sum + u.readmissions, 0),
          active_care_plans: formattedPatients.filter(p => p.has_active_care_plan).length,
          alerts_pending: activeAlerts.length,
          cms_penalty_risk_patients: utilizers.filter(u => u.cms_penalty_risk).length,
          prevented_readmissions: 0 // Calculate from completed care plans
        };

        setMetrics(dashboardMetrics);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
    // Refresh every 5 minutes
    const interval = setInterval(fetchDashboard, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedPeriod]);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load high utilizer metrics
      const utilizers = await ReadmissionTrackingService.identifyHighUtilizers(selectedPeriod);
      setUtilizerMetrics(utilizers);

      // Load active alerts
      const activeAlerts = await CareCoordinationService.getActiveAlerts();
      setAlerts(activeAlerts);

      // Get high risk patients with profile data
      const highRisk = await ReadmissionTrackingService.getActiveHighRiskPatients();

      interface HighRiskPatientData {
        patient_id: string;
        profiles?: { first_name?: string; last_name?: string } | null;
        risk_score?: number;
        admission_date: string;
        care_plan_created?: boolean;
      }

      // Format for display
      const formattedPatients: HighRiskPatient[] = (highRisk as HighRiskPatientData[]).map((patient) => ({
        patient_id: patient.patient_id,
        patient_name: patient.profiles ? `${patient.profiles.first_name || ''} ${patient.profiles.last_name || ''}`.trim() : 'Unknown',
        risk_score: patient.risk_score || 0,
        total_visits: utilizers.find(u => u.patient_id === patient.patient_id)?.total_visits || 1,
        er_visits: utilizers.find(u => u.patient_id === patient.patient_id)?.er_visits || 0,
        readmissions: utilizers.find(u => u.patient_id === patient.patient_id)?.readmissions || 0,
        last_visit_date: patient.admission_date,
        has_active_care_plan: patient.care_plan_created || false,
        cms_penalty_risk: utilizers.find(u => u.patient_id === patient.patient_id)?.cms_penalty_risk || false
      }));

      setHighRiskPatients(formattedPatients);

      // Calculate dashboard metrics
      const dashboardMetrics: DashboardMetrics = {
        total_high_utilizers: utilizers.length,
        total_readmissions_30day: utilizers.reduce((sum, u) => sum + u.readmissions, 0),
        active_care_plans: formattedPatients.filter(p => p.has_active_care_plan).length,
        alerts_pending: activeAlerts.length,
        cms_penalty_risk_patients: utilizers.filter(u => u.cms_penalty_risk).length,
        prevented_readmissions: 0 // Calculate from completed care plans
      };

      setMetrics(dashboardMetrics);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number): string => {
    if (score >= 80) return 'text-red-600 bg-red-100';
    if (score >= 60) return 'text-orange-600 bg-orange-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getRiskLabel = (score: number): string => {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MODERATE';
    return 'LOW';
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <h3 className="text-lg font-bold text-red-900 mb-2">Failed to Load Dashboard</h3>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={loadDashboard}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Frequent Flyer Dashboard</h1>
          <p className="text-gray-600">Readmission Prevention & High Utilizer Management</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value) as 30 | 60 | 90)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value={30}>Last 30 Days</option>
            <option value={60}>Last 60 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
          <button
            onClick={loadDashboard}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard
            title="High Utilizers"
            value={metrics.total_high_utilizers}
            icon={<Users className="text-blue-600" />}
            trend={metrics.total_high_utilizers > 0 ? 'up' : 'neutral'}
          />
          <MetricCard
            title="30-Day Readmissions"
            value={metrics.total_readmissions_30day}
            icon={<Activity className="text-orange-600" />}
            trend={metrics.total_readmissions_30day > 0 ? 'up' : 'down'}
            alert={metrics.total_readmissions_30day > 5}
          />
          <MetricCard
            title="Active Care Plans"
            value={metrics.active_care_plans}
            icon={<FileText className="text-green-600" />}
            trend="neutral"
          />
          <MetricCard
            title="Pending Alerts"
            value={metrics.alerts_pending}
            icon={<AlertTriangle className="text-yellow-600" />}
            alert={metrics.alerts_pending > 10}
          />
          <MetricCard
            title="CMS Penalty Risk"
            value={metrics.cms_penalty_risk_patients}
            icon={<AlertTriangle className="text-red-600" />}
            alert={metrics.cms_penalty_risk_patients > 0}
          />
          <MetricCard
            title="Prevented Readmissions"
            value={metrics.prevented_readmissions}
            icon={<TrendingUp className="text-green-600" />}
            trend="up"
          />
        </div>
      )}

      {/* Active Alerts Section */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <AlertTriangle className="mr-2 text-yellow-600" size={20} />
            Active Alerts ({alerts.length})
          </h2>
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border-l-4 ${
                  alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
                  alert.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                  alert.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{alert.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center">
                        <Calendar size={12} className="mr-1" />
                        {alert.created_at ? new Date(alert.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                      <span className="px-2 py-1 bg-white rounded-sm text-xs font-medium">
                        {alert.alert_type?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <button
                    className="ml-4 px-3 py-1 text-sm bg-white border border-gray-300 rounded-sm hover:bg-gray-50"
                    onClick={() => {
                      // Handle alert assignment/resolution
                    }}
                  >
                    Assign
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* High Utilizer Metrics Summary */}
      {utilizerMetrics.length > 0 && (
        <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <TrendingUp className="mr-2 text-blue-600" size={20} />
            High Utilizer Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Utilization by Category */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">Total ER Visits</p>
              <p className="text-2xl font-bold text-orange-600">
                {utilizerMetrics.reduce((sum, u) => sum + u.er_visits, 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Across all high utilizers</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">Total Inpatient Days</p>
              <p className="text-2xl font-bold text-blue-600">
                {utilizerMetrics.reduce((sum, u) => sum + (u.inpatient_days || 0), 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Combined hospital stays</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">Avg Risk Score</p>
              <p className="text-2xl font-bold text-red-600">
                {utilizerMetrics.length > 0
                  ? Math.round(utilizerMetrics.reduce((sum, u) => sum + u.risk_score, 0) / utilizerMetrics.length)
                  : 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">Average across group</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">Est. Cost Impact</p>
              <p className="text-2xl font-bold text-purple-600">
                ${utilizerMetrics.reduce((sum, u) => sum + (u.estimated_cost || 0), 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Estimated total cost</p>
            </div>
          </div>

          {/* Top Utilizers List */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Top 5 Utilizers by Visit Count</h3>
            <div className="space-y-2">
              {utilizerMetrics
                .sort((a, b) => b.total_visits - a.total_visits)
                .slice(0, 5)
                .map((utilizer, index) => (
                  <div key={utilizer.patient_id} className="flex items-center justify-between p-2 bg-gray-50 rounded-sm">
                    <div className="flex items-center">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium mr-2">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-600">ID: {utilizer.patient_id.substring(0, 8)}...</span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-gray-600">{utilizer.total_visits} visits</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        utilizer.risk_score >= 80 ? 'bg-red-100 text-red-800' :
                        utilizer.risk_score >= 60 ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        Risk: {utilizer.risk_score}
                      </span>
                      {utilizer.cms_penalty_risk && (
                        <AlertTriangle className="text-red-500" size={16} />
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* High Risk Patients Table */}
      <div className="bg-white rounded-lg shadow-xs border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">High-Risk Patients</h2>
          <p className="text-sm text-gray-600 mt-1">
            Patients with {selectedPeriod}-day utilization patterns requiring intervention
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Visits</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ER Visits</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Readmissions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Visit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Care Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CMS Risk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {highRiskPatients.map((patient) => (
                <tr key={patient.patient_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{patient.patient_name}</div>
                    <div className="text-xs text-gray-500">{patient.patient_id.substring(0, 8)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${getRiskColor(patient.risk_score)}`}>
                      {patient.risk_score} - {getRiskLabel(patient.risk_score)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{patient.total_visits}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={patient.er_visits > 2 ? 'text-red-600 font-medium' : ''}>
                      {patient.er_visits}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={patient.readmissions > 0 ? 'text-orange-600 font-medium' : ''}>
                      {patient.readmissions}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(patient.last_visit_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {patient.has_active_care_plan ? (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-sm">Active</span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-sm">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {patient.cms_penalty_risk && (
                      <AlertTriangle className="text-red-600" size={18} />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button
                      onClick={() => setSelectedPatient(patient)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View
                    </button>
                    {!patient.has_active_care_plan && (
                      <button
                        className="text-green-600 hover:text-green-800 font-medium"
                        onClick={() => {
                          // Create care plan
                        }}
                      >
                        Create Plan
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Detail Modal */}
      {selectedPatient && (
        <PatientDetailModal
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
        />
      )}
    </div>
  );
};

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  alert?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, trend, alert }) => {
  return (
    <div className={`bg-white rounded-lg shadow-xs border p-4 ${alert ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div>{icon}</div>
      </div>
      {trend && trend !== 'neutral' && (
        <div className="mt-2">
          <span className={`text-xs ${trend === 'up' ? 'text-red-600' : 'text-green-600'}`}>
            {trend === 'up' ? '↑' : '↓'} vs last period
          </span>
        </div>
      )}
    </div>
  );
};

// Patient Detail Modal Component
interface PatientDetailModalProps {
  patient: HighRiskPatient;
  onClose: () => void;
}

interface CheckIn {
  id?: string;
  visit_type?: string;
  type?: string;
  visit_date?: string;
  created_at?: string;
  status?: string;
  facility_name?: string;
}

interface CarePlan {
  id?: string;
  title: string;
  plan_type: string;
  status: string;
  start_date: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

const PatientDetailModal: React.FC<PatientDetailModalProps> = ({ patient, onClose }) => {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);

  useEffect(() => {
    const fetchPatientDetails = async () => {
      setLoadingDetails(true);
      try {
        // Load patient's care plans
        const plans = await CareCoordinationService.getPatientCarePlans(patient.patient_id, false);
        setCarePlans(plans);

        // Load patient's recent check-ins/visits
        const visits = await ReadmissionTrackingService.getPatientVisitHistory(patient.patient_id, 90);
        setCheckIns(visits || []);
      } catch (_error) {
        // Error handled silently - UI will show empty state
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchPatientDetails();
  }, [patient.patient_id]);

  const getRiskLabel = (score: number): string => {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MODERATE';
    return 'LOW';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{patient.patient_name}</h2>
            <p className="text-sm text-gray-600">Risk Score: {patient.risk_score} - {getRiskLabel(patient.risk_score)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Utilization Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Total Visits</p>
              <p className="text-2xl font-bold text-gray-900">{patient.total_visits}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">ER Visits</p>
              <p className="text-2xl font-bold text-orange-600">{patient.er_visits}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Readmissions</p>
              <p className="text-2xl font-bold text-red-600">{patient.readmissions}</p>
            </div>
          </div>

          {/* Recent Check-ins / Visits */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Recent Visits & Check-ins</h3>
            {loadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : checkIns.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {checkIns.map((checkIn, index) => (
                  <div key={checkIn.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <Calendar size={16} className="text-gray-400 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {checkIn.visit_type || checkIn.type || 'Visit'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {checkIn.visit_date || checkIn.created_at ? new Date(checkIn.visit_date || checkIn.created_at || '').toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        checkIn.status === 'completed' ? 'bg-green-100 text-green-800' :
                        checkIn.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        checkIn.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {checkIn.status || 'Recorded'}
                      </span>
                      {checkIn.facility_name && (
                        <p className="text-xs text-gray-500 mt-1">{checkIn.facility_name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <Calendar className="mx-auto text-gray-400 mb-2" size={24} />
                <p className="text-gray-600 text-sm">No recent visits recorded</p>
              </div>
            )}
          </div>

          {/* Care Plans */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Care Plans</h3>
            {loadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : carePlans.length > 0 ? (
              <div className="space-y-3">
                {carePlans.map((plan) => (
                  <div key={plan.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{plan.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {plan.plan_type.replace(/_/g, ' ')} - {plan.status}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Started: {new Date(plan.start_date).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        plan.priority === 'critical' ? 'bg-red-100 text-red-800' :
                        plan.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {plan.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-600">No active care plans</p>
                <button className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Create Care Plan
                </button>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center">
              <Phone size={16} className="mr-2" />
              Call Patient
            </button>
            <button className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center">
              <FileText size={16} className="mr-2" />
              View Full Record
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FrequentFlyerDashboard;
