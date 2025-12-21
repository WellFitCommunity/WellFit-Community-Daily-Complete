// supabase/functions/save-fcm-token/index.ts
import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createLogger } from "../_shared/auditLogger.ts";

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
    SUPABASE_URL,
    SB_PUBLISHABLE_API_KEY,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await userSupabaseClient.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error('User not authenticated');
  return user;
}

serve(async (req) => {
  const logger = createLogger('save-fcm-token', req);

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


    // Use service role client for database operations
    const serviceRoleClient = createClient(
      SUPABASE_URL,
      SB_SECRET_KEY);

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
      logger.error('Failed to save FCM token', {
        userId: user_id,
        error: error.message,
        errorCode: error.code
      });
      return new Response(JSON.stringify({ error: 'Failed to save FCM token', details: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    logger.info('FCM token saved successfully', {
      userId: user_id,
      hasDeviceInfo: Boolean(device_info)
    });
    return new Response(JSON.stringify({ success: true, message: 'FCM token saved.', data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    logger.error('Fatal error in save-fcm-token', {
      error: errorMessage,
      stack: e instanceof Error ? e.stack : undefined
    });
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
