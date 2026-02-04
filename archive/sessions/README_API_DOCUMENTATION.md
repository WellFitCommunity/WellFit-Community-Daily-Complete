# API Endpoints & External Integrations - Complete Documentation

**Envision Atlus & WellFit Community**  
*powered by Envision VirtualEdge Group, LLC*

---

## Overview

This directory contains comprehensive documentation for all API endpoints, external service integrations, authentication mechanisms, rate limiting, security configurations, and data flows for the WellFit Community Daily application.

**Total Documentation**: 2,447 lines across 3 files, 64 KB of detailed reference material covering 70 API endpoints and 7 major external service integrations.

---

## Documentation Files

### 1. **API_ENDPOINTS_COMPLETE_DOCUMENTATION.md** (1,537 lines)
**Most Detailed Reference** - Use for deep understanding and implementation details

Contains:
- All 11 Vercel API endpoints with request/response formats
- All 59 Supabase Edge Functions organized by category
- 7 external service integrations (Anthropic, Twilio, MailerSend, Daily.co, Deepgram, hCaptcha, Supabase)
- 4 authentication methods with detailed examples
- Database-based distributed rate limiting strategy
- Comprehensive CORS and CSP configuration
- HIPAA audit logging schema and requirements
- Integration patterns and complete data flows
- Error handling and recovery strategies
- Performance considerations and timeouts
- Webhook endpoints and database triggers

**Best for**: 
- Deep understanding of system architecture
- Implementation and integration work
- Security and compliance review
- Troubleshooting complex issues

---

### 2. **API_QUICK_REFERENCE.md** (576 lines)
**Quick Lookup Tables** - Use for daily development and testing

Contains:
- Endpoint summary tables (Vercel & Supabase)
- External service quick reference matrix
- Authentication method comparison
- Rate limiting thresholds (all categories)
- CORS allowed origins list
- Response codes and error formats
- Data format specifications
- Common request/response examples
- Environment variables checklist
- Webhook integration points
- Testing examples with curl commands
- Debugging tips and troubleshooting
- Integration checklist

**Best for**:
- Quick endpoint lookups during development
- Testing with curl/Postman
- Verifying configurations
- Reference while coding
- Testing procedures

---

### 3. **API_DOCUMENTATION_INDEX.md** (334 lines)
**Navigation & Workflows** - Use to find information and understand common flows

Contains:
- Quick navigation by category (Authentication, Communication, Healthcare, AI, etc.)
- External service integration matrix with links
- Authentication reference summary
- Rate limiting summary
- Environment variables checklist
- Common workflows (User Registration, Telehealth, Medical Coding, Data Export)
- Security considerations checklist
- Service health monitoring dashboards
- Troubleshooting guide for common issues
- Status and version history

**Best for**:
- Finding specific endpoints by category
- Understanding user registration flow
- Common workflow reference
- Security checklist
- Troubleshooting common errors
- Service health monitoring

---

## Quick Start

### For New Developers
1. Read: **API_DOCUMENTATION_INDEX.md** (overview)
2. Reference: **API_QUICK_REFERENCE.md** (while coding)
3. Deep dive: **API_ENDPOINTS_COMPLETE_DOCUMENTATION.md** (when needed)

### For API Testing
1. Find endpoint in **API_QUICK_REFERENCE.md** table
2. Get curl example from "Testing Endpoints" section
3. Check "Common Request/Response Examples"
4. Review rate limits and authentication

### For Integration Work
1. Check external service in **API_ENDPOINTS_COMPLETE_DOCUMENTATION.md** section 3
2. Find relevant endpoints in tables
3. Review authentication method
4. Check data formats and error handling
5. Test with **API_QUICK_REFERENCE.md** examples

### For Troubleshooting
1. Check **API_DOCUMENTATION_INDEX.md** troubleshooting section
2. Verify credentials and rate limits in **API_QUICK_REFERENCE.md**
3. Review error handling in **API_ENDPOINTS_COMPLETE_DOCUMENTATION.md**
4. Check service status dashboards (links provided)

---

## Key Statistics

### Endpoints
- **Vercel API**: 11 endpoints
- **Supabase Functions**: 59 functions
- **Total**: 70 API endpoints

### External Services
- Anthropic Claude API
- Twilio (SMS, Verify)
- MailerSend (Email)
- Daily.co (Video)
- Deepgram (Transcription)
- hCaptcha (Bot Prevention)
- Supabase (Database, Auth, Functions)

### Security
- 10 role-based access levels
- Database-level RLS enforcement
- IP + user-based rate limiting
- 7-year HIPAA audit retention
- Comprehensive CSP policy
- HSTS with preload

### Documentation Coverage
- 100% of endpoints documented
- All integrations documented
- Complete data flows included
- Testing examples provided
- Troubleshooting guide included

---

## Quick Reference Tables

### Vercel Endpoints
| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/auth/login` | POST | User login | None |
| `/api/email/send` | POST | Send email | Bearer/API Key |
| `/api/sms/send` | POST | Send SMS | Bearer/API Key |
| `/api/registerPushToken` | POST | FCM registration | Bearer |
| `/api/me/profile` | GET | Get profile | Bearer |
| `/api/admin/grant-role` | POST | Grant admin role | Super Admin |
| `/api/anthropic-chats` | POST | Claude proxy | CORS |

### Supabase Top Endpoints
| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/register` | POST | User registration | None |
| `/verify-sms-code` | POST | Verify SMS code | None |
| `/login` | POST | User login | None |
| `/send-email` | POST | Send email | Bearer |
| `/create-telehealth-room` | POST | Create video room | Bearer |
| `/claude-chat` | POST | Claude integration | Bearer |
| `/check-drug-interactions` | POST | Drug checking | Bearer |

