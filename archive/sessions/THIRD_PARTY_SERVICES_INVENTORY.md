# WellFit Community - Comprehensive Third-Party Service Inventory

## Executive Summary
WellFit Community Daily Complete integrates 11+ external service providers across AI, cloud infrastructure, communications, healthcare, video conferencing, and security domains. Total estimated monthly cost ranges from $2,000-$5,000 based on production usage patterns.

---

## 1. NPM PRODUCTION DEPENDENCIES (44 total)

### AI & ML Services
- `@anthropic-ai/sdk` (v0.64.0) - Anthropic Claude API client
- `@modelcontextprotocol/sdk` (v1.20.1) - MCP client for Claude integration

### Cloud & Database
- `@supabase/supabase-js` (v2.58.0) - Supabase client (PostgreSQL, Auth, Edge Functions)
- `firebase` (v11.7.3) - Firebase Realtime Database, Cloud Storage, Analytics

### Video Conferencing
- `@daily-co/daily-js` (v0.85.0) - Daily.co video SDK
- `@daily-co/daily-react` (v0.23.2) - React wrapper for Daily.co

### Communication
- `twilio` (v5.7.0) - Twilio SMS/messaging
- `nodemailer` (v7.0.3) - Email client (used with MailerSend SMTP)

### Security
- `@hcaptcha/react-hcaptcha` (v1.12.1) - hCaptcha security widget
- `bcryptjs` (v3.0.2) - Password hashing

### Form Validation
- `react-hook-form` (v7.63.0) - Form state management
- `@hookform/resolvers` (v3.10.0) - Validation resolvers
- `yup` (v1.7.1) - Schema validation
- `zod` (v3.25.76) - TypeScript schema validation
- `ajv` (v8.17.1), `ajv-formats` (v3.0.1), `ajv-keywords` (v5.1.0) - JSON schema validator

### UI/UX
- `react` (v18.3.1) - React framework
- `react-dom` (v18.3.1) - React DOM renderer
- `react-router-dom` (v6.30.1) - Client-side routing
- `framer-motion` (v12.23.22) - Animation library
- `lucide-react` (v0.544.0) - Icon library
- `react-toastify` (v11.0.5) - Toast notifications
- `react-confetti` (v6.4.0) - Celebration confetti effect
- `emoji-picker-react` (v4.13.2) - Emoji picker widget
- `react-signature-canvas` (v1.1.0-alpha.2) - Digital signature capture
- `clsx` (v2.1.1) - Conditional className utility
- `tailwind-merge` (v3.3.1) - Tailwind CSS merging

### State Management & Utilities
- `jotai` (v2.15.0) - Primitive state management
- `react-use` (v17.6.0) - React hooks library
- `idb` (v8.0.3) - IndexedDB wrapper

### Data Processing
- `exceljs` (v4.4.0) - Excel file generation
- `dompurify` (v3.3.0) - HTML sanitization
- `libphonenumber-js` (v1.12.9) - Phone number parsing
- `dotenv` (v16.6.1) - Environment variable loading

---

## 2. NPM DEVELOPMENT DEPENDENCIES (Key ones)

### Build & Bundling
- `react-scripts` (v5.0.1) - CRA build tool
- `webpack` (v5.101.3) - Module bundler
- `webpack-dev-server` (v4.15.2) - Dev server
- `postcss` (v8.4.31) - CSS processing
- `tailwindcss` (v3.4.10) - CSS framework

### Testing
- `@testing-library/react` (v16.3.0) - React component testing
- `@testing-library/dom` (v10.4.1) - DOM testing utilities
- `jest-environment-jsdom` (v30.2.0) - Jest DOM environment

### Type Checking & Linting
- `typescript` (v4.9.5) - TypeScript compiler
- `@typescript-eslint/eslint-plugin` (v5.62.0) - TS linting rules
- `eslint` (v8.57.1) - JavaScript linter

### Database
- `supabase` (v2.34.3) - Supabase CLI

### Serverless
- `@vercel/node` (v2.3.0) - Vercel Node.js runtime

---

## 3. EXTERNAL SERVICE PROVIDERS - DETAILED BREAKDOWN

### 3.1 ANTHROPIC CLAUDE (AI/ML) - PRIMARY STRATEGIC DEPENDENCY
**Status**: Core production service  
**Configuration**: Environment variables  
- `REACT_APP_ANTHROPIC_API_KEY`: sk-ant-* format
- `REACT_APP_CLAUDE_DEFAULT_MODEL`: claude-3-5-sonnet-20241022
- `REACT_APP_CLAUDE_ADMIN_MODEL`: claude-3-5-sonnet-20241022
- `REACT_APP_CLAUDE_MAX_TOKENS`: 4000
- `REACT_APP_CLAUDE_TIMEOUT`: 30000ms

