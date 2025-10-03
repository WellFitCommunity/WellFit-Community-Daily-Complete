// Revenue Dashboard - Analytics and revenue leakage detection
// Project Atlas Pillar 3: Revenue optimization and cash flow visibility

import React, { useEffect, useState } from 'react';
import { AtlasRevenueService } from '../../services/atlasRevenueService';

interface RevenueMetrics {
  totalClaims: number;
  totalRevenue: number;
  paidRevenue: number;
  rejectedRevenue: number;
  pendingRevenue: number;
  leakageAmount: number;
  leakagePercent: number;
  byStatus: Record<string, { count: number; amount: number }>;
}

interface CodeOpportunity {
  code: string;
  type: 'upgrade' | 'missing';
  currentCode?: string;
  suggestedCode: string;
  additionalRevenue: number;
  frequency: number;
  description: string;
}

export const RevenueDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [opportunities, setOpportunities] = useState<CodeOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadDashboard();
  }, [dateRange]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [metricsData, opportunitiesData] = await Promise.all([
        AtlasRevenueService.getRevenueMetrics(dateRange.from, dateRange.to),
        AtlasRevenueService.findCodingOpportunities(dateRange.from, dateRange.to),
      ]);

      setMetrics(metricsData);
      setOpportunities(opportunitiesData);
    } catch (error) {
      console.error('Failed to load revenue dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const totalOpportunityRevenue = opportunities.reduce((sum, opp) => sum + opp.additionalRevenue, 0);

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow-xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900">📊 Revenue Dashboard - Project Atlas</h2>
        <p className="text-sm text-gray-600 mt-1">
          Real-time revenue analytics and optimization opportunities
        </p>
      </div>

      {/* Date Range Selector */}
      <div className="mb-6 flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <label className="text-sm font-medium text-gray-700">Date Range:</label>
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        />
        <span className="text-gray-500">to</span>
        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        />
        <button
          onClick={loadDashboard}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
          <p className="mt-4 text-gray-600">Loading revenue data...</p>
        </div>
      )}

      {!loading && metrics && (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Total Revenue */}
            <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg border-2 border-blue-200">
              <div className="text-sm font-medium text-blue-900 mb-1">Total Revenue</div>
              <div className="text-3xl font-bold text-blue-600">
                {formatCurrency(metrics.totalRevenue)}
              </div>
              <div className="text-xs text-blue-700 mt-1">{metrics.totalClaims} claims</div>
            </div>

            {/* Paid Revenue */}
            <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg border-2 border-green-200">
              <div className="text-sm font-medium text-green-900 mb-1">Paid</div>
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(metrics.paidRevenue)}
              </div>
              <div className="text-xs text-green-700 mt-1">
                {metrics.byStatus['paid']?.count || 0} claims
              </div>
            </div>

            {/* Pending Revenue */}
            <div className="p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl shadow-lg border-2 border-yellow-200">
              <div className="text-sm font-medium text-yellow-900 mb-1">Pending</div>
              <div className="text-3xl font-bold text-yellow-600">
                {formatCurrency(metrics.pendingRevenue)}
              </div>
              <div className="text-xs text-yellow-700 mt-1">
                {(metrics.byStatus['submitted']?.count || 0) +
                  (metrics.byStatus['generated']?.count || 0)}{' '}
                claims
              </div>
            </div>

            {/* Revenue Leakage */}
            <div className="p-6 bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-lg border-2 border-red-200">
              <div className="text-sm font-medium text-red-900 mb-1">Revenue Leakage</div>
              <div className="text-3xl font-bold text-red-600">
                {formatCurrency(metrics.leakageAmount)}
              </div>
              <div className="text-xs text-red-700 mt-1">
                {metrics.leakagePercent.toFixed(1)}% rejection rate
              </div>
            </div>
          </div>

          {/* Coding Opportunities */}
          {opportunities.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">💡 Revenue Opportunities</h3>
                <div className="px-4 py-2 bg-gradient-to-r from-green-400 to-emerald-500 rounded-lg shadow-lg">
                  <div className="text-white font-bold">
                    +{formatCurrency(totalOpportunityRevenue)} potential
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {opportunities.map((opp, idx) => (
                  <div
                    key={idx}
                    className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-3 py-1 text-sm font-bold bg-amber-600 text-white rounded-full">
                            {opp.type === 'upgrade' ? '⬆️ UPGRADE' : '➕ MISSING'}
                          </span>
                          {opp.currentCode && (
                            <>
                              <span className="text-lg font-bold text-gray-700">
                                {opp.currentCode}
                              </span>
                              <span className="text-gray-400">→</span>
                            </>
                          )}
                          <span className="text-lg font-bold text-amber-900">
                            {opp.suggestedCode}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{opp.description}</p>
                        <div className="text-xs text-gray-600">
                          Frequency: {opp.frequency} occurrences
                        </div>
                      </div>

                      <div className="text-right ml-4">
                        <div className="text-2xl font-bold text-green-600">
                          +{formatCurrency(opp.additionalRevenue)}
                        </div>
                        <div className="text-xs text-gray-500">potential revenue</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Breakdown */}
          <div className="p-6 bg-gray-50 rounded-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Claim Status Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(metrics.byStatus).map(([status, data]) => (
                <div key={status} className="p-4 bg-white rounded-lg shadow">
                  <div className="text-xs text-gray-600 uppercase mb-1">{status}</div>
                  <div className="text-xl font-bold text-gray-900">
                    {formatCurrency(data.amount)}
                  </div>
                  <div className="text-xs text-gray-500">{data.count} claims</div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Items */}
          {metrics.leakageAmount > 0 && (
            <div className="mt-6 p-6 bg-red-50 border-2 border-red-200 rounded-xl">
              <h3 className="text-lg font-bold text-red-900 mb-3">🚨 Action Required</h3>
              <p className="text-sm text-red-800 mb-4">
                You have {formatCurrency(metrics.leakageAmount)} in rejected claims. Review and
                resubmit to recover lost revenue.
              </p>
              <button className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors">
                Review Rejected Claims
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RevenueDashboard;
