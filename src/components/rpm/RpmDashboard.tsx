/**
 * RpmDashboard - Clinical Remote Patient Monitoring Dashboard
 *
 * Main orchestrator displaying:
 * - Summary cards (enrolled patients, active alerts, monitoring minutes)
 * - Patient enrollment list with latest vitals and alert counts
 * - Navigation to patient detail view
 *
 * Used by: /rpm-dashboard route (admin/nurse/physician access)
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  EACard,
  EACardHeader,
  EACardContent,
} from '../envision-atlus';
import {
  Activity,
  Users,
  AlertTriangle,
  Clock,
  ChevronRight,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { rpmDashboardService } from '../../services/rpmDashboardService';
import { auditLogger } from '../../services/auditLogger';
import type {
  RpmEnrollment,
  RpmDashboardSummary,
  AggregatedVital,
} from '../../types/rpm';
import RpmPatientDetail from './RpmPatientDetail';
import RpmEnrollmentForm from './RpmEnrollmentForm';

// ── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, color }) => (
  <EACard>
    <EACardContent>
      <div className="flex items-center gap-4 p-2">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-xl"
          style={{ backgroundColor: `${color}15` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </EACardContent>
  </EACard>
);

// ── Vital Badge ──────────────────────────────────────────────────────────────

const VitalBadge: React.FC<{ vital: AggregatedVital }> = ({ vital }) => {
  const bgColor = vital.is_abnormal ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bgColor}`}>
      {vital.latest_value} {vital.unit}
    </span>
  );
};

// ── Main Dashboard ───────────────────────────────────────────────────────────

const RpmDashboard: React.FC = () => {
  const [summary, setSummary] = useState<RpmDashboardSummary>({
    enrolled_count: 0,
    active_alerts_count: 0,
    needs_review_count: 0,
    total_monitoring_minutes: 0,
  });
  const [enrollments, setEnrollments] = useState<RpmEnrollment[]>([]);
  const [patientVitals, setPatientVitals] = useState<Record<string, AggregatedVital[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);
  const [showEnrollForm, setShowEnrollForm] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResult, enrollmentsResult] = await Promise.all([
        rpmDashboardService.getDashboardSummary(),
        rpmDashboardService.getActiveEnrollments(),
      ]);

      if (summaryResult.success) {
        setSummary(summaryResult.data);
      }

      if (enrollmentsResult.success) {
        setEnrollments(enrollmentsResult.data);

        // Fetch latest vitals for each enrolled patient (first 20)
        const vitalsMap: Record<string, AggregatedVital[]> = {};
        const toFetch = enrollmentsResult.data.slice(0, 20);
        const vitalsResults = await Promise.all(
          toFetch.map((e) => rpmDashboardService.getPatientVitals(e.patient_id))
        );

        for (let i = 0; i < toFetch.length; i++) {
          const result = vitalsResults[i];
          if (result.success) {
            vitalsMap[toFetch[i].patient_id] = result.data;
          }
        }
        setPatientVitals(vitalsMap);
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'RPM_DASHBOARD_LOAD_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        {}
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handlePatientSelect = (patientId: string, enrollmentId: string) => {
    setSelectedPatientId(patientId);
    setSelectedEnrollmentId(enrollmentId);
  };

  const handleBackToList = () => {
    setSelectedPatientId(null);
    setSelectedEnrollmentId(null);
  };

  const handleEnrollSuccess = () => {
    setShowEnrollForm(false);
    loadDashboard();
  };

  // ── Patient Detail View ──────────────────────────────────────────────────

  if (selectedPatientId && selectedEnrollmentId) {
    return (
      <RpmPatientDetail
        patientId={selectedPatientId}
        enrollmentId={selectedEnrollmentId}
        onBack={handleBackToList}
      />
    );
  }

  // ── Enrollment Form ──────────────────────────────────────────────────────

  if (showEnrollForm) {
    return (
      <RpmEnrollmentForm
        onSuccess={handleEnrollSuccess}
        onCancel={() => setShowEnrollForm(false)}
      />
    );
  }

  // ── Main List View ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Remote Patient Monitoring</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor enrolled patients&apos; vitals and manage threshold alerts
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 min-h-[44px]"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowEnrollForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg min-h-[44px]"
            style={{ backgroundColor: '#00857a' }}
          >
            <Plus className="w-4 h-4" />
            Enroll Patient
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Users className="w-6 h-6" />}
          label="Enrolled Patients"
          value={summary.enrolled_count}
          color="#00857a"
        />
        <SummaryCard
          icon={<AlertTriangle className="w-6 h-6" />}
          label="Active Alerts"
          value={summary.active_alerts_count}
          color="#dc2626"
        />
        <SummaryCard
          icon={<Activity className="w-6 h-6" />}
          label="Needs Review"
          value={summary.needs_review_count}
          color="#f59e0b"
        />
        <SummaryCard
          icon={<Clock className="w-6 h-6" />}
          label="Monitoring Minutes"
          value={summary.total_monitoring_minutes}
          color="#3b82f6"
        />
      </div>

      {/* Patient List */}
      <EACard>
        <EACardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Enrolled Patients</h2>
        </EACardHeader>
        <EACardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading patients...</span>
            </div>
          ) : enrollments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium">No patients enrolled in RPM</p>
              <p className="text-sm mt-1">Click &quot;Enroll Patient&quot; to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Patient</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Diagnosis</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Latest Vitals</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Minutes</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Devices</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500" />
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((enrollment) => {
                    const vitals = patientVitals[enrollment.patient_id] || [];
                    return (
                      <tr
                        key={enrollment.id}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handlePatientSelect(enrollment.patient_id, enrollment.id)}
                      >
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-900">
                            {enrollment.patient_name || enrollment.patient_id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              enrollment.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {enrollment.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {enrollment.primary_diagnosis_code || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {vitals.length > 0 ? (
                              vitals.slice(0, 3).map((v) => (
                                <VitalBadge key={v.vital_type} vital={v} />
                              ))
                            ) : (
                              <span className="text-gray-400 text-xs">No recent vitals</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {enrollment.total_monitoring_minutes}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {enrollment.device_types.length > 0
                            ? enrollment.device_types.join(', ')
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </EACardContent>
      </EACard>
    </div>
  );
};

export default RpmDashboard;
