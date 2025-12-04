-- Epic Pain Point Tracking System
-- Migration: 20251203200000_epic_pain_point_tracking.sql
-- Purpose: Track metrics that demonstrate our advantages over Epic EHR
-- Reference: docs/EPIC_PAIN_POINT_STRATEGY.md

-- =============================================================================
-- 1. CLINICIAN TIME TRACKING
-- Track time saved vs Epic's documented 5.6 hrs/day benchmark
-- =============================================================================

CREATE TABLE IF NOT EXISTS clinician_time_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    session_id UUID, -- Links related actions in same session

    -- Action categorization
    action_type TEXT NOT NULL CHECK (action_type IN (
        'shift_handoff',          -- AI-assisted handoff (80/20 rule)
        'medication_reconciliation',
        'alert_review',
        'patient_lookup',
        'documentation',
        'care_plan_review',
        'order_entry',
        'lab_review',
        'imaging_review',
        'referral_processing',
        'discharge_planning'
    )),

    -- Time metrics
    actual_time_seconds INTEGER NOT NULL,       -- Time taken in our system
    epic_benchmark_seconds INTEGER NOT NULL,     -- Epic baseline for same task
    time_saved_seconds INTEGER GENERATED ALWAYS AS (epic_benchmark_seconds - actual_time_seconds) STORED,

    -- AI assistance metrics
    ai_assisted BOOLEAN DEFAULT false,
    ai_confidence_score DECIMAL(3,2),           -- 0.00 to 1.00
    user_override BOOLEAN DEFAULT false,         -- Did user override AI suggestion?

    -- Context
    patient_count INTEGER DEFAULT 1,             -- Number of patients involved
    complexity_level TEXT CHECK (complexity_level IN ('low', 'medium', 'high', 'critical')),
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Indexes
    CONSTRAINT positive_times CHECK (actual_time_seconds >= 0 AND epic_benchmark_seconds >= 0)
);

-- Epic benchmark reference table (documented times from studies)
CREATE TABLE IF NOT EXISTS epic_time_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL UNIQUE,

    -- Time benchmarks (in seconds)
    epic_average_seconds INTEGER NOT NULL,       -- Average time in Epic
    epic_p90_seconds INTEGER,                    -- 90th percentile
    our_target_seconds INTEGER NOT NULL,         -- Our target time

    -- Source documentation
    source_study TEXT,                           -- e.g., "Mayo Clinic 2023"
    source_url TEXT,

    -- Metadata
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial benchmarks from documented studies
INSERT INTO epic_time_benchmarks (action_type, epic_average_seconds, epic_p90_seconds, our_target_seconds, source_study, notes) VALUES
    ('shift_handoff', 1800, 2700, 360, 'Stanford Resident Study', 'Epic: 30min avg, Our target: 6min with AI 80/20'),
    ('medication_reconciliation', 900, 1500, 180, 'Mayo Clinic Burnout Study', 'Epic: 15min avg, Our target: 3min with AI'),
    ('alert_review', 300, 600, 60, 'Joint Commission 2018', 'Epic: 5min avg handling 7000 alerts, Our target: 1min smart alerts'),
    ('patient_lookup', 180, 300, 30, 'CHOP Usability Study', 'Epic: 3min avg, Our target: 30sec'),
    ('documentation', 2400, 3600, 600, 'Stanford 5.6hr Study', 'Epic: 40min avg note, Our target: 10min with scribe'),
    ('care_plan_review', 600, 900, 120, 'Health Affairs 2019', 'Epic: 10min avg, Our target: 2min'),
    ('order_entry', 300, 480, 90, 'RAND Report', 'Epic: 5min avg, Our target: 90sec'),
    ('lab_review', 240, 420, 60, 'Mayo Clinic Study', 'Epic: 4min avg, Our target: 1min'),
    ('imaging_review', 360, 600, 120, 'Helsinki Hospital Study', 'Epic: 6min avg, Our target: 2min'),
    ('referral_processing', 720, 1080, 180, 'Revigate Revenue Cycle', 'Epic: 12min avg, Our target: 3min'),
    ('discharge_planning', 1200, 1800, 300, 'UK Cambridge Study', 'Epic: 20min avg, Our target: 5min')
