# WellFit Community Daily - API Quick Reference Guide

## Vercel API Endpoints Summary

| Endpoint | Method | Purpose | Auth | Rate Limit |
|----------|--------|---------|------|-----------|
| `/api/auth/login` | POST | User login | None | Standard |
| `/api/auth/logout` | POST | User logout | Bearer | Standard |
| `/api/email/send` | POST | Send email | Bearer/API Key | 60/min |
| `/api/sms/send` | POST | Send SMS | Bearer/API Key | 60/min |
| `/api/registerPushToken` | POST | Register FCM token | Bearer | 60/min |
| `/api/admin/grant-role` | POST | Grant admin role | Super Admin | Standard |
| `/api/admin/revoke-role` | POST | Revoke admin role | Super Admin | Standard |
| `/api/functions/verify-admin-pin` | POST | Verify admin PIN | None | 3/5min |
| `/api/me/profile` | GET | Get user profile | Bearer | 100/min |
| `/api/me/check_ins` | GET | Get check-ins | Bearer | 100/min |
| `/api/anthropic-chats` | POST | Claude AI proxy | CORS | 60/min |

---

## Supabase Edge Functions Summary

| Endpoint | Method | Purpose | Auth | External Service |
|----------|--------|---------|------|------------------|
| `/register` | POST | User registration | None | hCaptcha, Twilio |
| `/verify-sms-code` | POST | Verify SMS code | None | Twilio Verify |
| `/login` | POST | User login | None | None |
| `/passkey-auth-start` | POST | Start passkey auth | None | None |
| `/passkey-auth-finish` | POST | Finish passkey auth | None | None |
| `/admin-register` | POST | Admin registration | Super Admin | None |
| `/admin-login` | POST | Admin login | None | None |
| `/admin_set_pin` | POST | Set admin PIN | Super Admin | None |
| `/verify-admin-pin` | POST | Verify admin PIN | None | None |
| `/send-email` | POST | Send email | Bearer | MailerSend |
| `/send-sms` | POST | Send SMS | Bearer | Twilio |
| `/sms-send-code` | POST | Send SMS code | None | Twilio Verify |
| `/send_welcome_email` | POST | Welcome email | Internal | MailerSend |
| `/create-checkin` | POST | Create check-in | Bearer | None |
| `/send-checkin-reminders` | POST | Send reminders | Internal | Twilio/MailerSend |
| `/send-appointment-reminder` | POST | Appointment reminder | Internal | Twilio/MailerSend |
| `/send-telehealth-appointment-notification` | POST | Telehealth notification | Internal | Twilio/MailerSend |
| `/send-team-alert` | POST | Team alert | Bearer | Twilio/MailerSend |
| `/notify-stale-checkins` | POST | Stale checkin alert | Internal | Twilio/MailerSend |
| `/send-stale-reminders` | POST | Stale data reminders | Internal | Twilio/MailerSend |
| `/create-telehealth-room` | POST | Create video room | Bearer | Daily.co |
| `/create-patient-telehealth-token` | POST | Generate room token | None | Daily.co |
| `/check-drug-interactions` | POST | Drug interaction check | Bearer | Anthropic Claude |
| `/extract-patient-form` | POST | Extract form data | Bearer | Anthropic Claude |
| `/process-medical-transcript` | POST | Process transcript | Bearer | Deepgram, Claude |
| `/realtime_medical_transcription` | WS | Real-time transcription | Bearer | Deepgram |
| `/claude-chat` | POST | Claude chat | Bearer | Anthropic Claude |
| `/claude-personalization` | POST | Personalized content | Bearer | Anthropic Claude |
| `/coding-suggest` | GET | Medical code suggestions | Bearer | Anthropic Claude |
| `/sdoh-coding-suggest` | GET | SDOH code suggestions | Bearer | Anthropic Claude |
| `/update-profile-note` | POST | Update profile note | Bearer | None |
| `/save-fcm-token` | POST | Save FCM token | Bearer | None |
| `/user-data-management` | POST | Data export/delete | Bearer | None |
| `/get-risk-assessments` | GET | Get risk assessments | Bearer | None |
| `/guardian-agent` | POST | Guardian agent actions | Bearer | Anthropic Claude |
| `/guardian-agent-api` | POST | Guardian agent API | Bearer | None |
| `/guardian-pr-service` | POST | Guardian PR service | Bearer | None |
| `/enrollClient` | POST | Enroll in program | Bearer | None |
| `/generate-api-key` | POST | Generate API key | Admin | None |
| `/validate-api-key` | POST | Validate API key | API Key | None |
| `/mobile-sync` | POST | Mobile sync | Bearer | None |
| `/generate-837p` | POST | Generate claim file | Billing Role | None |
| `/enhanced-fhir-export` | POST | FHIR export | Bearer | None |
| `/nightly-excel-backup` | POST | Backup to Excel | Internal | Cloud Storage |
| `/daily-backup-verification` | POST | Verify backup | Internal | None |
| `/test-users` | GET | Get test users | Admin | None |
| `/test_users` | POST | Create test users | Admin | None |
| `/mcp-claude-server` | POST | MCP server | Bearer | None |

