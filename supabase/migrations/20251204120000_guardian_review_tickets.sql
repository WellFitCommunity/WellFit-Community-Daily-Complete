-- ============================================================================
-- Guardian Review Tickets - Pool Report System
-- ============================================================================
-- Purpose: Persist Guardian Agent approval requests (pool reports) to database
-- for human review before auto-applying fixes.
--
-- Workflow:
-- 1. Guardian detects issue requiring approval
-- 2. Creates review ticket (status='pending')
-- 3. Creates security_alert for SOC visibility
-- 4. SOC operator reviews in Guardian Approval Form
-- 5. Operator fills checklist + notes, approves/rejects
-- 6. If approved, Guardian auto-applies fix
--
-- SOC2 Compliance: CC6.1, CC7.2, CC7.3
-- ============================================================================

-- ============================================================================
-- 1. GUARDIAN REVIEW TICKETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.guardian_review_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to SOC security_alerts for dashboard visibility
  security_alert_id UUID REFERENCES security_alerts(id) ON DELETE SET NULL,

  -- =========================================================================
  -- Issue Details (what was detected)
  -- =========================================================================
  issue_id TEXT NOT NULL,
  issue_category TEXT NOT NULL,
  issue_severity TEXT NOT NULL CHECK (issue_severity IN ('critical', 'high', 'medium', 'low', 'info')),
  issue_description TEXT,
  affected_component TEXT,          -- e.g., 'src/components/PatientCard.tsx'
  affected_resources TEXT[],        -- Array of affected files/endpoints
  stack_trace TEXT,
  detection_context JSONB DEFAULT '{}'::jsonb,  -- Environment state, recent actions, etc.

  -- =========================================================================
  -- Proposed Fix Details (what Guardian wants to do)
  -- =========================================================================
  action_id TEXT NOT NULL,
  healing_strategy TEXT NOT NULL,   -- retry_with_backoff, auto_patch, etc.
  healing_description TEXT NOT NULL,
  healing_steps JSONB NOT NULL DEFAULT '[]'::jsonb,    -- Array of step objects
  rollback_plan JSONB DEFAULT '[]'::jsonb,             -- Steps to undo if needed
  expected_outcome TEXT,

  -- =========================================================================
  -- Sandbox Test Results (pre-approval validation)
  -- =========================================================================
  sandbox_tested BOOLEAN DEFAULT FALSE,
  sandbox_test_results JSONB DEFAULT '{}'::jsonb,
  sandbox_passed BOOLEAN,

  -- =========================================================================
  -- Review Workflow Status
  -- =========================================================================
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Awaiting review
    'in_review',    -- Someone opened the review form
    'approved',     -- Approved, ready to apply
    'rejected',     -- Rejected, will not apply
    'applied',      -- Fix was applied successfully
    'failed',       -- Fix application failed
    'rolled_back'   -- Fix was applied but rolled back
  )),

  -- =========================================================================
  -- Review Form (REQUIRED for approval - prevents rubber-stamping)
  -- =========================================================================
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewer_name TEXT,

  -- Required checkboxes (all must be TRUE to approve)
  code_reviewed BOOLEAN DEFAULT FALSE,
  impact_understood BOOLEAN DEFAULT FALSE,
  rollback_understood BOOLEAN DEFAULT FALSE,

  -- Required notes (must be non-empty to approve)
  review_notes TEXT,

  -- Optional: reviewer can add additional context
  review_metadata JSONB DEFAULT '{}'::jsonb,

  -- =========================================================================
  -- Application Tracking
  -- =========================================================================
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  application_result JSONB DEFAULT '{}'::jsonb,
  application_error TEXT,

  -- Rollback tracking
  rolled_back_at TIMESTAMPTZ,
  rolled_back_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rollback_reason TEXT,

  -- =========================================================================
  -- Timestamps
  -- =========================================================================
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_guardian_tickets_status
ON guardian_review_tickets(status);

