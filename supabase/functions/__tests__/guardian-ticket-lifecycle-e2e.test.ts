/**
 * Guardian Review-Ticket Lifecycle — End-to-End Integration Test (GRD-9)
 *
 * Exercises the FULL approval lifecycle against a LIVE Supabase environment,
 * driving the real RPCs as a real super_admin (no mocks):
 *
 *   create_guardian_review_ticket  → ticket + security_alert + correlated
 *                                     guardian_eyes_recordings row (GRD-6)
 *   approve_guardian_ticket        → ticket 'approved', alert 'resolved'
 *   reject_guardian_ticket         → ticket 'rejected', alert 'false_positive'
 *
 * This test is a permanent regression guard for the three breakages found +
 * fixed on 2026-05-29, each of which made the workflow non-functional:
 *   1. create RPC threw a CHECK violation on alert_type='guardian_approval_required'
 *      → no ticket could ever be created.            (migration 20260529170000)
 *   2. approve_guardian_ticket / reject_guardian_ticket did not exist — dropped
 *      in 20251209110000 and never recreated.        (migration 20260529180000)
 *   3. recordings had no link to tickets.            (migration 20260529160000)
 *
 * Required env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *   (or the SB_ / VITE_ fallbacks resolved by test-config.ts).
 * Run:
 *   deno test --allow-net --allow-env \
 *     supabase/functions/__tests__/guardian-ticket-lifecycle-e2e.test.ts
 *
 * Synthetic data only (Rule #15). All resources are cleaned up in finally.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  TEST_TENANT_ID,
  assert,
} from "./helpers/test-config.ts";

const TEST_EMAIL = "guardian.grd9.e2e@example.com";
const TEST_PASSWORD = "Grd9-E2e-Synthetic-Pass-0001";

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface RpcResult {
  data: unknown;
  error: { message: string } | null;
}

// supabase-js .rpc() is strictly typed only when a generated Database type is
// supplied; these integration tests run untyped, so we adapt at the call
// (transport) boundary — args in, {data,error} out.
function rpc(
  client: ReturnType<typeof adminClient>,
  fn: string,
  args: Record<string, unknown>,
): Promise<RpcResult> {
  return (client as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
  }).rpc(fn, args);
}

function requireLiveEnv(): boolean {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "GRD-9 e2e skipped: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY not set.",
    );
    return false;
  }
  return true;
}

/** Remove any leftover synthetic super_admin from a prior run. */
async function deleteExistingTestUser(admin: ReturnType<typeof adminClient>): Promise<void> {
  const { data } = await admin.auth.admin.listUsers();
  const existing = data?.users?.find((u) => u.email === TEST_EMAIL);
  if (existing) {
    await admin.from("user_roles").delete().eq("user_id", existing.id);
    await admin.from("profiles").delete().eq("user_id", existing.id);
    await admin.auth.admin.deleteUser(existing.id);
  }
}

interface LifecycleContext {
  admin: ReturnType<typeof adminClient>;
  userId: string;
  // user-context client carrying the super_admin JWT
  user: ReturnType<typeof adminClient>;
}

/** Create a synthetic super_admin, return an authenticated client for them. */
async function setupSuperAdmin(): Promise<LifecycleContext> {
  const admin = adminClient();
  await deleteExistingTestUser(admin);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  assert(!createErr, `createUser failed: ${createErr?.message}`);
  const userId = created!.user!.id;

  // handle_new_user already created the profile. The Guardian RPCs gate ONLY
  // on profiles.role (text) — NOT role_id or user_roles. So set just the text
  // column and leave role_id alone: trg_sync_user_roles then fires with an
  // unchanged role_id and its ON CONFLICT (user_id, role_id) DO NOTHING is a
  // clean no-op. (Touching role_id collides with the user_id-only unique on
  // user_roles, whose sync trigger's conflict target is the wrong shape.)
  const { error: profileErr } = await admin
    .from("profiles")
    .update({ tenant_id: TEST_TENANT_ID, role: "super_admin" })
    .eq("user_id", userId);
  assert(!profileErr, `profile update failed: ${profileErr?.message}`);

  // The project enforces hCaptcha on password sign-in, which a headless test
  // can't satisfy. Mint a session via an admin-generated magic link + OTP
  // verification instead (no captcha, no password prompt).
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_EMAIL,
  });
  assert(!linkErr, `generateLink failed: ${linkErr?.message}`);
  const tokenHash = (link as { properties?: { hashed_token?: string } })
    ?.properties?.hashed_token;
  assert(!!tokenHash, "generateLink did not return a hashed_token");

  const user = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: otpErr } = await user.auth.verifyOtp({
    token_hash: tokenHash!,
    type: "email",
  });
  assert(!otpErr, `verifyOtp failed: ${otpErr?.message}`);

  return { admin, userId, user };
}

