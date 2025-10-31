/**
 * Git Service - Auto-PR Creation for Guardian Agent
 * DISABLED FOR BROWSER - Server-side only feature
 *
 * This service requires Node.js modules (child_process, fs, path, util)
 * which are not available in the browser. Git operations should be
 * handled by Edge Functions or CI/CD pipelines instead.
 *
 * Original functionality moved to Edge Functions for server-side execution.
 */

export interface GitOperationResult {
  success: boolean;
  message: string;
  branchName?: string;
  commitSha?: string;
  prUrl?: string;
  prNumber?: number;
  error?: string;
}

/**
 * Browser-safe stub for GitService
 * Returns error indicating this feature must be run server-side
 */
export class GitService {
  static async checkGitHubCLI(): Promise<boolean> {
    // Git operations disabled in browser - use Edge Functions
    return false;
  }

  static async createBranch(): Promise<GitOperationResult> {
    return {
      success: false,
      message: 'Git operations disabled in browser. Use Edge Function instead.',
      error: 'BROWSER_NOT_SUPPORTED'
    };
  }

  static async commitChanges(): Promise<GitOperationResult> {
    return {
      success: false,
      message: 'Git operations disabled in browser. Use Edge Function instead.',
      error: 'BROWSER_NOT_SUPPORTED'
    };
  }

  static async createPullRequest(): Promise<GitOperationResult> {
    return {
      success: false,
      message: 'Git operations disabled in browser. Use Edge Function instead.',
      error: 'BROWSER_NOT_SUPPORTED'
    };
  }

  static async createFixPullRequest(_params: any): Promise<GitOperationResult> {
    return {
      success: false,
      message: 'Git operations disabled in browser. Use Edge Function instead.',
      error: 'BROWSER_NOT_SUPPORTED'
    };
  }
}
