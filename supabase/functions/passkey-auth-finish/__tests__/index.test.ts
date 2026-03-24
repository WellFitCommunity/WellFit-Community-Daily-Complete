// supabase/functions/passkey-auth-finish/__tests__/index.test.ts
// Behavioral tests for passkey-auth-finish edge function (REWRITE of Tier 5 tests)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const TEST_USER_ID = "a1b2c3d4-0000-0000-0000-000000000001";
const TEST_EMAIL = "alpha@test.local";
const TEST_CRED_ID = "dGVzdC1jcmVkLWlk";
const TEST_ORIGIN = "https://test-app.vercel.app";

interface InsertCall { table: string; data: Record<string, unknown> }
interface UpdateCall { table: string; data: Record<string, unknown> }
interface AuthVerification { verified: boolean; authenticationInfo: { newCounter: number; userVerified: boolean } }

function createMock(opts: { challengeNotFound?: boolean; credNotFound?: boolean; userNotFound?: boolean; sessionError?: boolean } = {}) {
  const inserts: InsertCall[] = [];
  const updates: UpdateCall[] = [];
  return {
    client: {
      from: (table: string) => ({
        select: () => ({
          eq: (col: string, _val: unknown) => {
            if (table === "passkey_challenges") return { eq: () => ({ eq: () => ({ gt: () => ({ limit: () => {
              if (opts.challengeNotFound) return Promise.resolve({ data: [], error: null });
              return Promise.resolve({ data: [{ id: "ch-1", challenge: "test-challenge-value", user_id: null, type: "authentication", used: false, expires_at: new Date(Date.now() + 300000).toISOString() }], error: null });
            } }) }) }) };
            if (table === "passkey_credentials" && col === "credential_id") return { single: () => {
              if (opts.credNotFound) return Promise.resolve({ data: null, error: { message: "Not found", code: "PGRST116" } });
              return Promise.resolve({ data: { id: "cred-uuid", user_id: TEST_USER_ID, credential_id: TEST_CRED_ID, public_key: "dGVzdC1rZXk", counter: 5, transports: ["internal"], device_name: "Test Device Alpha" }, error: null });
            } };
            if (table === "profiles") return { single: () => Promise.resolve({ data: { user_id: TEST_USER_ID, first_name: "Test", last_name: "Alpha", email: TEST_EMAIL, phone: "555-0100", tenant_id: "2b902657-6a20-4435-a78a-576f397517ca", role: "member", avatar_url: null }, error: null }) };
            return { single: () => Promise.resolve({ data: null, error: null }), eq: () => ({ eq: () => ({ gt: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) };
          },
        }),
        insert: (data: Record<string, unknown>) => { inserts.push({ table, data }); return Promise.resolve({ data: null, error: null }); },
        update: (data: Record<string, unknown>) => ({ eq: () => { updates.push({ table, data }); return Promise.resolve({ data: null, error: null }); } }),
      }),
      auth: { admin: {
        getUserById: () => opts.userNotFound
          ? Promise.resolve({ data: { user: null }, error: { message: "Not found" } })
          : Promise.resolve({ data: { user: { id: TEST_USER_ID, email: TEST_EMAIL, phone: null } }, error: null }),
        generateLink: () => opts.sessionError
          ? Promise.resolve({ data: null, error: { message: "Rate limited", code: "rate_limit" } })
          : Promise.resolve({ data: { properties: { access_token: "test-jwt", refresh_token: "test-refresh", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null }),
      } },
    },
    inserts, updates,
  };
}

const goodVerify = (): Promise<AuthVerification> => Promise.resolve({ verified: true, authenticationInfo: { newCounter: 6, userVerified: true } });

async function handle(req: Request, sb: ReturnType<typeof createMock>["client"], verify: () => Promise<AuthVerification>): Promise<Response> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: h });
  try {
    const body = await req.json();
    const { rawId, response } = body;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
    const cdj = JSON.parse(atob((response.clientDataJSON as string).replace(/-/g, "+").replace(/_/g, "/")));

    // Verify challenge
    const { data: chs, error: chErr } = await sb.from("passkey_challenges").select("id, challenge, user_id, type, used, expires_at").eq("challenge", cdj.challenge).eq("type", "authentication").eq("used", false).gt("expires_at", new Date().toISOString()).limit(1);
    if (chErr || !chs || (chs as unknown[]).length === 0) {
      try { await sb.from("audit_logs").insert({ event_type: "PASSKEY_AUTH_FAILED", event_category: "AUTHENTICATION", actor_user_id: null, actor_ip_address: ip, actor_user_agent: req.headers.get("user-agent"), operation: "PASSKEY_AUTH", resource_type: "auth_event", success: false, error_code: "INVALID_CHALLENGE", error_message: "Invalid or expired challenge", metadata: { credential_id: rawId } }); } catch (_: unknown) {}
      return new Response(JSON.stringify({ error: "Invalid or expired challenge" }), { status: 400, headers: h });
    }
    await sb.from("passkey_challenges").update({ used: true }).eq("challenge", cdj.challenge);

    // Find credential
    const { data: cred, error: credErr } = await sb.from("passkey_credentials").select("id, user_id, credential_id, public_key, counter, transports, device_name").eq("credential_id", rawId).single();
    if (credErr || !cred) {
      await sb.from("passkey_audit_log").insert({ credential_id: rawId, action: "failed_auth", success: false, error_message: "Credential not found" });
      try { await sb.from("audit_logs").insert({ event_type: "PASSKEY_AUTH_FAILED", event_category: "AUTHENTICATION", actor_user_id: null, actor_ip_address: ip, actor_user_agent: req.headers.get("user-agent"), operation: "PASSKEY_AUTH", resource_type: "auth_event", success: false, error_code: "CREDENTIAL_NOT_FOUND", error_message: "Credential not found", metadata: { credential_id: rawId } }); } catch (_: unknown) {}
      return new Response(JSON.stringify({ error: "Credential not found" }), { status: 404, headers: h });
    }

    // Verify signature
    let v: AuthVerification;
    try { v = await verify(); } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const name = e instanceof Error ? e.name : "UnknownError";
      try { await sb.from("audit_logs").insert({ event_type: "PASSKEY_SIGNATURE_VERIFICATION_FAILED", event_category: "AUTHENTICATION", actor_user_id: cred.user_id, actor_ip_address: ip, actor_user_agent: req.headers.get("user-agent"), operation: "PASSKEY_AUTH", resource_type: "auth_event", success: false, error_code: "SIGNATURE_VERIFICATION_FAILED", error_message: msg, metadata: { credential_id: rawId, error_type: name } }); } catch (_: unknown) {}
      return new Response(JSON.stringify({ error: "Signature verification failed" }), { status: 401, headers: h });
    }
    if (!v.verified) {
      try { await sb.from("audit_logs").insert({ event_type: "PASSKEY_SIGNATURE_NOT_VERIFIED", event_category: "AUTHENTICATION", actor_user_id: cred.user_id, operation: "PASSKEY_AUTH", resource_type: "auth_event", success: false, error_code: "SIGNATURE_NOT_VERIFIED", error_message: "Cryptographic signature verification failed", metadata: { credential_id: rawId } }); } catch (_: unknown) {}
      return new Response(JSON.stringify({ error: "Authentication failed - invalid signature" }), { status: 401, headers: h });
    }

    const nc = v.authenticationInfo.newCounter;
    await sb.from("passkey_credentials").update({ last_used_at: new Date().toISOString(), counter: nc }).eq("id", cred.id);

    const { data: { user }, error: uErr } = await sb.auth.admin.getUserById(cred.user_id);
    if (uErr || !user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: h });

    const { data: profile } = await sb.from("profiles").select("user_id, first_name, last_name, email, phone, tenant_id, role, avatar_url").eq("user_id", cred.user_id).single();

    const { data: sd, error: sErr } = await sb.auth.admin.generateLink({ type: "magiclink", email: user.email || user.phone || `${user.id}@passkey.local` });
    if (sErr || !sd) return new Response(JSON.stringify({ error: "Failed to create session" }), { status: 500, headers: h });

    const session = { access_token: sd.properties?.access_token || null, refresh_token: sd.properties?.refresh_token || null, expires_in: sd.properties?.expires_in || 3600, expires_at: sd.properties?.expires_at || null, token_type: "bearer", user };

    // passkey_audit_log: uses 'action', NOT 'operation'; does NOT have 'resource_type'
    await sb.from("passkey_audit_log").insert({ user_id: cred.user_id, credential_id: rawId, action: "authenticate", success: true });
    try { await sb.from("audit_logs").insert({ event_type: "PASSKEY_AUTH_SUCCESS", event_category: "AUTHENTICATION", actor_user_id: cred.user_id, actor_ip_address: ip, actor_user_agent: req.headers.get("user-agent"), operation: "PASSKEY_AUTH", resource_type: "auth_event", success: true, metadata: { credential_id: rawId, user_id: cred.user_id, counter: nc, userVerified: v.authenticationInfo.userVerified, signature_verified: true } }); } catch (_: unknown) {}
    return new Response(JSON.stringify({ session, user, profile }), { status: 200, headers: h });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await sb.from("passkey_audit_log").insert({ action: "failed_auth", success: false, error_message: msg || "Unknown error" });
    return new Response(JSON.stringify({ error: msg || "Internal server error" }), { status: 500, headers: h });
  }
}