**Models Used**:
1. **Claude Haiku 4.5** (claude-haiku-4-5-20251001)
   - Use Case: Fast UI/personalization, patient health questions
   - Pricing: $0.0001 input / $0.0005 output per 1K tokens
   - Estimated monthly cost: $50-200

2. **Claude Sonnet 4.5** (claude-sonnet-4-5-20250929)
   - Use Case: Revenue-critical accuracy, billing codes, clinical analysis
   - Pricing: $0.003 input / $0.015 output per 1K tokens
   - Estimated monthly cost: $500-1,200

3. **Claude Opus 4.1** (claude-opus-4-1)
   - Use Case: Complex reasoning (reserved for specialized cases)
   - Pricing: $0.015 input / $0.075 output per 1K tokens
   - Status: Available but not actively used in current config

**Integration Points**:
- `src/services/claudeService.ts` - Main client-side entry point
- `src/services/claudeEdgeService.ts` - Secure server-side wrapper
- `supabase/functions/claude-chat/index.ts` - Edge Function implementation
- `supabase/functions/realtime_medical_transcription/index.ts` - Real-time scribe analysis
- `supabase/functions/process-medical-transcript/index.ts` - Async transcript processing
- `supabase/functions/coding-suggest/index.ts` - Medical code suggestions
- `supabase/functions/guardian-agent/index.ts` - Autonomous agent system

**Cost Management**:
- Daily budget: $50
- Monthly budget: $500
- Rate limiting: 60 requests/minute per user
- Cost estimation before each request
- Automatic budget overrun prevention
- Circuit breaker pattern for resilience

**Features**:
- Multi-turn conversation support
- Role-based model selection
- HIPAA compliance with audit logging
- Real-time cost tracking
- Request ID correlation for troubleshooting

---

### 3.2 DEEPGRAM (SPEECH-TO-TEXT/AI TRANSCRIPTION) - MEDICAL SCRIBE
**Status**: Production - real-time medical transcription  
**Configuration**: Environment variables
- `DEEPGRAM_API_KEY`: your-deepgram-api-key
- `DEEPGRAM_PROJECT_NAME`: WellFitCommunity
- `DEEPGRAM_PROJECT_ID`: 953cf201-5dd7-4e5b-a8d0-8b11ad4f8256

**Features**:
- Model: nova-2-medical (specialized medical vocabulary)
- Real-time WebSocket streaming
- 16kHz audio sample rate
- Integrated with Claude Sonnet 4.5 for immediate coding analysis
- Every 10-second analysis interval

**Integration Points**:
- `supabase/functions/realtime_medical_transcription/index.ts`
- `src/components/telehealth/MedicalScribe.tsx`
- Real-time WebSocket relay architecture

**Pricing Estimate**: $200-400/month (based on transcription volume)

---

### 3.3 SUPABASE (BACKEND/DATABASE/AUTH) - CORE INFRASTRUCTURE
**Status**: Production - critical infrastructure  
**Configuration**: 
- `REACT_APP_SUPABASE_URL`: https://xkybsjnvuohpqpbkikyn.supabase.co
- `REACT_APP_SUPABASE_ANON_KEY`: JWT token
- `SUPABASE_SERVICE_ROLE_KEY`: Service role authentication
- Database: PostgreSQL with full HIPAA compliance

**Components Used**:
1. **Authentication**
   - Supabase Auth with email/phone/passkey support
   - Magic link authentication
   - Session management
   - Role-based access control (RBAC)

2. **Database** (PostgreSQL)
   - Patient data, encounters, observations
   - FHIR resource storage
   - Audit logs and compliance tracking
   - Multi-tenant architecture

3. **Edge Functions** (60+ functions)
   - Serverless compute for secure operations
   - Used for: SMS, email, authentication, Claude integration, FHIR sync

4. **Real-time Subscriptions**
   - Broadcast for multi-user coordination
   - Presence tracking
   - WebSocket relay for Deepgram/Daily

5. **Storage**
   - Document/image uploads
   - Patient records
   - Encrypted file storage

**Pricing Tier**: Pro plan (~$25/month base) + usage
- Database operations: ~$0.005 per million reads/writes
- Edge Functions: $0.50 per million invocations
- Estimated monthly cost: $100-300

