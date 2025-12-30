import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger('validate-api-key');

logger.info("Function initializing");

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

  reqLogger.debug("Attempting to validate API key", { keyPrefix: apiKey.substring(0, 10) });

  try {
    // Validate key in database
    const { data: apiKeyData, error: fetchError } = await supabaseAdminClient
      .from('api_keys')
      .select('id, org_name, active, usage_count') // Only select necessary fields
      .eq('api_key', apiKey)
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

    if (!apiKeyData.active) {
      reqLogger.security("API key is inactive", { keyId: apiKeyData.id });
      return new Response(JSON.stringify({ error: 'API key is inactive.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    reqLogger.info("API key validated successfully", { orgName: apiKeyData.org_name });

    // Update usage statistics (fire and forget for now, but log errors)
    const newUsageCount = (apiKeyData.usage_count || 0) + 1;
    const lastUsed = new Date().toISOString();

    const { error: updateError } = await supabaseAdminClient
      .from('api_keys')
      .update({ usage_count: newUsageCount, last_used: lastUsed })
      .eq('id', apiKeyData.id);

    if (updateError) {
      reqLogger.warn("Failed to update usage statistics", {
        keyId: apiKeyData.id,
        error: updateError.message
      });
    } else {
      reqLogger.debug("Usage statistics updated", { keyId: apiKeyData.id });
    }

    // Return success response
    return new Response(JSON.stringify({
      message: 'API key validated successfully.',
      org_name: apiKeyData.org_name,
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
