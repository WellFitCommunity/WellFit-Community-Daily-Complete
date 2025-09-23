import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2?target=deno";
import { z } from "https://esm.sh/zod@3.23.8?target=deno";
import { cors } from "../_shared/cors.ts";
import { hashPin } from "../_shared/crypto.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

const schema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4–8 digits"),
  role: z.enum(["admin", "super_admin"]).default("admin"),
});

serve(async (req) => {
  const { headers, allowed } = cors(req.headers.get("origin"), {
    methods: ["POST", "OPTIONS"],
  });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!allowed) return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const { data: u } = await supabase.auth.getUser(token);
    const user_id = u?.user?.id;
    if (!user_id) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("user_id", user_id)
      .single();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: "Admin required" }), { status: 403, headers });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.errors[0].message }), { status: 400, headers });
    }

    const { pin, role } = parsed.data;
    const pin_hash = await hashPin(pin);

    const { error } = await supabase.from("admin_pins").upsert({
      user_id,
      role,
      pin_hash,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, message: "PIN updated" }), { status: 200, headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers });
  }
});