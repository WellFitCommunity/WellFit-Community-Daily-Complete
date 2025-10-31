# Rate Limiting Guide for Edge Functions

## Overview

WellFit Community Healthcare Platform implements distributed rate limiting to protect against:
- Brute force attacks
- Denial of Service (DoS)
- Resource exhaustion
- API abuse

## Architecture

### Storage
Rate limiting uses the `rate_limit_attempts` table for distributed tracking across all edge function instances.

### Key Components
1. **rateLimiter.ts** - Shared middleware for rate limiting
2. **rate_limit_attempts** table - Persistent attempt tracking
3. **Rate limit configurations** - Pre-defined limits for different endpoint types

## Usage

### Basic Implementation

```typescript
import { withRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";
import { withCORS } from "../_shared/auth.ts";

// Your handler function
async function handleRequest(req: Request): Promise<Response> {
  // Your logic here
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Wrap with rate limiting
serve(
  withCORS(
    withRateLimit(
      handleRequest,
      RATE_LIMITS.API, // 60 requests per minute
      (req) => req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    )
  )
);
```

### Rate Limit Configurations

```typescript
// AUTH endpoints (login, register, password reset)
RATE_LIMITS.AUTH: {
  maxAttempts: 5,
  windowSeconds: 300, // 5 minutes
  keyPrefix: 'auth'
}

// General API endpoints
RATE_LIMITS.API: {
  maxAttempts: 60,
  windowSeconds: 60, // 1 minute
  keyPrefix: 'api'
}

// Read-only operations
RATE_LIMITS.READ: {
  maxAttempts: 100,
  windowSeconds: 60,
  keyPrefix: 'read'
}

// Expensive operations (AI, reports, exports)
RATE_LIMITS.EXPENSIVE: {
  maxAttempts: 10,
  windowSeconds: 600, // 10 minutes
  keyPrefix: 'expensive'
}

// AI/Claude API calls
RATE_LIMITS.AI: {
  maxAttempts: 30,
  windowSeconds: 60,
  keyPrefix: 'ai'
}
```

### Custom Identifier

By default, rate limiting uses IP address. For user-specific limiting:

```typescript
import { requireUser } from "../_shared/auth.ts";

withRateLimit(
  handler,
  RATE_LIMITS.API,
  async (req) => {
    try {
      const user = await requireUser(req);
      return `user:${user.id}`;
    } catch {
      // Fall back to IP if not authenticated
      return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    }
  }
)
```

## Response Headers

Rate-limited responses include these headers:

```
X-RateLimit-Limit: 60          # Maximum requests allowed
X-RateLimit-Remaining: 45      # Requests remaining in window
X-RateLimit-Reset: 1698765432  # Unix timestamp when limit resets
Retry-After: 45                 # Seconds to wait before retry (if limited)
```

## HTTP 429 Response

When rate limit is exceeded:

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 45 seconds.",
  "retryAfter": 45,
  "resetAt": "2025-10-31T12:34:56.789Z"
}
```

## Monitoring

View rate limit patterns:

```sql
-- Real-time rate limit monitoring
SELECT * FROM rate_limit_monitoring
ORDER BY attempt_count DESC
LIMIT 20;

-- Specific identifier
SELECT
  attempted_at,
  metadata
FROM rate_limit_attempts
WHERE identifier = 'auth:192.168.1.1'
ORDER BY attempted_at DESC
LIMIT 10;
```

## Maintenance

### Automatic Cleanup

The `cleanup_old_rate_limit_attempts()` function runs daily to remove attempts older than 24 hours.

Set up pg_cron job:

```sql
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 3 * * *', -- 3 AM daily
  $$SELECT cleanup_old_rate_limit_attempts()$$
);
```

### Manual Cleanup

```sql
-- Remove all attempts for specific identifier
DELETE FROM rate_limit_attempts
WHERE identifier = 'auth:192.168.1.1';

-- Remove all old attempts immediately
SELECT cleanup_old_rate_limit_attempts();
```

## Security Considerations

1. **Fail Open** - Rate limiter fails open on errors to prevent availability issues
2. **Service Role Only** - Only edge functions (service role) can write attempts
3. **Admin Visibility** - Admins can view rate limit patterns for security monitoring
4. **No User PII** - Identifiers should not contain PII unless necessary

## Existing Implementations

### login/index.ts
Uses legacy `rate_limit_logins` table (5 attempts / 15 minutes).

**Status:** PRODUCTION - Keep existing implementation

### admin-login/index.ts
Should use `RATE_LIMITS.AUTH` configuration.

**Recommendation:** Add rate limiting if missing

### Claude AI Functions
Should use `RATE_LIMITS.AI` or `RATE_LIMITS.EXPENSIVE`.

**Files to update:**
- claude-chat/index.ts
- claude-personalization/index.ts
- process-medical-transcript/index.ts
- realtime_medical_transcription/index.ts

### High-Volume Endpoints
Should use `RATE_LIMITS.API` or `RATE_LIMITS.READ`.

**Examples:**
- get-risk-assessments/index.ts
- enhanced-fhir-export/index.ts
- mobile-sync/index.ts

## Testing

```bash
# Test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:54321/functions/v1/your-function \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
  sleep 1
done

# Should return 429 after configured limit
```

## Migration Checklist

For each edge function:

- [ ] Identify appropriate rate limit config
- [ ] Import `withRateLimit` and `RATE_LIMITS`
- [ ] Wrap handler with rate limiting
- [ ] Test with curl/Postman
- [ ] Update function documentation
- [ ] Monitor for false positives

## SOC2 Compliance

Rate limiting supports SOC2 controls:
- **CC6.1** - Logical access controls
- **CC6.6** - Detection and mitigation of security events
- **CC7.2** - System monitoring

Audit trail maintained in:
- `rate_limit_attempts` table
- `security_events` table (via automatic logging)
- `audit_logs` table (for authentication events)

## Support

For issues or questions:
- Review this guide
- Check `rate_limit_monitoring` view
- Contact: security@thewellfitcommunity.org
