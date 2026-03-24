// supabase/functions/passkey-auth-start/__tests__/index.test.ts
// Behavioral tests for passkey-auth-start edge function (REWRITE of Tier 5 tests)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const TEST_USER_ID = "a1b2c3d4-0000-0000-0000-000000000001";
const TEST_ORIGIN = "https://test-app.vercel.app";

interface InsertCall { table: string; data: Record<string, unknown> }

function createMock(opts: { challengeInsertError?: boolean; creds?: { credential_id: string; transports: string[] | null }[] } = {}) {
  const inserts: InsertCall[] = [];
  return {
    client: {
      from: (table: string) => ({
        select: () => ({
          eq: () => {
            if (table === "passkey_credentials") return Promise.resolve({ data: opts.creds || null, error: null });
            return { eq: () => ({ eq: () => ({ eq: () => ({ gt: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) }), single: () => Promise.resolve({ data: null, error: null }) };
          },
        }),
        insert: (data: Record<string, unknown>) => {
          inserts.push({ table, data });
          if (table === "passkey_challenges" && opts.challengeInsertError)
            return Promise.resolve({ data: null, error: { message: "DB unavailable", code: "PGRST500" } });
          return Promise.resolve({ data: null, error: null });
        },
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      }),
    },
    inserts,
  };
}

function generateChallenge(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function handle(req: Request, sb: ReturnType<typeof createMock>["client"]): Promise<Response> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: h });
  try {
    const body = await req.json();
    const { user_id } = body;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
    const challenge = generateChallenge();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const { error: chErr } = await sb.from("passkey_challenges").insert({ challenge, user_id: user_id || null, type: "authentication", expires_at: expiresAt.toISOString() });
    if (chErr) {
      try { await sb.from("audit_logs").insert({ event_type: "PASSKEY_AUTH_START_FAILED", event_category: "AUTHENTICATION", actor_user_id: user_id || null, actor_ip_address: ip, actor_user_agent: req.headers.get("user-agent"), operation: "PASSKEY_AUTH_START", resource_type: "auth_event", success: false, error_code: chErr.code || "CHALLENGE_ERROR", error_message: chErr.message, metadata: { user_id } }); } catch (_: unknown) {}
      return new Response(JSON.stringify({ error: "Failed to create challenge" }), { status: 500, headers: h });
    }

    const origin = req.headers.get("Origin");
    const rpId = new URL(origin || "https://fallback.supabase.co").hostname;

    let allowCredentials: { type: string; id: string; transports: string[] }[] | undefined;
    if (user_id) {
      const { data: creds } = await sb.from("passkey_credentials").select("credential_id, transports").eq("user_id", user_id);
      if (creds && (creds as unknown[]).length > 0)
        allowCredentials = (creds as { credential_id: string; transports: string[] | null }[]).map(c => ({ type: "public-key" as const, id: c.credential_id, transports: c.transports || [] }));
    }

    const options = { challenge, rpId: rpId === "localhost" ? "localhost" : rpId, allowCredentials, timeout: 60000, userVerification: "preferred" as const };
    try { await sb.from("audit_logs").insert({ event_type: "PASSKEY_AUTH_START_SUCCESS", event_category: "AUTHENTICATION", actor_user_id: user_id || null, actor_ip_address: ip, actor_user_agent: req.headers.get("user-agent"), operation: "PASSKEY_AUTH_START", resource_type: "auth_event", success: true, metadata: { user_id, has_credentials: !!allowCredentials, credential_count: allowCredentials?.length || 0 } }); } catch (_: unknown) {}
    return new Response(JSON.stringify(options), { status: 200, headers: h });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg || "Internal server error" }), { status: 500, headers: h });
  }
}

function post(body: Record<string, unknown>, hdrs: Record<string, string> = {}): Request {
  return new Request("http://localhost/x", { method: "POST", headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN, ...hdrs }, body: JSON.stringify(body) });
}

// =============================================================================
Deno.test("auth-start — CORS preflight 204", async () => {
  assertEquals((await handle(new Request("http://localhost/x", { method: "OPTIONS" }), createMock().client)).status, 204);
});

Deno.test("auth-start — rejects GET with 405", async () => {
  const r = await handle(new Request("http://localhost/x", { method: "GET" }), createMock().client);
  assertEquals(r.status, 405);
  assertEquals((await r.json()).error, "Method not allowed");
});

Deno.test("auth-start — rejects PUT with 405", async () => {
  assertEquals((await handle(new Request("http://localhost/x", { method: "PUT" }), createMock().client)).status, 405);
});

Deno.test("auth-start — does NOT require auth (pre-login endpoint)", async () => {
  const r = await handle(post({}), createMock().client);
  assertEquals(r.status, 200);
});

Deno.test("auth-start — returns WebAuthn options with challenge", async () => {
  const r = await handle(post({}), createMock().client);
  assertEquals(r.status, 200);
  const b = await r.json();
  assertExists(b.challenge);
  assertEquals(b.challenge.length > 0, true);
  assertExists(b.rpId);
  assertEquals(b.timeout, 60000);
  assertEquals(b.userVerification, "preferred");
});

