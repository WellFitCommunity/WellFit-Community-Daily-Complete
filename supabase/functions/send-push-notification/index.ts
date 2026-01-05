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
    const payload: PushNotificationRequest = await req.json();
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

      // Fetch FCM tokens for specified users
      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('user_id, fcm_token')
        .in('user_id', user_ids);

      if (error) {
        logger.error('Failed to fetch push subscriptions', { error: error.message });
      } else if (subscriptions?.length) {
        for (const sub of subscriptions) {
          const message: FCMMessage = {
            message: {
              token: sub.fcm_token,
              notification: { title, body },
              data,
              android: { priority },
              webpush: { headers: { Urgency: priority } }
            }
          };

          const result = await sendFCMMessage(accessToken, projectId, message);
          results.push({ token: sub.fcm_token.slice(0, 10) + '...', ...result });

          if (!result.success) {
            logger.warn('Failed to send to token', {
              userId: sub.user_id,
              error: result.error
            });
          }
        }
        logger.info('Sent user-targeted notifications', {
          attempted: subscriptions.length,
          succeeded: results.filter(r => r.success).length
        });
      }
    }

    // If no specific targets, send to all registered tokens (broadcast)
    if (!topic && !user_ids?.length) {
      const supabase = createClient(
        SUPABASE_URL ?? '',
        SB_SECRET_KEY ?? ''
      );

      const { data: allTokens, error } = await supabase
        .from('push_subscriptions')
        .select('fcm_token');

      if (error) {
        logger.error('Failed to fetch all push subscriptions', { error: error.message });
      } else if (allTokens?.length) {
        for (const sub of allTokens) {
          const message: FCMMessage = {
            message: {
              token: sub.fcm_token,
              notification: { title, body },
              data,
              android: { priority },
              webpush: { headers: { Urgency: priority } }
            }
          };

          const result = await sendFCMMessage(accessToken, projectId, message);
          results.push({ token: sub.fcm_token.slice(0, 10) + '...', ...result });
        }
        logger.info('Broadcast notification sent', {
          attempted: allTokens.length,
          succeeded: results.filter(r => r.success).length
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
