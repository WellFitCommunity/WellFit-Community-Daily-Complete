// supabase/functions/_shared/auth.ts  (drop-in replacement for the helper you pasted)
// Deno Edge auth helpers: CORS (via shared module), JWT -> user, role check via profiles.role_id -> roles.id

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "./cors.ts";

// ---- ENV ----
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")  ?? "";
const SB_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") ?? ""; // for internal-only handlers

// Admin client (bypasses RLS)
export const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SB_SECRET_KEY);

// ---- CORS (using shared white-label-ready module) ----
// Wrap a handler with CORS & preflight
export function withCORS(handler: (req: Request) => Promise<Response> | Response, _methods = ["GET","POST","PUT","PATCH","DELETE","OPTIONS"]) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return handleOptions(req);

    const { headers: corsHeaders } = corsFromRequest(req);

    const res = await handler(req);
    const h = new Headers(res.headers);
    Object.entries(corsHeaders).forEach(([k,v]) => { if (!h.has(k)) h.set(k, v); });
    return new Response(res.body, { status: res.status, headers: h });
  };
}

// ---- AuthZ helpers ----

// Require a valid Supabase JWT (from Authorization: Bearer <token>).
export async function requireUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Response(JSON.stringify({ error: "Missing bearer" }), { status: 401 });
  const token = auth.slice(7).trim();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) throw new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  return data.user; // { id, email, phone, ... }
}

// ✅ Correct for your schema: profiles.role_id -> roles.id, check roles.name in allowed[]
export async function requireRole(userId: string, allowed: string[] = ["admin","super_admin"]) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role_id, roles:role_id ( id, name )")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Response(JSON.stringify({ error: "Role lookup failed" }), { status: 500 });
  // Supabase join returns object for single FK, but TS types it as array — handle both
  const roles = data?.roles as { id: string; name: string } | { id: string; name: string }[] | null;
  const roleName = Array.isArray(roles) ? roles[0]?.name : roles?.name ?? null;
  if (!roleName || !allowed.includes(roleName)) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
  return roleName; // e.g. 'admin' | 'super_admin'
}

// Internal-only guard (for maintenance hooks, webhooks, etc.)
export function requireInternal(req: Request) {
  const key = req.headers.get("x-internal-secret") || "";
  if (!INTERNAL_SECRET || key !== INTERNAL_SECRET) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }
}

/**
 * AI-1 authorization gate.
 *
 * Confirms the authenticated caller is allowed to access `patientId`'s data.
 * Allow conditions:
 *   1. caller is the patient (self-access via auth.users.id === patientId)
 *   2. caller has a role in `clinicalRoles` (default: admin/super_admin/
 *      physician/nurse/care_manager/case_manager — matches the
 *      send-team-alert and ai-nurseos-burnout-advisor convention)
 *
 * Conservative by design: a clinician must hold one of the allowed roles
 * globally, not "be on the patient's care team." The care-team check is a
 * legitimate follow-up tightening once the schema confirms `care_team_members`
 * is consistently populated. Until then this CLOSES the AI-1 PHI hole.
 *
 * Throws a Response (401/403) on rejection so callers can re-throw.
 * Returns the caller's role name on success.
 */
export async function requirePatientAccess(
  callerUserId: string,
  patientId: string,
  clinicalRoles: string[] = [
    "admin",
    "super_admin",
    "physician",
    "nurse",
    "case_manager",
    "care_manager",
  ],
): Promise<string> {
  // Self-access — patient querying their own data.
  if (callerUserId === patientId) {
    return "self";
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role_id, roles:role_id ( id, name )")
    .eq("user_id", callerUserId)
    .maybeSingle();

  if (error) {
    throw new Response(JSON.stringify({ error: "Authorization lookup failed" }), { status: 500 });
  }

  const roles = data?.roles as { id: string; name: string } | { id: string; name: string }[] | null;
  const roleName = Array.isArray(roles) ? roles[0]?.name : roles?.name ?? null;

  if (!roleName || !clinicalRoles.includes(roleName)) {
    throw new Response(
      JSON.stringify({ error: "Forbidden: not authorized to access this patient" }),
      { status: 403 },
    );
  }

  return roleName;
}
