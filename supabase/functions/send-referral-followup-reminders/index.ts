// supabase/functions/send-referral-followup-reminders/index.ts
// Cron-scheduled edge function: graduated follow-up for aging referrals.
//
// Day 3:  SMS to patient — gentle enrollment reminder
// Day 7:  SMS to patient + email to referral source contact
// Day 14: Creates provider_task (type: referral_response, priority: urgent)
//
// Pattern: send-consecutive-missed-alerts (cooldown, graduated severity, audit log)

import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import {
  createLogger,
  getChicagoTime,
  isWithinWindowChicago,
  validateEnvVars,
} from "../shared/types.ts";

// --- Config ---
const RUN_HOUR_CT = 11; // 11:00–11:05 AM CT (offset from missed-alert at 10 AM)
const DAY_3_THRESHOLD = 3;
const DAY_7_THRESHOLD = 7;
const DAY_14_THRESHOLD = 14;

// --- Setup ---
const logger = createLogger("send-referral-followup-reminders");
validateEnvVars(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

const supabase = createClient(SUPABASE_URL!, SB_SECRET_KEY!);

// --- Types ---
interface AgingReferral {
  referral_id: string;
  referral_source_id: string | null;
  source_org_name: string | null;
  patient_phone: string | null;
  patient_email: string | null;
  patient_first_name: string | null;
  patient_last_name: string | null;
  referral_status: string;
  aging_days: number;
  last_follow_up_at: string | null;
  follow_up_count: number;
  tenant_id: string;
}

interface FollowUpResult {
  referralId: string;
  followUpType: string;
  agingDays: number;
  success: boolean;
  error?: string;
}

// --- Helpers ---

async function logFollowUp(
  referralId: string,
  referralSourceId: string | null,
  followUpType: string,
  followUpReason: string,
  agingDays: number,
  tenantId: string,
  deliveryStatus: string,
  recipientPhone?: string | null,
  recipientEmail?: string | null,
  errorMessage?: string
): Promise<void> {
  const { error } = await supabase.from("referral_follow_up_log").insert({
    referral_id: referralId,
    referral_source_id: referralSourceId,
    follow_up_type: followUpType,
    follow_up_reason: followUpReason,
    aging_days: agingDays,
    recipient_phone: recipientPhone ?? null,
    recipient_email: recipientEmail ?? null,
    delivery_status: deliveryStatus,
    error_message: errorMessage ?? null,
    tenant_id: tenantId,
  });

  if (error) {
    logger.error("Failed to log follow-up", {
      referralId,
      followUpType,
      error: error.message,
    });
  }
}

function getFollowUpReason(status: string): string {
  switch (status) {
    case "pending":
      return "pending_no_response";
    case "invited":
      return "pending_no_response";
    case "enrolled":
      return "enrolled_no_activity";
    default:
      return "pending_no_response";
  }
}

function buildDay3SMS(firstName: string | null): string {
  const name = firstName || "there";
  return `Hi ${name}! You were referred to WellFit Community for wellness support. It only takes 2 minutes to get started. Reply STOP to opt out.`;
}

function buildDay7SMS(firstName: string | null, orgName: string | null): string {
  const name = firstName || "there";
  const org = orgName || "your healthcare provider";
  return `Hi ${name}, ${org} referred you to WellFit because they care about your wellness. Your daily check-in takes just 2 minutes. Need help? Reply HELP. Reply STOP to opt out.`;
}

// --- Day 3: SMS to patient ---
async function sendDay3Reminder(referral: AgingReferral): Promise<FollowUpResult> {
  const result: FollowUpResult = {
    referralId: referral.referral_id,
    followUpType: "sms",
    agingDays: referral.aging_days,
    success: false,
  };

  try {
    if (!referral.patient_phone) {
      result.error = "No phone number";
      await logFollowUp(
        referral.referral_id, referral.referral_source_id,
        "sms", getFollowUpReason(referral.referral_status),
        referral.aging_days, referral.tenant_id,
        "failed", null, null, "No phone number"
      );
      return result;
    }

    const message = buildDay3SMS(referral.patient_first_name);

    const { error: smsError } = await supabase.functions.invoke("send-sms", {
      body: {
        to: [referral.patient_phone],
        message,
        priority: "normal",
      },
    });

    if (smsError) throw new Error(`SMS send failed: ${smsError.message}`);

    logger.info("Day 3 SMS sent", { referralId: referral.referral_id });
    result.success = true;
    await logFollowUp(
      referral.referral_id, referral.referral_source_id,
      "sms", getFollowUpReason(referral.referral_status),
      referral.aging_days, referral.tenant_id,
      "sent", referral.patient_phone
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    result.error = errorMessage.slice(0, 500);
    logger.error("Day 3 SMS failed", { referralId: referral.referral_id, error: result.error });
    await logFollowUp(
      referral.referral_id, referral.referral_source_id,
      "sms", getFollowUpReason(referral.referral_status),
      referral.aging_days, referral.tenant_id,
      "failed", referral.patient_phone, null, result.error
    );
  }

  return result;
}

// --- Day 7: SMS to patient + email to referral source ---
async function sendDay7Reminders(referral: AgingReferral): Promise<FollowUpResult[]> {
  const results: FollowUpResult[] = [];

  // SMS to patient
  if (referral.patient_phone) {
    const smsResult: FollowUpResult = {
      referralId: referral.referral_id,
      followUpType: "sms",
      agingDays: referral.aging_days,
      success: false,
    };

    try {
      const message = buildDay7SMS(referral.patient_first_name, referral.source_org_name);
      const { error: smsError } = await supabase.functions.invoke("send-sms", {
        body: { to: [referral.patient_phone], message, priority: "normal" },
      });

      if (smsError) throw new Error(`SMS send failed: ${smsError.message}`);

      smsResult.success = true;
      await logFollowUp(
        referral.referral_id, referral.referral_source_id,
        "sms", getFollowUpReason(referral.referral_status),
        referral.aging_days, referral.tenant_id,
        "sent", referral.patient_phone
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      smsResult.error = errorMessage.slice(0, 500);
      await logFollowUp(
        referral.referral_id, referral.referral_source_id,
        "sms", getFollowUpReason(referral.referral_status),
        referral.aging_days, referral.tenant_id,
        "failed", referral.patient_phone, null, smsResult.error
      );
    }
    results.push(smsResult);
  }

  // Email to referral source contact
  if (referral.referral_source_id) {
    const emailResult: FollowUpResult = {
      referralId: referral.referral_id,
      followUpType: "email",
      agingDays: referral.aging_days,
      success: false,
    };

    try {
      // Fetch source contact email
      const { data: source } = await supabase
        .from("external_referral_sources")
        .select("primary_contact_email, organization_name")
        .eq("id", referral.referral_source_id)
        .single();

      const contactEmail = source?.primary_contact_email;
      if (!contactEmail) {
        emailResult.error = "No source contact email";
        await logFollowUp(
          referral.referral_id, referral.referral_source_id,
          "email", getFollowUpReason(referral.referral_status),
          referral.aging_days, referral.tenant_id,
          "failed", null, null, "No source contact email"
        );
        results.push(emailResult);
        return results;
      }

      const patientName = [referral.patient_first_name, referral.patient_last_name]
        .filter(Boolean)
        .join(" ") || "Patient";

      const { error: emailError } = await supabase.functions.invoke("send-email", {
        body: {
          to: [{ email: contactEmail, name: source?.organization_name || "Referral Source" }],
          subject: `Referral Follow-Up: ${patientName} — ${referral.aging_days} days pending`,
          html: `<p>This is a follow-up regarding the referral for <strong>${patientName}</strong> sent ${referral.aging_days} days ago.</p>
<p>Current status: <strong>${referral.referral_status}</strong></p>
<p>The patient has not yet completed enrollment. Please reach out if you need assistance.</p>
<p>— WellFit Community</p>`,
          priority: "normal",
        },
      });

      if (emailError) throw new Error(`Email send failed: ${emailError.message}`);

      emailResult.success = true;
      await logFollowUp(
        referral.referral_id, referral.referral_source_id,
        "email", getFollowUpReason(referral.referral_status),
        referral.aging_days, referral.tenant_id,
        "sent", null, contactEmail
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      emailResult.error = errorMessage.slice(0, 500);
      await logFollowUp(
        referral.referral_id, referral.referral_source_id,
        "email", getFollowUpReason(referral.referral_status),
        referral.aging_days, referral.tenant_id,
        "failed", null, null, emailResult.error
      );
    }
    results.push(emailResult);
  }

  return results;
}

// --- Day 14: Create provider_task escalation ---
async function createDay14Escalation(referral: AgingReferral): Promise<FollowUpResult> {
  const result: FollowUpResult = {
    referralId: referral.referral_id,
    followUpType: "provider_task",
    agingDays: referral.aging_days,
    success: false,
  };

  try {
    const patientName = [referral.patient_first_name, referral.patient_last_name]
      .filter(Boolean)
      .join(" ") || "Unknown Patient";

    const { error: taskError } = await supabase.from("provider_tasks").insert({
      task_type: "referral_response",
      priority: "urgent",
      title: `Referral follow-up: ${patientName} — ${referral.aging_days} days aging`,
      description: `Referral from ${referral.source_org_name || "Unknown"} has been ${referral.referral_status} for ${referral.aging_days} days. Patient has not completed enrollment despite ${referral.follow_up_count} follow-up attempts. Manual intervention required.`,
      patient_id: null,
      source_type: "system",
      tenant_id: referral.tenant_id,
      metadata: {
        referral_id: referral.referral_id,
        referral_source_id: referral.referral_source_id,
        aging_days: referral.aging_days,
        follow_up_count: referral.follow_up_count,
        escalation_reason: "14_day_aging_threshold",
      },
    });

    if (taskError) throw new Error(`Task creation failed: ${taskError.message}`);

    logger.info("Day 14 escalation created", { referralId: referral.referral_id });
    result.success = true;
    await logFollowUp(
      referral.referral_id, referral.referral_source_id,
      "escalation", getFollowUpReason(referral.referral_status),
      referral.aging_days, referral.tenant_id,
      "sent"
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    result.error = errorMessage.slice(0, 500);
    logger.error("Day 14 escalation failed", { referralId: referral.referral_id, error: result.error });
    await logFollowUp(
      referral.referral_id, referral.referral_source_id,
      "escalation", getFollowUpReason(referral.referral_status),
      referral.aging_days, referral.tenant_id,
      "failed", null, null, result.error
    );
  }

  return result;
}

// --- Process all aging referrals ---
async function processReferrals(referrals: AgingReferral[]): Promise<FollowUpResult[]> {
  const results: FollowUpResult[] = [];

  for (const referral of referrals) {
    const days = referral.aging_days;

    if (days >= DAY_14_THRESHOLD) {
      const escalationResult = await createDay14Escalation(referral);
      results.push(escalationResult);
    } else if (days >= DAY_7_THRESHOLD) {
      const day7Results = await sendDay7Reminders(referral);
      results.push(...day7Results);
    } else if (days >= DAY_3_THRESHOLD) {
      const smsResult = await sendDay3Reminder(referral);
      results.push(smsResult);
    }
  }

  return results;
}

// --- Main Handler ---
serve(async (req) => {
  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method === "OPTIONS") return handleOptions(req);

  try {
    logger.info("Function invoked", { chicagoTime: getChicagoTime().toISOString() });

    // Time-gate: run once per day at 11 AM CT
    if (!isWithinWindowChicago(RUN_HOUR_CT, 5)) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Outside scheduled time window",
          chicagoTime: getChicagoTime().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch aging referrals via RPC
    const { data: referrals, error: rpcError } = await supabase.rpc("get_aging_referrals");

    if (rpcError) {
      throw new Error(`RPC get_aging_referrals failed: ${rpcError.message}`);
    }

    if (!referrals || referrals.length === 0) {
      logger.info("No aging referrals found");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No referrals need follow-up",
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info("Found aging referrals", { count: referrals.length });

    // Process all referrals
    const results = await processReferrals(referrals as AgingReferral[]);

    // Summarize
    const summary = {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      byType: {
        sms: results.filter((r) => r.followUpType === "sms" && r.success).length,
        email: results.filter((r) => r.followUpType === "email" && r.success).length,
        escalation: results.filter((r) => r.followUpType === "provider_task" && r.success).length,
      },
    };

    logger.info("Referral follow-up processing complete", summary);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Referral follow-up reminders processed",
        summary,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Function error", { message: errorMessage.slice(0, 500) });
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
