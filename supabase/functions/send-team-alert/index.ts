import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { requireUser, requireRole, supabaseAdmin } from "../_shared/auth.ts";
import { createLogger } from '../_shared/auditLogger.ts'

/** Roles authorized to send team alerts */
const ALERT_ALLOWED_ROLES = ['admin', 'super_admin', 'physician', 'nurse', 'case_manager'];

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
    // 1. Require authenticated user (JWT verification)
    let user;
    try {
      user = await requireUser(req);
    } catch (authResponse: unknown) {
      if (authResponse instanceof Response) return authResponse;
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Require clinical/admin role
    try {
      await requireRole(user.id, ALERT_ALLOWED_ROLES);
    } catch (roleResponse: unknown) {
      if (roleResponse instanceof Response) return roleResponse;
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse and validate input
    const { alert_type, description, user_id, priority = 'medium' } = await req.json() as TeamAlertRequest

    if (!alert_type || !description || !user_id) {
      logger.warn('Missing required fields in team alert request', { alert_type, description, user_id });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: alert_type, description, user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Tenant isolation — caller can only alert users in their own tenant
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    const callerTenantId = callerProfile?.tenant_id;

    if (callerTenantId) {
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user_id)
        .single();

      if (targetProfile?.tenant_id !== callerTenantId) {
        logger.security('Cross-tenant alert attempt blocked', {
          caller: user.id,
          target: user_id,
          callerTenant: callerTenantId,
          targetTenant: targetProfile?.tenant_id,
        });
        return new Response(
          JSON.stringify({ error: 'Cannot send alerts to users outside your organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    logger.security('Team alert initiated', {
      caller: user.id,
      alert_type,
      user_id,
      priority,
      tenant_id: callerTenantId,
    });

    // Get target user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, caregiver_email, caregiver_phone')
      .eq('user_id', user_id)
      .single()

    if (profileError) {
      logger.error('Profile fetch error', { user_id, error: profileError.message })
    }

    const userName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown User'
      : 'Unknown User'

    // Log the alert to alerts table
    const { error: alertError } = await supabaseAdmin
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

    const emailSubject = `WellFit Alert: ${userName} - ${alert_type}`
    const emailBody = `
Alert Type: ${alert_type}
User: ${userName}
Priority: ${priority}
Description: ${description}
Timestamp: ${new Date().toISOString()}

Please check on this user as soon as possible.
`

    // Send emails to all recipients using admin client (has service role for invoke)
    logger.info('Sending team alert emails', { recipients, userName });
    for (const recipient of recipients) {
      try {
        await supabaseAdmin.functions.invoke('send-email', {
          body: {
            to: recipient,
            subject: emailSubject,
            text: emailBody,
            html: emailBody.replace(/\n/g, '<br>')
          }
        })
        logger.info('Team alert email sent successfully', { recipient });
      } catch (emailError: unknown) {
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        logger.error('Failed to send team alert email', {
          recipient,
          error: errorMessage
        })
      }
    }

    // Send push notification for all alerts (especially high priority)
    logger.info('Sending push notification for team alert', { priority });
    try {
      await supabaseAdmin.functions.invoke('send-push-notification', {
        body: {
          title: `WellFit Alert: ${userName}`,
          body: `${alert_type} - ${description}`,
          priority: priority === 'high' ? 'high' : 'normal',
          data: {
            type: 'team_alert',
            user_id,
            alert_type,
            priority
          }
        }
      });
      logger.info('Push notification sent successfully');
    } catch (pushError: unknown) {
      const errMsg = pushError instanceof Error ? pushError.message : String(pushError);
      logger.error('Failed to send push notification', { error: errMsg });
    }

    // Send SMS to caregiver if high priority
    if (priority === 'high' && profile?.caregiver_phone) {
      logger.info('Sending high priority SMS alert', {
        caregiverPhone: profile.caregiver_phone
      });
      try {
        await supabaseAdmin.functions.invoke('send-appointment-reminder', {
          body: {
            phone: profile.caregiver_phone,
            message: `WellFit ALERT: ${userName} - ${alert_type}. ${description}. Please check immediately.`
          }
        })
        logger.info('High priority SMS sent successfully');
      } catch (smsError: unknown) {
        const errorMessage = smsError instanceof Error ? smsError.message : String(smsError);
        logger.error('SMS send error', {
          error: errorMessage
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

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Send team alert error', { error: errorMessage })
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
