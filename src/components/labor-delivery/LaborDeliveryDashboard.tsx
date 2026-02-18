/**
 * LaborDeliveryDashboard - Main L&D care dashboard
 *
 * Purpose: Comprehensive maternal-fetal management interface
 * Tabs: Pregnancy Overview, Prenatal Visits, Labor & Delivery, Newborn, Postpartum
 * Used by: /pregnancy-care route (clinical, protected)
 *
 * Patient context: Uses PatientContext for patient selection.
 * Tenant resolution: Fetches tenant_id from user profile (established pattern).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LaborDeliveryService } from '../../services/laborDelivery';
import type { LDDashboardSummary } from '../../types/laborDelivery';
import { usePatientContext } from '../../contexts/PatientContext';
import { useUser, useSupabaseClient } from '../../contexts/AuthContext';
import LDOverview from './LDOverview';
import LDAlerts from './LDAlerts';
import PrenatalTab from './PrenatalTab';
import LaborTab from './LaborTab';
import NewbornTab from './NewbornTab';
import PostpartumTab from './PostpartumTab';
import LDMetricsPanel from './LDMetricsPanel';

type TabId = 'overview' | 'prenatal' | 'labor' | 'newborn' | 'postpartum';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Pregnancy Overview' },
  { id: 'prenatal', label: 'Prenatal Visits' },
  { id: 'labor', label: 'Labor & Delivery' },
  { id: 'newborn', label: 'Newborn' },
  { id: 'postpartum', label: 'Postpartum' },
];

const LaborDeliveryDashboard: React.FC = () => {
  const { selectedPatient, hasPatient, getPatientDisplayName } = usePatientContext();
  const user = useUser();
  const supabase = useSupabaseClient();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [summary, setSummary] = useState<LDDashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Resolve tenant_id from user's profile (established pattern)
  useEffect(() => {
    const fetchTenantId = async () => {
      if (!user?.id) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();
      setTenantId((profile as { tenant_id: string } | null)?.tenant_id ?? null);
    };
    fetchTenantId();
  }, [user?.id, supabase]);

  const patientId = selectedPatient?.id ?? null;

  const loadDashboard = useCallback(async () => {
    if (!patientId || !tenantId) return;
    setLoading(true);
    const result = await LaborDeliveryService.getDashboardSummary(patientId, tenantId);
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
        medications: [],
        latest_risk_assessment: null,
        alerts: [],
      });
    }
    setLoading(false);
  }, [patientId, tenantId]);

  // Load dashboard when patient or tenant changes
  useEffect(() => {
    if (patientId && tenantId) {
      loadDashboard();
    } else {
      setSummary(null);
    }
  }, [patientId, tenantId, loadDashboard]);

  // No patient selected — prompt user to select one
  if (!hasPatient) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Pregnancy Care</h1>
          <p className="text-gray-600 mt-1">Maternal-fetal care management</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-lg text-gray-600 mb-2">No patient selected</p>
          <p className="text-sm text-gray-500">
            Select a patient from the Patient Priority Board or Patient Chart to view their pregnancy care data.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600" />
        <span className="ml-3 text-gray-600">Loading pregnancy data...</span>
      </div>
    );
  }

  const displayName = getPatientDisplayName();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pregnancy Care</h1>
        <p className="text-gray-600 mt-1">
          {displayName ? `${displayName} — Maternal-fetal care management` : 'Maternal-fetal care management'}
        </p>
      </div>

      {tenantId && <LDMetricsPanel tenantId={tenantId} />}

      {summary && summary.alerts.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Active Alerts ({summary.alerts.length})
          </h2>
          <LDAlerts alerts={summary.alerts} onAlertAction={loadDashboard} />
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
          {activeTab === 'overview' && <LDOverview summary={summary} onDataChange={loadDashboard} />}
          {activeTab === 'prenatal' && <PrenatalTab summary={summary} onDataChange={loadDashboard} />}
          {activeTab === 'labor' && <LaborTab summary={summary} onDataChange={loadDashboard} />}
          {activeTab === 'newborn' && <NewbornTab summary={summary} onDataChange={loadDashboard} />}
          {activeTab === 'postpartum' && <PostpartumTab summary={summary} onDataChange={loadDashboard} />}
        </div>
      )}
    </div>
  );
};

export default LaborDeliveryDashboard;
