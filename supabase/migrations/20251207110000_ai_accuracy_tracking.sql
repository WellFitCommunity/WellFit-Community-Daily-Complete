-- ============================================================================
-- AI ACCURACY TRACKING & PROMPT VERSIONING INFRASTRUCTURE
-- ============================================================================
-- Purpose: Track AI prediction accuracy and enable systematic prompt optimization
--
-- Key Tables:
-- 1. ai_prompt_versions       - Version control for prompts
-- 2. ai_predictions           - All AI predictions with outcomes
-- 3. ai_accuracy_metrics      - Daily/weekly aggregated accuracy stats
-- 4. ai_prompt_experiments    - A/B testing for prompt improvements
-- ============================================================================

-- ============================================================================
-- 1. PROMPT VERSION CONTROL
-- ============================================================================
-- Track every version of every prompt for reproducibility and rollback

CREATE TABLE IF NOT EXISTS ai_prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identification
    skill_name TEXT NOT NULL,  -- e.g., 'readmission_risk', 'billing_codes', 'sdoh_detection'
    prompt_type TEXT NOT NULL, -- 'system', 'user', 'template'
    version_number INTEGER NOT NULL DEFAULT 1,

    -- Content
    prompt_content TEXT NOT NULL,
    prompt_hash TEXT GENERATED ALWAYS AS (encode(sha256(prompt_content::bytea), 'hex')) STORED,

    -- Metadata
    description TEXT,
    change_notes TEXT,
    model_target TEXT DEFAULT 'claude-sonnet-4-5-20250929',

    -- Status
    is_active BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,

    -- Performance tracking
    total_uses INTEGER DEFAULT 0,
    total_accurate INTEGER DEFAULT 0,
    accuracy_rate NUMERIC(5,4) GENERATED ALWAYS AS (
        CASE WHEN total_uses > 0 THEN total_accurate::NUMERIC / total_uses ELSE NULL END
    ) STORED,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    activated_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),

    -- Constraints
    UNIQUE(skill_name, prompt_type, version_number)
);

-- Index for fast lookups
CREATE INDEX idx_prompt_versions_active ON ai_prompt_versions(skill_name, prompt_type)
    WHERE is_active = true;
CREATE INDEX idx_prompt_versions_hash ON ai_prompt_versions(prompt_hash);

-- ============================================================================
-- 2. AI PREDICTIONS TRACKING
-- ============================================================================
-- Track EVERY AI prediction for accuracy measurement

CREATE TABLE IF NOT EXISTS ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source identification
    tenant_id UUID NOT NULL,
    skill_name TEXT NOT NULL,
    prompt_version_id UUID REFERENCES ai_prompt_versions(id),

    -- Context
    patient_id UUID,  -- NULL for non-patient predictions
    entity_type TEXT, -- 'patient', 'encounter', 'document', etc.
    entity_id UUID,

    -- Prediction details
    prediction_type TEXT NOT NULL,  -- 'classification', 'score', 'code', 'text'
    prediction_value JSONB NOT NULL,  -- The actual prediction
    confidence_score NUMERIC(5,4),

    -- Model info
    model_used TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd NUMERIC(10,6),
    latency_ms INTEGER,

    -- Outcome tracking (filled in later)
    actual_outcome JSONB,
    outcome_recorded_at TIMESTAMPTZ,
    outcome_source TEXT,  -- 'provider_review', 'system_event', 'manual_audit'

    -- Accuracy calculation
    is_accurate BOOLEAN,
    accuracy_notes TEXT,

    -- Timestamps
    predicted_at TIMESTAMPTZ DEFAULT now(),

    -- Prevent duplicate predictions
    prediction_hash TEXT
);

-- Indexes for performance
CREATE INDEX idx_predictions_skill ON ai_predictions(skill_name, predicted_at DESC);
CREATE INDEX idx_predictions_tenant ON ai_predictions(tenant_id, predicted_at DESC);
CREATE INDEX idx_predictions_accuracy ON ai_predictions(skill_name, is_accurate)
    WHERE is_accurate IS NOT NULL;
CREATE INDEX idx_predictions_pending ON ai_predictions(skill_name, predicted_at)
    WHERE is_accurate IS NULL;

