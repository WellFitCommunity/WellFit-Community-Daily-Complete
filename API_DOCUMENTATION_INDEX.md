# API Documentation Index

This directory contains comprehensive documentation for all API endpoints and external integrations used by the WellFit Community Daily application.

## Documentation Files

### 1. **API_ENDPOINTS_COMPLETE_DOCUMENTATION.md** (1537 lines)
The comprehensive, detailed reference covering:
- All Vercel API endpoints with request/response formats
- All 59 Supabase Edge Functions with authentication & external service integrations
- Detailed external service integration documentation (Anthropic, Twilio, MailerSend, Daily.co, Deepgram, hCaptcha)
- Authentication & authorization mechanisms (JWT, API Keys, Service Roles)
- Rate limiting strategy (database-based distributed, memory-based fallback)
- CORS configuration and security headers (CSP, HSTS, etc.)
- Data formats and schemas (E.164 phones, UUIDs, ISO timestamps)
- Error handling and HTTP status codes
- HIPAA audit logging requirements
- Integration patterns and data flows

**Use this for**: Deep dive understanding of the API architecture, implementation details, and compliance requirements.

### 2. **API_QUICK_REFERENCE.md** (680 lines)
Quick reference tables and summaries including:
- Endpoint summary tables (Vercel & Supabase)
- External service quick reference (endpoints, auth, limits)
- Authentication method comparison
- Rate limiting thresholds
- CORS allowed origins
- Response codes and error formats
- Data format specifications
- Common request/response examples
- Environment variables checklist
- Webhook integration points
- Performance considerations
- Testing examples and debugging tips
- Integration checklist

**Use this for**: Quick lookups while developing, testing endpoints, and verifying configurations.

---

## Quick Navigation

### By Category

#### Authentication
- Vercel: `/api/auth/login`, `/api/auth/logout`
- Supabase: `/register`, `/verify-sms-code`, `/login`, `/passkey-*`
- See: Complete Doc sections 1.1, 2.1

#### Communication
- Email: `/api/email/send`, `/send-email`, `/send_welcome_email`
- SMS: `/api/sms/send`, `/send-sms`, `/sms-send-code`
- Notifications: `/send-team-alert`, `/send-appointment-reminder`, `/send-telehealth-appointment-notification`
- See: Complete Doc sections 1.2, 1.3, 2.3

#### Healthcare
- Telehealth: `/create-telehealth-room`, `/create-patient-telehealth-token`
- Check-ins: `/create-checkin`, `/send-checkin-reminders`
- Clinical: `/check-drug-interactions`, `/extract-patient-form`, `/process-medical-transcript`, `/realtime_medical_transcription`
- Coding: `/coding-suggest`, `/sdoh-coding-suggest`
- See: Complete Doc section 2.5

#### AI Integration
- Claude Chat: `/api/anthropic-chats`, `/claude-chat`
- Personalization: `/claude-personalization`
- Guardian Agent: `/guardian-agent`, `/guardian-agent-api`, `/guardian-pr-service`
- See: Complete Doc section 2.6

#### Admin & Management
- Admin Auth: `/admin-register`, `/admin-login`, `/admin_set_pin`, `/verify-admin-pin`
- Admin Actions: `/admin_start_session`, `/admin_end_session`, `/admin-user-questions`
- Role Management: `/api/admin/grant-role`, `/api/admin/revoke-role`
- See: Complete Doc section 1.5, 2.2

#### User Data
- Profile: `/api/me/profile`, `/api/me/check_ins`
- Sync: `/mobile-sync`
- Management: `/user-data-management`, `/update-profile-note`
- See: Complete Doc section 2.7

#### Integrations
- API Keys: `/generate-api-key`, `/validate-api-key`
- Enrollment: `/enrollClient`
- FHIR Export: `/enhanced-fhir-export`
- Billing: `/generate-837p`
- See: Complete Doc section 2.8

---

## External Service Integration Matrix

| Service | Endpoint | Auth | Status Page | API Doc |
|---------|----------|------|-------------|---------|
| **Anthropic Claude** | https://api.anthropic.com/v1/messages | x-api-key | https://status.anthropic.com | https://docs.anthropic.com |
| **Twilio** | https://api.twilio.com/2010-04-01 | Basic Auth | https://status.twilio.com | https://www.twilio.com/docs |
| **MailerSend** | https://api.mailersend.com/v1 | Bearer Token | https://status.mailersend.com | https://www.mailersend.com/api |
| **Daily.co** | https://api.daily.co/v1 | API Key | https://status.daily.co | https://docs.daily.co |
| **Deepgram** | https://api.deepgram.com/v1 | API Key | https://status.deepgram.com | https://developers.deepgram.com |
| **hCaptcha** | https://hcaptcha.com/siteverify | Secret | N/A | https://docs.hcaptcha.com |
| **Supabase** | https://{url}.supabase.co | Multiple | https://status.supabase.com | https://supabase.com/docs |

---

## Authentication Reference

### Vercel Endpoints (`/api/*`)
- **Public**: None (some endpoints CORS-restricted)
- **User**: `Authorization: Bearer {jwt_token}`
- **Admin**: Supabase RLS enforcement + role check
- **Internal**: `X-Internal-API-Key: {key}` or `Authorization: Bearer {key}`

### Supabase Edge Functions (`/functions/v1/*`)
- **Public**: None (most endpoints public but CORS-protected)
- **User**: `Authorization: Bearer {jwt_token}`
- **Admin**: Role verification via RLS
- **Internal**: `x-internal-secret: {secret}`

