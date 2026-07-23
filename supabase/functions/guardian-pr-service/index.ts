/**
 * Guardian Agent PR Service - GitHub Pull Request Creation
 *
 * This Edge Function handles Git operations for the Guardian Agent.
 * Browser code cannot access Git/GitHub APIs, so this runs server-side.
 *
 * Features:
 * - Create a branch for a Guardian fix + commit the changes
 * - Open a pull request with full metadata, labels, and requested reviewers
 * - Report PR status
 * - Full audit trail in audit_logs
 *
 * OPTION B (Maria, 2026-07-23): this service PROPOSES only. It can open a PR;
 * it CANNOT merge one. Merging is a deliberate human act (Maria approves from
 * the GitHub mobile app). There is intentionally NO merge action here — an
 * unreviewed auto-merge to `main` is Tier-4 forbidden (ai-repair-authority.md).
 *
 * AUTH (hardened 2026-07-23): internal-only. The caller must present a valid
 * cron/service secret (X-Cron-Secret header OR Bearer == CRON_SECRET /
 * SB_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY). verify_jwt is false (the Guardian
 * cron caller presents no Supabase user JWT), so this in-code secret check is
 * the auth boundary — the CORS origin check alone is NOT auth (Origin is
 * forgeable by non-browser callers). See adversarial-audit-lessons.md #2.
 *
 * HIPAA Compliant: All operations logged to audit_logs.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseClient.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

// Use the exact client type the shared module exports (avoids supabase-js
// minor-version type clashes from a second import).
type AdminClient = ReturnType<typeof createAdminClient>;

// ---- Domain types (caller payload) ----
interface PRChange {
  operation: "create" | "update" | "delete";
  filePath: string;
  newContent: string;
}
interface PRIssue {
  id: string;
  category: string;
  severity: string;
  description: string;
  affectedResources: string[];
}
interface PRAction {
  id: string;
  strategy: string;
  description: string;
}
interface PRRequest {
  issue: PRIssue;
  action: PRAction;
  changes: PRChange[];
  branchName?: string;
  baseBranch?: string;
  reviewers?: string[];
}

// ---- Minimal GitHub API response shapes ----
interface GitHubRef {
  object: { sha: string };
}
interface GitHubContent {
  sha: string;
}
interface GitHubPR {
  number: number;
  html_url: string;
}
interface GitHubError {
  message?: string;
}

interface CreatePRResult {
  success: boolean;
  prNumber?: number;
  prUrl?: string;
  error?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  // Get CORS headers for this origin
  const { headers: corsHeaders, allowed } = corsFromRequest(req);

  // Reject requests from unauthorized origins (defense in depth — NOT the auth boundary)
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  // ---- AUTH: internal-only. Cron/service secret required. ----
  // Accept EITHER a valid X-Cron-Secret header OR a Bearer token equal to
  // CRON_SECRET / SB_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY (legacy fallback).
  const headerSecret = req.headers.get("X-Cron-Secret");
  const bearerToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const candidateSecret = headerSecret ?? bearerToken;
  const acceptedSecrets = [
    Deno.env.get("CRON_SECRET"),
    Deno.env.get("SB_SECRET_KEY"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  ].filter((s): s is string => typeof s === "string" && s.length > 0);
  const isAuthorized =
    typeof candidateSecret === "string" &&
    candidateSecret.length > 0 &&
    acceptedSecrets.some((s) => s === candidateSecret);

  if (!isAuthorized) {
    return new Response(
      JSON.stringify({ error: "Unauthorized — cron/service secret required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const githubToken = Deno.env.get("GITHUB_TOKEN") ?? "";
    const githubOwner = Deno.env.get("GITHUB_OWNER") ?? "";
    const githubRepo = Deno.env.get("GITHUB_REPO") ?? "";
    if (!githubToken || !githubOwner || !githubRepo) {
      return new Response(
        JSON.stringify({
          error:
            "GitHub credentials not configured. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createAdminClient();
    const body = (await req.json()) as { action: string; data: unknown };
    const { action, data } = body;

    switch (action) {
      case "create_pr": {
        const result = await createPullRequest(
          supabase,
          githubToken,
          githubOwner,
          githubRepo,
          data as PRRequest,
        );
        return new Response(JSON.stringify(result), { headers: corsHeaders });
      }
      case "get_pr_status": {
        const { prNumber } = data as { prNumber: number };
        const status = await getPRStatus(githubToken, githubOwner, githubRepo, prNumber);
        return new Response(JSON.stringify(status), { headers: corsHeaders });
      }
      // NOTE: there is intentionally NO "merge_pr" action. Guardian proposes;
      // a human disposes. Do not re-add a programmatic merge here (Option B).
      default:
        throw new Error(`Unknown or unsupported action: ${action}`);
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 400,
      headers: corsHeaders,
    });
  }
});

/**
 * Create a pull request with Guardian Agent changes
 */