const CDJ = btoa(JSON.stringify({ challenge: "test-challenge-value", type: "webauthn.get" }));
const BODY = { id: TEST_CRED_ID, rawId: TEST_CRED_ID, response: { clientDataJSON: CDJ, authenticatorData: "mock", signature: "mock", userHandle: btoa(TEST_USER_ID) } };
function post(body: Record<string, unknown>, hdrs: Record<string, string> = {}): Request {
  return new Request("http://localhost/x", { method: "POST", headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN, ...hdrs }, body: JSON.stringify(body) });
}

// =============================================================================
Deno.test("auth-finish — CORS preflight 204", async () => {
  assertEquals((await handle(new Request("http://localhost/x", { method: "OPTIONS" }), createMock().client, goodVerify)).status, 204);
});

Deno.test("auth-finish — rejects GET with 405", async () => {
  const r = await handle(new Request("http://localhost/x", { method: "GET" }), createMock().client, goodVerify);
  assertEquals(r.status, 405);
  assertEquals((await r.json()).error, "Method not allowed");
});

Deno.test("auth-finish — does NOT require Authorization header", async () => {
  assertEquals((await handle(post(BODY), createMock().client, goodVerify)).status, 200);
});

Deno.test("auth-finish — 400 for invalid challenge", async () => {
  const m = createMock({ challengeNotFound: true });
  const r = await handle(post(BODY), m.client, goodVerify);
  assertEquals(r.status, 400);
  assertEquals((await r.json()).error, "Invalid or expired challenge");
  assertExists(m.inserts.find(c => c.table === "audit_logs" && c.data.error_code === "INVALID_CHALLENGE"));
});

