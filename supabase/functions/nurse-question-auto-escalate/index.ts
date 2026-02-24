// supabase/functions/nurse-question-auto-escalate/index.ts
// Auto-escalates stale nurse questions on a cron schedule:
// - Unclaimed questions >2hrs → escalate to charge_nurse
// - Claimed but unanswered >4hrs → escalate to supervisor
// Runs every 15 minutes via Supabase cron. Includes cooldown to prevent duplicates.

import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

// --- Config ---
const UNCLAIMED_THRESHOLD_HOURS = 2;
const UNANSWERED_THRESHOLD_HOURS = 4;
const ESCALATION_COOLDOWN_HOURS = 4; // Don't re-escalate within 4 hours

// --- Types ---
interface StaleQuestion {
  id: string;
  user_id: string;
  status: string;
  urgency: string;
  assigned_nurse_id: string | null;
  tenant_id: string;
  created_at: string;
  claimed_at: string | null;
  escalation_level: string | null;
}

interface EscalationResult {
  questionId: string;
  previousStatus: string;
  newLevel: string;
  success: boolean;
  reason?: string;
}

// --- Main Handler ---
serve(async (req) => {
  const logger = createLogger("nurse-question-auto-escalate", req);
  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method === "OPTIONS") return handleOptions(req);

  try {
    logger.info("Auto-escalation function invoked");

    if (!SUPABASE_URL || !SB_SECRET_KEY) {
      logger.error("Missing Supabase credentials");
      return new Response(
        JSON.stringify({ success: false, error: "Missing credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);
    const now = new Date();

    // --- Step 1: Find unclaimed questions older than 2 hours ---
    const unclaimedCutoff = new Date(
      now.getTime() - UNCLAIMED_THRESHOLD_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { data: unclaimedQuestions, error: unclaimedError } = await supabase
      .from("user_questions")
      .select("id, user_id, status, urgency, assigned_nurse_id, tenant_id, created_at, claimed_at, escalation_level")
      .eq("status", "pending")
      .is("assigned_nurse_id", null)
      .is("escalation_level", null)
      .lt("created_at", unclaimedCutoff);

    if (unclaimedError) {
      logger.error("Failed to fetch unclaimed questions", { error: unclaimedError.message });
      return new Response(
        JSON.stringify({ success: false, error: unclaimedError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Step 2: Find claimed-but-unanswered questions older than 4 hours ---
    const unansweredCutoff = new Date(
      now.getTime() - UNANSWERED_THRESHOLD_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { data: unansweredQuestions, error: unansweredError } = await supabase
      .from("user_questions")
      .select("id, user_id, status, urgency, assigned_nurse_id, tenant_id, created_at, claimed_at, escalation_level")
      .eq("status", "claimed")
      .not("assigned_nurse_id", "is", null)
      .lt("claimed_at", unansweredCutoff)
      .or("escalation_level.is.null,escalation_level.neq.supervisor");

    if (unansweredError) {
      logger.error("Failed to fetch unanswered questions", { error: unansweredError.message });
      return new Response(
        JSON.stringify({ success: false, error: unansweredError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const staleUnclaimed = (unclaimedQuestions || []) as StaleQuestion[];
    const staleUnanswered = (unansweredQuestions || []) as StaleQuestion[];

    logger.info("Stale questions found", {
      unclaimed: staleUnclaimed.length,
      unanswered: staleUnanswered.length,
    });

    if (staleUnclaimed.length === 0 && staleUnanswered.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No stale questions found",
          escalated: 0,
          timestamp: now.toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: EscalationResult[] = [];

    // --- Step 3: Escalate unclaimed questions to charge_nurse ---
    for (const q of staleUnclaimed) {
      const result = await escalateQuestion(
        supabase,
        logger,
        q,
        "charge_nurse",
        `Auto-escalated: unclaimed for >${UNCLAIMED_THRESHOLD_HOURS} hours`
      );
      results.push(result);
    }

    // --- Step 4: Escalate unanswered questions to supervisor ---
    for (const q of staleUnanswered) {
      // Skip if already escalated to supervisor or physician within cooldown
      if (q.escalation_level === "supervisor" || q.escalation_level === "physician") {
        results.push({
          questionId: q.id,
          previousStatus: q.status,
          newLevel: q.escalation_level,
          success: true,
          reason: "Already escalated to equal or higher level",
        });
        continue;
      }

      const result = await escalateQuestion(
        supabase,
        logger,
        q,
        "supervisor",
        `Auto-escalated: claimed but unanswered for >${UNANSWERED_THRESHOLD_HOURS} hours`
      );
      results.push(result);
    }

    // --- Step 5: Summarize ---
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logger.info("Auto-escalation complete", {
      total: results.length,
      successful,
      failed,
      toChargeNurse: results.filter((r) => r.newLevel === "charge_nurse" && r.success).length,
      toSupervisor: results.filter((r) => r.newLevel === "supervisor" && r.success).length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Auto-escalation processed",
        summary: { total: results.length, successful, failed },
        results,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Auto-escalation function error", { error: errorMessage.slice(0, 500) });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// --- Helper: Escalate a single question ---
async function escalateQuestion(
  supabase: ReturnType<typeof createClient>,
  logger: ReturnType<typeof createLogger>,
  question: StaleQuestion,
  level: string,
  reason: string
): Promise<EscalationResult> {
  const result: EscalationResult = {
    questionId: question.id,
    previousStatus: question.status,
    newLevel: level,
    success: false,
  };

  try {
    // Check cooldown — don't re-escalate if recently escalated
    const cooldownCutoff = new Date(
      Date.now() - ESCALATION_COOLDOWN_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { data: recentNote } = await supabase
      .from("nurse_question_notes")
      .select("id")
      .eq("question_id", question.id)
      .like("note_text", "ESCALATED to%")
      .gte("created_at", cooldownCutoff)
      .limit(1)
      .maybeSingle();

    if (recentNote) {
      result.success = true;
      result.reason = "Cooldown active — recently escalated";
      logger.info("Skipping escalation (cooldown)", { questionId: question.id, level });
      return result;
    }

    // Update the question
    const { error: updateError } = await supabase
      .from("user_questions")
      .update({
        status: "escalated",
        escalation_level: level,
        escalated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", question.id);

    if (updateError) {
      result.reason = updateError.message;
      logger.error("Failed to escalate question", {
        questionId: question.id,
        level,
        error: updateError.message,
      });
      return result;
    }

    // Log escalation as a nurse note (system-generated)
    const { error: noteError } = await supabase
      .from("nurse_question_notes")
      .insert({
        question_id: question.id,
        nurse_id: question.assigned_nurse_id || question.user_id,
        note_text: `ESCALATED to ${level}: ${reason}`,
        tenant_id: question.tenant_id,
      });

    if (noteError) {
      // Non-fatal — question was already escalated
      logger.warn("Failed to log escalation note", {
        questionId: question.id,
        error: noteError.message,
      });
    }

    // Insert audit log entry
    const { error: auditError } = await supabase
      .from("audit_logs")
      .insert({
        action: "NURSE_QUESTION_AUTO_ESCALATED",
        details: {
          question_id: question.id,
          previous_status: question.status,
          new_level: level,
          reason,
          urgency: question.urgency,
          hours_stale: question.status === "pending"
            ? hoursAgo(question.created_at)
            : hoursAgo(question.claimed_at || question.created_at),
        },
        tenant_id: question.tenant_id,
      });

    if (auditError) {
      logger.warn("Failed to write audit log", { error: auditError.message });
    }

    result.success = true;
    logger.info("Question auto-escalated", {
      questionId: question.id,
      level,
      urgency: question.urgency,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    result.reason = errorMessage.slice(0, 500);
    logger.error("Escalation error", {
      questionId: question.id,
      level,
      error: result.reason,
    });
  }

  return result;
}

// --- Utility ---
function hoursAgo(isoDate: string): number {
  return Math.round((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60) * 10) / 10;
}
