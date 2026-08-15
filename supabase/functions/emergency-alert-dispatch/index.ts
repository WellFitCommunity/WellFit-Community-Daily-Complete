import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createLogger } from '../_shared/auditLogger.ts'
import { corsFromRequest, handleOptions } from '../_shared/cors.ts'
import { requireUser, requireRole } from '../_shared/auth.ts'

// A-1b remediation: this function previously had ZERO auth — any HTTP client
// could trigger emergency emails/push and receive patient name + recipient
// addresses. Two legitimate caller classes now:
//   1. Internal server-to-server (DB webhook / cron): Bearer == SB_SECRET_KEY
//      or x-internal-secret == INTERNAL_SECRET — verified BEFORE the payload
//      is parsed.
//   2. An authenticated user: a senior may dispatch an SOS for THEMSELVES
//      (record.user_id === caller); staff roles may dispatch for others.
// Deliberately NOT rate-limited: this is a life-critical path and callers are
// now authenticated; throttling a real SOS is the worse failure mode.
const DISPATCH_STAFF_ROLES = [
  'admin', 'super_admin', 'physician', 'doctor', 'nurse', 'nurse_practitioner',
  'physician_assistant', 'clinical_supervisor', 'case_manager', 'care_manager',
];

const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "admin@wellfitcommunity.org";
// Use the hardened, authenticated email function `send-email` (dash). The former
// `send_email` (underscore) was an unauthenticated duplicate with a different
// contract (string `to`, no auth, wildcard CORS) and has been retired. `send-email`
// expects `to` as an array of {email,name} and a required `html` body.
const SEND_EMAIL_FUNCTION_NAME = "send-email";

// Enhanced interfaces
interface CheckinRecord {
  id: string;
  user_id: string;
  label: string;
  is_emergency: boolean;
  created_at: string;
  location?: string; // Optional location data
  additional_notes?: string; // Optional emergency details
}

interface ProfileRecord {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  caregiver_email?: string;
  phone_number?: string; // Could be useful for future SMS alerts
  emergency_contact_name?: string;
}

interface EmailResult {
  success: boolean;
  recipient: string;
  error?: string;
}

interface EmailPayload {
  subject: string;
  html: string;
  text: string;
  to?: string;
}

// Logger type is the actual return of createLogger (the hand-rolled local interface
// had drifted from EdgeFunctionLogger and broke `deno check`).
type DispatchLogger = ReturnType<typeof createLogger>;

// Helper function to format email content
function formatEmergencyEmailContent(
  userName: string, 
  alertType: string, 
  timestamp: string,
  userId: string,
  additionalNotes?: string,
  location?: string
): { subject: string; htmlBody: string; textBody: string } {
  const subject = `🚨 WellFit Emergency Alert: ${userName}`;

  // Plain-text body — safe to interpolate raw values.
  let bodyContent = `
An emergency alert has been triggered by ${userName}.

Alert Type: ${alertType}
Timestamp: ${new Date(timestamp).toLocaleString()}
User ID: ${userId}`;

  if (location) {
    bodyContent += `\nLocation: ${location}`;
  }

  if (additionalNotes) {
    bodyContent += `\nAdditional Notes: ${additionalNotes}`;
  }

  bodyContent += `\n\nPlease check on them immediately.`;

  // G-3-SISTER-3: userName (PHI), alertType/userId/location/additionalNotes
  // (all caller-supplied) flow into the HTML email body. Build the HTML from
  // escaped fragments rather than .replace(/\n/g, '<br>') on the raw string.
  // Emergency-alert path is life-critical — same fix shape as G-3 / G-3-SISTER-1/2.
  const escapeHtml = (s: string): string =>
    s.replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;')
     .replace(/'/g, '&#39;');

  const timestampReadable = new Date(timestamp).toLocaleString();
  let htmlBody =
    `An emergency alert has been triggered by ${escapeHtml(userName)}.<br><br>` +
    `Alert Type: ${escapeHtml(alertType)}<br>` +
    `Timestamp: ${escapeHtml(timestampReadable)}<br>` +
    `User ID: ${escapeHtml(userId)}`;
  if (location) {
    htmlBody += `<br>Location: ${escapeHtml(location)}`;
  }
  if (additionalNotes) {
    htmlBody += `<br>Additional Notes: ${escapeHtml(additionalNotes)}`;
  }
  htmlBody += `<br><br>Please check on them immediately.`;

  return {
    subject,
    htmlBody,
    textBody: bodyContent
  };
}

// Helper function to send email with retry logic
// CRITICAL: For emergency alerts, we use 5 retries to ensure delivery
async function sendEmailWithRetry(
  supabaseClient: SupabaseClient,
  emailPayload: EmailPayload,
  recipient: string,
  logger: DispatchLogger,
  maxRetries: number = 5  // Increased from 2 - emergency alerts are life-critical
): Promise<EmailResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info('Attempting to send emergency alert email', { attempt, recipient });

      // send-email (dash) contract: `to` is an ARRAY of {email,name}, `html` is
      // required (it derives the text fallback from html). Adapt the single-string
      // recipient + payload accordingly. Authenticated via the service-role client
      // below (send-email accepts SB_SECRET_KEY as Bearer).
      const { error } = await supabaseClient.functions.invoke(SEND_EMAIL_FUNCTION_NAME, {
        body: {
          to: [{ email: recipient, name: "Emergency Contact" }],
          subject: emailPayload.subject,
          html: emailPayload.html,
          priority: "high",
        },
      });

      if (!error) {
        logger.info('Emergency alert email sent successfully', { recipient });
        return { success: true, recipient };
      }

      logger.error('Email send attempt failed', { attempt, recipient, error: error.message });

      if (attempt === maxRetries) {
        return { success: false, recipient, error: error.message };
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Exception during email send attempt', {
        attempt,
        recipient,
        error: errorMessage
      });
      if (attempt === maxRetries) {
        return { success: false, recipient, error: errorMessage };
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  return { success: false, recipient, error: "Max retries exceeded" };
}

