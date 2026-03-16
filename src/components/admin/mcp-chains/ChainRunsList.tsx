/**
 * ChainRunsList — Table of chain runs with expandable detail
 *
 * Shows chain_key, status badge, started_at, duration, and actions.
 * Clicking a row expands the ChainRunDetail inline.
 */

import React, { useState } from 'react';
import { EABadge } from '../../envision-atlus/EABadge';
import type { ChainRun } from '../../../services/mcp/chainOrchestration.types';
import {
  RUN_STATUS_BADGE,
  RUN_STATUS_LABEL,
  formatDuration,
} from './MCPChainManagementPanel.types';
import { ChainRunDetail } from './ChainRunDetail';

interface ChainRunsListProps {
  runs: ChainRun[];
  onRefresh: () => void;
}

export const ChainRunsList: React.FC<ChainRunsListProps> = ({
  runs,
  onRefresh,
}) => {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400" data-testid="no-runs">
        No chain runs found. Start a chain from the Overview tab.
      </div>
    );
  }

  return (
    <div className="space-y-1" data-testid="chain-runs-list" aria-label="Chain Runs List">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-slate-500 font-medium border-b border-slate-700">
        <div className="col-span-3">Chain</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-3">Started</div>
        <div className="col-span-2">Duration</div>
        <div className="col-span-2">Step</div>
      </div>

      {/* Rows */}
      {runs.map((run) => {
        const isExpanded = expandedRunId === run.id;
        return (
          <div key={run.id} data-testid={`run-row-${run.id}`}>
            <button
              className="grid grid-cols-12 gap-2 px-3 py-3 w-full text-left hover:bg-slate-700/20 rounded transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
              onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
              data-testid={`toggle-run-${run.id}`}
            >
              <div className="col-span-3 text-sm text-slate-300 font-mono truncate">
                {run.chain_key}
              </div>
              <div className="col-span-2">
                <EABadge
                  variant={RUN_STATUS_BADGE[run.status]}
                  size="sm"
                  pulse={run.status === 'running'}
                >
                  {RUN_STATUS_LABEL[run.status]}
                </EABadge>
              </div>
              <div className="col-span-3 text-xs text-slate-400">
                {run.started_at
                  ? new Date(run.started_at).toLocaleString()
                  : '\u2014'}
              </div>
              <div className="col-span-2 text-xs text-slate-400">
                {formatDuration(run.started_at, run.completed_at)}
              </div>
              <div className="col-span-2 text-xs text-slate-500">
                Step {run.current_step_order}
              </div>
            </button>

            {isExpanded && (
              <div className="px-3 pb-3">
                <ChainRunDetail
                  runId={run.id}
                  onApprovalAction={onRefresh}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ChainRunsList;
