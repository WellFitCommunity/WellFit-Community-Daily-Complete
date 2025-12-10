-- ============================================================================
-- AI DEMOGRAPHIC TRACKING FOR BIAS DETECTION
-- ============================================================================
-- Purpose: Add demographic columns to ai_predictions for stratified accuracy
--          analysis and bias detection in AI models.
--
-- Why: Regulatory requirements and best practices require monitoring AI
--      performance across demographic groups to detect and address bias.
--
-- Privacy: Stores CATEGORIES only (e.g., "65-74"), not raw PHI
-- ============================================================================

-- ============================================================================
-- 1. ADD DEMOGRAPHIC COLUMNS TO AI_PREDICTIONS
-- ============================================================================

-- Patient age group (categories, not exact age)
ALTER TABLE ai_predictions
ADD COLUMN IF NOT EXISTS patient_age_group TEXT;

COMMENT ON COLUMN ai_predictions.patient_age_group IS
'Age category: under_18, 18-34, 35-44, 45-54, 55-64, 65-74, 75-84, 85_plus';

-- Patient self-reported race/ethnicity (for bias monitoring)
ALTER TABLE ai_predictions
ADD COLUMN IF NOT EXISTS patient_race TEXT;

COMMENT ON COLUMN ai_predictions.patient_race IS
'Self-reported race/ethnicity category for bias monitoring. Categories follow CMS standards.';

-- Patient payer type (Medicare, Medicaid, Commercial, Self-pay, etc.)
ALTER TABLE ai_predictions
ADD COLUMN IF NOT EXISTS patient_payer TEXT;

COMMENT ON COLUMN ai_predictions.patient_payer IS
'Primary payer category: medicare, medicaid, commercial, self_pay, dual_eligible, other';

-- Patient rurality (urban/suburban/rural classification)
ALTER TABLE ai_predictions
ADD COLUMN IF NOT EXISTS patient_rurality TEXT;

COMMENT ON COLUMN ai_predictions.patient_rurality IS
'Geographic classification: urban, suburban, rural, frontier. Based on RUCA codes.';

-- Patient primary language (for health literacy considerations)
ALTER TABLE ai_predictions
ADD COLUMN IF NOT EXISTS patient_primary_language TEXT;

COMMENT ON COLUMN ai_predictions.patient_primary_language IS
'Primary language code (e.g., en, es, zh). For health literacy bias monitoring.';

-- Feedback type from clinician (helpful/wrong/unsafe)
ALTER TABLE ai_predictions
ADD COLUMN IF NOT EXISTS feedback_type TEXT;

COMMENT ON COLUMN ai_predictions.feedback_type IS
'Clinician feedback: helpful, wrong, unsafe. Captured via AIFeedbackButton.';

-- Feedback timestamp
ALTER TABLE ai_predictions
ADD COLUMN IF NOT EXISTS feedback_recorded_at TIMESTAMPTZ;

-- User who provided feedback
ALTER TABLE ai_predictions
ADD COLUMN IF NOT EXISTS feedback_by UUID REFERENCES auth.users(id);

-- ============================================================================
-- 2. CREATE INDEXES FOR STRATIFIED QUERIES
-- ============================================================================

-- Index for age group analysis
CREATE INDEX IF NOT EXISTS idx_ai_predictions_age_group
ON ai_predictions(patient_age_group)
WHERE patient_age_group IS NOT NULL;

-- Index for race analysis
CREATE INDEX IF NOT EXISTS idx_ai_predictions_race
ON ai_predictions(patient_race)
WHERE patient_race IS NOT NULL;

-- Index for payer analysis
CREATE INDEX IF NOT EXISTS idx_ai_predictions_payer
ON ai_predictions(patient_payer)
WHERE patient_payer IS NOT NULL;

-- Index for rurality analysis
CREATE INDEX IF NOT EXISTS idx_ai_predictions_rurality
ON ai_predictions(patient_rurality)
WHERE patient_rurality IS NOT NULL;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_ai_predictions_demographics
ON ai_predictions(skill_name, patient_age_group, patient_race, patient_payer, patient_rurality)
WHERE is_accurate IS NOT NULL;