---

## External Service Integrations

### Anthropic Claude API
```
Endpoint: https://api.anthropic.com/v1/messages
Auth: x-api-key header
Models: claude-3-5-sonnet-20241022, claude-3-opus-20250219
Rate Limit: 30 req/min per user
Costs: Input $0.003/1M, Output $0.015/1M
```

### Twilio
```
Messaging: https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
Verify: https://verify.twilio.com/v2/Services/{SID}/
Auth: Basic Auth (AccountSID:AuthToken)
Limits: Message ≤1600 chars, Code 4-8 digits
Services: SMS, Voice, Verify
```

### MailerSend
```
Endpoint: https://api.mailersend.com/v1/email
Auth: Bearer token
Features: Email sending, attachments, templates
Rate Limit: Based on plan
```

### Daily.co
```
Endpoint: https://api.daily.co/v1/
Auth: API key header
Services: Video rooms, tokens, recordings
Compliance: HIPAA-compliant storage
```

### Deepgram
```
Endpoint: https://api.deepgram.com/v1/
WebSocket: wss://live.deepgram.com/v1/listen
Auth: API key header
Models: medical (enhanced vocabulary)
Features: Real-time, punctuation, diarization
```

### hCaptcha
```
Service: https://hcaptcha.com/siteverify
Auth: secret key (server-side)
Use: Form protection (registration, login)
```

### Supabase
```
Auth: {SUPABASE_URL}/auth/v1/token
Database: PostgREST API
Realtime: WebSocket subscriptions
Storage: File storage API
```

---

## Authentication Methods

### 1. Supabase JWT (Bearer Token)
```
Header: Authorization: Bearer {jwt_token}
Expiry: 1 hour (configurable)
Refresh: Via refresh_token cookie
```

### 2. Internal API Key
```
Header: X-Internal-API-Key: {key}
OR: Authorization: Bearer {key}
Scope: Service-to-service only
```

### 3. Supabase Anon Key
```
Header: apikey: {anon_key}
Scope: Public operations
Rate Limited: Per IP
```

### 4. Service Role Key
```
Server-side only (never expose)
Scope: Admin operations
Bypass: RLS policies
```

---

## Rate Limiting

### Supabase Edge Functions
- **AUTH**: 5 req/5min (IP-based)
- **API**: 60 req/1min
- **READ**: 100 req/1min
- **EXPENSIVE**: 10 req/10min
- **AI**: 30 req/1min

### Vercel Endpoints
- **Default**: 60 req/1min
- **Login**: 5 attempts/15min
- **Admin PIN**: 3 attempts/5min
- **SMS Verify**: 5 attempts/5min

