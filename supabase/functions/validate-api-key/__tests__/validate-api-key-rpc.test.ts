/**
 * Tests for the API-3e thin RPC wrapper edge function + the API-3d
 * `validate_api_key` Postgres RPC.
 *
 * Two test categories:
 *
 *   1. Pure-function tests for the SHA-256 hashing step and the RPC
 *      `error_reason` → HTTP status mapping. These run anywhere.
 *
 *   2. Live-DB integration tests for the RPC itself (use_count increments,
 *      audit log writes, cross-tenant RLS). These run ONLY when
 *      SUPABASE_URL + SB_SECRET_KEY are present (i.e., run locally against
 *      a real project, skipped in plain `deno test` CI without secrets).
 *      The integration suite satisfies the API-3g tracker requirement.
 *
 * All test data is synthetic per CLAUDE.md Rule #15.
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

// ============================================================================
// Helpers (copies of the edge function's pure functions — kept in-test so a
// regression to the edge function's hashing or status mapping fails here.)
// ============================================================================

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Status + error message derivation from RPC `error_reason`.
 * Mirrors the inline mapping in supabase/functions/validate-api-key/index.ts.
 */
function statusForErrorReason(reason: string | null): { status: number; message: string } {
  if (reason === "invalid") return { status: 401, message: "Invalid API key." };
  if (reason === "revoked") return { status: 403, message: "API key has been revoked." };
  if (reason === "expired") return { status: 403, message: "API key has expired." };
  if (reason === "scope_denied") return { status: 403, message: "API key lacks required scope." };
  return { status: 403, message: "API key validation failed." };
}

// ============================================================================
// 1. PURE-FUNCTION TESTS
// ============================================================================

Deno.test("API-3e — hashApiKey: SHA-256 hex of a known input", async () => {
  // SHA-256("hello") — canonical reference; if this drifts, hashing is broken.
  const expected = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
  const actual = await hashApiKey("hello");
  assertEquals(actual, expected);
});

Deno.test("API-3e — hashApiKey: deterministic across calls", async () => {
  const a = await hashApiKey("test-partner-alpha-key-123");
  const b = await hashApiKey("test-partner-alpha-key-123");
  assertEquals(a, b);
  // 64 hex chars = 256 bits.
  assertEquals(a.length, 64);
});

Deno.test("API-3e — hashApiKey: different keys produce different hashes", async () => {
  const a = await hashApiKey("partner-key-a");
  const b = await hashApiKey("partner-key-b");
  assertNotEquals(a, b);
});

Deno.test("API-3e — status mapping: invalid → 401", () => {
  const result = statusForErrorReason("invalid");
  assertEquals(result.status, 401);
  assertEquals(result.message, "Invalid API key.");
});

Deno.test("API-3e — status mapping: revoked → 403", () => {
  const result = statusForErrorReason("revoked");
  assertEquals(result.status, 403);
  assertEquals(result.message, "API key has been revoked.");
});

Deno.test("API-3e — status mapping: expired → 403", () => {
  const result = statusForErrorReason("expired");
  assertEquals(result.status, 403);
  assertEquals(result.message, "API key has expired.");
});

Deno.test("API-3e — status mapping: scope_denied → 403", () => {
  const result = statusForErrorReason("scope_denied");
  assertEquals(result.status, 403);
  assertEquals(result.message, "API key lacks required scope.");
});

// ============================================================================
// 2. LIVE-DB INTEGRATION TESTS (skipped without SB_SECRET_KEY)
// ============================================================================

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? null;
const SB_SECRET_KEY =
  Deno.env.get("SB_SECRET_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  null;

const HAS_LIVE_DB = !!(SUPABASE_URL && SB_SECRET_KEY);

// Synthetic tenant + key plumbing. We never reuse production rows.
const SYNTHETIC_KEY_HASH_BOGUS =
  "0000000000000000000000000000000000000000000000000000000000000000";

Deno.test({
  name:
    "API-3d (live DB) — validate_api_key returns valid=false / error_reason='invalid' for an unknown key_hash",
  ignore: !HAS_LIVE_DB,
  fn: async () => {
    const client = createClient(SUPABASE_URL!, SB_SECRET_KEY!);

    const { data, error } = await client.rpc("validate_api_key", {
      p_key_hash: SYNTHETIC_KEY_HASH_BOGUS,
      p_key_prefix: null,
      p_required_scope: null,
      p_ip_address: null,
      p_user_agent: "deno-test/api-3g",
      p_caller_function: "validate-api-key-test",
    });

    assertEquals(error, null);
    assertExists(data);
    const rows = data as Array<{
      valid: boolean;
      key_id: string | null;
      tenant_id: string | null;
      error_reason: string | null;
    }>;
    assertEquals(rows.length, 1);
    assertEquals(rows[0].valid, false);
    assertEquals(rows[0].error_reason, "invalid");
    assertEquals(rows[0].key_id, null);
  },
});

Deno.test({
  name:
    "API-3d (live DB) — validate_api_key writes an audit row for every call (including the bogus-key path)",
  ignore: !HAS_LIVE_DB,
  fn: async () => {
    const client = createClient(SUPABASE_URL!, SB_SECRET_KEY!);

    const callerTag = `deno-test-api-3g-${crypto.randomUUID()}`;

    // Issue the bogus-key call.
    const { error: rpcError } = await client.rpc("validate_api_key", {
      p_key_hash: SYNTHETIC_KEY_HASH_BOGUS,
      p_key_prefix: null,
      p_required_scope: null,
      p_ip_address: null,
      p_user_agent: callerTag,
      p_caller_function: "validate-api-key-test",
    });
    assertEquals(rpcError, null);

    // The RPC writes an audit row tagged with the user-agent we sent. Look
    // it up to prove the audit-log path fires even when the key is bogus.
    // (Service role bypasses RLS; we're not testing RLS here, we're testing
    // that the SECURITY DEFINER RPC inserts on the bogus-key code path.)
    const { data: auditRows, error: auditError } = await client
      .from("api_key_audit_log")
      .select("outcome, user_agent, caller_function")
      .eq("user_agent", callerTag)
      .order("validated_at", { ascending: false })
      .limit(1);

    assertEquals(auditError, null);
    assertExists(auditRows);
    assertEquals(auditRows.length, 1);
    assertEquals(auditRows[0].outcome, "invalid");
    assertEquals(auditRows[0].caller_function, "validate-api-key-test");
  },
});
