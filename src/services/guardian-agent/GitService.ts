/**
 * Git Service - Auto-PR Creation for Guardian Agent
 *
 * Handles automatic Git operations when Security Panel approves a Guardian fix:
 * - Create branch
 * - Apply code fixes
 * - Commit changes
 * - Create pull request with Guardian Eyes video link
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

export class GitService {
  /**
   * Create a new branch for Guardian fix
   */
  static async createBranch(baseName: string): Promise<GitOperationResult> {
    try {
      const branchName = `guardian/${baseName}-${Date.now()}`;
      const sanitizedBranch = branchName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-');

      // Use GitHub CLI to create branch
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Get current branch
      const { stdout: currentBranch } = await execAsync('git branch --show-current');

      // Create and switch to new branch
      await execAsync(`git checkout -b ${sanitizedBranch}`);

      await auditLogger.info('GUARDIAN_BRANCH_CREATED', {
        branchName: sanitizedBranch,
        baseBranch: currentBranch.trim(),
      });

      return {
        success: true,
        message: `Branch created: ${sanitizedBranch}`,
        branchName: sanitizedBranch,
      };
    } catch (error) {
      await auditLogger.error('GUARDIAN_BRANCH_FAILED', error instanceof Error ? error : new Error(String(error)));

      return {
        success: false,
        message: 'Failed to create branch',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Apply code fix to file
   */
  static async applyFix(
    filePath: string,
    fixedCode: string,
    originalCode?: string
  ): Promise<GitOperationResult> {
    try {
      const fs = require('fs').promises;
      const path = require('path');

      // Resolve absolute path
      const absolutePath = path.resolve(process.cwd(), filePath);

      // Read current file content
      let fileContent = await fs.readFile(absolutePath, 'utf8');

      // If original code provided, do precise replacement
      if (originalCode) {
        if (!fileContent.includes(originalCode)) {
          throw new Error('Original code not found in file - file may have changed');
        }
        fileContent = fileContent.replace(originalCode, fixedCode);
      } else {
        // Otherwise, replace entire file (use with caution)
        fileContent = fixedCode;
      }

      // Write fixed code
      await fs.writeFile(absolutePath, fileContent, 'utf8');

      await auditLogger.info('GUARDIAN_FIX_APPLIED', {
        filePath,
        originalCodeLength: originalCode?.length || 0,
        fixedCodeLength: fixedCode.length,
      });

      return {
        success: true,
        message: `Fix applied to ${filePath}`,
      };
    } catch (error) {
      await auditLogger.error('GUARDIAN_FIX_FAILED', error instanceof Error ? error : new Error(String(error)), {
        filePath,
      });

      return {
        success: false,
        message: 'Failed to apply fix',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Commit changes with Guardian signature
   */
  static async commit(
    message: string,
    description: string,
    sessionRecordingUrl?: string
  ): Promise<GitOperationResult> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Stage all changes
      await execAsync('git add .');

      // Create commit message
      const fullMessage = `${message}

${description}

${sessionRecordingUrl ? `Guardian Eyes Recording: ${sessionRecordingUrl}\n` : ''}
🤖 Generated with Guardian Agent
Co-Authored-By: Guardian <noreply@guardian.ai>`;

      // Commit with heredoc to handle multi-line messages
      await execAsync(`git commit -m "${fullMessage.replace(/"/g, '\\"')}"`);

      // Get commit SHA
      const { stdout: commitSha } = await execAsync('git rev-parse HEAD');

      await auditLogger.info('GUARDIAN_COMMIT_CREATED', {
        message,
        commitSha: commitSha.trim(),
        hasRecordingLink: !!sessionRecordingUrl,
      });

      return {
        success: true,
        message: `Commit created: ${commitSha.trim().substring(0, 7)}`,
        commitSha: commitSha.trim(),
      };
    } catch (error) {
      await auditLogger.error('GUARDIAN_COMMIT_FAILED', error instanceof Error ? error : new Error(String(error)));

      return {
        success: false,
        message: 'Failed to create commit',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Push branch to remote
   */
  static async pushBranch(branchName: string): Promise<GitOperationResult> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Push to origin with upstream tracking
      await execAsync(`git push -u origin ${branchName}`);

      await auditLogger.info('GUARDIAN_BRANCH_PUSHED', { branchName });

      return {
        success: true,
        message: `Branch pushed: ${branchName}`,
        branchName,
      };
    } catch (error) {
      await auditLogger.error('GUARDIAN_PUSH_FAILED', error instanceof Error ? error : new Error(String(error)), {
        branchName,
      });

      return {
        success: false,
        message: 'Failed to push branch',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create pull request using GitHub CLI
   */
  static async createPullRequest(params: {
    title: string;
    body: string;
    baseBranch?: string;
    labels?: string[];
    reviewers?: string[];
  }): Promise<GitOperationResult> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const base = params.baseBranch || 'main';
      const labels = params.labels?.join(',') || 'guardian-fix,security';
      const reviewers = params.reviewers?.join(',') || '';

      // Create PR using gh CLI
      let ghCommand = `gh pr create --title "${params.title.replace(/"/g, '\\"')}" --body "${params.body.replace(/"/g, '\\"')}" --base ${base} --label "${labels}"`;

      if (reviewers) {
        ghCommand += ` --reviewer "${reviewers}"`;
      }

      const { stdout } = await execAsync(ghCommand);

      // Extract PR URL from output
      const prUrl = stdout.trim();
      const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
      const prNumber = prNumberMatch ? parseInt(prNumberMatch[1]) : undefined;

      await auditLogger.info('GUARDIAN_PR_CREATED', {
        prUrl,
        prNumber,
        title: params.title,
        baseBranch: base,
      });

      return {
        success: true,
        message: `Pull request created: ${prUrl}`,
        prUrl,
        prNumber,
      };
    } catch (error) {
      await auditLogger.error('GUARDIAN_PR_FAILED', error instanceof Error ? error : new Error(String(error)));

      return {
        success: false,
        message: 'Failed to create pull request',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Complete workflow: Branch → Fix → Commit → Push → PR
   */
  static async createFixPullRequest(params: {
    alertId: string;
    alertTitle: string;
    alertDescription: string;
    alertCategory: string;
    alertSeverity: string;
    filePath: string;
    originalCode?: string;
    fixedCode: string;
    sessionRecordingUrl?: string;
    reviewers?: string[];
  }): Promise<GitOperationResult> {
    try {
      // Step 1: Create branch
      const branchResult = await this.createBranch(`fix-${params.alertCategory}-${params.alertId}`);
      if (!branchResult.success) {
        return branchResult;
      }

      // Step 2: Apply fix
      const fixResult = await this.applyFix(params.filePath, params.fixedCode, params.originalCode);
      if (!fixResult.success) {
        // Rollback: Delete branch
        await this.deleteBranch(branchResult.branchName!);
        return fixResult;
      }

      // Step 3: Commit
      const commitResult = await this.commit(
        `Guardian Agent: ${params.alertTitle}`,
        params.alertDescription,
        params.sessionRecordingUrl
      );
      if (!commitResult.success) {
        // Rollback: Delete branch
        await this.deleteBranch(branchResult.branchName!);
        return commitResult;
      }

      // Step 4: Push
      const pushResult = await this.pushBranch(branchResult.branchName!);
      if (!pushResult.success) {
        // Rollback: Delete branch
        await this.deleteBranch(branchResult.branchName!);
        return pushResult;
      }

      // Step 5: Create PR
      const prBody = this.generatePRBody(params);
      const prResult = await this.createPullRequest({
        title: `🛡️ Guardian Fix: ${params.alertTitle}`,
        body: prBody,
        labels: ['guardian-fix', 'security', `severity:${params.alertSeverity}`],
        reviewers: params.reviewers,
      });

      if (!prResult.success) {
        // Note: We don't rollback here because the branch is useful for debugging
        return prResult;
      }

      // Success! Save PR info to database
      await this.savePRInfo(params.alertId, prResult.prUrl!, prResult.prNumber);

      return {
        success: true,
        message: `Pull request created successfully: ${prResult.prUrl}`,
        branchName: branchResult.branchName,
        commitSha: commitResult.commitSha,
        prUrl: prResult.prUrl,
        prNumber: prResult.prNumber,
      };
    } catch (error) {
      await auditLogger.error('GUARDIAN_WORKFLOW_FAILED', error instanceof Error ? error : new Error(String(error)));

      return {
        success: false,
        message: 'Failed to complete fix workflow',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate PR body with Guardian Eyes link and code diff
   */
  private static generatePRBody(params: {
    alertId: string;
    alertTitle: string;
    alertDescription: string;
    alertCategory: string;
    alertSeverity: string;
    filePath: string;
    originalCode?: string;
    fixedCode: string;
    sessionRecordingUrl?: string;
  }): string {
    return `## 🛡️ Automated Security Fix

**Alert:** ${params.alertTitle}
**Severity:** ${params.alertSeverity.toUpperCase()}
**Category:** ${params.alertCategory}

### 📋 Description

${params.alertDescription}

${params.sessionRecordingUrl ? `### 👁️ Guardian Eyes Recording\n\n[🎥 Watch the exact moment this issue occurred](${params.sessionRecordingUrl})\n\n` : ''}### 📝 Changes Made

**File:** \`${params.filePath}\`

${params.originalCode ? `#### Before (Vulnerable)
\`\`\`typescript
${params.originalCode}
\`\`\`

#### After (Fixed)
\`\`\`typescript
${params.fixedCode}
\`\`\`
` : `#### Applied Fix
\`\`\`typescript
${params.fixedCode}
\`\`\`
`}

### ✅ Review Checklist

- [ ] Verify the fix resolves the security issue
- [ ] Check for unintended side effects
- [ ] Ensure tests pass
- [ ] Approve and merge

### 🤖 Automation Info

- Generated by: Guardian Agent
- Alert ID: \`${params.alertId}\`
- Automated: Branch creation, code fix, commit, PR creation
- Manual: Code review and merge (required for safety)

---

**This PR was automatically created by Guardian Agent to protect your application.**
If this is a false positive, please close the PR and update Guardian's detection rules.
`;
  }

  /**
   * Save PR info to database for tracking
   */
  private static async savePRInfo(alertId: string, prUrl: string, prNumber?: number): Promise<void> {
    try {
      // Get current metadata and merge with new PR info
      const { data: alert } = await supabase
        .from('guardian_alerts')
        .select('metadata')
        .eq('id', alertId)
        .single();

      const updatedMetadata = {
        ...(alert?.metadata || {}),
        pr_url: prUrl,
        pr_number: prNumber,
      };

      await supabase
        .from('guardian_alerts')
        .update({
          metadata: updatedMetadata,
        })
        .eq('id', alertId);
    } catch (error) {
      console.error('[GitService] Failed to save PR info:', error);
    }
  }

  /**
   * Delete branch (rollback helper)
   */
  private static async deleteBranch(branchName: string): Promise<void> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      await execAsync(`git checkout main && git branch -D ${branchName}`);
    } catch (error) {
      console.error('[GitService] Failed to delete branch:', error);
    }
  }

  /**
   * Check if gh CLI is available
   */
  static async checkGitHubCLI(): Promise<boolean> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      await execAsync('gh --version');
      return true;
    } catch (error) {
      return false;
    }
  }
}