async function teardown(ctx: LifecycleContext, ticketIds: string[]): Promise<void> {
  const { admin, userId } = ctx;
  for (const ticketId of ticketIds) {
    const { data: t } = await admin
      .from("guardian_review_tickets")
      .select("security_alert_id")
      .eq("id", ticketId)
      .maybeSingle();
    const alertId = (t as { security_alert_id?: string } | null)?.security_alert_id;
    if (alertId) {
      await admin.from("guardian_eyes_recordings").delete().eq("security_alert_id", alertId);
    }
    await admin.from("guardian_review_tickets").delete().eq("id", ticketId);
    if (alertId) {
      await admin.from("security_alerts").delete().eq("id", alertId);
    }
  }
  await admin.from("user_roles").delete().eq("user_id", userId);
  await admin.from("profiles").delete().eq("user_id", userId);
  await admin.auth.admin.deleteUser(userId);
}

function ticketArgs(issueId: string) {
  return {
    p_issue_id: issueId,
    p_issue_category: "security",
    p_issue_severity: "high",
    p_issue_description: `[GRD-9 E2E] ${issueId}`,
    p_affected_component: "auth/login.ts",
    p_affected_resources: ["users", "sessions"],
    p_stack_trace: null,
    p_detection_context: { sessionId: `grd9-${issueId}`, source: "grd9-e2e" },
    p_action_id: `grd9_${issueId}`,
    p_healing_strategy: "block_suspicious_ips",
    p_healing_description: "Temporarily block offending IPs for 24h",
    p_healing_steps: [],
    p_rollback_plan: [],
    p_expected_outcome: "Failed-login storm subsides",
  };
}

Deno.test("GRD-9: security gate — service role (no super_admin) cannot create a ticket", async () => {
  if (!requireLiveEnv()) return;
  const admin = adminClient();
  // service_role has no auth.uid() → the in-function role check must deny.
  const { error } = await rpc(admin, "create_guardian_review_ticket", ticketArgs("gate-check"));
  assert(error !== null, "Expected create_guardian_review_ticket to deny a non-super_admin caller");
  assert(
    /access denied/i.test(error!.message),
    `Expected an access-denied error, got: ${error!.message}`,
  );
});