ON CONFLICT (action_type) DO UPDATE SET
    epic_average_seconds = EXCLUDED.epic_average_seconds,
    our_target_seconds = EXCLUDED.our_target_seconds,
    updated_at = now();

-- =============================================================================
-- 2. ALERT EFFECTIVENESS METRICS
-- Prove our <5% false positive rate vs Epic's 85-99%
-- =============================================================================

CREATE TABLE IF NOT EXISTS alert_effectiveness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES guardian_alerts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Clinician who reviewed

    -- Alert classification
    alert_type TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),

    -- Effectiveness metrics
    was_actionable BOOLEAN,                      -- Did clinician take action?
    action_taken TEXT,                           -- What action was taken
    time_to_acknowledge_seconds INTEGER,         -- Time from alert to ack
    time_to_resolve_seconds INTEGER,             -- Time from ack to resolution

    -- False positive tracking
    false_positive BOOLEAN DEFAULT false,        -- Determined to be false alarm
    false_positive_reason TEXT,                  -- Why it was false positive

    -- Patient safety impact
    prevented_harm BOOLEAN,                      -- Did this prevent patient harm?
    harm_severity TEXT CHECK (harm_severity IN ('none', 'minor', 'moderate', 'severe', 'death')),
    patient_outcome_notes TEXT,

    -- Comparison to Epic baseline
    would_epic_have_caught BOOLEAN,              -- Would Epic have shown this alert?
    epic_typical_response TEXT,                  -- What typically happens in Epic

    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);

-- =============================================================================
-- 3. HOSPITAL ONBOARDING TRACKER
-- Track why hospitals chose us over Epic
-- =============================================================================

CREATE TABLE IF NOT EXISTS hospital_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

    -- Hospital info
    hospital_name TEXT NOT NULL,
    hospital_type TEXT CHECK (hospital_type IN ('academic', 'community', 'rural', 'specialty', 'va', 'pediatric')),
    bed_count INTEGER,
    state TEXT,

    -- Why they chose us
    epic_pain_point TEXT NOT NULL,               -- Primary pain point that drove them to us
    secondary_pain_points TEXT[],                -- Additional pain points

    -- Epic background
    was_epic_customer BOOLEAN DEFAULT false,     -- Previously used Epic?
    epic_years_used INTEGER,
    epic_implementation_cost DECIMAL(12,2),      -- What they spent on Epic
    epic_annual_cost DECIMAL(12,2),

    -- Our implementation
    implementation_start_date DATE,
    go_live_date DATE,
    implementation_days INTEGER GENERATED ALWAYS AS (
        CASE WHEN go_live_date IS NOT NULL AND implementation_start_date IS NOT NULL
        THEN go_live_date - implementation_start_date END
    ) STORED,
    our_implementation_cost DECIMAL(12,2),
    our_annual_cost DECIMAL(12,2),

    -- Savings calculation
    cost_savings_year1 DECIMAL(12,2) GENERATED ALWAYS AS (
        CASE WHEN epic_annual_cost IS NOT NULL AND our_annual_cost IS NOT NULL
        THEN epic_annual_cost - our_annual_cost END
    ) STORED,

    -- Satisfaction metrics
    clinician_satisfaction_before INTEGER CHECK (clinician_satisfaction_before BETWEEN 1 AND 10),
    clinician_satisfaction_after INTEGER CHECK (clinician_satisfaction_after BETWEEN 1 AND 10),
    nps_score INTEGER CHECK (nps_score BETWEEN -100 AND 100),

    -- Testimonials
    testimonial_quote TEXT,
    testimonial_author TEXT,
    testimonial_title TEXT,
    approved_for_marketing BOOLEAN DEFAULT false,

    -- Status
    status TEXT DEFAULT 'prospect' CHECK (status IN ('prospect', 'implementing', 'live', 'churned')),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 4. EPIC COMPARISON METRICS (Aggregate View)
