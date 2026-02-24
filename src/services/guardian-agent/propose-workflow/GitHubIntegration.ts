/**
 * GitHub Integration - Full GitHub API integration for Guardian Agent
 *
 * Features:
 * - Create branches, commit files, create/merge/close PRs
 * - CI/CD integration: wait for checks, verify merge requirements
 * - Safe merge with blocking on failed checks/missing approvals
 * - Audit logging for all GitHub operations
 */

import { auditLogger } from '../../auditLogger';
import type { CodeChange, PRMetadata } from './types';

type CheckStatus = 'queued' | 'in_progress' | 'success' | 'failure' | 'neutral' | 'skipped';

/**
 * GitHub API integration for creating and managing pull requests
 */
export class GitHubIntegration {
  private apiToken: string;
  private repoOwner: string;
  private repoName: string;
  private baseUrl = 'https://api.github.com';

  constructor(apiToken: string, repoOwner: string, repoName: string) {
    this.apiToken = apiToken;
    this.repoOwner = repoOwner;
    this.repoName = repoName;
  }

  // ==========================================================================
  // Core GitHub API
  // ==========================================================================

  private async githubRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  private async getRefSha(ref: string): Promise<string> {
    const data = await this.githubRequest<{ object: { sha: string } }>(
      `/repos/${this.repoOwner}/${this.repoName}/git/ref/heads/${ref}`
    );
    return data.object.sha;
  }

  private async createBranch(branchName: string, baseSha: string): Promise<void> {
    await this.githubRequest(
      `/repos/${this.repoOwner}/${this.repoName}/git/refs`,
      'POST',
      { ref: `refs/heads/${branchName}`, sha: baseSha }
    );
  }

  private async commitFile(
    branchName: string,
    filePath: string,
    content: string,
    message: string,
    existingSha?: string
  ): Promise<void> {
    const body: Record<string, unknown> = {
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      branch: branchName,
    };

    if (existingSha) {
      body.sha = existingSha;
    }

    await this.githubRequest(
      `/repos/${this.repoOwner}/${this.repoName}/contents/${filePath}`,
      'PUT',
      body
    );
  }

  private async getFileSha(branchName: string, filePath: string): Promise<string | null> {
    try {
      const data = await this.githubRequest<{ sha: string }>(
        `/repos/${this.repoOwner}/${this.repoName}/contents/${filePath}?ref=${branchName}`
      );
      return data.sha;
    } catch {
      return null;
    }
  }

  private async deleteFile(
    branchName: string,
    filePath: string,
    message: string,
    sha: string
  ): Promise<void> {
    await this.githubRequest(
      `/repos/${this.repoOwner}/${this.repoName}/contents/${filePath}`,
      'DELETE',
      { message, sha, branch: branchName }
    );
  }

  // ==========================================================================
  // Pull Request Management
  // ==========================================================================

  async createPullRequest(
    branchName: string,
    baseBranch: string,
    metadata: PRMetadata,
    changes: CodeChange[]
  ): Promise<{ prNumber: number; prUrl: string }> {
    const baseSha = await this.getRefSha(baseBranch);
    await this.createBranch(branchName, baseSha);

    for (const change of changes) {
      if (change.operation === 'delete') {
        const sha = await this.getFileSha(branchName, change.filePath);
        if (sha) {
          await this.deleteFile(branchName, change.filePath, `Delete ${change.filePath}: ${change.reason}`, sha);
        }
      } else {
        const existingSha = change.operation === 'update'
          ? await this.getFileSha(branchName, change.filePath)
          : null;
        await this.commitFile(
          branchName,
          change.filePath,
          change.after || '',
          `${change.operation === 'create' ? 'Create' : 'Update'} ${change.filePath}: ${change.reason}`,
          existingSha || undefined
        );
      }
    }

    const prData = await this.githubRequest<{ number: number; html_url: string }>(
      `/repos/${this.repoOwner}/${this.repoName}/pulls`,
      'POST',
      { title: metadata.title, body: metadata.description, head: branchName, base: baseBranch }
    );

    if (metadata.labels.length > 0) {
      await this.githubRequest(
        `/repos/${this.repoOwner}/${this.repoName}/issues/${prData.number}/labels`,
        'POST',
        { labels: metadata.labels }
      );
    }

    if (metadata.reviewers.length > 0) {
      try {
        await this.githubRequest(
          `/repos/${this.repoOwner}/${this.repoName}/pulls/${prData.number}/requested_reviewers`,
          'POST',
          { reviewers: metadata.reviewers }
        );
      } catch {
        // Reviewer request may fail if reviewers don't have access
      }
    }

    return { prNumber: prData.number, prUrl: prData.html_url };
  }

