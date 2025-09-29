import React, { useState, useEffect } from 'react';
import { BillingService } from '../../services/billingService';
import { EncounterService } from '../../services/encounterService';
import type { BillingProvider, BillingPayer, Claim, ClaimStatus } from '../../types/billing';

interface BillingMetrics {
  totalClaims: number;
  claimsByStatus: Record<ClaimStatus, number>;
  totalAmount: number;
  recentClaims: Claim[];
}

interface BillingDashboardProps {
  className?: string;
}

const BillingDashboard: React.FC<BillingDashboardProps> = ({ className = '' }) => {
  const [metrics, setMetrics] = useState<BillingMetrics | null>(null);
  const [providers, setProviders] = useState<BillingProvider[]>([]);
  const [payers, setPayers] = useState<BillingPayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsData, providersData, payersData, recentClaimsData] = await Promise.all([
        BillingService.getClaimMetrics(),
        BillingService.getProviders(),
        BillingService.getPayers(),
        BillingService.searchClaims({ limit: 10 })
      ]);

      setMetrics({
        totalClaims: metricsData.total,
        claimsByStatus: metricsData.byStatus,
        totalAmount: metricsData.totalAmount,
        recentClaims: recentClaimsData
      });
      setProviders(providersData);
      setPayers(payersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data');
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

  const getStatusColor = (status: ClaimStatus) => {
    const colors = {
      generated: 'bg-blue-100 text-blue-800',
      submitted: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      paid: 'bg-green-200 text-green-900',
      void: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} bg-red-50 border border-red-200 rounded-lg p-4`}>
        <div className="flex items-center">
          <span className="text-red-600 mr-2">⚠️</span>
          <div>
            <h3 className="text-red-800 font-medium">Billing Data Error</h3>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={loadBillingData}
              className="mt-2 text-red-700 underline text-sm hover:text-red-800"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Billing Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Claims</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.totalClaims || 0}</p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-blue-600 text-xl">📄</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(metrics?.totalAmount || 0)}
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-green-600 text-xl">💰</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Providers</p>
              <p className="text-2xl font-bold text-gray-900">{providers.length}</p>
            </div>
            <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-purple-600 text-xl">🏥</span>
            </div>
          </div>
        </div>
      </div>

      {/* Claims by Status */}
      {metrics && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Claims by Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(metrics.claimsByStatus).map(([status, count]) => (
              <div key={status} className="text-center">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status as ClaimStatus)}`}>
                  {status}
                </div>
                <p className="text-lg font-bold text-gray-900 mt-2">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Claims */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Claims</h3>
          <button
            onClick={loadBillingData}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Refresh
          </button>
        </div>

        {metrics?.recentClaims && metrics.recentClaims.length > 0 ? (
          <div className="overflow-hidden">
            <div className="space-y-3">
              {metrics.recentClaims.slice(0, 5).map((claim) => (
                <div key={claim.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(claim.status)}`}>
                          {claim.status}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          Claim #{claim.control_number || claim.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(claim.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(claim.total_charge || 0)}
                    </p>
                    <p className="text-xs text-gray-500">{claim.claim_type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <span className="text-4xl mb-2 block">📋</span>
            <p>No claims found</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
              <div className="flex items-center">
                <span className="mr-3">➕</span>
                <div>
                  <p className="font-medium text-blue-900">Create New Claim</p>
                  <p className="text-sm text-blue-600">Generate a new billing claim</p>
                </div>
              </div>
            </button>

            <button className="w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
              <div className="flex items-center">
                <span className="mr-3">🔄</span>
                <div>
                  <p className="font-medium text-green-900">Sync with Clearinghouse</p>
                  <p className="text-sm text-green-600">Update claim statuses</p>
                </div>
              </div>
            </button>

            <button className="w-full text-left px-4 py-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
              <div className="flex items-center">
                <span className="mr-3">📊</span>
                <div>
                  <p className="font-medium text-purple-900">Generate Report</p>
                  <p className="text-sm text-purple-600">Billing analytics report</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Billing Service</span>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✅ Online
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">X12 Generation</span>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✅ Ready
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Coding AI</span>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✅ Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingDashboard;