import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

const corsHeaders = {
  // CORS handled by shared module,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TeamAlertRequest {
  alert_type: string;
  description: string;
  user_id: string;
  priority: 'high' | 'medium' | 'low';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
      return new Response(
        JSON.stringify({ error: 'Missing required fields: alert_type, description, user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name, caregiver_email, caregiver_phone')
      .eq('id', user_id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
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
      console.error('Alert logging error:', alertError)
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
      } catch (emailError) {
        console.error(`Failed to send email to ${recipient}:`, emailError)
      }
    }

    // Send SMS to caregiver if high priority
    if (priority === 'high' && profile?.caregiver_phone) {
      try {
        await supabaseClient.functions.invoke('send-appointment-reminder', {
          body: {
            phone: profile.caregiver_phone,
            message: `WellFit ALERT: ${userName} - ${alert_type}. ${description}. Please check immediately.`
          }
        })
      } catch (smsError) {
        console.error('SMS send error:', smsError)
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
    console.error('Send team alert error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
