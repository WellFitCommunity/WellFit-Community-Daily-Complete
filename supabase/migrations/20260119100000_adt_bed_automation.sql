-- ============================================================================
-- ADT-Driven Bed Automation
-- ============================================================================
-- Purpose: Automatically update bed status when HL7v2 ADT messages are processed
--
-- ADT Event Mappings:
--   A01 (Admit) → bed status = 'occupied', create bed_assignment
--   A02 (Transfer) → old bed = 'dirty', new bed = 'occupied'
--   A03 (Discharge) → bed status = 'dirty', end bed_assignment
--   A04 (Register) → if bed pre-assigned, status = 'reserved'
--   A11 (Cancel Admit) → bed status = 'available', delete assignment
--   A12 (Cancel Transfer) → revert to previous state
--   A13 (Cancel Discharge) → bed status = 'occupied', reactivate assignment
--
-- Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: ADT Event Processing Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_adt_bed_update(
  p_tenant_id UUID,
  p_event_type TEXT,
  p_patient_id UUID,
  p_bed_room TEXT,
  p_bed_position TEXT DEFAULT 'A',
  p_unit_code TEXT DEFAULT NULL,
  p_previous_bed_room TEXT DEFAULT NULL,
  p_previous_bed_position TEXT DEFAULT 'A',
  p_expected_los_days INTEGER DEFAULT NULL,
  p_discharge_disposition TEXT DEFAULT NULL,
  p_adt_message_id TEXT DEFAULT NULL,
  p_changed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Grant execute to service role (for edge functions)
GRANT EXECUTE ON FUNCTION public.process_adt_bed_update TO service_role;

COMMENT ON FUNCTION public.process_adt_bed_update IS
  'Processes ADT events to automatically update bed status and assignments. Called from hl7-receive edge function.';

-- ============================================================================
-- PART 2: Helper function to find bed by location components
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_bed_by_location(
  p_tenant_id UUID,
  p_room TEXT,
  p_bed TEXT DEFAULT 'A',
  p_unit_code TEXT DEFAULT NULL,
  p_building TEXT DEFAULT NULL,
  p_floor TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bed_id UUID;
BEGIN
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
$$;

GRANT EXECUTE ON FUNCTION public.find_bed_by_location TO service_role;

-- ============================================================================
-- PART 3: Trigger to auto-start EVS request when bed goes dirty
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_bed_dirty_evs_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When bed status changes to 'dirty', we could auto-create an EVS request
  -- This is a placeholder for Phase 3 (EVS Integration)
  -- For now, just log the event

  IF NEW.status = 'dirty' AND OLD.status != 'dirty' THEN
    -- Future: INSERT INTO evs_requests ...
    -- For now, the status change is recorded in bed_status_history by the main function
    NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Don't create trigger yet - will add in EVS integration phase
-- DROP TRIGGER IF EXISTS trg_bed_dirty_evs ON public.beds;
-- CREATE TRIGGER trg_bed_dirty_evs
--   AFTER UPDATE ON public.beds
--   FOR EACH ROW
--   WHEN (NEW.status = 'dirty' AND OLD.status != 'dirty')
--   EXECUTE FUNCTION public.trg_bed_dirty_evs_request();

-- ============================================================================
-- PART 4: Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'ADT Bed Automation Installed';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Function: process_adt_bed_update()';
  RAISE NOTICE '';
  RAISE NOTICE 'Supported ADT Events:';
  RAISE NOTICE '  A01 (Admit)     → bed occupied, create assignment';
  RAISE NOTICE '  A02 (Transfer)  → old bed dirty, new bed occupied';
  RAISE NOTICE '  A03 (Discharge) → bed dirty, end assignment';
  RAISE NOTICE '  A04 (Register)  → reserve bed if specified';
  RAISE NOTICE '  A11 (Cancel Admit) → bed available, delete assignment';
  RAISE NOTICE '  A13 (Cancel Discharge) → bed occupied, reactivate assignment';
  RAISE NOTICE '';
  RAISE NOTICE 'Integration: Call from hl7-receive edge function';
  RAISE NOTICE '=================================================================';
END $$;

COMMIT;
