/**
 * patchProposal — client leg of the Guardian Option B auto_patch path.
 *
 * auto_patch NEVER touches the running system. This module routes the proposal
 * through the guardian-agent edge fn's `propose_pr` relay, which creates the
 * full paper trail (guardian_review_tickets row + linked security_alerts row +
 * Guardian Eyes snapshot) and auto-OPENS a GitHub PR via the hardened
 * guardian-pr-service. Merging remains a human act (Maria, GitHub app). The
 * internal PR-service secret never reaches this browser code — the relay holds
 * it server-side.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type { HealingStep, DetectedIssue } from './types';

export interface PatchProposalOutcome {
  success: boolean;
  message: string;
}

interface ProposePrResponse {
  success?: boolean;
  ticketId?: string;
  prUrl?: string;
  deduped?: boolean;
  rateLimited?: boolean;
  error?: string;
}

export async function proposePatchPr(
  step: HealingStep,
  issue: DetectedIssue
): Promise<PatchProposalOutcome> {
  await auditLogger.info('GUARDIAN_PATCH_PROPOSED', {
    filePath: step.parameters.location || step.target,
    patchType: step.parameters.patchType,
    issueId: issue.id,
  });

  try {
    const { data, error } = await supabase.functions.invoke('guardian-agent', {
      body: {
        action: 'propose_pr',
        data: {
          issue: {
            id: issue.id,
            category: issue.signature.category,
            severity: issue.severity,
            description: issue.signature.description ?? `${issue.signature.category} detected`,
            affectedComponent: issue.context.component ?? issue.context.filePath ?? step.target,
            affectedResources: issue.affectedResources,
            filePath: issue.context.filePath,
            lineNumber: issue.context.lineNumber,
            stackTrace: issue.stackTrace,
            detectionContext: {
              recentActions: issue.context.recentActions,
              apiEndpoint: issue.context.apiEndpoint,
            },
          },
          healing: {
            strategy: 'auto_patch',
            description: `Proposed ${String(step.parameters.patchType ?? 'code')} fix for ${step.target}`,
            steps: [step],
            expectedOutcome: 'Reviewed PR merged by a human resolves the recurring error.',
          },
          evidence: `Detected at ${issue.timestamp instanceof Date ? issue.timestamp.toISOString() : String(issue.timestamp)}; location ${step.parameters.location ?? step.target}.`,
        },
      },
    });

    if (error) {
      await auditLogger.error('GUARDIAN_PATCH_PROPOSAL_FAILED', new Error(error.message), {
        issueId: issue.id,
      });
      return { success: false, message: `Patch proposal relay failed: ${error.message}` };
    }

    const result = data as ProposePrResponse | null;

    if (!result?.success) {
      await auditLogger.error(
        'GUARDIAN_PATCH_PROPOSAL_FAILED',
        new Error(result?.error ?? 'propose_pr returned no result'),
        { issueId: issue.id }
      );
      return { success: false, message: `Patch proposal rejected: ${result?.error ?? 'unknown'}` };
    }

    await auditLogger.info('GUARDIAN_PATCH_PR_OPENED', {
      issueId: issue.id,
      ticketId: result.ticketId,
      prUrl: result.prUrl ?? null,
      deduped: result.deduped ?? false,
      rateLimited: result.rateLimited ?? false,
    });

    if (result.deduped) {
      return { success: true, message: `Patch already proposed (ticket ${result.ticketId})` };
    }
    if (result.rateLimited) {
      return {
        success: true,
        message: `Ticket ${result.ticketId} created; PR withheld (open-PR cap reached)`,
      };
    }
    return {
      success: true,
      message: `Guardian PR opened: ${result.prUrl ?? '(no URL)'} — ticket ${result.ticketId}, awaiting human review`,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('GUARDIAN_PATCH_PROPOSAL_FAILED', error, { issueId: issue.id });
    return { success: false, message: `Patch proposal failed: ${error.message}` };
  }
}