---

## Rate Limiting Summary

### Strictest Limits (Most Protected)
- Admin PIN verification: 3 attempts / 5 minutes
- SMS verification: 5 attempts / 5 minutes
- Authentication: 5 attempts / 15 minutes

### Standard Limits
- Login/auth flow: 5 req / 5 minutes (IP-based)
- API calls: 60 req / 1 minute
- Read operations: 100 req / 1 minute

### Generous Limits
- AI requests: 30 req / 1 minute (user-based)
- Expensive operations: 10 req / 10 minutes

---

## Environment Variables Checklist

### Required
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_MESSAGING_SERVICE_SID
TWILIO_VERIFY_SERVICE_SID
MAILERSEND_API_KEY
MAILERSEND_FROM_EMAIL
HCAPTCHA_SECRET
INTERNAL_API_KEY
```

### Optional
```
TWILIO_FROM_NUMBER
MAILERSEND_FROM_NAME
MAILERSEND_REPLY_TO
DAILY_API_KEY
DEEPGRAM_API_KEY
DEV_ALLOW_LOCAL
ALLOWED_ORIGINS
CORS_ORIGINS
```

See Complete Doc section "External Service Integrations" for detailed requirements.

---

## Common Workflows

### User Registration
1. POST `/register` with hCaptcha token
2. hCaptcha verification at https://hcaptcha.com/siteverify
3. SMS code sent via Twilio Verify
4. POST `/verify-sms-code` to complete registration
5. User account created in Supabase Auth
6. Welcome email sent via MailerSend

### Patient Telehealth Appointment
1. POST `/create-telehealth-room` (requires auth) → Daily.co
2. POST `/create-patient-telehealth-token` (patient-specific)
3. Notification sent via Twilio SMS & MailerSend email
4. Room event webhooks logged to audit_logs
5. Recording available via Daily.co API

### Medical Coding Suggestion
1. GET `/coding-suggest?description=...&type=icd10`
2. Claude API called with medical coding system prompt
3. Response with ICD-10 or CPT suggestions
4. Request logged to claude_api_audit table
5. Cost calculated and tracked

### Data Export (GDPR/HIPAA)
1. POST `/user-data-management?action=export`
2. Generate FHIR Bundle via `/enhanced-fhir-export`
3. Query audit logs for compliance
4. Package and deliver to user
5. Log to audit_logs for accountability

---

## Security Considerations

### HIPAA Compliance
- All PHI access logged to `audit_logs` table
- Retention: 7 years (2555 days)
- Fields tracked: actor, IP, operation, resource, timestamp
- Service-side encryption for sensitive data

### CORS Protection
- Strict allowlist of origins (no wildcards except development)
- GitHub Codespaces dynamic URLs supported
- All external services whitelisted in CSP

### Rate Limiting
- IP-based for unauthenticated endpoints
- User-based for authenticated endpoints
- Database-backed for distributed enforcement
- Retry-After header in 429 responses

### API Key Management
- Stored hashed in database
- Scoped by resource and operation
- Configurable expiry (24h - 365d)
- Validated per-request

---

## Testing & Debugging

### Test Endpoint (Postman/curl)
See Quick Reference section "Testing Endpoints" for ready-to-use examples.

### Enable Debugging
```typescript
// In service files
if (process.env.DEBUG_API) {
  console.log('[API Request]', method, url);
  console.log('[Request Body]', body);
}
```

### Monitor Rate Limits
Response headers include:
- `X-RateLimit-Limit`: max requests
- `X-RateLimit-Remaining`: requests left
- `X-RateLimit-Reset`: Unix timestamp reset time

### Validate JWT Tokens
```bash
# Decode token claims
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq .

# Check expiry time
jq '.exp | todate' <<< $(...)
```

---

## Status & Monitoring

### Service Health Dashboards
- **Anthropic**: https://status.anthropic.com
- **Twilio**: https://status.twilio.com
- **MailerSend**: https://status.mailersend.com
- **Supabase**: https://status.supabase.com
- **Daily.co**: https://status.daily.co
- **Deepgram**: https://status.deepgram.com

### Application Metrics
- API response times
- Error rates per endpoint
- Rate limit exceeded count
- External service latency
- Cost per Claude token

---

## Troubleshooting

### Common Issues

**401 Unauthorized**
- Check Bearer token validity and expiry
- Verify token in Authorization header format
- Check role permissions via RLS

**429 Too Many Requests**
- Check `X-RateLimit-Remaining` header
- Wait `Retry-After` seconds before retrying
- Review rate limit configuration

**500 Internal Server Error**
- Check external service status dashboards
- Review server logs for detailed error
- Verify all environment variables set
- Check database connectivity

**CORS Error**
- Verify origin in ALLOWED_ORIGINS list
- Check CSP policy for resource type
- For development, enable DEV_ALLOW_LOCAL

**SMS Not Received**
- Verify phone in E.164 format (+12125551234)
- Check Twilio account balance/permissions
- Review Twilio delivery webhooks
- Check audit_logs for send errors

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-11-04 | Initial comprehensive documentation |

---

## Contact & Support

For API integration questions or issues:
1. Check the documentation files in order (Quick Ref → Complete Doc)
2. Review troubleshooting section above
3. Check service status dashboards
4. Review application logs and audit trails
5. Contact development team

---

