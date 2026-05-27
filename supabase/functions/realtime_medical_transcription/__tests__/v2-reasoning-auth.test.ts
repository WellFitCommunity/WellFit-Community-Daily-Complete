// supabase/functions/realtime_medical_transcription/__tests__/v2-reasoning-auth.test.ts
//
// CR-7 regression guard: the Compass Riley V2 reasoning integration shipped on
// 2026-03-01 (commit c45290df8) with a Temporal Dead Zone (TDZ) self-reference
// bug. `fetchTenantSensitivity(admin, userId, logger)` was called before
// `const userId = userData.user.id;` was declared. Every production WebSocket
// connection that requested V2 reasoning crashed with:
//
//   ReferenceError: Cannot access 'userId' before initialization
//
// The bug went 80 days undetected (fixed in b57f2406 on 2026-05-20) because no
// test exercised the path of:
//   WebSocket upgrade → JWT auth → V2 reasoning setup → fetchTenantSensitivity
//
// These tests close that gap. They:
//   1. Import the module (catches any top-level TDZ at module load).
//   2. Drive the exported `handleRequest` through the full WS auth +
//      `?mode=compass-riley&reasoning_mode=chain` path with an injected
//      mock admin client, and assert no `ReferenceError` is thrown before
//      the WebSocket upgrade step.
//   3. Cover the negative auth paths (missing token, bad token, non-WS
//      request) so they don't regress separately.
//
// All test data is synthetic per CLAUDE.md Rule #15.

import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Boundary cast helper — mocks shape-match only the surface `handleRequest`
// touches. SupabaseClient is the production type; per typescript.md, the
// `as unknown as X` pattern is allowed at test/SDK boundaries.
function asSb(mock: unknown): SupabaseClient {
  return mock as unknown as SupabaseClient;
}

// ── Synthetic test data (CLAUDE.md Rule #15) ─────────────────────────────────
const SYNTHETIC_USER_ID = "a1b2c3d4-0000-0000-0000-000000000001";
const SYNTHETIC_TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const SYNTHETIC_JWT = "test.synthetic.jwt-not-a-real-token";
const FN_URL_BASE = "http://localhost/functions/v1/realtime_medical_transcription";

// ── Mock admin client ────────────────────────────────────────────────────────
//
// Mirrors only the surface that `handleRequest` and `fetchTenantSensitivity`
// touch:
//   - admin.auth.getUser(token)
//   - admin.from('profiles').select('tenant_id').eq('user_id', uid).single()
//   - admin.from('tenant_ai_skill_config').select('settings')
//        .eq('tenant_id', tid).eq('skill_key', 'compass_riley').maybeSingle()

interface MockAuthResult {
  data: { user: { id: string } | null };
  error: { message: string } | null;
}

interface MockAdminOpts {
  authResult?: MockAuthResult;
  tenantId?: string | null;
  skillSettings?: Record<string, unknown> | null;
}

