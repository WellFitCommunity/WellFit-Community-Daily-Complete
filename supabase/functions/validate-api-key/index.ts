import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cors } from '../_shared/cors.ts';

// Initialize Supabase client with service role
let supabaseAdminClient: SupabaseClient;
try {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined in environment variables.");
  }
  supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey);
} catch (error) {
  console.error("Failed to initialize Supabase client:", error.message);
  // If client fails to init, the function won't work, but error handling per-request is still needed.
}


Deno.serve(async (req: Request) => {
  const { headers: corsHeaders, allowed } = cors(req.headers.get('origin'), {
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Reject requests from unauthorized origins
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      headers: corsHeaders,
      status: 403,
    });
  }

  // Ensure Supabase client is initialized
  if (!supabaseAdminClient) {
    console.error("Supabase client not initialized. Cannot process request.");
    return new Response(JSON.stringify({ error: "Internal server error: Supabase client not initialized." }), {
      headers: corsHeaders,
      status: 500,
    });
  }

  // Extract API key from Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or malformed Authorization header. Use "Bearer <API_KEY>".' }), {
      headers: corsHeaders,
      status: 401,
    });
  }
  const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key cannot be empty.' }), {
      headers: corsHeaders,
      status: 401,
    });
  }

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
        headers: corsHeaders,
        status: 401, // Unauthorized
      });
    }

    if (!apiKeyData.active) {
      console.warn(`API key is inactive: ${apiKeyData.id}`);
      return new Response(JSON.stringify({ error: 'API key is inactive.' }), {
        headers: corsHeaders,
        status: 403, // Forbidden (more specific than 401 for inactive key)
      });
    }

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
    }

    // Return success response
    return new Response(JSON.stringify({
      message: 'API key validated successfully.',
      org_name: apiKeyData.org_name, // Include org_name or other relevant data
      key_id: apiKeyData.id, // Could be useful for the calling service
    }), {
      headers: corsHeaders,
      status: 200,
    });

  } catch (err) {
    console.error('Unexpected error during API key validation:', err);
    return new Response(JSON.stringify({ error: 'Internal server error during validation.' }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
