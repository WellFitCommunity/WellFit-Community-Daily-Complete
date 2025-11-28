import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createLogger } from '../_shared/auditLogger.ts'

interface TeamAlertRequest {
  alert_type: string;
  description: string;
  user_id: string;
  priority: 'high' | 'medium' | 'low';
}

serve(async (req) => {
  const logger = createLogger('send-team-alert', req);

  // Handle CORS preflight with dynamic origin validation
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  // Get CORS headers for this request's origin
  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {},
        },
      }
    )

    const { alert_type, description, user_id, priority = 'medium' } = await req.json() as TeamAlertRequest

    if (!alert_type || !description || !user_id) {
      logger.warn('Missing required fields in team alert request', { alert_type, description, user_id });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: alert_type, description, user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    logger.security('Team alert initiated', { alert_type, user_id, priority });

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name, caregiver_email, caregiver_phone')
      .eq('id', user_id)
      .single()

    if (profileError) {
      logger.error('Profile fetch error', { user_id, error: profileError.message })
    }

    const userName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown User'
      : 'Unknown User'

    // Log the alert to alerts table
    const { error: alertError } = await supabaseClient
      .from('alerts')
      .insert({
        user_id,
        alert_type,
        timestamp: new Date().toISOString(),
        details: `${description} - Priority: ${priority}`,
      })

    if (alertError) {
      logger.error('Alert logging error', { user_id, alert_type, error: alertError.message })
    }

    // Send email notification to admin and caregiver
    const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'admin@wellfitcommunity.org'
    const recipients = [ADMIN_EMAIL]

    if (profile?.caregiver_email) {
      recipients.push(profile.caregiver_email)
    }

    const emailSubject = `🚨 WellFit Alert: ${userName} - ${alert_type}`
    const emailBody = `
Alert Type: ${alert_type}
User: ${userName}
Priority: ${priority}
Description: ${description}
Timestamp: ${new Date().toISOString()}

Please check on this user as soon as possible.
`

    // Send emails to all recipients
    logger.info('Sending team alert emails', { recipients, userName });
    for (const recipient of recipients) {
      try {
        await supabaseClient.functions.invoke('send_email', {
          body: {
            to: recipient,
            subject: emailSubject,
            text: emailBody,
            html: emailBody.replace(/\n/g, '<br>')
          }
        })
        logger.info('Team alert email sent successfully', { recipient });
      } catch (emailError) {
        logger.error('Failed to send team alert email', {
          recipient,
          error: emailError.message
        })
      }
    }

    // Send SMS to caregiver if high priority
    if (priority === 'high' && profile?.caregiver_phone) {
      logger.info('Sending high priority SMS alert', {
        caregiverPhone: profile.caregiver_phone
      });
      try {
        await supabaseClient.functions.invoke('send-appointment-reminder', {
          body: {
            phone: profile.caregiver_phone,
            message: `WellFit ALERT: ${userName} - ${alert_type}. ${description}. Please check immediately.`
          }
        })
        logger.info('High priority SMS sent successfully');
      } catch (smsError) {
        logger.error('SMS send error', {
          error: smsError.message
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Team alert sent successfully',
        recipients: recipients.length,
        user_name: userName
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    logger.error('Send team alert error', { error: error.message })
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
