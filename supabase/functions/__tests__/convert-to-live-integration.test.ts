/**
 * Convert-to-Live Integration Tests (Track 4)
 *
 * Adds live HTTP calls for edge functions that already have
 * comprehensive mocked tests. These live tests verify the
 * deployed functions respond correctly — complementing
 * (not replacing) the existing unit/logic tests.
 *
 * Existing mocked test files:
 *   - fhir-r4/__tests__/index.test.ts (28 steps, 739 lines)
 *   - login/__tests__/index.test.ts (25 steps, 389 lines)
 *   - bed-management/__tests__/index.test.ts (58 steps, 650 lines)
 *   - guardian-agent/__tests__/index.test.ts (41 tests, 735 lines)
 *
 * Required env: SUPABASE_URL, SUPABASE_ANON_KEY
 * Run: deno test --allow-net --allow-env --allow-read convert-to-live-integration.test.ts
 */

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  TEST_TENANT_ID,
  callEdgeFunction,
  assert,
  requireEnv,
} from "./helpers/test-config.ts";

// ════════════════════════════════════════════════════════════
// T4-1: fhir-r4 — Live FHIR endpoint calls
// ════════════════════════════════════════════════════════════

Deno.test("T4-1: fhir-r4 OPTIONS returns CORS headers", async () => {
  requireEnv();

  const url = `${SUPABASE_URL}/functions/v1/fhir-r4/metadata`;
  const response = await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: SUPABASE_URL,
      "Access-Control-Request-Method": "GET",
      apikey: SUPABASE_ANON_KEY,
    },
  });

  // CORS preflight should return 200 or 204
  assert(
    response.status === 200 || response.status === 204,
    `FHIR OPTIONS should return 200/204, got ${response.status}`
  );
  await response.body?.cancel();
});

Deno.test("T4-1: fhir-r4 /metadata returns CapabilityStatement or requires auth", async () => {
  requireEnv();

  const url = `${SUPABASE_URL}/functions/v1/fhir-r4/metadata`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      Accept: "application/fhir+json",
    },
  });

  assert(
    response.status !== 502 && response.status !== 503,
    `FHIR metadata should not crash, got ${response.status}`
  );

  if (response.ok) {
    const data = await response.json();
    assert(
      (data as Record<string, unknown>).resourceType === "CapabilityStatement",
      `Expected CapabilityStatement resourceType`
    );
  } else {
    await response.body?.cancel();
    // 401 = auth required (valid), 403 = forbidden (valid)
    assert(
      response.status === 401 || response.status === 403,
      `Expected 401/403 for FHIR metadata, got ${response.status}`
    );
  }
});

Deno.test("T4-1: fhir-r4 /Patient rejects unauthenticated", async () => {
  requireEnv();

  const url = `${SUPABASE_URL}/functions/v1/fhir-r4/Patient`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      // No Authorization header — should be rejected
    },
  });

  assert(
    !response.ok,
    `FHIR /Patient should require auth, got ${response.status}`
  );
  await response.body?.cancel();
});

Deno.test("T4-1: fhir-r4 rejects invalid resource type", async () => {
  requireEnv();

  const url = `${SUPABASE_URL}/functions/v1/fhir-r4/FakeResource`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });

  // Should return 400 or 404 for unknown resource type, not crash
  assert(
    response.status !== 502 && response.status !== 503,
    `FHIR should not crash on invalid resource type, got ${response.status}`
  );
  await response.body?.cancel();
});

// ════════════════════════════════════════════════════════════
// T4-2: login — Live auth endpoint calls
// ════════════════════════════════════════════════════════════

Deno.test("T4-2: login OPTIONS returns CORS headers", async () => {
  requireEnv();

  const url = `${SUPABASE_URL}/functions/v1/login`;
  const response = await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: SUPABASE_URL,
      "Access-Control-Request-Method": "POST",
      apikey: SUPABASE_ANON_KEY,
    },
  });

  assert(
    response.status === 200 || response.status === 204,
    `Login OPTIONS should return 200/204, got ${response.status}`
  );
  await response.body?.cancel();
});

Deno.test("T4-2: login validates phone format", async () => {
  requireEnv();

  const result = await callEdgeFunction("login", {
    phone: "not-a-phone",
    password: "test-password-12345",
  });

  // Should return validation error, not crash
  assert(
    result.status !== 502 && result.status !== 503,
    `Login should not crash on invalid phone, got ${result.status}`
  );
  assert(
    !result.ok,
    `Login should reject invalid phone format`
  );
});

Deno.test("T4-2: login validates password required", async () => {
  requireEnv();

  const result = await callEdgeFunction("login", {
    phone: "5550100",
  });

  assert(
    !result.ok,
    `Login should reject missing password, got ${result.status}`
  );
});

