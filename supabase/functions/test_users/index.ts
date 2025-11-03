// supabase/functions/test-users/index.ts
// Deno Edge Function (v2 runtime). Strict, no placeholders.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type PostgrestError } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

// Environment (set in Supabase dashboard -> Functions)
const SERVICE_URL = Deno.env.get("SERVICE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

type CreateBody = {
  email?: string;
  phone?: string;
  password?: string; // for test users only
  full_name?: string;
  test_tag?: string;
};

type PurgeBody = {
  test_tag?: string;         // optional filter
  older_than_minutes?: number; // default 10
};

type ProfileRow = {
  user_id: string;
};

function getSupabaseForService() {
  return createClient(SERVICE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

async function getAuthedUserProfile(req: Request) {
  // Caller token (Bearer) must be a real session; we use anon client to read who is calling
  const supaAnon = createClient(SERVICE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  const { data: userData } = await supaAnon.auth.getUser(token);
  const authedUser = userData?.user;
  if (!authedUser) return null;

  const { data: profile, error } = await supaAnon
    .from("profiles")
    .select("user_id, role")
    .eq("user_id", authedUser.id)
    .single();

  if (error) return null;
  return { user: authedUser, profile };
}

function ensureSuperAdmin(profile: { role?: string } | null | undefined) {
  if (!profile || profile.role !== "super_admin") {
    throw new Response(JSON.stringify({ error: "Forbidden: super_admin only" }), { status: 403 });
  }
}

async function createTestUser(body: CreateBody) {
  const svc = getSupabaseForService();

  // 1) Create auth user
  const email = body.email ?? `test_${crypto.randomUUID().slice(0, 8)}@example.test`;
  const password = body.password ?? `T3st!${crypto.randomUUID().slice(0, 6)}`;
  const phone = body.phone; // optional

  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email,
    phone,
    password,
    email_confirm: true,
    phone_confirm: !!phone,
    user_metadata: { is_test: true, test_tag: body.test_tag ?? null }
  });

  if (createErr || !created?.user) {
    return new Response(
      JSON.stringify({ error: createErr?.message ?? "createUser failed" }),
      { status: 500 }
    );
  }

  const uid = created.user.id;

  // 2) Insert profile with is_test=true
  const { error: profErr } = await svc.from("profiles").insert({
    user_id: uid,
    full_name: body.full_name ?? "Test User",
    is_test: true,
    test_tag: body.test_tag ?? null,
    role: "patient" // adjust to your default patient role
  });

  if (profErr) {
    // cleanup auth if profile insert fails
    await svc.auth.admin.deleteUser(uid);
    return new Response(JSON.stringify({ error: profErr?.message ?? "profile insert failed" }), {
      status: 500
    });
  }

  return new Response(
    JSON.stringify({ ok: true, user_id: uid, email, phone, password }),
    { status: 200 }
  );
}

async function purgeTestUsers(body: PurgeBody) {
  const svc = getSupabaseForService();

  const older = body.older_than_minutes ?? 10;
  let q = svc
    .from("profiles")
    .select("user_id")
    .eq("is_test", true)
    .lte("created_at", new Date(Date.now() - older * 60_000).toISOString());

  if (body.test_tag) q = q.eq("test_tag", body.test_tag);

  const { data: rows, error } = await q as {
    data: ProfileRow[] | null;
    error: PostgrestError | null;
  };

  if (error) {
    return new Response(JSON.stringify({ error: error?.message ?? "query failed" }), { status: 500 });
  }

  const uids = (rows ?? []).map((r: ProfileRow) => r.user_id);
  if (uids.length === 0) {
    return new Response(JSON.stringify({ ok: true, deleted: 0 }), { status: 200 });
  }

  // Delete dependent app data first (example tables – extend as needed)
  // NOTE: add all tables that reference user_id
  const tables = [
    "community_moments",
    "self_reports",
    "checkins",
    "user_questions",
    "mobile_devices",
    "geofence_zones"
  ];

  for (const t of tables) {
    const { error: delErr } = await svc.from(t).delete().in("user_id", uids);
    if (delErr) {
      // continue but report (optional-chaining to satisfy TS)
      console.warn(`Delete from ${t} failed:`, delErr?.message);
    }
  }

  // Delete profiles (soft safety already enforced by RLS + trigger; we use service key anyway)
  const { error: profDelErr } = await svc.from("profiles").delete().in("user_id", uids);
  if (profDelErr) {
    console.warn("Profile delete errors:", profDelErr?.message);
  }

  // Finally, delete Auth users
  let count = 0;
  for (const uid of uids) {
    const { error: authErr } = await svc.auth.admin.deleteUser(uid);
    if (authErr) {
      console.warn("Auth delete error for", uid, authErr?.message);
      continue;
    }
    count++;
  }

  return new Response(
    JSON.stringify({ ok: true, requested: uids.length, auth_deleted: count }),
    { status: 200 }
  );
}

Deno.serve(async (req) => {
  try {
    // Basic CORS (optional; remove if you have centralized CORS)
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          // CORS handled by shared module,
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS"
        }
      });
    }

    const url = new URL(req.url);
    const authed = await getAuthedUserProfile(req);
    const profile = authed?.profile as { role?: string } | null | undefined;
    const method = req.method.toUpperCase();

    if (url.pathname.endsWith("/create")) {
      // Allow admin+ to create tests
      if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
        return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403 });
      }
      if (method !== "POST") return new Response("Method Not Allowed", { status: 405 });
      const body = (await req.json()) as CreateBody;
      return await createTestUser(body);
    }

    if (url.pathname.endsWith("/purge")) {
      // Only super_admin can purge
      try {
        ensureSuperAdmin(profile);
      } catch (resp) {
        return resp as Response;
      }
      if (method !== "POST") return new Response("Method Not Allowed", { status: 405 });
      const body = (await req.json()) as PurgeBody;
      return await purgeTestUsers(body);
    }

    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message ?? "Unhandled error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});

