-- ============================================================================
-- A-0 BED RPC LOCKDOWN (external audit remediation S1, approved by Maria 2026-08-15)
-- Tracker: docs/trackers/external-audit-remediation-2026-07-27-tracker.md
--
-- Live-verified findings this migration fixes:
--   1. EXECUTE was granted to `anon` on every bed-management function.
--      SECURITY DEFINER bypasses RLS, so the anon grant made assign/discharge/
--      status-change reachable WITH NO CREDENTIAL AT ALL.
--   2. None of the DEFINER functions compared the caller to the resource:
--      tenant was derived from the *supplied* bed/boarder/unit and auth.uid()
--      was used only to stamp rows, never to authorize.
--   3. Sibling sweep (by name AND by prosrc reference to beds/bed_assignments/
--      ed_boarders) found 3 more DEFINER functions the audit missed:
--      place_ed_boarder, get_ed_boarding_metrics, and predict_unit_discharges —
--      the last returns PATIENT NAMES for any unit UUID.
--
-- Fix model:
--   * assert_bed_management_caller(tenant): service_role / direct-DB callers
--     pass (HL7 ingest via hl7-receive uses the service key; bed-management
--     forwards the USER's JWT so it authorizes as the user); everyone else
--     must be authenticated, tenant-matched, and hold a bed-management role
--     (same canonical helpers RLS uses: get_current_tenant_id +
--     current_user_has_any_role).
--   * REVOKE EXECUTE FROM anon (and PUBLIC) on all 15 bed/ED functions.
--   * Tenant constraints added to internal statements that were previously
--     unscoped (cross-tenant transfer/discharge side effects).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Caller assertion helper (not client-callable)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_bed_management_caller(p_resource_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant uuid;
BEGIN
  -- Internal pipelines (HL7 ingest, cron) call via the service key; direct DB
  -- sessions (migrations, psql maintenance) have no PostgREST JWT at all.
  -- current_user here is the DEFINER owner, only reached when auth.role() is
  -- NULL — i.e. never for a PostgREST-originated request.
  IF COALESCE(auth.role(), current_user) IN ('service_role', 'postgres') THEN
    RETURN;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'BED_RPC_DENIED: authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_resource_tenant_id IS NULL THEN
    RAISE EXCEPTION 'BED_RPC_DENIED: resource tenant unresolved'
      USING ERRCODE = '42501';
  END IF;

  v_caller_tenant := public.get_current_tenant_id();

  IF v_caller_tenant IS NULL OR v_caller_tenant IS DISTINCT FROM p_resource_tenant_id THEN
    RAISE EXCEPTION 'BED_RPC_DENIED: caller tenant does not match resource tenant'
      USING ERRCODE = '42501';
  END IF;

  -- Mirrors beds_staff_write RLS plus the clinical set bed-management already
  -- allows. care_manager/bed_control kept for forward-compat even though no
  -- roles row exists for them yet (flagged in the tracker).
  IF NOT public.current_user_has_any_role(ARRAY[
    'admin','super_admin','nurse','nurse_practitioner','physician','doctor',
    'physician_assistant','clinical_supervisor','department_head','case_manager',
    'care_manager','bed_control'
  ]) THEN
    RAISE EXCEPTION 'BED_RPC_DENIED: caller lacks a bed-management role'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_bed_management_caller(uuid) IS
  'A-0 remediation: fail-closed caller check for bed-management SECURITY DEFINER RPCs. Service-role/direct-DB callers pass; user callers need auth + tenant match + bed-management role.';

REVOKE ALL ON FUNCTION public.assert_bed_management_caller(uuid) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1. assign_patient_to_bed — tenant from bed, now asserted against caller.
--    Patient's cross-tenant guard + tenant-scoped transfer side effects added.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_patient_to_bed(
  p_patient_id uuid,
  p_bed_id uuid,
  p_expected_los_days integer DEFAULT NULL::integer,
  p_adt_source text DEFAULT 'manual'::text,
  p_adt_event_id text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assignment_id UUID;
  v_tenant_id UUID;
  v_patient_tenant UUID;
  v_old_bed_id UUID;
  v_expected_discharge DATE;
BEGIN
  -- Get tenant from bed
  SELECT tenant_id INTO v_tenant_id FROM public.beds WHERE id = p_bed_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Bed not found';
  END IF;

  -- A-0: caller must be authorized for this bed's tenant
  PERFORM public.assert_bed_management_caller(v_tenant_id);

  -- A-0: a patient provably belonging to another tenant cannot be assigned here
  SELECT tenant_id INTO v_patient_tenant
  FROM public.profiles WHERE user_id = p_patient_id;

  IF v_patient_tenant IS NOT NULL AND v_patient_tenant IS DISTINCT FROM v_tenant_id THEN
    RAISE EXCEPTION 'Patient does not belong to this tenant';
  END IF;

  -- Check bed is available
  IF NOT EXISTS (
    SELECT 1 FROM public.beds
    WHERE id = p_bed_id AND status = 'available' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Bed is not available for assignment';
  END IF;

  -- Check for existing active assignment for this patient (tenant-scoped)
  SELECT bed_id INTO v_old_bed_id
  FROM public.bed_assignments
  WHERE patient_id = p_patient_id AND is_active = true AND tenant_id = v_tenant_id;

  -- Calculate expected discharge
  IF p_expected_los_days IS NOT NULL THEN
    v_expected_discharge := CURRENT_DATE + p_expected_los_days;
  END IF;

  -- If patient has existing assignment, this is a transfer
  IF v_old_bed_id IS NOT NULL THEN
    -- End old assignment (tenant-scoped)
    UPDATE public.bed_assignments
    SET is_active = false,
        discharged_at = NOW(),
        actual_disposition = 'Transfer',
        updated_at = NOW()
    WHERE patient_id = p_patient_id AND is_active = true AND tenant_id = v_tenant_id;

    -- Update old bed status (tenant-scoped)
    UPDATE public.beds
    SET status = 'dirty',
        status_changed_at = NOW(),
        status_changed_by = auth.uid()
    WHERE id = v_old_bed_id AND tenant_id = v_tenant_id;
  END IF;

  -- Create new assignment
  INSERT INTO public.bed_assignments (
    tenant_id, bed_id, patient_id, assigned_by,
    expected_discharge_date, transferred_from_bed_id,
    adt_source, adt_event_id
  )
  VALUES (
    v_tenant_id, p_bed_id, p_patient_id, auth.uid(),
    v_expected_discharge, v_old_bed_id,
    p_adt_source, p_adt_event_id
  )
  RETURNING id INTO v_assignment_id;

  -- Update bed status to occupied
  UPDATE public.beds
  SET status = 'occupied',
      status_changed_at = NOW(),
      status_changed_by = auth.uid(),
      reserved_for_patient_id = NULL,
      reserved_until = NULL
  WHERE id = p_bed_id;

  RETURN v_assignment_id;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 2. discharge_patient — tenant resolved from the active assignment, asserted;
--    all side effects tenant-scoped.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.discharge_patient(
  p_patient_id uuid,
  p_disposition text DEFAULT 'Home'::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bed_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Find active assignment and its tenant
  SELECT bed_id, tenant_id INTO v_bed_id, v_tenant_id
  FROM public.bed_assignments
  WHERE patient_id = p_patient_id AND is_active = true;

  IF v_bed_id IS NULL THEN
    RETURN false;
  END IF;

  -- A-0: caller must be authorized for the assignment's tenant
  PERFORM public.assert_bed_management_caller(v_tenant_id);

  -- End assignment (tenant-scoped)
  UPDATE public.bed_assignments
  SET is_active = false,
      discharged_at = NOW(),
      discharged_by = auth.uid(),
      actual_disposition = p_disposition,
      updated_at = NOW()
  WHERE patient_id = p_patient_id AND is_active = true AND tenant_id = v_tenant_id;

  -- Set bed to dirty (needs cleaning, tenant-scoped)
  UPDATE public.beds
  SET status = 'dirty',
      status_changed_at = NOW(),
      status_changed_by = auth.uid()
  WHERE id = v_bed_id AND tenant_id = v_tenant_id;

  RETURN true;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 3. update_bed_status — tenant from bed, asserted.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_bed_status(
  p_bed_id uuid,
  p_new_status bed_status,
  p_reason text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old_status bed_status;
  v_tenant_id UUID;
  v_old_status_changed_at TIMESTAMPTZ;
  v_duration_minutes INTEGER;
BEGIN
  -- Get current status
  SELECT status, tenant_id, status_changed_at
  INTO v_old_status, v_tenant_id, v_old_status_changed_at
  FROM public.beds
  WHERE id = p_bed_id;

  IF v_old_status IS NULL THEN
    RETURN false;
  END IF;

  -- A-0: caller must be authorized for this bed's tenant
  PERFORM public.assert_bed_management_caller(v_tenant_id);

  -- Calculate duration in previous status
  v_duration_minutes := EXTRACT(EPOCH FROM (NOW() - v_old_status_changed_at)) / 60;

  -- Record history
  INSERT INTO public.bed_status_history (
    tenant_id, bed_id, previous_status, new_status,
    changed_by, reason, duration_minutes
  )
  VALUES (
    v_tenant_id, p_bed_id, v_old_status, p_new_status,
    auth.uid(), p_reason, v_duration_minutes
  );

  -- Update bed
  UPDATE public.beds
  SET status = p_new_status,
      status_changed_at = NOW(),
      status_changed_by = auth.uid(),
      status_notes = p_reason
  WHERE id = p_bed_id;

  RETURN true;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 4. assign_bed_to_ed_boarder — tenant from boarder, asserted.
--    (Body otherwise unchanged, including the legacy dynamic-SQL beds guard.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_bed_to_ed_boarder(
  p_boarder_id uuid,
  p_bed_id uuid,
  p_bed_label text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_boarder RECORD;
  v_bed_label text;
  v_beds_exists boolean;
BEGIN
  -- Get boarder
  SELECT * INTO v_boarder
  FROM ed_boarders
  WHERE id = p_boarder_id
    AND status = 'awaiting_bed';

  IF v_boarder IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Boarder not found or not awaiting bed');
  END IF;

  -- A-0: caller must be authorized for the boarder's tenant
  PERFORM public.assert_bed_management_caller(v_boarder.tenant_id);

  -- Check if beds table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'beds'
  ) INTO v_beds_exists;

  v_bed_label := p_bed_label;

  -- If beds table exists, validate and reserve the bed
  IF v_beds_exists THEN
    EXECUTE format('
      SELECT bed_label FROM beds
      WHERE id = $1 AND tenant_id = $2 AND status = %L
    ', 'available')
    INTO v_bed_label
    USING p_bed_id, v_boarder.tenant_id;

    IF v_bed_label IS NULL AND p_bed_label IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Bed not found or not available');
    END IF;

    v_bed_label := COALESCE(p_bed_label, v_bed_label);

    -- Reserve the bed
    EXECUTE format('
      UPDATE beds
      SET status = %L,
          reserved_for_patient_id = $1,
          status_changed_at = now(),
          status_notes = %L
      WHERE id = $2
    ', 'reserved', 'Reserved for ED boarder')
    USING v_boarder.patient_id, p_bed_id;
  END IF;

  -- Update boarder
  UPDATE ed_boarders
  SET status = 'bed_assigned',
      assigned_bed_id = p_bed_id,
      assigned_bed_label = COALESCE(v_bed_label, p_bed_label),
      assigned_at = now(),
      updated_at = now()
  WHERE id = p_boarder_id;

  RETURN jsonb_build_object(
    'success', true,
    'boarder_id', p_boarder_id,
    'bed_id', p_bed_id,
    'bed_label', COALESCE(v_bed_label, p_bed_label)
  );
END;
$function$;

-- ----------------------------------------------------------------------------
-- 5. place_ed_boarder — tenant from boarder, asserted.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_ed_boarder(p_boarder_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_boarder RECORD;
  v_boarding_minutes integer;
  v_beds_exists boolean;
BEGIN
  -- Get boarder
  SELECT * INTO v_boarder
  FROM ed_boarders
  WHERE id = p_boarder_id
    AND status IN ('bed_assigned', 'in_transport');

  IF v_boarder IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Boarder not found or wrong status');
  END IF;

  -- A-0: caller must be authorized for the boarder's tenant
  PERFORM public.assert_bed_management_caller(v_boarder.tenant_id);

  v_boarding_minutes := EXTRACT(EPOCH FROM (now() - v_boarder.boarding_start_at)) / 60;

  -- Update boarder
  UPDATE ed_boarders
  SET status = 'placed',
      placed_at = now(),
      updated_at = now()
  WHERE id = p_boarder_id;

  -- Check if beds table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'beds'
  ) INTO v_beds_exists;

  IF v_beds_exists THEN
    -- Update bed to occupied
    IF v_boarder.assigned_bed_id IS NOT NULL THEN
      EXECUTE format('
        UPDATE beds
        SET status = %L,
            reserved_for_patient_id = NULL,
            status_changed_at = now(),
            status_notes = %L
        WHERE id = $1
      ', 'occupied', 'ED boarder placed')
      USING v_boarder.assigned_bed_id;
    END IF;

    -- Free up ED bed
    IF v_boarder.ed_bed_id IS NOT NULL THEN
      EXECUTE format('
        UPDATE beds
        SET status = %L,
            status_changed_at = now(),
            status_notes = %L
        WHERE id = $1
      ', 'dirty', 'ED patient transferred to inpatient')
      USING v_boarder.ed_bed_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'boarder_id', p_boarder_id,
    'boarding_minutes', v_boarding_minutes,
    'assigned_bed_id', v_boarder.assigned_bed_id,
    'ed_bed_id', v_boarder.ed_bed_id
  );
END;
$function$;

-- ----------------------------------------------------------------------------
-- 6. find_bed_by_location — client-supplied tenant, asserted.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_bed_by_location(
  p_tenant_id uuid,
  p_room text,
  p_bed text DEFAULT 'A'::text,
  p_unit_code text DEFAULT NULL::text,
  p_building text DEFAULT NULL::text,
  p_floor text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_bed_id UUID;
BEGIN
  -- A-0: caller must be authorized for the requested tenant
  PERFORM public.assert_bed_management_caller(p_tenant_id);

  SELECT b.id INTO v_bed_id
  FROM public.beds b
  JOIN public.hospital_units u ON b.unit_id = u.id
  WHERE b.tenant_id = p_tenant_id
    AND b.room_number = p_room
    AND b.bed_position = COALESCE(p_bed, 'A')
    AND b.is_active = true
    AND (p_unit_code IS NULL OR u.unit_code = p_unit_code)
    AND (p_building IS NULL OR u.building = p_building)
    AND (p_floor IS NULL OR u.floor_number = p_floor)
  LIMIT 1;

  RETURN v_bed_id;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 7. get_ed_boarding_metrics — client-supplied tenant, asserted.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ed_boarding_metrics(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_metrics jsonb;
  v_total integer;
  v_avg_minutes numeric;
  v_max_minutes integer;
  v_pending_transport integer;
  v_by_escalation jsonb;
  v_by_acuity jsonb;
BEGIN
  -- A-0: caller must be authorized for the requested tenant
  PERFORM public.assert_bed_management_caller(p_tenant_id);

  -- Get total boarders awaiting with calculated boarding_minutes
  SELECT
    COUNT(*),
    AVG(EXTRACT(EPOCH FROM (COALESCE(placed_at, cancelled_at, now()) - boarding_start_at)) / 60),
    MAX(EXTRACT(EPOCH FROM (COALESCE(placed_at, cancelled_at, now()) - boarding_start_at)) / 60)
  INTO v_total, v_avg_minutes, v_max_minutes
  FROM ed_boarders
  WHERE tenant_id = p_tenant_id
    AND status = 'awaiting_bed';

  -- Get pending transport count
  SELECT COUNT(*) INTO v_pending_transport
  FROM ed_boarders
  WHERE tenant_id = p_tenant_id
    AND status = 'bed_assigned';

  -- Count by escalation level
  SELECT jsonb_object_agg(escalation_level::text, cnt)
  INTO v_by_escalation
  FROM (
    SELECT escalation_level, COUNT(*) as cnt
    FROM ed_boarders
    WHERE tenant_id = p_tenant_id
      AND status = 'awaiting_bed'
    GROUP BY escalation_level
  ) sub;

  -- Count by acuity
  SELECT jsonb_object_agg(acuity_level, cnt)
  INTO v_by_acuity
  FROM (
    SELECT acuity_level, COUNT(*) as cnt
    FROM ed_boarders
    WHERE tenant_id = p_tenant_id
      AND status = 'awaiting_bed'
    GROUP BY acuity_level
  ) sub;

  RETURN jsonb_build_object(
    'total_boarders', COALESCE(v_total, 0),
    'avg_boarding_minutes', COALESCE(v_avg_minutes, 0),
    'longest_boarding_minutes', COALESCE(v_max_minutes, 0),
    'beds_assigned_pending_transport', COALESCE(v_pending_transport, 0),
    'boarders_by_escalation', COALESCE(v_by_escalation, '{}'::jsonb),
    'boarders_by_acuity', COALESCE(v_by_acuity, '{}'::jsonb),
    'target_boarding_minutes', 240
  );
END;
$function$;

-- ----------------------------------------------------------------------------
-- 8. predict_unit_discharges — returned PATIENT NAMES for any unit UUID.
--    Tenant resolved from the unit, asserted; query tenant-scoped.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.predict_unit_discharges(
  p_unit_id uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  patient_id uuid,
  patient_name text,
  bed_label text,
  days_in_hospital integer,
  expected_discharge_date date,
  discharge_likelihood text,
  los_remaining_days integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.hospital_units WHERE id = p_unit_id;

  -- A-0: caller must be authorized for the unit's tenant (raises for user
  -- callers when the unit doesn't exist — no unit enumeration)
  PERFORM public.assert_bed_management_caller(v_tenant_id);

  RETURN QUERY
  SELECT
    ba.patient_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') AS patient_name,
    b.bed_label,
    (p_date - ba.assigned_at::DATE) AS days_in_hospital,
    ba.expected_discharge_date,
    CASE
      WHEN ba.expected_discharge_date <= p_date THEN 'High'
      WHEN ba.expected_discharge_date <= p_date + 1 THEN 'Medium'
      ELSE 'Low'
    END AS discharge_likelihood,
    GREATEST(0, ba.expected_discharge_date - p_date) AS los_remaining_days
  FROM public.bed_assignments ba
  JOIN public.beds b ON b.id = ba.bed_id
  JOIN public.profiles p ON p.user_id = ba.patient_id
  WHERE ba.is_active = true
    AND b.unit_id = p_unit_id
    AND ba.tenant_id = v_tenant_id
    AND ba.expected_discharge_date IS NOT NULL
  ORDER BY ba.expected_discharge_date ASC, days_in_hospital DESC;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 9. process_adt_bed_update — client-supplied tenant, asserted; the identity
--    stamp can no longer be spoofed by user callers.
--    (Body otherwise identical to the live version.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_adt_bed_update(
  p_tenant_id uuid,
  p_event_type text,
  p_patient_id uuid,
  p_bed_room text,
  p_bed_position text DEFAULT 'A'::text,
  p_unit_code text DEFAULT NULL::text,
  p_previous_bed_room text DEFAULT NULL::text,
  p_previous_bed_position text DEFAULT 'A'::text,
  p_expected_los_days integer DEFAULT NULL::integer,
  p_discharge_disposition text DEFAULT NULL::text,
  p_adt_message_id text DEFAULT NULL::text,
  p_changed_by uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_bed_id UUID;
  v_previous_bed_id UUID;
  v_unit_id UUID;
  v_assignment_id UUID;
  v_result JSONB;
  v_expected_discharge DATE;
BEGIN
  -- Validate tenant
  IF p_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tenant ID is required'
    );
  END IF;

  -- A-0: caller must be authorized for the supplied tenant
  PERFORM public.assert_bed_management_caller(p_tenant_id);

  -- A-0: user callers cannot spoof the identity stamp
  IF COALESCE(auth.role(), current_user) NOT IN ('service_role', 'postgres') THEN
    p_changed_by := auth.uid();
  END IF;

  -- Find the target bed
  IF p_bed_room IS NOT NULL THEN
    SELECT b.id, b.unit_id INTO v_bed_id, v_unit_id
    FROM public.beds b
    JOIN public.hospital_units u ON b.unit_id = u.id
    WHERE b.tenant_id = p_tenant_id
      AND b.room_number = p_bed_room
      AND b.bed_position = COALESCE(p_bed_position, 'A')
      AND b.is_active = true
      AND (p_unit_code IS NULL OR u.unit_code = p_unit_code)
    LIMIT 1;
  END IF;

  -- Find previous bed for transfers
  IF p_previous_bed_room IS NOT NULL THEN
    SELECT b.id INTO v_previous_bed_id
    FROM public.beds b
    WHERE b.tenant_id = p_tenant_id
      AND b.room_number = p_previous_bed_room
      AND b.bed_position = COALESCE(p_previous_bed_position, 'A')
      AND b.is_active = true
    LIMIT 1;
  END IF;

  -- Calculate expected discharge if LOS provided
  IF p_expected_los_days IS NOT NULL THEN
    v_expected_discharge := CURRENT_DATE + p_expected_los_days;
  END IF;

  -- Process based on event type
  CASE p_event_type
    -- ========================================================================
    -- A01: Admit/Visit Notification
    -- ========================================================================
    WHEN 'A01' THEN
      IF v_bed_id IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Bed not found for admit',
          'room', p_bed_room,
          'position', p_bed_position
        );
      END IF;

      -- Update bed to occupied
      UPDATE public.beds
      SET status = 'occupied',
          status_changed_at = NOW(),
          status_changed_by = p_changed_by,
          status_notes = 'ADT A01 - Patient admitted',
          reserved_for_patient_id = NULL,
          reserved_until = NULL,
          updated_at = NOW()
      WHERE id = v_bed_id;

      -- Create bed assignment
      INSERT INTO public.bed_assignments (
        tenant_id,
        bed_id,
        patient_id,
        assigned_at,
        assigned_by,
        expected_discharge_date,
        discharge_disposition,
        is_active,
        adt_event_id,
        adt_source
      ) VALUES (
        p_tenant_id,
        v_bed_id,
        p_patient_id,
        NOW(),
        p_changed_by,
        v_expected_discharge,
        p_discharge_disposition,
        true,
        p_adt_message_id,
        'hl7'
      )
      ON CONFLICT (bed_id) WHERE is_active = true
      DO UPDATE SET
        patient_id = EXCLUDED.patient_id,
        assigned_at = NOW(),
        expected_discharge_date = COALESCE(EXCLUDED.expected_discharge_date, bed_assignments.expected_discharge_date),
        adt_event_id = EXCLUDED.adt_event_id,
        updated_at = NOW()
      RETURNING id INTO v_assignment_id;

      -- Record status history
      INSERT INTO public.bed_status_history (
        tenant_id,
        bed_id,
        previous_status,
        new_status,
        changed_at,
        changed_by,
        reason,
        related_assignment_id
      ) VALUES (
        p_tenant_id,
        v_bed_id,
        'available',
        'occupied',
        NOW(),
        p_changed_by,
        'ADT A01 - Patient admitted via HL7',
        v_assignment_id
      );

      v_result := jsonb_build_object(
        'success', true,
        'action', 'admit',
        'bed_id', v_bed_id,
        'assignment_id', v_assignment_id,
        'new_status', 'occupied'
      );

    -- ========================================================================
    -- A02: Transfer
    -- ========================================================================
    WHEN 'A02' THEN
      IF v_bed_id IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Destination bed not found for transfer',
          'room', p_bed_room,
          'position', p_bed_position
        );
      END IF;

      -- Mark previous bed as dirty (if found)
      IF v_previous_bed_id IS NOT NULL THEN
        UPDATE public.beds
        SET status = 'dirty',
            status_changed_at = NOW(),
            status_changed_by = p_changed_by,
            status_notes = 'ADT A02 - Patient transferred out',
            updated_at = NOW()
        WHERE id = v_previous_bed_id;

        -- Deactivate old assignment
        UPDATE public.bed_assignments
        SET is_active = false,
            discharged_at = NOW(),
            discharged_by = p_changed_by,
            actual_disposition = 'Transfer',
            updated_at = NOW()
        WHERE bed_id = v_previous_bed_id
          AND is_active = true;

        -- Record history for old bed
        INSERT INTO public.bed_status_history (
          tenant_id,
          bed_id,
          previous_status,
          new_status,
          changed_at,
          changed_by,
          reason
        ) VALUES (
          p_tenant_id,
          v_previous_bed_id,
          'occupied',
          'dirty',
          NOW(),
          p_changed_by,
          'ADT A02 - Patient transferred to ' || p_bed_room
        );
      END IF;

      -- Mark new bed as occupied
      UPDATE public.beds
      SET status = 'occupied',
          status_changed_at = NOW(),
          status_changed_by = p_changed_by,
          status_notes = 'ADT A02 - Patient transferred in',
          reserved_for_patient_id = NULL,
          reserved_until = NULL,
          updated_at = NOW()
      WHERE id = v_bed_id;

      -- Create new assignment
      INSERT INTO public.bed_assignments (
        tenant_id,
        bed_id,
        patient_id,
        assigned_at,
        assigned_by,
        expected_discharge_date,
        discharge_disposition,
        transferred_from_bed_id,
        transfer_reason,
        is_active,
        adt_event_id,
        adt_source
      ) VALUES (
        p_tenant_id,
        v_bed_id,
        p_patient_id,
        NOW(),
        p_changed_by,
        v_expected_discharge,
        p_discharge_disposition,
        v_previous_bed_id,
        'ADT A02 Transfer',
        true,
        p_adt_message_id,
        'hl7'
      )
      ON CONFLICT (bed_id) WHERE is_active = true
      DO UPDATE SET
        patient_id = EXCLUDED.patient_id,
        transferred_from_bed_id = EXCLUDED.transferred_from_bed_id,
        updated_at = NOW()
      RETURNING id INTO v_assignment_id;

      -- Record history for new bed
      INSERT INTO public.bed_status_history (
        tenant_id,
        bed_id,
        previous_status,
        new_status,
        changed_at,
        changed_by,
        reason,
        related_assignment_id
      ) VALUES (
        p_tenant_id,
        v_bed_id,
        'available',
        'occupied',
        NOW(),
        p_changed_by,
        'ADT A02 - Patient transferred from ' || COALESCE(p_previous_bed_room, 'unknown'),
        v_assignment_id
      );

      v_result := jsonb_build_object(
        'success', true,
        'action', 'transfer',
        'new_bed_id', v_bed_id,
        'previous_bed_id', v_previous_bed_id,
        'assignment_id', v_assignment_id,
        'new_status', 'occupied'
      );

    -- ========================================================================
    -- A03: Discharge/End Visit
    -- ========================================================================
    WHEN 'A03' THEN
      -- Find bed from active assignment if not specified
      IF v_bed_id IS NULL AND p_patient_id IS NOT NULL THEN
        SELECT ba.bed_id INTO v_bed_id
        FROM public.bed_assignments ba
        WHERE ba.tenant_id = p_tenant_id
          AND ba.patient_id = p_patient_id
          AND ba.is_active = true
        LIMIT 1;
      END IF;

      IF v_bed_id IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'No active bed assignment found for discharge',
          'patient_id', p_patient_id
        );
      END IF;

      -- Mark bed as dirty (needs cleaning)
      UPDATE public.beds
      SET status = 'dirty',
          status_changed_at = NOW(),
          status_changed_by = p_changed_by,
          status_notes = 'ADT A03 - Patient discharged, awaiting cleaning',
          updated_at = NOW()
      WHERE id = v_bed_id;

      -- End the assignment
      UPDATE public.bed_assignments
      SET is_active = false,
          discharged_at = NOW(),
          discharged_by = p_changed_by,
          actual_disposition = COALESCE(p_discharge_disposition, 'Discharged'),
          updated_at = NOW()
      WHERE bed_id = v_bed_id
        AND is_active = true
      RETURNING id INTO v_assignment_id;

      -- Record history
      INSERT INTO public.bed_status_history (
        tenant_id,
        bed_id,
        previous_status,
        new_status,
        changed_at,
        changed_by,
        reason,
        related_assignment_id
      ) VALUES (
        p_tenant_id,
        v_bed_id,
        'occupied',
        'dirty',
        NOW(),
        p_changed_by,
        'ADT A03 - Patient discharged (' || COALESCE(p_discharge_disposition, 'Unknown') || ')',
        v_assignment_id
      );

      v_result := jsonb_build_object(
        'success', true,
        'action', 'discharge',
        'bed_id', v_bed_id,
        'assignment_id', v_assignment_id,
        'new_status', 'dirty',
        'disposition', p_discharge_disposition
      );

    -- ========================================================================
    -- A04: Register Patient (Pre-admit)
    -- ========================================================================
    WHEN 'A04' THEN
      IF v_bed_id IS NOT NULL THEN
        -- Reserve the bed if specified
        UPDATE public.beds
        SET status = 'reserved',
            status_changed_at = NOW(),
            status_changed_by = p_changed_by,
            status_notes = 'ADT A04 - Reserved for incoming patient',
            reserved_for_patient_id = p_patient_id,
            reserved_until = NOW() + INTERVAL '24 hours',
            updated_at = NOW()
        WHERE id = v_bed_id
          AND status = 'available';

        -- Record history
        INSERT INTO public.bed_status_history (
          tenant_id,
          bed_id,
          previous_status,
          new_status,
          changed_at,
          changed_by,
          reason
        ) VALUES (
          p_tenant_id,
          v_bed_id,
          'available',
          'reserved',
          NOW(),
          p_changed_by,
          'ADT A04 - Bed reserved for pre-registration'
        );

        v_result := jsonb_build_object(
          'success', true,
          'action', 'register',
          'bed_id', v_bed_id,
          'new_status', 'reserved'
        );
      ELSE
        v_result := jsonb_build_object(
          'success', true,
          'action', 'register',
          'message', 'Patient registered, no bed assigned yet'
        );
      END IF;

    -- ========================================================================
    -- A11: Cancel Admit
    -- ========================================================================
    WHEN 'A11' THEN
      IF v_bed_id IS NULL AND p_patient_id IS NOT NULL THEN
        SELECT ba.bed_id INTO v_bed_id
        FROM public.bed_assignments ba
        WHERE ba.tenant_id = p_tenant_id
          AND ba.patient_id = p_patient_id
          AND ba.is_active = true
        LIMIT 1;
      END IF;

      IF v_bed_id IS NOT NULL THEN
        -- Mark bed as available
        UPDATE public.beds
        SET status = 'available',
            status_changed_at = NOW(),
            status_changed_by = p_changed_by,
            status_notes = 'ADT A11 - Admission cancelled',
            updated_at = NOW()
        WHERE id = v_bed_id;

        -- Delete/deactivate assignment
        DELETE FROM public.bed_assignments
        WHERE bed_id = v_bed_id
          AND is_active = true;

        -- Record history
        INSERT INTO public.bed_status_history (
          tenant_id,
          bed_id,
          previous_status,
          new_status,
          changed_at,
          changed_by,
          reason
        ) VALUES (
          p_tenant_id,
          v_bed_id,
          'occupied',
          'available',
          NOW(),
          p_changed_by,
          'ADT A11 - Admission cancelled'
        );

        v_result := jsonb_build_object(
          'success', true,
          'action', 'cancel_admit',
          'bed_id', v_bed_id,
          'new_status', 'available'
        );
      ELSE
        v_result := jsonb_build_object(
          'success', true,
          'action', 'cancel_admit',
          'message', 'No active assignment found to cancel'
        );
      END IF;

    -- ========================================================================
    -- A13: Cancel Discharge
    -- ========================================================================
    WHEN 'A13' THEN
      IF v_bed_id IS NULL AND p_patient_id IS NOT NULL THEN
        -- Find the most recently discharged assignment for this patient
        SELECT ba.bed_id, ba.id INTO v_bed_id, v_assignment_id
        FROM public.bed_assignments ba
        WHERE ba.tenant_id = p_tenant_id
          AND ba.patient_id = p_patient_id
          AND ba.is_active = false
          AND ba.discharged_at > NOW() - INTERVAL '24 hours'
        ORDER BY ba.discharged_at DESC
        LIMIT 1;
      END IF;

      IF v_bed_id IS NOT NULL THEN
        -- Mark bed as occupied again
        UPDATE public.beds
        SET status = 'occupied',
            status_changed_at = NOW(),
            status_changed_by = p_changed_by,
            status_notes = 'ADT A13 - Discharge cancelled',
            updated_at = NOW()
        WHERE id = v_bed_id;

        -- Reactivate assignment
        UPDATE public.bed_assignments
        SET is_active = true,
            discharged_at = NULL,
            discharged_by = NULL,
            actual_disposition = NULL,
            updated_at = NOW()
        WHERE id = v_assignment_id;

        -- Record history
        INSERT INTO public.bed_status_history (
          tenant_id,
          bed_id,
          previous_status,
          new_status,
          changed_at,
          changed_by,
          reason,
          related_assignment_id
        ) VALUES (
          p_tenant_id,
          v_bed_id,
          'dirty',
          'occupied',
          NOW(),
          p_changed_by,
          'ADT A13 - Discharge cancelled',
          v_assignment_id
        );

        v_result := jsonb_build_object(
          'success', true,
          'action', 'cancel_discharge',
          'bed_id', v_bed_id,
          'assignment_id', v_assignment_id,
          'new_status', 'occupied'
        );
      ELSE
        v_result := jsonb_build_object(
          'success', false,
          'error', 'No recent discharge found to cancel'
        );
      END IF;

    -- ========================================================================
    -- Default: Unsupported event type
    -- ========================================================================
    ELSE
      v_result := jsonb_build_object(
        'success', true,
        'action', 'ignored',
        'message', 'Event type ' || p_event_type || ' does not affect bed status'
      );
  END CASE;

  RETURN v_result;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 10. REVOKE anon EXECUTE across the whole bed/ED function surface.
--     PUBLIC included so the default-ACL path cannot re-grant it.
-- ----------------------------------------------------------------------------

-- SECURITY DEFINER RPCs (now internally gated)
REVOKE EXECUTE ON FUNCTION public.assign_patient_to_bed(uuid, uuid, integer, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.discharge_patient(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_bed_status(uuid, bed_status, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_bed_to_ed_boarder(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.place_ed_boarder(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_bed_by_location(uuid, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_ed_boarding_metrics(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.predict_unit_discharges(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_adt_bed_update(uuid, text, uuid, text, text, text, text, text, integer, text, text, uuid) FROM PUBLIC, anon;

-- SECURITY INVOKER helpers (RLS applies, but anon has no business calling them)
REVOKE EXECUTE ON FUNCTION public.find_available_beds(uuid, text, boolean, boolean, boolean, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_bed_forecast(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_ed_census(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_unit_census(uuid, timestamp with time zone) FROM PUBLIC, anon;

-- Trigger functions (never client-callable via RPC, but no reason to hold grants)
REVOKE EXECUTE ON FUNCTION public.create_evs_request_from_bed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_bed_dirty_evs_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_record_bed_status_change() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.assign_patient_to_bed(uuid, uuid, integer, text, text) IS
  'Assign patient to bed. A-0 hardened 2026-08-15: caller-tenant + role assertion, anon EXECUTE revoked.';
COMMENT ON FUNCTION public.discharge_patient(uuid, text) IS
  'Discharge patient from active bed assignment. A-0 hardened 2026-08-15: caller-tenant + role assertion, anon EXECUTE revoked.';
COMMENT ON FUNCTION public.update_bed_status(uuid, bed_status, text) IS
  'Update bed status with history. A-0 hardened 2026-08-15: caller-tenant + role assertion, anon EXECUTE revoked.';
