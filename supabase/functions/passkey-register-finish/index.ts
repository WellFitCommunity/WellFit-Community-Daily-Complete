// supabase/functions/passkey-register-finish/index.ts
import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.28.0";

const SUPABASE_URL = SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? SB_SECRET_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("Missing SUPABASE_URL or SB_SECRET_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// CORS Configuration
const ALLOWED_ORIGINS = [
  "https://thewellfitcommunity.org",
  "https://wellfitcommunity.live",
  "http://localhost:3100",
  "https://localhost:3100",
  "https://houston.thewellfitcommunity.org",
  "https://miami.thewellfitcommunity.org",
  "https://phoenix.thewellfitcommunity.org",
  "https://seattle.thewellfitcommunity.org",
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : null;
  return new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin || "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  });
}

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const headers = getCorsHeaders(origin);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    // Get user from auth header
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }

    const body = await req.json();
    const {
      id,
      rawId,
      response,
      authenticatorAttachment,
      device_name,
      user_agent
    } = body;

    // Parse client data to verify challenge
    const clientDataJSON = JSON.parse(
      atob(response.clientDataJSON.replace(/-/g, '+').replace(/_/g, '/'))
    );

    // Verify challenge exists and is valid
    const { data: challenges, error: challengeError } = await supabase
      .from('passkey_challenges')
      .select('*')
      .eq('challenge', clientDataJSON.challenge)
      .eq('user_id', user.id)
      .eq('type', 'registration')
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    if (challengeError || !challenges || challenges.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired challenge' }),
        { status: 400, headers }
      );
    }

    // Mark challenge as used
    await supabase
      .from('passkey_challenges')
      .update({ used: true })
      .eq('challenge', clientDataJSON.challenge);

    // Parse attestation object (simplified - in production use full WebAuthn verification)
    // For now, we just extract the auth data and public key
    const attestationBuffer = Uint8Array.from(
      atob(response.attestationObject.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );

    // Store credential in database
    const { data: credential, error: credError } = await supabase
      .from('passkey_credentials')
      .insert({
        user_id: user.id,
        credential_id: rawId,
        public_key: response.attestationObject, // Store full attestation for now
        counter: 0,
        authenticator_type: authenticatorAttachment || null,
        transports: response.transports || null,
        device_name: device_name || 'Unknown Device',
        user_agent: user_agent || null,
        attestation_format: 'none'
      })
      .select()
      .single();

    if (credError) {
      console.error('Failed to store credential:', credError);
      return new Response(
        JSON.stringify({ error: 'Failed to store credential' }),
        { status: 500, headers }
      );
    }

    // Log successful registration
    await supabase.from('passkey_audit_log').insert({
      user_id: user.id,
      credential_id: rawId,
      action: 'register',
      success: true,
      user_agent: user_agent
    });

    return new Response(JSON.stringify(credential), { status: 201, headers });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Internal server error" }),
      { status: 500, headers }
    );
  }
});