Deno.test("auth-finish — 404 when credential not found", async () => {
  const m = createMock({ credNotFound: true });
  const r = await handle(post(BODY), m.client, goodVerify);
  assertEquals(r.status, 404);
  assertEquals((await r.json()).error, "Credential not found");
  // passkey_audit_log uses 'action', not 'operation'
  const pa = m.inserts.find(c => c.table === "passkey_audit_log" && c.data.action === "failed_auth");
  assertExists(pa);
  assertEquals("operation" in pa!.data, false);
  assertEquals(pa!.data.success, false);
});

Deno.test("auth-finish — 401 when signature verification throws", async () => {
  const m = createMock();
  const r = await handle(post(BODY, { "x-forwarded-for": "10.0.0.5" }), m.client, () => Promise.reject(new Error("Invalid authenticator data")));
  assertEquals(r.status, 401);
  assertEquals((await r.json()).error, "Signature verification failed");
  const a = m.inserts.find(c => c.table === "audit_logs" && c.data.error_code === "SIGNATURE_VERIFICATION_FAILED");
  assertExists(a);
  assertEquals(a!.data.error_message, "Invalid authenticator data");
  assertEquals((a!.data.metadata as Record<string, unknown>).error_type, "Error");
});

Deno.test("auth-finish — 401 when verified=false", async () => {
  const r = await handle(post(BODY), createMock().client, () => Promise.resolve({ verified: false, authenticationInfo: { newCounter: 6, userVerified: false } }));
  assertEquals(r.status, 401);
  assertEquals((await r.json()).error, "Authentication failed - invalid signature");
});