### External Services
| Service | Endpoint | Auth | Rate Limit |
|---------|----------|------|-----------|
| Claude | https://api.anthropic.com/v1/messages | x-api-key | 30 req/min |
| Twilio | https://api.twilio.com/2010-04-01 | Basic Auth | Service |
| MailerSend | https://api.mailersend.com/v1/email | Bearer | Plan-based |
| Daily.co | https://api.daily.co/v1/ | API Key | Service |
| Deepgram | https://api.deepgram.com/v1/ | API Key | Service |
| hCaptcha | https://hcaptcha.com/siteverify | Secret | Service |

---

## Authentication Quick Reference

### Bearer Token (Supabase JWT)
```
Authorization: Bearer {jwt_token}
Expiry: 1 hour
Refresh: Via refresh_token cookie
```

### Internal API Key
```
X-Internal-API-Key: {key}
OR
Authorization: Bearer {key}
Scope: Service-to-service
```

### Anon Key (Public Operations)
```
apikey: {anon_key}
Rate Limited: Per IP
```

---

## Rate Limits Summary

### Strictest (Most Protected)
- Admin PIN: 3 attempts / 5 minutes
- SMS Verify: 5 attempts / 5 minutes
- Login: 5 attempts / 15 minutes

### Standard
- API calls: 60 requests / 1 minute
- Read operations: 100 requests / 1 minute

### Generous
- AI requests: 30 requests / 1 minute
- Expensive ops: 10 requests / 10 minutes

---

## Common Workflows

### User Registration
1. Client: POST `/register` with hCaptcha token
2. Server: Verify hCaptcha
3. Server: Send SMS code via Twilio
4. Client: POST `/verify-sms-code`
5. Server: Create user, send welcome email

### Telehealth Appointment
1. POST `/create-telehealth-room` → Daily.co
2. Send notification (Twilio + MailerSend)
3. Patient joins via video room
4. Recording available post-call

### Medical Coding
1. GET `/coding-suggest?description=...`
2. Claude API returns suggestions
3. Cost logged to audit
4. Return results to client

---

## Environment Variables

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
DAILY_API_KEY
DEEPGRAM_API_KEY
TWILIO_FROM_NUMBER
MAILERSEND_FROM_NAME
DEV_ALLOW_LOCAL
ALLOWED_ORIGINS
```

---

## Error Codes & Recovery

### 401 Unauthorized
- Check Bearer token validity and expiry
- Verify token format
- Check role permissions

### 429 Too Many Requests
- Check `X-RateLimit-Remaining` header
- Wait `Retry-After` seconds
- Implement exponential backoff

### 500 Server Error
- Check external service status dashboards
- Review application logs
- Verify environment variables

### CORS Error
- Check origin in ALLOWED_ORIGINS
- Verify CSP policy
- Enable DEV_ALLOW_LOCAL for development

---

## Testing Endpoints

### Using curl

**User Registration**
```bash
curl -X POST http://localhost:3100/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+12125551234",
    "password": "password123",
    "confirm_password": "password123",
    "first_name": "John",
    "last_name": "Doe",
    "hcaptcha_token": "token"
  }'
```

**User Login**
```bash
curl -X POST http://localhost:3100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "+12125551234", "password": "password123"}'
```

**Claude Chat**
```bash
curl -X POST http://localhost:3100/api/anthropic-chats \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3100" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 100
  }'
```

---

## Service Health & Status

- **Anthropic**: https://status.anthropic.com
- **Twilio**: https://status.twilio.com
- **MailerSend**: https://status.mailersend.com
- **Supabase**: https://status.supabase.com
- **Daily.co**: https://status.daily.co
- **Deepgram**: https://status.deepgram.com

---

## Security Considerations

### HIPAA Compliance
- All PHI access logged to `audit_logs` table
- 7-year retention (2555 days)
- Encrypt sensitive data at rest

### Rate Limiting
- IP-based for unauthenticated endpoints
- User-based for authenticated endpoints
- Database-backed for distributed enforcement

### CORS Protection
- Strict allowlist (no wildcards in production)
- GitHub Codespaces dynamic URLs supported
- CSP policy for all resources

### API Key Management
- Stored hashed in database
- Scoped by resource and operation
- Configurable expiry (24h - 365d)

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

## Additional Resources

### API Standards
- OAuth 2.0: https://tools.ietf.org/html/rfc6749
- JWT: https://jwt.io/
- FHIR: https://www.hl7.org/fhir/
- X12: https://x12.org/

### Learning Resources
- Supabase Docs: https://supabase.com/docs
- Anthropic API: https://docs.anthropic.com
- Twilio Docs: https://www.twilio.com/docs
- Daily.co Docs: https://docs.daily.co
- Deepgram Docs: https://developers.deepgram.com

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-11-04 | Initial comprehensive API documentation |

---

## Support & Contact

For API integration questions or issues:

1. **Quick answers**: Check **API_QUICK_REFERENCE.md** tables
2. **Detailed info**: Review **API_ENDPOINTS_COMPLETE_DOCUMENTATION.md**
3. **Navigation help**: Use **API_DOCUMENTATION_INDEX.md**
4. **Troubleshooting**: Check troubleshooting section and service status
5. **Escalation**: Contact development team with error codes/logs

---

**Last Updated**: November 4, 2024  
**Documentation Quality**: 100% endpoint coverage  
**Maintenance**: Regular updates as API changes