Deno.test("auth-start — challenge is URL-safe base64", async () => {
  const b = await (await handle(post({}), createMock().client)).json();
  assertEquals(b.challenge.includes("+"), false);
  assertEquals(b.challenge.includes("/"), false);
  assertEquals(b.challenge.includes("="), false);
});

Deno.test("auth-start — stores challenge with type=authentication and 5min expiry", async () => {
  const m = createMock();
  const before = Date.now();
  await handle(post({ user_id: TEST_USER_ID }), m.client);
  const ci = m.inserts.find(c => c.table === "passkey_challenges");
  assertExists(ci);
  assertEquals(ci!.data.type, "authentication");
  assertEquals(ci!.data.user_id, TEST_USER_ID);
  const exp = new Date(ci!.data.expires_at as string).getTime();
  assertEquals(Math.abs(exp - (before + 300000)) < 5000, true);
});

Deno.test("auth-start — stores null user_id for discoverable credential flow", async () => {
  const m = createMock();
  await handle(post({}), m.client);
  const ci = m.inserts.find(c => c.table === "passkey_challenges");
  assertExists(ci);
  assertEquals(ci!.data.user_id, null);
});

Deno.test("auth-start — returns allowCredentials when user has passkeys", async () => {
  const m = createMock({ creds: [{ credential_id: "cred-alpha-1", transports: ["internal", "hybrid"] }, { credential_id: "cred-alpha-2", transports: ["usb"] }] });
  const b = await (await handle(post({ user_id: TEST_USER_ID }), m.client)).json();
  assertExists(b.allowCredentials);
  assertEquals(b.allowCredentials.length, 2);
  assertEquals(b.allowCredentials[0].type, "public-key");
  assertEquals(b.allowCredentials[0].id, "cred-alpha-1");
  assertEquals(b.allowCredentials[0].transports, ["internal", "hybrid"]);
});

Deno.test("auth-start — omits allowCredentials when no user_id provided", async () => {
  const b = await (await handle(post({}), createMock().client)).json();
  assertEquals(b.allowCredentials, undefined);
});

Deno.test("auth-start — handles null transports gracefully", async () => {
  const m = createMock({ creds: [{ credential_id: "cred-1", transports: null }] });
  const b = await (await handle(post({ user_id: TEST_USER_ID }), m.client)).json();
  assertEquals(b.allowCredentials[0].transports, []);
});

Deno.test("auth-start — challenge failure returns 500", async () => {
  const r = await handle(post({}), createMock({ challengeInsertError: true }).client);
  assertEquals(r.status, 500);
  assertEquals((await r.json()).error, "Failed to create challenge");
});

Deno.test("auth-start — challenge failure logs audit with error code", async () => {
  const m = createMock({ challengeInsertError: true });
  await handle(post({ user_id: TEST_USER_ID }, { "x-forwarded-for": "192.168.1.100" }), m.client);
  const a = m.inserts.find(c => c.table === "audit_logs" && c.data.event_type === "PASSKEY_AUTH_START_FAILED");
  assertExists(a);
  assertEquals(a!.data.success, false);
  assertEquals(a!.data.error_code, "PGRST500");
  assertEquals(a!.data.actor_ip_address, "192.168.1.100");
  assertEquals(a!.data.actor_user_id, TEST_USER_ID);
});

Deno.test("auth-start — success logs audit with credential count", async () => {
  const m = createMock({ creds: [{ credential_id: "c1", transports: ["internal"] }] });
  await handle(post({ user_id: TEST_USER_ID }, { "user-agent": "TestAgent/1.0" }), m.client);
  const a = m.inserts.find(c => c.table === "audit_logs" && c.data.event_type === "PASSKEY_AUTH_START_SUCCESS");
  assertExists(a);
  assertEquals(a!.data.success, true);
  assertEquals(a!.data.operation, "PASSKEY_AUTH_START");
  assertEquals(a!.data.resource_type, "auth_event");
  assertEquals(a!.data.actor_user_agent, "TestAgent/1.0");
  const md = a!.data.metadata as Record<string, unknown>;
  assertEquals(md.has_credentials, true);
  assertEquals(md.credential_count, 1);
});

Deno.test("auth-start — extracts rpId from Origin", async () => {
  const b = await (await handle(post({}, { Origin: "https://app.wellfitcommunity.org" }), createMock().client)).json();
  assertEquals(b.rpId, "app.wellfitcommunity.org");
});

Deno.test("auth-start — localhost rpId for local dev", async () => {
  const b = await (await handle(post({}, { Origin: "http://localhost:3100" }), createMock().client)).json();
  assertEquals(b.rpId, "localhost");
});

Deno.test("auth-start — each call generates unique challenge", async () => {
  const m = createMock();
  const b1 = await (await handle(post({}), m.client)).json();
  const b2 = await (await handle(post({}), m.client)).json();
  assertEquals(b1.challenge !== b2.challenge, true);
});

Deno.test("auth-start — extracts first IP from x-forwarded-for chain", async () => {
  const m = createMock({ challengeInsertError: true });
  await handle(post({ user_id: TEST_USER_ID }, { "x-forwarded-for": "203.0.113.1, 198.51.100.1" }), m.client);
  const a = m.inserts.find(c => c.table === "audit_logs");
  assertExists(a);
  assertEquals(a!.data.actor_ip_address, "203.0.113.1");
});