**Integration Points**:
- `src/lib/supabaseClient.ts` - Client initialization
- All service files use Supabase
- `supabase/functions/*` - 60+ Edge Functions
- Database migrations in `supabase/migrations/`

---

### 3.4 FIREBASE (ANALYTICS, MESSAGING, STORAGE) - CROSS-PLATFORM
**Status**: Production - notifications and analytics  
**Configuration**:
- `REACT_APP_FIREBASE_API_KEY`: your-firebase-api-key
- `REACT_APP_FIREBASE_AUTH_DOMAIN`: wellfit-community.firebaseapp.com
- `REACT_APP_PROJECT_ID`: wellfit-community
- `REACT_APP_STORAGE_BUCKET`: wellfit-community.firebasestorage.app
- `REACT_APP_MESSAGING_SENDER_ID`: 669875280900
- `REACT_APP_FIREBASE_APP_ID`: 1:669875280900:web:8269859e1afc3fa4a96951
- `REACT_APP_FIREBASE_MEASUREMENT_ID`: G-0CR22423HQ
- `REACT_APP_FIREBASE_VAPID_KEY`: BGpQZaI_BbEm39uj6vWhmKrnPBf8YoYVXM6VRYVuRbV8KJ4Kq5g6YbI4Z8u5RhOdKq4EmRZClOVO5qaBhUnRpBM

**Features Used**:
1. **Firebase Cloud Messaging (FCM)**
   - Push notifications for reminders
   - Service worker registration
   - Token management (`save-fcm-token` function)

2. **Google Analytics**
   - Usage tracking
   - User engagement metrics
   - Custom events

3. **Cloud Storage**
   - Patient document backup
   - File uploads/downloads

**Pricing**: Free tier adequate for current usage
- Estimated monthly cost: $0-50

**Integration Points**:
- `src/firebase.ts` - Main initialization
- `src/lib/firebaseClient.ts` - Client setup
- `src/utils/requestNotificationPermission.ts` - Permission handling
- `src/settings/firebase.ts` - Configuration
- Service worker: `/firebase-messaging-sw.js`

---

### 3.5 DAILY.CO (VIDEO/TELEHEALTH) - HIPAA-COMPLIANT VIDEO
**Status**: Production - real-time video consultations  
**Configuration**:
- `DAILY_API_KEY`: your-daily-co-api-key
- API URL: https://api.daily.co/v1

**Features**:
- HIPAA-compliant video rooms
- Recording capability
- Encounter tracking integration
- Room creation API
- Token-based access control

**Integration Points**:
- `src/components/telehealth/TelehealthConsultation.tsx`
- `src/components/telehealth/PatientWaitingRoom.tsx`
- `supabase/functions/create-telehealth-room/index.ts` - Room creation
- `supabase/functions/create-patient-telehealth-token/index.ts` - Token generation

**Pricing**: ~$0.75-2.00 per participant-hour
- Estimated monthly cost: $300-800 (based on consultation volume)

---

### 3.6 TWILIO (SMS COMMUNICATION) - PATIENT ENGAGEMENT
**Status**: Production - SMS notifications and verification
**Configuration**:
- `TWILIO_ACCOUNT_SID`: AC********************************
- `TWILIO_AUTH_TOKEN`: ********************************
- `TWILIO_PHONE_NUMBER`: +1**********
- `TWILIO_VERIFY_SERVICE_SID`: VA********************************

**Use Cases**:
- SMS verification codes for registration/login
- Patient check-in reminders
- Discharge notifications
- Alert distribution to caregivers
- Two-factor authentication

**Integration Points**:
- `supabase/functions/send-sms/index.ts` - SMS sending
- `supabase/functions/sms-send-code/index.ts` - Verification code
- `supabase/functions/verify-sms-code/index.ts` - Code verification
- `src/services/handoffNotificationService.ts` - Handoff alerts
- `src/services/patientOutreachService.ts` - Outreach campaigns

**Pricing**: ~$0.0075 per SMS (US rates)
- Estimated monthly cost: $200-400

---

### 3.7 MAILERSEND (EMAIL DELIVERY) - TRANSACTIONAL EMAIL
**Status**: Production - welcome emails, password resets, notifications  
**Configuration**:
- `MAILERSEND_API_KEY`: your-mailersend-api-key
- `MAILERSEND_SMTP_HOST`: smtp.mailersend.net
- `MAILERSEND_SMTP_PORT`: 587
- `MAILERSEND_DOMAIN`: thewellfitcommunity.org
- `MAILERSEND_FROM_EMAIL`: info@thewellfitcommunity.org
- `MAILERSEND_FROM_NAME`: WellFit Community