-- ============================================================================
-- 3. AGGREGATED ACCURACY METRICS
-- ============================================================================
-- Daily/weekly rollups for dashboards and alerts

CREATE TABLE IF NOT EXISTS ai_accuracy_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Dimensions
    tenant_id UUID,  -- NULL for global metrics
    skill_name TEXT NOT NULL,
    prompt_version_id UUID REFERENCES ai_prompt_versions(id),
    period_type TEXT NOT NULL,  -- 'daily', 'weekly', 'monthly'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Volume metrics
    total_predictions INTEGER DEFAULT 0,
    predictions_with_outcome INTEGER DEFAULT 0,

    -- Accuracy metrics
    accurate_count INTEGER DEFAULT 0,
    inaccurate_count INTEGER DEFAULT 0,
    accuracy_rate NUMERIC(5,4),

    -- Confidence calibration
    avg_confidence NUMERIC(5,4),
    confidence_accuracy_correlation NUMERIC(5,4),

    -- Cost metrics
    total_cost_usd NUMERIC(10,2) DEFAULT 0,
    avg_cost_per_prediction NUMERIC(10,6),

    -- Performance metrics
    avg_latency_ms INTEGER,
    p95_latency_ms INTEGER,

    -- Calculated at
    calculated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(tenant_id, skill_name, prompt_version_id, period_type, period_start)
);

CREATE INDEX idx_accuracy_metrics_lookup ON ai_accuracy_metrics(skill_name, period_type, period_start DESC);

-- ============================================================================
-- 4. PROMPT EXPERIMENTS (A/B TESTING)
-- ============================================================================
-- Test prompt variations before full rollout

CREATE TABLE IF NOT EXISTS ai_prompt_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Experiment definition
    experiment_name TEXT NOT NULL,
    skill_name TEXT NOT NULL,
    hypothesis TEXT,

    -- Variants
    control_prompt_id UUID REFERENCES ai_prompt_versions(id),
    treatment_prompt_id UUID REFERENCES ai_prompt_versions(id),
    traffic_split NUMERIC(3,2) DEFAULT 0.50,  -- % to treatment

    -- Status
    status TEXT DEFAULT 'draft',  -- 'draft', 'running', 'paused', 'completed', 'cancelled'

    -- Timing
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    min_sample_size INTEGER DEFAULT 100,

    -- Results
    control_predictions INTEGER DEFAULT 0,
    control_accurate INTEGER DEFAULT 0,
    treatment_predictions INTEGER DEFAULT 0,
    treatment_accurate INTEGER DEFAULT 0,

    -- Statistical significance
    p_value NUMERIC(10,8),
    is_significant BOOLEAN,
    winner TEXT,  -- 'control', 'treatment', 'no_difference'

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    completed_at TIMESTAMPTZ,

    UNIQUE(experiment_name)
);

-- ============================================================================
-- 5. SKILL-SPECIFIC ACCURACY TABLES
-- ============================================================================

-- Readmission Risk Accuracy (already tracked, add explicit outcome tracking)
ALTER TABLE readmission_risk_predictions
    ADD COLUMN IF NOT EXISTS prompt_version_id UUID REFERENCES ai_prompt_versions(id),
    ADD COLUMN IF NOT EXISTS accuracy_calculated BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS accuracy_score NUMERIC(5,4);

