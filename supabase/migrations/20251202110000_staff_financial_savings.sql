-- =====================================================
-- STAFF FINANCIAL SAVINGS TRACKER
-- Purpose: Track cost savings attributed to each staff member/position
-- Date: 2025-12-02
-- =====================================================

-- Table: staff_financial_savings
-- Tracks individual savings events per staff member
CREATE TABLE IF NOT EXISTS staff_financial_savings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

    -- Staff identification
    staff_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    staff_name TEXT NOT NULL,
    position_type TEXT NOT NULL CHECK (position_type IN (
        'nurse', 'nurse_practitioner', 'physician', 'physician_assistant',
        'medical_assistant', 'care_coordinator', 'social_worker',
        'community_health_worker', 'admin', 'billing_specialist', 'other'
    )),
    department TEXT,

    -- Savings details
    savings_category TEXT NOT NULL CHECK (savings_category IN (
        'prevented_readmission',        -- Prevented hospital readmission
        'early_intervention',           -- Early intervention prevented escalation
        'care_coordination',            -- Efficient care coordination
        'medication_optimization',      -- Medication cost savings
        'preventive_care',              -- Preventive care reducing future costs
        'documentation_efficiency',     -- AI/automation documentation savings
        'telehealth_efficiency',        -- Telehealth vs in-person savings
        'reduced_er_visits',            -- Prevented unnecessary ER visits
        'discharge_planning',           -- Efficient discharge reducing LOS
        'sdoh_intervention',            -- SDOH intervention preventing costs
        'other'
    )),

    -- Financial data
    amount_saved DECIMAL(12,2) NOT NULL DEFAULT 0,
    baseline_cost DECIMAL(12,2),        -- What it would have cost without intervention
    actual_cost DECIMAL(12,2),          -- What it actually cost

    -- Context
    patient_id UUID,                    -- Optional: which patient (no PHI stored)
    encounter_id UUID,
    description TEXT,
    notes TEXT,

    -- Verification
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'disputed', 'rejected')),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_staff_savings_tenant ON staff_financial_savings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_savings_user ON staff_financial_savings(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_savings_position ON staff_financial_savings(position_type);
CREATE INDEX IF NOT EXISTS idx_staff_savings_category ON staff_financial_savings(savings_category);
CREATE INDEX IF NOT EXISTS idx_staff_savings_created ON staff_financial_savings(created_at DESC);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_staff_savings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_staff_savings_timestamp ON staff_financial_savings;
CREATE TRIGGER trigger_update_staff_savings_timestamp
    BEFORE UPDATE ON staff_financial_savings
    FOR EACH ROW
    EXECUTE FUNCTION update_staff_savings_timestamp();

-- View: staff_savings_summary
-- Aggregated savings by staff member
CREATE OR REPLACE VIEW staff_savings_summary AS
SELECT
    s.staff_user_id,
    s.staff_name,
    s.position_type,
    s.department,
    s.tenant_id,
    COUNT(*) as total_savings_events,
    SUM(s.amount_saved) as total_amount_saved,
    AVG(s.amount_saved) as avg_amount_per_event,
    MIN(s.created_at) as first_savings_date,
    MAX(s.created_at) as last_savings_date,
    COUNT(*) FILTER (WHERE s.verification_status = 'verified') as verified_count,
    SUM(s.amount_saved) FILTER (WHERE s.verification_status = 'verified') as verified_amount,
    jsonb_object_agg(
        s.savings_category,
        s.amount_saved
    ) FILTER (WHERE s.savings_category IS NOT NULL) as savings_by_category
FROM staff_financial_savings s
GROUP BY s.staff_user_id, s.staff_name, s.position_type, s.department, s.tenant_id;

-- View: position_savings_summary
-- Aggregated savings by position type
CREATE OR REPLACE VIEW position_savings_summary AS
SELECT
    s.position_type,
    s.tenant_id,
    COUNT(DISTINCT s.staff_user_id) as staff_count,
    COUNT(*) as total_savings_events,
    SUM(s.amount_saved) as total_amount_saved,
    AVG(s.amount_saved) as avg_per_event,
    SUM(s.amount_saved) / NULLIF(COUNT(DISTINCT s.staff_user_id), 0) as avg_per_staff,
    COUNT(*) FILTER (WHERE s.verification_status = 'verified') as verified_events,
    SUM(s.amount_saved) FILTER (WHERE s.verification_status = 'verified') as verified_amount
FROM staff_financial_savings s
GROUP BY s.position_type, s.tenant_id;

-- RPC: Get staff savings with date range
CREATE OR REPLACE FUNCTION get_staff_savings(
    p_tenant_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_position_type TEXT DEFAULT NULL,
    p_staff_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    staff_user_id UUID,
    staff_name TEXT,
    position_type TEXT,
    department TEXT,
    total_savings_events BIGINT,
    total_amount_saved DECIMAL,
    verified_amount DECIMAL,
    savings_by_category JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.staff_user_id,
        s.staff_name,
        s.position_type,
        s.department,
        COUNT(*)::BIGINT as total_savings_events,
        COALESCE(SUM(s.amount_saved), 0)::DECIMAL as total_amount_saved,
        COALESCE(SUM(s.amount_saved) FILTER (WHERE s.verification_status = 'verified'), 0)::DECIMAL as verified_amount,
        jsonb_object_agg(
            COALESCE(s.savings_category, 'unknown'),
            COALESCE(s.amount_saved, 0)
        ) as savings_by_category
    FROM staff_financial_savings s
    WHERE s.tenant_id = p_tenant_id
      AND (p_start_date IS NULL OR s.created_at >= p_start_date)
      AND (p_end_date IS NULL OR s.created_at <= p_end_date + INTERVAL '1 day')
      AND (p_position_type IS NULL OR s.position_type = p_position_type)
      AND (p_staff_user_id IS NULL OR s.staff_user_id = p_staff_user_id)
    GROUP BY s.staff_user_id, s.staff_name, s.position_type, s.department
    ORDER BY total_amount_saved DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get savings totals by position type
CREATE OR REPLACE FUNCTION get_position_savings_totals(
    p_tenant_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    position_type TEXT,
    staff_count BIGINT,
    total_events BIGINT,
    total_saved DECIMAL,
    avg_per_staff DECIMAL,
    verified_total DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.position_type,
        COUNT(DISTINCT s.staff_user_id)::BIGINT as staff_count,
        COUNT(*)::BIGINT as total_events,
        COALESCE(SUM(s.amount_saved), 0)::DECIMAL as total_saved,
        COALESCE(SUM(s.amount_saved) / NULLIF(COUNT(DISTINCT s.staff_user_id), 0), 0)::DECIMAL as avg_per_staff,
        COALESCE(SUM(s.amount_saved) FILTER (WHERE s.verification_status = 'verified'), 0)::DECIMAL as verified_total
    FROM staff_financial_savings s
    WHERE s.tenant_id = p_tenant_id
      AND (p_start_date IS NULL OR s.created_at >= p_start_date)
      AND (p_end_date IS NULL OR s.created_at <= p_end_date + INTERVAL '1 day')
    GROUP BY s.position_type
    ORDER BY total_saved DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE staff_financial_savings ENABLE ROW LEVEL SECURITY;

-- Admin can view all savings for their tenant
CREATE POLICY staff_savings_admin_read ON staff_financial_savings
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT p.tenant_id FROM profiles p
            WHERE p.user_id = auth.uid()
            AND (p.is_admin = true OR p.role IN ('admin', 'super_admin', 'finance', 'billing_specialist'))
        )
    );

-- Admin can insert savings records
CREATE POLICY staff_savings_admin_insert ON staff_financial_savings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tenant_id IN (
            SELECT p.tenant_id FROM profiles p
            WHERE p.user_id = auth.uid()
            AND (p.is_admin = true OR p.role IN ('admin', 'super_admin', 'finance', 'nurse', 'care_coordinator'))
        )
    );

-- Admin can update savings records
CREATE POLICY staff_savings_admin_update ON staff_financial_savings
    FOR UPDATE
    TO authenticated
    USING (
        tenant_id IN (
            SELECT p.tenant_id FROM profiles p
            WHERE p.user_id = auth.uid()
            AND (p.is_admin = true OR p.role IN ('admin', 'super_admin', 'finance'))
        )
    );

-- Grant permissions
GRANT SELECT ON staff_savings_summary TO authenticated;
GRANT SELECT ON position_savings_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_staff_savings TO authenticated;
GRANT EXECUTE ON FUNCTION get_position_savings_totals TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE staff_financial_savings IS 'Tracks financial savings attributed to individual staff members for budgetary analysis and performance tracking';
