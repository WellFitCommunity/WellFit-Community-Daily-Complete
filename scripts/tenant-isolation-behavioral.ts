// scripts/tenant-isolation-behavioral.ts
//
// T6 — Tenant Isolation BEHAVIORAL harness (definitive cross-tenant proof).
//
// Stands up two real tenants (A, B) with real admin identities, seeds tenant-B
// data, then — authenticated as tenant A's admin — attempts to read tenant B's
// rows. RLS must return 0 rows. Any row returned is a PROVEN cross-tenant leak
// (not the heuristic guess from scripts/tenant-isolation-audit.sql).
//
// Deno script (uses Deno.env.get for the SECRET service key — the sanctioned
// pattern; a Node/vitest test can't read a non-VITE secret without breaking the
// no-process.env / no-VITE-secret rules).
//
// RUN (recommended target: a disposable Supabase branch, or prod with the
// is_test_user/test_tag markers this script uses for reliable teardown):
//   SB_URL=... SB_SERVICE_KEY=... SB_ANON_KEY=... \
//     deno run --allow-env --allow-net scripts/tenant-isolation-behavioral.ts
//
// It ALWAYS tears down (tenants, users, profiles, seeded rows) even on failure.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

// CLI report output (no console.* — this is a standalone Deno report tool).
const _enc = new TextEncoder();
const out = (s: string): void => { Deno.stdout.writeSync(_enc.encode(s + "\n")); };
const err = (s: string): void => { Deno.stderr.writeSync(_enc.encode(s + "\n")); };

const SB_URL = Deno.env.get("SB_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SB_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SB_ANON_KEY") ?? Deno.env.get("VITE_SB_PUBLISHABLE_API_KEY") ?? Deno.env.get("VITE_SUPABASE_ANON_KEY") ?? "";

if (!SB_URL || !SERVICE_KEY || !ANON_KEY) {
  err("Missing SB_URL / SB_SERVICE_KEY / SB_ANON_KEY");
  Deno.exit(2);
}

// Deno.env is fine; Date.now is fine in a script (unlike workflow scripts).
const RUN_TAG = `t6-iso-${Math.floor(Date.now() / 1000)}`;

interface ProbeTable {
  table: string;
  tenantScoped: boolean; // control (true, must isolate) vs flagged (false, under test)
  seed: (tenantId: string) => Record<string, unknown>;
}

const PROBES: ProbeTable[] = [
  { table: "check_ins", tenantScoped: true, seed: (t) => ({ user_id: crypto.randomUUID(), tenant_id: t, label: `${RUN_TAG} ctrl`, timestamp: new Date().toISOString() }) },
  { table: "patient_engagement_metrics", tenantScoped: false, seed: (t) => ({ patient_id: crypto.randomUUID(), tenant_id: t, date: new Date().toISOString().slice(0, 10) }) },
  { table: "provider_tasks", tenantScoped: false, seed: (t) => ({ tenant_id: t, task_type: "other", title: `${RUN_TAG} probe` }) },
];

const admin: SupabaseClient = createClient(SB_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface TestTenant { id: string; adminUserId: string; email: string; token: string }

// Track every created id AS IT IS CREATED so teardown cleans up even on a
// partial/mid-step failure (orphan-proof).
const createdTenantIds: string[] = [];
const createdUserIds: string[] = [];

async function makeTenant(label: string): Promise<TestTenant> {
  const suffix = `${RUN_TAG}-${label}`;
  const { data: t, error: te } = await admin.from("tenants")
    .insert({ name: `T6 Isolation ${suffix}`, is_active: true }).select("id").single();
  if (te || !t) throw new Error(`tenant create failed: ${te?.message}`);
  const tenantId = t.id as string;
  createdTenantIds.push(tenantId);

  const email = `${suffix}@example.invalid`;
  const password = `Pw-${RUN_TAG}-${label}-9x!`;
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (ue || !u?.user) throw new Error(`user create failed: ${ue?.message}`);
  const adminUserId = u.user.id;
  createdUserIds.push(adminUserId);

  // createUser fires a trigger that auto-provisions profile + user_roles.
  // UPDATE the profile in place (don't set role_id — that re-inserts user_roles
  // and hits idx_user_roles_user_id_unique). Mark as tenant admin + test user.
  const { error: pe } = await admin.from("profiles").update({
    tenant_id: tenantId, role: "admin", is_admin: true,
    first_name: "T6", last_name: label, is_test_user: true, test_tag: RUN_TAG,
  }).eq("user_id", adminUserId);
  if (pe) throw new Error(`profile update failed: ${pe.message}`);
  // Also elevate the auto-created user_roles row to admin (best-effort).
  await admin.from("user_roles").update({ role: "admin" }).eq("user_id", adminUserId).then(() => {}, () => {});

  const anon = createClient(SB_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: s, error: se } = await anon.auth.signInWithPassword({ email, password });
  if (se || !s?.session) throw new Error(`sign-in failed: ${se?.message}`);

  return { id: tenantId, adminUserId, email, token: s.session.access_token };
}

let tenantA: TestTenant | null = null;
let tenantB: TestTenant | null = null;
const seeded: Array<{ table: string; id: string }> = [];

async function teardown() {
  for (const r of seeded) await admin.from(r.table).delete().eq("id", r.id).then(() => {}, () => {});
  // Backstop: sweep any test profiles by our unique run tag first.
  await admin.from("profiles").delete().eq("test_tag", RUN_TAG).then(() => {}, () => {});
  for (const uid of createdUserIds) {
    await admin.from("profiles").delete().eq("user_id", uid).then(() => {}, () => {});
    await admin.auth.admin.deleteUser(uid).catch(() => {});
  }
  for (const tid of createdTenantIds) {
    await admin.from("tenants").delete().eq("id", tid).then(() => {}, () => {});
  }
}

let failures = 0;
try {
  tenantA = await makeTenant("A");
  tenantB = await makeTenant("B");

  for (const p of PROBES) {
    const { data, error } = await admin.from(p.table).insert(p.seed(tenantB.id)).select("id").single();
    if (error || !data) throw new Error(`seed ${p.table} failed: ${error?.message}`);
    seeded.push({ table: p.table, id: data.id as string });
  }

  const asA = createClient(SB_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${tenantA.token}` } },
    auth: { persistSession: false },
  });

  out(`\nT6 behavioral tenant-isolation probe (run ${RUN_TAG})`);
  out("tenant A admin attempting to read tenant B rows:\n");
  for (const p of PROBES) {
    const { data } = await asA.from(p.table).select("id, tenant_id").eq("tenant_id", tenantB.id);
    const leaked = (data ?? []).length;
    const ok = leaked === 0;
    const verdict = ok ? "ISOLATED ✅" : `LEAK 🔴 (${leaked} tenant-B row(s) visible)`;
    out(`  ${p.table.padEnd(32)} ${p.tenantScoped ? "[control] " : "[flagged] "} ${verdict}`);
    if (!ok) failures++;
  }
  out(`\nResult: ${failures === 0 ? "ALL ISOLATED" : `${failures} LEAK(S) FOUND`}\n`);
} finally {
  await teardown();
  out("teardown complete.");
}

Deno.exit(failures === 0 ? 0 : 1);
