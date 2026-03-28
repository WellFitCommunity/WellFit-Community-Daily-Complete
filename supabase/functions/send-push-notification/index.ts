/**
 * Send Push Notification via Firebase Cloud Messaging
 *
 * This Supabase Edge Function replaces the deprecated Firebase Cloud Function.
 * It sends FCM push notifications to registered devices using the FCM HTTP v1 API.
 *
 * Required Supabase Secrets:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY (base64 encoded recommended)
 */

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsFromRequest, handleOptions } from "../_shared/cors.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createLogger } from '../_shared/auditLogger.ts'
import { checkRateLimit } from '../_shared/rateLimiter.ts'

const FCM_BATCH_SIZE = 500; // FCM supports up to 500 tokens per multicast

interface PushNotificationRequest {
  title: string;
  body: string;
  user_ids?: string[];  // Optional: specific users to notify
  topic?: string;       // Optional: FCM topic
  data?: Record<string, string>; // Optional: custom data payload
  priority?: 'high' | 'normal';
}

interface FCMMessage {
  message: {
    token?: string;
    topic?: string;
    notification: {
      title: string;
      body: string;
    };
    data?: Record<string, string>;
    android?: {
      priority: string;
    };
    webpush?: {
      headers?: Record<string, string>;
    };
  };
}

