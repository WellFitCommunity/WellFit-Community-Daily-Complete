/**
 * LaborDeliveryDashboard - Main L&D care dashboard
 *
 * Purpose: Comprehensive maternal-fetal management interface
 * Tabs: Pregnancy Overview, Prenatal Visits, Labor & Delivery, Newborn, Postpartum
 * Used by: /pregnancy-care route (clinical, protected)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LaborDeliveryService } from '../../services/laborDelivery';
import type { LDDashboardSummary } from '../../types/laborDelivery';
import LDOverview from './LDOverview';
import LDAlerts from './LDAlerts';

type TabId = 'overview' | 'prenatal' | 'labor' | 'newborn' | 'postpartum';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Pregnancy Overview' },
  { id: 'prenatal', label: 'Prenatal Visits' },
  { id: 'labor', label: 'Labor & Delivery' },
  { id: 'newborn', label: 'Newborn' },
  { id: 'postpartum', label: 'Postpartum' },
];

const DEMO_PATIENT_ID = '00000000-0000-0000-0000-000000000000';
const DEMO_TENANT_ID = '2b902657-6a20-4435-a78a-576f397517ca';

const LaborDeliveryDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [summary, setSummary] = useState<LDDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const result = await LaborDeliveryService.getDashboardSummary(DEMO_PATIENT_ID, DEMO_TENANT_ID);
    if (result.success && result.data) {
      setSummary(result.data);
    } else {
      setSummary({
        pregnancy: null,
        recent_prenatal_visits: [],
        labor_events: [],
        latest_fetal_monitoring: null,
        delivery_record: null,
        newborn_assessment: null,
        latest_postpartum: null,
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600" />
        <span className="ml-3 text-gray-600">Loading pregnancy data...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pregnancy Care</h1>
        <p className="text-gray-600 mt-1">Maternal-fetal care management</p>
      </div>

      {summary && summary.alerts.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Active Alerts ({summary.alerts.length})
          </h2>
          <LDAlerts alerts={summary.alerts} />
        </div>
      )}

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
                  ? 'border-pink-600 text-pink-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {summary && (
        <div role="tabpanel">
          {activeTab === 'overview' && <LDOverview summary={summary} />}
          {activeTab === 'prenatal' && <PrenatalTab summary={summary} />}
          {activeTab === 'labor' && <LaborTab summary={summary} />}
          {activeTab === 'newborn' && <NewbornTab summary={summary} />}
          {activeTab === 'postpartum' && <PostpartumTab summary={summary} />}
        </div>
      )}
    </div>
  );
};

// =====================================================
// Sub-tab Components
// =====================================================

const PrenatalTab: React.FC<{ summary: LDDashboardSummary }> = ({ summary }) => {
  const visits = summary.recent_prenatal_visits;
  if (visits.length === 0) {
    return <p className="text-gray-500 text-center py-8">No prenatal visits recorded</p>;
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">GA</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">BP</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">FHR</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Weight</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Fundal Ht</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {visits.map((v) => (
            <tr key={v.id}>
              <td className="px-4 py-3 text-sm">{new Date(v.visit_date).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-sm">{v.gestational_age_weeks}w{v.gestational_age_days}d</td>
              <td className="px-4 py-3 text-sm">{v.bp_systolic}/{v.bp_diastolic}</td>
              <td className="px-4 py-3 text-sm">{v.fetal_heart_rate ?? 'N/A'}</td>
              <td className="px-4 py-3 text-sm">{v.weight_kg} kg</td>
              <td className="px-4 py-3 text-sm">{v.fundal_height_cm ? `${v.fundal_height_cm} cm` : 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const LaborTab: React.FC<{ summary: LDDashboardSummary }> = ({ summary }) => {
  const { labor_events, latest_fetal_monitoring } = summary;

  return (
    <div className="space-y-6">
      {/* Fetal Monitoring */}
      {latest_fetal_monitoring && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Latest Fetal Monitoring</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">FHR Baseline</p>
              <p className="text-xl font-bold">{latest_fetal_monitoring.fhr_baseline} bpm</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Category</p>
              <p className={`text-xl font-bold ${
                latest_fetal_monitoring.fhr_category === 'III' ? 'text-red-600' :
                latest_fetal_monitoring.fhr_category === 'II' ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {latest_fetal_monitoring.fhr_category}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Variability</p>
              <p className="text-base font-medium">{latest_fetal_monitoring.variability}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Decelerations</p>
              <p className="text-base font-medium">{latest_fetal_monitoring.deceleration_type}</p>
            </div>
          </div>
        </div>
      )}

      {/* Labor Progress */}
      {labor_events.length > 0 ? (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Labor Progress</h3>
          <div className="space-y-2">
            {labor_events.slice(-5).map((e) => (
              <div key={e.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <p className="text-sm font-medium">{e.stage.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-500">{new Date(e.event_time).toLocaleTimeString()}</p>
                </div>
                <div className="text-right text-sm">
                  <p>{e.dilation_cm} cm | {e.effacement_percent}% | Station {e.station > 0 ? '+' : ''}{e.station}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">No labor events recorded</p>
      )}
    </div>
  );
};

const NewbornTab: React.FC<{ summary: LDDashboardSummary }> = ({ summary }) => {
  const nb = summary.newborn_assessment;
  if (!nb) {
    return <p className="text-gray-500 text-center py-8">No newborn assessment recorded</p>;
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold">Newborn Assessment</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-500">APGAR (1/5/10 min)</p>
          <p className="text-2xl font-bold">
            {nb.apgar_1_min}/{nb.apgar_5_min}
            {nb.apgar_10_min !== null ? `/${nb.apgar_10_min}` : ''}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Birth Weight</p>
          <p className="text-xl font-bold">{nb.weight_g}g</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Length</p>
          <p className="text-base font-medium">{nb.length_cm} cm</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Head Circ</p>
          <p className="text-base font-medium">{nb.head_circumference_cm} cm</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4">
        {[
          { label: 'Vitamin K', given: nb.vitamin_k_given },
          { label: 'Erythromycin', given: nb.erythromycin_given },
          { label: 'Hep B Vaccine', given: nb.hepatitis_b_vaccine },
        ].map((item) => (
          <div key={item.label} className="text-center p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className={`text-sm font-bold ${item.given ? 'text-green-600' : 'text-gray-400'}`}>
              {item.given ? 'Given' : 'Not given'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const PostpartumTab: React.FC<{ summary: LDDashboardSummary }> = ({ summary }) => {
  const pp = summary.latest_postpartum;
  if (!pp) {
    return <p className="text-gray-500 text-center py-8">No postpartum assessments recorded</p>;
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold">Postpartum Assessment</h3>
      <p className="text-xs text-gray-500">{pp.hours_postpartum} hours postpartum</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-500">BP</p>
          <p className="text-xl font-bold">{pp.bp_systolic}/{pp.bp_diastolic}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Fundus</p>
          <p className="text-base font-medium">{pp.fundal_height} / {pp.fundal_firmness}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Lochia</p>
          <p className="text-base font-medium">{pp.lochia} ({pp.lochia_amount})</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Breastfeeding</p>
          <p className="text-base font-medium">{pp.breastfeeding_status.replace(/_/g, ' ')}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
        <div>
          <p className="text-sm text-gray-500">Pain</p>
          <p className="text-base font-medium">{pp.pain_score}/10</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Emotional Status</p>
          <p className="text-base font-medium">{pp.emotional_status.replace(/_/g, ' ')}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">EPDS</p>
          <p className={`text-base font-bold ${
            pp.epds_score !== null && pp.epds_score >= 13 ? 'text-red-600' : 'text-gray-900'
          }`}>
            {pp.epds_score ?? 'Not assessed'}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Temp</p>
          <p className="text-base font-medium">{pp.temperature_c}&deg;C</p>
        </div>
      </div>
    </div>
  );
};

export default LaborDeliveryDashboard;
