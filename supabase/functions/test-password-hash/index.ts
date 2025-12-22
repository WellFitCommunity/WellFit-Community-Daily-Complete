/**
 * Test Password Hash - Temporary function to debug password hashing
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { hashPassword, verifyPin } from "../_shared/crypto.ts";

const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  const SUPABASE_URL = getEnv("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = getEnv("SB_SECRET_KEY", "SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");

  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, set_password } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "email and password required", received: { email: !!email, password: !!password } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get current password hash
    const { data: admin, error: lookupError } = await supabase
      .from('super_admin_users')
      .select('id, email, password_hash')
      .ilike('email', email)
      .single();

    if (lookupError || !admin) {
      return new Response(
        JSON.stringify({ error: "User not found", lookupError: lookupError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If set_password is true, hash and store the new password
    if (set_password) {
      const newHash = await hashPassword(password);
      const { error: updateError } = await supabase
        .from('super_admin_users')
        .update({ password_hash: newHash })
        .eq('id', admin.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Update failed", updateError: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Password updated",
          email: admin.email
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Otherwise, verify the password
    const isValid = await verifyPin(password, admin.password_hash);

    return new Response(
      JSON.stringify({
        email: admin.email,
        hasPasswordHash: !!admin.password_hash,
        passwordValid: isValid,
        hashLength: admin.password_hash?.length,
        hashFormat: admin.password_hash?.includes(':') ? 'salt:hash' : 'unknown'
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: "Internal error", details: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
