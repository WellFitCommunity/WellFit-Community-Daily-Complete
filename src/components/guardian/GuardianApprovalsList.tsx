/**
 * Guardian Approvals List
 *
 * Dashboard view showing all pending Guardian Agent pool reports.
 * Provides quick overview and navigation to detailed review forms.
 *
 * Features:
 * - Real-time updates via Supabase Realtime
 * - Filter by status, severity, strategy
 * - Quick stats overview
 * - Navigate to detailed review form
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { getGuardianApprovalService } from '../../services/guardianApprovalService';
import {
  GuardianReviewTicket,
  TicketStats,
  TicketFilters,
  TICKET_STATUS_CONFIG,
  HEALING_STRATEGY_CONFIG,
  TicketStatus,
} from '../../types/guardianApproval';
import { SeverityLevel } from '../../services/guardian-agent/types';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { EABadge } from '../envision-atlus/EABadge';

// ============================================================================
// Stats Card Component
// ============================================================================

interface StatsCardProps {
  label: string;
  value: number;
  icon: string;
  color: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ label, value, icon, color }) => (
  <div className={`bg-slate-800 rounded-lg p-4 border-l-4 ${color}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-slate-400 text-sm">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
      <span className="text-2xl">{icon}</span>
    </div>
  </div>
);

// ============================================================================
// Ticket Row Component
// ============================================================================

interface TicketRowProps {
  ticket: GuardianReviewTicket;
  onClick: () => void;
}

const TicketRow: React.FC<TicketRowProps> = ({ ticket, onClick }) => {
  const statusConfig = TICKET_STATUS_CONFIG[ticket.status];
  const strategyConfig = HEALING_STRATEGY_CONFIG[ticket.healing_strategy];
  const timeSince = getTimeSince(new Date(ticket.created_at));

  return (
    <tr
      onClick={onClick}
      className="hover:bg-slate-800 cursor-pointer transition-colors border-b border-slate-800"
    >
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <EABadge
            variant={
              ticket.issue_severity === 'critical' ? 'critical' :
              ticket.issue_severity === 'high' ? 'high' :
              ticket.issue_severity === 'medium' ? 'medium' : 'low'
            }
          >
            {ticket.issue_severity.toUpperCase()}
          </EABadge>
        </div>
      </td>
      <td className="py-4 px-4">
        <div>
          <p className="text-white font-medium">{ticket.issue_category}</p>
          <p className="text-sm text-slate-400 truncate max-w-xs">
            {ticket.issue_description || 'No description'}
          </p>
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${
            strategyConfig?.risk === 'high' ? 'bg-red-500/20 text-red-400' :
            strategyConfig?.risk === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-green-500/20 text-green-400'
          }`}>
            {strategyConfig?.label || ticket.healing_strategy}
          </span>
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-1">
          {ticket.sandbox_tested ? (
            ticket.sandbox_passed ? (
              <span className="text-green-400 text-sm">Passed</span>
            ) : (
              <span className="text-red-400 text-sm">Failed</span>
            )
          ) : (
            <span className="text-slate-500 text-sm">Not tested</span>
          )}
        </div>
      </td>
      <td className="py-4 px-4">
        <span className={`${statusConfig.bgColor} ${statusConfig.color} px-2 py-1 rounded text-xs`}>
          {statusConfig.icon} {statusConfig.label}
        </span>
      </td>
      <td className="py-4 px-4 text-slate-400 text-sm">
        {timeSince}
      </td>
      <td className="py-4 px-4">
        <EAButton variant="secondary" size="sm">
          Review
        </EAButton>
      </td>
    </tr>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

function getTimeSince(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ============================================================================
// Main Component
// ============================================================================

export const GuardianApprovalsList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const supabase = useSupabaseClient();
  const service = getGuardianApprovalService(supabase);

  // State
  const [tickets, setTickets] = useState<GuardianReviewTicket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TicketFilters>({
    status: ['pending', 'in_review'],
  });

  // Success message from navigation
  const successMessage = (location.state as { message?: string })?.message;

  // Load tickets and stats
  const loadData = useCallback(async () => {
    setLoading(true);

    const [ticketsResult, statsResult] = await Promise.all([
      service.getTickets(filters),
      service.getTicketStats(),
    ]);

    if (ticketsResult.success && ticketsResult.data) {
      setTickets(ticketsResult.data);
    }

    if (statsResult.success && statsResult.data) {
      setStats(statsResult.data);
    }

    setLoading(false);
  }, [service, filters]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time subscription
  useEffect(() => {
    service.subscribeToTickets(
      (newTicket) => {
        setTickets((prev) => [newTicket, ...prev]);
        loadData(); // Refresh stats
      },
      (updatedTicket) => {
        setTickets((prev) =>
          prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t))
        );
        loadData(); // Refresh stats
      }
    );

    return () => {
      service.unsubscribeFromTickets();
    };
  }, [service, loadData]);

  // Filter handlers
  const handleStatusFilter = (status: TicketStatus) => {
    setFilters((prev) => {
      const currentStatuses = prev.status || [];
      if (currentStatuses.includes(status)) {
        return { ...prev, status: currentStatuses.filter((s) => s !== status) };
      } else {
        return { ...prev, status: [...currentStatuses, status] };
      }
    });
  };

  const handleSeverityFilter = (severity: SeverityLevel) => {
    setFilters((prev) => {
      const currentSeverities = prev.severity || [];
      if (currentSeverities.includes(severity)) {
        return { ...prev, severity: currentSeverities.filter((s) => s !== severity) };
      } else {
        return { ...prev, severity: [...currentSeverities, severity] };
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Guardian Approvals</h1>
            <p className="text-slate-400">
              Review and approve Guardian Agent healing actions
            </p>
          </div>
          <EAButton onClick={loadData} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </EAButton>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 text-green-300">
            {successMessage}
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatsCard
              label="Pending"
              value={stats.pending_count}
              icon="⏳"
              color="border-yellow-500"
            />
            <StatsCard
              label="In Review"
              value={stats.in_review_count}
              icon="👀"
              color="border-blue-500"
            />
            <StatsCard
              label="Approved Today"
              value={stats.approved_today}
              icon="✅"
              color="border-green-500"
            />
            <StatsCard
              label="Rejected Today"
              value={stats.rejected_today}
              icon="❌"
              color="border-red-500"
            />
            <StatsCard
              label="Applied Today"
              value={stats.applied_today}
              icon="🚀"
              color="border-teal-500"
            />
            <StatsCard
              label="Failed Today"
              value={stats.failed_today}
              icon="💥"
              color="border-orange-500"
            />
          </div>
        )}

        {/* Filters */}
        <EACard>
          <EACardContent>
            <div className="flex flex-wrap gap-4">
              {/* Status Filters */}
              <div>
                <label className="text-xs text-slate-400 uppercase block mb-2">Status</label>
                <div className="flex gap-2">
                  {(['pending', 'in_review', 'approved', 'rejected', 'applied', 'failed'] as TicketStatus[]).map((status) => {
                    const config = TICKET_STATUS_CONFIG[status];
                    const isActive = filters.status?.includes(status);
                    return (
                      <button
                        key={status}
                        onClick={() => handleStatusFilter(status)}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          isActive
                            ? `${config.bgColor} ${config.color}`
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {config.icon} {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Severity Filters */}
              <div>
                <label className="text-xs text-slate-400 uppercase block mb-2">Severity</label>
                <div className="flex gap-2">
                  {(['critical', 'high', 'medium', 'low'] as SeverityLevel[]).map((severity) => {
                    const isActive = filters.severity?.includes(severity);
                    const colorMap: Record<SeverityLevel, string> = {
                      critical: 'bg-red-500/20 text-red-400',
                      high: 'bg-orange-500/20 text-orange-400',
                      medium: 'bg-yellow-500/20 text-yellow-400',
                      low: 'bg-green-500/20 text-green-400',
                      info: 'bg-blue-500/20 text-blue-400',
                    };
                    return (
                      <button
                        key={severity}
                        onClick={() => handleSeverityFilter(severity)}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          isActive
                            ? colorMap[severity]
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {severity.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </EACardContent>
        </EACard>

        {/* Tickets Table */}
        <EACard>
          <EACardHeader>
            <h2 className="text-lg font-semibold text-white">
              Review Tickets ({tickets.length})
            </h2>
          </EACardHeader>
          <EACardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl mb-4 block">🎉</span>
                <p className="text-slate-400">No tickets matching your filters</p>
                <p className="text-slate-500 text-sm mt-1">
                  All caught up! Guardian is keeping things running smoothly.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-xs text-slate-400 uppercase">
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4">Issue</th>
                      <th className="py-3 px-4">Strategy</th>
                      <th className="py-3 px-4">Sandbox</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created</th>
                      <th className="py-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <TicketRow
                        key={ticket.id}
                        ticket={ticket}
                        onClick={() => navigate(`/guardian/approval/${ticket.id}`)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </EACardContent>
        </EACard>
      </div>
    </div>
  );
};

export default GuardianApprovalsList;
