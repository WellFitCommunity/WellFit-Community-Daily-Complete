-- Migration: Clinical Note Locking and Amendment System
-- Purpose: Add immutable locking, amendment workflow, and field-level provenance tracking
-- Compliance: 21 CFR Part 11 (Electronic Records), HIPAA § 164.312(c)(1)
-- migrate:up

BEGIN;

-- =============================================================================
-- 1. ADD LOCKING COLUMNS TO EXISTING TABLES
-- =============================================================================

-- Add locking columns to clinical_notes
ALTER TABLE public.clinical_notes
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_at timestamptz,
ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS signature_hash text,
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES auth.users(id);

-- Add locking columns to ai_progress_notes
ALTER TABLE public.ai_progress_notes
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_at timestamptz,
ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS signature_hash text,
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- Add indexes for locking queries
CREATE INDEX IF NOT EXISTS idx_clinical_notes_locked ON public.clinical_notes(is_locked) WHERE is_locked = true;
CREATE INDEX IF NOT EXISTS idx_clinical_notes_locked_by ON public.clinical_notes(locked_by);
CREATE INDEX IF NOT EXISTS idx_ai_progress_notes_locked ON public.ai_progress_notes(is_locked) WHERE is_locked = true;
CREATE INDEX IF NOT EXISTS idx_ai_progress_notes_locked_by ON public.ai_progress_notes(locked_by);

-- =============================================================================
-- 2. CLINICAL NOTE AMENDMENTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.clinical_note_amendments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to original note (can be either clinical_notes or ai_progress_notes)
    note_type text NOT NULL CHECK (note_type IN ('clinical_note', 'ai_progress_note')),
    clinical_note_id uuid REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
    ai_progress_note_id uuid REFERENCES public.ai_progress_notes(id) ON DELETE CASCADE,

    -- Amendment type
    amendment_type text NOT NULL CHECK (amendment_type IN ('correction', 'addendum', 'late_entry', 'clarification')),

    -- Original vs new content
    original_content text,                -- Content before amendment (for corrections)
    amendment_content text NOT NULL,      -- The amendment text
    amendment_reason text NOT NULL,       -- Why the amendment was made

    -- Field-specific amendments
    field_amended text,                   -- Which field was amended (e.g., 'assessment', 'plan')

    -- Author info
    amended_by uuid NOT NULL REFERENCES auth.users(id),
    amended_at timestamptz NOT NULL DEFAULT now(),

    -- Approval workflow
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by uuid REFERENCES auth.users(id),
    approved_at timestamptz,
    rejection_reason text,

    -- Signature for legal authenticity
    signature_hash text,
    signed_at timestamptz,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT amendment_note_link CHECK (
        (note_type = 'clinical_note' AND clinical_note_id IS NOT NULL AND ai_progress_note_id IS NULL) OR
        (note_type = 'ai_progress_note' AND ai_progress_note_id IS NOT NULL AND clinical_note_id IS NULL)
    )
);

-- Indexes for amendments
CREATE INDEX IF NOT EXISTS idx_amendments_clinical_note ON public.clinical_note_amendments(clinical_note_id);
CREATE INDEX IF NOT EXISTS idx_amendments_ai_progress_note ON public.clinical_note_amendments(ai_progress_note_id);
CREATE INDEX IF NOT EXISTS idx_amendments_amended_by ON public.clinical_note_amendments(amended_by);
CREATE INDEX IF NOT EXISTS idx_amendments_status ON public.clinical_note_amendments(status);
CREATE INDEX IF NOT EXISTS idx_amendments_type ON public.clinical_note_amendments(amendment_type);
CREATE INDEX IF NOT EXISTS idx_amendments_amended_at ON public.clinical_note_amendments(amended_at DESC);

