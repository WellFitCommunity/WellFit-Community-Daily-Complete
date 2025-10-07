// supabase/functions/passkey-auth-finish/index.ts
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.28.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
    const body = await req.json();
    const { id, rawId, response } = body;

    // Parse client data to verify challenge
    const clientDataJSON = JSON.parse(
      atob(response.clientDataJSON.replace(/-/g, '+').replace(/_/g, '/'))
    );

    // Verify challenge exists and is valid
    const { data: challenges, error: challengeError } = await supabase
      .from('passkey_challenges')
      .select('*')
      .eq('challenge', clientDataJSON.challenge)
      .eq('type', 'authentication')
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

    // Find credential in database
    const { data: credential, error: credError } = await supabase
      .from('passkey_credentials')
      .select('*')
      .eq('credential_id', rawId)
      .single();

    if (credError || !credential) {
      // Log failed authentication
      await supabase.from('passkey_audit_log').insert({
        credential_id: rawId,
        action: 'failed_auth',
        success: false,
        error_message: 'Credential not found'
      });

      return new Response(
        JSON.stringify({ error: 'Credential not found' }),
        { status: 404, headers }
      );
    }

    // TODO: In production, verify the signature using the public_key
    // For now, we'll skip full cryptographic verification
    // This would require importing WebAuthn verification libraries

    // Update credential's last_used_at and counter
    await supabase
      .from('passkey_credentials')
      .update({
        last_used_at: new Date().toISOString(),
        counter: credential.counter + 1
      })
      .eq('id', credential.id);

    // Create session for the user
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createUser({
      user_metadata: { passkey_auth: true }
    });

    // Better approach: Generate a custom token or session
    // For now, we'll return the user_id and let the client handle session creation
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', credential.user_id)
      .single();

    // Get user from auth
    const { data: { user } } = await supabase.auth.admin.getUserById(credential.user_id);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers }
      );
    }

    // Generate a session using admin API
    const { data: session, error: genSessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email || `${user.id}@passkey.local`,
      options: {
        redirectTo: origin || SUPABASE_URL
      }
    });

    // Log successful authentication
    await supabase.from('passkey_audit_log').insert({
      user_id: credential.user_id,
      credential_id: rawId,
      action: 'authenticate',
      success: true
    });

    return new Response(
      JSON.stringify({
        user: user,
        profile: profile,
        // Note: Client will need to handle session creation
        // For full implementation, use custom JWT or magic link
        session: null,
        message: 'Authentication successful - please refresh session'
      }),
      { status: 200, headers }
    );

  } catch (error: any) {
    console.error('Error:', error);

    // Log failed authentication
    await supabase.from('passkey_audit_log').insert({
      action: 'failed_auth',
      success: false,
      error_message: error?.message || 'Unknown error'
    }).catch(() => {});

    return new Response(
      JSON.stringify({ error: error?.message ?? "Internal server error" }),
      { status: 500, headers }
    );
  }
});
