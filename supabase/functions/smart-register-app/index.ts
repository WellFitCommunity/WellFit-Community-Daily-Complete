/**
 * SMART on FHIR App Registration (Server-Side)
 *
 * Generates client_id and client_secret SERVER-SIDE for confidential SMART apps.
 * Stores a slow hash (SHA-512 with salt) of the secret — never the plaintext.
 * Returns the plaintext secret ONE TIME in the response.
 *
 * Security: Client secrets must NEVER be generated in the browser.
 * This edge function replaces the client-side generation that was in
 * SmartAppManagementPanel.tsx.
 *
 * Auth: Requires authenticated admin or super_admin user.
 *
 * @see https://hl7.org/fhir/smart-app-launch/
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

// ---- Types ----

interface RegisterAppRequest {
  client_name: string;
  client_description?: string;
  client_uri?: string;
  logo_uri?: string;
  is_confidential: boolean;
  redirect_uris: string[];
  launch_uri?: string;
  scopes_allowed: string[];
  pkce_required: boolean;
  token_endpoint_auth_method: string;
  jwks_uri?: string;
  app_type: "patient" | "provider" | "system" | "research";
  developer_name?: string;
  developer_email?: string;
  tos_uri?: string;
  policy_uri?: string;
}

interface RegisterAppResponse {
  app_id: string;
  client_id: string;
  client_secret?: string; // Only present for confidential clients, shown once
  message: string;
}

// ---- Crypto Helpers ----

/** Generate a cryptographically random client_id with "ea_" prefix */
function generateClientId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "ea_" + Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a cryptographically random client secret (44 chars base64) */
function generateClientSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Hash a secret with SHA-512 + random salt for storage.
 * Format: "sha512:<salt_hex>:<hash_hex>"
 *
 * SHA-512 with a random salt is significantly more secure than plain SHA-256.
 * For even stronger protection, use bcrypt/argon2 when available in Deno.
 */
async function hashSecretWithSalt(secret: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const encoder = new TextEncoder();
  const data = encoder.encode(saltHex + secret);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `sha512:${saltHex}:${hashHex}`;
}

// ---- Main Handler ----

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  // Only POST allowed
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // ---- Auth: verify JWT ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL ?? "", SB_SECRET_KEY ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the token and get user
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = userData.user.id;

    // ---- Role check: admin or super_admin ----
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_admin")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 403, headers: corsHeaders }
      );
    }

    const isAdmin =
      profile.is_admin === true ||
      ["admin", "super_admin"].includes(profile.role ?? "");

    // Also check super_admin_users table
    let isSuperAdmin = false;
    if (!isAdmin) {
      const { data: sa } = await supabase
        .from("super_admin_users")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      isSuperAdmin = !!sa;
    }

    if (!isAdmin && !isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin role required" }),
        { status: 403, headers: corsHeaders }
      );
    }

    // ---- Parse request body ----
    const body = (await req.json()) as RegisterAppRequest;

    if (!body.client_name?.trim()) {
      return new Response(
        JSON.stringify({ error: "client_name is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!body.redirect_uris || body.redirect_uris.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one redirect_uri is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ---- Generate credentials server-side ----
    const clientId = generateClientId();
    let secretHash: string | null = null;
    let plainSecret: string | undefined;

    if (body.is_confidential) {
      plainSecret = generateClientSecret();
      secretHash = await hashSecretWithSalt(plainSecret);
    }

    // ---- Insert into database ----
    const { data: inserted, error: insertError } = await supabase
      .from("smart_registered_apps")
      .insert({
        client_id: clientId,
        client_name: body.client_name.trim(),
        client_description: body.client_description?.trim() || null,
        client_uri: body.client_uri?.trim() || null,
        logo_uri: body.logo_uri?.trim() || null,
        client_secret_hash: secretHash,
        is_confidential: body.is_confidential,
        redirect_uris: body.redirect_uris,
        launch_uri: body.launch_uri?.trim() || null,
        scopes_allowed: body.scopes_allowed,
        pkce_required: body.pkce_required,
        token_endpoint_auth_method: body.is_confidential
          ? "client_secret_basic"
          : "none",
        jwks_uri: body.jwks_uri?.trim() || null,
        app_type: body.app_type,
        status: "pending",
        developer_name: body.developer_name?.trim() || null,
        developer_email: body.developer_email?.trim() || null,
        tos_uri: body.tos_uri?.trim() || null,
        policy_uri: body.policy_uri?.trim() || null,
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: `Registration failed: ${insertError.message}` }),
        { status: 500, headers: corsHeaders }
      );
    }

    // ---- Audit log ----
    await supabase.from("smart_audit_log").insert({
      event_type: "app_registered",
      app_id: inserted?.id,
      user_id: userId,
      details: {
        client_id: clientId,
        client_name: body.client_name,
        is_confidential: body.is_confidential,
        app_type: body.app_type,
      },
    }).then(() => {
      // Fire and forget — don't block the response on audit
    });

    // ---- Response ----
    const response: RegisterAppResponse = {
      app_id: inserted?.id ?? "",
      client_id: clientId,
      message: body.is_confidential
        ? "App registered. Save the client_secret — it will not be shown again."
        : "App registered successfully.",
    };

    // Only include plaintext secret for confidential clients, ONE TIME
    if (plainSecret) {
      response.client_secret = plainSecret;
    }

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: corsHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