---

## CORS Configuration

### Allowed Origins
- `https://wellfitcommunity.live`
- `https://www.wellfitcommunity.live`
- `https://thewellfitcommunity.org`
- `https://www.thewellfitcommunity.org`
- `https://*.vercel.app`
- `http://localhost:3100` (dev only)
- `https://[codespace].app.github.dev` (dev only)

### CORS Headers
```
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: authorization, apikey, content-type, x-client-info
Access-Control-Max-Age: 86400
Access-Control-Allow-Credentials: true
```

---

## Security Headers

### Content-Security-Policy
- Default: `'self'`
- Scripts: hCaptcha, Google
- Styles: Google Fonts
- Images: Supabase, hCaptcha, Unsplash
- Connect: All external services

### HTTP Security Headers
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## Response Codes & Error Handling

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Successful GET/POST |
| 201 | Created | Resource created |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation error |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate resource |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal error |

### Error Response Format
```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "details": { },
  "retryAfter": 45  // For 429
}
```

---

## Data Formats

### Phone Number (E.164)
- Format: `+{country}{number}`
- Example: `+12125551234`
- Validation: `^\+\d{10,15}$`

### User ID
- Type: UUID v4
- Example: `550e8400-e29b-41d4-a716-446655440000`

### Timestamps
- Format: ISO 8601
- Example: `2024-01-15T10:30:00Z`
- Timezone: Always UTC

### JWT Token
- Format: `header.payload.signature` (base64)
- Signature: HMAC-verified
- Expiry: In payload claims

---

## Common Request/Response Examples

### POST /api/email/send
```json
// Request
{
  "to": [{ "email": "user@example.com", "name": "User" }],
  "subject": "Subject",
  "html": "<p>Content</p>"
}

// Response (200)
{
  "ok": true,
  "id": "message_id"
}

// Response (401)
{
  "error": "Authentication required",
  "message": "Provide valid user session or X-Internal-API-Key header"
}
```

### POST /register
```json
// Request
{
  "phone": "+12125551234",
  "password": "password123",
  "confirm_password": "password123",
  "first_name": "John",
  "last_name": "Doe",
  "hcaptcha_token": "token"
}

// Response (201)
{
  "success": true,
  "message": "Verification code sent!",
  "pending": true,
  "phone": "+12125551234",
  "sms_sent": true
}
```

### POST /verify-sms-code
```json
// Request
{
  "phone": "+12125551234",
  "code": "123456"
}

// Response (200)
{
  "success": true,
  "message": "Registration complete",
  "user": { "id": "uuid" },
  "session": {
    "access_token": "jwt",
    "refresh_token": "token"
  }
}
```

### POST /claude-chat
```json
// Request
{
  "messages": [
    { "role": "user", "content": "What are drug interactions?" }
  ],
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 4000,
  "system": "You are a medical assistant"
}

// Response (200)
{
  "content": [
    { "type": "text", "text": "Drug interactions..." }
  ],
  "usage": {
    "input_tokens": 150,
    "output_tokens": 500
  },
  "request_id": "uuid"
}
```

---

## Environment Variables Reference

