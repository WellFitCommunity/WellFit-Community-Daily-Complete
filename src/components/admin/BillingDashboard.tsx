import React from 'react';
import { useBillingProviders, useClaimMetrics, useSearchClaims } from '../../hooks/useBillingData';
import type { ClaimStatus } from '../../types/billing';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';
import { RefreshCw, FileText, DollarSign, Building2 } from 'lucide-react';

interface BillingDashboardProps {
  className?: string;
}

const BillingDashboard: React.FC<BillingDashboardProps> = ({ className = '' }) => {
  const { theme } = useDashboardTheme();

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

  // Semantic status colors — NOT branded (data-driven)
  const getStatusColor = (status: ClaimStatus) => {
    const colors = {
      generated: 'bg-blue-100 text-blue-800',
      pending_approval: 'bg-orange-100 text-orange-800',
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
          <span className="text-red-600 mr-2" aria-hidden="true">⚠️</span>
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
        <div className="bg-white border border-slate-200 hover:border-[var(--ea-primary,#00857a)] rounded-lg p-4 shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500">Total Claims</p>
              <p className="text-2xl font-bold text-slate-900">{metrics?.totalClaims || 0}</p>
            </div>
            <div className="h-12 w-12 bg-[var(--ea-primary,#00857a)] rounded-lg flex items-center justify-center shadow-md">
              <FileText className="h-6 w-6 text-[var(--ea-text-on-primary,#ffffff)]" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 hover:border-[var(--ea-primary,#00857a)] rounded-lg p-4 shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500">Total Revenue</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(metrics?.totalAmount || 0)}
              </p>
            </div>
            <div className="h-12 w-12 bg-[var(--ea-secondary,#FF6B35)] rounded-lg flex items-center justify-center shadow-md">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 hover:border-[var(--ea-primary,#00857a)] rounded-lg p-4 shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500">Active Providers</p>
              <p className="text-2xl font-bold text-slate-900">{providers.length}</p>
            </div>
            <div className="h-12 w-12 bg-[var(--ea-primary-hover,#006d64)] rounded-lg flex items-center justify-center shadow-md">
              <Building2 className="h-6 w-6 text-[var(--ea-text-on-primary,#ffffff)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Claims by Status */}
      {metrics && (
        <div className="bg-white border border-slate-200 hover:border-[var(--ea-primary,#00857a)]/30 rounded-lg p-6 mb-6 shadow-xl transition-all">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
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

      {/* Recent Claims Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden mb-6 transition-all">
        <div className="px-6 py-4 border-b border-slate-200 bg-[var(--ea-primary,#00857a)]/5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">
              Recent Claims
            </h3>
            <button
              onClick={handleRefresh}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all shadow-sm hover:shadow-md ${theme.buttonPrimary}`}
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Refresh
            </button>
          </div>
        </div>

        {metrics?.recentClaims && metrics.recentClaims.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200" role="table" aria-label="Recent claims">
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
                        <div className="shrink-0 h-8 w-8 flex items-center justify-center bg-[var(--ea-primary,#00857a)]/10 rounded-full">
                          <span className="text-[var(--ea-primary,#00857a)] text-xs font-medium">
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
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">No claims found</p>
            <p className="text-xs text-gray-400 mt-1">Claims will appear here once created</p>
          </div>
        )}
      </div>

      {/* Quick Actions & System Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 hover:border-[var(--ea-primary,#00857a)]/30 rounded-lg p-6 shadow-xl transition-all">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <button className="w-full text-left px-4 py-3 bg-[var(--ea-primary,#00857a)]/5 hover:bg-[var(--ea-primary,#00857a)] hover:text-[var(--ea-text-on-primary,#ffffff)] rounded-lg transition-all border border-slate-200 hover:border-[var(--ea-primary,#00857a)] group">
              <div className="flex items-center">
                <span className="mr-3 text-xl" aria-hidden="true">➕</span>
                <div>
                  <p className="font-bold text-slate-900 group-hover:text-[var(--ea-text-on-primary,#ffffff)]">Create New Claim</p>
                  <p className="text-sm text-slate-500 group-hover:text-[var(--ea-text-on-primary,#ffffff)]/80">Generate a new billing claim</p>
                </div>
              </div>
            </button>

            <button className="w-full text-left px-4 py-3 bg-[var(--ea-secondary,#FF6B35)]/5 hover:bg-[var(--ea-secondary,#FF6B35)] hover:text-white rounded-lg transition-all border border-slate-200 hover:border-[var(--ea-secondary,#FF6B35)] group">
              <div className="flex items-center">
                <span className="mr-3 text-xl" aria-hidden="true">🔄</span>
                <div>
                  <p className="font-bold text-slate-900 group-hover:text-white">Sync with Clearinghouse</p>
                  <p className="text-sm text-slate-500 group-hover:text-white/80">Update claim statuses</p>
                </div>
              </div>
            </button>

            <button className="w-full text-left px-4 py-3 bg-[var(--ea-primary-hover,#006d64)]/5 hover:bg-[var(--ea-primary-hover,#006d64)] hover:text-[var(--ea-text-on-primary,#ffffff)] rounded-lg transition-all border border-slate-200 hover:border-[var(--ea-primary-hover,#006d64)] group">
              <div className="flex items-center">
                <span className="mr-3 text-xl" aria-hidden="true">📊</span>
                <div>
                  <p className="font-bold text-slate-900 group-hover:text-[var(--ea-text-on-primary,#ffffff)]">Generate Report</p>
                  <p className="text-sm text-slate-500 group-hover:text-[var(--ea-text-on-primary,#ffffff)]/80">Billing analytics report</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 hover:border-[var(--ea-primary,#00857a)]/30 rounded-lg p-6 shadow-xl transition-all">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            System Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Billing Service</span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Online
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">X12 Generation</span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Ready
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Coding AI</span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingDashboard;
