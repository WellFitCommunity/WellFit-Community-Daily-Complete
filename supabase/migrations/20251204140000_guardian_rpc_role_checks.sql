-- ============================================================================
-- Guardian RPC Role Checks
-- ============================================================================
-- Purpose: Add role checks inside SECURITY DEFINER functions to enforce
-- that only super_admin/system_admin can create, approve, or reject tickets.
--
-- This fixes the security issue where the broad GRANT to authenticated
-- would bypass RLS policies.
-- ============================================================================

-- ============================================================================
-- 1. UPDATE create_guardian_review_ticket WITH ROLE CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_guardian_review_ticket(
  p_issue_id TEXT,
  p_issue_category TEXT,
  p_issue_severity TEXT,
  p_issue_description TEXT,
  p_affected_component TEXT,
  p_affected_resources TEXT[],
  p_stack_trace TEXT,
  p_detection_context JSONB,
  p_action_id TEXT,
  p_healing_strategy TEXT,
  p_healing_description TEXT,
  p_healing_steps JSONB,
  p_rollback_plan JSONB,
  p_expected_outcome TEXT,
  p_sandbox_tested BOOLEAN DEFAULT FALSE,
  p_sandbox_results JSONB DEFAULT '{}'::jsonb,
  p_sandbox_passed BOOLEAN DEFAULT NULL
)
RETURNS UUID AS $$
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

  RETURN v_ticket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. UPDATE approve_guardian_ticket WITH ROLE CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_guardian_ticket(
  p_ticket_id UUID,
  p_code_reviewed BOOLEAN,
  p_impact_understood BOOLEAN,
  p_rollback_understood BOOLEAN,
  p_review_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_ticket guardian_review_tickets%ROWTYPE;
  v_reviewer_name TEXT;
  v_user_role TEXT;
BEGIN
  -- SECURITY: Check caller has super_admin or system_admin role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_user_role IS NULL OR v_user_role NOT IN ('super_admin', 'system_admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied: Only super_admin or system_admin can approve Guardian tickets'
    );
  END IF;

  -- Get current ticket
  SELECT * INTO v_ticket FROM guardian_review_tickets WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  IF v_ticket.status NOT IN ('pending', 'in_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket is not in reviewable state');
  END IF;

  -- Validate checklist - ALL must be true
  IF NOT (p_code_reviewed AND p_impact_understood AND p_rollback_understood) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'All review checkboxes must be checked to approve'
    );
  END IF;

  -- Validate notes - must be non-empty
  IF p_review_notes IS NULL OR TRIM(p_review_notes) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Review notes are required to approve'
    );
  END IF;

  -- Get reviewer name
  SELECT COALESCE(first_name || ' ' || last_name, email)
  INTO v_reviewer_name
  FROM profiles
  WHERE user_id = auth.uid();

  -- Update ticket
  UPDATE guardian_review_tickets
  SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    reviewer_name = v_reviewer_name,
    code_reviewed = p_code_reviewed,
    impact_understood = p_impact_understood,
    rollback_understood = p_rollback_understood,
    review_notes = p_review_notes
  WHERE id = p_ticket_id;

  -- Update associated security alert
  UPDATE security_alerts
  SET
    status = 'resolved',
    resolution_notes = format('Approved by %s: %s', v_reviewer_name, p_review_notes),
    resolution_time = NOW()
  WHERE id = v_ticket.security_alert_id;

  -- Log to audit
  PERFORM log_audit_event(
    'GUARDIAN_TICKET_APPROVED',
    'security',
    'guardian_review_tickets',
    p_ticket_id::text,
    auth.uid(),
    jsonb_build_object(
      'issue_id', v_ticket.issue_id,
      'healing_strategy', v_ticket.healing_strategy,
      'reviewer_notes', p_review_notes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'status', 'approved',
    'message', 'Ticket approved. Fix will be auto-applied.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. UPDATE reject_guardian_ticket WITH ROLE CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reject_guardian_ticket(
  p_ticket_id UUID,
  p_review_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_ticket guardian_review_tickets%ROWTYPE;
  v_reviewer_name TEXT;
  v_user_role TEXT;
BEGIN
  -- SECURITY: Check caller has super_admin or system_admin role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_user_role IS NULL OR v_user_role NOT IN ('super_admin', 'system_admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied: Only super_admin or system_admin can reject Guardian tickets'
    );
  END IF;

  -- Get current ticket
  SELECT * INTO v_ticket FROM guardian_review_tickets WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  IF v_ticket.status NOT IN ('pending', 'in_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket is not in reviewable state');
  END IF;

  -- Validate notes
  IF p_review_notes IS NULL OR TRIM(p_review_notes) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Review notes are required to reject'
    );
  END IF;

  -- Get reviewer name
  SELECT COALESCE(first_name || ' ' || last_name, email)
  INTO v_reviewer_name
  FROM profiles
  WHERE user_id = auth.uid();

  -- Update ticket
  UPDATE guardian_review_tickets
  SET
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    reviewer_name = v_reviewer_name,
    review_notes = p_review_notes
  WHERE id = p_ticket_id;

  -- Update associated security alert
  UPDATE security_alerts
  SET
    status = 'false_positive',
    resolution_notes = format('Rejected by %s: %s', v_reviewer_name, p_review_notes),
    resolution_time = NOW()
  WHERE id = v_ticket.security_alert_id;

  -- Log to audit
  PERFORM log_audit_event(
    'GUARDIAN_TICKET_REJECTED',
    'security',
    'guardian_review_tickets',
    p_ticket_id::text,
    auth.uid(),
    jsonb_build_object(
      'issue_id', v_ticket.issue_id,
      'healing_strategy', v_ticket.healing_strategy,
      'rejection_reason', p_review_notes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'status', 'rejected',
    'message', 'Ticket rejected. Fix will not be applied.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. UPDATE mark_guardian_ticket_applied WITH ROLE CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_guardian_ticket_applied(
  p_ticket_id UUID,
  p_result JSONB DEFAULT '{}'::jsonb,
  p_error TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_new_status TEXT;
  v_user_role TEXT;
BEGIN
  -- SECURITY: Check caller has super_admin or system_admin role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_user_role IS NULL OR v_user_role NOT IN ('super_admin', 'system_admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied: Only super_admin or system_admin can mark Guardian tickets as applied'
    );
  END IF;

  -- Determine status based on whether there was an error
  v_new_status := CASE WHEN p_error IS NULL THEN 'applied' ELSE 'failed' END;

  UPDATE guardian_review_tickets
  SET
    status = v_new_status,
    applied_at = NOW(),
    applied_by = auth.uid(),
    application_result = p_result,
    application_error = p_error
  WHERE id = p_ticket_id
  AND status = 'approved';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found or not approved');
  END IF;

  RETURN jsonb_build_object('success', true, 'status', v_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. UPDATE get_pending_guardian_tickets WITH ROLE CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_pending_guardian_tickets()
RETURNS TABLE (
  id UUID,
  issue_id TEXT,
  issue_category TEXT,
  issue_severity TEXT,
  issue_description TEXT,
  affected_component TEXT,
  healing_strategy TEXT,
  healing_description TEXT,
  sandbox_passed BOOLEAN,
  status TEXT,
  created_at TIMESTAMPTZ,
  security_alert_id UUID
) AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- SECURITY: Check caller has super_admin or system_admin role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_user_role IS NULL OR v_user_role NOT IN ('super_admin', 'system_admin') THEN
    -- Return empty result set for unauthorized users
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.issue_id,
    t.issue_category,
    t.issue_severity,
    t.issue_description,
    t.affected_component,
    t.healing_strategy,
    t.healing_description,
    t.sandbox_passed,
    t.status,
    t.created_at,
    t.security_alert_id
  FROM guardian_review_tickets t
  WHERE t.status IN ('pending', 'in_review')
  ORDER BY
    CASE t.issue_severity
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
      ELSE 5
    END,
    t.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION create_guardian_review_ticket IS 'Creates a review ticket and associated SOC security alert. Requires super_admin or system_admin role.';
COMMENT ON FUNCTION approve_guardian_ticket IS 'Approves a ticket after validating all checkboxes and notes. Requires super_admin or system_admin role.';
COMMENT ON FUNCTION reject_guardian_ticket IS 'Rejects a ticket with required explanation. Requires super_admin or system_admin role.';
COMMENT ON FUNCTION mark_guardian_ticket_applied IS 'Marks a ticket as applied or failed. Requires super_admin or system_admin role.';
COMMENT ON FUNCTION get_pending_guardian_tickets IS 'Returns pending tickets for the Guardian approval dashboard. Requires super_admin or system_admin role.';