// Create JWT for Google OAuth 2.0
async function createServiceAccountJWT(): Promise<string> {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  let privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY') || '';

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase credentials in environment');
  }

  // Handle base64 encoded private key or escaped newlines
  if (privateKey.startsWith('LS0t')) {
    // Base64 encoded
    privateKey = atob(privateKey);
  } else {
    // Replace escaped newlines
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  };

  // Encode header and payload
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = `${headerB64}.${payloadB64}`;

  // Import private key and sign
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signatureInput}.${signatureB64}`;
}

// Get OAuth 2.0 access token from Google
async function getAccessToken(): Promise<string> {
  const jwt = await createServiceAccountJWT();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Send FCM message using HTTP v1 API
async function sendFCMMessage(
  accessToken: string,
  projectId: string,
  message: FCMMessage
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error };
  }

  const data = await response.json();
  return { success: true, messageId: data.name };
}

/**
 * Send FCM messages in batches of FCM_BATCH_SIZE concurrently.
 * Prevents timeout from O(N) sequential sends (A-18 scalability fix).
 */
async function sendBatch(
  accessToken: string,
  projectId: string,
  tokens: string[],
  notification: { title: string; body: string },
  data: Record<string, string> | undefined,
  priority: string
): Promise<Array<{ token: string; success: boolean; error?: string }>> {
  const results: Array<{ token: string; success: boolean; error?: string }> = [];

  for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
    const batch = tokens.slice(i, i + FCM_BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (token) => {
        const message: FCMMessage = {
          message: {
            token,
            notification,
            data,
            android: { priority },
            webpush: { headers: { Urgency: priority } }
          }
        };
        const result = await sendFCMMessage(accessToken, projectId, message);
        return { token: token.slice(0, 10) + '...', ...result };
      })
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value);
      } else {
        results.push({ token: '???', success: false, error: String(r.reason) });
      }
    }
  }

  return results;
}

serve(async (req) => {
  const logger = createLogger('send-push-notification', req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // =========================================================================
    // AUTHENTICATION — Verify caller identity (G-1 security fix)
    // =========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.slice(7);
    const authSupabase = createClient(
      SUPABASE_URL ?? '',
      SB_PUBLISHABLE_API_KEY ?? SB_SECRET_KEY ?? ''
    );
    const { data: { user }, error: authError } = await authSupabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify caller has admin/system role (push notifications are a privileged operation)
    const adminSupabase = createClient(SUPABASE_URL ?? '', SB_SECRET_KEY ?? '');
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('is_admin, tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.is_admin) {
      // Also check user_roles for system-level roles
      const { data: roleData } = await adminSupabase
        .from('user_roles')
        .select('roles:role_id(name)')
        .eq('user_id', user.id)
        .single();

      const roleName = (roleData?.roles as { name: string } | null)?.name;
      const allowedRoles = ['admin', 'super_admin', 'physician', 'nurse', 'case_manager'];

      if (!roleName || !allowedRoles.includes(roleName)) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions — admin or clinical role required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    logger.info('Push notification authorized', { userId: user.id, isAdmin: profile?.is_admin });

    // =========================================================================
    // RATE LIMITING — 20 push requests per 10 minutes per user (A-14)
    // =========================================================================
    const rateResult = await checkRateLimit(user.id, {
      maxAttempts: 20,
      windowSeconds: 600,
      keyPrefix: 'push'
    });

    if (!rateResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many push notification requests. Retry in ${rateResult.retryAfter} seconds.`,
          retryAfter: rateResult.retryAfter
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(rateResult.retryAfter || 600)
          }
        }
      );
    }

    let payload: PushNotificationRequest;
    try {
      payload = await req.json();
    } catch (_parseErr: unknown) {
      return new Response(
        JSON.stringify({ error: 'Invalid or empty request body — expected JSON with title and body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { title, body, user_ids, topic, data, priority = 'high' } = payload;

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: title, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.info('Processing push notification request', {
      title,
      hasUserIds: !!user_ids?.length,
      hasTopic: !!topic
    });

    const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
    if (!projectId) {
      throw new Error('FIREBASE_PROJECT_ID not configured');
    }

    // Get OAuth access token
    const accessToken = await getAccessToken();

    const results: Array<{ token?: string; topic?: string; success: boolean; error?: string }> = [];

    // If topic is specified, send to topic
    if (topic) {
      const message: FCMMessage = {
        message: {
          topic,
          notification: { title, body },
          data,
          android: { priority },
          webpush: { headers: { Urgency: priority } }
        }
      };

      const result = await sendFCMMessage(accessToken, projectId, message);
      results.push({ topic, ...result });
      logger.info('Sent topic notification', { topic, success: result.success });
    }

    // If user_ids specified, get their FCM tokens and send individually
    if (user_ids?.length) {
      const supabase = createClient(
        SUPABASE_URL ?? '',
        SB_SECRET_KEY ?? ''
      );

      // Tenant isolation: only send to users within caller's tenant
      const callerTenantId = profile?.tenant_id;

      // Fetch FCM tokens for specified users, scoped to caller's tenant
      // NOTE: Using fcm_tokens table (canonical) instead of push_subscriptions
      let tokenQuery = supabase
        .from('fcm_tokens')
        .select('user_id, token')
        .in('user_id', user_ids);

      // If caller has a tenant, verify target users belong to the same tenant
      if (callerTenantId) {
        const { data: tenantUsers } = await supabase
          .from('profiles')
          .select('user_id')
          .in('user_id', user_ids)
          .eq('tenant_id', callerTenantId);

        const allowedUserIds = (tenantUsers || []).map((u: { user_id: string }) => u.user_id);
        if (allowedUserIds.length === 0) {
          logger.warn('No target users found in caller tenant', { callerTenantId, requestedUserIds: user_ids.length });
        }
        tokenQuery = supabase
          .from('fcm_tokens')
          .select('user_id, token')
          .in('user_id', allowedUserIds.length > 0 ? allowedUserIds : ['__none__']);
      }

      const { data: subscriptions, error } = await tokenQuery;

      if (error) {
        logger.error('Failed to fetch push subscriptions', { error: error.message });
      } else if (subscriptions?.length) {
        const tokens = subscriptions.map((s: { token: string }) => s.token);
        const batchResults = await sendBatch(accessToken, projectId, tokens, { title, body }, data, priority);
        results.push(...batchResults);

        const failed = batchResults.filter(r => !r.success);
        if (failed.length > 0) {
          logger.warn('Some push sends failed', { failedCount: failed.length });
        }
        logger.info('Sent user-targeted notifications', {
          attempted: subscriptions.length,
          succeeded: batchResults.filter(r => r.success).length
        });
      }
    }

    // If no specific targets, send to all registered tokens (broadcast within tenant)
    if (!topic && !user_ids?.length) {
      const supabase = createClient(
        SUPABASE_URL ?? '',
        SB_SECRET_KEY ?? ''
      );

      const callerTenantForBroadcast = profile?.tenant_id;

      // Tenant-scoped broadcast: only send to users in the caller's tenant
      let allTokens: { token: string }[] | null = null;
      let error: { message: string } | null = null;

      if (callerTenantForBroadcast) {
        // Get user_ids in caller's tenant, then their tokens
        const { data: tenantUserIds } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('tenant_id', callerTenantForBroadcast);

        const uids = (tenantUserIds || []).map((u: { user_id: string }) => u.user_id);
        if (uids.length > 0) {
          const result = await supabase
            .from('fcm_tokens')
            .select('token')
            .in('user_id', uids);
          allTokens = result.data;
          error = result.error;
        }
      } else {
        // Super admin without tenant — full broadcast (rare, controlled)
        const result = await supabase
          .from('fcm_tokens')
          .select('token');
        allTokens = result.data;
        error = result.error;
      }

      if (error) {
        logger.error('Failed to fetch all push subscriptions', { error: error.message });
      } else if (allTokens?.length) {
        const tokens = allTokens.map((s: { token: string }) => s.token);
        const batchResults = await sendBatch(accessToken, projectId, tokens, { title, body }, data, priority);
        results.push(...batchResults);
        logger.info('Broadcast notification sent', {
          attempted: allTokens.length,
          succeeded: batchResults.filter(r => r.success).length
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${successCount} notifications, ${failCount} failed`,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Push notification error', { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
