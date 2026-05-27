-- ============================================================================
-- SH-1: Bulk nurse review handoff risks RPC (server-side ownership check)
-- ============================================================================
-- Problem:
--   The client-side bulkConfirmAutoScores() in shiftHandoffService.ts accepted
--   an arbitrary array of risk_score_ids and ran a direct UPDATE on
--   shift_handoff_risk_scores. RLS only enforced tenant_id, so a nurse could
--   confirm risk scores for ANY patient in their tenant — including patients
--   on units they are not assigned to.
--
-- Fix:
--   Replace the direct UPDATE with this SECURITY DEFINER RPC. For each
--   submitted id, we verify the risk score belongs to a patient who currently
--   has an active bed_assignment in the caller's tenant before applying the
--   nurse-review fields. Denied ids are returned with a reason, so the client
--   can surface partial-failure information without trusting the DB to silently
--   no-op.
--
-- Authority: Tier 3 (governance-boundaries.md) — schema/RPC change, approved
-- under SH-1.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.bulk_nurse_review_handoff_risks(
  p_ids UUID[]
)
RETURNS TABLE (
  updated_id   UUID,
  denied_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nurse_id   UUID;
  v_tenant_id  UUID;
  v_id         UUID;
  v_owned      BOOLEAN;
BEGIN
  -- 1. Identify caller
  v_nurse_id := auth.uid();
  IF v_nurse_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '28000';
  END IF;

  -- 2. Resolve caller's tenant from their profile (server-side, not spoofable)
  SELECT p.tenant_id
    INTO v_tenant_id
    FROM public.profiles p
   WHERE p.user_id = v_nurse_id
   LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant for current user'
      USING ERRCODE = '28000';
  END IF;

  -- 3. Bail out on empty input
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- 4. For each submitted id, verify ownership before updating.
  --    Ownership = the patient on this risk score has an active bed_assignment
  --    in the caller's tenant. This blocks cross-tenant + cross-unit confirms
  --    while still letting nurses bulk-confirm patients in their facility.
  FOREACH v_id IN ARRAY p_ids LOOP
    SELECT EXISTS (
      SELECT 1
        FROM public.shift_handoff_risk_scores hrs
        JOIN public.bed_assignments ba
          ON ba.patient_id = hrs.patient_id
         AND ba.tenant_id = hrs.tenant_id
         AND ba.is_active = TRUE
       WHERE hrs.id = v_id
         AND hrs.tenant_id = v_tenant_id
    ) INTO v_owned;

    IF NOT v_owned THEN
      updated_id    := v_id;
      denied_reason := 'not_owned_by_caller';
      RETURN NEXT;
      CONTINUE;
    END IF;

    UPDATE public.shift_handoff_risk_scores
       SET nurse_reviewed     = TRUE,
           nurse_id           = v_nurse_id,
           nurse_reviewed_at  = NOW(),
           updated_at         = NOW()
     WHERE id = v_id
       AND tenant_id = v_tenant_id;

    IF FOUND THEN
      updated_id    := v_id;
      denied_reason := NULL;
      RETURN NEXT;
    ELSE
      updated_id    := v_id;
      denied_reason := 'update_failed';
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.bulk_nurse_review_handoff_risks(UUID[]) IS
  'SH-1: Bulk-confirm shift handoff auto-scores with server-side ownership check. '
  'For each id, verifies the risk score belongs to a patient with an active bed_assignment '
  'in the caller''s tenant before applying nurse-review fields. Returns one row per submitted '
  'id with denied_reason = NULL on success, or a non-null reason string on denial.';

-- Lock down access: only authenticated users may invoke. Service role still
-- has access by default. anon and public must not be able to mutate handoff
-- review state (per adversarial-audit-lessons.md §4).
REVOKE ALL ON FUNCTION public.bulk_nurse_review_handoff_risks(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_nurse_review_handoff_risks(UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.bulk_nurse_review_handoff_risks(UUID[]) TO authenticated;

COMMIT;