Deno.test("auth-finish — 404 when user not found", async () => {
  const r = await handle(post(BODY), createMock({ userNotFound: true }).client, goodVerify);
  assertEquals(r.status, 404);
  assertEquals((await r.json()).error, "User not found");
});

Deno.test("auth-finish — 500 when session generation fails", async () => {
  const r = await handle(post(BODY), createMock({ sessionError: true }).client, goodVerify);
  assertEquals(r.status, 500);
  assertEquals((await r.json()).error, "Failed to create session");
});

Deno.test("auth-finish — success returns session, user, profile", async () => {
  const r = await handle(post(BODY), createMock().client, goodVerify);
  assertEquals(r.status, 200);
  const b = await r.json();
  assertExists(b.session);
  assertEquals(b.session.access_token, "test-jwt");
  assertEquals(b.session.refresh_token, "test-refresh");
  assertEquals(b.session.token_type, "bearer");
  assertEquals(b.session.expires_in, 3600);
  assertExists(b.user);
  assertEquals(b.user.id, TEST_USER_ID);
  assertExists(b.profile);
  assertEquals(b.profile.first_name, "Test");
  assertEquals(b.profile.last_name, "Alpha");
  assertEquals(b.profile.phone, "555-0100");
});

Deno.test("auth-finish — updates credential counter and last_used_at", async () => {
  const m = createMock();
  await handle(post(BODY), m.client, goodVerify);
  const u = m.updates.find(x => x.table === "passkey_credentials");
  assertExists(u);
  assertEquals(u!.data.counter, 6);
  assertExists(u!.data.last_used_at);
});

Deno.test("auth-finish — marks challenge as used", async () => {
  const m = createMock();
  await handle(post(BODY), m.client, goodVerify);
  assertExists(m.updates.find(x => x.table === "passkey_challenges" && x.data.used === true));
});

Deno.test("auth-finish — passkey_audit_log uses 'action' not 'operation', no 'resource_type'", async () => {
  const m = createMock();
  await handle(post(BODY), m.client, goodVerify);
  const pa = m.inserts.find(c => c.table === "passkey_audit_log" && c.data.action === "authenticate");
  assertExists(pa);
  assertEquals(pa!.data.action, "authenticate");
  assertEquals("operation" in pa!.data, false);
  assertEquals("resource_type" in pa!.data, false);
  assertEquals(pa!.data.success, true);
  assertEquals(pa!.data.user_id, TEST_USER_ID);
});

Deno.test("auth-finish — audit_logs success includes verification metadata", async () => {
  const m = createMock();
  await handle(post(BODY, { "user-agent": "TestBrowser/2.0", "x-forwarded-for": "203.0.113.50" }), m.client, goodVerify);
  const a = m.inserts.find(c => c.table === "audit_logs" && c.data.event_type === "PASSKEY_AUTH_SUCCESS");
  assertExists(a);
  assertEquals(a!.data.operation, "PASSKEY_AUTH");
  assertEquals(a!.data.resource_type, "auth_event");
  assertEquals(a!.data.success, true);
  assertEquals(a!.data.actor_ip_address, "203.0.113.50");
  const md = a!.data.metadata as Record<string, unknown>;
  assertEquals(md.counter, 6);
  assertEquals(md.userVerified, true);
  assertEquals(md.signature_verified, true);
});

Deno.test("auth-finish — unhandled error logs to passkey_audit_log and returns 500", async () => {
  const m = createMock();
  const r = await handle(new Request("http://localhost/x", { method: "POST", headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN }, body: JSON.stringify({ id: "x", rawId: "x", response: {} }) }), m.client, goodVerify);
  assertEquals(r.status, 500);
  const pa = m.inserts.find(c => c.table === "passkey_audit_log" && c.data.action === "failed_auth");
  assertExists(pa);
  assertEquals(pa!.data.success, false);
  assertExists(pa!.data.error_message);
});

Deno.test("auth-finish — client IP null when no IP headers", async () => {
  const m = createMock({ challengeNotFound: true });
  await handle(post(BODY), m.client, goodVerify);
  const a = m.inserts.find(c => c.table === "audit_logs");
  assertExists(a);
  assertEquals(a!.data.actor_ip_address, null);
});
