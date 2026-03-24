// supabase/functions/passkey-register-finish/__tests__/index.test.ts
// Behavioral tests for passkey-register-finish edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const TEST_USER_ID = "a1b2c3d4-0000-0000-0000-000000000001";
const TEST_EMAIL = "alpha@test.local";
const TEST_TENANT_ID = "2b902657-6a20-4435-a78a-576f397517ca";
const TEST_CRED_ID = "dGVzdC1jcmVkLWlk";
const TEST_ORIGIN = "https://test-app.vercel.app";

interface InsertCall { table: string; data: Record<string, unknown> }
interface UpdateCall { table: string; data: Record<string, unknown> }
interface VerificationResult { verified: boolean; registrationInfo?: { credentialID: Uint8Array; credentialPublicKey: Uint8Array; counter: number; fmt: string; aaguid: string; credentialBackedUp: boolean } }

function createMock(opts: { authError?: boolean; challengeNotFound?: boolean; profileNotFound?: boolean; credInsertError?: boolean } = {}) {
  const inserts: InsertCall[] = [];
  const updates: UpdateCall[] = [];
  return {
    client: {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ eq: () => ({ eq: () => ({ gt: () => ({ limit: () => {
              if (table === "passkey_challenges" && opts.challengeNotFound) return Promise.resolve({ data: [], error: null });
              if (table === "passkey_challenges") return Promise.resolve({ data: [{ id: "ch-1", challenge: "test-challenge", user_id: TEST_USER_ID, type: "registration", used: false, expires_at: new Date(Date.now() + 300000).toISOString() }], error: null });
              return Promise.resolve({ data: [], error: null });
            } }) }) }) }),
            single: () => {
              if (table === "profiles" && opts.profileNotFound) return Promise.resolve({ data: null, error: { message: "Not found" } });
              if (table === "profiles") return Promise.resolve({ data: { tenant_id: TEST_TENANT_ID }, error: null });
              return Promise.resolve({ data: null, error: null });
            },
          }),
        }),
        insert: (data: Record<string, unknown>) => {
          inserts.push({ table, data });
          if (table === "passkey_credentials") {
            if (opts.credInsertError) return { select: () => ({ single: () => Promise.resolve({ data: null, error: { message: "Constraint", code: "23505" } }) }) };
            return { select: () => ({ single: () => Promise.resolve({ data: { id: "stored-uuid", credential_id: TEST_CRED_ID, device_name: (data.device_name as string) || "Unknown Device", authenticator_type: data.authenticator_type || null, created_at: new Date().toISOString() }, error: null }) }) };
          }
          return Promise.resolve({ data: null, error: null });
        },
        update: (data: Record<string, unknown>) => ({ eq: () => { updates.push({ table, data }); return Promise.resolve({ data: null, error: null }); } }),
      }),
      auth: {
        getUser: () => opts.authError
          ? Promise.resolve({ data: { user: null }, error: { message: "Invalid" } })
          : Promise.resolve({ data: { user: { id: TEST_USER_ID, email: TEST_EMAIL, phone: null } }, error: null }),
      },
    },
    inserts, updates,
  };
}

