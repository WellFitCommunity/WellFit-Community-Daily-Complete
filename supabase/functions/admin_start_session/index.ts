// supabase/functions/admin_start_session/index.ts
import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyPin } from "../_shared/crypto.ts";

import { handleOptions, withCors } from "../_shared/cors.ts";

const SUPABASE_URL = SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SB_SECRET_KEY") ?? SB_SECRET_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return handleOptions(req);

  try {
    const { pin, role } = await req.json();

    if (!pin || !role) {
      return withCors(
        req,
        new Response(JSON.stringify({ ok: false, error: "Missing pin or role" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);

    if (userErr || !userData?.user) {
      return withCors(
        req,
        new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    const user = userData.user;

    const { data: row, error: pinErr } = await supabase
      .from("staff_pins")
      .select("pin_hash")
      .eq("user_id", user.id)
      .eq("role", role)
      .maybeSingle();

    if (pinErr || !row) {
      return withCors(
        req,
        new Response(JSON.stringify({ ok: false, error: "PIN not set for this role" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    const valid = await verifyPin(pin, row.pin_hash);
    if (!valid) {
      return withCors(
        req,
        new Response(JSON.stringify({ ok: false, error: "Invalid PIN" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    const { data: session, error: insErr } = await supabase
      .from("admin_sessions")
      .insert({
        user_id: user.id,
        role,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(), // 2h
      })
      .select("*")
      .maybeSingle();

    if (insErr || !session) {
      return withCors(
        req,
        new Response(
          JSON.stringify({ ok: false, error: insErr?.message || "Session creation failed" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        ),
      );
    }

    return withCors(
      req,
      new Response(JSON.stringify({ ok: true, session }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch (e: any) {
    return withCors(
      req,
      new Response(JSON.stringify({ ok: false, error: e?.message || "Unexpected error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
});
