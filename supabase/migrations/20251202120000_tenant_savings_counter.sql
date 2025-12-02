-- =====================================================
-- TENANT SAVINGS COUNTER
-- Purpose: Simple counter for total savings per tenant
-- Date: 2025-12-02
-- =====================================================

-- Add savings column to tenants table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenants' AND column_name = 'total_savings'
    ) THEN
        ALTER TABLE tenants ADD COLUMN total_savings DECIMAL(12,2) DEFAULT 0;
    END IF;
END $$;

-- Create view to aggregate tenant savings from staff_financial_savings
CREATE OR REPLACE VIEW tenant_savings_totals AS
SELECT
    t.id as tenant_id,
    t.name as tenant_name,
    t.tenant_code,
    COALESCE(SUM(s.amount_saved), 0) as total_saved,
    COALESCE(SUM(s.amount_saved) FILTER (WHERE s.verification_status = 'verified'), 0) as verified_saved,
    COUNT(s.id) as savings_events,
    COUNT(DISTINCT s.staff_user_id) as contributing_staff
FROM tenants t
LEFT JOIN staff_financial_savings s ON t.id = s.tenant_id
GROUP BY t.id, t.name, t.tenant_code;

-- Function to get tenant savings
CREATE OR REPLACE FUNCTION get_tenant_savings_totals()
RETURNS TABLE (
    tenant_id UUID,
    tenant_name TEXT,
    tenant_code TEXT,
    total_saved DECIMAL,
    verified_saved DECIMAL,
    savings_events BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id as tenant_id,
        t.name as tenant_name,
        t.tenant_code,
        COALESCE(SUM(s.amount_saved), 0)::DECIMAL as total_saved,
        COALESCE(SUM(s.amount_saved) FILTER (WHERE s.verification_status = 'verified'), 0)::DECIMAL as verified_saved,
        COUNT(s.id)::BIGINT as savings_events
    FROM tenants t
    LEFT JOIN staff_financial_savings s ON t.id = s.tenant_id
    GROUP BY t.id, t.name, t.tenant_code
    ORDER BY total_saved DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update a tenant's savings manually (for super admins)
CREATE OR REPLACE FUNCTION update_tenant_savings(
    p_tenant_id UUID,
    p_amount DECIMAL,
    p_description TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE tenants
    SET total_savings = COALESCE(total_savings, 0) + p_amount
    WHERE id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access
GRANT EXECUTE ON FUNCTION get_tenant_savings_totals TO authenticated;
GRANT EXECUTE ON FUNCTION update_tenant_savings TO authenticated;
GRANT SELECT ON tenant_savings_totals TO authenticated;

COMMENT ON COLUMN tenants.total_savings IS 'Running total of cost savings for this tenant';
