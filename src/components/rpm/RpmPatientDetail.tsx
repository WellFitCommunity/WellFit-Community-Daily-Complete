/**
 * RpmPatientDetail - RPM Patient Detail View
 *
 * Displays for a single enrolled patient:
 * - Vital trend charts (reuses VitalTrendChart)
 * - Active threshold rules
 * - Alert history
 * - Monitoring time tracking with "Add Time" button
 * - Enrollment management
 *
 * Used by: RpmDashboard when a patient row is selected
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  EACard,
  EACardHeader,
  EACardContent,
} from '../envision-atlus';
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  Activity,
  Plus,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import VitalTrendChart from '../devices/VitalTrendChart';
import type { ChartDataPoint, DataSeries, ReferenceRange } from '../devices/VitalTrendChart';
import { rpmDashboardService } from '../../services/rpmDashboardService';
import { auditLogger } from '../../services/auditLogger';
import { supabase } from '../../lib/supabaseClient';
import type {
  RpmEnrollment,
  VitalAlert,
  VitalThresholdRule,
} from '../../types/rpm';

interface RpmPatientDetailProps {
  patientId: string;
  enrollmentId: string;
  onBack: () => void;
}

// ── Vital chart config ───────────────────────────────────────────────────────

const HR_SERIES: DataSeries[] = [
  { key: 'heart_rate', label: 'Heart Rate', color: '#ef4444', unit: 'bpm' },
];
const HR_REFS: ReferenceRange[] = [
  { label: 'High (100)', value: 100, color: '#f59e0b' },
  { label: 'Low (50)', value: 50, color: '#3b82f6' },
];

const BP_SERIES: DataSeries[] = [
  { key: 'systolic', label: 'Systolic', color: '#ef4444', unit: 'mmHg' },
  { key: 'diastolic', label: 'Diastolic', color: '#3b82f6', unit: 'mmHg' },
];
const BP_REFS: ReferenceRange[] = [
  { label: 'Sys High (140)', value: 140, color: '#f59e0b' },
  { label: 'Dia High (90)', value: 90, color: '#93c5fd' },
];

const SPO2_SERIES: DataSeries[] = [
  { key: 'oxygen_saturation', label: 'SpO2', color: '#3b82f6', unit: '%' },
];
const SPO2_REFS: ReferenceRange[] = [
  { label: 'Low (92%)', value: 92, color: '#ef4444' },
];

const GLUCOSE_SERIES: DataSeries[] = [
  { key: 'glucose', label: 'Glucose', color: '#8b5cf6', unit: 'mg/dL' },
];
const GLUCOSE_REFS: ReferenceRange[] = [
  { label: 'High (200)', value: 200, color: '#f59e0b' },
  { label: 'Low (70)', value: 70, color: '#ef4444' },
];

// ── Main Component ───────────────────────────────────────────────────────────

const RpmPatientDetail: React.FC<RpmPatientDetailProps> = ({
  patientId,
  enrollmentId,
  onBack,
}) => {
  const [enrollment, setEnrollment] = useState<RpmEnrollment | null>(null);
  const [alerts, setAlerts] = useState<VitalAlert[]>([]);
  const [rules, setRules] = useState<VitalThresholdRule[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTime, setAddingTime] = useState(false);
  const [timeToAdd, setTimeToAdd] = useState('');

  const loadPatientData = useCallback(async () => {
    setLoading(true);
    try {
      const [enrollResult, alertsResult, rulesResult] = await Promise.all([
        rpmDashboardService.getEnrollmentById(enrollmentId),
        rpmDashboardService.getPatientVitalAlerts(patientId, 'all'),
        rpmDashboardService.getEffectiveRules(patientId),
      ]);

      if (enrollResult.success) setEnrollment(enrollResult.data);
      if (alertsResult.success) setAlerts(alertsResult.data);
      if (rulesResult.success) setRules(rulesResult.data);

      // Fetch check-in vitals for trend charts (last 90 days)
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('heart_rate, pulse_oximeter, bp_systolic, bp_diastolic, glucose_mg_dl, timestamp')
        .eq('user_id', patientId)
        .gte('timestamp', cutoff)
        .order('timestamp', { ascending: true });

      if (checkIns) {
        const points: ChartDataPoint[] = checkIns.map((ci) => ({
          date: new Date(ci.timestamp as string).toLocaleDateString(),
          timestamp: new Date(ci.timestamp as string).getTime(),
          heart_rate: (ci.heart_rate as number) ?? 0,
          systolic: (ci.bp_systolic as number) ?? 0,
          diastolic: (ci.bp_diastolic as number) ?? 0,
          oxygen_saturation: (ci.pulse_oximeter as number) ?? 0,
          glucose: (ci.glucose_mg_dl as number) ?? 0,
        }));
        setChartData(points);
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'RPM_PATIENT_DETAIL_LOAD_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { patientId }
      );
    } finally {
      setLoading(false);
    }
  }, [patientId, enrollmentId]);

  useEffect(() => {
    loadPatientData();
  }, [loadPatientData]);

  const handleAddTime = async () => {
    const minutes = parseInt(timeToAdd, 10);
    if (isNaN(minutes) || minutes <= 0) return;

    const result = await rpmDashboardService.addMonitoringTime(enrollmentId, minutes);
    if (result.success && enrollment) {
      setEnrollment({
        ...enrollment,
        total_monitoring_minutes: result.data.total_monitoring_minutes,
      });
    }
    setTimeToAdd('');
    setAddingTime(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading patient data...</span>
      </div>
    );
  }

  const pendingAlerts = alerts.filter((a) => a.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header with Back button */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to List
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Patient: {enrollment?.patient_name || patientId.slice(0, 8)}
          </h1>
          <p className="text-sm text-gray-500">
            Enrolled: {enrollment?.enrolled_at ? new Date(enrollment.enrolled_at).toLocaleDateString() : '—'}
            {enrollment?.primary_diagnosis_code && ` · Diagnosis: ${enrollment.primary_diagnosis_code}`}
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <EACard>
          <EACardContent>
            <div className="flex items-center gap-3 p-2">
              <AlertTriangle className={`w-5 h-5 ${pendingAlerts.length > 0 ? 'text-red-500' : 'text-green-500'}`} />
              <div>
                <p className="text-sm text-gray-500">Active Alerts</p>
                <p className="text-xl font-bold">{pendingAlerts.length}</p>
              </div>
            </div>
          </EACardContent>
        </EACard>
        <EACard>
          <EACardContent>
            <div className="flex items-center gap-3 p-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Monitoring Minutes</p>
                <p className="text-xl font-bold">{enrollment?.total_monitoring_minutes || 0}</p>
              </div>
              <button
                onClick={() => setAddingTime(true)}
                className="ml-auto p-2 text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]"
                title="Add monitoring time"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {addingTime && (
              <div className="flex items-center gap-2 mt-2 px-2">
                <input
                  type="number"
                  value={timeToAdd}
                  onChange={(e) => setTimeToAdd(e.target.value)}
                  placeholder="Minutes"
                  className="w-24 px-3 py-2 text-sm border rounded-lg"
                  min="1"
                  max="480"
                />
                <button
                  onClick={handleAddTime}
                  className="px-3 py-2 text-sm text-white rounded-lg min-h-[44px]"
                  style={{ backgroundColor: '#00857a' }}
                >
                  Add
                </button>
              </div>
            )}
          </EACardContent>
        </EACard>
        <EACard>
          <EACardContent>
            <div className="flex items-center gap-3 p-2">
              <Activity className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm text-gray-500">Devices</p>
                <p className="text-sm font-medium">
                  {enrollment?.device_types?.join(', ') || 'None configured'}
                </p>
              </div>
            </div>
          </EACardContent>
        </EACard>
      </div>

      {/* Vital Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VitalTrendChart
          title="Heart Rate"
          data={chartData.filter((d) => (d.heart_rate as number) > 0)}
          series={HR_SERIES}
          referenceLines={HR_REFS}
          yAxisDomain={[30, 180]}
        />
        <VitalTrendChart
          title="Blood Pressure"
          data={chartData.filter((d) => (d.systolic as number) > 0)}
          series={BP_SERIES}
          referenceLines={BP_REFS}
          yAxisDomain={[40, 220]}
        />
        <VitalTrendChart
          title="Oxygen Saturation"
          data={chartData.filter((d) => (d.oxygen_saturation as number) > 0)}
          series={SPO2_SERIES}
          referenceLines={SPO2_REFS}
          yAxisDomain={[80, 100]}
        />
        <VitalTrendChart
          title="Blood Glucose"
          data={chartData.filter((d) => (d.glucose as number) > 0)}
          series={GLUCOSE_SERIES}
          referenceLines={GLUCOSE_REFS}
          yAxisDomain={[40, 400]}
        />
      </div>

      {/* Alert History */}
      <EACard>
        <EACardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Alert History</h2>
        </EACardHeader>
        <EACardContent>
          {alerts.length === 0 ? (
            <p className="text-center py-8 text-gray-400">No alerts recorded</p>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 20).map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    alert.status === 'pending' ? 'bg-red-50' : 'bg-gray-50'
                  }`}
                >
                  {alert.status === 'resolved' ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{alert.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(alert.triggered_at).toLocaleString()}
                      {alert.resolved_at && ` · Resolved ${new Date(alert.resolved_at).toLocaleString()}`}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${
                      alert.severity === 'critical'
                        ? 'bg-red-100 text-red-800'
                        : alert.severity === 'high'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {alert.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </EACardContent>
      </EACard>

      {/* Threshold Rules */}
      <EACard>
        <EACardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Active Threshold Rules</h2>
        </EACardHeader>
        <EACardContent>
          {rules.length === 0 ? (
            <p className="text-center py-8 text-gray-400">No threshold rules configured</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Rule</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Vital</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Threshold</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Severity</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Scope</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-900">{rule.rule_name}</td>
                      <td className="py-2 px-3 text-gray-600">{rule.vital_type}</td>
                      <td className="py-2 px-3 text-gray-600">
                        {rule.threshold_operator} {rule.threshold_value}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded ${
                            rule.severity === 'critical'
                              ? 'bg-red-100 text-red-800'
                              : rule.severity === 'high'
                                ? 'bg-orange-100 text-orange-800'
                                : rule.severity === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {rule.severity}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-500 text-xs">
                        {rule.patient_id ? 'Patient-specific' : rule.condition_code ? rule.condition_code : 'Default'}
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
  );
};

export default RpmPatientDetail;
