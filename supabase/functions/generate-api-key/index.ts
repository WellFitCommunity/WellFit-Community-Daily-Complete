// File: supabase/functions/generate-api-key/index.ts
import { serve } from 'std/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomBytes, createHash } from 'crypto'

// Helper function to check user roles (ensure this matches the one in RLS migrations or is globally available)
// This is a simplified version for use within this function.
// Assumes the user's JWT is passed in the Authorization header.
async function checkUserRole(supabaseClient: SupabaseClient, requiredRoles: string[]): Promise<boolean> {
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    console.error('Error getting user for role check:', userError?.message);
    return false;
  }

  // This is a simplified check. Ideally, you'd call the DB function `check_user_has_role`
  // or query the user_roles and roles tables directly.
  // For this example, we'll assume an RPC call to the DB function.
  // Ensure 'check_user_has_role' function is created in your DB.
  const { data: hasRole, error: rpcError } = await supabaseClient
    .rpc('check_user_has_role', { role_names: requiredRoles });

  if (rpcError) {
    console.error('RPC error checking user role:', rpcError.message);
    return false;
  }
  return hasRole === true;
}


serve(async (req) => {
  // Create a Supabase client with the ANON KEY to check user auth
  // The SERVICE_ROLE_KEY will be used later for DB insertion if authorized.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseAdminClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } },
  });

  // 0. Check if the user is an admin
  const isAdmin = await checkUserRole(supabaseAdminClient, ['admin', 'super_admin']);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Admin role required.' }), { status: 403 });
  }

  // 1. Read org_name from POST request
  let org_name;
  try {
    const body = await req.json();
    org_name = body.org_name;
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  if (!org_name || typeof org_name !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing or invalid org_name' }), { status: 400 });
  }

  // 2. Generate secure API key
  const apiKeyPlain = `${org_name.toLowerCase().replace(/\s+/g, '-')}-${randomBytes(32).toString('hex')}`;

  // 3. Hash the API key with SHA-256
  const apiKeyHash = createHash('sha256').update(apiKeyPlain).digest('hex');

  // 4. Insert into api_keys table (only the hash!) using the SERVICE_ROLE_KEY
  const supabaseServiceRoleClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error: insertError } = await supabaseServiceRoleClient
    .from('api_keys')
    .insert([{ org_name, api_key_hash: apiKeyHash, active: true, created_by: supabaseAdminClient.auth.getUser()?.id /* Store who created it */}]); // Store who created it

  if (insertError) {
    console.error('Error inserting API key:', insertError.message);
    return new Response(JSON.stringify({ error: 'Failed to save API key: ' + insertError.message }), { status: 500 });
  }

  // 5. Return the plain API key (never returned again!)
  return new Response(JSON.stringify({ api_key: apiKeyPlain }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
})
