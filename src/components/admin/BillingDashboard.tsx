import React from 'react';
import { useBillingProviders, useClaimMetrics, useSearchClaims } from '../../hooks/useBillingData';
import type { ClaimStatus } from '../../types/billing';

interface BillingDashboardProps {
  className?: string;
}

const BillingDashboard: React.FC<BillingDashboardProps> = ({ className = '' }) => {
  // React Query hooks - automatic caching, deduplication, and background refetching
  const { data: providers = [], isLoading: providersLoading, error: providersError, refetch: refetchProviders } = useBillingProviders();
  const { data: metricsData, isLoading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useClaimMetrics();
  const { data: recentClaims = [], isLoading: claimsLoading, error: claimsError, refetch: refetchClaims } = useSearchClaims({ limit: 10 });

  // Combine loading states
  const loading = providersLoading || metricsLoading || claimsLoading;

  // Combine error states
  const error = providersError?.message || metricsError?.message || claimsError?.message;

  // Build metrics object from React Query data
  const metrics = metricsData ? {
    totalClaims: metricsData.total,
    claimsByStatus: metricsData.byStatus,
    totalAmount: metricsData.totalAmount,
    recentClaims: recentClaims
  } : null;

  // Refresh all billing data
  const handleRefresh = () => {
    refetchProviders();
    refetchMetrics();
    refetchClaims();
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
          <div className="h-6 bg-gray-200 rounded-sm w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-sm"></div>
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
            <p className="text-red-500 text-xs mt-1">React Query will automatically retry failed requests</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Billing Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-black hover:border-2 hover:border-[#1BA39C] rounded-lg p-4 shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#6B7280]">Total Claims</p>
              <p className="text-2xl font-bold text-black">{metrics?.totalClaims || 0}</p>
            </div>
            <div className="h-12 w-12 bg-[#1BA39C] rounded-lg flex items-center justify-center shadow-md border border-black">
              <span className="text-white text-xl">📄</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-black hover:border-2 hover:border-[#1BA39C] rounded-lg p-4 shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#6B7280]">Total Revenue</p>
              <p className="text-2xl font-bold text-black">
                {formatCurrency(metrics?.totalAmount || 0)}
              </p>
            </div>
            <div className="h-12 w-12 bg-linear-to-br from-[#F4FADC] to-[#C8E63D] rounded-lg flex items-center justify-center shadow-md">
              <span className="text-black text-xl font-bold">💰</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-black hover:border-[#1BA39C] rounded-lg p-4 shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#6B7280]">Active Providers</p>
              <p className="text-2xl font-bold text-black">{providers.length}</p>
            </div>
            <div className="h-12 w-12 bg-linear-to-br from-purple-100 to-purple-400 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white text-xl">🏥</span>
            </div>
          </div>
        </div>
      </div>

      {/* Claims by Status */}
      {metrics && (
        <div className="bg-white border border-black hover:border-[#1BA39C] rounded-lg p-6 mb-6 shadow-xl transition-all">
          <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
            <span className="text-[#1BA39C]">📊</span>
            Claims by Status
          </h3>
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

      {/* Recent Claims - Enhanced Table */}
      <div className="bg-white border border-black hover:border-[#1BA39C] rounded-lg shadow-xl overflow-hidden mb-6 transition-all">
        <div className="px-6 py-4 border-b-2 border-[#E8EAED] bg-linear-to-r from-[#E0F7F6] to-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-black flex items-center gap-2">
              <span className="text-[#1BA39C]">📋</span>
              Recent Claims
            </h3>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center px-4 py-2 text-sm font-bold text-black bg-[#C8E63D] hover:bg-[#D9F05C] rounded-md transition-all shadow-md hover:shadow-lg"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {metrics?.recentClaims && metrics.recentClaims.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Claim ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metrics.recentClaims.slice(0, 10).map((claim) => (
                  <tr key={claim.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="shrink-0 h-8 w-8 flex items-center justify-center bg-blue-100 rounded-full">
                          <span className="text-blue-600 text-xs font-medium">
                            {claim.control_number ? claim.control_number.slice(0, 2) : 'CL'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            #{claim.control_number || claim.id.slice(0, 8)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {claim.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(claim.status)}`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {claim.claim_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(claim.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      {formatCurrency(claim.total_charge || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-sm text-gray-500">No claims found</p>
            <p className="text-xs text-gray-400 mt-1">Claims will appear here once created</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-black hover:border-[#1BA39C] rounded-lg p-6 shadow-xl transition-all">
          <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
            <span className="text-[#C8E63D]">⚡</span>
            Quick Actions
          </h3>
          <div className="space-y-3">
            <button className="w-full text-left px-4 py-3 bg-linear-to-r from-[#E0F7F6] to-white hover:from-[#1BA39C] hover:to-[#158A84] hover:text-white rounded-lg transition-all shadow-md hover:shadow-lg border border-black hover:border-[#C8E63D] group">
              <div className="flex items-center">
                <span className="mr-3 text-xl">➕</span>
                <div>
                  <p className="font-bold text-black group-hover:text-white">Create New Claim</p>
                  <p className="text-sm text-[#6B7280] group-hover:text-white/90">Generate a new billing claim</p>
                </div>
              </div>
            </button>

            <button className="w-full text-left px-4 py-3 bg-linear-to-r from-[#F4FADC] to-white hover:from-[#C8E63D] hover:to-[#A8C230] rounded-lg transition-all shadow-md hover:shadow-lg border border-black hover:border-[#1BA39C] group">
              <div className="flex items-center">
                <span className="mr-3 text-xl">🔄</span>
                <div>
                  <p className="font-bold text-black">Sync with Clearinghouse</p>
                  <p className="text-sm text-[#6B7280]">Update claim statuses</p>
                </div>
              </div>
            </button>

            <button className="w-full text-left px-4 py-3 bg-linear-to-r from-purple-50 to-white hover:from-purple-400 hover:to-purple-600 hover:text-white rounded-lg transition-all shadow-md hover:shadow-lg border border-black hover:border-[#1BA39C] group">
              <div className="flex items-center">
                <span className="mr-3 text-xl">📊</span>
                <div>
                  <p className="font-bold text-black group-hover:text-white">Generate Report</p>
                  <p className="text-sm text-[#6B7280] group-hover:text-white/90">Billing analytics report</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-white border border-black hover:border-[#1BA39C] rounded-lg p-6 shadow-xl transition-all">
          <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
            <span className="text-[#1BA39C]">✅</span>
            System Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-black">Billing Service</span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-linear-to-r from-[#F4FADC] to-[#C8E63D] text-black shadow-md">
                ✅ Online
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-black">X12 Generation</span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-linear-to-r from-[#E0F7F6] to-[#1BA39C] text-white shadow-md">
                ✅ Ready
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-black">Coding AI</span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-linear-to-r from-[#F4FADC] to-[#C8E63D] text-black shadow-md">
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