/**
 * ChainApprovalQueue — Filtered view of runs awaiting approval
 *
 * Shows only chain runs with status 'awaiting_approval'.
 * Each card renders a compact ChainRunDetail for inline approve/reject.
 */

import React from 'react';
import type { ChainRun } from '../../../services/mcp/chainOrchestration.types';
import { ChainRunDetail } from './ChainRunDetail';
import { RUN_STATUS_LABEL } from './MCPChainManagementPanel.types';

interface ChainApprovalQueueProps {
  runs: ChainRun[];
  onApprovalAction: () => void;
}

export const ChainApprovalQueue: React.FC<ChainApprovalQueueProps> = ({
  runs,
  onApprovalAction,
}) => {
  const awaitingRuns = runs.filter((r) => r.status === 'awaiting_approval');

  if (awaitingRuns.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400" data-testid="no-approvals">
        No chains awaiting approval. All clear.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="approval-queue">
      <div className="text-sm text-slate-400 mb-2">
        {awaitingRuns.length} chain{awaitingRuns.length !== 1 ? 's' : ''}{' '}
        {RUN_STATUS_LABEL.awaiting_approval.toLowerCase()}
      </div>

      {awaitingRuns.map((run) => (
        <div key={run.id} data-testid={`approval-item-${run.id}`}>
          <div className="text-xs text-slate-500 mb-1 font-mono">
            {run.chain_key} &middot; started{' '}
            {run.started_at
              ? new Date(run.started_at).toLocaleString()
              : 'unknown'}
          </div>
          <ChainRunDetail
            runId={run.id}
            onApprovalAction={onApprovalAction}
          />
        </div>
      ))}
    </div>
  );
};

export default ChainApprovalQueue;
