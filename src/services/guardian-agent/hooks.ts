/**
 * React hooks for Guardian Agent integration
 */

import { useState, useEffect, useCallback } from 'react';
import { getGuardianAgent } from './GuardianAgent';
import { AgentState, DetectedIssue } from './types';

/**
 * Hook to access Guardian Agent state and controls
 */
export function useGuardianAgent() {
  const [state, setState] = useState<AgentState | null>(null);
  const [statistics, setStatistics] = useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = useState<{ status: 'healthy' | 'degraded' | 'critical'; details: Record<string, unknown> } | null>(null);

  const agent = getGuardianAgent();

  const refresh = useCallback(() => {
    setState(agent.getState());
    setStatistics(agent.getStatistics());
    setHealth(agent.getHealth());
  }, [agent]);

  useEffect(() => {
    refresh();

    // Auto-refresh every 2 seconds
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  const reportIssue = useCallback(
    async (error: Error, context?: Record<string, unknown>) => {
      await agent.reportIssue(error, context);
      refresh();
    },
    [agent, refresh]
  );

  const forceHeal = useCallback(
    async (issueId: string) => {
      const result = await agent.forceHeal(issueId);
      refresh();
      return result;
    },
    [agent, refresh]
  );

  const updateConfig = useCallback(
    (config: Record<string, unknown>) => {
      agent.updateConfig(config);
      refresh();
    },
    [agent, refresh]
  );

  return {
    state,
    statistics,
    health,
    reportIssue,
    forceHeal,
    updateConfig,
    refresh
  };
}

/**
 * Hook to monitor for specific issue types
 */
export function useIssueMonitor(callback: (issue: DetectedIssue) => void, filter?: {
  severity?: string[];
  category?: string[];
}) {
  const { state } = useGuardianAgent();

  useEffect(() => {
    if (!state) return;

    for (const issue of state.activeIssues) {
      // Apply filters
      if (filter?.severity && !filter.severity.includes(issue.severity)) continue;
      if (filter?.category && !filter.category.includes(issue.signature.category)) continue;

      callback(issue);
    }
  }, [state, callback, filter]);
}

/**
 * Hook to get real-time agent health status
 */
export function useAgentHealth() {
  const { health } = useGuardianAgent();
  return health;
}

/**
 * Hook to access agent statistics
 */
export function useAgentStatistics() {
  const { statistics } = useGuardianAgent();
  return statistics;
}
