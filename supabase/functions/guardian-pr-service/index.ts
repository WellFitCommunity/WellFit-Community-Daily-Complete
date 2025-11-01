/**
 * Guardian Agent PR Service - GitHub Pull Request Creation
 *
 * This Edge Function handles all Git operations for the Guardian Agent.
 * Browser code cannot access Git/GitHub APIs, so this runs server-side.
 *
 * Features:
 * - Create branches for Guardian fixes
 * - Commit changes with detailed messages
 * - Create pull requests with full metadata
 * - Add labels and request reviews
 * - Full audit trail in database
 *
 * HIPAA Compliant: All operations logged to audit_logs
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CodeChange {
  filePath: string;
  oldContent?: string;
  newContent: string;
  operation: 'create' | 'update' | 'delete';
}

interface PRRequest {
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

interface GitHubPRResponse {
  number: number;
  html_url: string;
  state: string;
  title: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const githubToken = Deno.env.get('GITHUB_TOKEN') ?? ''
    const githubOwner = Deno.env.get('GITHUB_OWNER') ?? ''
    const githubRepo = Deno.env.get('GITHUB_REPO') ?? ''

    if (!githubToken || !githubOwner || !githubRepo) {
      return new Response(
        JSON.stringify({
          error: 'GitHub credentials not configured. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO environment variables.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { action, data } = await req.json() as { action: string; data: PRRequest }

    switch (action) {
      case 'create_pr': {
        const result = await createPullRequest(supabase, githubToken, githubOwner, githubRepo, data)
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'get_pr_status': {
        const status = await getPRStatus(githubToken, githubOwner, githubRepo, data.prNumber)
        return new Response(JSON.stringify(status), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'merge_pr': {
        const mergeResult = await mergePR(supabase, githubToken, githubOwner, githubRepo, data.prNumber)
        return new Response(JSON.stringify(mergeResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

/**
 * Create a pull request with Guardian Agent changes
 */
async function createPullRequest(
  supabase: any,
  githubToken: string,
  owner: string,
  repo: string,
  prRequest: PRRequest
): Promise<{ success: boolean; prNumber?: number; prUrl?: string; error?: string }> {
  try {
    const branchName = prRequest.branchName || `guardian-agent/${prRequest.issue.id}`
    const baseBranch = prRequest.baseBranch || 'main'

    // 1. Get the base branch SHA
    const baseBranchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!baseBranchResponse.ok) {
      throw new Error(`Failed to get base branch: ${baseBranchResponse.statusText}`)
    }

    const baseBranchData = await baseBranchResponse.json()
    const baseSha = baseBranchData.object.sha

    // 2. Create a new branch from base
    const createBranchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      }
    )

    if (!createBranchResponse.ok) {
      const errorData = await createBranchResponse.json()
      throw new Error(`Failed to create branch: ${errorData.message || createBranchResponse.statusText}`)
    }

    // 3. Create commits for each file change
    for (const change of prRequest.changes) {
      await createCommit(
        githubToken,
        owner,
        repo,
        branchName,
        change,
        `Guardian Agent: ${prRequest.action.strategy} - ${change.filePath}`
      )
    }

    // 4. Create the pull request
    const prTitle = `[Guardian Agent] ${prRequest.action.strategy}: ${prRequest.issue.category}`
    const prBody = generatePRDescription(prRequest)

    const createPRResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: prTitle,
          head: branchName,
          base: baseBranch,
          body: prBody,
          draft: false,
        }),
      }
    )

    if (!createPRResponse.ok) {
      const errorData = await createPRResponse.json()
      throw new Error(`Failed to create PR: ${errorData.message || createPRResponse.statusText}`)
    }

    const prData: GitHubPRResponse = await createPRResponse.json()

    // 5. Add labels to PR
    await addLabelsTosPR(githubToken, owner, repo, prData.number, [
      'guardian-agent',
      `severity:${prRequest.issue.severity}`,
      'auto-generated',
    ])

    // 6. Request reviews if specified
    if (prRequest.reviewers && prRequest.reviewers.length > 0) {
      await requestReviewers(githubToken, owner, repo, prData.number, prRequest.reviewers)
    }

    // 7. Log to audit trail
    await logPRCreation(supabase, prRequest, prData)

    return {
      success: true,
      prNumber: prData.number,
      prUrl: prData.html_url,
    }
  } catch (error) {
    await logPRError(supabase, prRequest, error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Create a commit on a branch
 */
async function createCommit(
  githubToken: string,
  owner: string,
  repo: string,
  branch: string,
  change: CodeChange,
  message: string
): Promise<void> {
  // Get current file content and SHA (if updating)
  let currentSha: string | undefined

  if (change.operation === 'update' || change.operation === 'delete') {
    const fileResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${change.filePath}?ref=${branch}`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (fileResponse.ok) {
      const fileData = await fileResponse.json()
      currentSha = fileData.sha
    }
  }

  // Create or update file
  const updateFileResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${change.filePath}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content: btoa(change.newContent), // Base64 encode
        sha: currentSha,
        branch,
      }),
    }
  )

  if (!updateFileResponse.ok) {
    const errorData = await updateFileResponse.json()
    throw new Error(`Failed to commit file ${change.filePath}: ${errorData.message}`)
  }
}

/**
 * Add labels to PR
 */
async function addLabelsTosPR(
  githubToken: string,
  owner: string,
  repo: string,
  prNumber: number,
  labels: string[]
): Promise<void> {
  await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/labels`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ labels }),
    }
  )
}

