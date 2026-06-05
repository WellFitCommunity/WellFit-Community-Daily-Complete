// guardian-agent: admin email notifications for critical/high alerts.
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { SecurityAlert } from './types.ts'

const logger = createLogger("guardian-agent");

// Send email notification for critical alerts
export async function sendAlertEmail(_supabase: SupabaseClient, alerts: SecurityAlert[]) {
  try {
    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'admin@wellfitcommunity.org';
    // A-5 fix: Use imported SUPABASE_URL and SB_SECRET_KEY directly — no shadowing
    const serviceRoleKey = SB_SECRET_KEY;

    if (!SUPABASE_URL || !serviceRoleKey) {
      logger.error("Cannot send email: Missing Supabase credentials", {});
      return;
    }

    // Escape any HTML-significant characters before interpolation. alert.title,
    // alert.message, alert.category, and alert.severity can carry values derived
    // from monitoring data (error_type strings, query metadata, etc.), so they
    // must never be inlined into the email body raw.
    const escapeHtml = (s: string): string =>
      s.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#39;');

    const alertSummary = alerts.map(alert =>
      `🚨 ${escapeHtml(alert.severity.toUpperCase())}: ${escapeHtml(alert.title)}<br>` +
      `   ${escapeHtml(alert.message)}<br>` +
      `   Category: ${escapeHtml(alert.category)}`
    ).join('<br><br>');

    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const highCount = alerts.filter(a => a.severity === 'high').length;

    const emailBody =
      `Guardian Alert System - ${criticalCount} Critical, ${highCount} High Priority Alerts<br><br>` +
      `${alertSummary}<br><br>` +
      `---<br>` +
      `Detected at: ${new Date().toISOString()}<br>` +
      `View full details in your Guardian Security Panel<br><br>` +
      `This is an automated alert from Guardian monitoring system.`;

    // Call send-email function (using service role key as Bearer — recognized by A-2 auth fix)
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        to: [{ email: adminEmail, name: 'System Admin' }],
        subject: `Guardian Alert: ${criticalCount + highCount} Critical/High Issues Detected`,
        html: emailBody
      })
    });

    if (!response.ok) {
      const responseText = await response.text();
      logger.error("Email send failed", { responseText });
    } else {
      logger.info("Alert email sent", { recipient: adminEmail });
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Email notification error", { message: errorMessage });
    // Don't throw - email failure shouldn't break monitoring
  }
}