  async getPRStatus(prNumber: number): Promise<{
    state: 'open' | 'closed' | 'merged';
    checks: Array<{ name: string; status: 'pending' | 'success' | 'failure' }>;
    reviews: Array<{ user: string; state: 'approved' | 'changes_requested' | 'commented' }>;
  }> {
    const pr = await this.githubRequest<{ state: string; merged: boolean; head: { sha: string } }>(
      `/repos/${this.repoOwner}/${this.repoName}/pulls/${prNumber}`
    );

    let state: 'open' | 'closed' | 'merged' = 'open';
    if (pr.merged) state = 'merged';
    else if (pr.state === 'closed') state = 'closed';

    const checksData = await this.githubRequest<{ check_runs: Array<{ name: string; conclusion: string | null }> }>(
      `/repos/${this.repoOwner}/${this.repoName}/commits/${pr.head.sha}/check-runs`
    );

    const checks = checksData.check_runs.map(check => ({
      name: check.name,
      status: check.conclusion === 'success' ? 'success' as const :
              check.conclusion === 'failure' ? 'failure' as const : 'pending' as const,
    }));

    const reviewsData = await this.githubRequest<Array<{ user: { login: string }; state: string }>>(
      `/repos/${this.repoOwner}/${this.repoName}/pulls/${prNumber}/reviews`
    );

    const reviews = reviewsData.map(review => ({
      user: review.user.login,
      state: review.state.toLowerCase() === 'approved' ? 'approved' as const :
             review.state.toLowerCase() === 'changes_requested' ? 'changes_requested' as const :
             'commented' as const,
    }));

    return { state, checks, reviews };
  }

  async mergePR(prNumber: number): Promise<void> {
    await this.githubRequest(
      `/repos/${this.repoOwner}/${this.repoName}/pulls/${prNumber}/merge`,
      'PUT',
      { merge_method: 'squash', commit_title: `Merge Guardian Agent PR #${prNumber}` }
    );
  }

  async closePR(prNumber: number): Promise<void> {
    await this.githubRequest(
      `/repos/${this.repoOwner}/${this.repoName}/pulls/${prNumber}`,
      'PATCH',
      { state: 'closed' }
    );
  }

  async deleteBranch(branchName: string): Promise<void> {
    try {
      await this.githubRequest(
        `/repos/${this.repoOwner}/${this.repoName}/git/refs/heads/${branchName}`,
        'DELETE'
      );
    } catch {
      // Branch may already be deleted
    }
  }

  // ==========================================================================
  // CI/CD Integration — GitHub Actions Support
  // ==========================================================================

  private mapCheckStatus(status: string | null, conclusion: string | null): CheckStatus {
    if (status === 'queued') return 'queued';
    if (status === 'in_progress') return 'in_progress';
    if (conclusion === 'success') return 'success';
    if (conclusion === 'failure' || conclusion === 'timed_out' || conclusion === 'cancelled') return 'failure';
    if (conclusion === 'neutral') return 'neutral';
    if (conclusion === 'skipped') return 'skipped';
    return 'in_progress';
  }

