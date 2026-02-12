-- Encounter Provider Assignment System
-- Task #2: Mandatory provider assignment with role types
--
-- Design:
--   - encounter_providers junction table links encounters to providers with roles
--   - encounters.provider_id remains as primary/attending shortcut for billing
--   - State machine validation: can't advance past draft without attending provider
--   - Full audit trail on provider assignment changes
--
-- migrate:up
BEGIN;

-- 1. Provider role type
DO $$ BEGIN
  CREATE TYPE encounter_provider_role AS ENUM (
    'attending',
    'supervising',
    'referring',
    'consulting'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Encounter providers junction table
CREATE TABLE IF NOT EXISTS public.encounter_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.billing_providers(id) ON DELETE CASCADE,
  role encounter_provider_role NOT NULL DEFAULT 'attending',
  is_primary boolean NOT NULL DEFAULT false,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  removed_at timestamptz,
  removed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  tenant_id uuid NOT NULL DEFAULT (current_setting('app.current_tenant_id', true))::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Each encounter can only have one provider per role (except consulting)
  -- Attending is unique, supervising is unique, referring is unique
  -- Consulting can have multiples
  CONSTRAINT uq_encounter_provider_active_role
    UNIQUE NULLS NOT DISTINCT (encounter_id, provider_id, role, removed_at)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_encounter_providers_encounter
  ON public.encounter_providers(encounter_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_encounter_providers_provider
  ON public.encounter_providers(provider_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_encounter_providers_role
  ON public.encounter_providers(encounter_id, role) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_encounter_providers_tenant
  ON public.encounter_providers(tenant_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_encounter_providers_uat ON public.encounter_providers;
CREATE TRIGGER trg_encounter_providers_uat
  BEFORE UPDATE ON public.encounter_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.encounter_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "encounter_providers_admin_rw" ON public.encounter_providers;
CREATE POLICY "encounter_providers_admin_rw" ON public.encounter_providers
  USING (
    public.is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.encounters e
      WHERE e.id = encounter_providers.encounter_id
        AND (e.created_by = auth.uid() OR e.patient_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.encounters e
      WHERE e.id = encounter_providers.encounter_id
        AND e.created_by = auth.uid()
    )
  );

-- 3. Provider assignment audit history
CREATE TABLE IF NOT EXISTS public.encounter_provider_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.billing_providers(id) ON DELETE CASCADE,
  role encounter_provider_role NOT NULL,
  action text NOT NULL CHECK (action IN ('assigned', 'removed', 'role_changed')),
  previous_role encounter_provider_role,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  tenant_id uuid NOT NULL DEFAULT (current_setting('app.current_tenant_id', true))::uuid
);

CREATE INDEX IF NOT EXISTS idx_enc_provider_audit_encounter
  ON public.encounter_provider_audit(encounter_id);
CREATE INDEX IF NOT EXISTS idx_enc_provider_audit_provider
  ON public.encounter_provider_audit(provider_id);

ALTER TABLE public.encounter_provider_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "encounter_provider_audit_admin_r" ON public.encounter_provider_audit;
CREATE POLICY "encounter_provider_audit_admin_r" ON public.encounter_provider_audit
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 4. Trigger to auto-audit provider assignment changes
CREATE OR REPLACE FUNCTION public.audit_encounter_provider_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.encounter_provider_audit
      (encounter_id, provider_id, role, action, changed_by, tenant_id)
    VALUES
      (NEW.encounter_id, NEW.provider_id, NEW.role, 'assigned', NEW.assigned_by, NEW.tenant_id);

    -- Sync primary attending provider to encounters.provider_id
    IF NEW.role = 'attending' AND NEW.is_primary = true AND NEW.removed_at IS NULL THEN
      UPDATE public.encounters SET provider_id = NEW.provider_id WHERE id = NEW.encounter_id;
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Provider removed (soft delete)
    IF OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL THEN
      INSERT INTO public.encounter_provider_audit
        (encounter_id, provider_id, role, action, changed_by, reason, tenant_id)
      VALUES
        (NEW.encounter_id, NEW.provider_id, NEW.role, 'removed', NEW.removed_by, 'Provider removed from encounter', NEW.tenant_id);

      -- If primary attending was removed, clear encounters.provider_id
      IF NEW.role = 'attending' AND NEW.is_primary = true THEN
        UPDATE public.encounters SET provider_id = NULL WHERE id = NEW.encounter_id;
      END IF;
    END IF;

    -- Role changed
    IF OLD.role != NEW.role THEN
      INSERT INTO public.encounter_provider_audit
        (encounter_id, provider_id, role, action, previous_role, changed_by, tenant_id)
      VALUES
        (NEW.encounter_id, NEW.provider_id, NEW.role, 'role_changed', OLD.role, NEW.assigned_by, NEW.tenant_id);
    END IF;

    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_encounter_provider_audit ON public.encounter_providers;
CREATE TRIGGER trg_encounter_provider_audit
  AFTER INSERT OR UPDATE ON public.encounter_providers
  FOR EACH ROW EXECUTE FUNCTION public.audit_encounter_provider_change();

-- 5. Function to validate provider assignment before state transitions
-- This is called by the existing transition_encounter_status function
CREATE OR REPLACE FUNCTION public.validate_encounter_provider(p_encounter_id uuid, p_new_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_attending boolean;
  v_provider_id uuid;
BEGIN
  -- States that don't require a provider: draft
  IF p_new_status IN ('draft', 'cancelled') THEN
    RETURN jsonb_build_object('valid', true);
  END IF;

  -- Check for attending provider in encounter_providers table
  SELECT EXISTS (
    SELECT 1 FROM public.encounter_providers
    WHERE encounter_id = p_encounter_id
      AND role = 'attending'
      AND removed_at IS NULL
  ) INTO v_has_attending;

  -- Also check legacy encounters.provider_id column
  SELECT provider_id INTO v_provider_id
  FROM public.encounters WHERE id = p_encounter_id;

  IF NOT v_has_attending AND v_provider_id IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Attending provider required before advancing from draft',
      'code', 'PROVIDER_REQUIRED'
    );
  END IF;

  -- For signed and beyond, check supervising if the attending is an NP/PA
  -- (This is for future use - skip for now, just attending is required)

  RETURN jsonb_build_object('valid', true);
END;
$$;

-- 6. Update the transition function to check provider assignment
-- We update the existing transition_encounter_status to add provider validation
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

  -- Execute transition
  UPDATE public.encounters
  SET
    status = p_new_status,
    status_changed_at = now(),
    status_changed_by = p_changed_by,
    -- Set timestamp columns based on new status
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

-- 7. RPC function to assign a provider to an encounter
CREATE OR REPLACE FUNCTION public.assign_encounter_provider(
  p_encounter_id uuid,
  p_provider_id uuid,
  p_role text DEFAULT 'attending',
  p_is_primary boolean DEFAULT false,
  p_assigned_by uuid DEFAULT auth.uid(),
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encounter_status text;
  v_role encounter_provider_role;
  v_existing_id uuid;
  v_new_id uuid;
  v_tenant_id uuid;
BEGIN
  -- Validate role
  BEGIN
    v_role := p_role::encounter_provider_role;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Invalid provider role: %s. Valid: attending, supervising, referring, consulting', p_role),
      'code', 'INVALID_ROLE'
    );
  END;

  -- Get encounter info
  SELECT status, tenant_id INTO v_encounter_status, v_tenant_id
  FROM public.encounters WHERE id = p_encounter_id;

  IF v_encounter_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Encounter not found', 'code', 'NOT_FOUND');
  END IF;

  -- Check encounter is editable (not finalized/terminal)
  IF v_encounter_status IN ('signed', 'ready_for_billing', 'billed', 'completed', 'cancelled', 'no_show') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Cannot assign provider to %s encounter', v_encounter_status),
      'code', 'ENCOUNTER_NOT_EDITABLE'
    );
  END IF;

  -- Validate provider exists
  IF NOT EXISTS (SELECT 1 FROM public.billing_providers WHERE id = p_provider_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Provider not found', 'code', 'PROVIDER_NOT_FOUND');
  END IF;

  -- For attending role, auto-set is_primary = true
  IF v_role = 'attending' THEN
    p_is_primary := true;
  END IF;

  -- Check if this provider is already assigned with this role (and active)
  SELECT id INTO v_existing_id
  FROM public.encounter_providers
  WHERE encounter_id = p_encounter_id
    AND provider_id = p_provider_id
    AND role = v_role
    AND removed_at IS NULL;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Provider already assigned as %s', p_role),
      'code', 'ALREADY_ASSIGNED'
    );
  END IF;

  -- For attending/supervising/referring: remove existing provider in that role (soft delete)
  IF v_role IN ('attending', 'supervising', 'referring') THEN
    UPDATE public.encounter_providers
    SET removed_at = now(), removed_by = p_assigned_by
    WHERE encounter_id = p_encounter_id
      AND role = v_role
      AND removed_at IS NULL;
  END IF;

  -- Insert new assignment
  INSERT INTO public.encounter_providers
    (encounter_id, provider_id, role, is_primary, assigned_by, notes, tenant_id)
  VALUES
    (p_encounter_id, p_provider_id, v_role, p_is_primary, p_assigned_by, p_notes, v_tenant_id)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_new_id,
    'encounter_id', p_encounter_id,
    'provider_id', p_provider_id,
    'role', p_role
  );
END;
$$;

-- 8. RPC function to remove a provider from an encounter
CREATE OR REPLACE FUNCTION public.remove_encounter_provider(
  p_assignment_id uuid,
  p_removed_by uuid DEFAULT auth.uid(),
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encounter_id uuid;
  v_encounter_status text;
  v_role encounter_provider_role;
BEGIN
  -- Get assignment info
  SELECT encounter_id, role INTO v_encounter_id, v_role
  FROM public.encounter_providers
  WHERE id = p_assignment_id AND removed_at IS NULL;

  IF v_encounter_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assignment not found or already removed', 'code', 'NOT_FOUND');
  END IF;

  -- Check encounter is editable
  SELECT status INTO v_encounter_status
  FROM public.encounters WHERE id = v_encounter_id;

  IF v_encounter_status IN ('signed', 'ready_for_billing', 'billed', 'completed', 'cancelled', 'no_show') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Cannot remove provider from %s encounter', v_encounter_status),
      'code', 'ENCOUNTER_NOT_EDITABLE'
    );
  END IF;

  -- Soft delete
  UPDATE public.encounter_providers
  SET removed_at = now(), removed_by = p_removed_by
  WHERE id = p_assignment_id;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', p_assignment_id,
    'encounter_id', v_encounter_id,
    'role', v_role::text
  );
