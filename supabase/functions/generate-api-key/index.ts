// File: supabase/functions/generate-api-key/index.ts
import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("generate-api-key");

// ---- Env (supports Postgres 17 names w/ fallbacks) -------------------------
const SB_PUBLISHABLE_API_KEY =
  Deno.env.get("SB_PUBLISHABLE_API_KEY") ?? SB_PUBLISHABLE_API_KEY;
const SB_SECRET_KEY =
  Deno.env.get("SB_SECRET_KEY") ?? SB_SECRET_KEY;

async function checkUserRole(supabaseClient: SupabaseClient, requiredRoles: string[]): Promise<boolean> {
  const { data: { user }, error: userErr } = await supabaseClient.auth.getUser();
  if (userErr || !user) return false;

  // RPC must enforce RLS with current_user via JWT
  const { data: ok, error: rpcErr } = await supabaseClient
    .rpc("check_user_has_role", { role_names: requiredRoles });
  if (rpcErr) {
    logger.error("RPC role check failed", { message: rpcErr.message });
    return false;
  }
  return ok === true;
}

function generateRandomHex(bytesLen: number): string {
  const bytes = new Uint8Array(bytesLen);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}

function slugifyOrg(input: string): string {
  return input.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");
}

// ---- Handler ----------------------------------------------------------------
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") return handleOptions(req);

  const { headers } = corsFromRequest(req);
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    // Client bound to caller’s JWT (so RLS/RPC see current_user)
    const jwt = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SB_PUBLISHABLE_API_KEY, {
      global: { headers: { Authorization: jwt } },
    });

    // Auth & role check
    const isAdmin = await checkUserRole(userClient, ["admin", "super_admin"]);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized: admin role required." }), { status: 403, headers });
    }

    // Parse body
    let org_name: unknown;
    try {
      const body = await req.json();
      org_name = (body as any)?.org_name;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
    }

    if (typeof org_name !== "string" || !org_name.trim()) {
      return new Response(JSON.stringify({ error: "Missing or invalid org_name" }), { status: 400, headers });
    }

    const orgSlug = slugifyOrg(org_name);
    if (!orgSlug) {
      return new Response(JSON.stringify({ error: "org_name must contain letters/numbers" }), { status: 400, headers });
    }

    // Generate key (32 bytes -> 64 hex chars)
    const randomHex = generateRandomHex(32);
    const apiKeyPlain = `${orgSlug}-${randomHex}`;
    const apiKeyHash = await sha256Hex(apiKeyPlain);

    // Get current user id for created_by
    const { data: { user } } = await userClient.auth.getUser();

    // Service role client for write
    const svc = createClient(SUPABASE_URL, SB_SECRET_KEY);
    const { error: insertErr } = await svc
      .from("api_keys")
      .insert([{ org_name: org_name.trim(), api_key_hash: apiKeyHash, active: true, created_by: user?.id ?? null }]);

    if (insertErr) {
      logger.error("Insert api_keys failed", { message: insertErr.message });
      return new Response(JSON.stringify({ error: "Failed to save API key" }), { status: 500, headers });
    }

    // Return plain key once (client must store it)
    return new Response(JSON.stringify({ api_key: apiKeyPlain }), { status: 200, headers });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("generate-api-key error", { message: errorMessage });
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers });
  }
});
