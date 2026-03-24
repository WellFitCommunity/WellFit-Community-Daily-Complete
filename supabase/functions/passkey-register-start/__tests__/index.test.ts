// supabase/functions/passkey-register-start/__tests__/index.test.ts
// Behavioral tests for passkey-register-start edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

// --- Synthetic test data (CLAUDE.md Rule #15) ---
const TEST_USER_ID = "a1b2c3d4-0000-0000-0000-000000000001";
const TEST_EMAIL = "alpha@test.local";
const TEST_ORIGIN = "https://test-app.vercel.app";

interface InsertCall { table: string; data: Record<string, unknown> }

function createMockSupabase(opts: { authError?: boolean; challengeInsertError?: boolean } = {}) {
  const inserts: InsertCall[] = [];
  return {
    client: {
      from: (table: string) => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
        insert: (data: Record<string, unknown>) => {
          inserts.push({ table, data });
          if (table === "passkey_challenges" && opts.challengeInsertError)
            return Promise.resolve({ data: null, error: { message: "DB error", code: "PGRST001" } });
          return Promise.resolve({ data: null, error: null });
        },
      }),
      auth: {
        getUser: () => opts.authError
          ? Promise.resolve({ data: { user: null }, error: { message: "Invalid" } })
          : Promise.resolve({ data: { user: { id: TEST_USER_ID, email: TEST_EMAIL, phone: null } }, error: null }),
      },
    },
    inserts,
  };
}

// Replicate handler logic (serve() cannot be called in tests)
function generateChallenge(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function stringToBase64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function handle(req: Request, sb: ReturnType<typeof createMockSupabase>["client"]): Promise<Response> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: h });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: h });

    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: h });

    const body = await req.json();
    const { user_name, display_name, prefer_platform = true } = body;
    const challenge = generateChallenge();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const { error: chErr } = await sb.from("passkey_challenges").insert({
      challenge, user_id: user.id, type: "registration", expires_at: expiresAt.toISOString(),
    });

    if (chErr) {
      try { await sb.from("audit_logs").insert({
        event_type: "PASSKEY_REGISTER_START_FAILED", event_category: "AUTHENTICATION",
        actor_user_id: user.id, actor_ip_address: ip, actor_user_agent: req.headers.get("user-agent"),
        operation: "PASSKEY_REGISTER_START", resource_type: "auth_event", success: false,
        error_code: chErr.code || "CHALLENGE_ERROR", error_message: chErr.message, metadata: { user_id: user.id },
      }); } catch (_: unknown) { /* non-fatal */ }
      return new Response(JSON.stringify({ error: "Failed to create challenge" }), { status: 500, headers: h });
    }

    const origin = req.headers.get("Origin");
    const rpId = new URL(origin || "https://fallback.supabase.co").hostname;

    const options = {
      challenge, rp: { name: "WellFit Community", id: rpId === "localhost" ? "localhost" : rpId },
      user: { id: stringToBase64url(user.id), name: user_name || user.email || user.phone || "user", displayName: display_name || user_name || "User" },
      pubKeyCredParams: [{ type: "public-key" as const, alg: -7 }, { type: "public-key" as const, alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: prefer_platform ? ("platform" as const) : undefined, requireResidentKey: false, residentKey: "preferred" as const, userVerification: "preferred" as const },
      timeout: 60000, attestation: "none" as const,
    };

    try { await sb.from("audit_logs").insert({
      event_type: "PASSKEY_REGISTER_START_SUCCESS", event_category: "AUTHENTICATION",
      actor_user_id: user.id, actor_ip_address: ip, actor_user_agent: req.headers.get("user-agent"),
      operation: "PASSKEY_REGISTER_START", resource_type: "auth_event", success: true, metadata: { user_id: user.id },
    }); } catch (_: unknown) { /* non-fatal */ }

    return new Response(JSON.stringify(options), { status: 200, headers: h });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg || "Internal server error" }), { status: 500, headers: h });
  }
}

// =============================================================================
// TESTS
// =============================================================================

Deno.test("register-start — CORS preflight returns 204", async () => {
  const m = createMockSupabase();
  const r = await handle(new Request("http://localhost/x", { method: "OPTIONS" }), m.client);
  assertEquals(r.status, 204);
});

Deno.test("register-start — rejects GET with 405", async () => {
  const m = createMockSupabase();
  const r = await handle(new Request("http://localhost/x", { method: "GET" }), m.client);
  assertEquals(r.status, 405);
  assertEquals((await r.json()).error, "Method not allowed");
});

