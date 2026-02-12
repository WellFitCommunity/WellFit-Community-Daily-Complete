-- =============================================================================
-- Bill-Unsigned-Note Gate
-- =============================================================================
-- Task #3: Encounter cannot advance to signed/ready_for_billing/billed unless
-- at least one clinical note is locked with a signature hash.
--
-- Gate enforcement:
--   ready_for_sign → signed : requires at least one locked+signed note
--   signed → ready_for_billing : re-validates (safety net)
--
-- This function is called by transition_encounter_status alongside
-- the provider assignment validation from Task #2.
-- =============================================================================

BEGIN;

-- 1. Validation function: check for signed clinical notes
CREATE OR REPLACE FUNCTION public.validate_encounter_notes_signed(
  p_encounter_id uuid,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_signed_note_count integer;
  v_total_note_count integer;
BEGIN
  -- Only gate these transitions
  IF p_new_status NOT IN ('signed', 'ready_for_billing', 'billed') THEN
    RETURN jsonb_build_object('valid', true);
  END IF;

  -- Count total clinical notes for this encounter
  SELECT count(*) INTO v_total_note_count
  FROM public.clinical_notes
  WHERE encounter_id = p_encounter_id;

  -- No notes at all
  IF v_total_note_count = 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'At least one clinical note is required before signing',
      'code', 'NO_CLINICAL_NOTES'
    );
  END IF;

  -- Count locked notes with signature hash
  SELECT count(*) INTO v_signed_note_count
  FROM public.clinical_notes
  WHERE encounter_id = p_encounter_id
    AND is_locked = true
    AND signature_hash IS NOT NULL;

  IF v_signed_note_count = 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', format(
        'Clinical notes must be signed before moving to %s. Found %s note(s) but none are locked with signature.',
        p_new_status, v_total_note_count
      ),
      'code', 'UNSIGNED_NOTES'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'signed_notes', v_signed_note_count,
    'total_notes', v_total_note_count
  );
END;
$$;

-- 2. Update transition function to include note signature validation
-- This replaces the version from Task #2 migration, adding the note gate
CREATE OR REPLACE FUNCTION public.transition_encounter_status(
  p_encounter_id uuid,
  p_new_status text,
  p_changed_by uuid,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status text;
  v_is_valid boolean;
  v_tenant_id uuid;
  v_provider_check jsonb;
  v_note_check jsonb;
BEGIN
  -- Get current encounter
  SELECT status, tenant_id INTO v_current_status, v_tenant_id
  FROM public.encounters WHERE id = p_encounter_id;

  IF v_current_status IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Encounter not found',
      'code', 'NOT_FOUND'
    );
  END IF;

  -- No-op check
  IF v_current_status = p_new_status THEN
    RETURN jsonb_build_object(
      'valid', true,
      'no_op', true,
      'message', 'Already in requested status'
    );
  END IF;

  -- Validate transition is allowed
  SELECT EXISTS (
    SELECT 1 FROM public.encounter_valid_transitions
    WHERE from_status = v_current_status AND to_status = p_new_status
  ) INTO v_is_valid;

  IF NOT v_is_valid THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', format('Invalid transition: %s -> %s', v_current_status, p_new_status),
      'code', 'INVALID_TRANSITION'
    );
  END IF;

  -- Validate provider assignment (Task #2)
  v_provider_check := public.validate_encounter_provider(p_encounter_id, p_new_status);
  IF NOT (v_provider_check->>'valid')::boolean THEN
    RETURN v_provider_check;
  END IF;

  -- Validate clinical note signature (Task #3)
  v_note_check := public.validate_encounter_notes_signed(p_encounter_id, p_new_status);
  IF NOT (v_note_check->>'valid')::boolean THEN
    RETURN v_note_check;
  END IF;

  -- Execute transition
  UPDATE public.encounters
  SET
    status = p_new_status,
    status_changed_at = now(),
    status_changed_by = p_changed_by,
    arrived_at = CASE WHEN p_new_status = 'arrived' THEN now() ELSE arrived_at END,
    triaged_at = CASE WHEN p_new_status = 'triaged' THEN now() ELSE triaged_at END,
    visit_started_at = CASE WHEN p_new_status = 'in_progress' THEN now() ELSE visit_started_at END,
    visit_ended_at = CASE WHEN p_new_status IN ('ready_for_sign', 'signed') THEN COALESCE(visit_ended_at, now()) ELSE visit_ended_at END,
    signed_at = CASE WHEN p_new_status = 'signed' THEN now() ELSE signed_at END,
    signed_by = CASE WHEN p_new_status = 'signed' THEN p_changed_by ELSE signed_by END
  WHERE id = p_encounter_id;

  -- Record history
  INSERT INTO public.encounter_status_history
    (encounter_id, from_status, to_status, changed_by, reason, metadata, tenant_id)
  VALUES
    (p_encounter_id, v_current_status, p_new_status, p_changed_by, p_reason, p_metadata, v_tenant_id);

  RETURN jsonb_build_object(
    'valid', true,
    'from_status', v_current_status,
    'to_status', p_new_status,
    'encounter_id', p_encounter_id,
    'changed_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.validate_encounter_notes_signed IS
  'Validates that clinical notes are locked and signed before encounter can advance to signed/ready_for_billing/billed';

COMMIT;

-- migrate:down
BEGIN;
DROP FUNCTION IF EXISTS public.validate_encounter_notes_signed CASCADE;
-- Note: transition_encounter_status is not dropped — previous version from Task #2 will remain
COMMIT;
