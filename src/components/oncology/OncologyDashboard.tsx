/**
 * OncologyDashboard - Main cancer care dashboard
 *
 * Purpose: Comprehensive oncology patient management interface
 * Tabs: Overview, Treatment, Labs & Markers, Imaging, Survivorship
 * Used by: /cancer-care route (clinical, protected)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { OncologyService } from '../../services/oncology';
import type { OncologyDashboardSummary } from '../../types/oncology';
import { RECIST_LABELS } from '../../types/oncology';
import OncologyOverview from './OncologyOverview';
import OncologyAlerts from './OncologyAlerts';

type TabId = 'overview' | 'treatment' | 'labs' | 'imaging' | 'survivorship';

interface TabConfig {
  id: TabId;
  label: string;
}

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'treatment', label: 'Treatment' },
  { id: 'labs', label: 'Labs & Markers' },
  { id: 'imaging', label: 'Imaging' },
  { id: 'survivorship', label: 'Survivorship' },
];

/** Placeholder patient/tenant for dashboard — will come from context in production */
const DEMO_PATIENT_ID = '00000000-0000-0000-0000-000000000000';
const DEMO_TENANT_ID = '2b902657-6a20-4435-a78a-576f397517ca';

const OncologyDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [summary, setSummary] = useState<OncologyDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await OncologyService.getDashboardSummary(DEMO_PATIENT_ID, DEMO_TENANT_ID);
    if (result.success && result.data) {
      setSummary(result.data);
    } else {
      setSummary({
        registry: null,
        staging: null,
        treatment_plan: null,
        recent_chemo_sessions: [],
        recent_radiation_sessions: [],
        latest_labs: null,
        latest_imaging: null,
        active_side_effects: [],
        survivorship: null,
        alerts: [],
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
        <span className="ml-3 text-gray-600">Loading oncology data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-4" role="alert">
        <p className="text-red-800 font-medium">Failed to load oncology dashboard</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={loadDashboard}
          className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm min-h-[44px]"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cancer Care</h1>
        <p className="text-gray-600 mt-1">Comprehensive oncology management</p>
      </div>

      {/* Alerts Banner */}
      {summary && summary.alerts.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Active Alerts ({summary.alerts.length})
          </h2>
          <OncologyAlerts alerts={summary.alerts} />
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
                  ? 'border-purple-600 text-purple-600'
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
          {activeTab === 'overview' && <OncologyOverview summary={summary} />}
          {activeTab === 'treatment' && <TreatmentTab summary={summary} />}
          {activeTab === 'labs' && <LabsTab summary={summary} />}
          {activeTab === 'imaging' && <ImagingTab summary={summary} />}
          {activeTab === 'survivorship' && <SurvivorshipTab summary={summary} />}
        </div>
      )}
    </div>
  );
};

// =====================================================
// Sub-tab Components (inline — each is small)
// =====================================================

