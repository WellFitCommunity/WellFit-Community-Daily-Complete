-- Check SMS verification errors in audit logs
-- Run this in your Supabase SQL Editor to see why SMS is failing

-- Recent SMS-related events (last 50)
SELECT
  created_at,
  event_type,
  success,
  error_code,
  error_message,
  metadata->>'phone' as phone_number,
  metadata
FROM audit_logs
WHERE event_type IN (
  'SMS_VERIFICATION_SENT',
  'SMS_VERIFICATION_FAILED',
  'SMS_VERIFICATION_ERROR'
)
ORDER BY created_at DESC
LIMIT 50;

-- Summary: How many failures vs successes?
SELECT
  event_type,
  success,
  COUNT(*) as count,
  MAX(created_at) as most_recent
FROM audit_logs
WHERE event_type IN (
  'SMS_VERIFICATION_SENT',
  'SMS_VERIFICATION_FAILED',
  'SMS_VERIFICATION_ERROR'
)
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY event_type, success
ORDER BY event_type, success;

-- Most recent error details
SELECT
  created_at,
  error_code,
  error_message,
  metadata
FROM audit_logs
WHERE event_type IN ('SMS_VERIFICATION_FAILED', 'SMS_VERIFICATION_ERROR')
AND success = false
ORDER BY created_at DESC
LIMIT 5;
