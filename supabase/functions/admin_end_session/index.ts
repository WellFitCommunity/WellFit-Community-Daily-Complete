// supabase/functions/admin_end_session/index.ts
import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { handleOptions, withCors } from "../_shared/cors.ts";

// Use shared env which has correct key order (SB_SERVICE_ROLE_KEY first for RLS bypass)
const SUPABASE_SERVICE_ROLE_KEY = SB_SECRET_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return handleOptions(req);

  try {
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

    const { error: updErr } = await supabase
      .from("admin_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("revoked_at", null);

    if (updErr) {
      return withCors(
        req,
        new Response(JSON.stringify({ ok: false, error: updErr.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    return withCors(
      req,
      new Response(JSON.stringify({ ok: true }), {
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
