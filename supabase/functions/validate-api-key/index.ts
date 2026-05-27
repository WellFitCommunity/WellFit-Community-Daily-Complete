import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';
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

let supabaseAdminClient: SupabaseClient;
try {
  if (!SUPABASE_URL || !SB_SECRET_KEY) {
    throw new Error("SUPABASE_URL and SB_SECRET_KEY must be defined in environment variables.");
  }
  supabaseAdminClient = createClient(SUPABASE_URL, SB_SECRET_KEY);
  logger.info("Supabase admin client initialized successfully");
} catch (err: unknown) {
  const errorMessage = err instanceof Error ? err.message : String(err);
  logger.error("Failed to initialize Supabase client", { error: errorMessage });
}

interface ValidateApiKeyRpcRow {
  valid: boolean;
  key_id: string | null;
  tenant_id: string | null;
  error_reason: string | null;
}

Deno.serve(async (req: Request) => {
  const reqLogger = createLogger('validate-api-key', req);
  reqLogger.info("Request received", { method: req.method, url: req.url });

  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method === 'OPTIONS') {
    reqLogger.debug("Handling OPTIONS preflight request");
    return handleOptions(req);
  }

  if (!supabaseAdminClient) {
    reqLogger.error("Supabase client not initialized");
    return new Response(JSON.stringify({ error: "Internal server error: Supabase client not initialized." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reqLogger.security("Missing or malformed Authorization header");
    return new Response(JSON.stringify({ error: 'Missing or malformed Authorization header. Use "Bearer <API_KEY>".' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }
  const apiKey = authHeader.substring(7);

  if (!apiKey) {
    reqLogger.security("API key is empty after Bearer prefix");
    return new Response(JSON.stringify({ error: 'API key cannot be empty.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  reqLogger.debug("Attempting to validate API key", { keyPrefix: apiKey.substring(0, 8) });

  try {
    const keyHash = await hashApiKey(apiKey);

    // Audit context: first IP in x-forwarded-for chain is the caller; rest are proxies.
    const xff = req.headers.get('x-forwarded-for');
    const ipAddress = xff ? xff.split(',')[0]?.trim() ?? null : null;
    const userAgent = req.headers.get('user-agent') ?? null;

    // Thin RPC wrapper: validate_api_key handles lookup + revocation check +
    // use_count/last_used_at update + audit log insertion atomically.
    const { data: rpcRows, error: rpcError } = await supabaseAdminClient
      .rpc('validate_api_key', {
        p_key_hash: keyHash,
        p_key_prefix: null,
        p_required_scope: null,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_caller_function: 'validate-api-key',
      });

    if (rpcError) {
      reqLogger.error("validate_api_key RPC error", { error: rpcError.message });
      return new Response(JSON.stringify({ error: 'Internal server error during validation.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const rows = (rpcRows ?? []) as ValidateApiKeyRpcRow[];
    const result = rows[0];

    if (!result) {
      reqLogger.error("validate_api_key RPC returned no rows");
      return new Response(JSON.stringify({ error: 'Internal server error during validation.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!result.valid) {
      reqLogger.security("API key validation failed", { reason: result.error_reason });

      // Status mapping: 'invalid' = caller didn't present a real key (auth);
      // 'revoked'/'expired'/'scope_denied' = key exists but is not authorized (forbidden).
      const status = result.error_reason === 'invalid' ? 401 : 403;
      const errorMessage =
        result.error_reason === 'invalid'      ? 'Invalid API key.' :
        result.error_reason === 'revoked'      ? 'API key has been revoked.' :
        result.error_reason === 'expired'      ? 'API key has expired.' :
        result.error_reason === 'scope_denied' ? 'API key lacks required scope.' :
        'API key validation failed.';

      return new Response(JSON.stringify({ error: errorMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status,
      });
    }

    // Success: fetch label for backward-compat response shape (validate_api_key
    // RPC intentionally returns only the minimum needed for downstream auth
    // checks; label is partner-readable metadata, not security-critical).
    const { data: keyMeta, error: labelError } = await supabaseAdminClient
      .from('api_keys')
      .select('label')
      .eq('id', result.key_id as string)
      .single();

    if (labelError) {
      reqLogger.error("Failed to fetch key label after successful validation", { error: labelError.message, keyId: result.key_id });
      // Validation succeeded; missing label is a degraded response, not a failure.
    }

    reqLogger.info("API key validated successfully", { keyId: result.key_id, label: keyMeta?.label });

    return new Response(JSON.stringify({
      message: 'API key validated successfully.',
      org_name: keyMeta?.label ?? null,
      key_id: result.key_id,
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