### Required (All Environments)
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
ANTHROPIC_API_KEY=sk-ant-xxx
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_MESSAGING_SERVICE_SID=MGxxx
TWILIO_VERIFY_SERVICE_SID=VAxxx
MAILERSEND_API_KEY=mlsn.xxx
MAILERSEND_FROM_EMAIL=noreply@example.com
HCAPTCHA_SECRET=xxx
INTERNAL_API_KEY=xxx
```

### Optional
```
TWILIO_FROM_NUMBER=+12125551234 (if not using service SID)
MAILERSEND_FROM_NAME=WellFit
MAILERSEND_REPLY_TO=reply@example.com
DAILY_API_KEY=xxx
DEEPGRAM_API_KEY=xxx
DEV_ALLOW_LOCAL=false
ALLOWED_ORIGINS=https://example.com,https://example.org
CORS_ORIGINS=https://example.com,https://example.org
```

---

## Webhook & Event Integration Points

### Twilio Webhooks
- SMS delivery status: `POST /webhooks/twilio/sms-status`
- Voice status: `POST /webhooks/twilio/voice-status`

### Daily.co Webhooks
- Room events: `POST /webhooks/daily/room-events`

### Database Triggers
- Check-in alerts → `/send-team-alert`
- Risk assessment → `/guardian-agent`
- Appointment reminder → `/send-appointment-reminder`

---

## Compliance & Audit Logging

### HIPAA Audit Events
- `USER_REGISTER`: User registration
- `LOGIN`: User login
- `ACCESS_PHI`: Access protected health info
- `EXPORT_DATA`: Data export
- `DELETE_RECORD`: Record deletion

### Audit Log Table
```
audit_logs (
  event_type,
  event_category,
  actor_user_id,
  actor_ip_address,
  actor_user_agent,
  operation (CREATE|READ|UPDATE|DELETE),
  resource_type,
  resource_id,
  success,
  error_code,
  error_message,
  metadata (JSON),
  created_at,
  retention_days (2555 = 7 years)
)
```

---

## Performance Considerations

### Request Timeouts
- Vercel Edge: 25 seconds
- Vercel Node: 60 seconds
- Supabase Functions: 540 seconds (9 minutes)

### Database Limits
- Max connection pool: 100
- Max query time: 30 seconds (with RLS)
- Max payload: 100 MB

### API Key Limits
- Max keys per user: 10
- Max scopes per key: 10
- Expiry: Configurable (24h to 365d)

---

## Debugging Tips

### Enable Debug Logging
```typescript
// In service files
console.log('[API]', endpoint, method, payload);
console.error('[ERROR]', error.message, error.stack);
```

### Check Rate Limits
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705330200
```

### Validate JWT Token
```bash
# Decode JWT (no validation)
echo $TOKEN | cut -d'.' -f2 | base64 -d | jq .

# Check expiry
jq '.exp * 1000 | todate' <<< $(echo $TOKEN | cut -d'.' -f2 | base64 -d)
```

### Monitor External Services
- Anthropic: https://status.anthropic.com
- Twilio: https://status.twilio.com
- MailerSend: https://status.mailersend.com
- Supabase: https://status.supabase.com
- Daily.co: https://status.daily.co
- Deepgram: https://status.deepgram.com

---

## Testing Endpoints

### Register Flow
```bash
# 1. Register
curl -X POST http://localhost:3100/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+12125551234",
    "email": "test@example.com",
    "password": "password123",
    "confirm_password": "password123",
    "first_name": "Test",
    "last_name": "User",
    "hcaptcha_token": "test_token",
    "role_code": 4
  }'

# 2. Verify SMS Code (use code sent to phone)
curl -X POST http://localhost:3100/verify-sms-code \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+12125551234",
    "code": "123456"
  }'
```

### Auth Flow
```bash
# 1. Get token
TOKEN=$(curl -X POST http://localhost:3100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "+12125551234", "password": "password123"}' \
  | jq -r '.user.id')

# 2. Use token
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3100/api/me/profile
```

### Claude Chat
```bash
curl -X POST http://localhost:3100/api/anthropic-chats \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3100" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello"}
    ],
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 100
  }'
```

---

## Integration Checklist

- [ ] All environment variables configured
- [ ] CORS origins whitelisted
- [ ] Rate limiting thresholds verified
- [ ] HIPAA audit logging enabled
- [ ] JWT token expiry set appropriately
- [ ] Error handling implemented
- [ ] Webhook endpoints configured
- [ ] External service credentials rotated
- [ ] SSL/TLS certificates valid
- [ ] Database backups scheduled
- [ ] Monitoring alerts configured
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated

---
