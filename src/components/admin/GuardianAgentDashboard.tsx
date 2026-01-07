/**
 * Guardian Agent Dashboard - Real-time monitoring and control
 */

import React, { useState, useEffect } from 'react';
import { getGuardianAgent } from '../../services/guardian-agent/GuardianAgent';
import { AgentState, DetectedIssue, HealingResult } from '../../services/guardian-agent/types';

export const GuardianAgentDashboard: React.FC = () => {
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const agent = getGuardianAgent();

    const updateData = () => {
      setAgentState(agent.getState());
      setStatistics(agent.getStatistics());
      setHealth(agent.getHealth());
    };

    updateData();

    if (autoRefresh) {
      const interval = setInterval(updateData, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (!agentState || !statistics || !health) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-blue-900 to-gray-900 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-5xl">🛡️</div>
            <div>
              <h1 className="text-3xl font-bold">Guardian Agent</h1>
              <p className="text-gray-400">Autonomous Self-Healing System</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <HealthBadge status={health.status} />
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Auto-refresh</span>
            </label>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Success Rate"
          value={`${statistics.agentMetrics.successRate.toFixed(1)}%`}
          icon="✅"
          trend={statistics.agentMetrics.successRate >= 90 ? 'up' : 'down'}
        />
        <MetricCard
          title="Issues Detected"
          value={statistics.agentMetrics.issuesDetected}
          icon="🔍"
          subtitle={`${statistics.agentMetrics.issuesHealed} healed`}
        />
        <MetricCard
          title="Active Issues"
          value={agentState.activeIssues.length}
          icon="⚡"
          critical={agentState.activeIssues.some(i => i.severity === 'critical')}
        />
        <MetricCard
          title="Uptime"
          value={formatUptime(statistics.uptime)}
          icon="⏱️"
          subtitle={agentState.isActive ? 'Active' : 'Inactive'}
        />
      </div>

      {/* Agent Mode and Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <StatusCard
          title="Agent Mode"
          value={agentState.mode.toUpperCase()}
          color={getModeColor(agentState.mode)}
        />
        <StatusCard
          title="Avg Time to Detect"
          value={`${statistics.agentMetrics.avgTimeToDetect.toFixed(0)}ms`}
          color="blue"
        />
        <StatusCard
          title="Avg Time to Heal"
          value={`${statistics.agentMetrics.avgTimeToHeal.toFixed(0)}ms`}
          color="green"
        />
      </div>

      {/* Active Issues */}
      <div className="mb-8">
        <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <span className="mr-2">🚨</span>
            Active Issues ({agentState.activeIssues.length})
          </h2>
          {agentState.activeIssues.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">✨</div>
              <p>No active issues - System running smoothly</p>
            </div>
          ) : (
            <div className="space-y-4">
              {agentState.activeIssues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Healing in Progress */}
      {agentState.healingInProgress.length > 0 && (
        <div className="mb-8">
          <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <span className="mr-2">🔧</span>
              Healing in Progress ({agentState.healingInProgress.length})
            </h2>
            <div className="space-y-4">
              {agentState.healingInProgress.map((action) => (
                <HealingCard key={action.id} action={action} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Healings */}
      <div className="mb-8">
        <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <span className="mr-2">📊</span>
            Recent Healings
          </h2>
          {agentState.recentHealings.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No healings yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {agentState.recentHealings.slice(-10).reverse().map((result) => (
                <HealingResultCard key={result.actionId} result={result} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Knowledge Base */}
      <div className="mb-8">
        <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <span className="mr-2">🧠</span>
            Knowledge Base ({agentState.knowledgeBase.length} patterns learned)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agentState.knowledgeBase.slice(-6).map((knowledge) => (
              <KnowledgeCard key={knowledge.id} knowledge={knowledge} />
            ))}
          </div>
        </div>
      </div>

      {/* Monitoring Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
          <h2 className="text-xl font-bold mb-4">📈 Monitoring Stats</h2>
          <div className="space-y-2">
            <StatRow label="Metrics Collected" value={statistics.monitoringStats.metricsCollected} />
            <StatRow label="Anomalies Detected" value={statistics.monitoringStats.anomaliesDetected} />
            <StatRow label="Anomalies Healed" value={statistics.monitoringStats.anomaliesHealed} />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
          <h2 className="text-xl font-bold mb-4">🔒 Security Stats</h2>
          <div className="space-y-2">
            <StatRow label="Total Scans" value={statistics.securityStats.total} />
            <StatRow
              label="Critical Findings"
              value={statistics.securityStats.bySeverity.critical || 0}
              critical
            />
            <StatRow
              label="High Priority"
              value={statistics.securityStats.bySeverity.high || 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Component helpers
const HealthBadge: React.FC<{ status: 'healthy' | 'degraded' | 'critical' }> = ({ status }) => {
  const colors = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    critical: 'bg-red-500'
  };

  const icons = {
    healthy: '✓',
    degraded: '⚠',
    critical: '✗'
  };

  return (
    <div className={`${colors[status]} px-4 py-2 rounded-full flex items-center space-x-2 font-semibold`}>
      <span>{icons[status]}</span>
      <span>{status.toUpperCase()}</span>
    </div>
  );
};

const MetricCard: React.FC<{
  title: string;
  value: React.ReactNode;
  icon: string;
  subtitle?: string;
  trend?: 'up' | 'down';
  critical?: boolean;
}> = ({ title, value, icon, subtitle, trend, critical }) => (
  <div className={`bg-gray-800 rounded-lg p-6 shadow-xl ${critical ? 'border-2 border-red-500' : ''}`}>
    <div className="flex items-start justify-between mb-2">
      <div className="text-3xl">{icon}</div>
      {trend && (
        <div className={`text-sm ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
          {trend === 'up' ? '↗' : '↘'}
        </div>
      )}
    </div>
    <div className="text-3xl font-bold mb-1">{value}</div>
    <div className="text-gray-400 text-sm">{title}</div>
    {subtitle && <div className="text-gray-500 text-xs mt-1">{subtitle}</div>}
  </div>
);

const StatusCard: React.FC<{ title: string; value: string; color: string }> = ({
  title,
  value,
  color
}) => (
  <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
    <div className="text-gray-400 text-sm mb-2">{title}</div>
    <div className={`text-2xl font-bold text-${color}-400`}>{value}</div>
  </div>
);

const IssueCard: React.FC<{ issue: DetectedIssue }> = ({ issue }) => {
  const severityColors = {
    critical: 'border-red-500 bg-red-900/20',
    high: 'border-orange-500 bg-orange-900/20',
    medium: 'border-yellow-500 bg-yellow-900/20',
    low: 'border-blue-500 bg-blue-900/20',
    info: 'border-gray-500 bg-gray-900/20'
  };

  return (
    <div className={`border-l-4 ${severityColors[issue.severity]} p-4 rounded-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="font-semibold text-lg">{issue.signature.category.replace(/_/g, ' ')}</span>
            <span className="text-xs bg-gray-700 px-2 py-1 rounded-sm">{issue.severity}</span>
          </div>
          <p className="text-gray-300 text-sm mb-2">{issue.signature.description}</p>
          <div className="flex items-center space-x-4 text-xs text-gray-400">
            <span>⏱️ {new Date(issue.timestamp).toLocaleTimeString()}</span>
            {issue.context.component && <span>📦 {issue.context.component}</span>}
            {issue.affectedResources.length > 0 && (
              <span>🎯 {issue.affectedResources.length} resources</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const HealingCard: React.FC<{ action: { strategy: string; description: string; steps: unknown[]; expectedOutcome: string } }> = ({ action }) => (
  <div className="bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-sm">
    <div className="flex items-center space-x-2 mb-2">
      <div className="animate-spin">⚙️</div>
      <span className="font-semibold">{action.strategy.replace(/_/g, ' ')}</span>
    </div>
    <p className="text-sm text-gray-300 mb-2">{action.description}</p>
    <div className="text-xs text-gray-400">
      {action.steps.length} steps · Expected: {action.expectedOutcome}
    </div>
  </div>
);

const HealingResultCard: React.FC<{ result: HealingResult }> = ({ result }) => (
  <div
    className={`border-l-4 ${
      result.success ? 'border-green-500 bg-green-900/20' : 'border-red-500 bg-red-900/20'
    } p-4 rounded`}
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center space-x-2 mb-2">
          <span>{result.success ? '✅' : '❌'}</span>
          <span className="font-semibold">{result.outcomeDescription}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-400">
          <div>
            <div className="text-gray-500">Time to Heal</div>
            <div className="font-semibold">{result.metrics.timeToHeal}ms</div>
          </div>
          <div>
            <div className="text-gray-500">Steps</div>
            <div className="font-semibold">
              {result.stepsCompleted}/{result.totalSteps}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Resources</div>
            <div className="font-semibold">{result.metrics.resourcesAffected}</div>
          </div>
          <div>
            <div className="text-gray-500">Users</div>
            <div className="font-semibold">{result.metrics.usersImpacted}</div>
          </div>
        </div>
        {result.lessons.length > 0 && (
          <div className="mt-2 text-xs text-gray-400">
            💡 {result.lessons[0]}
          </div>
        )}
      </div>
    </div>
  </div>
);

const KnowledgeCard: React.FC<{ knowledge: { pattern: string; successRate: number; effectiveness: number; timesEncountered: number } }> = ({ knowledge }) => (
  <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-sm">
    <div className="text-sm font-semibold mb-2 truncate">{knowledge.pattern}</div>
    <div className="space-y-1 text-xs text-gray-400">
      <div className="flex justify-between">
        <span>Success Rate</span>
        <span className="font-semibold">{(knowledge.successRate * 100).toFixed(0)}%</span>
      </div>
      <div className="flex justify-between">
        <span>Effectiveness</span>
        <span className="font-semibold">{knowledge.effectiveness}%</span>
      </div>
      <div className="flex justify-between">
        <span>Encounters</span>
        <span className="font-semibold">{knowledge.timesEncountered}</span>
      </div>
    </div>
  </div>
);

const StatRow: React.FC<{ label: string; value: React.ReactNode; critical?: boolean }> = ({
  label,
  value,
  critical
}) => (
  <div className="flex justify-between items-center py-2 border-b border-gray-700">
    <span className="text-gray-400">{label}</span>
    <span className={`font-semibold ${critical ? 'text-red-400' : 'text-white'}`}>{value}</span>
  </div>
);

// Helper functions
const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const getModeColor = (mode: string): string => {
  const colors: Record<string, string> = {
    monitor: 'green',
    diagnostic: 'yellow',
    healing: 'blue',
    learning: 'purple',
    standby: 'gray'
  };
  return colors[mode] || 'gray';
};

export default GuardianAgentDashboard;
