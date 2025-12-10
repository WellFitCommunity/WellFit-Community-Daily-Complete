-- ============================================================================
-- INTELLIGENT MIGRATION ENGINE - Supporting Database Objects
-- Version: 1.0.0
-- Purpose: Self-learning migration engine with DNA fingerprinting
-- ============================================================================

-- ============================================================================
-- SECTION 1: CORE TABLES
-- ============================================================================

-- Table to store learned mappings (the "memory" of the system)
CREATE TABLE IF NOT EXISTS migration_learned_mappings (
    mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_column_normalized VARCHAR(255) NOT NULL,
    source_patterns TEXT[],
    source_system VARCHAR(100),
    target_table VARCHAR(100) NOT NULL,
    target_column VARCHAR(100) NOT NULL,
    transform_function VARCHAR(100),
    success_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    confidence DECIMAL(5,4) DEFAULT 0.5,
    last_used TIMESTAMPTZ DEFAULT NOW(),
    organization_id UUID REFERENCES hc_organization(organization_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_column_normalized, source_system, target_table, target_column, organization_id)
);

COMMENT ON TABLE migration_learned_mappings IS 'Stores learned field mappings from past migrations. Confidence increases with successful migrations.';

-- Table to store DNA patterns for similarity matching
CREATE TABLE IF NOT EXISTS migration_source_dna (
    dna_id VARCHAR(16) PRIMARY KEY,
    source_type VARCHAR(50) NOT NULL,
    source_system VARCHAR(100),
    structure_hash VARCHAR(20),
    signature_vector DECIMAL[],
    column_count INT,
    columns JSONB,
    success_rate DECIMAL(5,4),
    organization_id UUID REFERENCES hc_organization(organization_id) ON DELETE CASCADE,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE migration_source_dna IS 'Stores DNA fingerprints of source data structures for similarity matching.';

-- Migration batch tracking
CREATE TABLE IF NOT EXISTS migration_batch (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES hc_organization(organization_id) ON DELETE CASCADE,
    source_system VARCHAR(100),
    source_file_name VARCHAR(255),
    record_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'PENDING',  -- PENDING, PROCESSING, COMPLETED, COMPLETED_WITH_ERRORS, FAILED, DRY_RUN
    dna_id VARCHAR(16) REFERENCES migration_source_dna(dna_id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE migration_batch IS 'Tracks individual migration runs for auditing and rollback purposes.';

-- Migration results for learning feedback
CREATE TABLE IF NOT EXISTS migration_results (
    result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES migration_batch(batch_id) ON DELETE CASCADE,
    source_column VARCHAR(255) NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    target_column VARCHAR(100) NOT NULL,
    records_attempted INT DEFAULT 0,
    records_succeeded INT DEFAULT 0,
    records_failed INT DEFAULT 0,
    error_types TEXT[],
    user_accepted BOOLEAN DEFAULT true,
    user_corrected_table VARCHAR(100),
    user_corrected_column VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE migration_results IS 'Stores results of individual field mappings for machine learning feedback.';

-- Migration error log for detailed debugging
CREATE TABLE IF NOT EXISTS migration_errors (
    error_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES migration_batch(batch_id) ON DELETE CASCADE,
    row_number INT,
    source_column VARCHAR(255),
    source_value TEXT,
    target_table VARCHAR(100),
    target_column VARCHAR(100),
    error_type VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE migration_errors IS 'Detailed error log for migration debugging.';

-- ============================================================================
-- SECTION 2: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_learned_mappings_source
    ON migration_learned_mappings(source_column_normalized, source_system);
CREATE INDEX IF NOT EXISTS idx_learned_mappings_confidence
    ON migration_learned_mappings(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_learned_mappings_org
    ON migration_learned_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_source_dna_hash
    ON migration_source_dna(structure_hash);
CREATE INDEX IF NOT EXISTS idx_source_dna_org
    ON migration_source_dna(organization_id);
CREATE INDEX IF NOT EXISTS idx_migration_batch_org
    ON migration_batch(organization_id);
CREATE INDEX IF NOT EXISTS idx_migration_batch_status
    ON migration_batch(status);
CREATE INDEX IF NOT EXISTS idx_migration_results_batch
    ON migration_results(batch_id);
CREATE INDEX IF NOT EXISTS idx_migration_errors_batch
    ON migration_errors(batch_id);

-- ============================================================================
-- SECTION 3: RLS POLICIES (Multi-tenant isolation)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE migration_learned_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_source_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_errors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS migration_learned_mappings_org_isolation ON migration_learned_mappings;
DROP POLICY IF EXISTS migration_learned_mappings_global_read ON migration_learned_mappings;
DROP POLICY IF EXISTS migration_source_dna_org_isolation ON migration_source_dna;
DROP POLICY IF EXISTS migration_source_dna_global_read ON migration_source_dna;
DROP POLICY IF EXISTS migration_batch_org_isolation ON migration_batch;
DROP POLICY IF EXISTS migration_results_org_isolation ON migration_results;
DROP POLICY IF EXISTS migration_errors_org_isolation ON migration_errors;

-- Learned mappings: Org can see their own + global (null org_id) mappings
CREATE POLICY migration_learned_mappings_org_isolation ON migration_learned_mappings
    FOR ALL
    USING (
        organization_id IS NULL
        OR organization_id IN (
            SELECT organization_id FROM hc_staff
            WHERE user_account_id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM hc_staff
            WHERE user_account_id = auth.uid()
        )
    );

-- Source DNA: Same isolation logic
CREATE POLICY migration_source_dna_org_isolation ON migration_source_dna
    FOR ALL
    USING (
        organization_id IS NULL
        OR organization_id IN (
            SELECT organization_id FROM hc_staff
            WHERE user_account_id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM hc_staff
            WHERE user_account_id = auth.uid()
        )
    );

-- Batch: Strict org isolation
CREATE POLICY migration_batch_org_isolation ON migration_batch
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM hc_staff
            WHERE user_account_id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM hc_staff
            WHERE user_account_id = auth.uid()
        )
    );

-- Results: Via batch relationship
CREATE POLICY migration_results_org_isolation ON migration_results
    FOR ALL
    USING (
        batch_id IN (
            SELECT batch_id FROM migration_batch
            WHERE organization_id IN (
                SELECT organization_id FROM hc_staff
                WHERE user_account_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        batch_id IN (
            SELECT batch_id FROM migration_batch
            WHERE organization_id IN (
                SELECT organization_id FROM hc_staff
                WHERE user_account_id = auth.uid()
            )
        )
    );

-- Errors: Via batch relationship
CREATE POLICY migration_errors_org_isolation ON migration_errors
    FOR ALL
    USING (
        batch_id IN (
            SELECT batch_id FROM migration_batch
            WHERE organization_id IN (
                SELECT organization_id FROM hc_staff
                WHERE user_account_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        batch_id IN (
            SELECT batch_id FROM migration_batch
            WHERE organization_id IN (
                SELECT organization_id FROM hc_staff
                WHERE user_account_id = auth.uid()
            )
        )
    );

-- ============================================================================
-- SECTION 4: HELPER FUNCTIONS
-- ============================================================================

-- Function to upsert learned mapping (with proper $$ quoting)
CREATE OR REPLACE FUNCTION upsert_learned_mapping(
    p_source_column VARCHAR,
    p_source_patterns TEXT[],
    p_source_system VARCHAR,
    p_target_table VARCHAR,
    p_target_column VARCHAR,
    p_success_count INT,
    p_failure_count INT,
    p_user_accepted BOOLEAN,
    p_organization_id UUID
) RETURNS VOID AS $$
DECLARE
    v_existing_id UUID;
    v_new_confidence DECIMAL;
BEGIN
    -- Check for existing mapping
    SELECT mapping_id INTO v_existing_id
    FROM migration_learned_mappings
    WHERE source_column_normalized = p_source_column
        AND target_table = p_target_table
        AND target_column = p_target_column
        AND (
            (organization_id IS NULL AND p_organization_id IS NULL)
            OR organization_id = p_organization_id
        )
        AND (
            (source_system IS NULL AND p_source_system IS NULL)
            OR source_system = p_source_system
        );

    -- Calculate new confidence
    IF v_existing_id IS NOT NULL THEN
        SELECT
            CASE
                WHEN (success_count + p_success_count + failure_count + p_failure_count) > 0
                THEN (success_count + p_success_count)::DECIMAL /
                     (success_count + p_success_count + failure_count + p_failure_count)
                ELSE 0.5
            END
        INTO v_new_confidence
        FROM migration_learned_mappings
        WHERE mapping_id = v_existing_id;

        -- Boost confidence if user accepted
        IF p_user_accepted THEN
            v_new_confidence := LEAST(v_new_confidence + 0.05, 1.0);
        END IF;

        UPDATE migration_learned_mappings
        SET
            success_count = success_count + p_success_count,
            failure_count = failure_count + p_failure_count,
            confidence = COALESCE(v_new_confidence, 0.5),
            source_patterns = COALESCE(p_source_patterns, source_patterns),
            last_used = NOW(),
            updated_at = NOW()
        WHERE mapping_id = v_existing_id;
    ELSE
        -- Insert new mapping
        v_new_confidence := CASE
            WHEN p_success_count + p_failure_count > 0
            THEN p_success_count::DECIMAL / (p_success_count + p_failure_count)
            ELSE 0.5
        END;

        INSERT INTO migration_learned_mappings (
            source_column_normalized, source_patterns, source_system,
            target_table, target_column, success_count, failure_count,
            confidence, organization_id
        ) VALUES (
            p_source_column, p_source_patterns, p_source_system,
            p_target_table, p_target_column, p_success_count, p_failure_count,
            v_new_confidence, p_organization_id
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION upsert_learned_mapping IS 'Updates or inserts a learned mapping with confidence calculation.';

-- Function to decrease confidence when user corrects a mapping
CREATE OR REPLACE FUNCTION decrease_mapping_confidence(
    p_source_column VARCHAR,
    p_target_table VARCHAR,
    p_target_column VARCHAR
) RETURNS VOID AS $$
BEGIN
    UPDATE migration_learned_mappings
    SET
        confidence = GREATEST(confidence - 0.1, 0.1),
        failure_count = failure_count + 1,
        updated_at = NOW()
    WHERE source_column_normalized = p_source_column
        AND target_table = p_target_table
        AND target_column = p_target_column;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION decrease_mapping_confidence IS 'Decreases confidence in a mapping when user corrects it.';

-- Function to learn from user corrections
CREATE OR REPLACE FUNCTION learn_from_correction(
    p_source_column VARCHAR,
    p_wrong_table VARCHAR,
    p_wrong_column VARCHAR,
    p_correct_table VARCHAR,
    p_correct_column VARCHAR,
    p_organization_id UUID
) RETURNS VOID AS $$
BEGIN
    -- Decrease confidence in wrong mapping
    PERFORM decrease_mapping_confidence(p_source_column, p_wrong_table, p_wrong_column);

    -- Increase confidence in correct mapping
    INSERT INTO migration_learned_mappings (
        source_column_normalized, target_table, target_column,
        success_count, confidence, organization_id
    ) VALUES (
        p_source_column, p_correct_table, p_correct_column,
        1, 0.8, p_organization_id
    )
    ON CONFLICT (source_column_normalized, source_system, target_table, target_column, organization_id)
    DO UPDATE SET
        success_count = migration_learned_mappings.success_count + 1,
        confidence = LEAST(migration_learned_mappings.confidence + 0.1, 1.0),
        last_used = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION learn_from_correction IS 'Learns from user corrections - decreases wrong, increases correct.';

-- Function to get mapping suggestions for a column
CREATE OR REPLACE FUNCTION get_mapping_suggestions(
    p_source_column VARCHAR,
    p_source_system VARCHAR DEFAULT NULL,
    p_organization_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 5
) RETURNS TABLE (
    target_table VARCHAR,
    target_column VARCHAR,
    confidence DECIMAL,
    success_count INT,
    last_used TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.target_table,
        m.target_column,
        m.confidence,
        m.success_count,
        m.last_used
    FROM migration_learned_mappings m
    WHERE m.source_column_normalized = LOWER(REGEXP_REPLACE(p_source_column, '[^a-zA-Z0-9]', '_', 'g'))
        AND (
            m.organization_id IS NULL
            OR m.organization_id = p_organization_id
        )
        AND (
            m.source_system IS NULL
            OR m.source_system = p_source_system
            OR p_source_system IS NULL
        )
    ORDER BY
        -- Prefer org-specific mappings
        CASE WHEN m.organization_id = p_organization_id THEN 0 ELSE 1 END,
        -- Then by confidence
        m.confidence DESC,
        -- Then by recency
        m.last_used DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_mapping_suggestions IS 'Returns top mapping suggestions for a source column.';

-- Function to get migration batch summary
CREATE OR REPLACE FUNCTION get_migration_batch_summary(
    p_organization_id UUID,
    p_days INT DEFAULT 30
) RETURNS TABLE (
    batch_id UUID,
    source_system VARCHAR,
    source_file_name VARCHAR,
    record_count INT,
    success_count INT,
    error_count INT,
    success_rate DECIMAL,
    status VARCHAR,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.batch_id,
        b.source_system,
        b.source_file_name,
        b.record_count,
        b.success_count,
        b.error_count,
        CASE
            WHEN b.record_count > 0
            THEN (b.success_count::DECIMAL / b.record_count * 100)
            ELSE 0
        END AS success_rate,
        b.status,
        b.started_at,
        b.completed_at
    FROM migration_batch b
    WHERE b.organization_id = p_organization_id
        AND b.created_at >= NOW() - (p_days || ' days')::INTERVAL
    ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_migration_batch_summary IS 'Returns summary of recent migration batches.';

-- Function to find similar source structures
CREATE OR REPLACE FUNCTION find_similar_sources(
    p_structure_hash VARCHAR,
    p_organization_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 5
) RETURNS TABLE (
    dna_id VARCHAR,
    source_type VARCHAR,
    source_system VARCHAR,
    column_count INT,
    success_rate DECIMAL,
    last_seen TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.dna_id,
        d.source_type,
        d.source_system,
        d.column_count,
        d.success_rate,
        d.last_seen
    FROM migration_source_dna d
    WHERE d.structure_hash = p_structure_hash
        AND (
            d.organization_id IS NULL
            OR d.organization_id = p_organization_id
        )
    ORDER BY d.last_seen DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION find_similar_sources IS 'Finds previously seen source structures with matching hash.';

-- ============================================================================
-- SECTION 5: TRIGGERS FOR AUDIT
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_migration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_migration_learned_mappings_updated ON migration_learned_mappings;
CREATE TRIGGER trg_migration_learned_mappings_updated
    BEFORE UPDATE ON migration_learned_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_migration_timestamp();

DROP TRIGGER IF EXISTS trg_migration_batch_updated ON migration_batch;
CREATE TRIGGER trg_migration_batch_updated
    BEFORE UPDATE ON migration_batch
    FOR EACH ROW
    EXECUTE FUNCTION update_migration_timestamp();

-- ============================================================================
-- SECTION 6: GRANTS
-- ============================================================================

-- Grant access to authenticated users (RLS will filter)
GRANT SELECT, INSERT, UPDATE, DELETE ON migration_learned_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON migration_source_dna TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON migration_batch TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON migration_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON migration_errors TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION upsert_learned_mapping TO authenticated;
GRANT EXECUTE ON FUNCTION decrease_mapping_confidence TO authenticated;
GRANT EXECUTE ON FUNCTION learn_from_correction TO authenticated;
GRANT EXECUTE ON FUNCTION get_mapping_suggestions TO authenticated;
GRANT EXECUTE ON FUNCTION get_migration_batch_summary TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_sources TO authenticated;