  async getCheckRuns(commitSha: string): Promise<{
    total: number;
    completed: number;
    passed: number;
    failed: number;
    pending: number;
    checks: Array<{
      id: number;
      name: string;
      status: CheckStatus;
      conclusion: string | null;
      startedAt: string | null;
      completedAt: string | null;
      detailsUrl: string | null;
    }>;
  }> {
    const data = await this.githubRequest<{
      total_count: number;
      check_runs: Array<{
        id: number; name: string; status: string; conclusion: string | null;
        started_at: string | null; completed_at: string | null; details_url: string | null;
      }>;
    }>(`/repos/${this.repoOwner}/${this.repoName}/commits/${commitSha}/check-runs`);

    const checks = data.check_runs.map((run) => ({
      id: run.id,
      name: run.name,
      status: this.mapCheckStatus(run.status, run.conclusion),
      conclusion: run.conclusion,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      detailsUrl: run.details_url,
    }));

    return {
      total: data.total_count,
      completed: checks.filter((c) => c.status !== 'queued' && c.status !== 'in_progress').length,
      passed: checks.filter((c) => c.status === 'success' || c.status === 'neutral' || c.status === 'skipped').length,
      failed: checks.filter((c) => c.status === 'failure').length,
      pending: checks.filter((c) => c.status === 'queued' || c.status === 'in_progress').length,
      checks,
    };
  }

