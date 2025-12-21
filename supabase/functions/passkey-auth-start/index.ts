// supabase/functions/passkey-auth-start/index.ts
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
  "https://legendary-space-goggles-g46697v595g4c757-3100.app.github.dev"
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

// Generate random challenge
function generateChallenge(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const headers = getCorsHeaders(origin);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    const body = await req.json();
    const { user_id } = body;

    // Extract client IP for audit logging
    // NOTE: actor_ip_address column is inet type - use null instead of 'unknown' if no IP available
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     req.headers.get('cf-connecting-ip') ||
                     req.headers.get('x-real-ip') || null;

    // Generate challenge
    const challenge = generateChallenge();

    // Store challenge in database (expires in 5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const { error: challengeError } = await supabase
      .from('passkey_challenges')
      .insert({
        challenge,
        user_id: user_id || null,
        type: 'authentication',
        expires_at: expiresAt.toISOString()
      });

    if (challengeError) {
      console.error('Failed to store challenge:', challengeError);

      // HIPAA AUDIT LOGGING: Log failed passkey auth start
      try {
        await supabase.from('audit_logs').insert({
          event_type: 'PASSKEY_AUTH_START_FAILED',
          event_category: 'AUTHENTICATION',
          actor_user_id: user_id || null,
          actor_ip_address: clientIp,
          actor_user_agent: req.headers.get('user-agent'),
          operation: 'PASSKEY_AUTH_START',
resource_type: 'auth_event',
          success: false,
          error_code: challengeError.code || 'CHALLENGE_ERROR',
          error_message: challengeError.message,
          metadata: { user_id }
        });
      } catch (logError) {
        console.error('[Audit Log Error]:', logError);
      }

      return new Response(JSON.stringify({ error: 'Failed to create challenge' }), { status: 500, headers });
    }

    // Get relying party ID from request origin
    const rpId = new URL(origin || SUPABASE_URL).hostname;

    // Get user's registered credentials if user_id provided
    let allowCredentials = undefined;
    if (user_id) {
      const { data: credentials } = await supabase
        .from('passkey_credentials')
        .select('credential_id, transports')
        .eq('user_id', user_id);

      if (credentials && credentials.length > 0) {
        allowCredentials = credentials.map(cred => ({
          type: "public-key" as const,
          id: cred.credential_id,
          transports: cred.transports || []
        }));
      }
    }

    // Build authentication options
    const options = {
      challenge,
      rpId: rpId === 'localhost' ? 'localhost' : rpId,
      allowCredentials,
      timeout: 60000,
      userVerification: "preferred" as const
    };

    // HIPAA AUDIT LOGGING: Log successful passkey auth start
    try {
      await supabase.from('audit_logs').insert({
        event_type: 'PASSKEY_AUTH_START_SUCCESS',
        event_category: 'AUTHENTICATION',
        actor_user_id: user_id || null,
        actor_ip_address: clientIp,
        actor_user_agent: req.headers.get('user-agent'),
        operation: 'PASSKEY_AUTH_START',
resource_type: 'auth_event',
        success: true,
        metadata: {
          user_id,
          has_credentials: !!allowCredentials,
          credential_count: allowCredentials?.length || 0
        }
      });
    } catch (logError) {
      console.error('[Audit Log Error]:', logError);
    }

    return new Response(JSON.stringify(options), { status: 200, headers });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Internal server error" }),
      { status: 500, headers }
    );
  }
});