-- Index for feedback queries
CREATE INDEX IF NOT EXISTS idx_ai_predictions_feedback
ON ai_predictions(feedback_type, feedback_recorded_at DESC)
WHERE feedback_type IS NOT NULL;

-- ============================================================================
-- 3. CREATE FUNCTION TO RECORD PREDICTION FEEDBACK
-- ============================================================================

CREATE OR REPLACE FUNCTION record_prediction_feedback(
    p_prediction_id UUID,
    p_feedback_type TEXT,
    p_is_accurate BOOLEAN,
    p_outcome_source TEXT,
    p_notes TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE ai_predictions
    SET
        feedback_type = p_feedback_type,
        feedback_recorded_at = NOW(),
        feedback_by = p_user_id,
        is_accurate = p_is_accurate,
        outcome_source = p_outcome_source,
        accuracy_notes = COALESCE(p_notes, accuracy_notes),
        outcome_recorded_at = NOW(),
        actual_outcome = COALESCE(actual_outcome, '{}'::jsonb) || jsonb_build_object(
            'feedback_type', p_feedback_type,
            'feedback_timestamp', NOW()
        )
    WHERE id = p_prediction_id;

    RETURN FOUND;
END;
$$;

-- ============================================================================
-- 4. CREATE VIEW FOR STRATIFIED ACCURACY METRICS
-- ============================================================================

CREATE OR REPLACE VIEW ai_accuracy_by_demographics AS
SELECT
    skill_name,
    patient_age_group,
    patient_race,
    patient_payer,
    patient_rurality,
    COUNT(*) AS total_predictions,
    COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) AS predictions_with_outcome,
    COUNT(*) FILTER (WHERE is_accurate = true) AS accurate_count,
    COUNT(*) FILTER (WHERE is_accurate = false) AS inaccurate_count,
    CASE
        WHEN COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) > 0
        THEN ROUND(
            COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
            COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) * 100,
            2
        )
        ELSE NULL
    END AS accuracy_rate,
    AVG(confidence_score) FILTER (WHERE confidence_score IS NOT NULL) AS avg_confidence,
    COUNT(*) FILTER (WHERE feedback_type = 'unsafe') AS unsafe_flags,
    MAX(created_at) AS last_prediction
FROM ai_predictions
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY skill_name, patient_age_group, patient_race, patient_payer, patient_rurality;

COMMENT ON VIEW ai_accuracy_by_demographics IS
'Stratified AI accuracy metrics for bias detection. Groups by demographics for comparison.';

-- ============================================================================
-- 5. CREATE FUNCTION TO DETECT BIAS DISPARITIES
-- ============================================================================

