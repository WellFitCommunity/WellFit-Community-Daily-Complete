import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log("validate-api-key function initializing.");

// CORS Configuration - Explicit allowlist for security
const ALLOWED_ORIGINS = [
  "https://thewellfitcommunity.org",
  "https://wellfitcommunity.live",
  "http://localhost:3100",
  "https://localhost:3100"
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : null;
  return {
    'Access-Control-Allow-Origin': allowedOrigin || 'null',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Initialize Supabase client with service role
let supabaseAdminClient: SupabaseClient;
try {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined in environment variables.");
  }
  supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey);
  console.log("Supabase admin client initialized successfully.");
} catch (error) {
  console.error("Failed to initialize Supabase client:", error.message);
  // If client fails to init, the function won't work, but error handling per-request is still needed.
}


Deno.serve(async (req: Request) => {
  console.log(`Request received: ${req.method} ${req.url}`);

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS preflight request.");
    return new Response('ok', { headers: corsHeaders });
  }

  // Ensure Supabase client is initialized
  if (!supabaseAdminClient) {
    console.error("Supabase client not initialized. Cannot process request.");
    return new Response(JSON.stringify({ error: "Internal server error: Supabase client not initialized." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  // Extract API key from Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("Missing or malformed Authorization header.");
    return new Response(JSON.stringify({ error: 'Missing or malformed Authorization header. Use "Bearer <API_KEY>".' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }
  const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

  if (!apiKey) {
    console.log("API key is empty after Bearer prefix.");
    return new Response(JSON.stringify({ error: 'API key cannot be empty.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  console.log(`Attempting to validate API key: ${apiKey.substring(0, 10)}...`); // Log partial key for security

  try {
    // Validate key in database
    const { data: apiKeyData, error: fetchError } = await supabaseAdminClient
      .from('api_keys')
      .select('id, org_name, active, usage_count') // Only select necessary fields
      .eq('api_key', apiKey)
      .single();

    if (fetchError || !apiKeyData) {
      console.warn(`API key validation failed: ${fetchError ? fetchError.message : 'Key not found.'}`);
      return new Response(JSON.stringify({ error: 'Invalid API key.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401, // Unauthorized
      });
    }

    if (!apiKeyData.active) {
      console.warn(`API key is inactive: ${apiKeyData.id}`);
      return new Response(JSON.stringify({ error: 'API key is inactive.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403, // Forbidden (more specific than 401 for inactive key)
      });
    }

    console.log(`API key validated successfully for org: ${apiKeyData.org_name}`);

    // Update usage statistics (fire and forget for now, but log errors)
    const newUsageCount = (apiKeyData.usage_count || 0) + 1;
    const lastUsed = new Date().toISOString();

    const { error: updateError } = await supabaseAdminClient
      .from('api_keys')
      .update({ usage_count: newUsageCount, last_used: lastUsed })
      .eq('id', apiKeyData.id);

    if (updateError) {
      // Log the error but don't fail the request if the key was valid
      console.error(`Failed to update usage statistics for key ID ${apiKeyData.id}:`, updateError.message);
    } else {
      console.log(`Usage statistics updated for key ID ${apiKeyData.id}.`);
    }

    // Return success response
    return new Response(JSON.stringify({
      message: 'API key validated successfully.',
      org_name: apiKeyData.org_name, // Include org_name or other relevant data
      key_id: apiKeyData.id, // Could be useful for the calling service
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('Unexpected error during API key validation:', err);
    return new Response(JSON.stringify({ error: 'Internal server error during validation.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

console.log("validate-api-key function script processed. Waiting for requests.");
