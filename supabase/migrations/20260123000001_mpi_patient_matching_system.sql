-- Migration: MPI Patient Matching System
-- Purpose: Master Patient Index with matching algorithms, deduplication, and merge workflows
-- migrate:up

BEGIN;

-- =============================================================================
-- 1. MPI IDENTITY RECORDS TABLE
-- Stores identity data for probabilistic matching across enterprise
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mpi_identity_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Primary patient link
    patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Enterprise-wide identifier for cross-tenant linking
    enterprise_mpi_id uuid DEFAULT gen_random_uuid(),

    -- Identity attributes (normalized for matching)
    first_name_normalized text,           -- Lowercase, trimmed, diacritics removed
    last_name_normalized text,
    middle_name_normalized text,

    -- Phonetic encodings for fuzzy matching
    first_name_soundex text,              -- Soundex encoding
    last_name_soundex text,
    first_name_metaphone text,            -- Double Metaphone encoding
    last_name_metaphone text,

    -- Demographics
    date_of_birth date,
    gender text,
    ssn_last_four text,                   -- Last 4 only for matching (encrypted)

    -- Contact identifiers
    phone_normalized text,                 -- Digits only
    email_normalized text,                 -- Lowercase

    -- Address for matching
    address_normalized text,
    city_normalized text,
    state text,
    zip_code text,

    -- Medical identifiers
    mrn text,                             -- Medical Record Number
    mrn_assigning_authority text,         -- Which system assigned MRN

    -- Identity confidence
    identity_confidence_score numeric(5,2) DEFAULT 100.0,
    identity_verified_at timestamptz,
    identity_verified_by uuid REFERENCES auth.users(id),
    verification_method text,             -- 'document', 'biometric', 'manual', etc.

    -- Matching metadata
    match_hash text,                      -- Hash of key matching fields for quick comparison
    last_matched_at timestamptz,
    match_count integer DEFAULT 0,

    -- Status
    is_golden_record boolean DEFAULT false, -- Is this the authoritative record?
    is_active boolean DEFAULT true,
    deactivated_at timestamptz,
    deactivated_reason text,

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Constraints
    CONSTRAINT mpi_identity_records_patient_tenant_unique UNIQUE (patient_id, tenant_id)
);

-- Indexes for matching performance
CREATE INDEX IF NOT EXISTS idx_mpi_identity_first_soundex ON public.mpi_identity_records (first_name_soundex);
CREATE INDEX IF NOT EXISTS idx_mpi_identity_last_soundex ON public.mpi_identity_records (last_name_soundex);
CREATE INDEX IF NOT EXISTS idx_mpi_identity_first_metaphone ON public.mpi_identity_records (first_name_metaphone);
CREATE INDEX IF NOT EXISTS idx_mpi_identity_last_metaphone ON public.mpi_identity_records (last_name_metaphone);
CREATE INDEX IF NOT EXISTS idx_mpi_identity_dob ON public.mpi_identity_records (date_of_birth);
CREATE INDEX IF NOT EXISTS idx_mpi_identity_phone ON public.mpi_identity_records (phone_normalized);
CREATE INDEX IF NOT EXISTS idx_mpi_identity_mrn ON public.mpi_identity_records (mrn, mrn_assigning_authority);
CREATE INDEX IF NOT EXISTS idx_mpi_identity_enterprise ON public.mpi_identity_records (enterprise_mpi_id);
CREATE INDEX IF NOT EXISTS idx_mpi_identity_tenant ON public.mpi_identity_records (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mpi_identity_match_hash ON public.mpi_identity_records (match_hash);
CREATE INDEX IF NOT EXISTS idx_mpi_identity_golden ON public.mpi_identity_records (is_golden_record) WHERE is_golden_record = true;

-- =============================================================================
-- 2. MPI MATCH CANDIDATES TABLE
-- Queue of potential duplicate patients awaiting review
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mpi_match_candidates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The two patient records that potentially match
    patient_id_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    patient_id_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    identity_record_a uuid NOT NULL REFERENCES public.mpi_identity_records(id) ON DELETE CASCADE,
    identity_record_b uuid NOT NULL REFERENCES public.mpi_identity_records(id) ON DELETE CASCADE,

    -- Tenant context
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Match scoring
    overall_match_score numeric(5,2) NOT NULL,  -- 0-100 percentage
    match_algorithm_version text NOT NULL,       -- e.g., 'v1.0-jaro-soundex'

    -- Individual field scores (JSONB for flexibility)
    field_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- Example: {"first_name": 95.5, "last_name": 100, "dob": 100, "address": 75.0}

    -- Matching criteria used
    matching_fields_used text[] NOT NULL,
    blocking_key text,                           -- Hash used for blocking algorithm

    -- Review workflow
    status text NOT NULL DEFAULT 'pending',      -- 'pending', 'under_review', 'confirmed_match', 'confirmed_not_match', 'merged', 'deferred'
    priority text DEFAULT 'normal',              -- 'low', 'normal', 'high', 'urgent'

    -- Review tracking
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamptz,
    review_decision text,                        -- 'merge', 'link', 'not_match', 'needs_more_info'
    review_notes text,

    -- Auto-match thresholds
    auto_match_eligible boolean DEFAULT false,   -- Score above auto-merge threshold
    auto_match_blocked_reason text,              -- Why it wasn't auto-merged

    -- Timestamps
    detected_at timestamptz DEFAULT now() NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,

    -- Prevent duplicate candidate pairs
    CONSTRAINT mpi_match_candidates_unique_pair UNIQUE (patient_id_a, patient_id_b),
    CONSTRAINT mpi_match_candidates_ordered_pair CHECK (patient_id_a < patient_id_b)
);

