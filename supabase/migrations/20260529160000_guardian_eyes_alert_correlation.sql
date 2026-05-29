-- ============================================================================
-- GRD-6: Connect the Guardian Eyes recording pipeline to review tickets
-- ============================================================================
--
-- PROBLEM (diagnosed against the live DB 2026-05-29):
--   The approval form had no way to show "what Guardian saw" because the
--   recording pipeline was disconnected three ways:
--     1. guardian_eyes_recordings was fed only by the edge fn `record` action,
--        which NOTHING invokes -> the table is empty in production.
--     2. There was no deterministic link between a recording and a review
--        ticket (recordings keyed on session_id; auto-heal tickets carry none).
--     3. The form would render an empty box.
--
-- FIX (Maria's call 2026-05-29 — "server-side + correlation id"):
--   create_guardian_review_ticket() is the single chokepoint both the
--   edge-fn auto-heal path and the browser AgentBrain path call to create the
--   alert + ticket atomically. We add a security_alert_id correlation column
--   to guardian_eyes_recordings and have the RPC ALSO write one recording row
--   (the detection snapshot) stamped with the new alert id, in the same
--   transaction. The approval form then fetches recordings by the ticket's
--   security_alert_id — deterministic, server-side, no browser session needed.
-- ============================================================================

BEGIN;

-- 1. Correlation column ------------------------------------------------------
ALTER TABLE public.guardian_eyes_recordings
  ADD COLUMN IF NOT EXISTS security_alert_id UUID
  REFERENCES public.security_alerts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guardian_eyes_recordings_alert
  ON public.guardian_eyes_recordings(security_alert_id);

COMMENT ON COLUMN public.guardian_eyes_recordings.security_alert_id IS
  'Correlation to the security_alerts row whose review ticket this recording backs (GRD-6). Set by create_guardian_review_ticket().';

-- 2. Extend the ticket-creation RPC to write the linked recording ------------
--    Signature and all existing behavior are preserved verbatim; the only
--    addition is the guardian_eyes_recordings INSERT after the alert insert.
CREATE OR REPLACE FUNCTION public.create_guardian_review_ticket(
  p_issue_id text,
  p_issue_category text,
  p_issue_severity text,
  p_issue_description text,
  p_affected_component text,
  p_affected_resources text[],
  p_stack_trace text,
  p_detection_context jsonb,
  p_action_id text,
  p_healing_strategy text,
  p_healing_description text,
  p_healing_steps jsonb,
  p_rollback_plan jsonb,
  p_expected_outcome text,
  p_sandbox_tested boolean DEFAULT false,
  p_sandbox_results jsonb DEFAULT '{}'::jsonb,
  p_sandbox_passed boolean DEFAULT NULL::boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket_id UUID;
  v_alert_id UUID;
  v_alert_severity TEXT;
  v_user_role TEXT;
BEGIN
  -- SECURITY: Check caller has super_admin or system_admin role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_user_role IS NULL OR v_user_role NOT IN ('super_admin', 'system_admin') THEN
    RAISE EXCEPTION 'Access denied: Only super_admin or system_admin can create Guardian tickets';
  END IF;

  -- Map issue severity to alert severity
  v_alert_severity := CASE p_issue_severity
    WHEN 'critical' THEN 'critical'
    WHEN 'high' THEN 'high'
    WHEN 'medium' THEN 'medium'
    ELSE 'low'
  END;

  -- Create security alert for SOC visibility
  INSERT INTO security_alerts (
    severity,
    alert_type,
    title,
    description,
    metadata,
    status
  ) VALUES (
    v_alert_severity,
    'guardian_approval_required',
    format('Guardian Approval Required: %s', p_healing_strategy),
    format('Issue: %s in %s. Proposed fix: %s',
      p_issue_description,
      COALESCE(p_affected_component, 'unknown'),
      p_healing_description
    ),
    jsonb_build_object(
      'issue_id', p_issue_id,
      'action_id', p_action_id,
      'healing_strategy', p_healing_strategy,
      'affected_resources', p_affected_resources,
      'sandbox_passed', p_sandbox_passed
    ),
    'new'
  )
  RETURNING id INTO v_alert_id;

  -- Create review ticket
  INSERT INTO guardian_review_tickets (
    security_alert_id,
    issue_id,
    issue_category,
    issue_severity,
    issue_description,
    affected_component,
    affected_resources,
    stack_trace,
    detection_context,
    action_id,
    healing_strategy,
    healing_description,
    healing_steps,
    rollback_plan,
    expected_outcome,
    sandbox_tested,
    sandbox_test_results,
    sandbox_passed
  ) VALUES (
    v_alert_id,
    p_issue_id,
    p_issue_category,
    p_issue_severity,
    p_issue_description,
    p_affected_component,
    p_affected_resources,
    p_stack_trace,
    p_detection_context,
    p_action_id,
    p_healing_strategy,
    p_healing_description,
    p_healing_steps,
    p_rollback_plan,
    p_expected_outcome,
    p_sandbox_tested,
    p_sandbox_results,
    p_sandbox_passed
  )
  RETURNING id INTO v_ticket_id;

  -- Update security alert with ticket reference
  UPDATE security_alerts
  SET metadata = metadata || jsonb_build_object('ticket_id', v_ticket_id)
  WHERE id = v_alert_id;

  -- GRD-6: write the Guardian Eyes "detection snapshot" recording, correlated
  -- to the alert so the approval form can show what Guardian saw. type/
  -- component/action are NOT NULL on the table, so they are COALESCEd.
  INSERT INTO guardian_eyes_recordings (
    type,
    component,
    action,
    severity,
    metadata,
    state_before,
    ai_analysis,
    user_id,
    session_id,
    security_alert_id
  ) VALUES (
    COALESCE(p_issue_category, 'unknown'),
    COALESCE(p_affected_component, 'unknown'),
    COALESCE(p_issue_description, 'Guardian detection'),
    v_alert_severity,
    jsonb_build_object(
      'issue_id', p_issue_id,
      'action_id', p_action_id,
      'healing_strategy', p_healing_strategy,
      'affected_resources', p_affected_resources
    ),
    p_detection_context,
    to_jsonb(p_healing_description),
    auth.uid(),
    p_detection_context->>'sessionId',
    v_alert_id
  );

  RETURN v_ticket_id;
END;
$function$;

COMMIT;