async function createPullRequest(
  supabase: AdminClient,
  githubToken: string,
  owner: string,
  repo: string,
  prRequest: PRRequest,
): Promise<CreatePRResult> {
  try {
    const branchName = prRequest.branchName || `guardian-agent/${prRequest.issue.id}`;
    const baseBranch = prRequest.baseBranch || "main";

    // 1. Get the base branch SHA
    const baseBranchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`,
      { headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github.v3+json" } },
    );
    if (!baseBranchResponse.ok) {
      throw new Error(`Failed to get base branch: ${baseBranchResponse.statusText}`);
    }
    const baseBranchData = (await baseBranchResponse.json()) as GitHubRef;
    const baseSha = baseBranchData.object.sha;

    // 2. Create a new branch from base
    const createBranchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
      },
    );
    if (!createBranchResponse.ok) {
      const errorData = (await createBranchResponse.json()) as GitHubError;
      throw new Error(`Failed to create branch: ${errorData.message || createBranchResponse.statusText}`);
    }

    // 3. Pre-fetch existing file SHAs (needed for update/delete), then commit sequentially
    const fileChecks = await Promise.all(
      prRequest.changes.map((change) =>
        change.operation === "update" || change.operation === "delete"
          ? fetch(
              `https://api.github.com/repos/${owner}/${repo}/contents/${change.filePath}?ref=${branchName}`,
              { headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github.v3+json" } },
            ).then((res) => (res.ok ? (res.json() as Promise<GitHubContent>) : null))
          : Promise.resolve(null),
      ),
    );

    for (let i = 0; i < prRequest.changes.length; i++) {
      const change = prRequest.changes[i];
      const fileSha = fileChecks[i]?.sha;
      await createCommitWithSha(
        githubToken,
        owner,
        repo,
        branchName,
        change,
        fileSha,
        `Guardian Agent: ${prRequest.action.strategy} - ${change.filePath}`,
      );
    }

    // 4. Create the pull request
    const prTitle = `[Guardian Agent] ${prRequest.action.strategy}: ${prRequest.issue.category}`;
    const prBody = generatePRDescription(prRequest);
    const createPRResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: prTitle, head: branchName, base: baseBranch, body: prBody, draft: false }),
    });
    if (!createPRResponse.ok) {
      const errorData = (await createPRResponse.json()) as GitHubError;
      throw new Error(`Failed to create PR: ${errorData.message || createPRResponse.statusText}`);
    }
    const prData = (await createPRResponse.json()) as GitHubPR;

    // 5. Add labels
    await addLabelsToPR(githubToken, owner, repo, prData.number, [
      "guardian-agent",
      `severity:${prRequest.issue.severity}`,
      "auto-generated",
    ]);

    // 6. Request reviews if specified
    if (prRequest.reviewers && prRequest.reviewers.length > 0) {
      await requestReviewers(githubToken, owner, repo, prData.number, prRequest.reviewers);
    }

    // 7. Audit trail
    await logPRCreation(supabase, prRequest, prData);

    return { success: true, prNumber: prData.number, prUrl: prData.html_url };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logPRError(supabase, prRequest, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Create or update a file on a branch with a pre-fetched SHA
 */
async function createCommitWithSha(
  githubToken: string,
  owner: string,
  repo: string,
  branch: string,
  change: PRChange,
  currentSha: string | undefined,
  message: string,
): Promise<void> {
  const updateFileResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${change.filePath}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, content: btoa(change.newContent), sha: currentSha, branch }),
    },
  );
  if (!updateFileResponse.ok) {
    const errorData = (await updateFileResponse.json()) as GitHubError;
    throw new Error(`Failed to commit file ${change.filePath}: ${errorData.message}`);
  }
}