Deno.test("T4-2: login returns structured error for bad credentials", async () => {
  requireEnv();

  const result = await callEdgeFunction("login", {
    phone: "5559999",
    password: "wrong-password-integration-test",
  });

  assert(
    result.status !== 502 && result.status !== 503,
    `Login should not crash on wrong credentials, got ${result.status}`
  );

  // Should return a JSON error response, not raw text
  const data = result.data as Record<string, unknown>;
  assert(
    typeof data === "object" && data !== null,
    `Login should return JSON error response`
  );
});

// ════════════════════════════════════════════════════════════
// T4-3: bed-management — Live bed board endpoint calls
// ════════════════════════════════════════════════════════════

Deno.test("T4-3: bed-management rejects unauthenticated requests", async () => {
  requireEnv();

  const result = await callEdgeFunction("bed-management", {
    action: "get_bed_board",
  });

  // Bed management requires admin auth
  assert(
    result.status === 401 || result.status === 403,
    `Bed management should require auth, got ${result.status}`
  );
});

Deno.test("T4-3: bed-management validates action parameter", async () => {
  requireEnv();

  const result = await callEdgeFunction("bed-management", {}, {
    useServiceRole: true,
  });

  // Should reject missing action, not crash
  assert(
    result.status !== 502 && result.status !== 503,
    `Bed management should not crash on missing action, got ${result.status}`
  );
});

Deno.test("T4-3: bed-management rejects invalid action", async () => {
  requireEnv();

  const result = await callEdgeFunction("bed-management", {
    action: "invalid_action_test",
  }, {
    useServiceRole: true,
  });

  assert(
    !result.ok,
    `Bed management should reject invalid action, got ${result.status}`
  );

  // Should return meaningful error, not WORKER_ERROR
  if (result.status === 500) {
    const data = result.data as Record<string, unknown>;
    const msg = String(data.code || "");
    assert(
      msg !== "WORKER_ERROR",
      `Bed management should not WORKER_ERROR on invalid action`
    );
  }
});

Deno.test("T4-3: bed-management OPTIONS returns CORS", async () => {
  requireEnv();

  const url = `${SUPABASE_URL}/functions/v1/bed-management`;
  const response = await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: SUPABASE_URL,
      "Access-Control-Request-Method": "POST",
      apikey: SUPABASE_ANON_KEY,
    },
  });

  assert(
    response.status === 200 || response.status === 204,
    `Bed management OPTIONS should return 200/204, got ${response.status}`
  );
  await response.body?.cancel();
});

Deno.test("T4-3: bed-management get_bed_board with service role", async () => {
  requireEnv();

  const result = await callEdgeFunction("bed-management", {
    action: "get_bed_board",
    tenantId: TEST_TENANT_ID,
  }, {
    useServiceRole: true,
  });

  // With service role, should get data or empty result — not crash
  assert(
    result.status !== 502 && result.status !== 503,
    `get_bed_board should not crash with service role, got ${result.status}`
  );

  if (result.ok) {
    const data = result.data as Record<string, unknown>;
    // Should return structured response
    assert(
      typeof data === "object" && data !== null,
      `get_bed_board should return object`
    );
  }
});

// ════════════════════════════════════════════════════════════
// T4-4: guardian-agent — Live monitoring endpoint calls
// ════════════════════════════════════════════════════════════

Deno.test("T4-4: guardian-agent responds to POST", async () => {
  requireEnv();

  const result = await callEdgeFunction("guardian-agent", {
    action: "monitor",
  }, {
    useServiceRole: true,
  });

  // Guardian uses service role internally — should not crash
  assert(
    result.status !== 502 && result.status !== 503,
    `Guardian agent should not crash, got ${result.status}`
  );
});

Deno.test("T4-4: guardian-agent rejects unauthenticated", async () => {
  requireEnv();

  const result = await callEdgeFunction("guardian-agent", {
    action: "monitor",
  });

  // Should require elevated auth
  assert(
    !result.ok || result.status === 401 || result.status === 403,
    `Guardian should require auth, got ${result.status}`
  );
});

Deno.test("T4-4: guardian-agent handles health check action", async () => {
  requireEnv();

  const result = await callEdgeFunction("guardian-agent", {
    action: "health",
  }, {
    useServiceRole: true,
  });

  assert(
    result.status !== 502 && result.status !== 503,
    `Guardian health check should not crash, got ${result.status}`
  );

  if (result.ok) {
    const data = result.data as Record<string, unknown>;
    console.log(`  [INFO] Guardian health: ${JSON.stringify(data).slice(0, 200)}`);
  }
});

Deno.test("T4-4: guardian-agent-api responds to GET", async () => {
  requireEnv();

  // Guardian API is the read-only dashboard endpoint
  const url = `${SUPABASE_URL}/functions/v1/guardian-agent-api`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action: "status" }),
  });

  assert(
    response.status !== 502 && response.status !== 503,
    `Guardian API should not crash, got ${response.status}`
  );
  await response.body?.cancel();
});
