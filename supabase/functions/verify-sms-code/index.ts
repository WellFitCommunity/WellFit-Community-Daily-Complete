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

    // E.164: +<country><nsn>, 7-15 digits total (excluding +), leading digit 1-9
    const isE164 = (p: string) => /^\+[1-9]\d{6,14}$/.test(p || "");
    const isCode = (c: string) => /^\d{4,8}$/.test(c || "");

    if (!isE164(phone)) {
      return new Response(JSON.stringify({ error: "Invalid E.164 phone format. Required: +<country><number> (e.g., +15551234567)" }), { status: 400, headers });
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
        console.error("No pending registration found");
        return new Response(JSON.stringify({ error: "No pending registration found. Please register again." }), {
          status: 404, headers,
        });
      }

      // Decrypt the user's password from encrypted storage
      // Try encrypted column first (new), fallback to plaintext (old) for backward compatibility
      let userPassword: string | null = null;

      if (pending.password_encrypted) {
        // Decrypt password using database function
        const { data: decryptedPassword, error: decryptError } = await supabase
          .rpc('decrypt_pending_password', { encrypted_password: pending.password_encrypted });

        if (decryptError) {
          console.error("Password decryption failed:", decryptError);
        } else {
          userPassword = decryptedPassword;
        }
      }

      // Fallback to plaintext for backward compatibility (will be removed in future)
      if (!userPassword && pending.password_plaintext) {
        console.warn("Using deprecated password_plaintext field. Update to password_encrypted.");
        userPassword = pending.password_plaintext;
      }

      if (!userPassword) {
        console.error("Missing or invalid password in pending registration");
        return new Response(JSON.stringify({ error: "Invalid registration data. Please register again." }), {
          status: 500, headers,
        });
      }

      // Create the actual user account with their chosen password
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        phone: phone,
        password: userPassword,
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
          user_id: authData.user.id,  // ✅ FIXED: Was 'id', now 'user_id' (matches schema)
          first_name: pending.first_name,
          last_name: pending.last_name,
          email: pending.email,
          phone: phone,
          role_code: pending.role_code,
          role: pending.role_slug,  // Added role field
          role_slug: pending.role_slug,
          created_by: null,
        });

      if (profileError) {
        console.error("Failed to create profile:", profileError.message);
        // Don't fail here - user is created, profile can be fixed later
      }

      // Create FHIR Patient resource for healthcare workflows
      // This ensures patient is visible in FHIR-compliant systems from day 1
      try {
        const { error: fhirPatientError } = await supabase.rpc(
          'create_fhir_patient_from_profile',
          { user_id_param: authData.user.id }
        );

        if (fhirPatientError) {
          // Don't fail registration - FHIR patient can be created later
          // Log to audit trail instead of console
        }
      } catch (fhirError) {
        // Non-critical - continue registration
        // FHIR patient creation can be retried later if needed
      }

      // Send welcome email if user has an email
      if (pending.email) {
        try {
          // Correct Edge Functions URL format
          const functionsUrl = `${SB_URL}/functions/v1`;
          const welcomeEmailResponse = await fetch(`${functionsUrl}/send_welcome_email`, {
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
            // Don't fail registration if welcome email fails
            // Email delivery is non-critical for user onboarding
          }
        } catch (emailError) {
          // Don't fail registration if welcome email fails
          // Email delivery is non-critical for user onboarding
        }
      }

      // Clean up pending registration
      await supabase.from("pending_registrations").delete().eq("phone", phone);

      // Auto sign-in the user after successful registration
      // This creates a session so they don't have to manually login
      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
        phone: phone,
        password: userPassword,
      });

      if (sessionError) {
        console.error("Failed to auto sign-in user:", sessionError.message);
        // Don't fail - user can manually login
      }

      return new Response(JSON.stringify({
        ok: true,
        message: "Registration completed successfully! You are now logged in.",
        user: {
          user_id: authData.user.id,
          phone: phone,
          first_name: pending.first_name,
          last_name: pending.last_name,
          role_code: pending.role_code,
          role_slug: pending.role_slug,
        },
        session: sessionData?.session || null,
        access_token: sessionData?.session?.access_token || null,
        refresh_token: sessionData?.session?.refresh_token || null,
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