CREATE OR REPLACE FUNCTION detect_ai_bias_disparities(
    p_skill_name TEXT,
    p_min_sample_size INTEGER DEFAULT 30,
    p_disparity_threshold NUMERIC DEFAULT 0.10
)
RETURNS TABLE (
    demographic_type TEXT,
    demographic_value TEXT,
    accuracy_rate NUMERIC,
    baseline_rate NUMERIC,
    disparity NUMERIC,
    sample_size BIGINT,
    is_significant BOOLEAN,
    alert_message TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_baseline_rate NUMERIC;
BEGIN
    -- Calculate overall baseline accuracy for this skill
    SELECT
        CASE
            WHEN COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) > 0
            THEN COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
                 COUNT(*) FILTER (WHERE is_accurate IS NOT NULL)
            ELSE NULL
        END
    INTO v_baseline_rate
    FROM ai_predictions
    WHERE skill_name = p_skill_name
    AND created_at > NOW() - INTERVAL '90 days';

    IF v_baseline_rate IS NULL THEN
        RETURN;
    END IF;

    -- Check each demographic dimension
    -- Age group disparities
    RETURN QUERY
    SELECT
        'age_group'::TEXT,
        patient_age_group,
        ROUND(
            COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) * 100,
            2
        ),
        ROUND(v_baseline_rate * 100, 2),
        ROUND(
            ABS(
                COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
                NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) - v_baseline_rate
            ) * 100,
            2
        ),
        COUNT(*) FILTER (WHERE is_accurate IS NOT NULL),
        COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) >= p_min_sample_size AND
        ABS(
            COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) - v_baseline_rate
        ) >= p_disparity_threshold,
        CASE
            WHEN COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) >= p_min_sample_size AND
                 ABS(
                     COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
                     NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) - v_baseline_rate
                 ) >= p_disparity_threshold
            THEN 'Significant accuracy disparity detected for age group: ' || patient_age_group
            ELSE NULL
        END
    FROM ai_predictions
    WHERE skill_name = p_skill_name
    AND patient_age_group IS NOT NULL
    AND created_at > NOW() - INTERVAL '90 days'
    GROUP BY patient_age_group
    HAVING COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) > 0;

    -- Race disparities
    RETURN QUERY
    SELECT
        'race'::TEXT,
        patient_race,
        ROUND(
            COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) * 100,
            2
        ),
        ROUND(v_baseline_rate * 100, 2),
        ROUND(
            ABS(
                COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
                NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) - v_baseline_rate
            ) * 100,
            2
        ),
        COUNT(*) FILTER (WHERE is_accurate IS NOT NULL),
        COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) >= p_min_sample_size AND
        ABS(
            COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) - v_baseline_rate
        ) >= p_disparity_threshold,
        CASE
            WHEN COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) >= p_min_sample_size AND
                 ABS(
                     COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
                     NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) - v_baseline_rate
                 ) >= p_disparity_threshold
            THEN 'Significant accuracy disparity detected for race: ' || patient_race
            ELSE NULL
        END
    FROM ai_predictions
    WHERE skill_name = p_skill_name
    AND patient_race IS NOT NULL
    AND created_at > NOW() - INTERVAL '90 days'
    GROUP BY patient_race
    HAVING COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) > 0;

    -- Payer disparities
    RETURN QUERY
    SELECT
        'payer'::TEXT,
        patient_payer,
        ROUND(
            COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) * 100,
            2
        ),
        ROUND(v_baseline_rate * 100, 2),
        ROUND(
            ABS(
                COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
                NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) - v_baseline_rate
            ) * 100,
            2
        ),
        COUNT(*) FILTER (WHERE is_accurate IS NOT NULL),
        COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) >= p_min_sample_size AND
        ABS(
            COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) - v_baseline_rate
        ) >= p_disparity_threshold,
        CASE
            WHEN COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) >= p_min_sample_size AND
                 ABS(
                     COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
                     NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) - v_baseline_rate
                 ) >= p_disparity_threshold
            THEN 'Significant accuracy disparity detected for payer: ' || patient_payer
            ELSE NULL
        END
    FROM ai_predictions
    WHERE skill_name = p_skill_name
    AND patient_payer IS NOT NULL
    AND created_at > NOW() - INTERVAL '90 days'
    GROUP BY patient_payer
    HAVING COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) > 0;

    -- Rurality disparities
    RETURN QUERY
    SELECT
        'rurality'::TEXT,
        patient_rurality,
        ROUND(
            COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) * 100,
            2
        ),
        ROUND(v_baseline_rate * 100, 2),
        ROUND(
            ABS(
                COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
                NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) - v_baseline_rate
            ) * 100,
            2
        ),
        COUNT(*) FILTER (WHERE is_accurate IS NOT NULL),
        COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) >= p_min_sample_size AND
        ABS(
            COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) - v_baseline_rate
        ) >= p_disparity_threshold,
        CASE
            WHEN COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) >= p_min_sample_size AND
                 ABS(
                     COUNT(*) FILTER (WHERE is_accurate = true)::NUMERIC /
                     NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) - v_baseline_rate
                 ) >= p_disparity_threshold
            THEN 'Significant accuracy disparity detected for rurality: ' || patient_rurality
            ELSE NULL
        END
    FROM ai_predictions
    WHERE skill_name = p_skill_name
    AND patient_rurality IS NOT NULL
    AND created_at > NOW() - INTERVAL '90 days'
    GROUP BY patient_rurality
    HAVING COUNT(*) FILTER (WHERE is_accurate IS NOT NULL) > 0;