-- =============================================================================
-- 3. CLINICAL FIELD PROVENANCE TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.clinical_field_provenance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to note
    note_type text NOT NULL CHECK (note_type IN ('clinical_note', 'ai_progress_note')),
    clinical_note_id uuid REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
    ai_progress_note_id uuid REFERENCES public.ai_progress_notes(id) ON DELETE CASCADE,

    -- Field tracking
    field_name text NOT NULL,             -- e.g., 'content', 'assessment', 'plan'
    field_version integer NOT NULL DEFAULT 1,

    -- Value history
    previous_value text,
    new_value text NOT NULL,
    change_type text NOT NULL CHECK (change_type IN ('create', 'update', 'amendment', 'system_update')),

    -- Author tracking
    changed_by uuid NOT NULL REFERENCES auth.users(id),
    changed_at timestamptz NOT NULL DEFAULT now(),

    -- Change context
    change_reason text,
    change_source text DEFAULT 'manual' CHECK (change_source IN ('manual', 'ai_generated', 'imported', 'system')),

    -- Hash for integrity
    value_hash text,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT provenance_note_link CHECK (
        (note_type = 'clinical_note' AND clinical_note_id IS NOT NULL AND ai_progress_note_id IS NULL) OR
        (note_type = 'ai_progress_note' AND ai_progress_note_id IS NOT NULL AND clinical_note_id IS NULL)
    )
);

-- Indexes for provenance queries
CREATE INDEX IF NOT EXISTS idx_provenance_clinical_note ON public.clinical_field_provenance(clinical_note_id);
CREATE INDEX IF NOT EXISTS idx_provenance_ai_progress_note ON public.clinical_field_provenance(ai_progress_note_id);
CREATE INDEX IF NOT EXISTS idx_provenance_field_name ON public.clinical_field_provenance(field_name);
CREATE INDEX IF NOT EXISTS idx_provenance_changed_by ON public.clinical_field_provenance(changed_by);
CREATE INDEX IF NOT EXISTS idx_provenance_changed_at ON public.clinical_field_provenance(changed_at DESC);

-- =============================================================================
-- 4. NOTE LOCKING AUDIT TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.clinical_note_lock_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Note reference
    note_type text NOT NULL CHECK (note_type IN ('clinical_note', 'ai_progress_note')),
    clinical_note_id uuid,
    ai_progress_note_id uuid,

    -- Action
    action text NOT NULL CHECK (action IN ('lock', 'unlock_attempt', 'unlock_admin', 'signature_created')),

    -- Actor
    performed_by uuid NOT NULL REFERENCES auth.users(id),
    performed_at timestamptz NOT NULL DEFAULT now(),

    -- Context
    reason text,
    ip_address inet,
    user_agent text,

    -- Result
    success boolean NOT NULL DEFAULT true,
    failure_reason text,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_lock_audit_clinical_note ON public.clinical_note_lock_audit(clinical_note_id);
CREATE INDEX IF NOT EXISTS idx_lock_audit_ai_progress_note ON public.clinical_note_lock_audit(ai_progress_note_id);
CREATE INDEX IF NOT EXISTS idx_lock_audit_performed_by ON public.clinical_note_lock_audit(performed_by);
CREATE INDEX IF NOT EXISTS idx_lock_audit_performed_at ON public.clinical_note_lock_audit(performed_at DESC);

-- =============================================================================
-- 5. FUNCTIONS FOR LOCKING WORKFLOW
-- =============================================================================

