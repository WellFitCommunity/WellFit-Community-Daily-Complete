/**
 * ChainRunDetail — Expanded run view with step details
 *
 * Shows all steps ordered by step_order, status badges,
 * collapsible JSON (input/output), and inline approve/reject
 * for steps awaiting approval.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { EABadge } from '../../envision-atlus/EABadge';
import { EAButton } from '../../envision-atlus/EAButton';
import { chainOrchestrationService } from '../../../services/mcp/chainOrchestrationService';
import type { ChainStepResult, ChainRun } from '../../../services/mcp/chainOrchestration.types';
import {
  STEP_STATUS_BADGE,
  STEP_STATUS_LABEL,
  RUN_STATUS_BADGE,
  RUN_STATUS_LABEL,
  formatDuration,
} from './MCPChainManagementPanel.types';

interface ChainRunDetailProps {
  runId: string;
  onApprovalAction?: () => void;
}

export const ChainRunDetail: React.FC<ChainRunDetailProps> = ({
  runId,
  onApprovalAction,
}) => {
  const [run, setRun] = useState<ChainRun | null>(null);
  const [steps, setSteps] = useState<ChainStepResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [approving, setApproving] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const result = await chainOrchestrationService.getChainStatus(runId);
    if (result.success) {
      setRun(result.data.run);
      setSteps(result.data.steps.sort((a, b) => a.step_order - b.step_order));
      setError(null);
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, [runId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const handleApproval = async (
    stepResultId: string,
    decision: 'approved' | 'rejected'
  ) => {
    setApproving(stepResultId);
    const result = await chainOrchestrationService.approveStep(
      runId,
      stepResultId,
      decision,
      approvalNotes[stepResultId] || undefined
    );
    setApproving(null);

    if (result.success) {
      await loadStatus();
      onApprovalAction?.();
    }
  };

  const handleResume = async () => {
    const result = await chainOrchestrationService.resumeChain(runId);
    if (result.success) {
      await loadStatus();
    }
  };

  const handleCancel = async () => {
    const result = await chainOrchestrationService.cancelChain(runId);
    if (result.success) {
      await loadStatus();
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-slate-400" data-testid="run-detail-loading">
        Loading run details...
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="p-4 text-red-400" data-testid="run-detail-error">
        {error || 'Failed to load run details'}
      </div>
    );
  }

  const canResume = run.status === 'awaiting_approval' || run.status === 'failed';
  const canCancel = run.status === 'running' || run.status === 'awaiting_approval' || run.status === 'pending';

  return (
    <div className="border border-slate-700 rounded-lg p-4 bg-slate-800/30" data-testid="run-detail" aria-label="Chain Run Detail">
      {/* Run header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-slate-500">{run.chain_key}</span>
          <EABadge variant={RUN_STATUS_BADGE[run.status]} size="sm">
            {RUN_STATUS_LABEL[run.status]}
          </EABadge>
        </div>
        <div className="flex gap-2">
          {canResume && (
            <EAButton variant="primary" size="sm" onClick={handleResume} data-testid="resume-chain">
              Resume
            </EAButton>
          )}
          {canCancel && (
            <EAButton variant="danger" size="sm" onClick={handleCancel} data-testid="cancel-chain">
              Cancel
            </EAButton>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-500 mb-4">
        Duration: {formatDuration(run.started_at, run.completed_at)}
        {run.error_message && (
          <span className="ml-4 text-red-400">Error: {run.error_message}</span>
        )}
      </div>

      {/* Step list */}
      <div className="space-y-2" data-testid="step-list">
        {steps.map((step) => {
          const isExpanded = expandedSteps.has(step.id);
          const isAwaiting = step.status === 'awaiting_approval';

          return (
            <div
              key={step.id}
              className="border border-slate-700/50 rounded bg-slate-900/30"
              data-testid={`step-${step.step_key}`}
            >
              <button
                className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-700/20 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
                onClick={() => toggleStep(step.id)}
                data-testid={`toggle-step-${step.step_key}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 font-mono w-6">
                    #{step.step_order}
                  </span>
                  <span className="text-sm text-slate-300">{step.step_key}</span>
                  <EABadge variant={STEP_STATUS_BADGE[step.status]} size="sm">
                    {STEP_STATUS_LABEL[step.status]}
                  </EABadge>
                </div>
                <span className="text-xs text-slate-600">
                  {step.execution_time_ms !== null
                    ? `${step.execution_time_ms}ms`
                    : '\u2014'}
                </span>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-3" data-testid={`step-detail-${step.step_key}`}>
                  <div className="text-xs text-slate-500">
                    Server: {step.mcp_server} / Tool: {step.tool_name}
                  </div>

                  {step.input_args && (
                    <details className="text-xs">
                      <summary className="text-slate-400 cursor-pointer hover:text-slate-300">
                        Input JSON
                      </summary>
                      <pre className="mt-1 p-2 bg-slate-900 rounded text-slate-300 overflow-x-auto max-h-40">
                        {JSON.stringify(step.input_args, null, 2)}
                      </pre>
                    </details>
                  )}

                  {step.output_data && (
                    <details className="text-xs">
                      <summary className="text-slate-400 cursor-pointer hover:text-slate-300">
                        Output JSON
                      </summary>
                      <pre className="mt-1 p-2 bg-slate-900 rounded text-slate-300 overflow-x-auto max-h-40">
                        {JSON.stringify(step.output_data, null, 2)}
                      </pre>
                    </details>
                  )}

                  {step.error_message && (
                    <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded">
                      {step.error_message}
                    </div>
                  )}

                  {step.placeholder_message && (
                    <div className="text-xs text-amber-400 bg-amber-900/20 p-2 rounded">
                      {step.placeholder_message}
                    </div>
                  )}

                  {isAwaiting && (
                    <div className="border-t border-slate-700 pt-3 space-y-2" data-testid={`approval-form-${step.step_key}`}>
                      <textarea
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-slate-300 placeholder-slate-600 focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
                        placeholder="Approval notes (optional)"
                        rows={2}
                        value={approvalNotes[step.id] || ''}
                        onChange={(e) =>
                          setApprovalNotes((prev) => ({ ...prev, [step.id]: e.target.value }))
                        }
                        data-testid={`approval-notes-${step.step_key}`}
                      />
                      <div className="flex gap-2">
                        <EAButton
                          variant="primary"
                          size="sm"
                          loading={approving === step.id}
                          onClick={() => handleApproval(step.id, 'approved')}
                          data-testid={`approve-step-${step.step_key}`}
                        >
                          Approve
                        </EAButton>
                        <EAButton
                          variant="danger"
                          size="sm"
                          loading={approving === step.id}
                          onClick={() => handleApproval(step.id, 'rejected')}
                          data-testid={`reject-step-${step.step_key}`}
                        >
                          Reject
                        </EAButton>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChainRunDetail;
