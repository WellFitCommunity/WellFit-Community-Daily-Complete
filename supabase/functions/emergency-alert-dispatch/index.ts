import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "admin@wellfitcommunity.org";
const MAILERSEND_FUNCTION_NAME = "mailersend-email"; // Name of the email sending function

interface CheckinRecord {
  id: string;
  user_id: string;
  label: string; // This will be the alert_type
  is_emergency: boolean;
  created_at: string;
  // other fields from checkins table if needed
}

interface ProfileRecord {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  caregiver_email?: string;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const payload = await req.json();
    console.log("Received payload:", JSON.stringify(payload));

    // Supabase webhooks for INSERT pass the new record in `record` or `new_record`
    // Adjust based on actual webhook payload structure. Common is `record`.
    const newCheckin = (payload.record || payload.new_record) as CheckinRecord;

    if (!newCheckin) {
      console.error("No record found in payload. Payload structure:", payload);
      return new Response(JSON.stringify({ error: 'Bad Request: No record found in payload' }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Ensure it's an emergency check-in, though the trigger should handle this.
    // This is a safeguard.
    if (!newCheckin.is_emergency) {
      return new Response(JSON.stringify({ message: 'Not an emergency check-in, skipped.' }), {
        status: 200, // Or 202 Accepted if preferred
        headers: { "Content-Type": "application/json" },
      });
    }

    const { user_id, label: alert_type, created_at: checkin_timestamp } = newCheckin;

    if (!user_id || !alert_type) {
      console.error("Missing user_id or label in check-in record:", newCheckin);
      return new Response(JSON.stringify({ error: 'Bad Request: Missing user_id or label' }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '' // Use service role key for admin operations
    );

    // 1. Fetch user's profile and caregiver email
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('full_name, first_name, last_name, caregiver_email')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      console.error(`Error fetching profile for user_id ${user_id}:`, profileError);
      // Decide if we should still send an alert to admin
      // For now, we will log the error and proceed to log the alert, but not send emails if profile is missing.
      // Alternatively, send a generic email to admin.
      // Log to alerts table even if profile fetch fails
      await supabaseClient.from('alerts').insert({
        user_id: user_id,
        alert_type: alert_type,
        timestamp: checkin_timestamp || new Date().toISOString(), // Fallback to now if not available
        details: `Emergency check-in. Profile fetch failed: ${profileError?.message}`
      });
      return new Response(JSON.stringify({ error: `Failed to fetch profile: ${profileError?.message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userName = profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || "Unknown User";
    const caregiverEmail = profile.caregiver_email;

    // 2. Prepare email content
    const emailSubject = `WellFit Emergency Alert: ${userName}`;
    const emailBody = `
      An emergency alert has been triggered by ${userName}.

      Alert Type: ${alert_type}
      Timestamp: ${new Date(checkin_timestamp).toLocaleString()}

      User ID: ${user_id} 

      Please check on them immediately.
    `;

    const emailPayload = {
      to: '', // Will be set per recipient
      subject: emailSubject,
      html_content: emailBody.replace(/\n/g, '<br>'), // Basic HTML version
      text_content: emailBody
    };

    let emailSentToAdmin = false;
    let emailSentToCaregiver = false;

    // 3. Send email to Admin
    try {
      console.log(`Attempting to send email to admin: ${ADMIN_EMAIL}`);
      const { error: adminEmailError } = await supabaseClient.functions.invoke(MAILERSEND_FUNCTION_NAME, {
        body: { ...emailPayload, to: ADMIN_EMAIL },
      });
      if (adminEmailError) {
        console.error(`Error invoking ${MAILERSEND_FUNCTION_NAME} for admin:`, adminEmailError);
        // Continue, but log this failure
      } else {
        emailSentToAdmin = true;
        console.log(`Email successfully invoked for admin: ${ADMIN_EMAIL}`);
      }
    } catch (e) {
        console.error(`Exception invoking ${MAILERSEND_FUNCTION_NAME} for admin:`, e);
    }


    // 4. Send email to Caregiver (if email exists)
    if (caregiverEmail) {
      try {
        console.log(`Attempting to send email to caregiver: ${caregiverEmail}`);
        const { error: caregiverEmailError } = await supabaseClient.functions.invoke(MAILERSEND_FUNCTION_NAME, {
          body: { ...emailPayload, to: caregiverEmail },
        });
        if (caregiverEmailError) {
          console.error(`Error invoking ${MAILERSEND_FUNCTION_NAME} for caregiver ${caregiverEmail}:`, caregiverEmailError);
          // Continue, but log this failure
        } else {
          emailSentToCaregiver = true;
          console.log(`Email successfully invoked for caregiver: ${caregiverEmail}`);
        }
      } catch (e) {
        console.error(`Exception invoking ${MAILERSEND_FUNCTION_NAME} for caregiver:`, e);
      }
    } else {
      console.log(`No caregiver email found for user ${user_id}.`);
    }

    // 5. Log to alerts table
    const alertDetails = `Admin email: ${ADMIN_EMAIL} (sent: ${emailSentToAdmin}). Caregiver email: ${caregiverEmail || 'N/A'} (sent: ${emailSentToCaregiver}).`;
    const { error: insertAlertError } = await supabaseClient.from('alerts').insert({
      user_id: user_id,
      alert_type: alert_type,
      timestamp: checkin_timestamp || new Date().toISOString(),
      details: alertDetails
    });

    if (insertAlertError) {
      console.error('Error inserting into alerts table:', insertAlertError);
      return new Response(JSON.stringify({ error: 'Failed to log alert', details: insertAlertError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("Emergency alert processed successfully.");
    return new Response(JSON.stringify({ success: true, message: 'Alert processed.' }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Unhandled error in emergency-alert-dispatch:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
})