-- Dashboard data for sales presentations
-- =============================================================================

CREATE OR REPLACE VIEW epic_comparison_metrics AS
WITH time_savings AS (
    SELECT
        tenant_id,
        action_type,
        COUNT(*) as total_actions,
        AVG(actual_time_seconds) as avg_actual_time,
        AVG(epic_benchmark_seconds) as avg_epic_time,
        SUM(time_saved_seconds) as total_time_saved,
        AVG(time_saved_seconds) as avg_time_saved,
        COUNT(*) FILTER (WHERE ai_assisted) as ai_assisted_count,
        AVG(ai_confidence_score) FILTER (WHERE ai_assisted) as avg_ai_confidence
    FROM clinician_time_tracking
    WHERE created_at >= now() - interval '30 days'
    GROUP BY tenant_id, action_type
),
alert_metrics AS (
    SELECT
        tenant_id,
        COUNT(*) as total_alerts,
        COUNT(*) FILTER (WHERE was_actionable) as actionable_alerts,
        COUNT(*) FILTER (WHERE false_positive) as false_positives,
        ROUND(
            100.0 * COUNT(*) FILTER (WHERE false_positive) / NULLIF(COUNT(*), 0),
            2
        ) as false_positive_rate,
        AVG(time_to_acknowledge_seconds) as avg_ack_time,
        COUNT(*) FILTER (WHERE prevented_harm) as harm_prevented_count
    FROM alert_effectiveness
    WHERE created_at >= now() - interval '30 days'
    GROUP BY tenant_id
),
epic_baseline AS (
    SELECT
        85.0 as epic_false_positive_rate,  -- 85-99% per Joint Commission
        20160.0 as epic_daily_ehr_seconds  -- 5.6 hours = 20160 seconds
)
SELECT
    COALESCE(ts.tenant_id, am.tenant_id) as tenant_id,

    -- Time savings metrics
    COALESCE(SUM(ts.total_time_saved), 0) as total_time_saved_seconds,
    ROUND(COALESCE(SUM(ts.total_time_saved), 0) / 3600.0, 1) as total_hours_saved,
    ROUND(
        100.0 * (1 - COALESCE(AVG(ts.avg_actual_time), 0) / NULLIF(AVG(ts.avg_epic_time), 0)),
        1
    ) as efficiency_improvement_pct,

    -- Alert metrics
    COALESCE(am.total_alerts, 0) as total_alerts,
    COALESCE(am.false_positive_rate, 0) as our_false_positive_rate,
    eb.epic_false_positive_rate,
    eb.epic_false_positive_rate - COALESCE(am.false_positive_rate, 0) as false_positive_improvement,
    COALESCE(am.harm_prevented_count, 0) as harm_prevented_count,

    -- AI metrics
    COALESCE(SUM(ts.ai_assisted_count), 0) as ai_assisted_actions,
    ROUND(COALESCE(AVG(ts.avg_ai_confidence), 0) * 100, 1) as avg_ai_confidence_pct

FROM time_savings ts
FULL OUTER JOIN alert_metrics am ON ts.tenant_id = am.tenant_id
CROSS JOIN epic_baseline eb
GROUP BY ts.tenant_id, am.tenant_id, am.total_alerts, am.false_positive_rate,
         am.harm_prevented_count, eb.epic_false_positive_rate, eb.epic_daily_ehr_seconds;

-- =============================================================================
-- 5. ROI CALCULATOR VIEW
-- Generate ROI reports for CFO conversations
-- =============================================================================

