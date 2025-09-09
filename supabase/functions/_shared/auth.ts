// Deno Edge - Legacy JWT launch (Method A: call getUser)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SECRET_KEY = Deno.env.get("SB_SECRET_KEY")!;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") || ""; // for bucket 4

const supabaseAdmin = createClient(SUPABASE_URL, SB_SECRET_KEY);

// Basic CORS helper
export function withCORS(h: (req: Request) => Promise<Response> | Response) {
  return async (req: Request) => {
    const origin = req.headers.get("origin") ?? "*";
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-internal-secret",
          "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        },
      });
    }
    const res = await h(req);
    const hds = new Headers(res.headers);
    hds.set("Access-Control-Allow-Origin", origin);
    return new Response(res.body, { status: res.status, headers: hds });
  };
}

// Bucket 2/3: require logged-in user
export async function requireUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Response("Missing bearer", { status: 401 });
  const token = auth.slice(7).trim();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) throw new Response("Invalid token", { status: 401 });
  return data.user; // { id, email, phone, ... }
}

// Bucket 3: require role (admin/super_admin)
export async function requireRole(userId: string, allowed: string[] = ["admin","super_admin"]) {
  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Response("Role lookup failed", { status: 500 });
  if (!data || !allowed.includes(data.role)) throw new Response("Forbidden", { status: 403 });
  return data.role;
}

// Bucket 4: internal-only
export function requireInternal(req: Request) {
  const key = req.headers.get("x-internal-secret") || "";
  if (!INTERNAL_SECRET || key !== INTERNAL_SECRET) {
    throw new Response("Forbidden", { status: 403 });
  }
}