-- Function: Lock a clinical note
CREATE OR REPLACE FUNCTION public.lock_clinical_note(
    p_note_id uuid,
    p_note_type text,
    p_locked_by uuid,
    p_signature_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_note_exists boolean;
    v_already_locked boolean;
    v_result jsonb;
BEGIN
    -- Validate note type
    IF p_note_type NOT IN ('clinical_note', 'ai_progress_note') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid note type');
    END IF;

    -- Check and lock based on note type
    IF p_note_type = 'clinical_note' THEN
        SELECT EXISTS(SELECT 1 FROM public.clinical_notes WHERE id = p_note_id) INTO v_note_exists;
        IF NOT v_note_exists THEN
            RETURN jsonb_build_object('success', false, 'error', 'Note not found');
        END IF;

        SELECT is_locked INTO v_already_locked FROM public.clinical_notes WHERE id = p_note_id;
        IF v_already_locked THEN
            RETURN jsonb_build_object('success', false, 'error', 'Note is already locked');
        END IF;

        UPDATE public.clinical_notes
        SET is_locked = true,
            locked_at = now(),
            locked_by = p_locked_by,
            signature_hash = p_signature_hash,
            version = COALESCE(version, 1) + 1
        WHERE id = p_note_id;

    ELSE -- ai_progress_note
        SELECT EXISTS(SELECT 1 FROM public.ai_progress_notes WHERE id = p_note_id) INTO v_note_exists;
        IF NOT v_note_exists THEN
            RETURN jsonb_build_object('success', false, 'error', 'Note not found');
        END IF;

        SELECT is_locked INTO v_already_locked FROM public.ai_progress_notes WHERE id = p_note_id;
        IF v_already_locked THEN
            RETURN jsonb_build_object('success', false, 'error', 'Note is already locked');
        END IF;

        UPDATE public.ai_progress_notes
        SET is_locked = true,
            locked_at = now(),
            locked_by = p_locked_by,
            signature_hash = p_signature_hash,
            version = COALESCE(version, 1) + 1
        WHERE id = p_note_id;
    END IF;

    -- Log the lock action
    INSERT INTO public.clinical_note_lock_audit (
        note_type, clinical_note_id, ai_progress_note_id,
        action, performed_by, success
    ) VALUES (
        p_note_type,
        CASE WHEN p_note_type = 'clinical_note' THEN p_note_id ELSE NULL END,
        CASE WHEN p_note_type = 'ai_progress_note' THEN p_note_id ELSE NULL END,
        'lock', p_locked_by, true
    );

    RETURN jsonb_build_object(
        'success', true,
        'locked_at', now(),
        'locked_by', p_locked_by
    );
END;
$$;

-- Function: Create an amendment for a locked note
CREATE OR REPLACE FUNCTION public.create_note_amendment(
    p_note_id uuid,
    p_note_type text,
    p_amendment_type text,
    p_amendment_content text,
    p_amendment_reason text,
    p_amended_by uuid,
    p_original_content text DEFAULT NULL,
    p_field_amended text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_amendment_id uuid;
    v_note_locked boolean;
BEGIN
    -- Verify note is locked (amendments only allowed on locked notes)
    IF p_note_type = 'clinical_note' THEN
        SELECT is_locked INTO v_note_locked FROM public.clinical_notes WHERE id = p_note_id;
    ELSE
        SELECT is_locked INTO v_note_locked FROM public.ai_progress_notes WHERE id = p_note_id;
    END IF;

    IF NOT COALESCE(v_note_locked, false) THEN
        RAISE EXCEPTION 'Amendments can only be created for locked notes';
    END IF;

    -- Create the amendment
    INSERT INTO public.clinical_note_amendments (
        note_type, clinical_note_id, ai_progress_note_id,
        amendment_type, original_content, amendment_content,
        amendment_reason, field_amended, amended_by
    ) VALUES (
        p_note_type,
        CASE WHEN p_note_type = 'clinical_note' THEN p_note_id ELSE NULL END,
        CASE WHEN p_note_type = 'ai_progress_note' THEN p_note_id ELSE NULL END,
        p_amendment_type, p_original_content, p_amendment_content,
        p_amendment_reason, p_field_amended, p_amended_by
    )
    RETURNING id INTO v_amendment_id;

    -- Record provenance
    INSERT INTO public.clinical_field_provenance (
        note_type, clinical_note_id, ai_progress_note_id,
        field_name, previous_value, new_value,
        change_type, changed_by, change_reason, change_source
    ) VALUES (
        p_note_type,
        CASE WHEN p_note_type = 'clinical_note' THEN p_note_id ELSE NULL END,
        CASE WHEN p_note_type = 'ai_progress_note' THEN p_note_id ELSE NULL END,
        COALESCE(p_field_amended, 'amendment'),
        p_original_content,
        p_amendment_content,
        'amendment', p_amended_by, p_amendment_reason, 'manual'
    );

    RETURN v_amendment_id;
END;
$$;

-- Function: Get note with amendments
CREATE OR REPLACE FUNCTION public.get_note_with_amendments(
    p_note_id uuid,
    p_note_type text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_note jsonb;
    v_amendments jsonb;
BEGIN
    -- Get base note
    IF p_note_type = 'clinical_note' THEN
        SELECT to_jsonb(cn.*) INTO v_note
        FROM public.clinical_notes cn
        WHERE cn.id = p_note_id;
    ELSE
        SELECT to_jsonb(apn.*) INTO v_note
        FROM public.ai_progress_notes apn
        WHERE apn.id = p_note_id;
    END IF;

    IF v_note IS NULL THEN
        RETURN NULL;
    END IF;

    -- Get amendments
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', a.id,
            'amendment_type', a.amendment_type,
            'amendment_content', a.amendment_content,
            'amendment_reason', a.amendment_reason,
            'field_amended', a.field_amended,
            'amended_by', a.amended_by,
            'amended_at', a.amended_at,
            'status', a.status,
            'approved_by', a.approved_by,
            'approved_at', a.approved_at
        ) ORDER BY a.amended_at
    ), '[]'::jsonb) INTO v_amendments
    FROM public.clinical_note_amendments a
    WHERE (p_note_type = 'clinical_note' AND a.clinical_note_id = p_note_id)
       OR (p_note_type = 'ai_progress_note' AND a.ai_progress_note_id = p_note_id);

    -- Return combined result
    RETURN v_note || jsonb_build_object('amendments', v_amendments);
