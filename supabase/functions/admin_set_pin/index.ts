import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const URL     = Deno.env.get("SUPABASE_URL")!;
const ANON    = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sAnon = createClient(URL, ANON);
const sSvc  = createClient(URL, SERVICE);

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const { data: userData } = await sAnon.auth.getUser(token);
  const uid = userData?.user?.id;
  if (!uid) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  // Require admin/super_admin
  const { data: roles } = await sSvc.from("user_roles").select("roles!inner(name)").eq("user_id", uid);
  const isAdmin = (roles ?? []).some((r: any) => r.roles?.name === "admin" || r.roles?.name === "super_admin");
  if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  const { pin } = await req.json().catch(() => ({}));
  if (!pin || typeof pin !== "string" || !/^\d{4,8}$/.test(pin)) {
    return new Response(JSON.stringify({ error: "PIN must be 4–8 digits." }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const pin_hash = await bcrypt.hash(pin, 10);
  const { error: upErr } = await sSvc
    .from("admin_pins")
    .upsert({ user_id: uid, pin_hash, updated_at: new Date().toISOString() });

  if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { "Content-Type": "application/json" } });

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