/**
 * Add labels to a PR
 */
async function addLabelsToPR(
  githubToken: string,
  owner: string,
  repo: string,
  prNumber: number,
  labels: string[],
): Promise<void> {
  await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/labels`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ labels }),
  });
}

/**
 * Request reviewers for a PR
 */
async function requestReviewers(
  githubToken: string,
  owner: string,
  repo: string,
  prNumber: number,
  reviewers: string[],
): Promise<void> {
  await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reviewers }),
  });
}

/**
 * Get PR status
 */
async function getPRStatus(
  githubToken: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<GitHubPR> {
  const prResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: { Authorization: `Bearer ${githubToken}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!prResponse.ok) {
    throw new Error("Failed to get PR status");
  }
  return (await prResponse.json()) as GitHubPR;
}

/**
 * Generate PR description (Markdown, developer-facing on GitHub)
 */
function generatePRDescription(prRequest: PRRequest): string {
  const lines: string[] = [];
  lines.push("## Guardian Agent Auto-Fix");
  lines.push("");
  lines.push("> **This PR was automatically generated by the Guardian Agent.**");
  lines.push("> Review carefully before merging. Guardian cannot merge — merging is a human action.");
  lines.push("");
  lines.push("### Issue Detected");
  lines.push(`- **Category:** ${prRequest.issue.category}`);
  lines.push(`- **Severity:** ${prRequest.issue.severity}`);
  lines.push(`- **Description:** ${prRequest.issue.description}`);
  lines.push("");
  if (prRequest.issue.affectedResources.length > 0) {
    lines.push("**Affected Resources:**");
    prRequest.issue.affectedResources.forEach((resource) => lines.push(`- ${resource}`));
    lines.push("");
  }
  lines.push("### Healing Action");
  lines.push(`- **Strategy:** ${prRequest.action.strategy}`);
  lines.push(`- **Description:** ${prRequest.action.description}`);
  lines.push("");
  lines.push("### Changes Made");
  prRequest.changes.forEach((change) => lines.push(`- \`${change.operation}\` ${change.filePath}`));
  lines.push("");
  lines.push("### Testing Checklist");
  lines.push("- [ ] Automated tests pass");
  lines.push("- [ ] Manual testing completed");
  lines.push("- [ ] No unintended side effects");
  lines.push("- [ ] Security implications reviewed");
  lines.push("");
  lines.push("---");
  lines.push("*Generated by Guardian Agent*");
  return lines.join("\n");
}

/**
 * Log PR creation to audit trail
 */
async function logPRCreation(
  supabase: AdminClient,
  prRequest: PRRequest,
  prData: GitHubPR,
): Promise<void> {
  await supabase.from("audit_logs").insert({
    event_type: "GUARDIAN_PR_CREATED",
    event_category: "SYSTEM",
    operation: "CREATE_PULL_REQUEST",
    resource_type: "pull_request",
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
  });
}

/**
 * Log PR error to audit trail
 */
async function logPRError(
  supabase: AdminClient,
  prRequest: PRRequest,
  error: string,
): Promise<void> {
  await supabase.from("audit_logs").insert({
    event_type: "GUARDIAN_PR_FAILED",
    event_category: "SYSTEM",
    operation: "CREATE_PULL_REQUEST",
    resource_type: "pull_request",
    success: false,
    error_message: error,
    metadata: {
      issue_id: prRequest.issue.id,
      action_id: prRequest.action.id,
      strategy: prRequest.action.strategy,
    },
    timestamp: new Date().toISOString(),
  });
}