END;
$$;

-- =============================================================================
-- 6. TRIGGER TO PREVENT LOCKED NOTE UPDATES
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prevent_locked_note_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Allow updates to these columns even when locked
    IF OLD.is_locked AND TG_OP = 'UPDATE' THEN
        IF NEW.is_locked != OLD.is_locked THEN
            -- Only admin can unlock (this is handled by RLS)
            RETURN NEW;
        END IF;

        -- Check if only allowed columns are being updated
        IF NEW.content != OLD.content
           OR NEW.type != OLD.type
           OR NEW.encounter_id != OLD.encounter_id THEN
            RAISE EXCEPTION 'Cannot modify locked clinical note. Use amendments instead.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_clinical_note_update ON public.clinical_notes;
CREATE TRIGGER trg_prevent_clinical_note_update
BEFORE UPDATE ON public.clinical_notes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_note_update();

-- Similar trigger for ai_progress_notes
CREATE OR REPLACE FUNCTION public.prevent_locked_ai_note_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.is_locked AND TG_OP = 'UPDATE' THEN
        IF NEW.is_locked != OLD.is_locked THEN
            RETURN NEW;
        END IF;

        -- Check if content fields are being changed
        IF NEW.summary::text != OLD.summary::text
           OR NEW.key_findings::text != OLD.key_findings::text
           OR NEW.recommendations::text != OLD.recommendations::text THEN
            RAISE EXCEPTION 'Cannot modify locked progress note. Use amendments instead.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ai_progress_note_update ON public.ai_progress_notes;
CREATE TRIGGER trg_prevent_ai_progress_note_update
BEFORE UPDATE ON public.ai_progress_notes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_ai_note_update();

-- =============================================================================
-- 7. ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE public.clinical_note_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_field_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_note_lock_audit ENABLE ROW LEVEL SECURITY;

-- Amendments policies
CREATE POLICY "amendments_select" ON public.clinical_note_amendments
    FOR SELECT TO authenticated
    USING (
        -- Can view amendments for notes they can access
        EXISTS (
            SELECT 1 FROM public.clinical_notes cn
            WHERE cn.id = clinical_note_amendments.clinical_note_id
            AND (cn.author_id = auth.uid() OR public.is_admin(auth.uid()))
        )
        OR EXISTS (
            SELECT 1 FROM public.ai_progress_notes apn
            WHERE apn.id = clinical_note_amendments.ai_progress_note_id
            AND (apn.provider_id = auth.uid() OR apn.reviewed_by = auth.uid() OR public.is_admin(auth.uid()))
        )
    );

