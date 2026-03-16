/**
 * MCPServerHealthPanel - Real-time health monitoring for all 11 MCP servers
 *
 * Purpose: Admin dashboard panel showing health status, response times,
 *          and dependencies for every MCP server in the system.
 * Used by: IntelligentAdminPanel (System Administration category)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EABadge } from '../envision-atlus/EABadge';
import { EAAlert } from '../envision-atlus/EAAlert';
import { EAButton } from '../envision-atlus/EAButton';
import {
  checkAllServersHealth,
  type MCPHealthSummary,
  type MCPServerStatus,
  type MCPServerTier,
  type MCPServerHealthStatus,
} from '../../services/mcpHealthService';

const INITIAL_POLL_INTERVAL = 60000;
const MAX_POLL_INTERVAL = 300000;
const MAX_CONSECUTIVE_ERRORS = 5;

const TIER_LABELS: Record<MCPServerTier, string> = {
  admin: 'Admin',
  user_scoped: 'User Scoped',
  external_api: 'External API',
};

const TIER_BADGE_VARIANT: Record<MCPServerTier, 'high' | 'elevated' | 'info'> = {
  admin: 'high',
  user_scoped: 'elevated',
  external_api: 'info',
};

const STATUS_BADGE_VARIANT: Record<MCPServerHealthStatus, 'normal' | 'elevated' | 'critical'> = {
  healthy: 'normal',
  degraded: 'elevated',
  down: 'critical',
};

const STATUS_LABELS: Record<MCPServerHealthStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return 'N/A';
  }
}

function ServerCard({ server }: { server: MCPServerStatus }) {
  return (
    <div
      className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3"
      data-testid={`server-card-${server.server.name}`}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">
          {server.server.displayName}
        </h4>
        <EABadge
          variant={STATUS_BADGE_VARIANT[server.status]}
          size="sm"
          pulse={server.status === 'down'}
        >
          {STATUS_LABELS[server.status]}
        </EABadge>
      </div>

      <div className="flex items-center gap-2">
        <EABadge variant={TIER_BADGE_VARIANT[server.server.tier]} size="sm">
          {TIER_LABELS[server.server.tier]}
        </EABadge>
        <span className="text-xs text-slate-400">
          {server.responseTimeMs}ms
        </span>
      </div>

      {server.dependencies.length > 0 && (
        <div className="text-xs text-slate-400">
          <span className="text-slate-500">Dependencies: </span>
          {server.dependencies.join(', ')}
        </div>
      )}

      {server.error && (
        <div className="text-xs text-red-400 truncate" title={server.error}>
          {server.error}
        </div>
      )}

      <div className="text-xs text-slate-500">
        Checked: {formatTimestamp(server.lastChecked)}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6" data-testid="loading-skeleton">
      <div className="h-16 bg-slate-800/50 rounded-lg animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="h-36 bg-slate-800/50 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

const MCPServerHealthPanel: React.FC = () => {
  const [summary, setSummary] = useState<MCPHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pollingPaused, setPollingPaused] = useState(false);

  const consecutiveErrorsRef = useRef(0);
  const currentIntervalRef = useRef(INITIAL_POLL_INTERVAL);

  const loadHealthData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);

    const result = await checkAllServersHealth();

    if (result.success) {
      setSummary(result.data);
      consecutiveErrorsRef.current = 0;
      currentIntervalRef.current = INITIAL_POLL_INTERVAL;
    } else {
      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
        setPollingPaused(true);
      } else {
        currentIntervalRef.current = Math.min(
          currentIntervalRef.current * 2,
          MAX_POLL_INTERVAL
        );
      }
    }

    setLoading(false);
    if (isManual) setRefreshing(false);
  }, []);

  useEffect(() => {
    loadHealthData();

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (pollingPaused) return;
      intervalId = setInterval(() => {
        if (!pollingPaused) {
          loadHealthData();
        }
      }, currentIntervalRef.current);
    };

    startPolling();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [loadHealthData, pollingPaused]);

  const handleRefresh = () => {
    setPollingPaused(false);
    consecutiveErrorsRef.current = 0;
    currentIntervalRef.current = INITIAL_POLL_INTERVAL;
    loadHealthData(true);
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!summary) {
    return (
      <EAAlert variant="critical" title="Health Check Failed">
        Unable to retrieve MCP server health data. Check your network connection.
      </EAAlert>
    );
  }

  const overallStatus: MCPServerHealthStatus =
    summary.downCount > 0 ? 'down' :
    summary.degradedCount > 0 ? 'degraded' :
    'healthy';

  return (
    <div className="space-y-6" aria-label="MCP Server Health Monitor" aria-live="polite">
      {/* Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-300">Overall:</span>
            <EABadge
              variant={STATUS_BADGE_VARIANT[overallStatus]}
              pulse={overallStatus === 'down'}
            >
              {STATUS_LABELS[overallStatus]}
            </EABadge>
          </div>
          <div className="text-sm text-slate-400">
            <span className="text-green-400 font-medium">{summary.healthyCount}</span> healthy
            {summary.degradedCount > 0 && (
              <>{' / '}<span className="text-yellow-400 font-medium">{summary.degradedCount}</span> degraded</>
            )}
            {summary.downCount > 0 && (
              <>{' / '}<span className="text-red-400 font-medium">{summary.downCount}</span> down</>
            )}
            {' / '}{summary.totalCount} total
          </div>
        </div>

        <div className="flex items-center gap-3">
          {pollingPaused && (
            <span className="text-xs text-yellow-400">Polling paused (errors)</span>
          )}
          <EAButton
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            loading={refreshing}
            data-testid="refresh-button"
          >
            Refresh All
          </EAButton>
        </div>
      </div>

      {/* Alerts */}
      {summary.downCount > 0 && (
        <EAAlert variant="critical" title="Servers Down">
          {summary.servers
            .filter(s => s.status === 'down')
            .map(s => s.server.displayName)
            .join(', ')}{' '}
          {summary.downCount === 1 ? 'is' : 'are'} not responding.
        </EAAlert>
      )}

      {summary.degradedCount > 0 && summary.downCount === 0 && (
        <EAAlert variant="warning" title="Degraded Performance">
          {summary.servers
            .filter(s => s.status === 'degraded')
            .map(s => s.server.displayName)
            .join(', ')}{' '}
          {summary.degradedCount === 1 ? 'is' : 'are'} experiencing issues.
        </EAAlert>
      )}

      {/* Server Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.servers.map(server => (
          <ServerCard key={server.server.name} server={server} />
        ))}
      </div>

      {/* Footer */}
      <div className="text-xs text-slate-500 text-right">
        Last checked: {formatTimestamp(summary.checkedAt)}
        {' · '}Poll interval: {Math.round(currentIntervalRef.current / 1000)}s
      </div>
    </div>
  );
};

export default MCPServerHealthPanel;