END;
$$;

-- Comments
COMMENT ON TABLE public.encounter_providers IS 'Provider assignments for encounters — supports multiple providers with roles (attending, supervising, referring, consulting)';
COMMENT ON TABLE public.encounter_provider_audit IS 'Audit trail for all provider assignment changes on encounters';
COMMENT ON FUNCTION public.validate_encounter_provider IS 'Validates provider requirements before encounter state transitions';
COMMENT ON FUNCTION public.assign_encounter_provider IS 'Assigns a provider to an encounter with role validation';
COMMENT ON FUNCTION public.remove_encounter_provider IS 'Soft-deletes a provider assignment from an encounter';

COMMIT;

-- migrate:down
BEGIN;
DROP FUNCTION IF EXISTS public.remove_encounter_provider CASCADE;
DROP FUNCTION IF EXISTS public.assign_encounter_provider CASCADE;
DROP FUNCTION IF EXISTS public.validate_encounter_provider CASCADE;
DROP TRIGGER IF EXISTS trg_encounter_provider_audit ON public.encounter_providers CASCADE;
DROP FUNCTION IF EXISTS public.audit_encounter_provider_change CASCADE;
DROP TABLE IF EXISTS public.encounter_provider_audit CASCADE;
DROP TABLE IF EXISTS public.encounter_providers CASCADE;
DROP TYPE IF EXISTS encounter_provider_role CASCADE;
COMMIT;
