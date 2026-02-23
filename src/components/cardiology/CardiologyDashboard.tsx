/**
 * CardiologyDashboard - Main cardiac care dashboard
 *
 * Purpose: Comprehensive cardiac patient management interface
 * Tabs: Overview, ECG & Tests, Heart Failure, Devices, Rehab
 * Used by: /heart-health route (clinical, protected)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CardiologyService } from '../../services/cardiology';
import type { CardiologyDashboardSummary } from '../../types/cardiology';
import CardiologyOverview from './CardiologyOverview';
import CardiologyAlerts from './CardiologyAlerts';
import CardiacRegistryForm from './CardiacRegistryForm';
import ECGResultForm from './ECGResultForm';
import EchoResultForm from './EchoResultForm';
import HeartFailureAssessmentForm from './HeartFailureAssessmentForm';
import DeviceMonitoringForm from './DeviceMonitoringForm';
import DeviceBatteryAlert from './DeviceBatteryAlert';

type TabId = 'overview' | 'ecg-tests' | 'heart-failure' | 'devices' | 'rehab';

interface TabConfig {
  id: TabId;
  label: string;
}

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'ecg-tests', label: 'ECG & Tests' },
  { id: 'heart-failure', label: 'Heart Failure' },
  { id: 'devices', label: 'Devices' },
  { id: 'rehab', label: 'Rehab' },
];

/** Placeholder patient/tenant for dashboard — will come from context in production */
const DEMO_PATIENT_ID = '00000000-0000-0000-0000-000000000000';
const DEMO_TENANT_ID = '2b902657-6a20-4435-a78a-576f397517ca';

type ActiveForm = 'registry' | 'ecg' | 'echo' | 'hf' | 'device' | null;

const CardiologyDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [summary, setSummary] = useState<CardiologyDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await CardiologyService.getDashboardSummary(DEMO_PATIENT_ID, DEMO_TENANT_ID);
    if (result.success && result.data) {
      setSummary(result.data);
    } else {
      setSummary({
        registry: null,
        latest_ecg: null,
        latest_echo: null,
        latest_stress_test: null,
        latest_hf_assessment: null,
        latest_device_check: null,
        rehab_progress: null,
        recent_arrhythmias: [],
        alerts: [],
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleFormSuccess = useCallback(() => {
    setActiveForm(null);
    loadDashboard();
  }, [loadDashboard]);

  const handleFormCancel = useCallback(() => {
    setActiveForm(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
        <span className="ml-3 text-gray-600">Loading cardiac data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-4" role="alert">
        <p className="text-red-800 font-medium">Failed to load cardiac dashboard</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={loadDashboard}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm min-h-[44px]"
        >
          Retry
        </button>
      </div>
    );
  }

  // Active form rendering (full-width, replaces tab content)
  if (activeForm) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Heart Health</h1>
          <p className="text-gray-600 mt-1">Comprehensive cardiac care management</p>
        </div>
        {activeForm === 'registry' && (
          <CardiacRegistryForm
            patientId={DEMO_PATIENT_ID}
            tenantId={DEMO_TENANT_ID}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        )}
        {activeForm === 'ecg' && summary?.registry && (
          <ECGResultForm
            patientId={DEMO_PATIENT_ID}
            tenantId={DEMO_TENANT_ID}
            registryId={summary.registry.id}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        )}
        {activeForm === 'echo' && summary?.registry && (
          <EchoResultForm
            patientId={DEMO_PATIENT_ID}
            tenantId={DEMO_TENANT_ID}
            registryId={summary.registry.id}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        )}
        {activeForm === 'hf' && summary?.registry && (
          <HeartFailureAssessmentForm
            patientId={DEMO_PATIENT_ID}
            tenantId={DEMO_TENANT_ID}
            registryId={summary.registry.id}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        )}
        {activeForm === 'device' && summary?.registry && (
          <DeviceMonitoringForm
            patientId={DEMO_PATIENT_ID}
            tenantId={DEMO_TENANT_ID}
            registryId={summary.registry.id}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        )}
      </div>
    );
  }

  const registryId = summary?.registry?.id;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header with actions */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Heart Health</h1>
          <p className="text-gray-600 mt-1">Comprehensive cardiac care management</p>
        </div>
        <div className="flex gap-2">
          {!summary?.registry && (
            <button
              onClick={() => setActiveForm('registry')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium min-h-[44px]"
            >
              Enroll Patient
            </button>
          )}
          {registryId && (
            <>
              <button
                onClick={() => setActiveForm('ecg')}
                className="px-4 py-2 bg-white border border-red-300 text-red-700 rounded-lg text-sm font-medium min-h-[44px] hover:bg-red-50"
              >
                Record ECG
              </button>
              <button
                onClick={() => setActiveForm('echo')}
                className="px-4 py-2 bg-white border border-red-300 text-red-700 rounded-lg text-sm font-medium min-h-[44px] hover:bg-red-50"
              >
                Record Echo
              </button>
              <button
                onClick={() => setActiveForm('hf')}
                className="px-4 py-2 bg-white border border-red-300 text-red-700 rounded-lg text-sm font-medium min-h-[44px] hover:bg-red-50"
              >
                HF Assessment
              </button>
              <button
                onClick={() => setActiveForm('device')}
                className="px-4 py-2 bg-white border border-red-300 text-red-700 rounded-lg text-sm font-medium min-h-[44px] hover:bg-red-50"
              >
                Device Check
              </button>
            </>
          )}
        </div>
      </div>

      {/* Alerts Banner */}
      {summary && summary.alerts.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Active Alerts ({summary.alerts.length})
          </h2>
          <CardiologyAlerts alerts={summary.alerts} />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1 -mb-px" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 min-h-[44px] transition-colors ${
                activeTab === tab.id
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {summary && (
        <div role="tabpanel">
          {activeTab === 'overview' && <CardiologyOverview summary={summary} />}
          {activeTab === 'ecg-tests' && <EcgTestsTab summary={summary} />}
          {activeTab === 'heart-failure' && <HeartFailureTab summary={summary} />}
          {activeTab === 'devices' && <DevicesTab summary={summary} />}
          {activeTab === 'rehab' && <RehabTab summary={summary} />}
        </div>
      )}
    </div>
  );
};

// =====================================================
// Sub-tab Components (inline — each is small)
// =====================================================

const EcgTestsTab: React.FC<{ summary: CardiologyDashboardSummary }> = ({ summary }) => {
  const { latest_ecg, recent_arrhythmias } = summary;

  return (
    <div className="space-y-6">
      {latest_ecg ? (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Latest ECG</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><span className="text-gray-500">Rhythm:</span> {latest_ecg.rhythm.replace(/_/g, ' ')}</div>
            <div><span className="text-gray-500">HR:</span> {latest_ecg.heart_rate} bpm</div>
            <div><span className="text-gray-500">PR:</span> {latest_ecg.pr_interval_ms ?? 'N/A'} ms</div>
            <div><span className="text-gray-500">QRS:</span> {latest_ecg.qrs_duration_ms ?? 'N/A'} ms</div>
            <div><span className="text-gray-500">QTc:</span> {latest_ecg.qtc_ms ?? 'N/A'} ms</div>
            <div><span className="text-gray-500">ST:</span> {latest_ecg.st_changes.replace(/_/g, ' ')}</div>
          </div>
          {latest_ecg.findings.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-500">Findings:</p>
              <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                {latest_ecg.findings.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">No ECG results recorded</p>
      )}

      {recent_arrhythmias.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Arrhythmia Events</h3>
          <div className="space-y-3">
            {recent_arrhythmias.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(a.event_date).toLocaleDateString()} | Detected by: {a.detected_by}
                  </p>
                </div>
                <div className="text-right">
                  {a.heart_rate_during && (
                    <p className="text-sm text-gray-900">HR: {a.heart_rate_during}</p>
                  )}
                  <p className={`text-xs ${a.hemodynamically_stable ? 'text-green-600' : 'text-red-600'}`}>
                    {a.hemodynamically_stable ? 'Stable' : 'Unstable'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const HeartFailureTab: React.FC<{ summary: CardiologyDashboardSummary }> = ({ summary }) => {
  const hf = summary.latest_hf_assessment;
  if (!hf) {
    return <p className="text-gray-500 text-center py-8">No heart failure assessments recorded</p>;
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold">Heart Failure Assessment</h3>
      <p className="text-xs text-gray-500">
        {new Date(hf.assessment_date).toLocaleDateString()}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-500">NYHA Class</p>
          <p className="text-2xl font-bold">{hf.nyha_class}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Weight</p>
          <p className="text-xl font-bold">{hf.daily_weight_kg} kg</p>
          {hf.weight_change_kg !== null && (
            <p className={`text-xs ${hf.weight_change_kg > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {hf.weight_change_kg > 0 ? '+' : ''}{hf.weight_change_kg} kg
            </p>
          )}
        </div>
        <div>
          <p className="text-sm text-gray-500">BNP</p>
          <p className="text-xl font-bold">{hf.bnp_pg_ml ?? 'N/A'} <span className="text-sm font-normal">pg/mL</span></p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Fluid Status</p>
          <p className="text-base font-medium">{hf.fluid_status}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4">
        {[
          { label: 'Edema', value: `Grade ${hf.edema_grade}` },
          { label: 'Dyspnea at rest', value: hf.dyspnea_at_rest ? 'Yes' : 'No' },
          { label: 'Orthopnea', value: hf.orthopnea ? 'Yes' : 'No' },
          { label: 'PND', value: hf.pnd ? 'Yes' : 'No' },
          { label: 'JVD', value: hf.jugular_venous_distension ? 'Yes' : 'No' },
          { label: 'S3 Gallop', value: hf.s3_gallop ? 'Yes' : 'No' },
        ].map((item) => (
          <div key={item.label} className="text-center p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className="text-sm font-medium">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const DevicesTab: React.FC<{ summary: CardiologyDashboardSummary }> = ({ summary }) => {
  const device = summary.latest_device_check;
  if (!device) {
    return <p className="text-gray-500 text-center py-8">No cardiac devices on file</p>;
  }

  return (
    <div className="space-y-4">
      {device.battery_status !== 'good' && <DeviceBatteryAlert device={device} />}
      <div className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold">Device Interrogation</h3>
      <p className="text-xs text-gray-500">
        Last checked: {new Date(device.check_date).toLocaleDateString()}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-gray-500">Device</p>
          <p className="text-base font-medium">{device.device_type.replace(/_/g, ' ').toUpperCase()}</p>
          {device.device_manufacturer && (
            <p className="text-xs text-gray-500">{device.device_manufacturer} {device.device_model}</p>
          )}
        </div>
        <div>
          <p className="text-sm text-gray-500">Battery</p>
          <p className={`text-base font-bold ${
            device.battery_status === 'good' ? 'text-green-600' :
            device.battery_status === 'elective_replacement' ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {device.battery_status.replace(/_/g, ' ')}
          </p>
          {device.battery_longevity_months && (
            <p className="text-xs text-gray-500">{device.battery_longevity_months} months remaining</p>
          )}
        </div>
        <div>
          <p className="text-sm text-gray-500">Shocks Delivered</p>
          <p className={`text-xl font-bold ${device.shocks_delivered > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {device.shocks_delivered}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-gray-50 rounded p-3">
          <p className="text-sm text-gray-500">Atrial Pacing</p>
          <p className="text-lg font-bold">{device.atrial_pacing_percent ?? 'N/A'}%</p>
        </div>
        <div className="bg-gray-50 rounded p-3">
          <p className="text-sm text-gray-500">Ventricular Pacing</p>
          <p className="text-lg font-bold">{device.ventricular_pacing_percent ?? 'N/A'}%</p>
        </div>
      </div>
    </div>
    </div>
  );
};

const RehabTab: React.FC<{ summary: CardiologyDashboardSummary }> = ({ summary }) => {
  const progress = summary.rehab_progress;
  if (!progress) {
    return <p className="text-gray-500 text-center py-8">No cardiac rehab sessions recorded</p>;
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold">Cardiac Rehabilitation</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-500">Phase</p>
          <p className="text-2xl font-bold">{progress.phase}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Sessions</p>
          <p className="text-xl font-bold">{progress.sessions_completed} / {progress.total_sessions}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Completion</p>
          <p className="text-xl font-bold">{progress.completion_percent}%</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Latest METs</p>
          <p className="text-xl font-bold">{progress.latest_mets ?? 'N/A'}</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-red-600 h-3 rounded-full transition-all"
            style={{ width: `${Math.min(progress.completion_percent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default CardiologyDashboard;