Deno.test("GRD-9: full lifecycle — create → recording link → approve", async () => {
  if (!requireLiveEnv()) return;
  const ctx = await setupSuperAdmin();
  const ticketIds: string[] = [];
  try {
    // 1. CREATE — regression guard for the CHECK-constraint bug (no ticket
    //    could be created before 20260529170000).
    const { data: ticketId, error: createErr } = await rpc(ctx.user, 
      "create_guardian_review_ticket",
      ticketArgs("approve-path"),
    );
    assert(!createErr, `create failed: ${createErr?.message}`);
    assert(typeof ticketId === "string", "create should return a ticket id");
    ticketIds.push(ticketId as string);

    // 2. The ticket exists with a populated security_alert_id.
    const { data: ticket } = await ctx.admin
      .from("guardian_review_tickets")
      .select("id, status, security_alert_id")
      .eq("id", ticketId)
      .single();
    assert(ticket !== null, "ticket row should exist");
    const alertId = (ticket as { security_alert_id: string }).security_alert_id;
    assert(!!alertId, "ticket.security_alert_id must be populated");

    // 3. GRD-6 — a recording is correlated to the alert.
    const { data: recordings } = await ctx.admin
      .from("guardian_eyes_recordings")
      .select("id, security_alert_id, action, severity")
      .eq("security_alert_id", alertId);
    assert(
      Array.isArray(recordings) && recordings.length >= 1,
      `expected >=1 correlated recording, got ${recordings?.length ?? 0}`,
    );

    // 4. APPROVE — regression guard for the missing-RPC bug. All checkboxes +
    //    notes required.
    const { data: approveRes, error: approveErr } = await rpc(ctx.user, 
      "approve_guardian_ticket",
      {
        p_ticket_id: ticketId,
        p_code_reviewed: true,
        p_impact_understood: true,
        p_rollback_understood: true,
        p_review_notes: "GRD-9 e2e: reviewed, approving.",
      },
    );
    assert(!approveErr, `approve RPC errored: ${approveErr?.message}`);
    assert(
      (approveRes as { success: boolean }).success === true,
      `approve should succeed: ${JSON.stringify(approveRes)}`,
    );

    // 5. State transitions persisted: ticket approved, alert resolved.
    const { data: after } = await ctx.admin
      .from("guardian_review_tickets")
      .select("status, reviewed_by")
      .eq("id", ticketId)
      .single();
    assert((after as { status: string }).status === "approved", "ticket should be 'approved'");
    assert((after as { reviewed_by: string }).reviewed_by === ctx.userId, "reviewed_by should be the reviewer");

    const { data: alert } = await ctx.admin
      .from("security_alerts")
      .select("status")
      .eq("id", alertId)
      .single();
    assert((alert as { status: string }).status === "resolved", "alert should be 'resolved'");
  } finally {
    await teardown(ctx, ticketIds);
  }
});

Deno.test("GRD-9: approve is rejected when a checkbox is unchecked", async () => {
  if (!requireLiveEnv()) return;
  const ctx = await setupSuperAdmin();
  const ticketIds: string[] = [];
  try {
    const { data: ticketId } = await rpc(ctx.user, 
      "create_guardian_review_ticket",
      ticketArgs("checkbox-guard"),
    );
    ticketIds.push(ticketId as string);

    const { data: res } = await rpc(ctx.user, "approve_guardian_ticket", {
      p_ticket_id: ticketId,
      p_code_reviewed: true,
      p_impact_understood: false, // <-- not all checked
      p_rollback_understood: true,
      p_review_notes: "should fail",
    });
    assert(
      (res as { success: boolean }).success === false,
      "approve must fail when a checkbox is unchecked (anti-rubber-stamp)",
    );
  } finally {
    await teardown(ctx, ticketIds);
  }
});

Deno.test("GRD-9: reject path — ticket rejected, alert marked false_positive", async () => {
  if (!requireLiveEnv()) return;
  const ctx = await setupSuperAdmin();
  const ticketIds: string[] = [];
  try {
    const { data: ticketId } = await rpc(ctx.user, 
      "create_guardian_review_ticket",
      ticketArgs("reject-path"),
    );
    ticketIds.push(ticketId as string);

    const { data: rejectRes, error: rejectErr } = await rpc(ctx.user, 
      "reject_guardian_ticket",
      { p_ticket_id: ticketId, p_review_notes: "GRD-9 e2e: not a real issue." },
    );
    assert(!rejectErr, `reject RPC errored: ${rejectErr?.message}`);
    assert((rejectRes as { success: boolean }).success === true, "reject should succeed");

    const { data: ticket } = await ctx.admin
      .from("guardian_review_tickets")
      .select("status, security_alert_id")
      .eq("id", ticketId)
      .single();
    assert((ticket as { status: string }).status === "rejected", "ticket should be 'rejected'");

    const { data: alert } = await ctx.admin
      .from("security_alerts")
      .select("status")
      .eq("id", (ticket as { security_alert_id: string }).security_alert_id)
      .single();
    assert(
      (alert as { status: string }).status === "false_positive",
      "alert should be 'false_positive'",
    );
  } finally {
    await teardown(ctx, ticketIds);
  }
});
