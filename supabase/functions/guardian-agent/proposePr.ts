/**
 * Guardian `propose_pr` action — the browser-side healer's ONLY path to a PR.
 *
 * Option B contract (ratified 2026-07-23): the Guardian may auto-OPEN a pull
 * request proposing a fix; merging is a human act. The browser cannot hold the
 * internal secret guardian-pr-service requires, so this server-side relay:
 *
 *   1. Dedupes by issue signature (category + component, pending tickets)
 *   2. Enforces the max-3-open-Guardian-PRs cap
 *   3. Creates the guardian_review_tickets row via create_guardian_review_ticket
 *      (which itself writes the linked security_alerts row + Guardian Eyes
 *      detection snapshot — the Paper Trail Contract's DB legs)
 *   4. Calls guardian-pr-service (X-Cron-Secret, server-to-server) to open the
 *      PR. The changed file is ALWAYS a proposal document under
 *      docs/guardian/proposals/ with a server-constructed path — a browser
 *      caller can never choose an arbitrary repo path.
 *   5. Links the PR URL back onto the ticket + alert metadata.
 *
 * SMS leg: the security-alert-processor cron (every minute) delivers
 * critical/high alerts to SECURITY_ALERT_PHONES — no direct send here.
 */

// Use the exact client type the shared module exports
import { createAdminClient } from "../_shared/supabaseClient.ts";
type AdminClient = ReturnType<typeof createAdminClient>;

export interface ProposePrIssue {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  affectedComponent?: string;
  affectedResources?: string[];
  filePath?: string;
  lineNumber?: number;
  stackTrace?: string;
  detectionContext?: Record<string, unknown>;
}

export interface ProposePrHealing {
  strategy: string;
  description: string;
  steps?: unknown[];
  rollbackPlan?: unknown[];
  expectedOutcome?: string;
}

export interface ProposePrRequest {
  issue: ProposePrIssue;
  healing: ProposePrHealing;
  /** Free-text evidence/summary the healer collected (rendered into the proposal doc) */
  evidence?: string;
}

export interface ProposePrResult {
  success: boolean;
  ticketId?: string;
  prUrl?: string;
  prNumber?: number;
  deduped?: boolean;
  rateLimited?: boolean;
  error?: string;
}

const MAX_OPEN_GUARDIAN_PRS = 3;

function sanitizeId(raw: string): string {
  return (raw || "issue").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "issue";
}