END;
$$;

COMMENT ON FUNCTION detect_ai_bias_disparities IS
'Detects significant accuracy disparities across demographic groups. Returns groups where accuracy differs from baseline by more than threshold.';

-- ============================================================================
-- 6. CREATE HELPER FUNCTION TO GET AGE GROUP FROM DOB
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_age_group(p_date_of_birth DATE)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_age INTEGER;
BEGIN
    IF p_date_of_birth IS NULL THEN
        RETURN NULL;
    END IF;

    v_age := EXTRACT(YEAR FROM age(CURRENT_DATE, p_date_of_birth));

    RETURN CASE
        WHEN v_age < 18 THEN 'under_18'
        WHEN v_age BETWEEN 18 AND 34 THEN '18-34'
        WHEN v_age BETWEEN 35 AND 44 THEN '35-44'
        WHEN v_age BETWEEN 45 AND 54 THEN '45-54'
        WHEN v_age BETWEEN 55 AND 64 THEN '55-64'
        WHEN v_age BETWEEN 65 AND 74 THEN '65-74'
        WHEN v_age BETWEEN 75 AND 84 THEN '75-84'
        ELSE '85_plus'
    END;
END;
$$;

COMMENT ON FUNCTION calculate_age_group IS
'Converts date of birth to age group category for demographic tracking. Does not store exact age.';

-- ============================================================================
-- 7. ADD CHECK CONSTRAINTS FOR VALID VALUES
-- ============================================================================

-- Note: Using ALTER TABLE ... ADD CONSTRAINT with IF NOT EXISTS pattern
DO $$
BEGIN
    -- Age group constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ai_predictions_age_group_check'
    ) THEN
        ALTER TABLE ai_predictions ADD CONSTRAINT ai_predictions_age_group_check
        CHECK (patient_age_group IS NULL OR patient_age_group IN (
            'under_18', '18-34', '35-44', '45-54', '55-64', '65-74', '75-84', '85_plus'
        ));
    END IF;

    -- Payer constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ai_predictions_payer_check'
    ) THEN
        ALTER TABLE ai_predictions ADD CONSTRAINT ai_predictions_payer_check
        CHECK (patient_payer IS NULL OR patient_payer IN (
            'medicare', 'medicaid', 'commercial', 'self_pay', 'dual_eligible', 'tricare', 'va', 'other'
        ));
    END IF;

    -- Rurality constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ai_predictions_rurality_check'
    ) THEN
        ALTER TABLE ai_predictions ADD CONSTRAINT ai_predictions_rurality_check
        CHECK (patient_rurality IS NULL OR patient_rurality IN (
            'urban', 'suburban', 'rural', 'frontier'
        ));
    END IF;

    -- Feedback type constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ai_predictions_feedback_type_check'
    ) THEN
        ALTER TABLE ai_predictions ADD CONSTRAINT ai_predictions_feedback_type_check
        CHECK (feedback_type IS NULL OR feedback_type IN (
            'helpful', 'wrong', 'unsafe'
        ));
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- New columns added to ai_predictions:
--   - patient_age_group
--   - patient_race
--   - patient_payer
--   - patient_rurality
--   - patient_primary_language
--   - feedback_type
--   - feedback_recorded_at
--   - feedback_by
--
-- New functions:
--   - record_prediction_feedback() - Records clinician feedback
--   - detect_ai_bias_disparities() - Finds accuracy disparities
--   - calculate_age_group() - Converts DOB to category
--
-- New view:
--   - ai_accuracy_by_demographics - Stratified accuracy metrics
-- ============================================================================