function uint8ArrayToBase64url(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

const goodVerify = (): Promise<VerificationResult> => Promise.resolve({
  verified: true,
  registrationInfo: { credentialID: new Uint8Array([1,2,3,4]), credentialPublicKey: new Uint8Array([5,6,7,8]), counter: 0, fmt: "none", aaguid: "00000000-0000-0000-0000-000000000000", credentialBackedUp: false },
});

async function handle(req: Request, sb: ReturnType<typeof createMock>["client"], verify: () => Promise<VerificationResult>): Promise<Response> {
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
    const { rawId, authenticatorAttachment, device_name, user_agent } = body;

    // Check challenge
    const { data: chs, error: chErr } = await sb.from("passkey_challenges").select("id, challenge, user_id, type, used, expires_at").eq("challenge", "test-challenge").eq("user_id", user.id).eq("type", "registration").eq("used", false).gt("expires_at", new Date().toISOString()).limit(1);
    if (chErr || !chs || (chs as unknown[]).length === 0) {
      try { await sb.from("audit_logs").insert({ event_type: "PASSKEY_REGISTER_FAILED", event_category: "AUTHENTICATION", actor_user_id: user.id, actor_ip_address: ip, actor_user_agent: req.headers.get("user-agent"), operation: "PASSKEY_REGISTER", resource_type: "auth_event", success: false, error_code: "INVALID_CHALLENGE", error_message: "Invalid or expired registration challenge", metadata: { credential_id: rawId } }); } catch (_: unknown) {}
      return new Response(JSON.stringify({ error: "Invalid or expired challenge" }), { status: 400, headers: h });
    }
    await sb.from("passkey_challenges").update({ used: true }).eq("challenge");

    // Verify attestation
    let v: VerificationResult;
    try { v = await verify(); } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      try { await sb.from("audit_logs").insert({ event_type: "PASSKEY_REGISTER_ATTESTATION_FAILED", event_category: "AUTHENTICATION", actor_user_id: user.id, actor_ip_address: ip, actor_user_agent: req.headers.get("user-agent"), operation: "PASSKEY_REGISTER", resource_type: "auth_event", success: false, error_code: "ATTESTATION_VERIFICATION_FAILED", error_message: msg, metadata: { credential_id: rawId } }); } catch (_: unknown) {}
      return new Response(JSON.stringify({ error: "Attestation verification failed" }), { status: 400, headers: h });
    }
    if (!v.verified || !v.registrationInfo) {
      try { await sb.from("audit_logs").insert({ event_type: "PASSKEY_REGISTER_NOT_VERIFIED", event_category: "AUTHENTICATION", actor_user_id: user.id, operation: "PASSKEY_REGISTER", resource_type: "auth_event", success: false, error_code: "ATTESTATION_NOT_VERIFIED", error_message: "Attestation verification returned false", metadata: { credential_id: rawId } }); } catch (_: unknown) {}
      return new Response(JSON.stringify({ error: "Registration verification failed" }), { status: 400, headers: h });
    }

    const ri = v.registrationInfo;
    const vcid = uint8ArrayToBase64url(ri.credentialID);
    const vpk = uint8ArrayToBase64url(ri.credentialPublicKey);

    // Tenant lookup
    const { data: prof } = await sb.from("profiles").select("tenant_id").eq("user_id", user.id).single();
    if (!prof?.tenant_id) return new Response(JSON.stringify({ error: "User tenant not found" }), { status: 400, headers: h });

    // Store credential
    const { data: cred, error: credErr } = await sb.from("passkey_credentials").insert({
      user_id: user.id, tenant_id: prof.tenant_id, credential_id: vcid, public_key: vpk, counter: ri.counter,
      authenticator_type: authenticatorAttachment || null, transports: null, device_name: device_name || "Unknown Device",
      user_agent: user_agent || null, attestation_format: ri.fmt || "none", aaguid: ri.aaguid || null,
      backup_eligible: ri.credentialBackedUp ?? false, backup_state: ri.credentialBackedUp ?? false,
    }).select("id, credential_id, device_name, authenticator_type, created_at").single();

    if (credErr) {
      try { await sb.from("audit_logs").insert({ event_type: "PASSKEY_REGISTER_STORAGE_FAILED", event_category: "AUTHENTICATION", actor_user_id: user.id, operation: "PASSKEY_REGISTER", resource_type: "auth_event", success: false, error_code: credErr.code || "STORAGE_ERROR", error_message: credErr.message, metadata: { credential_id: vcid } }); } catch (_: unknown) {}
      return new Response(JSON.stringify({ error: "Failed to store credential" }), { status: 500, headers: h });
    }

    // passkey_audit_log uses 'action' column
    await sb.from("passkey_audit_log").insert({ user_id: user.id, credential_id: vcid, action: "register", success: true, user_agent });
    try { await sb.from("audit_logs").insert({ event_type: "PASSKEY_REGISTER_SUCCESS", event_category: "AUTHENTICATION", actor_user_id: user.id, operation: "PASSKEY_REGISTER", resource_type: "auth_event", success: true, metadata: { credential_id: vcid, device_name: device_name || "Unknown Device", attestation_format: ri.fmt || "none", counter: ri.counter } }); } catch (_: unknown) {}
    return new Response(JSON.stringify(cred), { status: 201, headers: h });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await sb.from("passkey_audit_log").insert({ action: "failed_register", success: false, error_message: msg || "Unknown error" });
    return new Response(JSON.stringify({ error: msg || "Internal server error" }), { status: 500, headers: h });
  }
}