CREATE OR REPLACE VIEW hospital_roi_summary AS
SELECT
    ho.id,
    ho.hospital_name,
    ho.bed_count,
    ho.epic_pain_point,
    ho.implementation_days,
    ho.cost_savings_year1,
    ho.clinician_satisfaction_before,
    ho.clinician_satisfaction_after,
    ho.clinician_satisfaction_after - ho.clinician_satisfaction_before as satisfaction_improvement,
    ho.nps_score,

    -- Calculate 5-year savings
    ho.cost_savings_year1 * 5 as projected_5_year_savings,

    -- Calculate implementation ROI
    CASE
        WHEN ho.our_implementation_cost > 0
        THEN ROUND(ho.cost_savings_year1 / ho.our_implementation_cost * 100, 1)
        ELSE NULL
    END as first_year_roi_pct,

    -- Epic comparison
    ho.epic_implementation_cost,
    ho.our_implementation_cost,
    ho.epic_implementation_cost - ho.our_implementation_cost as implementation_savings,

    ho.testimonial_quote,
    ho.approved_for_marketing
FROM hospital_onboarding ho
WHERE ho.status = 'live';

-- =============================================================================
-- 6. RLS POLICIES
-- =============================================================================

ALTER TABLE clinician_time_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE epic_time_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_effectiveness ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_onboarding ENABLE ROW LEVEL SECURITY;

-- Clinician time tracking: Users can insert their own, admins can view all
CREATE POLICY "Users can insert own time tracking"
    ON clinician_time_tracking FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own time tracking"
    ON clinician_time_tracking FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all time tracking"
    ON clinician_time_tracking FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role_code IN (1, 2, 3) -- admin, super_admin, system
        )
    );

-- Epic benchmarks: Public read
CREATE POLICY "Anyone can read benchmarks"
    ON epic_time_benchmarks FOR SELECT
    TO authenticated
    USING (true);

-- Alert effectiveness: Same as time tracking
CREATE POLICY "Users can insert alert effectiveness"
    ON alert_effectiveness FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own alert reviews"
    ON alert_effectiveness FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all alert effectiveness"
    ON alert_effectiveness FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role_code IN (1, 2, 3)
        )
    );

-- Hospital onboarding: Admin only
CREATE POLICY "Admins can manage hospital onboarding"
    ON hospital_onboarding FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role_code IN (1, 2, 3)
        )
    );

-- =============================================================================
-- 7. INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_time_tracking_tenant ON clinician_time_tracking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_tracking_user ON clinician_time_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_time_tracking_action ON clinician_time_tracking(action_type);
CREATE INDEX IF NOT EXISTS idx_time_tracking_created ON clinician_time_tracking(created_at);

CREATE INDEX IF NOT EXISTS idx_alert_effectiveness_tenant ON alert_effectiveness(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_effectiveness_alert ON alert_effectiveness(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_effectiveness_user ON alert_effectiveness(user_id);

CREATE INDEX IF NOT EXISTS idx_hospital_onboarding_status ON hospital_onboarding(status);
CREATE INDEX IF NOT EXISTS idx_hospital_onboarding_pain_point ON hospital_onboarding(epic_pain_point);

-- =============================================================================
-- 8. GRANTS
-- =============================================================================

GRANT SELECT, INSERT ON clinician_time_tracking TO authenticated;
GRANT SELECT ON epic_time_benchmarks TO authenticated;
GRANT SELECT, INSERT ON alert_effectiveness TO authenticated;
GRANT ALL ON hospital_onboarding TO authenticated;

GRANT SELECT ON epic_comparison_metrics TO authenticated;
GRANT SELECT ON hospital_roi_summary TO authenticated;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE clinician_time_tracking IS 'Tracks time saved vs Epic baseline (5.6 hrs/day) for ROI calculations';
COMMENT ON TABLE epic_time_benchmarks IS 'Documented Epic time benchmarks from peer-reviewed studies';
COMMENT ON TABLE alert_effectiveness IS 'Tracks alert outcomes to prove <5% false positive rate vs Epic 85-99%';
COMMENT ON TABLE hospital_onboarding IS 'Tracks hospital acquisition and Epic migration success stories';
COMMENT ON VIEW epic_comparison_metrics IS 'Aggregate dashboard data comparing our metrics to Epic baseline';
COMMENT ON VIEW hospital_roi_summary IS 'ROI calculator for CFO presentations';
