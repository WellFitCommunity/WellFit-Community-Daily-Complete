import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface RegisterBody {
  phone: string;
  password: string;
  first_name: string;
  last_name: string;
  email?: string;
  consent?: boolean;
  hcaptcha_token?: string; // Added hCaptcha token
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string) {
  const encoder = new TextEncoder();
  const passKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    passKey,
    256
  );
  const hash = new Uint8Array(bits);
  return `${toHex(salt)}:${toHex(hash)}`;
}

const MAX_REQUESTS = 5;
const TIME_WINDOW_MINUTES = 15;

serve(async (req: Request) => {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": req.headers.get("Origin") || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    const supabaseUrlForRateLimit = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL");
    const serviceRoleKeyForRateLimit = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_ROLE");

    if (!supabaseUrlForRateLimit || !serviceRoleKeyForRateLimit) {
      console.error("CRITICAL: Missing Supabase URL or Service Role Key for rate limiting in register function.");
      return new Response(JSON.stringify({ error: "Server configuration error for rate limiting." }), { status: 500, headers });
    }
    const supabaseAdminForRateLimit = createClient(supabaseUrlForRateLimit, serviceRoleKeyForRateLimit);

    const clientIp = req.headers.get("x-forwarded-for")?.split(',')[0].trim() ||
                     req.headers.get("cf-connecting-ip") || // Cloudflare
                     req.headers.get("x-real-ip") || // Nginx
                     "unknown"; // Fallback

    if (clientIp === "unknown") {
      console.warn("Could not determine client IP for rate limiting in registration.");
      // Decide if you want to block or allow if IP is unknown. For now, allow but log.
    } else {
      // Log registration attempt
      const { error: logError } = await supabaseAdminForRateLimit
        .from('rate_limit_registrations')
        .insert({ ip_address: clientIp });

      if (logError) {
        console.error("Error logging registration attempt for rate limiting:", logError);
        // Potentially allow request if logging fails, or deny if strict rate limiting is required
      }

      // Check rate limit
      const timeWindowStart = new Date(Date.now() - TIME_WINDOW_MINUTES * 60 * 1000).toISOString();
      const { data: attempts, error: countError } = await supabaseAdminForRateLimit
        .from('rate_limit_registrations')
        .select('attempted_at', { count: 'exact' })
        .eq('ip_address', clientIp)
        .gte('attempted_at', timeWindowStart);

      if (countError) {
        console.error("Error counting registration attempts for rate limiting:", countError);
        // Potentially allow request if counting fails, or deny
        return new Response(JSON.stringify({ error: "Error checking rate limit. Please try again later." }), { status: 500, headers });
      }

      if (attempts && attempts.length >= MAX_REQUESTS) {
        return new Response(JSON.stringify({ error: "Too many registration attempts. Please try again later." }), { status: 429, headers });
      }
    }

    const body: RegisterBody = await req.json();

    // hCaptcha verification
    const hcaptchaSecret = Deno.env.get("HCAPTCHA_SECRET");
    if (!hcaptchaSecret) {
      console.error("HCAPTCHA_SECRET is not set.");
      return new Response(JSON.stringify({ error: "HCAPTCHA_SECRET is not configured." }), { status: 500, headers });
    }

    if (!body.hcaptcha_token) {
      return new Response(JSON.stringify({ error: "hCaptcha token is missing." }), { status: 400, headers });
    }

    const hcaptchaParams = new URLSearchParams();
    hcaptchaParams.append("secret", hcaptchaSecret);
    hcaptchaParams.append("response", body.hcaptcha_token);
    const remoteIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"); // Common headers for client IP
    if (remoteIp) {
      hcaptchaParams.append("remoteip", remoteIp);
    }

    const hcaptchaResponse = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      body: hcaptchaParams,
    });

    const hcaptchaData = await hcaptchaResponse.json();

    if (!hcaptchaData.success) {
      console.warn("hCaptcha verification failed:", hcaptchaData);
      return new Response(JSON.stringify({ error: "hCaptcha verification failed. Please try again." }), { status: 400, headers });
    }
    console.log("✅ hCaptcha verification successful.");

    for (const field of ["phone", "password", "first_name", "last_name"] as const) {
      const v = body[field];
      if (!v || typeof v !== "string" || !v.trim()) {
        return new Response(
          JSON.stringify({ error: `${field.replace("_", " ")} is required.` }),
          { status: 400, headers }
        );
      }
    }

    const p = body.password;
    const rules = [
      { r: /.{8,}/, m: "at least 8 characters" },
      { r: /[A-Z]/, m: "one uppercase letter" },
      { r: /\d/, m: "one number" },
      { r: /[^A-Za-z0-9]/, m: "one special character" },
    ];
    const bad = rules.filter(x => !x.r.test(p)).map(x => x.m);
    if (bad.length) {
      return new Response(
        JSON.stringify({ error: `Password must contain ${bad.join(", ")}.` }),
        { status: 400, headers }
      );
    }

    // ✅ Secure environment var loading
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_ROLE");

    console.log("✅ SUPABASE_URL loaded:", !!supabaseUrl);
    console.log("✅ SUPABASE_SERVICE_ROLE_KEY loaded:", !!serviceRoleKey);

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Check if phone already exists in auth.users to prevent conflicts if possible
    // Supabase admin SDK does not have a direct "getUserByPhone".
    // For now, we rely on Supabase's internal unique constraints on phone in auth.users.
    // If createUser fails due to phone conflict, it will be caught.

    // We still need to hash password for storage in profiles if we keep it there.
    // However, Supabase Auth will handle its own password storage.
    // If profiles.password_hash is only for this custom flow, and we switch to Supabase Auth,
    // we might not need it anymore, or keep it as a fallback (though that complicates things).
    // DECISION: Remove password_hash from profiles table. Supabase Auth handles authentication.
    // const password_hash = await hashPassword(body.password); // No longer hashing here
    const profile_id = crypto.randomUUID(); // Generate UUID for profile and auth user

    // ➕ Create Supabase Auth user first
    const { data: authUserResponse, error: authError } = await supabaseAdmin.auth.admin.createUser({
      id: profile_id, // Assign the generated UUID to auth.users.id
      phone: body.phone,
      password: body.password, // Plain password for Supabase Auth
      phone_confirm: true,    // Auto-confirm phone in trusted server environment
      email: body.email || undefined, // Pass email if provided
      email_confirm: (body.email && body.email_verified !== undefined) ? body.email_verified : (body.email ? true : undefined), // Auto-confirm email if provided
      user_metadata: {
        first_name: body.first_name,
        last_name: body.last_name,
        // DO NOT store consent directly in user_metadata if it's sensitive or for legal tracking.
        // Consent should be in a dedicated table or your profiles table.
      }
    });

    if (authError) {
      console.error("❌ Auth user creation error:", authError);
      // Check for specific error types, e.g., user already exists
      if (authError.message.includes("User already registered") || authError.message.includes("phone already exists")) {
        return new Response(
          JSON.stringify({ error: "Phone number is already registered." }),
          { status: 409, headers }
        );
      }
      throw new Error(`Failed to create authentication user: ${authError.message}`);
    }

    console.log("✅ Auth user created:", authUserResponse.user.id);

    // ➕ Insert into public.profiles table, linking to the auth user via id
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authUserResponse.user.id, // Use the ID from the created auth user
        phone: body.phone,
        // password_hash: password_hash, // Removed as Supabase Auth handles this
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email ?? null,
        consent: Boolean(body.consent), // Ensure consent is stored in profiles
        phone_verified: true, // Since phone_confirm was true for auth user
        email_verified: authUserResponse.user.email_confirmed_at ? true : false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileError) {
      console.error("❌ Profile creation error:", profileError);
      // Attempt to delete the auth user if profile creation fails to maintain consistency
      console.warn(`Attempting to delete orphaned auth user: ${authUserResponse.user.id}`);
      const { error: deleteAuthUserError } = await supabaseAdmin.auth.admin.deleteUser(authUserResponse.user.id);
      if (deleteAuthUserError) {
        console.error("❌ Failed to delete orphaned auth user:", deleteAuthUserError);
      }
      throw new Error(`Insert into profiles failed: ${profileError.message}`);
    }

    console.log("✅ Profile created/linked:", profileData.id);

    // Return the auth user_id (which is now also profile_id)
    return new Response(JSON.stringify({ success: true, user_id: authUserResponse.user.id }), {
      status: 201,
      headers,
    });

  } catch (err) {
    console.error("❌ register error:", err);
    const errorMessage =
      err && typeof err === "object" && "message" in err
        ? (err as { message: string }).message
        : String(err);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: errorMessage }),
      { status: 500, headers }
    );
  }
});
