// supabase/functions/passkey-register-start/index.ts
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

// Generate random challenge
function generateChallenge(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Convert string to base64url
function stringToBase64url(str: string): string {
  return btoa(str)
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
    const { user_name, display_name, prefer_platform = true } = body;

    // Generate challenge
    const challenge = generateChallenge();

    // Store challenge in database (expires in 5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const { error: challengeError } = await supabase
      .from('passkey_challenges')
      .insert({
        challenge,
        user_id: user.id,
        type: 'registration',
        expires_at: expiresAt.toISOString()
      });

    if (challengeError) {
      console.error('Failed to store challenge:', challengeError);
      return new Response(JSON.stringify({ error: 'Failed to create challenge' }), { status: 500, headers });
    }

    // Get relying party ID from request origin
    const rpId = new URL(origin || SUPABASE_URL).hostname;

    // Build registration options
    const options = {
      challenge,
      rp: {
        name: "WellFit Community",
        id: rpId === 'localhost' ? 'localhost' : rpId
      },
      user: {
        id: stringToBase64url(user.id),
        name: user_name || user.email || user.phone || 'user',
        displayName: display_name || user_name || 'User'
      },
      pubKeyCredParams: [
        { type: "public-key" as const, alg: -7 },  // ES256
        { type: "public-key" as const, alg: -257 } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: prefer_platform ? ("platform" as const) : undefined,
        requireResidentKey: false,
        residentKey: "preferred" as const,
        userVerification: "preferred" as const
      },
      timeout: 60000,
      attestation: "none" as const
    };

    return new Response(JSON.stringify(options), { status: 200, headers });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "Internal server error" }),
      { status: 500, headers }
    );
  }
});
