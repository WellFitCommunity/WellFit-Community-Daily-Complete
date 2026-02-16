/**
 * LDMetricsPanel - L&D unit-level KPI dashboard panel
 *
 * Purpose: Show at-a-glance metrics for the L&D unit
 *   Active pregnancies, deliveries today, active labors, unresolved alerts
 * Used by: LaborDeliveryDashboard (above tabs)
 */

import React, { useState, useEffect } from 'react';
import { LDMetricsService } from '../../services/laborDelivery';
import type { LDUnitMetrics } from '../../types/laborDelivery';

interface LDMetricsPanelProps {
  tenantId: string;
}

interface MetricCardProps {
  label: string;
  value: number;
  color: string;
  icon: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, color, icon }) => (
  <div className={`rounded-lg border p-4 ${color}`}>
    <div className="flex items-center gap-2 mb-1">
      <span className="text-lg" aria-hidden="true">{icon}</span>
      <p className="text-sm font-medium text-gray-600">{label}</p>
    </div>
    <p className="text-3xl font-bold">{value}</p>
  </div>
);

const LDMetricsPanel: React.FC<LDMetricsPanelProps> = ({ tenantId }) => {
  const [metrics, setMetrics] = useState<LDUnitMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const result = await LDMetricsService.getUnitMetrics(tenantId);
      if (!cancelled && result.success && result.data) {
        setMetrics(result.data);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [tenantId]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border p-4 animate-pulse bg-gray-50 h-20" />
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <MetricCard
        label="Active Pregnancies"
        value={metrics.active_pregnancies}
        color="bg-pink-50 border-pink-200"
        icon="🤰"
      />
      <MetricCard
        label="Deliveries Today"
        value={metrics.deliveries_today}
        color="bg-purple-50 border-purple-200"
        icon="👶"
      />
      <MetricCard
        label="Active Labors"
        value={metrics.active_labors_today}
        color="bg-blue-50 border-blue-200"
        icon="🏥"
      />
      <MetricCard
        label="Active Alerts"
        value={metrics.active_alerts}
        color={metrics.active_alerts > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}
        icon={metrics.active_alerts > 0 ? '🚨' : '✅'}
      />
    </div>
  );
};

export default LDMetricsPanel;
