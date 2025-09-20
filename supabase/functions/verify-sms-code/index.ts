// supabase/functions/sms-verify-code/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors } from "../_shared/cors.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  const { headers, allowed } = cors(req.headers.get("origin"), {
    methods: ["POST", "OPTIONS"],
    allowHeaders: ["authorization", "x-client-info", "apikey", "content-type"],
    maxAge: 600,
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: allowed ? 204 : 403, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  // Twilio envs (no throw)
  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
  const TWILIO_AUTH_TOKEN  = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
  const VERIFY_SID         = Deno.env.get("TWILIO_VERIFY_SERVICE_SID") ?? "";

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !VERIFY_SID) {
    console.error("Missing Twilio envs");
    return new Response(JSON.stringify({ error: "Server not configured (Twilio envs missing)" }), {
      status: 500, headers,
    });
  }

  try {
    const { phone, code } = await req.json().catch(() => ({}));

    const isE164 = (p: string) => /^\+\d{10,15}$/.test(p || "");
    const isCode = (c: string) => /^\d{4,8}$/.test(c || "");

    if (!isE164(phone)) {
      return new Response(JSON.stringify({ error: "Invalid E.164 phone format" }), { status: 400, headers });
    }
    if (!isCode(code)) {
      return new Response(JSON.stringify({ error: "Code must be 4–8 digits" }), { status: 400, headers });
    }

    const resp = await fetch(
      `https://verify.twilio.com/v2/Services/${VERIFY_SID}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, Code: code }).toString(),
      }
    );

    const txt = await resp.text();
    let json: unknown = {};
    try { json = JSON.parse(txt); } catch { /* text fallback */ }

    const approved =
      resp.ok &&
      typeof json === "object" &&
      json !== null &&
      // deno-lint-ignore no-explicit-any
      (json as any).status === "approved";

    if (!approved) {
      console.error("Twilio verify error", resp.status, txt);
      return new Response(JSON.stringify({ error: "Invalid or expired verification code", details: json || txt }), {
        status: 401, headers,
      });
    }

    // Success — now complete the registration
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.4?dts");
      const SB_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL") || "";
      const SB_SECRET_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SB_SECRET_KEY") || "";

      if (!SB_URL || !SB_SECRET_KEY) {
        console.error("Missing Supabase configuration");
        return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500, headers });
      }

      const supabase = createClient(SB_URL, SB_SECRET_KEY);

      // Get pending registration
      const { data: pending, error: pendingError } = await supabase
        .from("pending_registrations")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();

      if (pendingError || !pending) {
        console.error("No pending registration found for phone:", phone);
        return new Response(JSON.stringify({ error: "No pending registration found. Please register again." }), {
          status: 404, headers,
        });
      }

      // Create the actual user account
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        phone: phone,
        password: pending.password_hash, // Plain password from pending registration
        phone_confirm: true, // Phone is now verified
        email: pending.email || undefined,
        email_confirm: false,
        user_metadata: {
          role_code: pending.role_code,
          role_slug: pending.role_slug,
          first_name: pending.first_name,
          last_name: pending.last_name,
          registration_method: "self_register",
          registered_at: new Date().toISOString(),
        },
      });

      if (authError || !authData?.user) {
        console.error("Failed to create user account:", authError?.message);
        return new Response(JSON.stringify({ error: "Failed to complete registration" }), { status: 500, headers });
      }

      // Create profile
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: authData.user.id,
          first_name: pending.first_name,
          last_name: pending.last_name,
          email: pending.email,
          phone: phone,
          role_code: pending.role_code,
          role_slug: pending.role_slug,
          created_by: null,
        });

      if (profileError) {
        console.error("Failed to create profile:", profileError.message);
        // Don't fail here - user is created, profile can be fixed later
      }

      // Clean up pending registration
      await supabase.from("pending_registrations").delete().eq("phone", phone);

      return new Response(JSON.stringify({
        ok: true,
        message: "Registration completed successfully!",
        user: {
          user_id: authData.user.id,
          phone: phone,
          first_name: pending.first_name,
          last_name: pending.last_name,
          role_code: pending.role_code,
          role_slug: pending.role_slug,
        }
      }), { status: 200, headers });

    } catch (dbError) {
      console.error("Database error during registration completion:", dbError);
      return new Response(JSON.stringify({ error: "Failed to complete registration" }), { status: 500, headers });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("verify-code fatal", msg);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers });
  }
});