-- Billing Code Accuracy
CREATE TABLE IF NOT EXISTS billing_code_accuracy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id UUID REFERENCES ai_predictions(id),
    encounter_id UUID NOT NULL,

    -- Suggested vs Final
    suggested_codes JSONB NOT NULL,
    final_codes_used JSONB,

    -- Accuracy breakdown
    codes_accepted INTEGER DEFAULT 0,
    codes_rejected INTEGER DEFAULT 0,
    codes_added_by_provider INTEGER DEFAULT 0,

    -- Revenue impact
    suggested_revenue NUMERIC(10,2),
    actual_revenue NUMERIC(10,2),
    revenue_delta NUMERIC(10,2),

    -- Provider feedback
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- SDOH Detection Accuracy
CREATE TABLE IF NOT EXISTS sdoh_detection_accuracy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detection_id UUID NOT NULL,
    prediction_id UUID REFERENCES ai_predictions(id),

    -- Detection outcome
    was_confirmed BOOLEAN,
    was_dismissed BOOLEAN,
    was_false_positive BOOLEAN,

    -- Provider action
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Get active prompt for a skill
CREATE OR REPLACE FUNCTION get_active_prompt(
    p_skill_name TEXT,
    p_prompt_type TEXT DEFAULT 'system'
)
RETURNS TABLE(
    prompt_id UUID,
    prompt_content TEXT,
    version_number INTEGER,
    accuracy_rate NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pv.id,
        pv.prompt_content,
        pv.version_number,
        pv.accuracy_rate
    FROM ai_prompt_versions pv
    WHERE pv.skill_name = p_skill_name
      AND pv.prompt_type = p_prompt_type
      AND pv.is_active = true
    LIMIT 1;
END;
$$;

-- Record a prediction
CREATE OR REPLACE FUNCTION record_ai_prediction(
    p_tenant_id UUID,
    p_skill_name TEXT,
    p_prediction_type TEXT,
    p_prediction_value JSONB,
    p_confidence NUMERIC DEFAULT NULL,
    p_patient_id UUID DEFAULT NULL,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_model TEXT DEFAULT 'claude-sonnet-4-5-20250929',
    p_input_tokens INTEGER DEFAULT NULL,
    p_output_tokens INTEGER DEFAULT NULL,
    p_cost NUMERIC DEFAULT NULL,
    p_latency_ms INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_prediction_id UUID;
    v_prompt_version_id UUID;
BEGIN
    -- Get active prompt version
    SELECT id INTO v_prompt_version_id
    FROM ai_prompt_versions
    WHERE skill_name = p_skill_name
      AND prompt_type = 'system'
      AND is_active = true
    LIMIT 1;

    -- Insert prediction
    INSERT INTO ai_predictions (
        tenant_id,
        skill_name,
        prompt_version_id,
        patient_id,
        entity_type,
        entity_id,
        prediction_type,
        prediction_value,
        confidence_score,
        model_used,
        input_tokens,
        output_tokens,
        cost_usd,
        latency_ms
    ) VALUES (
        p_tenant_id,
        p_skill_name,
        v_prompt_version_id,
        p_patient_id,
        p_entity_type,
        p_entity_id,
        p_prediction_type,
        p_prediction_value,
        p_confidence,
        p_model,
        p_input_tokens,
        p_output_tokens,
        p_cost,
        p_latency_ms
    )
    RETURNING id INTO v_prediction_id;

    -- Update prompt usage count
    IF v_prompt_version_id IS NOT NULL THEN
        UPDATE ai_prompt_versions
        SET total_uses = total_uses + 1
        WHERE id = v_prompt_version_id;
    END IF;

    RETURN v_prediction_id;
END;
$$;

-- Record prediction outcome
CREATE OR REPLACE FUNCTION record_prediction_outcome(
    p_prediction_id UUID,
    p_actual_outcome JSONB,
    p_is_accurate BOOLEAN,
    p_outcome_source TEXT DEFAULT 'provider_review',
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_prompt_version_id UUID;
BEGIN
    -- Update prediction
    UPDATE ai_predictions
    SET
        actual_outcome = p_actual_outcome,
        outcome_recorded_at = now(),
        outcome_source = p_outcome_source,
        is_accurate = p_is_accurate,
        accuracy_notes = p_notes
    WHERE id = p_prediction_id
    RETURNING prompt_version_id INTO v_prompt_version_id;

    -- Update prompt version accuracy
    IF v_prompt_version_id IS NOT NULL THEN
        UPDATE ai_prompt_versions
        SET total_accurate = total_accurate + (CASE WHEN p_is_accurate THEN 1 ELSE 0 END)
        WHERE id = v_prompt_version_id;
    END IF;

    RETURN true;
END;
$$;

-- Calculate accuracy metrics for a period
CREATE OR REPLACE FUNCTION calculate_accuracy_metrics(
    p_skill_name TEXT,
    p_period_type TEXT DEFAULT 'daily',
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_end_date DATE;
BEGIN
    -- Calculate period end
    v_end_date := CASE p_period_type
        WHEN 'daily' THEN p_start_date
        WHEN 'weekly' THEN p_start_date + INTERVAL '6 days'
        WHEN 'monthly' THEN (p_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE
    END;

    -- Insert or update metrics
    INSERT INTO ai_accuracy_metrics (
        tenant_id,
        skill_name,
        prompt_version_id,
        period_type,
        period_start,
        period_end,
        total_predictions,
        predictions_with_outcome,
        accurate_count,
        inaccurate_count,
        accuracy_rate,
        avg_confidence,
        total_cost_usd,
        avg_cost_per_prediction,
        avg_latency_ms
    )
    SELECT
        p.tenant_id,
        p.skill_name,
        p.prompt_version_id,
        p_period_type,
        p_start_date,
        v_end_date,
        COUNT(*),
        COUNT(*) FILTER (WHERE is_accurate IS NOT NULL),
        COUNT(*) FILTER (WHERE is_accurate = true),
        COUNT(*) FILTER (WHERE is_accurate = false),
        (COUNT(*) FILTER (WHERE is_accurate = true))::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0),
        AVG(confidence_score),
        SUM(cost_usd),
        AVG(cost_usd),
        AVG(latency_ms)::INTEGER
    FROM ai_predictions p
    WHERE p.skill_name = p_skill_name
      AND p.predicted_at >= p_start_date
      AND p.predicted_at < v_end_date + INTERVAL '1 day'
    GROUP BY p.tenant_id, p.skill_name, p.prompt_version_id
    ON CONFLICT (tenant_id, skill_name, prompt_version_id, period_type, period_start)
    DO UPDATE SET
        total_predictions = EXCLUDED.total_predictions,
        predictions_with_outcome = EXCLUDED.predictions_with_outcome,
        accurate_count = EXCLUDED.accurate_count,
        inaccurate_count = EXCLUDED.inaccurate_count,
        accuracy_rate = EXCLUDED.accuracy_rate,
        avg_confidence = EXCLUDED.avg_confidence,
        total_cost_usd = EXCLUDED.total_cost_usd,
        avg_cost_per_prediction = EXCLUDED.avg_cost_per_prediction,
        avg_latency_ms = EXCLUDED.avg_latency_ms,
        calculated_at = now();
END;
$$;

-- Get accuracy dashboard data
CREATE OR REPLACE FUNCTION get_accuracy_dashboard(
    p_tenant_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
    skill_name TEXT,
    total_predictions BIGINT,
    accuracy_rate NUMERIC,
    avg_confidence NUMERIC,
    total_cost NUMERIC,
    prediction_trend JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.skill_name,
        COUNT(*)::BIGINT as total_predictions,
        (COUNT(*) FILTER (WHERE is_accurate = true))::NUMERIC /
            NULLIF(COUNT(*) FILTER (WHERE is_accurate IS NOT NULL), 0) as accuracy_rate,
        AVG(confidence_score) as avg_confidence,
        SUM(cost_usd) as total_cost,
        jsonb_agg(
            jsonb_build_object(
                'date', predicted_at::DATE,
                'count', 1,
                'accurate', CASE WHEN is_accurate THEN 1 ELSE 0 END
            )
            ORDER BY predicted_at
        ) as prediction_trend
    FROM ai_predictions p
    WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
      AND p.predicted_at >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    GROUP BY p.skill_name;
END;
$$;

-- ============================================================================
-- 7. RLS POLICIES
-- ============================================================================

ALTER TABLE ai_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_accuracy_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompt_experiments ENABLE ROW LEVEL SECURITY;

-- Super admins can see all
CREATE POLICY "Super admins can manage prompts" ON ai_prompt_versions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role_code IN (1, 2)  -- super_admin, admin
        )
    );

-- Tenants can see their predictions
CREATE POLICY "Tenants can view their predictions" ON ai_predictions
    FOR SELECT USING (
        tenant_id IN (
            SELECT (raw_user_meta_data->>'tenant_id')::UUID
            FROM auth.users
            WHERE id = auth.uid()
        )
    );

-- Admins can view accuracy metrics
CREATE POLICY "Admins can view accuracy metrics" ON ai_accuracy_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role_code IN (1, 2, 3)  -- super_admin, admin, clinical_admin
        )
    );

-- ============================================================================
-- 8. SEED INITIAL PROMPT VERSIONS
-- ============================================================================

-- Readmission Risk Predictor - Initial Version
INSERT INTO ai_prompt_versions (skill_name, prompt_type, version_number, prompt_content, description, is_active, is_default)
VALUES (
    'readmission_risk',
    'system',
    1,
    'You are an expert clinical analyst specializing in readmission risk prediction for a rural community healthcare program.

EVIDENCE-BASED FEATURE WEIGHTING:
Use these validated predictive weights when assessing risk:

CLINICAL FACTORS (Highest Weight):
- Prior admissions in 30 days: 0.25 (STRONGEST predictor)
- Prior admissions in 90 days: 0.20
- ED visits in 6 months: 0.15
- Comorbidity count: 0.18
- High-risk diagnosis (CHF, COPD, diabetes, renal failure): 0.15

POST-DISCHARGE SETUP (Critical):
- No follow-up scheduled: 0.18 (HIGH RISK)
- Follow-up within 7 days: -0.12 (PROTECTIVE)

SOCIAL DETERMINANTS (Rural Population Focus):
- Transportation barriers: 0.16
- Lives alone with no caregiver: 0.14
- Rural isolation: 0.15

ENGAGEMENT & BEHAVIORAL (WellFit''s UNIQUE Early Warning):
- Consecutive missed check-ins (≥3): 0.16
- Sudden engagement drop: 0.18
- Stopped responding: 0.22 (CRITICAL)

Return response as strict JSON.',
    'Initial evidence-based prompt for readmission risk prediction',
    true,
    true
) ON CONFLICT (skill_name, prompt_type, version_number) DO NOTHING;

-- Billing Code Suggester - Initial Version
INSERT INTO ai_prompt_versions (skill_name, prompt_type, version_number, prompt_content, description, is_active, is_default)
VALUES (
    'billing_codes',
    'system',
    1,
    'You are an expert medical coding specialist with deep knowledge of CPT, HCPCS, and ICD-10 coding.

IMPORTANT GUIDELINES:
- Only suggest codes you are highly confident about (>85% confidence)
- Include detailed rationale for each code
- Flag cases that require manual review
- Follow CMS coding guidelines strictly
- Consider encounter type and duration for E/M code selection

Return response as strict JSON with structure:
{
  "cpt": [{"code": "99214", "description": "...", "confidence": 0.95, "rationale": "..."}],
  "hcpcs": [],
  "icd10": [{"code": "E11.9", "description": "...", "confidence": 0.98, "rationale": "..."}],
  "requiresReview": false,
  "reviewReason": ""
}',
    'Initial prompt for billing code suggestions',
    true,
    true
) ON CONFLICT (skill_name, prompt_type, version_number) DO NOTHING;

-- SDOH Passive Detector - Initial Version
INSERT INTO ai_prompt_versions (skill_name, prompt_type, version_number, prompt_content, description, is_active, is_default)
VALUES (
    'sdoh_detection',
    'system',
    1,
    'You are an expert social worker and healthcare analyst specializing in detecting social determinants of health (SDOH).

IMPORTANT GUIDELINES:
- Only detect SDOH issues that are clearly evident in the text
- Provide confidence scores (0.00 to 1.00) for each detection
- Assign appropriate risk levels and urgency
- Suggest concrete, actionable interventions
- Be sensitive to cultural and socioeconomic factors

Return response as strict JSON array.',
    'Initial prompt for SDOH passive detection',
    true,
    true
) ON CONFLICT (skill_name, prompt_type, version_number) DO NOTHING;

COMMENT ON TABLE ai_prompt_versions IS 'Version control for AI prompts enabling A/B testing and rollback';
COMMENT ON TABLE ai_predictions IS 'Tracks all AI predictions for accuracy measurement and optimization';
COMMENT ON TABLE ai_accuracy_metrics IS 'Aggregated accuracy metrics for dashboards and alerts';
COMMENT ON TABLE ai_prompt_experiments IS 'A/B testing infrastructure for prompt optimization';
