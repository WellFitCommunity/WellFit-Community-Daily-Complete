/**
 * MCP Chain Management Panel — Shared Types
 *
 * Status-to-badge mappings, tab type, and helpers for the chain management UI.
 */

import type { ChainRunStatus, ChainStepStatus } from '../../../services/mcp/chainOrchestration.types';

// ============================================================
// Tab definitions
// ============================================================

export type ChainManagementTab = 'overview' | 'runs' | 'approvals';

export const TAB_LABELS: Record<ChainManagementTab, string> = {
  overview: 'Overview',
  runs: 'Runs',
  approvals: 'Approvals',
};

// ============================================================
// Status → EABadge variant maps
// ============================================================

type EABadgeVariant = 'critical' | 'high' | 'elevated' | 'normal' | 'info' | 'neutral';

export const RUN_STATUS_BADGE: Record<ChainRunStatus, EABadgeVariant> = {
  pending: 'info',
  running: 'elevated',
  awaiting_approval: 'high',
  completed: 'normal',
  failed: 'critical',
  cancelled: 'neutral',
  timed_out: 'critical',
};

export const RUN_STATUS_LABEL: Record<ChainRunStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  awaiting_approval: 'Awaiting Approval',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  timed_out: 'Timed Out',
};

export const STEP_STATUS_BADGE: Record<ChainStepStatus, EABadgeVariant> = {
  pending: 'info',
  running: 'elevated',
  completed: 'normal',
  failed: 'critical',
  skipped: 'neutral',
  awaiting_approval: 'high',
  approved: 'normal',
  rejected: 'critical',
  timed_out: 'critical',
  placeholder: 'neutral',
};

export const STEP_STATUS_LABEL: Record<ChainStepStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  skipped: 'Skipped',
  awaiting_approval: 'Awaiting Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  timed_out: 'Timed Out',
  placeholder: 'Placeholder',
};

// ============================================================
// Helpers
// ============================================================

/**
 * Format duration in milliseconds to a human-readable string.
 * Returns '—' for null/undefined.
 */
export function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '\u2014';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = end - start;

  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.round((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Parse $.input.* keys from step definitions' input_mapping
 * to derive dynamic input fields for the StartChainModal.
 */
export function extractInputFields(
  inputMappings: Record<string, string>[]
): string[] {
  const fields = new Set<string>();
  for (const mapping of inputMappings) {
    for (const key of Object.keys(mapping)) {
      const match = key.match(/^\$\.input\.(.+)$/);
      if (match) {
        fields.add(match[1]);
      }
    }
  }
  return Array.from(fields);
}