/**
 * Request reviewers for PR
 */
async function requestReviewers(
  githubToken: string,
  owner: string,
  repo: string,
  prNumber: number,
  reviewers: string[]
): Promise<void> {
  await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reviewers }),
    }
  )
}

/**
 * Get PR status
 */
async function getPRStatus(
  githubToken: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<any> {
  const prResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    }
  )

  if (!prResponse.ok) {
    throw new Error('Failed to get PR status')
  }

  return await prResponse.json()
}

/**
 * Merge PR
 */
async function mergePR(
  supabase: any,
  githubToken: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const mergeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commit_title: 'Guardian Agent auto-merge',
          merge_method: 'squash',
        }),
      }
    )

    if (!mergeResponse.ok) {
      throw new Error('Failed to merge PR')
    }

    await logPRMerge(supabase, prNumber)

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Generate PR description
 */
function generatePRDescription(prRequest: PRRequest): string {
  const lines: string[] = []

  lines.push('## Guardian Agent Auto-Fix')
  lines.push('')
  lines.push('> ⚠️ **This PR was automatically generated by the Guardian Agent.**')
  lines.push('> Please review carefully before merging.')
  lines.push('')

  lines.push('### Issue Detected')
  lines.push(`- **Category:** ${prRequest.issue.category}`)
  lines.push(`- **Severity:** ${prRequest.issue.severity}`)
  lines.push(`- **Description:** ${prRequest.issue.description}`)
  lines.push('')

  if (prRequest.issue.affectedResources.length > 0) {
    lines.push('**Affected Resources:**')
    prRequest.issue.affectedResources.forEach((resource) => {
      lines.push(`- ${resource}`)
    })
    lines.push('')
  }

  lines.push('### Healing Action')
  lines.push(`- **Strategy:** ${prRequest.action.strategy}`)
  lines.push(`- **Description:** ${prRequest.action.description}`)
  lines.push('')

  lines.push('### Changes Made')
  prRequest.changes.forEach((change) => {
    lines.push(`- \`${change.operation}\` ${change.filePath}`)
  })
  lines.push('')

  lines.push('### Testing Checklist')
  lines.push('- [ ] Automated tests pass')
  lines.push('- [ ] Manual testing completed')
  lines.push('- [ ] No unintended side effects')
  lines.push('- [ ] Security implications reviewed')
  lines.push('')

  lines.push('---')
  lines.push('*Generated by Guardian Agent* 🛡️')

  return lines.join('\n')
}

/**
 * Log PR creation to audit trail
 */
async function logPRCreation(
  supabase: any,
  prRequest: PRRequest,
  prData: GitHubPRResponse
): Promise<void> {
  await supabase.from('audit_logs').insert({
    event_type: 'GUARDIAN_PR_CREATED',
    event_category: 'SYSTEM',
    operation: 'CREATE_PULL_REQUEST',
    resource_type: 'pull_request',
    resource_id: prData.number.toString(),
    success: true,
    metadata: {
      pr_number: prData.number,
      pr_url: prData.html_url,
      issue_id: prRequest.issue.id,
      action_id: prRequest.action.id,
      strategy: prRequest.action.strategy,
      severity: prRequest.issue.severity,
      files_changed: prRequest.changes.length,
    },
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log PR error to audit trail
 */
async function logPRError(
  supabase: any,
  prRequest: PRRequest,
  error: string
): Promise<void> {
  await supabase.from('audit_logs').insert({
    event_type: 'GUARDIAN_PR_FAILED',
    event_category: 'SYSTEM',
    operation: 'CREATE_PULL_REQUEST',
    resource_type: 'pull_request',
    success: false,
    error_message: error,
    metadata: {
      issue_id: prRequest.issue.id,
      action_id: prRequest.action.id,
      strategy: prRequest.action.strategy,
    },
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log PR merge to audit trail
 */
async function logPRMerge(supabase: any, prNumber: number): Promise<void> {
  await supabase.from('audit_logs').insert({
    event_type: 'GUARDIAN_PR_MERGED',
    event_category: 'SYSTEM',
    operation: 'MERGE_PULL_REQUEST',
    resource_type: 'pull_request',
    resource_id: prNumber.toString(),
    success: true,
    metadata: {
      pr_number: prNumber,
      auto_merged: true,
    },
    timestamp: new Date().toISOString(),
  })
}