const TreatmentTab: React.FC<{ summary: OncologyDashboardSummary }> = ({ summary }) => {
  const { recent_chemo_sessions, recent_radiation_sessions } = summary;

  return (
    <div className="space-y-6">
      {/* Chemotherapy Sessions */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Chemotherapy Sessions</h3>
        {recent_chemo_sessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Cycle</th>
                  <th className="px-3 py-2 text-left">Day</th>
                  <th className="px-3 py-2 text-left">Drugs</th>
                  <th className="px-3 py-2 text-left">Modifications</th>
                </tr>
              </thead>
              <tbody>
                {recent_chemo_sessions.map((session) => (
                  <tr key={session.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{new Date(session.session_date).toLocaleDateString()}</td>
                    <td className="px-3 py-2 font-bold">C{session.cycle_number}</td>
                    <td className="px-3 py-2">D{session.day_of_cycle}</td>
                    <td className="px-3 py-2">
                      {session.drugs_administered.map(d => d.drug_name).join(', ')}
                    </td>
                    <td className="px-3 py-2">
                      {session.dose_modifications.length > 0
                        ? session.dose_modifications.join(', ')
                        : 'None'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No chemotherapy sessions recorded</p>
        )}
      </div>

      {/* Radiation Sessions */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Radiation Sessions</h3>
        {recent_radiation_sessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Fraction</th>
                  <th className="px-3 py-2 text-left">Dose (Gy)</th>
                  <th className="px-3 py-2 text-left">Cumulative</th>
                  <th className="px-3 py-2 text-left">Technique</th>
                  <th className="px-3 py-2 text-left">Site</th>
                </tr>
              </thead>
              <tbody>
                {recent_radiation_sessions.map((session) => (
                  <tr key={session.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{new Date(session.session_date).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{session.fraction_number}/{session.total_fractions}</td>
                    <td className="px-3 py-2">{session.dose_per_fraction_gy}</td>
                    <td className="px-3 py-2 font-bold">{session.cumulative_dose_gy} Gy</td>
                    <td className="px-3 py-2">{session.technique.toUpperCase()}</td>
                    <td className="px-3 py-2">{session.treatment_site}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No radiation sessions recorded</p>
        )}
      </div>
    </div>
  );
};

const LabsTab: React.FC<{ summary: OncologyDashboardSummary }> = ({ summary }) => {
  const labs = summary.latest_labs;
  if (!labs) {
    return <p className="text-gray-500 text-center py-8">No lab results recorded</p>;
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold">Lab Results</h3>
      <p className="text-xs text-gray-500">{new Date(labs.lab_date).toLocaleDateString()}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-500">WBC</p>
          <p className="text-xl font-bold">{labs.wbc ?? 'N/A'} <span className="text-sm font-normal">K</span></p>
        </div>
        <div>
          <p className="text-sm text-gray-500">ANC</p>
          <p className={`text-xl font-bold ${labs.anc !== null && labs.anc < 1500 ? 'text-red-600' : ''}`}>
            {labs.anc ?? 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Hemoglobin</p>
          <p className={`text-xl font-bold ${labs.hemoglobin !== null && labs.hemoglobin < 10 ? 'text-red-600' : ''}`}>
            {labs.hemoglobin ?? 'N/A'} <span className="text-sm font-normal">g/dL</span>
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Platelets</p>
          <p className={`text-xl font-bold ${labs.platelets !== null && labs.platelets < 100000 ? 'text-red-600' : ''}`}>
            {labs.platelets ?? 'N/A'}
          </p>
        </div>
      </div>
      {labs.tumor_marker_name && (
        <div className="mt-4 bg-purple-50 rounded p-4">
          <p className="text-sm text-gray-500">Tumor Marker: {labs.tumor_marker_name}</p>
          <p className="text-2xl font-bold text-purple-800">
            {labs.tumor_marker_value} {labs.tumor_marker_unit}
          </p>
          {labs.baseline_marker_value !== null && (
            <p className="text-xs text-gray-500">Baseline: {labs.baseline_marker_value}</p>
          )}
        </div>
      )}
    </div>
  );
};

const ImagingTab: React.FC<{ summary: OncologyDashboardSummary }> = ({ summary }) => {
  const imaging = summary.latest_imaging;
  if (!imaging) {
    return <p className="text-gray-500 text-center py-8">No imaging results recorded</p>;
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold">Latest Imaging</h3>
      <p className="text-xs text-gray-500">{new Date(imaging.imaging_date).toLocaleDateString()}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-500">Modality</p>
          <p className="text-base font-medium">{imaging.modality.toUpperCase().replace(/_/g, ' ')}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Region</p>
          <p className="text-base">{imaging.body_region}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">RECIST Response</p>
          <p className="text-base font-bold">
            {imaging.recist_response ? RECIST_LABELS[imaging.recist_response] : 'Not evaluated'}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">New Lesions</p>
          <p className={`text-base font-bold ${imaging.new_lesions ? 'text-red-600' : 'text-green-600'}`}>
            {imaging.new_lesions ? 'YES' : 'No'}
          </p>
        </div>
      </div>
      {imaging.target_lesions.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Target Lesions</h4>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-right">Current (mm)</th>
                <th className="px-3 py-2 text-right">Previous (mm)</th>
              </tr>
            </thead>
            <tbody>
              {imaging.target_lesions.map((lesion, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-3 py-2">{lesion.location}</td>
                  <td className="px-3 py-2 text-right font-bold">{lesion.diameter_mm}</td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    {lesion.previous_diameter_mm ?? 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {imaging.sum_of_diameters_mm !== null && (
            <p className="text-sm mt-2">
              Sum of diameters: <strong>{imaging.sum_of_diameters_mm} mm</strong>
              {imaging.baseline_sum_mm !== null && (
                <span className="text-gray-500"> (baseline: {imaging.baseline_sum_mm} mm)</span>
              )}
            </p>
          )}
        </div>
      )}
      {imaging.findings && (
        <div className="mt-4">
          <p className="text-sm text-gray-500">Findings</p>
          <p className="text-sm text-gray-700 mt-1">{imaging.findings}</p>
        </div>
      )}
    </div>
  );
};

const SurvivorshipTab: React.FC<{ summary: OncologyDashboardSummary }> = ({ summary }) => {
  const surv = summary.survivorship;
  if (!surv) {
    return <p className="text-gray-500 text-center py-8">No survivorship data recorded</p>;
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold">Survivorship</h3>
      <p className="text-xs text-gray-500">
        Assessment: {new Date(surv.assessment_date).toLocaleDateString()}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-500">Status</p>
          <p className="text-base font-bold text-gray-900">
            {surv.status.replace(/_/g, ' ').toUpperCase()}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Remission Date</p>
          <p className="text-base text-gray-900">
            {surv.remission_date ? new Date(surv.remission_date).toLocaleDateString() : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">QoL Score</p>
          <p className="text-2xl font-bold text-gray-900">
            {surv.quality_of_life_score !== null ? `${surv.quality_of_life_score}/100` : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Schedule</p>
          <p className="text-base text-gray-900">{surv.surveillance_schedule ?? 'Not set'}</p>
        </div>
      </div>
      {surv.late_effects.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-500 mb-1">Late Effects</p>
          <div className="flex flex-wrap gap-1">
            {surv.late_effects.map((effect) => (
              <span key={effect} className="inline-block px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs">
                {effect}
              </span>
            ))}
          </div>
        </div>
      )}
      {surv.psychosocial_concerns.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-500 mb-1">Psychosocial Concerns</p>
          <div className="flex flex-wrap gap-1">
            {surv.psychosocial_concerns.map((concern) => (
              <span key={concern} className="inline-block px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                {concern}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OncologyDashboard;