export async function handleProposePr(
  supabase: AdminClient,
  tenantId: string,
  request: ProposePrRequest,
): Promise<ProposePrResult> {
  const issue = request.issue;
  const healing = request.healing;
  if (!issue?.id || !issue?.category || !issue?.severity || !healing?.strategy) {
    return { success: false, error: "issue{id,category,severity} and healing{strategy} are required" };
  }

  const component = issue.affectedComponent ?? issue.filePath ?? "unknown";

  // 1) Dedupe — an open (pending) ticket for the same signature means the
  //    proposal already exists; do not spam a second PR for a flapping error.
  const { data: existing } = await supabase
    .from("guardian_review_tickets")
    .select("id, review_metadata")
    .eq("status", "pending")
    .eq("issue_category", issue.category)
    .eq("affected_component", component)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const meta = (existing.review_metadata ?? {}) as Record<string, unknown>;
    return {
      success: true,
      deduped: true,
      ticketId: existing.id as string,
      prUrl: typeof meta.pr_url === "string" ? meta.pr_url : undefined,
    };
  }

  // 2) Rate limit — max open Guardian PRs at once
  const { count: openPrCount } = await supabase
    .from("guardian_review_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .not("review_metadata->>pr_url", "is", null);

  const rateLimited = (openPrCount ?? 0) >= MAX_OPEN_GUARDIAN_PRS;

  // 3) Review ticket (RPC also writes the linked security_alerts row +
  //    Guardian Eyes detection snapshot)
  const { data: ticketId, error: ticketError } = await supabase.rpc(
    "create_guardian_review_ticket",
    {
      p_issue_id: issue.id,
      p_issue_category: issue.category,
      p_issue_severity: issue.severity,
      p_issue_description: issue.description ?? null,
      p_affected_component: component,
      p_affected_resources: issue.affectedResources ?? null,
      p_stack_trace: issue.stackTrace ?? null,
      p_detection_context: { ...(issue.detectionContext ?? {}), tenant_id: tenantId },
      p_action_id: `propose-pr-${sanitizeId(issue.id)}`,
      p_healing_strategy: healing.strategy,
      p_healing_description: healing.description ?? "Guardian proposed code fix (PR)",
      p_healing_steps: healing.steps ?? [],
      p_rollback_plan: healing.rollbackPlan ?? ["Close the PR without merging; no code has changed."],
      p_expected_outcome: healing.expectedOutcome ?? null,
      p_sandbox_tested: false,
      p_sandbox_results: {},
      p_sandbox_passed: null,
    },
  );

  if (ticketError || !ticketId) {
    return { success: false, error: `ticket creation failed: ${ticketError?.message ?? "no id returned"}` };
  }

  if (rateLimited) {
    // Paper trail exists (ticket + alert); PR deliberately withheld.
    return { success: true, ticketId: ticketId as string, rateLimited: true };
  }

  // 4) Open the PR via the hardened internal service
  const internalSecret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("SB_SECRET_KEY") ?? "";
  const baseUrl = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
  if (!internalSecret || !baseUrl) {
    return { success: true, ticketId: ticketId as string, error: "PR service credentials unavailable — ticket + alert created, PR skipped" };
  }

  const safeId = sanitizeId(issue.id);
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const proposalPath = `docs/guardian/proposals/guardian-proposal-${safeId}.md`;

  const proposalDoc = [
    `# Guardian Fix Proposal — ${issue.category}`,
    "",
    `> Auto-opened by the Guardian Agent (Option B). This PR is a PROPOSAL — merging is a human decision.`,
    "",
    `## Issue`,
    `- **ID:** ${issue.id}`,
    `- **Severity:** ${issue.severity}`,
    `- **Component:** ${component}${issue.lineNumber ? ` (line ${issue.lineNumber})` : ""}`,
    `- **Description:** ${issue.description}`,
    issue.affectedResources?.length ? `- **Affected resources:** ${issue.affectedResources.join(", ")}` : "",
    "",
    `## Proposed healing`,
    `- **Strategy:** ${healing.strategy}`,
    `- **Description:** ${healing.description}`,
    healing.expectedOutcome ? `- **Expected outcome:** ${healing.expectedOutcome}` : "",
    "",
    `## Evidence`,
    request.evidence ?? "_Collected context is attached to the review ticket._",
    "",
    `## Paper trail`,
    `- Review ticket: ${ticketId}`,
    `- Tenant: ${tenantId}`,
    `- Rollback: close this PR without merging; no code has changed.`,
    "",
    issue.stackTrace ? "## Stack trace\n```\n" + issue.stackTrace.slice(0, 4000) + "\n```" : "",
  ].filter((line) => line !== "").join("\n");

  const prResponse = await fetch(`${baseUrl}/functions/v1/guardian-pr-service`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Cron-Secret": internalSecret,
    },
    body: JSON.stringify({
      action: "create_pr",
      data: {
        issue: {
          id: issue.id,
          category: issue.category,
          severity: issue.severity,
          description: issue.description,
          affectedResources: issue.affectedResources ?? [component],
        },
        action: {
          id: `propose-pr-${safeId}`,
          strategy: healing.strategy,
          description: healing.description,
        },
        changes: [
          {
            operation: "create",
            filePath: proposalPath,
            newContent: proposalDoc,
          },
        ],
        branchName: `guardian/fix-${safeId}-${dateStamp}`,
      },
    }),
  });

  const prResult = (await prResponse.json().catch(() => ({}))) as {
    success?: boolean; prNumber?: number; prUrl?: string; error?: string;
  };

  if (!prResponse.ok || !prResult.success) {
    // Ticket + alert stand; PR failure is reported, not swallowed.
    return {
      success: true,
      ticketId: ticketId as string,
      error: `PR creation failed: ${prResult.error ?? prResponse.statusText}`,
    };
  }

  // 5) Link the PR onto the ticket + its alert
  await supabase
    .from("guardian_review_tickets")
    .update({
      review_metadata: { pr_url: prResult.prUrl, pr_number: prResult.prNumber, pr_opened_at: new Date().toISOString() },
    })
    .eq("id", ticketId);

  const { data: linkedAlert } = await supabase
    .from("security_alerts")
    .select("id, metadata")
    .eq("metadata->>ticket_id", ticketId)
    .maybeSingle();
  if (linkedAlert) {
    await supabase
      .from("security_alerts")
      .update({
        metadata: {
          ...((linkedAlert.metadata ?? {}) as Record<string, unknown>),
          pr_url: prResult.prUrl,
          pr_number: prResult.prNumber,
        },
      })
      .eq("id", linkedAlert.id);
  }

  return {
    success: true,
    ticketId: ticketId as string,
    prUrl: prResult.prUrl,
    prNumber: prResult.prNumber,
  };
}
