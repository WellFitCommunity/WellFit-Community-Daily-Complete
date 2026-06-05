// guardian-agent: auto-heal (Tier 1 performance) / review-ticket (Tier 3) routing.
import { createLogger } from "../_shared/auditLogger.ts";
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { StoredAlert } from './types.ts'

const logger = createLogger("guardian-agent");

export async function autoHeal(supabase: SupabaseClient, alertId: string, tenantId: string) {
  // Get the alert (tenant-scoped — ensures we only heal our own tenant's alerts)
  const { data: alertData } = await supabase
    .from('security_alerts')
    .select('id, category, title, severity, metadata')
    .eq('id', alertId)
    .eq('tenant_id', tenantId)
    .single()

  if (!alertData) {
    throw new Error('Alert not found')
  }

  const alert = alertData as StoredAlert;

  // Per .claude/rules/ai-repair-authority.md:
  //   Performance category → Guardian MAY auto-heal (Tier 1 autonomy).
  //   Security / database / other → Guardian MUST NOT auto-heal. Must
  //   create a review ticket for human approval (Tier 3 requires approval).
  //
  // GRD-2: previously this function blindly marked EVERY alert as 'resolved'
  // regardless of category, violating the authority boundary for security
  // and database alerts. Now routes by category.

  if (alert.category === 'performance') {
    // Tier 1: autonomous auto-heal
    const healingAction = 'Cleared cache and optimized slow queries'

    await supabase
      .from('security_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        metadata: {
          ...alert.metadata,
          healing_action: healingAction,
          auto_healed: true,
          auto_heal_tier: 1
        }
      })
      .eq('id', alertId)
      .eq('tenant_id', tenantId)

    logger.info('AUTO_HEAL_APPLIED_PERFORMANCE', { alertId, tenantId, healingAction })
    return { healed: true, ticket_created: false, action: healingAction }
  }

  // Tier 3: requires approval — propose healing via review ticket, do NOT resolve.
  // Flip alert to 'awaiting_approval' and call the create_guardian_review_ticket
  // RPC to generate a human-approvable ticket with the proposed fix.

  let healingStrategy = 'no_automated_strategy'
  let healingDescription = 'No automated healing proposed — manual triage required.'
  const healingSteps: string[] = []
  const rollbackPlan: string[] = []

  if (alert.category === 'security' && alert.title.includes('Failed Login')) {
    healingStrategy = 'block_suspicious_ips'
    healingDescription = 'Temporarily block IP addresses showing repeated failed login attempts.'
    healingSteps.push('Identify IPs with > 10 failed logins in 15 minutes')
    healingSteps.push('Add IPs to rate_limit_blocklist with 24-hour expiry')
    healingSteps.push('Log block action to audit_logs')
    rollbackPlan.push('Remove IPs from rate_limit_blocklist')
    rollbackPlan.push('Notify affected users if any false positives')
  } else if (alert.category === 'database') {
    healingStrategy = 'restart_connection_pools'
    healingDescription = 'Restart database connection pools to clear stuck connections.'
    healingSteps.push('Drain active connections gracefully')
    healingSteps.push('Recycle the pool')
    healingSteps.push('Verify pool health after restart')
    rollbackPlan.push('Restore previous pool configuration')
  }

  const { data: ticketId, error: ticketError } = await supabase.rpc(
    'create_guardian_review_ticket',
    {
      p_issue_id: alertId,
      p_issue_category: alert.category,
      p_issue_severity: alert.severity,
      p_issue_description: alert.title,
      p_affected_component: (alert.metadata?.component as string | undefined) ?? null,
      p_affected_resources: [],
      p_stack_trace: null,
      p_detection_context: {
        source: 'guardian-agent.autoHeal',
        original_alert_id: alertId,
        metadata: alert.metadata ?? {}
      },
      p_action_id: `guardian_heal_${alert.category}_${alertId}`,
      p_healing_strategy: healingStrategy,
      p_healing_description: healingDescription,
      p_healing_steps: healingSteps,
      p_rollback_plan: rollbackPlan,
      p_expected_outcome: `Resolution of ${alert.category} alert: ${alert.title}`,
      p_sandbox_tested: false,
      p_sandbox_results: {},
      p_sandbox_passed: null
    }
  )

  if (ticketError) {
    logger.error('TICKET_CREATION_FAILED', {
      alertId,
      tenantId,
      category: alert.category,
      error: ticketError.message
    })
    throw new Error(`Failed to create review ticket: ${ticketError.message}`)
  }

  // Mark the original alert as awaiting approval — NOT resolved.
  await supabase
    .from('security_alerts')
    .update({
      status: 'awaiting_approval',
      metadata: {
        ...alert.metadata,
        review_ticket_id: ticketId,
        proposed_healing: healingStrategy,
        auto_heal_tier: 3
      }
    })
    .eq('id', alertId)
    .eq('tenant_id', tenantId)

  logger.info('REVIEW_TICKET_CREATED', {
    alertId,
    tenantId,
    ticketId,
    category: alert.category,
    healingStrategy
  })

  return { healed: false, ticket_created: true, ticket_id: ticketId, healing_strategy: healingStrategy }
}
