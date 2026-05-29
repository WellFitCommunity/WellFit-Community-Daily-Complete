-- ============================================================================
-- Restore approve_guardian_ticket + reject_guardian_ticket (GRD-9)
-- ============================================================================
--
-- DISCOVERED 2026-05-29 (building the GRD-9 lifecycle test): the approval form
-- calls approve_guardian_ticket / reject_guardian_ticket, but NEITHER EXISTS in
-- the live DB. They were defined in 20251204140000_guardian_rpc_role_checks.sql,
-- then DROPPED by 20251209110000_drop_broken_functions.sql (Part 3, "functions
-- needing missing dependent functions") because they call log_audit_event(),
-- which was dropped in the same sweep — and they were never recreated. So
-- approving or rejecting a Guardian ticket has failed at runtime ever since.
--
-- Combined with the create-ticket CHECK-constraint bug fixed earlier today
-- (20260529170000), the ENTIRE Guardian approval workflow was non-functional:
-- couldn't create tickets, couldn't approve, couldn't reject.
--
-- FIX: recreate both RPCs from their original definitions, with two changes:
--   1. Replace the PERFORM log_audit_event(...) call (the dead dependency that
--      got them dropped) — the application layer already audits via
--      auditLogger.info('GUARDIAN_TICKET_APPROVED'/'..._REJECTED') after a
--      successful RPC, so the audit trail is preserved without the dropped fn.
--   2. SET search_path = public (required for SECURITY DEFINER per supabase.md).
--   3. Manual-flow messaging (nothing auto-applies — Maria creates the PR).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.approve_guardian_ticket(
  p_ticket_id UUID,
  p_code_reviewed BOOLEAN,
  p_impact_understood BOOLEAN,
  p_rollback_understood BOOLEAN,
  p_review_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket guardian_review_tickets%ROWTYPE;
  v_reviewer_name TEXT;
  v_user_role TEXT;
BEGIN
  -- SECURITY: only super_admin / system_admin may approve
  SELECT role INTO v_user_role FROM profiles WHERE user_id = auth.uid();
  IF v_user_role IS NULL OR v_user_role NOT IN ('super_admin', 'system_admin') THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Access denied: Only super_admin or system_admin can approve Guardian tickets');
  END IF;

  SELECT * INTO v_ticket FROM guardian_review_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  IF v_ticket.status NOT IN ('pending', 'in_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket is not in reviewable state');
  END IF;

  -- All checkboxes required
  IF NOT (p_code_reviewed AND p_impact_understood AND p_rollback_understood) THEN
    RETURN jsonb_build_object('success', false,
      'error', 'All review checkboxes must be checked to approve');
  END IF;

  IF p_review_notes IS NULL OR TRIM(p_review_notes) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Review notes are required to approve');
  END IF;

  SELECT COALESCE(first_name || ' ' || last_name, email)
  INTO v_reviewer_name FROM profiles WHERE user_id = auth.uid();

  UPDATE guardian_review_tickets
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      reviewer_name = v_reviewer_name,
      code_reviewed = p_code_reviewed,
      impact_understood = p_impact_understood,
      rollback_understood = p_rollback_understood,
      review_notes = p_review_notes
  WHERE id = p_ticket_id;

  UPDATE security_alerts
  SET status = 'resolved',
      resolution_notes = format('Approved by %s: %s', v_reviewer_name, p_review_notes),
      resolution_time = NOW()
  WHERE id = v_ticket.security_alert_id;

  -- NOTE: audit is recorded by the app layer (auditLogger.info
  -- 'GUARDIAN_TICKET_APPROVED') after this RPC returns success. The original
  -- PERFORM log_audit_event(...) was removed — that fn was dropped in
  -- 20251209110000 and is what got this RPC dropped.

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'status', 'approved',
    'message', 'Ticket approved. Create the pull request from the proposed fix.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_guardian_ticket(
  p_ticket_id UUID,
  p_review_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket guardian_review_tickets%ROWTYPE;
  v_reviewer_name TEXT;
  v_user_role TEXT;
BEGIN
  -- SECURITY: only super_admin / system_admin may reject
  SELECT role INTO v_user_role FROM profiles WHERE user_id = auth.uid();
  IF v_user_role IS NULL OR v_user_role NOT IN ('super_admin', 'system_admin') THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Access denied: Only super_admin or system_admin can reject Guardian tickets');
  END IF;

  SELECT * INTO v_ticket FROM guardian_review_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  IF v_ticket.status NOT IN ('pending', 'in_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket is not in reviewable state');
  END IF;

  IF p_review_notes IS NULL OR TRIM(p_review_notes) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Review notes are required to reject');
  END IF;

  SELECT COALESCE(first_name || ' ' || last_name, email)
  INTO v_reviewer_name FROM profiles WHERE user_id = auth.uid();

  UPDATE guardian_review_tickets
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      reviewer_name = v_reviewer_name,
      review_notes = p_review_notes
  WHERE id = p_ticket_id;

  UPDATE security_alerts
  SET status = 'false_positive',
      resolution_notes = format('Rejected by %s: %s', v_reviewer_name, p_review_notes),
      resolution_time = NOW()
  WHERE id = v_ticket.security_alert_id;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'status', 'rejected',
    'message', 'Ticket rejected. No change will be made.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_guardian_ticket(UUID, BOOLEAN, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_guardian_ticket(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_guardian_ticket(UUID, BOOLEAN, BOOLEAN, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_guardian_ticket(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.approve_guardian_ticket IS 'Approves a Guardian review ticket after validating all checkboxes + notes; marks the linked security_alert resolved. super_admin/system_admin only. Restored 2026-05-29 (was dropped 20251209110000 via the log_audit_event dependency).';
COMMENT ON FUNCTION public.reject_guardian_ticket IS 'Rejects a Guardian review ticket with a required reason; marks the linked security_alert false_positive. super_admin/system_admin only. Restored 2026-05-29.';

COMMIT;