function post(body: Record<string, unknown>, hdrs: Record<string, string> = {}): Request {
  return new Request("http://localhost/x", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer ok", Origin: TEST_ORIGIN, ...hdrs }, body: JSON.stringify(body) });
}
const BODY = { id: TEST_CRED_ID, rawId: TEST_CRED_ID, response: { clientDataJSON: btoa(JSON.stringify({ challenge: "test-challenge" })), attestationObject: "mock", transports: ["internal"] }, authenticatorAttachment: "platform", device_name: "Test Device Alpha", user_agent: "TestAgent/1.0" };

// =============================================================================
Deno.test("register-finish — CORS preflight 204", async () => {
  const m = createMock();
  assertEquals((await handle(new Request("http://localhost/x", { method: "OPTIONS" }), m.client, goodVerify)).status, 204);
});

Deno.test("register-finish — rejects GET with 405", async () => {
  const m = createMock();
  assertEquals((await handle(new Request("http://localhost/x", { method: "GET" }), m.client, goodVerify)).status, 405);
});

Deno.test("register-finish — rejects missing auth with 401", async () => {
  const m = createMock();
  const r = await handle(new Request("http://localhost/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(BODY) }), m.client, goodVerify);
  assertEquals(r.status, 401);
});

Deno.test("register-finish — 400 for invalid challenge", async () => {
  const m = createMock({ challengeNotFound: true });
  const r = await handle(post(BODY), m.client, goodVerify);
  assertEquals(r.status, 400);
  assertEquals((await r.json()).error, "Invalid or expired challenge");
  assertExists(m.inserts.find(c => c.table === "audit_logs" && c.data.error_code === "INVALID_CHALLENGE"));
});

Deno.test("register-finish — 400 when attestation throws", async () => {
  const m = createMock();
  const r = await handle(post(BODY), m.client, () => Promise.reject(new Error("Format not supported")));
  assertEquals(r.status, 400);
  assertEquals((await r.json()).error, "Attestation verification failed");
  const a = m.inserts.find(c => c.table === "audit_logs" && c.data.error_code === "ATTESTATION_VERIFICATION_FAILED");
  assertExists(a);
  assertEquals(a!.data.error_message, "Format not supported");
});

Deno.test("register-finish — 400 when verified=false", async () => {
  const m = createMock();
  const r = await handle(post(BODY), m.client, () => Promise.resolve({ verified: false }));
  assertEquals(r.status, 400);
  assertEquals((await r.json()).error, "Registration verification failed");
});

Deno.test("register-finish — 400 when user has no tenant", async () => {
  const m = createMock({ profileNotFound: true });
  const r = await handle(post(BODY), m.client, goodVerify);
  assertEquals(r.status, 400);
  assertEquals((await r.json()).error, "User tenant not found");
});

Deno.test("register-finish — 500 when credential storage fails", async () => {
  const m = createMock({ credInsertError: true });
  const r = await handle(post(BODY), m.client, goodVerify);
  assertEquals(r.status, 500);
  assertEquals((await r.json()).error, "Failed to store credential");
  assertExists(m.inserts.find(c => c.table === "audit_logs" && c.data.event_type === "PASSKEY_REGISTER_STORAGE_FAILED"));
});

Deno.test("register-finish — success returns 201 with credential", async () => {
  const m = createMock();
  const r = await handle(post(BODY), m.client, goodVerify);
  assertEquals(r.status, 201);
  const b = await r.json();
  assertExists(b.id);
  assertExists(b.credential_id);
  assertEquals(b.device_name, "Test Device Alpha");
  assertExists(b.created_at);
});

Deno.test("register-finish — stores credential with tenant_id and COSE key", async () => {
  const m = createMock();
  await handle(post(BODY), m.client, goodVerify);
  const ci = m.inserts.find(c => c.table === "passkey_credentials");
  assertExists(ci);
  assertEquals(ci!.data.user_id, TEST_USER_ID);
  assertEquals(ci!.data.tenant_id, TEST_TENANT_ID);
  assertExists(ci!.data.credential_id);
  assertExists(ci!.data.public_key);
  assertEquals(ci!.data.counter, 0);
  assertEquals(ci!.data.device_name, "Test Device Alpha");
  assertEquals(ci!.data.attestation_format, "none");
});

Deno.test("register-finish — passkey_audit_log uses 'action' column, not 'operation'", async () => {
  const m = createMock();
  await handle(post(BODY), m.client, goodVerify);
  const pa = m.inserts.find(c => c.table === "passkey_audit_log" && c.data.action === "register");
  assertExists(pa);
  assertEquals(pa!.data.action, "register");
  assertEquals("operation" in pa!.data, false);
  assertEquals(pa!.data.success, true);
  assertEquals(pa!.data.user_id, TEST_USER_ID);
});

Deno.test("register-finish — audit_logs success includes metadata", async () => {
  const m = createMock();
  await handle(post(BODY), m.client, goodVerify);
  const a = m.inserts.find(c => c.table === "audit_logs" && c.data.event_type === "PASSKEY_REGISTER_SUCCESS");
  assertExists(a);
  assertEquals(a!.data.operation, "PASSKEY_REGISTER");
  assertEquals(a!.data.resource_type, "auth_event");
  assertEquals(a!.data.success, true);
  const md = a!.data.metadata as Record<string, unknown>;
  assertExists(md.credential_id);
  assertEquals(md.device_name, "Test Device Alpha");
  assertEquals(md.counter, 0);
});

Deno.test("register-finish — marks challenge as used", async () => {
  const m = createMock();
  await handle(post(BODY), m.client, goodVerify);
  assertExists(m.updates.find(u => u.table === "passkey_challenges" && u.data.used === true));
});
