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
      console.log(`Attempt ${attempt}: Sending emergency alert email`);

      const { error } = await supabaseClient.functions.invoke(SEND_EMAIL_FUNCTION_NAME, {
        body: { ...emailPayload, to: recipient }
      });

      if (!error) {
        console.log('✅ Emergency alert email sent successfully');
        return { success: true, recipient };
      }

      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        return { success: false, recipient, error: error.message };
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      
    } catch (e) {
      console.error(`❌ Exception on attempt ${attempt} for ${recipient}:`, e.message);
      if (attempt === maxRetries) {
        return { success: false, recipient, error: e.message };
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
  console.log("🚨 Emergency alert dispatch started at:", new Date().toISOString());

  try {
    const payload = await req.json();
    console.log("Received payload:", JSON.stringify(payload, null, 2));

    const newCheckin = (payload.record || payload.new_record) as CheckinRecord;

    if (!newCheckin) {
      console.error("❌ No record found in payload");
      return new Response(JSON.stringify({ error: 'Bad Request: No record found in payload' }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Validate emergency status
    if (!newCheckin.is_emergency) {
      console.log("ℹ️ Non-emergency check-in received, skipping alert");
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
      console.error("❌ Missing required fields:", { user_id, alert_type });
      return new Response(JSON.stringify({ error: 'Bad Request: Missing user_id or label' }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    console.log('📋 Fetching user profile for emergency alert');

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('full_name, first_name, last_name, caregiver_email, phone_number, emergency_contact_name')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      console.error('❌ Profile fetch failed:', profileError?.message || 'Unknown error');
      
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

    console.log('👤 Processing emergency alert for patient');
    console.log(`👥 Caregiver email ${caregiverEmail ? 'provided' : 'not provided'}`);

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
      sendEmailWithRetry(supabaseClient, baseEmailPayload, ADMIN_EMAIL)
    );

    // Caregiver email (if exists)
    if (caregiverEmail) {
      emailPromises.push(
        sendEmailWithRetry(supabaseClient, baseEmailPayload, caregiverEmail)
      );
    }

    console.log("📧 Sending emergency alert emails...");
    const emailResults = await Promise.all(emailPromises);

    // Process results
    const adminResult = emailResults[0];
    const caregiverResult = caregiverEmail ? emailResults[1] : null;

    // Log to alerts table
    const alertDetails = [
      `Admin: ${ADMIN_EMAIL} (${results[ADMIN_EMAIL] ? 'sent' : 'failed'})`,
      BACKUP_ADMIN_EMAIL ? `Backup Admin: ${BACKUP_ADMIN_EMAIL} (${results[BACKUP_ADMIN_EMAIL] ? 'sent' : 'failed'})` : null,
      caregiverEmail ? `Caregiver: ${caregiverEmail} (${results[caregiverEmail] ? 'sent' : 'failed'})` : 'Caregiver: Not provided',
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
      log('ERROR', 'Error logging alert to database', insertAlertError);
      return new Response(JSON.stringify({ 
        error: 'Failed to log alert', 
        details: insertAlertError.message 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const processingTime = Date.now() - startTime;
    const successfulEmails = Object.values(results).filter(Boolean).length;
    
    log('INFO', `✅ Emergency alert processed successfully in ${processingTime}ms`);
    log('DEBUG', `Emails sent: ${successfulEmails}/${Object.keys(results).length}`);

    // Return detailed response
    const response = {
      success: true,
      message: 'Emergency alert processed',
      user_name: userName,
      alert_type: alert_type,
      emails_sent: results,
      processing_time_ms: processingTime,
      environment: ENVIRONMENT
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    clearTimeout(timeoutId);
    const processingTime = Date.now() - startTime;
    log('ERROR', `Unhandled error in emergency-alert-dispatch (${processingTime}ms)`, error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error', 
      details: error.message,
      processing_time_ms: processingTime,
      environment: ENVIRONMENT
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});