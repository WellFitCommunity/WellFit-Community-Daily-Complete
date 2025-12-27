-- Migration: Create PostgreSQL function for accurate claim metrics aggregation
-- This replaces client-side calculation with database-level aggregation
-- for accurate metrics across all claims (not limited by pagination)

-- Create the return type for claim metrics
CREATE TYPE claim_metrics_result AS (
  status TEXT,
  count BIGINT,
  total_amount NUMERIC
);

-- Create the aggregation function
CREATE OR REPLACE FUNCTION get_claim_metrics(p_provider_id UUID DEFAULT NULL)
RETURNS TABLE (
  status TEXT,
  count BIGINT,
  total_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.status::TEXT,
    COUNT(*)::BIGINT as count,
    COALESCE(SUM(c.total_charge), 0)::NUMERIC as total_amount
  FROM claims c
  WHERE (p_provider_id IS NULL OR c.billing_provider_id = p_provider_id)
  GROUP BY c.status
  ORDER BY c.status;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_claim_metrics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_claim_metrics(UUID) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION get_claim_metrics(UUID) IS
  'Returns aggregated claim metrics (count and total amount) grouped by status.
   Optionally filter by billing_provider_id. Uses database-level aggregation
   for accuracy instead of client-side calculation with limited results.';