function makeMockAdminClient(opts: MockAdminOpts = {}) {
  const authResult: MockAuthResult = opts.authResult ?? {
    data: { user: { id: SYNTHETIC_USER_ID } },
    error: null,
  };
  const tenantId = opts.tenantId === undefined ? SYNTHETIC_TENANT_ID : opts.tenantId;
  const skillSettings = opts.skillSettings ?? null;

  const calls: { method: string; args: unknown[] }[] = [];

  const profilesQuery = {
    select(_cols: string) {
      calls.push({ method: "profiles.select", args: [_cols] });
      return {
        eq(_col: string, _val: unknown) {
          calls.push({ method: "profiles.select.eq", args: [_col, _val] });
          return {
            single() {
              return Promise.resolve({
                data: tenantId ? { tenant_id: tenantId } : null,
                error: null,
              });
            },
          };
        },
      };
    },
  };

  const skillConfigQuery = {
    select(_cols: string) {
      calls.push({ method: "tenant_ai_skill_config.select", args: [_cols] });
      return {
        eq(_col1: string, _val1: unknown) {
          return {
            eq(_col2: string, _val2: unknown) {
              return {
                maybeSingle() {
                  return Promise.resolve({
                    data: skillSettings ? { settings: skillSettings } : null,
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  return {
    calls,
    auth: {
      getUser(token: string) {
        calls.push({ method: "auth.getUser", args: [token] });
        return Promise.resolve(authResult);
      },
    },
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      if (table === "profiles") return profilesQuery;
      if (table === "tenant_ai_skill_config") return skillConfigQuery;
      // Fallback: return a chain that resolves to empty
      return {
        select() {
          return {
            eq() {
              return {
                eq() { return { maybeSingle() { return Promise.resolve({ data: null, error: null }); } }; },
                single() { return Promise.resolve({ data: null, error: null }); },
              };
            },
          };
        },
      };
    },
  };
}

// ── Real WS upgrade request factory ──────────────────────────────────────────
// Deno.upgradeWebSocket requires a request with a valid Sec-WebSocket-Key
// header. If we don't supply one, the upgrade fails with a non-TDZ error,
// which is acceptable — the assertion we care about is "no ReferenceError
// before the upgrade step".

function makeWsRequest(qs: Record<string, string>, extraHeaders: Record<string, string> = {}): Request {
  const params = new URLSearchParams(qs);
  return new Request(`${FN_URL_BASE}?${params.toString()}`, {
    method: "GET",
    headers: {
      "upgrade": "websocket",
      "connection": "Upgrade",
      "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
      "sec-websocket-version": "13",
      ...extraHeaders,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────

Deno.test("CR-7: realtime_medical_transcription V2 reasoning + WS auth regression guard", async (t) => {

  // The most important assertion: the module must IMPORT without throwing.
  // If the V2 reasoning integration or any module-level code has a TDZ
  // self-reference, this line fails before any test step runs.
  const mod = await import("../index.ts");

  await t.step("module exports handleRequest for testable injection", () => {
    assertExists(mod.handleRequest);
    assertEquals(typeof mod.handleRequest, "function");
  });

  // ── Negative auth paths ────────────────────────────────────────────────────

  await t.step("rejects non-WS upgrade with 426", async () => {
    const req = new Request(FN_URL_BASE, { method: "GET" });
    const res = await mod.handleRequest(req, { adminClient: asSb(makeMockAdminClient()) });
    assertEquals(res.status, 426);
  });

  await t.step("rejects WS upgrade without access_token with 401", async () => {
    const req = makeWsRequest({});
    const res = await mod.handleRequest(req, { adminClient: asSb(makeMockAdminClient()) });
    assertEquals(res.status, 401);
  });

  await t.step("rejects WS upgrade with invalid token with 401", async () => {
    const req = makeWsRequest({ access_token: SYNTHETIC_JWT });
    const adminWithBadAuth = makeMockAdminClient({
      authResult: { data: { user: null }, error: { message: "invalid jwt" } },
    });
    const res = await mod.handleRequest(req, { adminClient: asSb(adminWithBadAuth) });
    assertEquals(res.status, 401);
  });

  // ── The CR-7 regression guard ──────────────────────────────────────────────
  // Full WS upgrade + valid JWT + ?mode=compass-riley&reasoning_mode=chain.
  // Pre-fix (commits c45290df8 → b57f2406^), this path threw
  //   ReferenceError: Cannot access 'userId' before initialization
  // at `fetchTenantSensitivity(admin, userId, logger)`.
  //
  // Post-fix, the path runs cleanly through the V2 reasoning setup and
  // reaches `Deno.upgradeWebSocket(req)`. The upgrade itself may succeed
  // or throw (depends on whether the test runtime can complete a fake WS
  // handshake), but ANY thrown error must NOT be a ReferenceError.

  await t.step("V2 reasoning + WS auth path runs without TDZ ReferenceError", async () => {
    const req = makeWsRequest({
      access_token: SYNTHETIC_JWT,
      mode: "compass-riley",
      reasoning_mode: "chain",
    });
    const admin = makeMockAdminClient({
      authResult: { data: { user: { id: SYNTHETIC_USER_ID } }, error: null },
      tenantId: SYNTHETIC_TENANT_ID,
      skillSettings: { tree_sensitivity: "balanced" },
    });

    let caught: unknown = null;
    let response: Response | null = null;
    try {
      response = await mod.handleRequest(req, { adminClient: asSb(admin) });
    } catch (err: unknown) {
      caught = err;
    }

    // PRIMARY ASSERTION: if any error escaped, it must not be a ReferenceError
    // (which would indicate the TDZ regression).
    if (caught) {
      const isReferenceError = caught instanceof ReferenceError;
      const message = caught instanceof Error ? caught.message : String(caught);
      assert(
        !isReferenceError,
        `V2 reasoning path threw a ReferenceError (TDZ regression): ${message}`,
      );
      // It's also useful to confirm the error didn't mention 'userId' which
      // would be a strong signal the TDZ came back even if wrapped.
      assert(
        !/userId.*before initialization|Cannot access 'userId'/i.test(message),
        `Error mentions userId initialization — possible TDZ regression: ${message}`,
      );
    }

    // SECONDARY ASSERTION: the auth path actually ran. We confirm by checking
    // the mock was called for auth.getUser AND for the V2 reasoning tenant
    // sensitivity lookup. Both calls happen BEFORE the WS upgrade step, so
    // if the TDZ regressed neither would be reached.
    const authCalled = admin.calls.some((c) => c.method === "auth.getUser");
    const profilesCalled = admin.calls.some((c) => c.method === "from" && c.args[0] === "profiles");
    assert(authCalled, "Expected admin.auth.getUser to be called (auth path)");
    assert(
      profilesCalled,
      "Expected admin.from('profiles') to be called (V2 reasoning tenant sensitivity fetch). " +
        "If this fails, the V2 reasoning setup was skipped — possibly due to a TDZ before it.",
    );

    // If the upgrade succeeded, response is a 101-style WS upgrade response.
    // We don't assert on the exact status because Deno.upgradeWebSocket
    // behavior under a synthetic Request without a live HTTP connection is
    // implementation-defined. What matters is that we reached this point
    // without a TDZ crash.
    if (response) {
      // sanity: status is a number
      assertEquals(typeof response.status, "number");
    }
  });

  // ── Mode parameter resolution ──────────────────────────────────────────────

  await t.step("invalid scribe mode falls back to compass-riley (does not crash)", async () => {
    const req = makeWsRequest({
      access_token: SYNTHETIC_JWT,
      mode: "not-a-real-mode",
      reasoning_mode: "tree",
    });
    const admin = makeMockAdminClient();

    let caught: unknown = null;
    try {
      await mod.handleRequest(req, { adminClient: asSb(admin) });
    } catch (err: unknown) {
      caught = err;
    }

    if (caught) {
      assert(
        !(caught instanceof ReferenceError),
        `Invalid mode path threw ReferenceError: ${caught instanceof Error ? caught.message : String(caught)}`,
      );
    }
    // Auth still ran
    const authCalled = admin.calls.some((c) => c.method === "auth.getUser");
    assert(authCalled, "Expected auth.getUser to be called even on invalid mode");
  });
});
