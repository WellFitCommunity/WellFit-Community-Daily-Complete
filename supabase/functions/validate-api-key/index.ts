import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger('validate-api-key');

logger.info("Function initializing");

/**
 * Hash an API key using SHA-256 (Web Crypto API).
 * The api_keys table stores key_hash, never the raw key.
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Initialize Supabase client with service role
let supabaseAdminClient: SupabaseClient;
try {
  const supabaseUrl = SUPABASE_URL;
  const serviceRoleKey = SB_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined in environment variables.");
  }
  supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey);
  logger.info("Supabase admin client initialized successfully");
} catch (err: unknown) {
  const errorMessage = err instanceof Error ? err.message : String(err);
  logger.error("Failed to initialize Supabase client", { error: errorMessage });
  // If client fails to init, the function won't work, but error handling per-request is still needed.
}


Deno.serve(async (req: Request) => {
  const reqLogger = createLogger('validate-api-key', req);
  reqLogger.info("Request received", { method: req.method, url: req.url });

  const { headers: corsHeaders } = corsFromRequest(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    reqLogger.debug("Handling OPTIONS preflight request");
    return handleOptions(req);
  }

  // Ensure Supabase client is initialized
  if (!supabaseAdminClient) {
    reqLogger.error("Supabase client not initialized");
    return new Response(JSON.stringify({ error: "Internal server error: Supabase client not initialized." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  // Extract API key from Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reqLogger.security("Missing or malformed Authorization header");
    return new Response(JSON.stringify({ error: 'Missing or malformed Authorization header. Use "Bearer <API_KEY>".' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }
  const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

  if (!apiKey) {
    reqLogger.security("API key is empty after Bearer prefix");
    return new Response(JSON.stringify({ error: 'API key cannot be empty.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  reqLogger.debug("Attempting to validate API key", { keyPrefix: apiKey.substring(0, 8) });

  try {
    // Hash the incoming key — the api_keys table stores SHA-256 hashes, never raw keys
    const keyHash = await hashApiKey(apiKey);

    // Validate key in database by hash (timing-safe: DB does the comparison)
    const { data: apiKeyData, error: fetchError } = await supabaseAdminClient
      .from('api_keys')
      .select('id, label, created_by, revoked_at')
      .eq('key_hash', keyHash)
      .single();

    if (fetchError || !apiKeyData) {
      reqLogger.security("API key validation failed", {
        reason: fetchError ? fetchError.message : 'Key not found'
      });
      return new Response(JSON.stringify({ error: 'Invalid API key.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    if (apiKeyData.revoked_at) {
      reqLogger.security("API key has been revoked", { keyId: apiKeyData.id });
      return new Response(JSON.stringify({ error: 'API key has been revoked.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    reqLogger.info("API key validated successfully", { label: apiKeyData.label });

    // Return success response
    return new Response(JSON.stringify({
      message: 'API key validated successfully.',
      org_name: apiKeyData.label,
      key_id: apiKeyData.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    reqLogger.error("Unexpected error during API key validation", { error: errorMessage });
    return new Response(JSON.stringify({ error: 'Internal server error during validation.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

logger.info("Function script processed, waiting for requests");