CREATE POLICY "amendments_insert" ON public.clinical_note_amendments
    FOR INSERT TO authenticated
    WITH CHECK (
        amended_by = auth.uid()
    );

CREATE POLICY "amendments_update" ON public.clinical_note_amendments
    FOR UPDATE TO authenticated
    USING (
        amended_by = auth.uid() OR public.is_admin(auth.uid())
    );

-- Provenance policies (read-only for most users, system inserts)
CREATE POLICY "provenance_select" ON public.clinical_field_provenance
    FOR SELECT TO authenticated
    USING (
        changed_by = auth.uid() OR public.is_admin(auth.uid())
    );

CREATE POLICY "provenance_insert" ON public.clinical_field_provenance
    FOR INSERT TO authenticated
    WITH CHECK (
        changed_by = auth.uid() OR public.is_admin(auth.uid())
    );

-- Audit policies (read-only)
CREATE POLICY "lock_audit_select" ON public.clinical_note_lock_audit
    FOR SELECT TO authenticated
    USING (
        performed_by = auth.uid() OR public.is_admin(auth.uid())
    );

CREATE POLICY "lock_audit_insert" ON public.clinical_note_lock_audit
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- =============================================================================
-- 8. COMMENTS
-- =============================================================================

COMMENT ON TABLE public.clinical_note_amendments IS 'Amendment history for locked clinical notes - corrections, addendums, late entries';
COMMENT ON TABLE public.clinical_field_provenance IS 'Field-level change tracking for clinical notes (21 CFR Part 11 compliance)';
COMMENT ON TABLE public.clinical_note_lock_audit IS 'Audit trail for clinical note locking/unlocking operations';

COMMENT ON COLUMN public.clinical_notes.is_locked IS 'When true, note content cannot be modified - only amendments allowed';
COMMENT ON COLUMN public.clinical_notes.signature_hash IS 'Hash of note content at time of signing for non-repudiation';
COMMENT ON COLUMN public.clinical_notes.version IS 'Version number incremented on each significant change';

COMMENT ON FUNCTION public.lock_clinical_note IS 'Lock a clinical note to prevent direct modifications (amendments still allowed)';
COMMENT ON FUNCTION public.create_note_amendment IS 'Create an amendment for a locked clinical note';
COMMENT ON FUNCTION public.get_note_with_amendments IS 'Get a clinical note with all its amendments';

COMMIT;

-- migrate:down
BEGIN;

DROP TRIGGER IF EXISTS trg_prevent_clinical_note_update ON public.clinical_notes;
DROP TRIGGER IF EXISTS trg_prevent_ai_progress_note_update ON public.ai_progress_notes;

DROP FUNCTION IF EXISTS public.prevent_locked_note_update CASCADE;
DROP FUNCTION IF EXISTS public.prevent_locked_ai_note_update CASCADE;
DROP FUNCTION IF EXISTS public.lock_clinical_note CASCADE;
DROP FUNCTION IF EXISTS public.create_note_amendment CASCADE;
DROP FUNCTION IF EXISTS public.get_note_with_amendments CASCADE;

DROP TABLE IF EXISTS public.clinical_note_lock_audit CASCADE;
DROP TABLE IF EXISTS public.clinical_field_provenance CASCADE;
DROP TABLE IF EXISTS public.clinical_note_amendments CASCADE;

ALTER TABLE public.clinical_notes
DROP COLUMN IF EXISTS is_locked,
DROP COLUMN IF EXISTS locked_at,
DROP COLUMN IF EXISTS locked_by,
DROP COLUMN IF EXISTS signature_hash,
DROP COLUMN IF EXISTS version,
DROP COLUMN IF EXISTS patient_id;

ALTER TABLE public.ai_progress_notes
DROP COLUMN IF EXISTS is_locked,
DROP COLUMN IF EXISTS locked_at,
DROP COLUMN IF EXISTS locked_by,
DROP COLUMN IF EXISTS signature_hash,
DROP COLUMN IF EXISTS version;

COMMIT;
