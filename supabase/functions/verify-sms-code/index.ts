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

      // Generate a secure random password for the user account
      // The hashed password in pending_registrations is no longer needed since we'll create a new one
      const securePassword = crypto.randomUUID() + "Aa1!"; // Meets complexity requirements

      // Create the actual user account with new secure password
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        phone: phone,
        password: securePassword, // Use secure generated password
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
          force_password_change: true, // Force user to set their own password on first login
        },
      });

      if (authError || !authData?.user) {
        console.error("Failed to create user account:", authError?.message);
        return new Response(JSON.stringify({ error: "Failed to complete registration" }), { status: 500, headers });
      }

      // Create profile with force_password_change flag
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
          force_password_change: true, // Ensure user must set password on first login
          created_by: null,
        });

      if (profileError) {
        console.error("Failed to create profile:", profileError.message);
        // Don't fail here - user is created, profile can be fixed later
      }

      // Send welcome email if user has an email
      if (pending.email) {
        try {
          const welcomeEmailResponse = await fetch(`${SB_URL}/functions/v1/send_welcome_email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SB_SECRET_KEY}`
            },
            body: JSON.stringify({
              email: pending.email,
              full_name: `${pending.first_name} ${pending.last_name}`
            })
          });

          if (!welcomeEmailResponse.ok) {
            console.error("Failed to send welcome email:", await welcomeEmailResponse.text());
            // Don't fail registration if welcome email fails
          } else {
            console.log(`✅ Welcome email sent to ${pending.email}`);
          }
        } catch (emailError) {
          console.error("Welcome email error:", emailError);
          // Don't fail registration if welcome email fails
        }
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