  async waitForChecks(
    prNumber: number,
    options: {
      timeoutMs?: number;
      pollIntervalMs?: number;
      requiredChecks?: string[];
      onProgress?: (status: { completed: number; total: number; failed: number }) => void;
    } = {}
  ): Promise<{
    allPassed: boolean;
    timedOut: boolean;
    checks: Array<{ name: string; status: string; conclusion: string | null }>;
  }> {
    const timeoutMs = options.timeoutMs ?? 30 * 60 * 1000;
    const pollIntervalMs = options.pollIntervalMs ?? 30 * 1000;
    const startTime = Date.now();

    const pr = await this.githubRequest<{ head: { sha: string } }>(
      `/repos/${this.repoOwner}/${this.repoName}/pulls/${prNumber}`
    );
    const commitSha = pr.head.sha;

    await auditLogger.info('GITHUB_CHECKS_WAIT_STARTED', {
      prNumber, commitSha, timeoutMs, requiredChecks: options.requiredChecks,
    });

    while (Date.now() - startTime < timeoutMs) {
      const checkStatus = await this.getCheckRuns(commitSha);

      if (options.onProgress) {
        options.onProgress({ completed: checkStatus.completed, total: checkStatus.total, failed: checkStatus.failed });
      }

      if (options.requiredChecks && options.requiredChecks.length > 0) {
        const required = options.requiredChecks;
        const requiredResults = checkStatus.checks.filter((c) => required.includes(c.name));
        const allComplete = requiredResults.every((c) => c.status !== 'queued' && c.status !== 'in_progress');
        if (allComplete) {
          const allPassed = requiredResults.every((c) => c.status === 'success' || c.status === 'neutral' || c.status === 'skipped');
          await auditLogger.info('GITHUB_CHECKS_COMPLETED', { prNumber, allPassed, checks: requiredResults.map((c) => ({ name: c.name, status: c.status })) });
          return { allPassed, timedOut: false, checks: requiredResults };
        }
      } else if (checkStatus.pending === 0 && checkStatus.total > 0) {
        const allPassed = checkStatus.failed === 0;
        await auditLogger.info('GITHUB_CHECKS_COMPLETED', { prNumber, allPassed, total: checkStatus.total, passed: checkStatus.passed, failed: checkStatus.failed });
        return { allPassed, timedOut: false, checks: checkStatus.checks };
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    const finalStatus = await this.getCheckRuns(commitSha);
    await auditLogger.warn('GITHUB_CHECKS_TIMEOUT', {
      prNumber, timeoutMs,
      pendingChecks: finalStatus.checks.filter((c) => c.status === 'queued' || c.status === 'in_progress').map((c) => c.name),
    });

    return { allPassed: false, timedOut: true, checks: finalStatus.checks };
  }

  async canMerge(
    prNumber: number,
    requirements: {
      requiredApprovals?: number;
      requireAllChecksPass?: boolean;
      requiredChecks?: string[];
      blockOnChangesRequested?: boolean;
    } = {}
  ): Promise<{
    canMerge: boolean;
    reasons: string[];
    details: { approvals: number; changesRequested: boolean; checksStatus: { passed: number; failed: number; pending: number } };
  }> {
    const reasons: string[] = [];
    const requiredApprovals = requirements.requiredApprovals ?? 1;
    const requireAllChecksPass = requirements.requireAllChecksPass ?? true;
    const blockOnChangesRequested = requirements.blockOnChangesRequested ?? true;

    const status = await this.getPRStatus(prNumber);
    const approvals = status.reviews.filter((r) => r.state === 'approved').length;
    const changesRequested = status.reviews.some((r) => r.state === 'changes_requested');

    if (status.state !== 'open') reasons.push(`PR is ${status.state}, not open`);
    if (approvals < requiredApprovals) reasons.push(`Need ${requiredApprovals} approval(s), have ${approvals}`);
    if (blockOnChangesRequested && changesRequested) reasons.push('Changes have been requested');

    const pr = await this.githubRequest<{ head: { sha: string } }>(
      `/repos/${this.repoOwner}/${this.repoName}/pulls/${prNumber}`
    );
    const checkStatus = await this.getCheckRuns(pr.head.sha);

    if (requireAllChecksPass) {
      if (checkStatus.pending > 0) reasons.push(`${checkStatus.pending} check(s) still running`);
      if (checkStatus.failed > 0) {
        const failedNames = checkStatus.checks.filter((c) => c.status === 'failure').map((c) => c.name).join(', ');
        reasons.push(`${checkStatus.failed} check(s) failed: ${failedNames}`);
      }
    }

    if (requirements.requiredChecks) {
      for (const requiredCheck of requirements.requiredChecks) {
        const check = checkStatus.checks.find((c) => c.name === requiredCheck);
        if (!check) reasons.push(`Required check "${requiredCheck}" not found`);
        else if (check.status === 'failure') reasons.push(`Required check "${requiredCheck}" failed`);
        else if (check.status === 'queued' || check.status === 'in_progress') reasons.push(`Required check "${requiredCheck}" still running`);
      }
    }

    return {
      canMerge: reasons.length === 0,
      reasons,
      details: { approvals, changesRequested, checksStatus: { passed: checkStatus.passed, failed: checkStatus.failed, pending: checkStatus.pending } },
    };
  }

  async safeMergePR(
    prNumber: number,
    requirements?: {
      requiredApprovals?: number;
      requireAllChecksPass?: boolean;
      requiredChecks?: string[];
      blockOnChangesRequested?: boolean;
      waitForChecks?: boolean;
      waitTimeoutMs?: number;
    }
  ): Promise<{
    merged: boolean;
    reason?: string;
    details?: { approvals: number; checksStatus: { passed: number; failed: number; pending: number } };
  }> {
    const opts = requirements ?? {};

    if (opts.waitForChecks) {
      const checkResult = await this.waitForChecks(prNumber, { timeoutMs: opts.waitTimeoutMs, requiredChecks: opts.requiredChecks });
      if (checkResult.timedOut) {
        await auditLogger.warn('GITHUB_MERGE_BLOCKED', { prNumber, reason: 'Checks timed out' });
        return { merged: false, reason: 'Checks timed out waiting for completion' };
      }
      if (!checkResult.allPassed) {
        const failedChecks = checkResult.checks.filter((c) => c.status === 'failure').map((c) => c.name).join(', ');
        await auditLogger.warn('GITHUB_MERGE_BLOCKED', { prNumber, reason: 'Checks failed', failedChecks });
        return { merged: false, reason: `Checks failed: ${failedChecks}` };
      }
    }

    const mergeCheck = await this.canMerge(prNumber, opts);
    if (!mergeCheck.canMerge) {
      await auditLogger.warn('GITHUB_MERGE_BLOCKED', { prNumber, reasons: mergeCheck.reasons });
      return { merged: false, reason: mergeCheck.reasons.join('; '), details: mergeCheck.details };
    }

    await this.mergePR(prNumber);
    await auditLogger.info('GITHUB_PR_MERGED', { prNumber, approvals: mergeCheck.details.approvals, checksStatus: mergeCheck.details.checksStatus });
    return { merged: true, details: mergeCheck.details };
  }
}
