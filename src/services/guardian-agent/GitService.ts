/**
 * Git Service - Auto-PR Creation for Guardian Agent
 *
 * Browser-safe client that delegates to Edge Function for server-side Git operations.
 * All GitHub API calls are handled server-side to protect credentials.
 *
 * Full audit trail: All PR operations logged to audit_logs table.
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

export interface GitOperationResult {
  success: boolean;
  message: string;
  branchName?: string;
  commitSha?: string;
  prUrl?: string;
  prNumber?: number;
  error?: string;
}

export interface CodeChange {
  filePath: string;
  oldContent?: string;
  newContent: string;
  operation: 'create' | 'update' | 'delete';
}

export interface CreatePRParams {
  issue: {
    id: string;
    category: string;
    severity: string;
    description: string;
    affectedResources: string[];
  };
  action: {
    id: string;
    strategy: string;
    description: string;
  };
  changes: CodeChange[];
  branchName?: string;
  baseBranch?: string;
  reviewers?: string[];
}

/**
 * Browser-safe GitService that calls Edge Function for GitHub operations
 */
export class GitService {
  /**
   * Check if GitHub is configured (Edge Function available)
   */
  static async checkGitHubCLI(): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('guardian-pr-service', {
        body: { action: 'health_check' }
      });

      return !error && data?.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a pull request via Edge Function
   */
  static async createFixPullRequest(params: CreatePRParams): Promise<GitOperationResult> {
    try {
      await auditLogger.info('GUARDIAN_PR_REQUEST_INITIATED', {
        issue_id: params.issue.id,
        action_id: params.action.id,
        strategy: params.action.strategy,
        files_count: params.changes.length
      });

      const { data, error } = await supabase.functions.invoke('guardian-pr-service', {
        body: {
          action: 'create_pr',
          data: params
        }
      });

      if (error) {
        await auditLogger.error('GUARDIAN_PR_REQUEST_FAILED', error, {
          issue_id: params.issue.id,
          action_id: params.action.id
        });

        return {
          success: false,
          message: `Failed to create PR: ${error.message}`,
          error: error.message
        };
      }

      if (!data.success) {
        await auditLogger.error('GUARDIAN_PR_CREATION_FAILED', new Error(data.error || 'Unknown error'), {
          issue_id: params.issue.id,
          action_id: params.action.id
        });

        return {
          success: false,
          message: data.error || 'Failed to create PR',
          error: data.error
        };
      }

      await auditLogger.info('GUARDIAN_PR_CREATED_SUCCESS', {
        issue_id: params.issue.id,
        action_id: params.action.id,
        pr_number: data.prNumber,
        pr_url: data.prUrl
      });

      return {
        success: true,
        message: `Pull request created: #${data.prNumber}`,
        prNumber: data.prNumber,
        prUrl: data.prUrl
      };
    } catch (error) {
      await auditLogger.error('GUARDIAN_PR_EXCEPTION', error instanceof Error ? error : new Error(String(error)), {
        issue_id: params.issue.id,
        action_id: params.action.id
      });

      return {
        success: false,
        message: `Exception creating PR: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get PR status
   */
  static async getPRStatus(prNumber: number): Promise<{
    success: boolean;
    state?: 'open' | 'closed' | 'merged';
    checks?: Array<{ name: string; status: string }>;
    reviews?: Array<{ user: string; state: string }>;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('guardian-pr-service', {
        body: {
          action: 'get_pr_status',
          data: { prNumber }
        }
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      await auditLogger.error('GUARDIAN_PR_STATUS_FAILED', error instanceof Error ? error : new Error(String(error)), {
        pr_number: prNumber
      });
      throw error;
    }
  }

  /**
   * Merge PR (server-side operation)
   */
  static async mergePR(prNumber: number): Promise<GitOperationResult> {
    try {
      const { data, error } = await supabase.functions.invoke('guardian-pr-service', {
        body: {
          action: 'merge_pr',
          data: { prNumber }
        }
      });

      if (error || !data.success) {
        throw new Error(data?.error || error?.message || 'Failed to merge PR');
      }

      await auditLogger.info('GUARDIAN_PR_MERGED', {
        pr_number: prNumber
      });

      return {
        success: true,
        message: `PR #${prNumber} merged successfully`
      };
    } catch (error) {
      await auditLogger.error('GUARDIAN_PR_MERGE_FAILED', error instanceof Error ? error : new Error(String(error)), {
        pr_number: prNumber
      });

      return {
        success: false,
        message: `Failed to merge PR: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Legacy methods (maintained for backwards compatibility)
  static async createBranch(): Promise<GitOperationResult> {
    return {
      success: false,
      message: 'Use createFixPullRequest() instead',
      error: 'DEPRECATED'
    };
  }

  static async commitChanges(): Promise<GitOperationResult> {
    return {
      success: false,
      message: 'Use createFixPullRequest() instead',
      error: 'DEPRECATED'
    };
  }

  static async createPullRequest(): Promise<GitOperationResult> {
    return {
      success: false,
      message: 'Use createFixPullRequest() instead',
      error: 'DEPRECATED'
    };
  }
}