**Features**:
- Email template system
- SMTP integration with nodemailer
- Welcome template ID: v69oxl5w0zzl785k
- Variable substitution for personalization

**Integration Points**:
- `supabase/functions/send_welcome_email/index.ts` - Welcome emails
- `supabase/functions/send_email/index.ts` - General email
- `supabase/functions/send-appointment-reminder/index.ts` - Reminders
- Nodemailer client in backend services

**Pricing**: Free tier covers standard usage
- Estimated monthly cost: $0-25

---

### 3.8 HCAPTCHA (SECURITY - BOT PROTECTION)
**Status**: Production - registration and login protection
**Configuration**:
- `REACT_APP_HCAPTCHA_SITE_KEY`: your-hcaptcha-site-key
- `HCAPTCHA_SECRET_KEY`: your-hcaptcha-secret-key
- `REACT_APP_REQUIRE_HCAPTCHA_LOGIN`: true

**Components**:
- `src/components/HCaptchaWidget.tsx` - hCaptcha widget
- `supabase/functions/verify-hcaptcha/index.ts` - Server verification

**Integration Points**:
- Registration flow
- Login form
- Admin panel access
- Sensitive form submissions

**Pricing**: Free tier (unlimited)
- Estimated monthly cost: $0

---

### 3.9 EPIC EHR (HEALTHCARE INTEGRATION) - FHIR
**Status**: Configured but organization-dependent  
**Configuration**:
- `REACT_APP_EPIC_FHIR_URL`: https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
- `REACT_APP_EPIC_CLIENT_ID`: your_epic_client_id (template)

**Integration Points**:
- `src/services/fhirInteroperabilityIntegrator.ts`
- `src/lib/smartOnFhir.ts` - SMART on FHIR OAuth
- FHIR sync configuration

**Features**:
- Bi-directional FHIR synchronization
- Real-time patient data exchange
- Care team coordination
- Encounter data sync

**Pricing**: Organization-dependent (typically included in EHR licensing)
- Estimated monthly cost: $0 (license-included)

---

### 3.10 CERNER EHR (HEALTHCARE INTEGRATION) - FHIR
**Status**: Configured but organization-dependent  
**Configuration**:
- `REACT_APP_CERNER_FHIR_URL`: https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d
- `REACT_APP_CERNER_CLIENT_ID`: your_cerner_client_id (template)

**Integration Points**: Same as Epic - standardized FHIR approach

**Pricing**: Organization-dependent
- Estimated monthly cost: $0 (license-included)

---

### 3.11 WEATHER API (ENVIRONMENTAL DATA) - OPTIONAL FEATURE
**Status**: Production but optional  
**Configuration**:
- `REACT_APP_WEATHER_API_KEY`: your-openweather-api-key
- Provider: WeatherAPI.com

**Use Case**: Weather Widget in senior dashboard
- Component: `src/components/dashboard/WeatherWidget.tsx`
- Endpoint: `https://api.weatherapi.com/v1/current.json`
- Display: Current temperature, conditions

**Pricing**: Free tier (1M calls/month) sufficient
- Estimated monthly cost: $0

---

## 4. MONITORING & ANALYTICS

### Built-in Services
- `src/services/performanceMonitoring.ts` - Custom performance tracking
- `src/services/auditLogger.ts` - HIPAA audit logging
- `supabase/functions/_shared/auditLogger.ts` - Edge Function logging
- Firebase Google Analytics integration

### Cost Tracking
- `CLAUDE_DAILY_BUDGET`: $50/day
- `CLAUDE_MONTHLY_BUDGET`: $500/month
- Budget alerts enabled via `ENABLE_COST_ALERTS`

---

## 5. SECURITY SERVICES

### Authentication Methods
1. Email + Password (Supabase Auth)
2. Phone + SMS verification (Twilio + Supabase)
3. Passkey/WebAuthn (Supabase)
4. Admin PIN-based access

### Encryption & Compliance
- PHI encryption at rest and in transit
- `PHI_ENCRYPTION_KEY`: PHI-ENCRYPT-2025-WELLFIT-SECURE-KEY-V1
- HIPAA compliance tracking
- SOC2 controls
- Audit retention: 2555 days (7 years)

### Rate Limiting
- `API_RATE_LIMIT_REQUESTS`: 60
- `API_RATE_LIMIT_WINDOW`: 60000ms (per minute)

---

## 6. DEPLOYMENT INFRASTRUCTURE

### Hosting
- **Primary**: Vercel (deployment mentioned in README)
- **Functions**: Supabase Edge Functions + Vercel Serverless
- **Database**: Supabase PostgreSQL (hosted on AWS)

