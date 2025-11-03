// supabase/functions/save-fcm-token/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Zod schema for save-fcm-token payload
const saveTokenSchema = z.object({
  fcm_token: z.string().min(1, "fcm_token is required."),
  device_info: z.string().optional(),
});

type SaveTokenPayload = z.infer<typeof saveTokenSchema>;


interface SaveTokenPayload {
  fcm_token: string;
  device_info?: string; // Optional
}

async function getAuthenticatedUser(req: Request, supabaseClient: SupabaseClient) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }
  // Re-create client with the user's token to get their session
  const userSupabaseClient = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await userSupabaseClient.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('User not authenticated');
  return user;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {

    const rawBody = await req.json();
    const validationResult = saveTokenSchema.safeParse(rawBody);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }));
      return new Response(
        JSON.stringify({ error: "Validation failed", details: errors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { fcm_token, device_info } = validationResult.data;


    const { fcm_token, device_info } = await req.json() as SaveTokenPayload;

    if (!fcm_token) {
      return new Response(JSON.stringify({ error: 'Missing fcm_token in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }


    // Use service role client for database operations
    const serviceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    // Get authenticated user ID
    const user = await getAuthenticatedUser(req, serviceRoleClient);
    const user_id = user.id;

    // Upsert the token: if token for user exists, update last_used_at. Otherwise, insert new.
    const { data, error } = await serviceRoleClient
      .from('fcm_tokens')
      .upsert(
        {
          user_id: user_id,
          token: fcm_token,
          last_used_at: new Date().toISOString(),
          device_info: device_info,
        },
        {
          onConflict: 'user_id,token', // Specify conflict target for upsert
        }
      )
      .select(); // Optionally select the row after upsert

    if (error) {
      console.error('Error saving FCM token:', error);
      return new Response(JSON.stringify({ error: 'Failed to save FCM token', details: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('FCM token saved successfully for user:', user_id, data);
    return new Response(JSON.stringify({ success: true, message: 'FCM token saved.', data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('Error in save-fcm-token function:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    if (errorMessage.includes('User not authenticated') || errorMessage.includes('Missing Authorization header')) {
        return new Response(JSON.stringify({ error: 'Unauthorized: ' + errorMessage }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    }
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