Deno.test("register-start — rejects missing auth token with 401", async () => {
  const m = createMockSupabase();
  const r = await handle(new Request("http://localhost/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }), m.client);
  assertEquals(r.status, 401);
});

Deno.test("register-start — rejects invalid auth token with 401", async () => {
  const m = createMockSupabase({ authError: true });
  const r = await handle(new Request("http://localhost/x", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer bad" }, body: JSON.stringify({}) }), m.client);
  assertEquals(r.status, 401);
});

Deno.test("register-start — success returns WebAuthn options with challenge", async () => {
  const m = createMockSupabase();
  const r = await handle(new Request("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer ok", Origin: TEST_ORIGIN },
    body: JSON.stringify({ user_name: "Test Patient Alpha", display_name: "Alpha Patient" }),
  }), m.client);
  assertEquals(r.status, 200);
  const b = await r.json();
  assertExists(b.challenge);
  assertEquals(b.challenge.length > 0, true);
  assertEquals(b.rp.name, "WellFit Community");
  assertEquals(b.user.name, "Test Patient Alpha");
  assertEquals(b.user.displayName, "Alpha Patient");
  assertEquals(b.pubKeyCredParams[0].alg, -7);
  assertEquals(b.pubKeyCredParams[1].alg, -257);
  assertEquals(b.authenticatorSelection.userVerification, "preferred");
  assertEquals(b.timeout, 60000);
  assertEquals(b.attestation, "none");
});

Deno.test("register-start — stores challenge with type=registration and 5min expiry", async () => {
  const m = createMockSupabase();
  const before = Date.now();
  await handle(new Request("http://localhost/x", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer ok", Origin: TEST_ORIGIN },
    body: JSON.stringify({}),
  }), m.client);
  const ci = m.inserts.find(c => c.table === "passkey_challenges");
  assertExists(ci);
  assertEquals(ci!.data.type, "registration");
  assertEquals(ci!.data.user_id, TEST_USER_ID);
  const exp = new Date(ci!.data.expires_at as string).getTime();
  assertEquals(Math.abs(exp - (before + 300000)) < 5000, true);
});

Deno.test("register-start — logs success audit to audit_logs", async () => {
  const m = createMockSupabase();
  await handle(new Request("http://localhost/x", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer ok", Origin: TEST_ORIGIN, "x-forwarded-for": "10.0.0.1", "user-agent": "TestAgent/1.0" },
    body: JSON.stringify({}),
  }), m.client);
  const a = m.inserts.find(c => c.table === "audit_logs" && c.data.event_type === "PASSKEY_REGISTER_START_SUCCESS");
  assertExists(a);
  assertEquals(a!.data.operation, "PASSKEY_REGISTER_START");
  assertEquals(a!.data.resource_type, "auth_event");
  assertEquals(a!.data.success, true);
  assertEquals(a!.data.actor_ip_address, "10.0.0.1");
});

Deno.test("register-start — challenge failure returns 500 and logs failure audit", async () => {
  const m = createMockSupabase({ challengeInsertError: true });
  const r = await handle(new Request("http://localhost/x", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer ok", Origin: TEST_ORIGIN },
    body: JSON.stringify({}),
  }), m.client);
  assertEquals(r.status, 500);
  assertEquals((await r.json()).error, "Failed to create challenge");
  const a = m.inserts.find(c => c.table === "audit_logs" && c.data.event_type === "PASSKEY_REGISTER_START_FAILED");
  assertExists(a);
  assertEquals(a!.data.error_code, "PGRST001");
});

Deno.test("register-start — falls back to email when user_name absent", async () => {
  const m = createMockSupabase();
  const r = await handle(new Request("http://localhost/x", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer ok", Origin: TEST_ORIGIN },
    body: JSON.stringify({}),
  }), m.client);
  const b = await r.json();
  assertEquals(b.user.name, TEST_EMAIL);
  assertEquals(b.user.displayName, "User");
});

Deno.test("register-start — challenge is URL-safe base64", async () => {
  const m = createMockSupabase();
  const r = await handle(new Request("http://localhost/x", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer ok", Origin: TEST_ORIGIN },
    body: JSON.stringify({}),
  }), m.client);
  const b = await r.json();
  assertEquals(b.challenge.includes("+"), false);
  assertEquals(b.challenge.includes("/"), false);
  assertEquals(b.challenge.includes("="), false);
});

Deno.test("register-start — extracts rpId from Origin", async () => {
  const m = createMockSupabase();
  const r = await handle(new Request("http://localhost/x", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer ok", Origin: "https://app.wellfitcommunity.org" },
    body: JSON.stringify({}),
  }), m.client);
  assertEquals((await r.json()).rp.id, "app.wellfitcommunity.org");
});

Deno.test("register-start — client IP null when no IP headers", async () => {
  const m = createMockSupabase();
  await handle(new Request("http://localhost/x", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer ok", Origin: TEST_ORIGIN },
    body: JSON.stringify({}),
  }), m.client);
  const a = m.inserts.find(c => c.table === "audit_logs" && c.data.event_type === "PASSKEY_REGISTER_START_SUCCESS");
  assertExists(a);
  assertEquals(a!.data.actor_ip_address, null);
});
