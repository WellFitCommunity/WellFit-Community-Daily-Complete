-- Reconcile the clinical-note locking/amendment subsystem onto the LIVE immutability model.
--
-- Background (clinical adversarial audit, RPC/table drift): noteLockingService /
-- noteAmendmentService target a subsystem defined by 20260123000002, which is recorded as
-- applied in the registry but whose objects do NOT exist live (3 tables + 3 functions absent).
-- That migration assumed clinical_notes was MUTABLE (it added is_locked columns + UPDATEd
-- them). But the live system makes clinical_notes ABSOLUTELY immutable:
-- prevent_clinical_note_modification raises on ANY update/delete ("create an addendum instead").
--
-- Per Maria 2026-06-02: reconcile ONTO the live immutability system. So this migration:
--   * Creates the 3 append-only tables the services need (NO lock columns on the notes,
--     NO triggers on clinical_notes — nothing that conflicts with immutability).
--   * Recreates the 3 functions immutability-safe: locking is recorded as an audit row
--     (not an UPDATE of the immutable note); "is_locked" is DERIVED from the audit table.
-- Amendment approval workflow (status pending->approved/rejected) is preserved as designed;
-- amendments default to 'pending' (no auto-approval) pending Akima's clinical sign-off on
-- who may approve.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. clinical_note_amendments (append-only addenda — the immutability-endorsed path)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinical_note_amendments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    note_type text NOT NULL CHECK (note_type IN ('clinical_note', 'ai_progress_note')),
    clinical_note_id uuid REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
    ai_progress_note_id uuid REFERENCES public.ai_progress_notes(id) ON DELETE CASCADE,
    amendment_type text NOT NULL CHECK (amendment_type IN ('correction', 'addendum', 'late_entry', 'clarification')),
    original_content text,
    amendment_content text NOT NULL,
    amendment_reason text NOT NULL,
    field_amended text,
    amended_by uuid NOT NULL REFERENCES auth.users(id),
    amended_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by uuid REFERENCES auth.users(id),
    approved_at timestamptz,
    rejection_reason text,
    signature_hash text,
    signed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT amendment_note_link CHECK (
        (note_type = 'clinical_note' AND clinical_note_id IS NOT NULL AND ai_progress_note_id IS NULL) OR
        (note_type = 'ai_progress_note' AND ai_progress_note_id IS NOT NULL AND clinical_note_id IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_amendments_clinical_note ON public.clinical_note_amendments(clinical_note_id);
CREATE INDEX IF NOT EXISTS idx_amendments_ai_progress_note ON public.clinical_note_amendments(ai_progress_note_id);
CREATE INDEX IF NOT EXISTS idx_amendments_amended_by ON public.clinical_note_amendments(amended_by);
CREATE INDEX IF NOT EXISTS idx_amendments_status ON public.clinical_note_amendments(status);
CREATE INDEX IF NOT EXISTS idx_amendments_amended_at ON public.clinical_note_amendments(amended_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. clinical_field_provenance (field-level change history — 21 CFR Part 11)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinical_field_provenance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    note_type text NOT NULL CHECK (note_type IN ('clinical_note', 'ai_progress_note')),
    clinical_note_id uuid REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
    ai_progress_note_id uuid REFERENCES public.ai_progress_notes(id) ON DELETE CASCADE,
    field_name text NOT NULL,
    field_version integer NOT NULL DEFAULT 1,
    previous_value text,
    new_value text NOT NULL,
    change_type text NOT NULL CHECK (change_type IN ('create', 'update', 'amendment', 'system_update')),
    changed_by uuid NOT NULL REFERENCES auth.users(id),
    changed_at timestamptz NOT NULL DEFAULT now(),
    change_reason text,
    change_source text DEFAULT 'manual' CHECK (change_source IN ('manual', 'ai_generated', 'imported', 'system')),
    value_hash text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT provenance_note_link CHECK (
        (note_type = 'clinical_note' AND clinical_note_id IS NOT NULL AND ai_progress_note_id IS NULL) OR
        (note_type = 'ai_progress_note' AND ai_progress_note_id IS NOT NULL AND clinical_note_id IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_provenance_clinical_note ON public.clinical_field_provenance(clinical_note_id);
CREATE INDEX IF NOT EXISTS idx_provenance_ai_progress_note ON public.clinical_field_provenance(ai_progress_note_id);
CREATE INDEX IF NOT EXISTS idx_provenance_changed_by ON public.clinical_field_provenance(changed_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. clinical_note_lock_audit (append-only; the SOURCE OF TRUTH for "is locked")
--    + signature_hash, since the note itself can't store it (immutable).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinical_note_lock_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    note_type text NOT NULL CHECK (note_type IN ('clinical_note', 'ai_progress_note')),
    clinical_note_id uuid,
    ai_progress_note_id uuid,
    action text NOT NULL CHECK (action IN ('lock', 'unlock_attempt', 'unlock_admin', 'signature_created')),
    performed_by uuid NOT NULL REFERENCES auth.users(id),
    performed_at timestamptz NOT NULL DEFAULT now(),
    reason text,
    ip_address inet,
    user_agent text,
    success boolean NOT NULL DEFAULT true,
    failure_reason text,
    signature_hash text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lock_audit_clinical_note ON public.clinical_note_lock_audit(clinical_note_id);
CREATE INDEX IF NOT EXISTS idx_lock_audit_ai_progress_note ON public.clinical_note_lock_audit(ai_progress_note_id);
CREATE INDEX IF NOT EXISTS idx_lock_audit_performed_by ON public.clinical_note_lock_audit(performed_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — note-access-based (matches the design the services were built against),
-- isolation flows from the parent note's own tenant/RLS. WITH CHECK added on UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.clinical_note_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_field_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_note_lock_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amendments_select" ON public.clinical_note_amendments
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.clinical_notes cn
                WHERE cn.id = clinical_note_amendments.clinical_note_id
                AND (cn.author_id = auth.uid() OR public.is_admin(auth.uid())))
        OR EXISTS (SELECT 1 FROM public.ai_progress_notes apn
                WHERE apn.id = clinical_note_amendments.ai_progress_note_id
                AND (apn.provider_id = auth.uid() OR apn.reviewed_by = auth.uid() OR public.is_admin(auth.uid())))
    );
CREATE POLICY "amendments_insert" ON public.clinical_note_amendments
    FOR INSERT TO authenticated WITH CHECK (amended_by = auth.uid());
CREATE POLICY "amendments_update" ON public.clinical_note_amendments
    FOR UPDATE TO authenticated
    USING (amended_by = auth.uid() OR public.is_admin(auth.uid()))
    WITH CHECK (amended_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "provenance_select" ON public.clinical_field_provenance
    FOR SELECT TO authenticated USING (changed_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "provenance_insert" ON public.clinical_field_provenance
    FOR INSERT TO authenticated WITH CHECK (changed_by = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "lock_audit_select" ON public.clinical_note_lock_audit
    FOR SELECT TO authenticated USING (performed_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "lock_audit_insert" ON public.clinical_note_lock_audit
    FOR INSERT TO authenticated WITH CHECK (performed_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Functions — immutability-safe (locking is an audit row; never an UPDATE of the note)
-- ─────────────────────────────────────────────────────────────────────────────

-- Lock = record an append-only lock row. "Already locked" is derived from the audit table.
CREATE OR REPLACE FUNCTION public.lock_clinical_note(
    p_note_id uuid,
    p_note_type text,
    p_locked_by uuid,
    p_signature_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_note_exists boolean;
    v_already_locked boolean;
BEGIN
    IF p_note_type NOT IN ('clinical_note', 'ai_progress_note') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid note type');
    END IF;

    IF p_note_type = 'clinical_note' THEN
        SELECT EXISTS(SELECT 1 FROM public.clinical_notes WHERE id = p_note_id) INTO v_note_exists;
    ELSE
        SELECT EXISTS(SELECT 1 FROM public.ai_progress_notes WHERE id = p_note_id) INTO v_note_exists;
    END IF;
    IF NOT v_note_exists THEN
        RETURN jsonb_build_object('success', false, 'error', 'Note not found');
    END IF;

    -- Lock state lives in the audit table (the note is immutable and has no lock column).
    SELECT EXISTS(
        SELECT 1 FROM public.clinical_note_lock_audit
        WHERE action = 'lock' AND success = true
          AND ((p_note_type = 'clinical_note' AND clinical_note_id = p_note_id)
            OR (p_note_type = 'ai_progress_note' AND ai_progress_note_id = p_note_id))
    ) INTO v_already_locked;
    IF v_already_locked THEN
        RETURN jsonb_build_object('success', false, 'error', 'Note is already locked');
    END IF;

    INSERT INTO public.clinical_note_lock_audit (
        note_type, clinical_note_id, ai_progress_note_id,
        action, performed_by, success, signature_hash
    ) VALUES (
        p_note_type,
        CASE WHEN p_note_type = 'clinical_note' THEN p_note_id ELSE NULL END,
        CASE WHEN p_note_type = 'ai_progress_note' THEN p_note_id ELSE NULL END,
        'lock', p_locked_by, true, p_signature_hash
    );

    RETURN jsonb_build_object(
        'success', true,
        'locked_at', now(),
        'locked_by', p_locked_by,
        'signature_hash', p_signature_hash
    );
END;
$$;

-- Create an amendment (append-only addendum) for a locked note + record provenance.
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
SET search_path = public
AS $$
DECLARE
    v_amendment_id uuid;
    v_note_locked boolean;
BEGIN
    -- Amendments only allowed on locked notes (lock state from the audit table).
    SELECT EXISTS(
        SELECT 1 FROM public.clinical_note_lock_audit
        WHERE action = 'lock' AND success = true
          AND ((p_note_type = 'clinical_note' AND clinical_note_id = p_note_id)
            OR (p_note_type = 'ai_progress_note' AND ai_progress_note_id = p_note_id))
    ) INTO v_note_locked;
    IF NOT v_note_locked THEN
        RAISE EXCEPTION 'Amendments can only be created for locked notes';
    END IF;

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

    INSERT INTO public.clinical_field_provenance (
        note_type, clinical_note_id, ai_progress_note_id,
        field_name, previous_value, new_value,
        change_type, changed_by, change_reason, change_source
    ) VALUES (
        p_note_type,
        CASE WHEN p_note_type = 'clinical_note' THEN p_note_id ELSE NULL END,
        CASE WHEN p_note_type = 'ai_progress_note' THEN p_note_id ELSE NULL END,
        COALESCE(p_field_amended, 'amendment'),
        p_original_content, p_amendment_content,
        'amendment', p_amended_by, p_amendment_reason, 'manual'
    );

    RETURN v_amendment_id;
END;
$$;

-- Read a note + its amendments, with is_locked/locked_at/locked_by DERIVED from the audit
-- table (the note has no lock columns). SECURITY DEFINER so lock state is visible to any
-- authorized reader of the note, not only whoever locked it.
CREATE OR REPLACE FUNCTION public.get_note_with_amendments(
    p_note_id uuid,
    p_note_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_note jsonb;
    v_amendments jsonb;
    v_lock record;
BEGIN
    IF p_note_type = 'clinical_note' THEN
        SELECT to_jsonb(cn.*) INTO v_note FROM public.clinical_notes cn WHERE cn.id = p_note_id;
    ELSE
        SELECT to_jsonb(apn.*) INTO v_note FROM public.ai_progress_notes apn WHERE apn.id = p_note_id;
    END IF;
    IF v_note IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT performed_at, performed_by INTO v_lock
    FROM public.clinical_note_lock_audit
    WHERE action = 'lock' AND success = true
      AND ((p_note_type = 'clinical_note' AND clinical_note_id = p_note_id)
        OR (p_note_type = 'ai_progress_note' AND ai_progress_note_id = p_note_id))
    ORDER BY performed_at DESC
    LIMIT 1;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', a.id,
            'amendment_type', a.amendment_type,
            'original_content', a.original_content,
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

    RETURN v_note || jsonb_build_object(
        'is_locked', (v_lock.performed_at IS NOT NULL),
        'locked_at', v_lock.performed_at,
        'locked_by', v_lock.performed_by,
        'amendments', v_amendments
    );
END;
$$;

COMMENT ON TABLE public.clinical_note_amendments IS 'Append-only amendments/addenda for clinical notes (reconciled onto clinical_notes immutability). 2026-06-02.';
COMMENT ON TABLE public.clinical_note_lock_audit IS 'Append-only note-lock audit; source of truth for is_locked (the note itself is immutable). 2026-06-02.';
COMMENT ON FUNCTION public.lock_clinical_note IS 'Record a note lock (audit row + signature); does NOT mutate the immutable note. 2026-06-02.';
