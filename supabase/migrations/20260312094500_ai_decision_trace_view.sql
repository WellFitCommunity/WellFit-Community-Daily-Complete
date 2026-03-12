-- Migration: v_ai_decision_trace view
-- Purpose: Auditor-facing view that shows full decision chains with ordered links
-- Spec: docs/compliance/AI_DECISION_AUDIT_CHAIN.md (Section 6)
-- Tracker: docs/trackers/chatgpt-audit-gaps-tracker.md (S2-4)

-- View: Full decision chain trace with all links ordered by creation time
-- Auditors can filter by chain_id, decision_type, skill_key, or date range
CREATE OR REPLACE VIEW public.v_ai_decision_trace
WITH (security_invoker = on) AS
SELECT
  dc.id,
  dc.chain_id,
  dc.parent_decision_id,
  dc.tenant_id,
  dc.trigger_type,
  dc.trigger_source,
  dc.model_id,
  dc.skill_key,
  dc.decision_type,
  dc.decision_summary,
  dc.confidence_score,
  dc.authority_tier,
  dc.action_taken,
  dc.outcome,
  dc.human_override,
  dc.override_reason,
  dc.reviewed_by,
  dc.reviewed_at,
  dc.created_at,
  -- Reviewer name (joined from profiles)
  p.first_name || ' ' || p.last_name AS reviewer_name,
  -- Chain position: 1 = root decision, 2+ = follow-up
  ROW_NUMBER() OVER (
    PARTITION BY dc.chain_id
    ORDER BY dc.created_at ASC
  ) AS chain_position,
  -- Total links in this chain
  COUNT(*) OVER (PARTITION BY dc.chain_id) AS chain_link_count,
  -- Is this chain still open (any pending_review)?
  BOOL_OR(dc.outcome = 'pending_review') OVER (PARTITION BY dc.chain_id) AS chain_has_pending
FROM public.ai_decision_chain dc
LEFT JOIN public.profiles p ON p.user_id = dc.reviewed_by
ORDER BY dc.chain_id, dc.created_at ASC;

COMMENT ON VIEW public.v_ai_decision_trace IS
  'Auditor view: shows full AI decision chains with link ordering, reviewer names, and chain status. Uses security_invoker to enforce RLS on ai_decision_chain.';

-- Grant access to authenticated users (RLS on underlying table controls visibility)
GRANT SELECT ON public.v_ai_decision_trace TO authenticated;
