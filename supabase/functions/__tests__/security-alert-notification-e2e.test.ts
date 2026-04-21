/**
 * Security Alert Notification — End-to-End Integration Test (GRD-5)
 *
 * Verifies the full flow: insert alert → processor picks it up →
 * notifications attempted → alert marked as notified → audit trail.
 *
 * Covers the pipeline enabled by GRD-1:
 *   security_alerts (pending) → security-alert-processor →
 *   MailerSend/Twilio/Slack (external) + security_notifications (internal) →
 *   alert status: notification_sent=true
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SB_SECRET_KEY)
 * Run:
 *   deno test --allow-net --allow-env --allow-read \
 *     supabase/functions/__tests__/security-alert-notification-e2e.test.ts
 *
 * Synthetic data only (Rule #15) — all test alerts tagged with
 * metadata.source='grd5-e2e-test' for easy cleanup.
 */

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  TEST_TENANT_ID,
  assert,
  requireEnv,
} from "./helpers/test-config.ts";

const TEST_SOURCE_TAG = "grd5-e2e-test";

// --- Helpers -------------------------------------------------------------

interface InsertedAlert {
  id: string;
  severity: string;
  notification_sent: boolean;
}

async function supabaseFetch(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<Response> {
  const { method = "GET", body, headers = {} } = options;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function insertTestAlert(severity: "critical" | "high"): Promise<InsertedAlert> {
  const response = await supabaseFetch("security_alerts", {
    method: "POST",
    body: {
      tenant_id: TEST_TENANT_ID,
      severity,
      category: "security",
      title: `[E2E TEST] ${severity} alert for GRD-5 verification`,
      message: "Synthetic test alert — safe to ignore. Created by grd5-e2e-test.",
      status: "pending",
      notification_sent: false,
      escalated: severity === "critical",
      escalation_level: severity === "critical" ? 2 : 0,
      metadata: {
        source: TEST_SOURCE_TAG,
        timestamp: new Date().toISOString(),
      },
    },
  });

  assert(response.ok, `Failed to insert test alert: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as InsertedAlert[];
  return data[0];
}

async function getAlertStatus(alertId: string): Promise<InsertedAlert | null> {
  const response = await supabaseFetch(
    `security_alerts?id=eq.${alertId}&select=id,severity,notification_sent`
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as InsertedAlert[];
  return rows[0] ?? null;
}

async function countInternalNotifications(alertId: string): Promise<number> {
  const response = await supabaseFetch(
    `security_notifications?metadata->>alert_id=eq.${alertId}&select=id`
  );
  if (!response.ok) return 0;
  const rows = (await response.json()) as Array<{ id: string }>;
  return rows.length;
}

async function cleanupTestAlerts(): Promise<void> {
  await supabaseFetch(
    `security_alerts?metadata->>source=eq.${TEST_SOURCE_TAG}`,
    { method: "DELETE" }
  );
  await supabaseFetch(
    `security_notifications?metadata->>source=eq.security-alert-processor&type=eq.guardian_alert&title=ilike.%5BE2E TEST%25`,
    { method: "DELETE" }
  );
}

async function triggerProcessor(alertId: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/security-alert-processor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ alert_id: alertId }),
  });
  const body = await response.json();
  return { status: response.status, body };
}

// --- Tests ---------------------------------------------------------------

Deno.test("GRD-5: processor rejects unauthenticated calls", async () => {
  requireEnv();
  await cleanupTestAlerts();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/security-alert-processor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  assert(
    response.status === 401,
    `Expected 401 for unauthenticated call, got ${response.status}`
  );
  await response.body?.cancel();
});

Deno.test("GRD-5: processor rejects invalid Bearer tokens", async () => {
  requireEnv();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/security-alert-processor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer not-a-real-secret-12345",
    },
    body: JSON.stringify({}),
  });

  assert(
    response.status === 401,
    `Expected 401 for invalid Bearer token, got ${response.status}. ` +
      `This would be a CRITICAL regression — the previous auth logic accepted ANY Bearer token.`
  );
  await response.body?.cancel();
});

Deno.test("GRD-5: critical alert triggers full notification pipeline", async () => {
  requireEnv();
  await cleanupTestAlerts();

  // 1. Insert a critical test alert
  const alert = await insertTestAlert("critical");
  assert(alert.id, "Alert should be inserted with an id");
  assert(
    alert.notification_sent === false,
    "New alert should start with notification_sent=false"
  );

  // 2. Trigger the processor directly for this alert
  const { status, body } = await triggerProcessor(alert.id);
  assert(status === 200, `Processor should return 200, got ${status}: ${JSON.stringify(body)}`);

  // 3. Verify the alert's notification_sent was flipped to true.
  //    (May be true=success OR true=attempted; either way the processor ran.)
  const updated = await getAlertStatus(alert.id);
  assert(updated !== null, "Alert should still exist after processing");
  assert(
    updated!.notification_sent === true,
    `After processing, notification_sent should be true (was ${updated!.notification_sent}). ` +
      `If this fails, the processor is not updating the alert status — GRD-1 regression.`
  );

  // 4. Verify an internal notification was created for the in-app panel.
  //    (GRD-1 replaced external PagerDuty with security_notifications insert.)
  const notificationCount = await countInternalNotifications(alert.id);
  assert(
    notificationCount >= 1,
    `Expected >=1 internal notification for critical alert, got ${notificationCount}. ` +
      `If this fails, the PagerDuty→internal swap is broken.`
  );

  await cleanupTestAlerts();
});

Deno.test("GRD-5: high-severity alert uses email+slack (no internal notification)", async () => {
  requireEnv();
  await cleanupTestAlerts();

  const alert = await insertTestAlert("high");

  const { status } = await triggerProcessor(alert.id);
  assert(status === 200, `Processor should return 200, got ${status}`);

  // High alerts don't trigger the internal (formerly "pagerduty") channel —
  // only critical or escalated alerts do. Verify that the internal panel
  // does NOT get flooded with high-severity alerts.
  const notificationCount = await countInternalNotifications(alert.id);
  assert(
    notificationCount === 0,
    `High-severity alerts should NOT write to security_notifications (got ${notificationCount}). ` +
      `Only critical/escalated should route there.`
  );

  await cleanupTestAlerts();
});

Deno.test("GRD-5: processor is idempotent — re-processing a notified alert is a no-op", async () => {
  requireEnv();
  await cleanupTestAlerts();

  const alert = await insertTestAlert("critical");
  const first = await triggerProcessor(alert.id);
  assert(first.status === 200, "First run should succeed");

  const beforeSecondRun = await countInternalNotifications(alert.id);

  // Re-run — the processor's WHERE clause filters on notification_sent=false,
  // so this run should process 0 alerts.
  const second = await triggerProcessor(alert.id);
  assert(second.status === 200, "Second run should also return 200");

  const afterSecondRun = await countInternalNotifications(alert.id);
  assert(
    afterSecondRun === beforeSecondRun,
    `Re-running the processor should not duplicate notifications. ` +
      `Before: ${beforeSecondRun}, After: ${afterSecondRun}`
  );

  await cleanupTestAlerts();
});
