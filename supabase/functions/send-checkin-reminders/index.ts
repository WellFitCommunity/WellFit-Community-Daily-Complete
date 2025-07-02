// supabase/functions/send-checkin-reminders/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { initializeApp, cert, App } from 'https://npm.im/firebase-admin@11.11.1/app'; // Use npm.im for Deno compatibility
import { getMessaging } from 'https://npm.im/firebase-admin@11.11.1/messaging';

// Firebase Admin SDK Initialization
// Ensure these environment variables are set in your Supabase Function settings
const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID');
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL');
const FIREBASE_PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY');

let firebaseAdminApp: App | null = null;

try {
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    const privateKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'); // Handle escaped newlines
    firebaseAdminApp = initializeApp({
      credential: cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log("Firebase Admin SDK initialized successfully.");
  } else {
    console.error("Firebase Admin SDK credentials are not fully configured. Push notifications cannot be sent.");
  }
} catch (e) {
  console.error("Error initializing Firebase Admin SDK:", e.message);
  firebaseAdminApp = null; // Ensure app is null if init fails
}


serve(async (_req) => { // Request might not be used if triggered by cron
  if (!firebaseAdminApp) {
    return new Response(JSON.stringify({ error: 'Firebase Admin SDK not initialized. Check function logs.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Fetch all users who should receive a reminder.
    //    This logic can be customized (e.g., users who haven't checked in, specific cohorts, etc.)
    //    For now, let's fetch all users with active FCM tokens.
    const { data: usersWithTokens, error: fetchError } = await supabaseClient
      .from('fcm_tokens')
      .select(`
        user_id,
        token,
        profiles ( id, full_name, first_name, last_name )
      `)
      .neq('token', null); // Ensure token exists

    if (fetchError) {
      console.error('Error fetching users with FCM tokens:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch users for reminders', details: fetchError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!usersWithTokens || usersWithTokens.length === 0) {
      console.log('No users with FCM tokens found to send reminders to.');
      return new Response(JSON.stringify({ success: true, message: 'No users with FCM tokens found.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${usersWithTokens.length} tokens to potentially send reminders to.`);

    const messages = [];
    const tokensToRemove: { userId: string, token: string }[] = [];

    for (const record of usersWithTokens) {
      const { token, profiles: profile } = record as any; // Type assertion for profile relation
      const userName = profile?.full_name || profile?.first_name || 'there';

      if (token) {
        messages.push({
          notification: {
            title: 'WellFit Check-in Reminder',
            body: `Hi ${userName}, it's time for your check-in! Please log your well-being today.`,
          },
          token: token,
          // Optional: Add data payload for client-side handling
          // data: {
          //   type: 'checkin_reminder',
          //   navigateTo: '/check-in'
          // }
        });
      }
    }

    if (messages.length === 0) {
      console.log('No valid messages to send.');
       return new Response(JSON.stringify({ success: true, message: 'No valid messages to send.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Send messages via FCM
    const messaging = getMessaging(firebaseAdminApp);
    const batchResponse = await messaging.sendAll(messages);

    console.log(`Successfully sent ${batchResponse.successCount} messages out of ${messages.length}.`);

    batchResponse.responses.forEach((response, idx) => {
      const originalToken = messages[idx].token;
      if (!response.success) {
        console.warn(`Failed to send message to token ${originalToken}:`, response.error);
        // Handle unregistered or invalid tokens by removing them from the database
        if (response.error.code === 'messaging/registration-token-not-registered' ||
            response.error.code === 'messaging/invalid-registration-token') {
          tokensToRemove.push({ userId: usersWithTokens[idx].user_id, token: originalToken });
        }
      }
    });

    // 3. Optional: Clean up invalid/unregistered tokens
    if (tokensToRemove.length > 0) {
      console.log(`Attempting to remove ${tokensToRemove.length} invalid FCM tokens.`);
      for (const item of tokensToRemove) {
        const { error: deleteError } = await supabaseClient
          .from('fcm_tokens')
          .delete()
          .eq('user_id', item.userId)
          .eq('token', item.token);
        if (deleteError) {
          console.error(`Failed to delete token ${item.token} for user ${item.userId}:`, deleteError.message);
        } else {
          console.log(`Successfully deleted invalid token ${item.token} for user ${item.userId}`);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Check-in reminders sent.',
      sentCount: batchResponse.successCount,
      failedCount: batchResponse.failureCount,
      removedTokenCount: tokensToRemove.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('Error in send-checkin-reminders function:', e);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