CREATE INDEX IF NOT EXISTS idx_guardian_tickets_severity
ON guardian_review_tickets(issue_severity);

CREATE INDEX IF NOT EXISTS idx_guardian_tickets_created_at
ON guardian_review_tickets(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guardian_tickets_pending
ON guardian_review_tickets(status, created_at DESC)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_guardian_tickets_security_alert
ON guardian_review_tickets(security_alert_id)
WHERE security_alert_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guardian_tickets_reviewer
ON guardian_review_tickets(reviewed_by)
WHERE reviewed_by IS NOT NULL;

-- ============================================================================
-- 3. TIMESTAMP TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_guardian_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_guardian_tickets_timestamp ON guardian_review_tickets;
CREATE TRIGGER update_guardian_tickets_timestamp
  BEFORE UPDATE ON guardian_review_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_guardian_ticket_timestamp();

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

ALTER TABLE guardian_review_tickets ENABLE ROW LEVEL SECURITY;

-- SOC operators (super_admin, system_admin) can view all tickets
CREATE POLICY "soc_view_guardian_tickets"
ON guardian_review_tickets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super_admin', 'system_admin')
  )
);

-- SOC operators can update tickets (for review workflow)
CREATE POLICY "soc_update_guardian_tickets"
ON guardian_review_tickets
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super_admin', 'system_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super_admin', 'system_admin')
  )
);

-- Service role can insert (Guardian agent runs server-side)
CREATE POLICY "service_insert_guardian_tickets"
ON guardian_review_tickets
FOR INSERT
TO service_role
WITH CHECK (true);

-- Authenticated users can insert (for client-side Guardian)
CREATE POLICY "authenticated_insert_guardian_tickets"
ON guardian_review_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super_admin', 'system_admin')
  )
);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE guardian_review_tickets;

-- ============================================================================
-- 5. FUNCTIONS
-- ============================================================================

-- Function to create a review ticket and associated security alert
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
BEGIN
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

-- Function to approve a ticket (validates checklist)
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
BEGIN
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

-- Function to reject a ticket
CREATE OR REPLACE FUNCTION public.reject_guardian_ticket(
  p_ticket_id UUID,
  p_review_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_ticket guardian_review_tickets%ROWTYPE;
  v_reviewer_name TEXT;
BEGIN
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

-- Function to mark ticket as applied
CREATE OR REPLACE FUNCTION public.mark_guardian_ticket_applied(
  p_ticket_id UUID,
  p_result JSONB DEFAULT '{}'::jsonb,
  p_error TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_new_status TEXT;
BEGIN
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

-- Function to get pending tickets for dashboard
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
BEGIN
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
-- 6. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.create_guardian_review_ticket TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_guardian_review_ticket TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_guardian_ticket TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_guardian_ticket TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_guardian_ticket_applied TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_guardian_ticket_applied TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_guardian_tickets TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE guardian_review_tickets IS 'Pool reports for Guardian Agent actions requiring human approval before auto-applying';
COMMENT ON COLUMN guardian_review_tickets.code_reviewed IS 'Reviewer must confirm they reviewed the proposed code changes';
COMMENT ON COLUMN guardian_review_tickets.impact_understood IS 'Reviewer must confirm they understand the system impact';
COMMENT ON COLUMN guardian_review_tickets.rollback_understood IS 'Reviewer must confirm they understand the rollback procedure';
COMMENT ON COLUMN guardian_review_tickets.review_notes IS 'Required explanation of what reviewer checked (prevents rubber-stamping)';
COMMENT ON FUNCTION create_guardian_review_ticket IS 'Creates a review ticket and associated SOC security alert';
COMMENT ON FUNCTION approve_guardian_ticket IS 'Approves a ticket after validating all checkboxes and notes';
COMMENT ON FUNCTION reject_guardian_ticket IS 'Rejects a ticket with required explanation';