serve(async (req) => {
  const logger = createLogger('emergency-alert-dispatch', req);
  const { headers: corsHeaders } = corsFromRequest(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();
  logger.security('Emergency alert dispatch started', { timestamp: new Date().toISOString() });

  // A-1b: authenticate BEFORE parsing the payload.
  const authHeaderRaw = req.headers.get('authorization') || '';
  const bearer = authHeaderRaw.startsWith('Bearer ') ? authHeaderRaw.slice(7).trim() : '';
  const internalSecretHeader = req.headers.get('x-internal-secret') || '';
  const INTERNAL_SECRET = Deno.env.get('INTERNAL_SECRET') ?? '';
  const isServiceCaller =
    (!!SB_SECRET_KEY && bearer === SB_SECRET_KEY) ||
    (!!INTERNAL_SECRET && internalSecretHeader === INTERNAL_SECRET);

  let callerId: string | null = null;
  if (!isServiceCaller) {
    try {
      const user = await requireUser(req);
      callerId = user.id;
    } catch (e: unknown) {
      logger.security('Rejected unauthenticated emergency dispatch attempt', {
        had_bearer: !!bearer,
      });
      const status = e instanceof Response ? e.status : 401;
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const payload = await req.json();
    // Payload carries PHI (notes, location) — log shape only, never content.
    logger.debug('Received payload', {
      has_record: !!(payload.record || payload.new_record),
    });

    const newCheckin = (payload.record || payload.new_record) as CheckinRecord;

    if (!newCheckin) {
      logger.error('No record found in payload');
      return new Response(JSON.stringify({ error: 'Bad Request: No record found in payload' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Validate emergency status
    if (!newCheckin.is_emergency) {
      logger.info('Non-emergency check-in received, skipping alert', {
        checkin_id: newCheckin.id
      });
      return new Response(JSON.stringify({ message: 'Not an emergency check-in, skipped.' }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const {
      user_id,
      label: alert_type,
      created_at: checkin_timestamp,
      location,
      additional_notes
    } = newCheckin;

    if (!user_id || !alert_type) {
      logger.error('Missing required fields', { user_id, alert_type });
      return new Response(JSON.stringify({ error: 'Bad Request: Missing user_id or label' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // A-1b: a user caller may only dispatch for THEMSELVES unless they hold a
    // staff role. Service callers (webhook/cron) are already verified above.
    if (!isServiceCaller && callerId !== user_id) {
      try {
        await requireRole(callerId as string, DISPATCH_STAFF_ROLES);
      } catch (e: unknown) {
        logger.security('Rejected cross-user emergency dispatch', {
          caller_id: callerId,
          target_user_id: user_id,
        });
        const status = e instanceof Response ? e.status : 403;
        return new Response(JSON.stringify({ error: 'Forbidden: cannot dispatch for another user' }), {
          status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const supabaseClient = createClient(
      SUPABASE_URL ?? '',
      SB_SECRET_KEY ?? ''
    );

    logger.info('Fetching user profile for emergency alert', { user_id });

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('full_name, first_name, last_name, caregiver_email, phone_number, emergency_contact_name')
      .eq('user_id', user_id)  // A-9 fix: profiles PK is user_id, not id
      .single();

    if (profileError || !profile) {
      logger.error('Profile fetch failed', {
        user_id,
        error: profileError?.message || 'Unknown error'
      });

      // Log failed alert
      await supabaseClient.from('alerts').insert({
        user_id: user_id,
        alert_type: alert_type,
        timestamp: checkin_timestamp || new Date().toISOString(),
        details: `Emergency check-in received but profile fetch failed: ${profileError?.message}`
      });

      return new Response(JSON.stringify({
        error: `Failed to fetch profile: ${profileError?.message}`
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const userName = profile.full_name ||
                    `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
                    "Unknown User";
    const caregiverEmail = profile.caregiver_email;

    logger.phi('Processing emergency alert for patient', {
      user_id,
      userName,
      has_caregiver: !!caregiverEmail
    });

    // Prepare email content
    const emailContent = formatEmergencyEmailContent(
      userName, 
      alert_type, 
      checkin_timestamp,
      user_id,
      additional_notes,
      location
    );

    const baseEmailPayload = {
      subject: emailContent.subject,
      html: emailContent.htmlBody,
      text: emailContent.textBody
    };

    // Send emails concurrently for faster processing
    const emailPromises: Promise<EmailResult>[] = [];

    // Admin email
    emailPromises.push(
      sendEmailWithRetry(supabaseClient, baseEmailPayload, ADMIN_EMAIL, logger)
    );

    // Caregiver email (if exists)
    if (caregiverEmail) {
      emailPromises.push(
        sendEmailWithRetry(supabaseClient, baseEmailPayload, caregiverEmail, logger)
      );
    }

    logger.info('Sending emergency alert emails', {
      recipients: caregiverEmail ? [ADMIN_EMAIL, caregiverEmail] : [ADMIN_EMAIL]
    });
    const emailResults = await Promise.all(emailPromises);

    // Send push notification to all registered devices for real-time alerts
    logger.info('Sending emergency push notification');
    try {
      await supabaseClient.functions.invoke('send-push-notification', {
        body: {
          title: `Emergency Alert: ${userName}`,
          body: `${alert_type} - Please check immediately`,
          priority: 'high',
          data: {
            type: 'emergency',
            user_id: user_id,
            alert_type: alert_type,
            timestamp: checkin_timestamp || new Date().toISOString()
          }
        }
      });
      logger.info('Emergency push notification sent successfully');
    } catch (pushError: unknown) {
      const errMsg = pushError instanceof Error ? pushError.message : String(pushError);
      logger.error('Failed to send push notification', { error: errMsg });
      // Don't fail the whole request if push fails - emails are still sent
    }

    // Process results
    const adminResult = emailResults[0];
    const caregiverResult = caregiverEmail ? emailResults[1] : null;

    // Build results map
    const emailResultsMap: Record<string, boolean> = {
      [ADMIN_EMAIL]: adminResult.success
    };
    if (caregiverEmail && caregiverResult) {
      emailResultsMap[caregiverEmail] = caregiverResult.success;
    }

    // Log to alerts table
    const alertDetails = [
      `Admin: ${ADMIN_EMAIL} (${adminResult.success ? 'sent' : 'failed'})`,
      caregiverEmail ? `Caregiver: ${caregiverEmail} (${caregiverResult?.success ? 'sent' : 'failed'})` : 'Caregiver: Not provided',
      location ? `Location: ${location}` : null,
      additional_notes ? `Notes: ${additional_notes}` : null
    ].filter(Boolean).join('. ');

    const { error: insertAlertError } = await supabaseClient.from('alerts').insert({
      user_id: user_id,
      alert_type: alert_type,
      timestamp: checkin_timestamp || new Date().toISOString(),
      details: alertDetails
    });

    if (insertAlertError) {
      logger.error('Error logging alert to database', {
        error: insertAlertError.message
      });
      return new Response(JSON.stringify({
        error: 'Failed to log alert',
        details: insertAlertError.message
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const processingTime = Date.now() - startTime;
    const successfulEmails = Object.values(emailResultsMap).filter(Boolean).length;

    logger.info('Emergency alert processed successfully', {
      processingTimeMs: processingTime,
      successfulEmails,
      totalRecipients: Object.keys(emailResultsMap).length
    });

    // A-1b: the response previously returned the patient's name and the raw
    // recipient email addresses. Return delivery outcomes only.
    const response = {
      success: true,
      message: 'Emergency alert processed',
      alert_type: alert_type,
      admin_notified: adminResult.success,
      caregiver_notified: caregiverEmail ? (caregiverResult?.success ?? false) : null,
      processing_time_ms: processingTime
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (err: unknown) {
    const processingTime = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Unhandled error in emergency-alert-dispatch', {
      processingTimeMs: processingTime,
      error: errorMessage
    });

    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      details: errorMessage,
      processing_time_ms: processingTime
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});