-- Indexes for candidate queue
CREATE INDEX IF NOT EXISTS idx_mpi_candidates_status ON public.mpi_match_candidates (status);
CREATE INDEX IF NOT EXISTS idx_mpi_candidates_priority ON public.mpi_match_candidates (priority, detected_at);
CREATE INDEX IF NOT EXISTS idx_mpi_candidates_score ON public.mpi_match_candidates (overall_match_score DESC);
CREATE INDEX IF NOT EXISTS idx_mpi_candidates_tenant ON public.mpi_match_candidates (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mpi_candidates_patient_a ON public.mpi_match_candidates (patient_id_a);
CREATE INDEX IF NOT EXISTS idx_mpi_candidates_patient_b ON public.mpi_match_candidates (patient_id_b);
CREATE INDEX IF NOT EXISTS idx_mpi_candidates_pending ON public.mpi_match_candidates (status, priority) WHERE status = 'pending';

-- =============================================================================
-- 3. MPI MERGE HISTORY TABLE
-- Complete audit trail of all merge/unmerge operations with rollback support
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mpi_merge_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Merge operation identifiers
    merge_batch_id uuid NOT NULL DEFAULT gen_random_uuid(),  -- Groups related merges
    operation_type text NOT NULL,                             -- 'merge', 'unmerge', 'link', 'unlink'

    -- The winning (surviving) record
    surviving_patient_id uuid NOT NULL REFERENCES auth.users(id),
    surviving_identity_record_id uuid REFERENCES public.mpi_identity_records(id),

    -- The record being merged/deprecated
    deprecated_patient_id uuid NOT NULL,  -- No FK - patient may be deleted
    deprecated_identity_record_id uuid,

    -- Tenant context
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Pre-merge snapshots for rollback
    surviving_record_snapshot jsonb NOT NULL,    -- Full profile before merge
    deprecated_record_snapshot jsonb NOT NULL,   -- Full profile before merge
    related_data_snapshot jsonb,                 -- Associated records (encounters, notes, etc.)

    -- Post-merge state
    merged_record_snapshot jsonb,                -- Resulting merged profile

    -- Data movement tracking
    data_migrations jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- Example: [{"table": "encounters", "ids": ["uuid1", "uuid2"], "action": "reassign"}]

    -- Match candidate that triggered this merge
    match_candidate_id uuid REFERENCES public.mpi_match_candidates(id),

    -- Merge decision details
    merge_decision_score numeric(5,2),
    merge_decision_reason text NOT NULL,
    merge_rules_applied text[],

    -- Operator info
    performed_by uuid NOT NULL REFERENCES auth.users(id),
    performed_at timestamptz DEFAULT now() NOT NULL,

    -- Rollback support
    is_reversible boolean DEFAULT true,
    rolled_back boolean DEFAULT false,
    rolled_back_at timestamptz,
    rolled_back_by uuid REFERENCES auth.users(id),
    rollback_reason text,
    rollback_batch_id uuid,                      -- Links to the unmerge operation

    -- Verification
    verified_by uuid REFERENCES auth.users(id),
    verified_at timestamptz,
    verification_notes text,

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for merge history
CREATE INDEX IF NOT EXISTS idx_mpi_merge_batch ON public.mpi_merge_history (merge_batch_id);
CREATE INDEX IF NOT EXISTS idx_mpi_merge_surviving ON public.mpi_merge_history (surviving_patient_id);
CREATE INDEX IF NOT EXISTS idx_mpi_merge_deprecated ON public.mpi_merge_history (deprecated_patient_id);
CREATE INDEX IF NOT EXISTS idx_mpi_merge_tenant ON public.mpi_merge_history (tenant_id);
CREATE INDEX IF NOT EXISTS idx_mpi_merge_performed_at ON public.mpi_merge_history (performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_mpi_merge_reversible ON public.mpi_merge_history (is_reversible, rolled_back) WHERE is_reversible = true AND rolled_back = false;
CREATE INDEX IF NOT EXISTS idx_mpi_merge_operation ON public.mpi_merge_history (operation_type);

-- =============================================================================
-- 4. MPI MATCHING CONFIGURATION TABLE
-- Configurable matching rules per tenant
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mpi_matching_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,

    -- Match thresholds
    auto_merge_threshold numeric(5,2) DEFAULT 98.0,      -- Auto-merge above this score
    review_threshold numeric(5,2) DEFAULT 75.0,          -- Queue for review above this
    definite_no_match_threshold numeric(5,2) DEFAULT 30.0, -- Definite non-match below this

    -- Field weights (must sum to 100)
    field_weights jsonb NOT NULL DEFAULT '{
        "first_name": 15,
        "last_name": 20,
        "date_of_birth": 25,
        "ssn_last_four": 15,
        "phone": 10,
        "address": 10,
        "mrn": 5
    }'::jsonb,

    -- Blocking configuration (performance optimization)
    blocking_keys text[] DEFAULT ARRAY['last_name_soundex', 'date_of_birth', 'zip_code'],

    -- Algorithm settings
    use_jaro_winkler boolean DEFAULT true,
    use_soundex boolean DEFAULT true,
    use_metaphone boolean DEFAULT true,
    jaro_winkler_threshold numeric(3,2) DEFAULT 0.85,

    -- Matching rules
    require_dob_match boolean DEFAULT true,
    allow_partial_ssn_match boolean DEFAULT true,
    phone_match_weight_boost numeric(3,2) DEFAULT 1.5,  -- Verified phone gets weighted more

    -- Auto-merge rules
    auto_merge_enabled boolean DEFAULT false,           -- Must be explicitly enabled
    auto_merge_requires_mrn_match boolean DEFAULT true,
    auto_merge_max_per_day integer DEFAULT 10,          -- Safety limit

    -- Review workflow
    default_review_priority text DEFAULT 'normal',
    escalate_high_volume boolean DEFAULT true,
    high_volume_threshold integer DEFAULT 50,           -- Escalate if more candidates

    -- Audit settings
    audit_all_matches boolean DEFAULT true,
    retain_match_history_days integer DEFAULT 2555,     -- 7 years for HIPAA

    -- Status
    is_active boolean DEFAULT true,

    -- Timestamps
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- =============================================================================
-- 5. HELPER FUNCTIONS
-- =============================================================================

-- Function: Generate Soundex encoding
CREATE OR REPLACE FUNCTION public.mpi_soundex(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    result text := '';
    cleaned text;
    first_char char(1);
    current_char char(1);
    current_code char(1);
    prev_code char(1) := '';
    i integer;
BEGIN
    IF input_text IS NULL OR length(trim(input_text)) = 0 THEN
        RETURN NULL;
    END IF;

    -- Clean and uppercase
    cleaned := upper(regexp_replace(input_text, '[^A-Za-z]', '', 'g'));
    IF length(cleaned) = 0 THEN
        RETURN NULL;
    END IF;

    -- First character is kept as-is
    first_char := substring(cleaned, 1, 1);
    result := first_char;

    -- Soundex code mapping
    FOR i IN 2..length(cleaned) LOOP
        current_char := substring(cleaned, i, 1);

        current_code := CASE
            WHEN current_char IN ('B', 'F', 'P', 'V') THEN '1'
            WHEN current_char IN ('C', 'G', 'J', 'K', 'Q', 'S', 'X', 'Z') THEN '2'
            WHEN current_char IN ('D', 'T') THEN '3'
            WHEN current_char = 'L' THEN '4'
            WHEN current_char IN ('M', 'N') THEN '5'
            WHEN current_char = 'R' THEN '6'
            ELSE ''
        END;

        IF current_code != '' AND current_code != prev_code THEN
            result := result || current_code;
            IF length(result) = 4 THEN
                EXIT;
            END IF;
        END IF;

        prev_code := current_code;
    END LOOP;

    -- Pad with zeros to 4 characters
    RETURN rpad(result, 4, '0');
END;
$$;

-- Function: Calculate Jaro-Winkler similarity
CREATE OR REPLACE FUNCTION public.mpi_jaro_winkler(s1 text, s2 text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    len1 integer;
    len2 integer;
    max_dist integer;
    matches integer := 0;
    transpositions integer := 0;
    s1_matches boolean[];
    s2_matches boolean[];
    jaro numeric;
    prefix_length integer := 0;
    i integer;
    j integer;
    k integer;
BEGIN
    IF s1 IS NULL OR s2 IS NULL THEN
        RETURN 0;
    END IF;

    s1 := upper(trim(s1));
    s2 := upper(trim(s2));

    IF s1 = s2 THEN
        RETURN 1.0;
    END IF;

    len1 := length(s1);
    len2 := length(s2);

    IF len1 = 0 OR len2 = 0 THEN
        RETURN 0;
    END IF;

    max_dist := GREATEST(len1, len2) / 2 - 1;
    IF max_dist < 0 THEN
        max_dist := 0;
    END IF;

    -- Initialize match arrays
    s1_matches := array_fill(false, ARRAY[len1]);
    s2_matches := array_fill(false, ARRAY[len2]);

    -- Find matches
    FOR i IN 1..len1 LOOP
        FOR j IN GREATEST(1, i - max_dist)..LEAST(len2, i + max_dist) LOOP
            IF NOT s2_matches[j] AND substring(s1, i, 1) = substring(s2, j, 1) THEN
                s1_matches[i] := true;
                s2_matches[j] := true;
                matches := matches + 1;
                EXIT;
            END IF;
        END LOOP;
    END LOOP;

    IF matches = 0 THEN
        RETURN 0;
    END IF;

    -- Count transpositions
    k := 1;
    FOR i IN 1..len1 LOOP
        IF s1_matches[i] THEN
            WHILE NOT s2_matches[k] LOOP
                k := k + 1;
            END LOOP;
            IF substring(s1, i, 1) != substring(s2, k, 1) THEN
                transpositions := transpositions + 1;
            END IF;
            k := k + 1;
        END IF;
    END LOOP;

    -- Calculate Jaro similarity
    jaro := (matches::numeric / len1 + matches::numeric / len2 + (matches - transpositions / 2)::numeric / matches) / 3;

    -- Calculate common prefix (up to 4 characters)
    FOR i IN 1..LEAST(4, LEAST(len1, len2)) LOOP
        IF substring(s1, i, 1) = substring(s2, i, 1) THEN
            prefix_length := prefix_length + 1;
        ELSE
            EXIT;
        END IF;
    END LOOP;

    -- Apply Winkler modification
    RETURN jaro + (prefix_length * 0.1 * (1 - jaro));
END;
$$;

-- Function: Normalize name for matching
CREATE OR REPLACE FUNCTION public.mpi_normalize_name(input_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF input_name IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN lower(
        regexp_replace(
            regexp_replace(
                translate(
                    trim(input_name),
                    'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ',
                    'AAAAAAACEEEEIIIIDNOOOOOOUUUUYTsaaaaaaaceeeeiiiidnoooooouuuuyty'
                ),
                '[^a-zA-Z ]', '', 'g'  -- Remove non-alpha
            ),
            '\s+', ' ', 'g'  -- Normalize spaces
        )
    );
END;
$$;

-- Function: Normalize phone for matching
CREATE OR REPLACE FUNCTION public.mpi_normalize_phone(input_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF input_phone IS NULL THEN
        RETURN NULL;
    END IF;

    -- Keep only digits
    RETURN regexp_replace(input_phone, '[^0-9]', '', 'g');
END;
$$;

-- Function: Generate match hash for blocking
CREATE OR REPLACE FUNCTION public.mpi_generate_match_hash(
    p_first_name text,
    p_last_name text,
    p_dob date,
    p_zip text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN encode(
        sha256(
            (COALESCE(public.mpi_soundex(p_first_name), '') ||
             COALESCE(public.mpi_soundex(p_last_name), '') ||
             COALESCE(p_dob::text, '') ||
             COALESCE(left(p_zip, 5), ''))::bytea
        ),
        'hex'
    );
END;
$$;

-- Function: Calculate overall match score between two identity records
CREATE OR REPLACE FUNCTION public.mpi_calculate_match_score(
    record_a_id uuid,
    record_b_id uuid
)
RETURNS TABLE (
    overall_score numeric,
    field_scores jsonb,
    matched_fields text[]
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    rec_a public.mpi_identity_records;
    rec_b public.mpi_identity_records;
    config public.mpi_matching_config;
    scores jsonb := '{}'::jsonb;
    total_score numeric := 0;
    total_weight numeric := 0;
    matched text[] := '{}';
    field_score numeric;
    weights jsonb;
BEGIN
    -- Fetch both records
    SELECT * INTO rec_a FROM public.mpi_identity_records WHERE id = record_a_id;
    SELECT * INTO rec_b FROM public.mpi_identity_records WHERE id = record_b_id;

    IF rec_a IS NULL OR rec_b IS NULL THEN
        RETURN QUERY SELECT 0::numeric, '{}'::jsonb, '{}'::text[];
        RETURN;
    END IF;

    -- Get tenant config or use defaults
    SELECT * INTO config FROM public.mpi_matching_config
    WHERE tenant_id = rec_a.tenant_id AND is_active = true;

    IF config IS NULL THEN
        weights := '{"first_name": 15, "last_name": 20, "date_of_birth": 25, "ssn_last_four": 15, "phone": 10, "address": 10, "mrn": 5}'::jsonb;
    ELSE
        weights := config.field_weights;
    END IF;

    -- First name comparison
    IF rec_a.first_name_normalized IS NOT NULL AND rec_b.first_name_normalized IS NOT NULL THEN
        field_score := public.mpi_jaro_winkler(rec_a.first_name_normalized, rec_b.first_name_normalized) * 100;
        scores := scores || jsonb_build_object('first_name', field_score);
        total_score := total_score + (field_score * (weights->>'first_name')::numeric);
        total_weight := total_weight + (weights->>'first_name')::numeric;
        IF field_score >= 85 THEN
            matched := array_append(matched, 'first_name');
        END IF;
    END IF;

    -- Last name comparison
    IF rec_a.last_name_normalized IS NOT NULL AND rec_b.last_name_normalized IS NOT NULL THEN
        field_score := public.mpi_jaro_winkler(rec_a.last_name_normalized, rec_b.last_name_normalized) * 100;
        scores := scores || jsonb_build_object('last_name', field_score);
        total_score := total_score + (field_score * (weights->>'last_name')::numeric);
        total_weight := total_weight + (weights->>'last_name')::numeric;
        IF field_score >= 85 THEN
            matched := array_append(matched, 'last_name');
        END IF;
    END IF;

    -- Date of birth comparison (exact match)
    IF rec_a.date_of_birth IS NOT NULL AND rec_b.date_of_birth IS NOT NULL THEN
        IF rec_a.date_of_birth = rec_b.date_of_birth THEN
            field_score := 100;
            matched := array_append(matched, 'date_of_birth');
        ELSE
            field_score := 0;
        END IF;
        scores := scores || jsonb_build_object('date_of_birth', field_score);
        total_score := total_score + (field_score * (weights->>'date_of_birth')::numeric);
        total_weight := total_weight + (weights->>'date_of_birth')::numeric;
    END IF;

    -- SSN last four comparison (exact match)
    IF rec_a.ssn_last_four IS NOT NULL AND rec_b.ssn_last_four IS NOT NULL THEN
        IF rec_a.ssn_last_four = rec_b.ssn_last_four THEN
            field_score := 100;
            matched := array_append(matched, 'ssn_last_four');
        ELSE
            field_score := 0;
        END IF;
        scores := scores || jsonb_build_object('ssn_last_four', field_score);
        total_score := total_score + (field_score * (weights->>'ssn_last_four')::numeric);
        total_weight := total_weight + (weights->>'ssn_last_four')::numeric;
    END IF;

    -- Phone comparison (exact match on normalized)
    IF rec_a.phone_normalized IS NOT NULL AND rec_b.phone_normalized IS NOT NULL THEN
        IF rec_a.phone_normalized = rec_b.phone_normalized THEN
            field_score := 100;
            matched := array_append(matched, 'phone');
        ELSE
            field_score := 0;
        END IF;
        scores := scores || jsonb_build_object('phone', field_score);
        total_score := total_score + (field_score * (weights->>'phone')::numeric);
        total_weight := total_weight + (weights->>'phone')::numeric;
    END IF;

    -- Address comparison (Jaro-Winkler)
    IF rec_a.address_normalized IS NOT NULL AND rec_b.address_normalized IS NOT NULL THEN
        field_score := public.mpi_jaro_winkler(rec_a.address_normalized, rec_b.address_normalized) * 100;
        scores := scores || jsonb_build_object('address', field_score);
        total_score := total_score + (field_score * (weights->>'address')::numeric);
        total_weight := total_weight + (weights->>'address')::numeric;
        IF field_score >= 80 THEN
            matched := array_append(matched, 'address');
        END IF;
    END IF;

    -- MRN comparison (exact match within same assigning authority)
    IF rec_a.mrn IS NOT NULL AND rec_b.mrn IS NOT NULL
       AND rec_a.mrn_assigning_authority = rec_b.mrn_assigning_authority THEN
        IF rec_a.mrn = rec_b.mrn THEN
            field_score := 100;
            matched := array_append(matched, 'mrn');
        ELSE
            field_score := 0;
        END IF;
        scores := scores || jsonb_build_object('mrn', field_score);
        total_score := total_score + (field_score * (weights->>'mrn')::numeric);
        total_weight := total_weight + (weights->>'mrn')::numeric;
    END IF;

    -- Calculate weighted average
    IF total_weight > 0 THEN
        overall_score := total_score / total_weight;
    ELSE
        overall_score := 0;
    END IF;

    RETURN QUERY SELECT overall_score, scores, matched;
END;
$$;

-- =============================================================================
-- 6. TRIGGERS
-- =============================================================================

-- Trigger: Update timestamps
CREATE OR REPLACE FUNCTION public.mpi_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mpi_identity_records_updated_at
    BEFORE UPDATE ON public.mpi_identity_records
    FOR EACH ROW EXECUTE FUNCTION public.mpi_update_timestamp();

CREATE TRIGGER mpi_match_candidates_updated_at
    BEFORE UPDATE ON public.mpi_match_candidates
    FOR EACH ROW EXECUTE FUNCTION public.mpi_update_timestamp();

CREATE TRIGGER mpi_merge_history_updated_at
    BEFORE UPDATE ON public.mpi_merge_history
    FOR EACH ROW EXECUTE FUNCTION public.mpi_update_timestamp();

CREATE TRIGGER mpi_matching_config_updated_at
    BEFORE UPDATE ON public.mpi_matching_config
    FOR EACH ROW EXECUTE FUNCTION public.mpi_update_timestamp();

-- Trigger: Auto-populate identity record from profiles on insert/update
CREATE OR REPLACE FUNCTION public.mpi_sync_from_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Update normalized fields
    NEW.first_name_normalized := public.mpi_normalize_name(
        (SELECT first_name FROM public.profiles WHERE user_id = NEW.patient_id)
    );
    NEW.last_name_normalized := public.mpi_normalize_name(
        (SELECT last_name FROM public.profiles WHERE user_id = NEW.patient_id)
    );

    -- Generate phonetic encodings
    NEW.first_name_soundex := public.mpi_soundex(NEW.first_name_normalized);
    NEW.last_name_soundex := public.mpi_soundex(NEW.last_name_normalized);

    -- Normalize phone
    NEW.phone_normalized := public.mpi_normalize_phone(
        (SELECT phone FROM public.profiles WHERE user_id = NEW.patient_id)
    );

    -- Generate match hash
    NEW.match_hash := public.mpi_generate_match_hash(
        NEW.first_name_normalized,
        NEW.last_name_normalized,
        NEW.date_of_birth,
        NEW.zip_code
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mpi_identity_sync_before_insert
    BEFORE INSERT ON public.mpi_identity_records
    FOR EACH ROW EXECUTE FUNCTION public.mpi_sync_from_profile();

CREATE TRIGGER mpi_identity_sync_before_update
    BEFORE UPDATE ON public.mpi_identity_records
    FOR EACH ROW EXECUTE FUNCTION public.mpi_sync_from_profile();

-- =============================================================================
-- 7. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.mpi_identity_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpi_match_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpi_merge_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpi_matching_config ENABLE ROW LEVEL SECURITY;

-- MPI Identity Records: Tenant isolation + role-based access
CREATE POLICY mpi_identity_records_tenant_isolation ON public.mpi_identity_records
    FOR ALL
    USING (
        tenant_id IN (
            SELECT p.tenant_id FROM public.profiles p
            WHERE p.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid()
            AND p.role_code IN (1, 2)  -- super_admin, system_admin
        )
    );

-- MPI Match Candidates: Only reviewers can see
CREATE POLICY mpi_match_candidates_access ON public.mpi_match_candidates
    FOR ALL
    USING (
        tenant_id IN (
            SELECT p.tenant_id FROM public.profiles p
            WHERE p.user_id = auth.uid()
            AND p.role_code IN (1, 2, 3, 5, 6, 9)  -- admin, data_analyst, registration roles
        )
    );

-- MPI Merge History: Audit trail accessible to admins
CREATE POLICY mpi_merge_history_access ON public.mpi_merge_history
    FOR ALL
    USING (
        tenant_id IN (
            SELECT p.tenant_id FROM public.profiles p
            WHERE p.user_id = auth.uid()
            AND p.role_code IN (1, 2, 3)  -- admin roles only
        )
    );

-- MPI Matching Config: Admin only
CREATE POLICY mpi_matching_config_access ON public.mpi_matching_config
    FOR ALL
    USING (
        tenant_id IN (
            SELECT p.tenant_id FROM public.profiles p
            WHERE p.user_id = auth.uid()
            AND p.role_code IN (1, 2)  -- super_admin, system_admin only
        )
    );

-- =============================================================================
-- 8. COMMENTS
-- =============================================================================

COMMENT ON TABLE public.mpi_identity_records IS 'Master Patient Index identity records with phonetic encodings for probabilistic matching';
COMMENT ON TABLE public.mpi_match_candidates IS 'Queue of potential duplicate patient records awaiting review';
COMMENT ON TABLE public.mpi_merge_history IS 'Complete audit trail of patient merge/unmerge operations with rollback support';
COMMENT ON TABLE public.mpi_matching_config IS 'Per-tenant configuration for MPI matching algorithms and thresholds';

COMMENT ON FUNCTION public.mpi_soundex IS 'Generate Soundex phonetic encoding for fuzzy name matching';
COMMENT ON FUNCTION public.mpi_jaro_winkler IS 'Calculate Jaro-Winkler string similarity (0-1 score)';
COMMENT ON FUNCTION public.mpi_normalize_name IS 'Normalize name for matching (lowercase, remove diacritics, trim)';
COMMENT ON FUNCTION public.mpi_calculate_match_score IS 'Calculate weighted match score between two MPI identity records';

COMMIT;

-- migrate:down
BEGIN;

DROP TABLE IF EXISTS public.mpi_matching_config CASCADE;
DROP TABLE IF EXISTS public.mpi_merge_history CASCADE;
DROP TABLE IF EXISTS public.mpi_match_candidates CASCADE;
DROP TABLE IF EXISTS public.mpi_identity_records CASCADE;

DROP FUNCTION IF EXISTS public.mpi_soundex CASCADE;
DROP FUNCTION IF EXISTS public.mpi_jaro_winkler CASCADE;
DROP FUNCTION IF EXISTS public.mpi_normalize_name CASCADE;
DROP FUNCTION IF EXISTS public.mpi_normalize_phone CASCADE;
DROP FUNCTION IF EXISTS public.mpi_generate_match_hash CASCADE;
DROP FUNCTION IF EXISTS public.mpi_calculate_match_score CASCADE;
DROP FUNCTION IF EXISTS public.mpi_update_timestamp CASCADE;
DROP FUNCTION IF EXISTS public.mpi_sync_from_profile CASCADE;

COMMIT;
