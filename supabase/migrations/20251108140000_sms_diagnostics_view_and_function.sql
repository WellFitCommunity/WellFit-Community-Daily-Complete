-- Migration: SMS Diagnostics View and Function
-- Purpose: Provide automated SMS error diagnostics across all white-label instances
-- Date: 2025-11-08
-- Author: Claude (Healthcare Security Enhancement)

-- =============================================================================
-- SMS Error Diagnostics View
-- =============================================================================
-- This view provides a quick way to check SMS verification status and errors
-- Useful for troubleshooting Twilio configuration issues across deployments

CREATE OR REPLACE VIEW sms_diagnostics_recent AS
SELECT
  created_at,
  event_type,
  success,
  error_code,
  error_message,
  metadata->>'phone' as phone_number,
  actor_ip_address,
  metadata
FROM audit_logs
WHERE event_type IN (
  'SMS_VERIFICATION_SENT',
  'SMS_VERIFICATION_FAILED',
  'SMS_VERIFICATION_ERROR'
)
AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

COMMENT ON VIEW sms_diagnostics_recent IS
'Shows SMS verification events from last 7 days for troubleshooting Twilio issues';

-- =============================================================================
-- SMS Error Summary Function
-- =============================================================================
-- Returns aggregated SMS success/failure statistics
-- Helps identify systematic issues with SMS delivery

CREATE OR REPLACE FUNCTION get_sms_error_summary(
  days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  event_type TEXT,
  success BOOLEAN,
  count BIGINT,
  most_recent TIMESTAMPTZ,
  common_errors TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.event_type::TEXT,
    al.success,
    COUNT(*)::BIGINT as count,
    MAX(al.created_at) as most_recent,
    ARRAY_AGG(DISTINCT al.error_message) FILTER (WHERE al.error_message IS NOT NULL) as common_errors
  FROM audit_logs al
  WHERE al.event_type IN (
    'SMS_VERIFICATION_SENT',
    'SMS_VERIFICATION_FAILED',
    'SMS_VERIFICATION_ERROR'
  )
  AND al.created_at > NOW() - (days_back || ' days')::INTERVAL
  GROUP BY al.event_type, al.success
  ORDER BY al.event_type, al.success;
END;
$$;

COMMENT ON FUNCTION get_sms_error_summary IS
'Returns SMS verification statistics and common errors for specified time period (default: 7 days)';

-- =============================================================================
-- Latest SMS Error Function
-- =============================================================================
-- Returns the most recent SMS error details for troubleshooting

CREATE OR REPLACE FUNCTION get_latest_sms_error()
RETURNS TABLE (
  occurred_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  phone_number TEXT,
  full_metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.created_at as occurred_at,
    al.error_code::TEXT,
    al.error_message::TEXT,
    al.metadata->>'phone' as phone_number,
    al.metadata as full_metadata
  FROM audit_logs al
  WHERE al.event_type IN ('SMS_VERIFICATION_FAILED', 'SMS_VERIFICATION_ERROR')
  AND al.success = false
  ORDER BY al.created_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_latest_sms_error IS
'Returns the most recent SMS error for quick troubleshooting';

-- =============================================================================
-- Grant Permissions
-- =============================================================================
-- Allow authenticated users and service role to query diagnostics
-- Important for admin dashboards and monitoring

GRANT SELECT ON sms_diagnostics_recent TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_sms_error_summary TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_latest_sms_error TO authenticated, service_role;

-- =============================================================================
-- Usage Examples (as comments for documentation)
-- =============================================================================
/*

-- View recent SMS events:
SELECT * FROM sms_diagnostics_recent LIMIT 20;

-- Get SMS statistics for last 7 days:
SELECT * FROM get_sms_error_summary(7);

-- Get SMS statistics for last 24 hours:
SELECT * FROM get_sms_error_summary(1);

-- Get the latest SMS error:
SELECT * FROM get_latest_sms_error();

-- Check if SMS is working (no errors in last hour):
SELECT COUNT(*) as recent_errors
FROM audit_logs
WHERE event_type IN ('SMS_VERIFICATION_FAILED', 'SMS_VERIFICATION_ERROR')
AND success = false
AND created_at > NOW() - INTERVAL '1 hour';

-- From application code (using Supabase client):
const { data, error } = await supabase.rpc('get_sms_error_summary', { days_back: 7 });
const { data: latestError } = await supabase.rpc('get_latest_sms_error');
const { data: recentEvents } = await supabase.from('sms_diagnostics_recent').select('*').limit(20);

*/
