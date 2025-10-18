import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2?target=deno";
import { z } from "https://esm.sh/zod@3.23.8?target=deno";
import { cors } from "../_shared/cors.ts";
import { verifyPin, generateSecureToken } from "../_shared/crypto.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_SESSION_TTL_MIN = 120;

const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

const schema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, "PIN must be 4–8 digits."),
  role: z.enum([
    "admin",
    "super_admin",
    "nurse",
    "physician",
    "doctor",
    "nurse_practitioner",
    "physician_assistant",
    "clinical_supervisor",
    "department_head",
    "physical_therapist"
  ]),
});


serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const { headers, allowed } = cors(origin, {
    methods: ["POST", "OPTIONS"],
    allowHeaders: [
      "authorization",
      "content-type",
      "x-client-info",
      "apikey",
      "x-supabase-api-version"
    ]
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
    if (!parsed.success) return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400, headers });

    const { pin, role } = parsed.data;

    const { data: pinRow, error: pinErr } = await supabase
      .from("staff_pins")
      .select("pin_hash")
      .eq("user_id", user_id)
      .eq("role", role)
      .single();

    if (pinErr) {
      if ((pinErr as any).code === "PGRST116") {
        return new Response(JSON.stringify({ error: "PIN not set" }), { status: 400, headers });
      }
      throw pinErr;
    }

    const valid = await verifyPin(pin, pinRow!.pin_hash);
    if (!valid) return new Response(JSON.stringify({ error: "Incorrect PIN" }), { status: 401, headers });

    const expires = new Date(Date.now() + ADMIN_SESSION_TTL_MIN * 60 * 1000);
    const admin_token = generateSecureToken();

    const { error: upErr } = await supabase.from("admin_sessions").upsert({
      user_id,
      role,
      admin_token,
      expires_at: expires.toISOString(),
    });
    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({ success: true, expires_at: expires.toISOString(), admin_token }),
      { status: 200, headers }
    );
  } catch (e: any) {
    console.error("verify-admin-pin error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers });
  }
});