### Environment Configuration
- Development: `.env.development`
- Production: `.env.production`
- Supabase local: `supabase/.env.local`

---

## 7. VERSION REQUIREMENTS & COMPATIBILITY

### Node.js
- Engine: 20.x (specified in package.json)
- Recommended: 20.16.11 or higher

### Browser Support
- Production: >0.2% market share, not dead, not op_mini
- Development: Latest Chrome, Firefox, Safari

### Key Package Versions
- React: 18.3.1
- TypeScript: 4.9.5
- Supabase: 2.58.0
- Firebase: 11.7.3
- Anthropic SDK: 0.64.0

---

## 8. COST SUMMARY & ESTIMATION

### Monthly Cost Breakdown (Production)
| Service | Tier | Min | Max | Notes |
|---------|------|-----|-----|-------|
| Anthropic Claude | Pay-as-you-go | $50 | $1,200 | Haiku + Sonnet models |
| Deepgram | Pay-as-you-go | $200 | $400 | Medical transcription |
| Supabase | Pro | $100 | $300 | Database + Edge Functions |
| Firebase | Free | $0 | $50 | Notifications + Analytics |
| Daily.co | Pay-as-you-go | $300 | $800 | Video consultations |
| Twilio SMS | Pay-as-you-go | $200 | $400 | SMS messages (~4,000/month) |
| MailerSend | Free | $0 | $25 | Email delivery |
| hCaptcha | Free | $0 | $0 | Bot protection |
| Epic/Cerner | License-included | $0 | $0 | EHR integration |
| Weather API | Free | $0 | $0 | Optional widget |
| **TOTAL** | | **$850** | **$3,175** | Typical production |

### Scaling Considerations
- Anthropic Claude: Increases with user volume and AI feature usage
- Deepgram: Scales with telehealth consultation hours
- Daily.co: Scales with video minutes
- Twilio: Scales with patient engagement (check-ins, alerts)

---

## 9. CRITICAL CONFIGURATION NOTES

### Secrets Management
**Exposed in .env.local (SECURITY RISK - SHOULD BE SECRETS MANAGER)**:
- ANTHROPIC_API_KEY
- TWILIO_AUTH_TOKEN
- MAILERSEND_API_KEY
- DEEPGRAM_API_KEY
- All service credentials

**Best Practice**: Move all secrets to:
1. Supabase Secrets Manager
2. Vercel Environment Variables (encrypted)
3. AWS Secrets Manager
4. HashiCorp Vault

### Environment Variable Categories
1. **Client-side** (REACT_APP_*): Safe to expose
2. **Server-side** (no prefix): Must be secrets
3. **Edge Function** (Deno.env.get): Supabase secrets

---

## 10. INTEGRATION STATUS & READINESS

| Service | Status | Production Ready | Notes |
|---------|--------|------------------|-------|
| Anthropic Claude | Active | Yes | Dual-model strategy implemented |
| Deepgram | Active | Yes | Real-time transcription deployed |
| Supabase | Active | Yes | Core infrastructure |
| Firebase | Active | Yes | Notifications working |
| Daily.co | Active | Yes | HIPAA-compliant video |
| Twilio | Active | Yes | SMS verification + notifications |
| MailerSend | Active | Yes | Welcome emails functional |
| hCaptcha | Active | Yes | Registration protected |
| Epic/Cerner | Configured | Conditional | Requires org-specific credentials |
| Weather API | Active | Yes | Optional feature |
| MCP SDK | Active | Yes | Guardian Agent system |

---

## 11. OPERATIONAL CONSIDERATIONS

### Health Checks & Monitoring
- Claude API: `claudeService.testConnection()`
- Supabase: Direct client health check
- Firebase: FCM token registration
- Daily.co: Room creation test
- Twilio: SMS send verification

### Incident Response
- Circuit breaker for Claude (automatic fallback)
- Retry mechanisms with exponential backoff
- Audit logging for all failures
- Cost alerts for budget overruns

### Compliance Requirements
- HIPAA audit logging required
- 7-year retention for compliance records
- PHI encryption mandatory
- Data residency in US

---

## 12. RECOMMENDATIONS

1. **Immediate**: Move API keys to secrets manager (Supabase/Vercel)
2. **Short-term**: Implement service health monitoring dashboard
3. **Medium-term**: Add circuit breakers for all external APIs
4. **Long-term**: Implement multi-region failover for Supabase

---

**Last Updated**: 2025-11-04  
**Document Status**: Complete Service Inventory
