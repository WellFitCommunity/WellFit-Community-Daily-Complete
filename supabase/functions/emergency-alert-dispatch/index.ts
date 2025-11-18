import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "admin@wellfitcommunity.org";
const SEND_EMAIL_FUNCTION_NAME = "send_email";

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

  return {
    subject,
    htmlBody: bodyContent.replace(/\n/g, '<br>'),
    textBody: bodyContent
  };
}

// Helper function to send email with retry logic
async function sendEmailWithRetry(
  supabaseClient: any,
  emailPayload: any,
  recipient: string,
  maxRetries: number = 2
): Promise<EmailResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log('Attempting to send emergency alert email:', { attempt, recipient });

      const { error } = await supabaseClient.functions.invoke(SEND_EMAIL_FUNCTION_NAME, {
        body: { ...emailPayload, to: recipient }
      });

      if (!error) {
        console.log('Emergency alert email sent successfully:', { recipient });
        return { success: true, recipient };
      }

      console.error('Email send attempt failed:', { attempt, recipient, error: error.message });

      if (attempt === maxRetries) {
        return { success: false, recipient, error: error.message };
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));

    } catch (e) {
      console.error('Exception during email send attempt:', {
        attempt,
        recipient,
        error: e instanceof Error ? e.message : String(e)
      });
      if (attempt === maxRetries) {
        return { success: false, recipient, error: e instanceof Error ? e.message : String(e) };
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  return { success: false, recipient, error: "Max retries exceeded" };
}

serve(async (req) => {

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  console.log('Emergency alert dispatch started:', { timestamp: new Date().toISOString() });

  try {
    const payload = await req.json();
    console.log('Received payload:', payload);

    const newCheckin = (payload.record || payload.new_record) as CheckinRecord;

    if (!newCheckin) {
      console.error('No record found in payload');
      return new Response(JSON.stringify({ error: 'Bad Request: No record found in payload' }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate emergency status
    if (!newCheckin.is_emergency) {
      console.log('Non-emergency check-in received, skipping alert', {
        checkin_id: newCheckin.id
      });
      return new Response(JSON.stringify({ message: 'Not an emergency check-in, skipped.' }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
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
      console.error('Missing required fields', { user_id, alert_type });
      return new Response(JSON.stringify({ error: 'Bad Request: Missing user_id or label' }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    console.log('Fetching user profile for emergency alert', { user_id });

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('full_name, first_name, last_name, caregiver_email, phone_number, emergency_contact_name')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch failed', {
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
        headers: { "Content-Type": "application/json" },
      });
    }

    const userName = profile.full_name ||
                    `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
                    "Unknown User";
    const caregiverEmail = profile.caregiver_email;

    console.log('Processing emergency alert for patient', {
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

    console.log('Sending emergency alert emails', {
      recipients: caregiverEmail ? [ADMIN_EMAIL, caregiverEmail] : [ADMIN_EMAIL]
    });
    const emailResults = await Promise.all(emailPromises);

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
      console.error('Error logging alert to database', {
        error: insertAlertError.message
      });
      return new Response(JSON.stringify({
        error: 'Failed to log alert',
        details: insertAlertError.message
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const processingTime = Date.now() - startTime;
    const successfulEmails = Object.values(emailResultsMap).filter(Boolean).length;

    console.log('Emergency alert processed successfully', {
      processingTimeMs: processingTime,
      successfulEmails,
      totalRecipients: Object.keys(emailResultsMap).length
    });

    // Return detailed response
    const response = {
      success: true,
      message: 'Emergency alert processed',
      user_name: userName,
      alert_type: alert_type,
      emails_sent: emailResultsMap,
      processing_time_ms: processingTime
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Unhandled error in emergency-alert-dispatch', {
      processingTimeMs: processingTime,
      error: error.message
    });

    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      details: error.message,
      processing_time_ms: processingTime
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});