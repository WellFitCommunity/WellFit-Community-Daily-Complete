// supabase/functions/sms-verify-code/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { parsePhoneNumber, isValidPhoneNumber } from "https://esm.sh/libphonenumber-js@1.12.9";
import { cors } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

// Allowed country codes for phone numbers
const ALLOWED_COUNTRIES = ['US', 'CA', 'GB', 'AU'] as const;

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('sms-verify-code', req);

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
    logger.error("Missing Twilio environment variables", {
      hasSid: Boolean(TWILIO_ACCOUNT_SID),
      hasToken: Boolean(TWILIO_AUTH_TOKEN),
      hasVerify: Boolean(VERIFY_SID)
    });
    return new Response(JSON.stringify({ error: "Server not configured (Twilio envs missing)" }), {
      status: 500, headers,
    });
  }

  try {
    const { phone, code } = await req.json().catch(() => ({}));

    // Validate code format
    const isCode = (c: string) => /^\d{4,8}$/.test(c || "");
    if (!isCode(code)) {
      return new Response(JSON.stringify({ error: "Code must be 4–8 digits" }), { status: 400, headers });
    }

    // Validate and normalize phone using libphonenumber-js
    if (!phone) {
      return new Response(JSON.stringify({ error: "Phone number is required" }), { status: 400, headers });
    }

    let normalizedPhone: string;
    try {
      // Validate phone format
      if (!isValidPhoneNumber(phone, 'US')) {
        return new Response(JSON.stringify({ error: "Invalid phone number format" }), { status: 400, headers });
      }

      // Parse and normalize to E.164 format for Twilio consistency
      const phoneNumber = parsePhoneNumber(phone, 'US');
      if (!ALLOWED_COUNTRIES.includes(phoneNumber.country as any)) {
        return new Response(JSON.stringify({ error: `Phone numbers from ${phoneNumber.country} are not currently supported` }), { status: 400, headers });
      }

      // Normalize to E.164 format (+1234567890) to ensure consistency with Twilio
      normalizedPhone = phoneNumber.number;
      // PHI: Phone number not logged per HIPAA compliance
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid phone number format" }), { status: 400, headers });
    }

    const resp = await fetch(
      `https://verify.twilio.com/v2/Services/${VERIFY_SID}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: normalizedPhone, Code: code }).toString(),
      }
    );

    const txt = await resp.text();
    let json: unknown = {};
    try { json = JSON.parse(txt); } catch { /* text fallback */ }

    // Check for Twilio configuration errors (404 = Service SID not found)
    if (resp.status === 404 && typeof json === "object" && json !== null && (json as any).code === 20404) {
      logger.error("Twilio Verify Service not found - check TWILIO_VERIFY_SERVICE_SID", {
        twilioServiceSid: VERIFY_SID,
        twilioError: json,
        message: (json as any).message
      });
      return new Response(JSON.stringify({
        error: "SMS verification service not configured. Please contact support.",
        errorCode: "TWILIO_SERVICE_NOT_FOUND"
      }), {
        status: 500, headers,
      });
    }

    const approved =
      resp.ok &&
      typeof json === "object" &&
      json !== null &&
      // deno-lint-ignore no-explicit-any
      (json as any).status === "approved";

    if (!approved) {
      // Provide specific error messages based on Twilio response
      let errorMessage = "Invalid or expired verification code";
      if (resp.status === 404) {
        errorMessage = "Verification code not found. Please request a new code.";
      } else if (resp.status === 429) {
        errorMessage = "Too many attempts. Please wait and try again.";
      }

      logger.security("Invalid or expired verification code attempt", {
        phone,
        twilioStatus: resp.status,
        responseDetails: txt
      });
      return new Response(JSON.stringify({
        error: errorMessage,
        details: json || txt
      }), {
        status: 401, headers,
      });
    }

    // Success — now complete the registration
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.4?dts");
      const SB_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL") || "";
      const SB_SECRET_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SB_SECRET_KEY") || "";

      if (!SB_URL || !SB_SECRET_KEY) {
        logger.error("Missing Supabase configuration", {
          hasUrl: Boolean(SB_URL),
          hasKey: Boolean(SB_SECRET_KEY)
        });
        return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500, headers });
      }

      const supabase = createClient(SB_URL, SB_SECRET_KEY);

      // Get pending registration using normalized phone number
      const { data: pending, error: pendingError } = await supabase
        .from("pending_registrations")
        .select("*")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (pendingError || !pending) {
        logger.warn("No pending registration found for phone", {
          phone,
          error: pendingError?.message
        });
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
          logger.error("Password decryption failed", {
            error: decryptError.message,
            phone
          });
        } else {
          userPassword = decryptedPassword;
        }
      }

      // Fallback to plaintext for backward compatibility (will be removed in future)
      if (!userPassword && pending.password_plaintext) {
        logger.warn("Using deprecated password_plaintext field", {
          phone,
          message: "Update to password_encrypted"
        });
        userPassword = pending.password_plaintext;
      }

      if (!userPassword) {
        logger.error("Missing or invalid password in pending registration", { phone });
        return new Response(JSON.stringify({ error: "Invalid registration data. Please register again." }), {
          status: 500, headers,
        });
      }

      // IMPORTANT: We allow multiple users to share the same phone number
      // This is critical for low-income communities where spouses share phones
      //
      // SOLUTION FOR SHARED PHONES:
      // - If user provides email: Use email + phone for auth (traditional)
      // - If NO email: Generate unique internal email for auth uniqueness
      // - Store actual phone in user_metadata and profiles (not auth.users.phone for shared phones)
      // - Users without email login via phone + password (app handles lookup)

      let authEmail = pending.email;
      let authPhone: string | undefined = normalizedPhone;
      let isSharedPhone = false;

      // Check if this phone is already registered in auth.users
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const phoneAlreadyUsed = existingUsers?.users?.some(u => u.phone === normalizedPhone);

      if (phoneAlreadyUsed && !pending.email) {
        // Shared phone scenario: Phone is used, no email provided
        // Generate internal email for unique auth identifier
        const uniqueId = crypto.randomUUID().split('-')[0];
        authEmail = `${normalizedPhone.replace(/\D/g, '')}_${uniqueId}@wellfit.internal`;
        authPhone = undefined; // Don't set phone in auth (already used by someone else)
        isSharedPhone = true;

        logger.info("Shared phone registration - generated internal email", {
          actualPhone: normalizedPhone,
          generatedEmail: authEmail,
          isSharedPhone: true
        });
      } else if (!authEmail) {
        // First time using this phone, but no email - still generate internal email
        const uniqueId = crypto.randomUUID().split('-')[0];
        authEmail = `${normalizedPhone.replace(/\D/g, '')}_${uniqueId}@wellfit.internal`;

        logger.info("Phone-only registration - generated internal email", {
          phone: normalizedPhone,
          generatedEmail: authEmail
        });
      }

      // Create the actual user account
      const createUserPayload: any = {
        email: authEmail,
        email_confirm: !!pending.email, // Only confirm if user provided real email
        password: userPassword,
        user_metadata: {
          role_code: pending.role_code,
          role_slug: pending.role_slug,
          first_name: pending.first_name,
          last_name: pending.last_name,
          registration_method: "self_register",
          registered_at: new Date().toISOString(),
          actual_phone: normalizedPhone, // Always store the real phone here
          is_shared_phone: isSharedPhone,
          generated_email: !pending.email, // Flag for generated emails
        },
      };

      // Only set phone in auth if it's not a shared phone scenario
      if (authPhone) {
        createUserPayload.phone = authPhone;
        createUserPayload.phone_confirm = true;
      }

      const { data: authData, error: authError } = await supabase.auth.admin.createUser(createUserPayload);

      if (authError || !authData?.user) {
        logger.error("Failed to create user account", {
          phone,
          error: authError?.message,
          errorCode: authError?.code,
          errorStatus: authError?.status
        });

        // Provide specific error message based on error type
        let errorMessage = "Failed to complete registration. Please try again.";
        if (authError?.message?.toLowerCase().includes("duplicate") ||
            authError?.message?.toLowerCase().includes("already exists")) {
          errorMessage = "This phone number is already registered. Please login instead.";
        }

        return new Response(JSON.stringify({
          error: errorMessage,
          details: authError?.message
        }), { status: 500, headers });
      }

      // Create profile
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          user_id: authData.user.id,  // ✅ FIXED: Was 'id', now 'user_id' (matches schema)
          first_name: pending.first_name,
          last_name: pending.last_name,
          email: pending.email,
          phone: normalizedPhone,
          role_code: pending.role_code,
          role: pending.role_slug,  // Added role field
          role_slug: pending.role_slug,
          created_by: null,
        });

      if (profileError) {
        logger.error("Failed to create profile", {
          userId: authData.user.id,
          phone,
          error: profileError.message
        });
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
          logger.warn("FHIR patient creation failed during registration", {
            userId: authData.user.id,
            phone,
            error: fhirPatientError.message
          });
        }
      } catch (fhirError) {
        logger.warn("FHIR patient creation exception during registration", {
          userId: authData.user.id,
          phone,
          error: fhirError instanceof Error ? fhirError.message : String(fhirError)
        });
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
            logger.warn("Welcome email failed to send", {
              userId: authData.user.id,
              email: pending.email,
              status: welcomeEmailResponse.status
            });
          }
        } catch (emailError) {
          logger.warn("Welcome email exception", {
            userId: authData.user.id,
            email: pending.email,
            error: emailError instanceof Error ? emailError.message : String(emailError)
          });
        }
      }

      // Clean up pending registration
      await supabase.from("pending_registrations").delete().eq("phone", normalizedPhone);

      // Auto sign-in the user after successful registration
      // This creates a session so they don't have to manually login
      // For shared phones, use email (generated or real) instead of phone
      const signInPayload: any = { password: userPassword };

      if (authPhone) {
        // Not a shared phone - can login with phone
        signInPayload.phone = normalizedPhone;
      } else {
        // Shared phone - must login with generated email
        signInPayload.email = authEmail;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword(signInPayload);

      if (sessionError) {
        logger.warn("Failed to auto sign-in user after registration", {
          userId: authData.user.id,
          phone,
          error: sessionError.message
        });
        // Don't fail - user can manually login
      }

      logger.info("User registration completed successfully", {
        userId: authData.user.id,
        phone,
        firstName: pending.first_name,
        lastName: pending.last_name,
        roleCode: pending.role_code,
        roleSlug: pending.role_slug
      });

      return new Response(JSON.stringify({
        ok: true,
        message: "Registration completed successfully! You are now logged in.",
        user: {
          user_id: authData.user.id,
          phone: normalizedPhone, // Always return the actual phone
          email: pending.email || null, // Null if generated internal email
          first_name: pending.first_name,
          last_name: pending.last_name,
          role_code: pending.role_code,
          role_slug: pending.role_slug,
          is_shared_phone: isSharedPhone,
          // For shared phone users, provide login hint
          login_identifier: authEmail, // Use this email for login if shared phone
        },
        session: sessionData?.session || null,
        access_token: sessionData?.session?.access_token || null,
        refresh_token: sessionData?.session?.refresh_token || null,
      }), { status: 200, headers });

    } catch (dbError) {
      logger.error("Database error during registration completion", {
        error: dbError instanceof Error ? dbError.message : String(dbError)
      });
      return new Response(JSON.stringify({ error: "Failed to complete registration" }), { status: 500, headers });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in sms-verify-code", { error: msg });
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers });
  }
});
