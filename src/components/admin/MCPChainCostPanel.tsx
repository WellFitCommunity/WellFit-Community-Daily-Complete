/**
 * MCPChainCostPanel — Chain execution cost and performance tracking
 *
 * Purpose: Unified view of chain run costs, execution times, and per-step breakdowns
 * Used by: IntelligentAdminPanel via sectionDefinitions
 */

import React, { useState, useCallback, useEffect } from 'react';
import { DollarSign, Clock, BarChart2, RefreshCw, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { chainOrchestrationService } from '../../services/mcp/chainOrchestrationService';
import type {
  ChainRun,
  ChainStepResult,
} from '../../services/mcp/chainOrchestration.types';
import { auditLogger } from '../../services/auditLogger';

interface ChainRunWithSteps extends ChainRun {
  steps?: ChainStepResult[];
  totalExecutionMs?: number;
  stepCount?: number;
}

type TimeRange = '24h' | '7d' | '30d';

const MCPChainCostPanel: React.FC = () => {
  const [runs, setRuns] = useState<ChainRunWithSteps[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await chainOrchestrationService.listChainRuns({ limit: 50 });
      if (result.success && result.data) {
        setRuns(result.data as ChainRunWithSteps[]);
      } else {
        setError(result.error?.message || 'Failed to load chain runs');
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'CHAIN_COST_LOAD_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { timeRange }
      );
      setError('Failed to load chain run data');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const loadSteps = useCallback(async (runId: string) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }

    try {
      const result = await chainOrchestrationService.getChainStatus(runId);
      if (result.success && result.data) {
        const statusData = result.data as { run: ChainRun; steps: ChainStepResult[] };
        const steps = statusData.steps || [];
        const totalMs = steps.reduce((sum, s) => sum + (s.execution_time_ms || 0), 0);

        setRuns(prev => prev.map(r =>
          r.id === runId
            ? { ...r, steps, totalExecutionMs: totalMs, stepCount: steps.length }
            : r
        ));
        setExpandedRunId(runId);
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'CHAIN_COST_STEPS_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { runId }
      );
    }
  }, [expandedRunId]);

  // Aggregate metrics
  const completedRuns = runs.filter(r => r.status === 'completed');
  const failedRuns = runs.filter(r => r.status === 'failed');
  const totalRuns = runs.length;

  // Calculate average duration from runs that have step data loaded
  const runsWithDuration = runs.filter(r => r.totalExecutionMs !== undefined);
  const avgDurationMs = runsWithDuration.length > 0
    ? runsWithDuration.reduce((sum, r) => sum + (r.totalExecutionMs || 0), 0) / runsWithDuration.length
    : 0;

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'pending_approval': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900">Chain Execution Costs</h2>
        </div>
        <div className="flex items-center gap-2">
          {(['24h', '7d', '30d'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition min-h-[44px] ${
                timeRange === range
                  ? 'bg-green-100 text-green-800'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {range}
            </button>
          ))}
          <button
            onClick={loadRuns}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 transition min-h-[44px] min-w-[44px]"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800" role="alert">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-500">Total Runs</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalRuns}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-gray-500">Completed</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{completedRuns.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-gray-500">Failed</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{failedRuns.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-gray-500">Avg Duration</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {avgDurationMs > 0 ? formatDuration(avgDurationMs) : '—'}
          </p>
        </div>
      </div>

      {/* Chain Runs Table */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Loading chain runs...</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No chain runs found for this period
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-700 w-8"></th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Chain</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Status</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Steps</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Duration</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-700">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runs.map(run => (
                <React.Fragment key={run.id}>
                  <tr
                    className="hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => loadSteps(run.id)}
                  >
                    <td className="px-6 py-3">
                      {expandedRunId === run.id ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm font-mono text-gray-900">
                      {run.chain_key}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(run.status)}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {run.stepCount !== undefined ? `${run.current_step_order}/${run.stepCount}` : `Step ${run.current_step_order}`}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {run.totalExecutionMs !== undefined
                        ? formatDuration(run.totalExecutionMs)
                        : '—'}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
                    </td>
                  </tr>

                  {/* Expanded Step Detail */}
                  {expandedRunId === run.id && run.steps && (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Step Breakdown</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs text-gray-500">
                                  <th className="pb-2 pr-4">#</th>
                                  <th className="pb-2 pr-4">Step</th>
                                  <th className="pb-2 pr-4">Server</th>
                                  <th className="pb-2 pr-4">Tool</th>
                                  <th className="pb-2 pr-4">Status</th>
                                  <th className="pb-2 pr-4">Duration</th>
                                  <th className="pb-2 pr-4">Retries</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {run.steps.map(step => (
                                  <tr key={step.id}>
                                    <td className="py-2 pr-4 text-gray-400">{step.step_order}</td>
                                    <td className="py-2 pr-4 font-mono text-gray-700">{step.step_key}</td>
                                    <td className="py-2 pr-4 text-gray-600">{step.mcp_server}</td>
                                    <td className="py-2 pr-4 font-mono text-gray-600">{step.tool_name}</td>
                                    <td className="py-2 pr-4">
                                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(step.status)}`}>
                                        {step.status}
                                      </span>
                                    </td>
                                    <td className="py-2 pr-4 text-gray-600">
                                      {step.execution_time_ms ? formatDuration(step.execution_time_ms) : '—'}
                                    </td>
                                    <td className="py-2 pr-4 text-gray-500">
                                      {step.retry_count > 0 ? step.retry_count : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-gray-300">
                                  <td colSpan={5} className="py-2 pr-4 font-semibold text-gray-700 text-right">
                                    Total:
                                  </td>
                                  <td className="py-2 pr-4 font-semibold text-gray-900">
                                    {formatDuration(run.totalExecutionMs || 0)}
                                  </td>
                                  <td className="py-2 pr-4 text-gray-500">
                                    {run.steps.reduce((sum, s) => sum + (s.retry_count || 0), 0) || '—'}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                          {/* Error display for failed steps */}
                          {run.steps.filter(s => s.error_message).map(step => (
                            <div key={`err-${step.id}`} className="bg-red-50 border border-red-200 rounded p-3 mt-2">
                              <p className="text-xs font-semibold text-red-800">
                                Step {step.step_order} ({step.step_key}) Error:
                              </p>
                              <p className="text-xs text-red-700 mt-1">{step.error_message}</p>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MCPChainCostPanel;
