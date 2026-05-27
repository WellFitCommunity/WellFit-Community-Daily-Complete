// supabase/functions/admin_end_session/index.ts
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { handleOptions, withCors } from "../_shared/cors.ts";

const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

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
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return withCors(
      req,
      new Response(JSON.stringify({ ok: false, error: errorMessage || "Unexpected error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
});
