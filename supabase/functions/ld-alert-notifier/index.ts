/**
 * L&D Alert Notifier Edge Function
 *
 * Purpose: Send notifications for critical L&D alerts (SMS, email, push)
 * Triggered when a critical/high severity alert is persisted in ld_alerts
 * Notifies: care team members, on-call providers, patient's caregiver
 */

import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/auditLogger.ts";

interface LDAlertNotifyRequest {
  alert_id: string;
  patient_id: string;
  tenant_id: string;
  alert_type: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
}

interface CareTeamMember {
  provider_id: string;
  role: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

serve(async (req) => {
  const logger = createLogger("ld-alert-notifier", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Service role client — bypasses RLS for care team lookups
    const supabaseAdmin = createClient(
      SUPABASE_URL ?? "",
      SB_SECRET_KEY ?? "",
      { auth: { persistSession: false } }
    );

    const body = (await req.json()) as LDAlertNotifyRequest;
    const { alert_id, patient_id, tenant_id, alert_type, severity, message } =
      body;

    if (!alert_id || !patient_id || !tenant_id || !alert_type || !severity) {
      logger.warn("Missing required fields", { alert_id, patient_id });
      return new Response(
        JSON.stringify({
          error:
            "Missing required fields: alert_id, patient_id, tenant_id, alert_type, severity",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Only notify for critical and high severity alerts
    if (severity !== "critical" && severity !== "high") {
      logger.info("Skipping notification for non-critical alert", {
        alert_id,
        severity,
      });
      return new Response(
        JSON.stringify({
          success: true,
          message: "No notification needed for this severity level",
          notifications_sent: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    logger.security("L&D critical alert notification initiated", {
      alert_id,
      patient_id,
      alert_type,
      severity,
    });

    // Fetch patient profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, caregiver_email, caregiver_phone")
      .eq("id", patient_id)
      .single();

    const patientName = profile
      ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
        "Patient"
      : "Patient";

    // Fetch care team members for this patient
    const careTeamMembers: CareTeamMember[] = [];
    const { data: careTeam } = await supabaseAdmin
      .from("care_team_members")
      .select("provider_id, role")
      .eq("patient_id", patient_id)
      .eq("tenant_id", tenant_id)
      .eq("is_active", true);

    if (careTeam && careTeam.length > 0) {
      const providerIds = careTeam.map(
        (m: { provider_id: string }) => m.provider_id
      );
      const { data: providers } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, email, phone")
        .in("id", providerIds);

      if (providers) {
        for (const provider of providers) {
          const member = careTeam.find(
            (m: { provider_id: string }) => m.provider_id === provider.id
          );
          careTeamMembers.push({
            provider_id: provider.id as string,
            role: (member?.role as string) ?? "provider",
            first_name: (provider.first_name as string) ?? "",
            last_name: (provider.last_name as string) ?? "",
            email: (provider.email as string) ?? null,
            phone: (provider.phone as string) ?? null,
          });
        }
      }
    }

    let notificationsSent = 0;
    const severityLabel = severity === "critical" ? "CRITICAL" : "HIGH";
    const alertSubject = `L&D ${severityLabel} Alert: ${patientName} - ${alert_type.replace(/_/g, " ")}`;
    const alertBody = `${severityLabel} L&D Alert\nPatient: ${patientName}\nAlert: ${alert_type.replace(/_/g, " ")}\nDetails: ${message}\nTime: ${new Date().toISOString()}\n\nImmediate attention required.`;

    // Send email to care team members
    for (const member of careTeamMembers) {
      if (member.email) {
        try {
          await supabaseAdmin.functions.invoke("send_email", {
            body: {
              to: member.email,
              subject: alertSubject,
              text: alertBody,
              html: alertBody.replace(/\n/g, "<br>"),
            },
          });
          notificationsSent++;
          logger.info("L&D alert email sent to care team member", {
            provider_id: member.provider_id,
            role: member.role,
          });
        } catch (emailErr: unknown) {
          const errMsg =
            emailErr instanceof Error ? emailErr.message : String(emailErr);
          logger.error("Failed to send L&D alert email", {
            provider_id: member.provider_id,
            error: errMsg,
          });
        }
      }
    }

    // Send SMS to care team for critical alerts
    if (severity === "critical") {
      for (const member of careTeamMembers) {
        if (member.phone) {
          try {
            await supabaseAdmin.functions.invoke("send-sms", {
              body: {
                phone: member.phone,
                message: `L&D CRITICAL: ${patientName} - ${alert_type.replace(/_/g, " ")}. ${message}. Immediate response required.`,
              },
            });
            notificationsSent++;
            logger.info("L&D alert SMS sent to care team member", {
              provider_id: member.provider_id,
            });
          } catch (smsErr: unknown) {
            const errMsg =
              smsErr instanceof Error ? smsErr.message : String(smsErr);
            logger.error("Failed to send L&D alert SMS", {
              provider_id: member.provider_id,
              error: errMsg,
            });
          }
        }
      }
    }

    // Notify caregiver for critical alerts
    if (severity === "critical" && profile?.caregiver_phone) {
      try {
        await supabaseAdmin.functions.invoke("send-sms", {
          body: {
            phone: profile.caregiver_phone,
            message: `L&D Alert: ${patientName} requires immediate medical attention. Contact the care team.`,
          },
        });
        notificationsSent++;
        logger.info("L&D alert SMS sent to caregiver");
      } catch (smsErr: unknown) {
        const errMsg =
          smsErr instanceof Error ? smsErr.message : String(smsErr);
        logger.error("Failed to send caregiver SMS", { error: errMsg });
      }
    }

    // Send push notification for all high/critical alerts
    try {
      await supabaseAdmin.functions.invoke("send-push-notification", {
        body: {
          title: alertSubject,
          body: message,
          priority: severity === "critical" ? "high" : "normal",
          data: {
            type: "ld_alert",
            alert_id,
            patient_id,
            alert_type,
            severity,
          },
        },
      });
      notificationsSent++;
      logger.info("L&D push notification sent");
    } catch (pushErr: unknown) {
      const errMsg =
        pushErr instanceof Error ? pushErr.message : String(pushErr);
      logger.error("Failed to send push notification", { error: errMsg });
    }

    // Log to audit_logs for HIPAA compliance
    await supabaseAdmin.from("audit_logs").insert({
      user_id: patient_id,
      action: "LD_ALERT_NOTIFICATION_SENT",
      details: JSON.stringify({
        alert_id,
        alert_type,
        severity,
        notifications_sent: notificationsSent,
        care_team_size: careTeamMembers.length,
      }),
      ip_address: req.headers.get("x-forwarded-for") ?? "edge-function",
    });

    logger.info("L&D alert notification complete", {
      alert_id,
      notificationsSent,
    });

    return new Response(
      JSON.stringify({
        success: true,
        alert_id,
        notifications_sent: notificationsSent,
        care_team_notified: careTeamMembers.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("L&D alert notifier error", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
