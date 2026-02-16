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
        medications: [],
        latest_risk_assessment: null,
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

      <LDMetricsPanel tenantId={DEMO_TENANT_ID} />

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
