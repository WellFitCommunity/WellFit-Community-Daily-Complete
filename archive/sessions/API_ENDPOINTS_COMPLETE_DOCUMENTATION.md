# WellFit Community Daily - Complete API Endpoints & External Integrations Documentation

## Table of Contents
1. [Vercel API Endpoints](#vercel-api-endpoints)
2. [Supabase Edge Functions](#supabase-edge-functions)
3. [External Service Integrations](#external-service-integrations)
4. [Authentication & Authorization](#authentication--authorization)
5. [Rate Limiting & Security](#rate-limiting--security)
6. [CORS & Security Headers](#cors--security-headers)
7. [Data Formats & Schemas](#data-formats--schemas)
8. [Error Handling](#error-handling)

---

## VERCEL API ENDPOINTS

### Base Path: `/api/`

#### 1. **Authentication Endpoints**

##### `POST /api/auth/login`
- **Runtime**: Edge
- **Purpose**: User password authentication
- **Auth Required**: None (public endpoint)
- **Request Body**:
  ```json
  {
    "phone": "+12125551234",  // E.164 format
    "password": "password123"
  }
  // OR
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response**: 
  ```json
  {
    "ok": true,
    "user": { "id": "uuid" }
  }
  ```
- **Security**: 
  - Calls Supabase GoTrue `/auth/v1/token?grant_type=password`
  - Sets HttpOnly refresh token cookie (30 days)
  - CORS protected
- **Rate Limit**: Standard (built into Supabase)

##### `POST /api/auth/logout`
- **Runtime**: Edge
- **Purpose**: User session termination
- **Auth Required**: User session (Bearer token)
- **Security**: Clears refresh token cookies

---

#### 2. **Email Service**

##### `POST /api/email/send`
- **Runtime**: Node
- **Purpose**: Send emails via MailerSend
- **Auth Required**: User session OR `X-Internal-API-Key` header
- **Request Body**:
  ```json
  {
    "to": [{ "email": "user@example.com", "name": "User Name" }],
    "subject": "Email Subject",
    "text": "Plain text content (optional)",
    "html": "<p>HTML content</p>"
  }
  ```
- **Response**:
  ```json
  {
    "ok": true,
    "id": "message_id"
  }
  ```
- **Service**: MailerSend API (https://api.mailersend.com/v1/email)
- **Auth Methods**:
  1. Supabase session (Bearer token)
  2. Internal API key: `X-Internal-API-Key: ${INTERNAL_API_KEY}`
  3. Bearer token: `Authorization: Bearer ${INTERNAL_API_KEY}`
- **Rate Limit**: API_RATE_LIMIT_REQUESTS/API_RATE_LIMIT_WINDOW

---

#### 3. **SMS Service**

##### `POST /api/sms/send`
- **Runtime**: Node
- **Purpose**: Send SMS via Twilio
- **Auth Required**: User session OR `X-Internal-API-Key` header
- **Request Body**:
  ```json
  {
    "to": "+12125551234",
    "body": "SMS message content"
  }
  ```
- **Response**:
  ```json
  {
    "ok": true,
    "sid": "twilio_message_sid"
  }
  ```
- **Service**: Twilio Messaging API (https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json)
- **Auth Methods**: Same as email endpoint
- **Configuration Options**:
  - Use `TWILIO_MESSAGING_SERVICE_SID` (preferred)
  - OR use `TWILIO_FROM_NUMBER` fallback
- **Rate Limit**: API_RATE_LIMIT_REQUESTS/API_RATE_LIMIT_WINDOW

---

#### 4. **Push Token Registration**

##### `POST /api/registerPushToken`
- **Runtime**: Node
- **Purpose**: Register Firebase Cloud Messaging (FCM) token
- **Auth Required**: Bearer token (required)
- **Request Body**:
  ```json
  {
    "fcm_token": "token_string",
    "platform": "web" // or "ios", "android"
  }
  ```
- **Response**:
  ```json
  {
    "ok": true
  }
  ```
- **Database**: Upserts to `push_subscriptions` table
- **Conflict Resolution**: `onConflict: 'user_id,fcm_token'`

---

#### 5. **Admin Role Management**

##### `POST /api/admin/grant-role`
- **Runtime**: Edge
- **Purpose**: Grant admin/super_admin role to user
- **Auth Required**: Caller must be super_admin (RLS enforced)
- **Request Body**:
  ```json
  {
    "target_user_id": "uuid",
    "role": "admin" // or "super_admin"
  }
  ```
- **Response**:
  ```json
  {
    "ok": true,
    "is_admin": true
  }
  ```
- **Database Operations**:
  1. Check caller has super_admin role (via `user_roles` table)
  2. Upsert row in `user_roles` table
  3. Update Supabase Auth user app_metadata.is_admin
- **Rate Limit**: Standard

##### `POST /api/admin/revoke-role`
- **Runtime**: Edge
- **Purpose**: Revoke admin role from user
- **Auth Required**: super_admin
- **Similar flow to grant-role**

---

#### 6. **Admin Functions**

##### `POST /api/functions/verify-admin-pin`
- **Purpose**: Verify admin PIN for restricted operations
- **Request Body**:
  ```json
  {
    "pin": "1234"
  }
  ```
- **Response**:
  ```json
  {
    "valid": true,
    "session_token": "token"
  }
  ```

---

#### 7. **User Profile**

##### `GET /api/me/profile`
- **Purpose**: Get current user profile
- **Auth Required**: Bearer token
- **Response**: User profile object

##### `GET /api/me/check_ins`
- **Purpose**: Get user's check-in history
- **Auth Required**: Bearer token
- **Query Parameters**: 
  - `limit`: Number of results
  - `offset`: Pagination offset

---

#### 8. **Claude Chat Proxy**

##### `POST /api/anthropic-chats`
- **Runtime**: Node
- **Purpose**: Proxy Claude API calls with rate limiting and CORS
- **Auth Required**: None (CORS restricted)
- **Request Body**:
  ```json
  {
    "messages": [
      { "role": "user", "content": "message" }
    ],
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 1024,
    "system": "system prompt (optional)"
  }
  ```
- **Response**: Claude API response (passed through)
- **Service**: Anthropic API (https://api.anthropic.com/v1/messages)
- **Security**:
  - Strict CORS allowlist
  - CORS origins:
    - http://localhost:3100
    - https://well-fit-community-daily-com-git-*.vercel.app
    - https://wellfitcommunity.live
    - https://www.wellfitcommunity.live
    - https://thewellfitcommunity.org
    - https://legendary-space-goggles-g46697v595q4c757-3100.app.github.dev
- **Rate Limit**: API_RATE_LIMIT_REQUESTS/API_RATE_LIMIT_WINDOW

---

## SUPABASE EDGE FUNCTIONS

### Base Path: `https://{SUPABASE_URL}/functions/v1/`
All Edge Functions use Deno runtime

#### **Authentication & Authorization Functions**

##### `POST /register`
- **Purpose**: User registration with hCaptcha verification
- **Auth Required**: None (public endpoint)
- **Request Body**:
  ```json
  {
    "phone": "+12125551234",
    "email": "user@example.com" (optional),
    "password": "password123",
    "confirm_password": "password123",
    "first_name": "John",
    "last_name": "Doe",
    "hcaptcha_token": "token",
    "role_code": 4 // optional; enforced to safe roles
  }
  ```
- **Response** (201):
  ```json
  {
    "success": true,
    "message": "Verification code sent...",
    "pending": true,
    "phone": "+12125551234",
    "sms_sent": true
  }
  ```
- **External Services Called**:
  1. hCaptcha verification (https://hcaptcha.com/siteverify)
  2. Calls `/sms-send-code` to send SMS verification
- **Database**:
  - Inserts into `pending_registrations` table
  - Logs to `audit_logs` table (HIPAA compliance)
- **Validation**:
  - Phone: min 10 digits
  - Password: min 8 chars, must match confirm_password
  - Email: valid email format (optional)
  - hCaptcha: server-side verification required
- **Role Enforcement**: Public roles only (4=senior, 5=volunteer, 6=caregiver, 11=contractor, 13=regular)
- **Rate Limit**: IP-based (configured per deployment)

##### `POST /verify-sms-code`
- **Purpose**: Verify SMS code and complete registration
- **Auth Required**: None (public endpoint)
- **Request Body**:
  ```json
  {
    "phone": "+12125551234",
    "code": "123456"
  }
  ```
- **Response** (200):
  ```json
  {
    "success": true,
    "message": "Registration complete",
    "user": { "id": "uuid", "phone": "+12125551234" },
    "session": { "access_token": "jwt", "refresh_token": "token" }
  }
  ```
- **External Services**:
  1. Twilio Verify Service verification (https://verify.twilio.com/v2/Services/{SID}/VerificationCheck)
- **Database Operations**:
  1. Get pending registration by phone
  2. If valid: Create Supabase Auth user
  3. Create profiles record
  4. Logs to `audit_logs`
- **Validation**:
  - Phone must be E.164 format
  - Code must be 4-8 digits
- **Rate Limit**: 5 attempts per 5 minutes

##### `POST /login`
- **Purpose**: User password-based login
- **Auth Required**: None (public endpoint)
- **Request Body**:
  ```json
  {
    "phone": "+12125551234",
    "password": "password123"
  }
  ```
- **Response** (200):
  ```json
  {
    "success": true,
    "message": "Login successful",
    "user": { "id": "uuid" },
    "session": { "access_token": "jwt" }
  }
  ```
- **Database**: Queries `pending_registrations` and validates password hash
- **Rate Limit**: 5 attempts per 15 minutes (IP-based)

##### `POST /passkey-auth-start`
- **Purpose**: Initiate WebAuthn/passkey authentication
- **Auth Required**: None
- **Request Body**:
  ```json
  {
    "phone": "+12125551234"
  }
  ```
- **Response**: WebAuthn challenge object

##### `POST /passkey-auth-finish`
- **Purpose**: Complete WebAuthn authentication
- **Request Body**: WebAuthn response object
- **Response**: Session tokens

##### `POST /passkey-register-start`
- **Purpose**: Initiate passkey registration
- **Request Body**: User details

##### `POST /passkey-register-finish`
- **Purpose**: Complete passkey registration
- **Request Body**: Credential data

---

#### **Admin Functions**

##### `POST /admin-register`
- **Purpose**: Admin-only user registration
- **Auth Required**: Bearer token + super_admin role
- **Request Body**: Similar to public register
- **Difference**: Allows unrestricted role assignment

##### `POST /admin-login`
- **Purpose**: Admin authentication
- **Auth Required**: None
- **Enhanced Validation**: Additional security checks

##### `POST /admin_set_pin`
- **Purpose**: Set admin PIN
- **Auth Required**: super_admin role
- **Request Body**:
  ```json
  {
    "pin": "1234"
  }
  ```

##### `POST /verify-admin-pin`
- **Purpose**: Verify admin PIN
- **Auth Required**: None
- **Request Body**:
  ```json
  {
    "pin": "1234"
  }
  ```

##### `POST /admin_start_session`
- **Purpose**: Start admin session (elevated permissions)
- **Auth Required**: Valid admin PIN

##### `POST /admin_end_session`
- **Purpose**: End admin session
- **Auth Required**: Admin session

##### `GET /admin-user-questions`
- **Purpose**: Get questions for admin panel
- **Auth Required**: admin role

---

#### **Communication Functions**

##### `POST /send-email`
- **Purpose**: Send emails via MailerSend
- **Auth Required**: Bearer token (user must be authenticated)
- **Request Body**:
  ```json
  {
    "to": [{ "email": "user@example.com", "name": "Name" }],
    "subject": "Subject",
    "html": "<p>HTML content</p>",
    "priority": "normal" // or "high", "urgent"
  }
  ```
- **External Service**: MailerSend API
- **Database**: Logs to audit_logs

##### `POST /send_email`
- **Purpose**: Alternative send-email endpoint (duplicate naming)
- **Similar to**: /send-email

##### `POST /send_welcome_email`
- **Purpose**: Send welcome email to new user
- **Auth Required**: None (internal call)
- **Triggered**: On registration completion

##### `POST /send-sms`
- **Purpose**: Send SMS via Twilio
- **Auth Required**: Bearer token
- **Request Body**:
  ```json
  {
    "to": ["+12125551234"],
    "message": "SMS content",
    "priority": "normal"
  }
  ```
- **External Service**: Twilio Messaging API
- **Validation**: Message length ≤ 1600 chars

##### `POST /sms-send-code`
- **Purpose**: Send SMS verification code
- **Auth Required**: None (internal/registration)
- **Request Body**:
  ```json
  {
    "phone": "+12125551234"
  }
  ```
- **Service**: Twilio Verify Service
- **Database**: Updates `pending_registrations.verification_code_sent`

##### `POST /verify-send`
- **Purpose**: Verify Twilio Verify service (legacy)
- **Deprecated**: Use verify-sms-code instead

---

#### **Check-in Functions**

##### `POST /create-checkin`
- **Purpose**: Create patient check-in
- **Auth Required**: Bearer token
- **Request Body**:
  ```json
  {
    "user_id": "uuid",
    "type": "mood|health|medication",
    "data": { ... }
  }
  ```
- **Database**: Inserts into `check_ins` table
- **Triggers**: Health alerts, notifications

##### `POST /send-checkin-reminders`
- **Purpose**: Send scheduled check-in reminders
- **Auth Required**: Internal (cron/webhook)
- **Scheduling**: Scheduled execution

---

#### **Notification Functions**

##### `POST /send-appointment-reminder`
- **Purpose**: Send appointment reminder notifications
- **Auth Required**: Internal
- **Channels**: Email, SMS

##### `POST /send-telehealth-appointment-notification`
- **Purpose**: Notify about telehealth appointments
- **Integrations**: Email, SMS, push notifications
- **Database**: Logs notification delivery

##### `POST /send-team-alert`
- **Purpose**: Send alerts to care team
- **Auth Required**: Bearer token
- **Request Body**:
  ```json
  {
    "alert_type": "critical|warning|info",
    "message": "Alert message",
    "recipients": ["user_id1", "user_id2"]
  }
  ```

##### `POST /notify-stale-checkins`
- **Purpose**: Remind users about missed check-ins
- **Scheduling**: Daily execution

##### `POST /send-stale-reminders`
- **Purpose**: Send notifications about stale data
- **Scheduling**: Periodic

---

#### **Healthcare Functions**

##### `POST /create-telehealth-room`
- **Purpose**: Create Daily.co telehealth video room
- **Auth Required**: Bearer token
- **Request Body**:
  ```json
  {
    "participant_id": "uuid",
    "duration_minutes": 60,
    "room_name": "room_name"
  }
  ```
- **External Service**: Daily.co API (https://api.daily.co/v1/rooms)
- **Response**:
  ```json
  {
    "room_url": "https://dailyco.daily.co/...",
    "token": "daily_room_token"
  }
  ```

##### `POST /create-patient-telehealth-token`
- **Purpose**: Generate token for patient to join telehealth room
- **Auth Required**: None (requires room_id)
- **Request Body**:
  ```json
  {
    "room_id": "room_id",
    "user_id": "uuid"
  }
  ```
- **External Service**: Daily.co token generation

##### `POST /check-drug-interactions`
- **Purpose**: Check medication interactions
- **Auth Required**: Bearer token
- **Request Body**:
  ```json
  {
    "medications": [
      { "name": "Aspirin", "dose": "100mg" },
      { "name": "Ibuprofen", "dose": "200mg" }
    ]
  }
  ```
- **External Service**: Anthropic Claude API (drug interaction analysis)
- **Database**: Logs to `drug_interaction_checks`

##### `POST /extract-patient-form`
- **Purpose**: Extract data from patient forms (OCR)
- **Auth Required**: Bearer token
- **Request Body**: FormData with file upload
- **External Service**: Claude Vision API
- **Response**:
  ```json
  {
    "extracted_data": {
      "name": "...",
      "dob": "...",
      "medications": [...]
    }
  }
  ```

##### `POST /process-medical-transcript`
- **Purpose**: Process Deepgram medical transcription
- **Auth Required**: Bearer token
- **Request Body**:
  ```json
  {
    "audio_url": "https://...",
    "patient_id": "uuid"
  }
  ```
- **External Service**: Deepgram API (https://api.deepgram.com/v1/listen)
- **Post-processing**: Claude API for medical coding

##### `POST /realtime_medical_transcription`
- **Purpose**: Real-time medical transcription (WebSocket)
- **Auth Required**: Bearer token
- **Connection**: WebSocket upgrade
- **Service**: Deepgram real-time API

---

#### **AI & Claude Functions**

##### `POST /claude-chat`
- **Purpose**: Secure Claude API integration
- **Auth Required**: Bearer token
- **Request Body**:
  ```json
  {
    "messages": [
      { "role": "user", "content": "message" }
    ],
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 4000,
    "system": "system prompt"
  }
  ```
- **External Service**: Anthropic API (https://api.anthropic.com/v1/messages)
- **Database**: Logs to `claude_api_audit` (HIPAA compliance)
- **Cost Tracking**:
  - Input: $0.003 per 1M tokens
  - Output: $0.015 per 1M tokens
- **Response Metadata**:
  ```json
  {
    "content": [...],
    "usage": {
      "input_tokens": 150,
      "output_tokens": 500
    },
    "request_id": "uuid"
  }
  ```
- **Rate Limit**: 30 requests per minute (AI rate limit)

##### `POST /claude-personalization`
- **Purpose**: Personalized content generation for users
- **Auth Required**: Bearer token
- **Request Body**:
  ```json
  {
    "user_context": { ... },
    "prompt": "Generate personalized content"
  }
  ```
- **Service**: Anthropic Claude API

##### `GET /coding-suggest`
- **Purpose**: Suggest medical codes (ICD-10, CPT)
- **Auth Required**: Bearer token
- **Query Parameters**:
  - `description`: Clinical description
  - `type`: "icd10" or "cpt"
- **Service**: Claude API for code suggestion
- **Response**:
  ```json
  {
    "suggestions": [
      { "code": "E11.9", "description": "Type 2 diabetes..." }
    ]
  }
  ```

##### `GET /sdoh-coding-suggest`
- **Purpose**: Suggest SDOH (Social Determinants of Health) codes
- **Similar to**: /coding-suggest
- **Codes**: LOINC codes for SDOH

---

#### **Data Management Functions**

##### `POST /update-profile-note`
- **Purpose**: Update user profile notes
- **Auth Required**: Bearer token
- **Request Body**:
  ```json
  {
    "note": "Profile note text"
  }
  ```
- **Database**: Updates `profiles.notes`

##### `POST /save-fcm-token`
- **Purpose**: Save Firebase Cloud Messaging token
- **Auth Required**: Bearer token
- **Request Body**:
  ```json
  {
    "token": "fcm_token",
    "platform": "web|ios|android"
  }
  ```
- **Database**: Upserts to `push_subscriptions`

##### `POST /user-data-management`
- **Purpose**: GDPR/HIPAA data export or deletion
- **Auth Required**: Bearer token
- **Request Body**:
  ```json
  {
    "action": "export|delete",
    "include_phi": true
  }
  ```
- **Response**: Downloadable data file or deletion confirmation
- **Compliance**: GDPR, HIPAA, state privacy laws

##### `GET /get-risk-assessments`
- **Purpose**: Get patient risk assessment history
- **Auth Required**: Bearer token
- **Response**: Risk assessment records

---

#### **Guardian Agent Functions**

##### `POST /guardian-agent`
- **Purpose**: Intelligent agent for automated workflows
- **Auth Required**: Bearer token
- **Request Body**:
  ```json
  {
    "action": "analyze|recommend|execute",
    "context": { ... },
    "parameters": { ... }
  }
  ```
- **Service**: Anthropic Claude API
- **Database**: Logs to `guardian_agent_logs`

##### `POST /guardian-agent-api`
- **Purpose**: Guardian Agent API interface
- **Actions**:
  - `security_scan`: Scan system security
  - `audit_log`: Log audit events
  - `monitor_health`: Monitor system health
- **Auth Required**: Bearer token
- **Response**: Guardian action results

##### `POST /guardian-pr-service`
- **Purpose**: Guardian Agent PR (Patient Record) service
- **Purpose**: Handle patient record operations
- **Functions**: Create, update, retrieve records

---

#### **Integration Functions**

##### `POST /enrollClient`
- **Purpose**: Enroll client in healthcare program
- **Auth Required**: Bearer token
- **Request Body**:
  ```json
  {
    "client_id": "uuid",
    "program_id": "uuid",
    "enrollment_date": "2024-01-01"
  }
  ```
- **Database**: Creates enrollment record
- **Audit**: Logs to audit_logs

##### `POST /generate-api-key`
- **Purpose**: Generate API keys for third-party integrations
- **Auth Required**: Bearer token + admin role
- **Request Body**:
  ```json
  {
    "name": "API Key Name",
    "scopes": ["read", "write"],
    "expires_in": 86400
  }
  ```
- **Response**:
  ```json
  {
    "key": "api_key_string",
    "expires_at": "2024-12-31T23:59:59Z"
  }
  ```
- **Database**: Stores in `api_keys` table (hashed)

##### `POST /validate-api-key`
- **Purpose**: Validate API key for third-party calls
- **Auth Required**: None (key in header)
- **Header**: `X-API-Key: {key}`
- **Response**: Key metadata and validity

##### `POST /mobile-sync`
- **Purpose**: Sync mobile app data with server
- **Auth Required**: Bearer token
- **Request Body**:
  ```json
  {
    "sync_token": "last_sync_timestamp",
    "changes": [
      {
        "table": "check_ins",
        "action": "insert|update|delete",
        "data": { ... }
      }
    ]
  }
  ```
- **Response**: Server changes since sync_token
- **Conflict Resolution**: Server-side merge logic

---

#### **Billing & Revenue Functions**

##### `POST /generate-837p`
- **Purpose**: Generate 837P (health insurance claim) file
- **Auth Required**: Bearer token + billing role
- **Request Body**:
  ```json
  {
    "encounter_id": "uuid",
    "patient_id": "uuid",
    "provider_id": "uuid"
  }
  ```
- **Response**: X12 837P EDI file
- **Standards**: HIPAA X12 5010
- **Database**: Logs to `claim_submissions`

##### `POST /enhanced-fhir-export`
- **Purpose**: Export patient data in FHIR format
- **Auth Required**: Bearer token
- **Request Body**:
  ```json
  {
    "patient_id": "uuid",
    "include_history": true,
    "resources": ["Patient", "Condition", "Medication"]
  }
  ```
- **Response**: FHIR Bundle
- **Standard**: FHIR R4 (HL7 FHIR)

---

#### **Backup & Maintenance Functions**

##### `POST /nightly-excel-backup`
- **Purpose**: Automated backup to Excel
- **Auth Required**: Internal (cron)
- **Scheduling**: Nightly execution
- **Output**: Excel file stored in cloud storage

##### `POST /daily-backup-verification`
- **Purpose**: Verify backup integrity
- **Auth Required**: Internal
- **Scheduling**: Daily
- **Checks**: File integrity, completeness, restoration

---

#### **API Management Functions**

##### `GET /test-users`
- **Purpose**: Get test users (demo/testing)
- **Auth Required**: Bearer token + admin
- **Response**: List of test user accounts

##### `POST /test_users`
- **Purpose**: Create test users
- **Auth Required**: Bearer token + admin
- **Request Body**:
  ```json
  {
    "count": 5,
    "role": "senior",
    "include_data": true
  }
  ```

---

#### **MCP Integration**

##### `POST /mcp-claude-server`
- **Purpose**: Model Context Protocol (MCP) server
- **Auth Required**: Bearer token
- **Protocol**: JSON-RPC 2.0
- **Features**: Tool calling, resource access

---

## EXTERNAL SERVICE INTEGRATIONS

### 1. **Anthropic Claude API**
- **Endpoint**: https://api.anthropic.com/v1/messages
- **Authentication**: API Key in header (`x-api-key`)
- **Models Used**:
  - `claude-3-5-sonnet-20241022` (default)
  - `claude-3-opus-20250219` (advanced)
- **Request Format**:
  ```json
  {
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 4000,
    "messages": [
      { "role": "user", "content": "prompt" }
    ],
    "system": "system prompt"
  }
  ```
- **Uses Cases**:
  - Medical coding suggestions
  - Drug interaction checking
  - Patient communication
  - Clinical documentation
  - Health education
  - Risk assessment
- **Cost Tracking**: Logged per request
- **Rate Limiting**: 30 requests/minute per user
- **Environment Variables**:
  - `ANTHROPIC_API_KEY`
  - `REACT_APP_ANTHROPIC_API_KEY`

### 2. **Twilio**
- **API Endpoint**: https://api.twilio.com/2010-04-01/Accounts/{SID}/
- **Services**:
  - **Messaging**: /Messages.json (SMS)
  - **Verify**: https://verify.twilio.com/v2/Services/{SID}/
    - VerificationCheck (code verification)
    - Verifications (send code)
- **Authentication**: Basic Auth (AccountSID:AuthToken base64)
- **Request Format**:
  - Messaging Service SID (preferred) OR From Number
  - To: E.164 phone number
  - Body: SMS message content
- **Use Cases**:
  - SMS verification codes
  - Patient notifications
  - Appointment reminders
  - Emergency alerts
- **Limits**:
  - Message length: 1600 characters
  - Codes: 4-8 digits
- **Environment Variables**:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_MESSAGING_SERVICE_SID`
  - `TWILIO_FROM_NUMBER` (fallback)
  - `TWILIO_VERIFY_SERVICE_SID`

### 3. **MailerSend**
- **API Endpoint**: https://api.mailersend.com/v1/email
- **Authentication**: Bearer token
- **Request Format**:
  ```json
  {
    "from": { "email": "sender@domain.com", "name": "Sender" },
    "to": [{ "email": "recipient@domain.com", "name": "Name" }],
    "subject": "Subject",
    "text": "Plain text",
    "html": "<p>HTML content</p>",
    "reply_to": { "email": "reply@domain.com" },
    "settings": {
      "track_clicks": false,
      "track_opens": false
    }
  }
  ```
- **Use Cases**:
  - Welcome emails
  - Password reset
  - Appointment confirmations
  - Clinical updates
  - Account notifications
- **Environment Variables**:
  - `MAILERSEND_API_KEY`
  - `MAILERSEND_FROM_EMAIL`
  - `MAILERSEND_FROM_NAME`
  - `MAILERSEND_REPLY_TO`

### 4. **Daily.co**
- **API Endpoint**: https://api.daily.co/v1/
- **Services**:
  - POST /rooms (create video room)
  - POST /rooms/{roomName}/tokens (generate access token)
- **Authentication**: API key in header
- **Use Cases**:
  - Telehealth video consultations
  - Remote patient monitoring
  - Virtual support groups
- **Features**:
  - Room-based architecture
  - Token-based access control
  - Recording capabilities
  - HIPAA-compliant storage
- **Environment Variables**:
  - `DAILY_API_KEY`

### 5. **Deepgram**
- **API Endpoint**: https://api.deepgram.com/v1/
- **Services**:
  - POST /listen (transcription)
  - WebSocket: wss://live.deepgram.com/v1/listen (real-time)
- **Authentication**: API key in header
- **Request Format** (batch):
  ```json
  {
    "language": "en",
    "model": "medical",
    "tier": "enhanced"
  }
  ```
- **Features**:
  - Medical vocabulary model
  - Real-time streaming
  - Punctuation restoration
  - Speaker diarization
- **Use Cases**:
  - Doctor-patient conversation transcription
  - Clinical note generation
  - Appointment recording
- **Environment Variables**:
  - `DEEPGRAM_API_KEY`

### 6. **hCaptcha**
- **Service**: https://hcaptcha.com/siteverify
- **Authentication**: Secret key in POST
- **Request Format**:
  ```json
  {
    "secret": "secret_key",
    "response": "token"
  }
  ```
- **Use Cases**:
  - Registration form protection
  - Login form protection
  - Admin panel protection
- **Environment Variables**:
  - `REACT_APP_HCAPTCHA_SITE_KEY` (public)
  - `HCAPTCHA_SECRET` (server-side only)

### 7. **Supabase Services**
- **Auth Endpoints**:
  - `{SUPABASE_URL}/auth/v1/token` (password auth, refresh)
  - `{SUPABASE_URL}/auth/v1/admin/users/{id}` (admin operations)
- **Database**: Supabase Postgres (PostgREST API)
- **Realtime**: WebSocket subscriptions
- **Storage**: File storage API
- **Functions**: Edge Functions runtime
- **Environment Variables**:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SB_URL` (alias)
  - `SB_SECRET_KEY` (alias)

---

## AUTHENTICATION & AUTHORIZATION

### Auth Methods

#### 1. **Supabase JWT (Bearer Token)**
- **Header**: `Authorization: Bearer {jwt_token}`
- **Token Source**: Supabase Auth service
- **Validation**: Signature verification at Supabase admin level
- **Expiry**: Configurable (typically 1 hour)
- **Refresh**: Via refresh_token cookie

#### 2. **Internal API Key**
- **Header Option 1**: `X-Internal-API-Key: {key}`
- **Header Option 2**: `Authorization: Bearer {key}`
- **Scope**: Internal service-to-service calls
- **Used For**: Email/SMS endpoints from Edge Functions
- **Environment**: `INTERNAL_API_KEY`

#### 3. **Supabase Anon Key**
- **Header**: `apikey: {anon_key}`
- **Scope**: Public endpoints, unauthenticated operations
- **Rate Limited**: Per IP address
- **Environment**: `SUPABASE_ANON_KEY`

#### 4. **Service Role Key**
- **Server-Side Only**: Never expose to client
- **Scope**: Admin operations, RLS bypass
- **Used For**: Supabase admin operations
- **Environment**: `SUPABASE_SERVICE_ROLE_KEY`

### Role-Based Access Control

#### Roles Table (`profiles.role_id -> roles.id`)
1. **admin** (id: 1)
   - User management
   - System configuration
   - Report access
   - Limited billing access

2. **super_admin** (id: 2)
   - All admin privileges
   - Role assignment
   - System maintenance
   - Full billing access

3. **staff** (id: 3)
   - Staff user operations
   - Patient care coordination
   - Limited reporting

4. **senior** (id: 4)
   - Patient account
   - Personal health data
   - Own appointment booking

5. **volunteer** (id: 5)
   - Volunteer program support
   - Limited patient interaction

6. **caregiver** (id: 6)
   - Care for assigned seniors
   - Share senior's health data
   - Appointment coordination

7. **contractor** (id: 11)
   - Specialized services
   - Limited scope access

8. **contractor_nurse** (id: 12)
   - Nursing-specific operations
   - Medical record access

9. **regular** (id: 13)
   - Generic user role
   - Basic platform features

10. **moderator** (id: 14)
    - Community moderation
    - Report handling

### RLS (Row Level Security)
- **Enforced At**: Postgres level
- **Bypass**: Service role key only
- **Profiles**: User's role_id is lookup key
- **Data Isolation**: Users see only their own data + shared data

---

## RATE LIMITING & SECURITY

### Rate Limit Configuration

#### Vercel API Endpoints
```env
API_RATE_LIMIT_REQUESTS=60
API_RATE_LIMIT_WINDOW=60000  # 1 minute
```

#### Supabase Edge Functions
- **AUTH**: 5 attempts per 300 seconds
- **API**: 60 requests per 60 seconds
- **READ**: 100 requests per 60 seconds
- **EXPENSIVE**: 10 requests per 600 seconds
- **AI**: 30 requests per 60 seconds

#### Database (rate_limit_attempts table)
```sql
CREATE TABLE rate_limit_attempts (
  id UUID PRIMARY KEY,
  identifier VARCHAR NOT NULL,  -- "prefix:user_id" or "prefix:ip"
  attempted_at TIMESTAMP NOT NULL,
  metadata JSONB
);
```

### Implementation

#### Memory-Based (In-App)
- **Service**: `claudeService.ts` RateLimiter class
- **Storage**: In-memory Map
- **Limitation**: Single server instance only

#### Database-Based (Distributed)
- **Service**: `rateLimiter.ts` (Supabase functions)
- **Storage**: `rate_limit_attempts` table
- **Advantage**: Works across multiple instances
- **Cleanup**: Daily removal of attempts older than 24 hours

### Brute Force Protection
- **Login**: 5 attempts per 15 minutes
- **Admin PIN**: 3 attempts per 5 minutes
- **SMS Verification**: 5 attempts per 5 minutes
- **hCaptcha**: Bypass after 3 failures (human check)

---

## CORS & SECURITY HEADERS

### CORS Configuration

#### Allowed Origins
```javascript
ALLOWED_ORIGINS = [
  "https://wellfitcommunity.live",
  "https://www.wellfitcommunity.live",
  "https://thewellfitcommunity.org",
  "https://www.thewellfitcommunity.org",
  "https://*.vercel.app",  // Wildcard for preview deployments
  "http://localhost:3100"  // Development only
]
```

#### Dynamic Origins (GitHub Codespaces)
- **Pattern**: `https://[a-z0-9-]+.app.github.dev`
- **Allowed**: Yes (development environment)

#### CORS Headers
```
Access-Control-Allow-Origin: {verified-origin}
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: authorization, apikey, content-type, x-client-info
Access-Control-Max-Age: 86400
Access-Control-Allow-Credentials: true
```

### Security Headers

#### Content Security Policy (CSP)
```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.hcaptcha.com https://hcaptcha.com
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
img-src 'self' data: blob: https://*.supabase.co https://api.hcaptcha.com https://images.unsplash.com
connect-src 'self' https://*.supabase.co https://api.hcaptcha.com https://verify.twilio.com https://api.twilio.com https://api.mailersend.com https://api.anthropic.com
frame-src 'self' https://hcaptcha.com https://*.hcaptcha.com
frame-ancestors 'self' https://wellfitcommunity.live https://www.wellfitcommunity.live
base-uri 'self'
form-action 'self'
object-src 'none'
upgrade-insecure-requests
```

#### HTTP Security Headers
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN (or use CSP frame-ancestors)
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

---

## DATA FORMATS & SCHEMAS

### Standard Response Format

#### Success Response
```json
{
  "ok": true,
  "data": { ... },
  "message": "Operation successful"
}
```

#### Error Response
```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": { ... },
  "status": 400
}
```

### Common Data Types

#### Phone Number (E.164 Format)
- **Format**: `+{country_code}{number}`
- **Example**: `+12125551234`
- **Length**: 10-15 digits
- **Validation**: Regex: `^\+\d{10,15}$`

#### User ID
- **Type**: UUID (v4)
- **Example**: `550e8400-e29b-41d4-a716-446655440000`

#### Timestamps
- **Format**: ISO 8601
- **Example**: `2024-01-15T10:30:00Z`
- **Timezone**: Always UTC

#### JWT Token
- **Format**: Three base64-encoded parts separated by dots
- **Header**: Algorithm, type
- **Payload**: User claims, expiry, issued at
- **Signature**: HMAC-based verification

### HIPAA Audit Logging

#### Audit Log Schema
```json
{
  "event_type": "USER_REGISTER|LOGIN|ACCESS_PHI|EXPORT_DATA|DELETE_RECORD",
  "event_category": "AUTHENTICATION|DATA_ACCESS|ADMIN_ACTION|SYSTEM",
  "actor_user_id": "uuid or null",
  "actor_ip_address": "192.168.1.1",
  "actor_user_agent": "Mozilla/5.0...",
  "operation": "CREATE|READ|UPDATE|DELETE",
  "resource_type": "patient|appointment|medication",
  "resource_id": "uuid",
  "success": true,
  "error_code": "ERROR_CODE or null",
  "error_message": "Error message or null",
  "metadata": {
    "phone": "E.164 format (masked if possible)",
    "role": "user_role",
    "changes": "What was modified",
    "data_classified": "PHI | PII | SDOH"
  },
  "created_at": "2024-01-15T10:30:00Z",
  "retention_days": 2555  // ~7 years
}
```

---

## ERROR HANDLING

### HTTP Status Codes
- **200 OK**: Successful GET/POST/PUT/PATCH
- **201 Created**: Successful POST (resource created)
- **204 No Content**: Successful DELETE or OPTIONS preflight
- **400 Bad Request**: Validation error, malformed data
- **401 Unauthorized**: Missing/invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Duplicate resource, conflict in data
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side exception
- **503 Service Unavailable**: Maintenance or external service down

### Error Response Examples

#### Validation Error
```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": ["password"],
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

#### Rate Limit
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 45 seconds.",
  "retryAfter": 45,
  "resetAt": "2024-01-15T10:31:00Z"
}
```

#### Authentication Error
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

#### Authorization Error
```json
{
  "error": "Forbidden",
  "message": "You don't have permission to perform this action"
}
```

### Exception Handling

#### Client Responsibility
- Validate input before submission
- Implement retry logic for 5xx errors
- Handle rate limit backoff (Retry-After header)
- Refresh token on 401 (expired session)

#### Server Responsibility
- Return specific error codes
- Include `Retry-After` header for 429/503
- Log all errors with request ID
- Mask sensitive data in error messages

---

## INTEGRATION PATTERNS

### Service-to-Service Communication

#### Internal API Key Pattern
```typescript
// Edge Function calling Vercel API endpoint
const response = await fetch('https://api.example.com/api/email/send', {
  method: 'POST',
  headers: {
    'X-Internal-API-Key': process.env.INTERNAL_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ ... })
});
```

#### Supabase RPC Pattern
```typescript
// Call Supabase stored procedure
const { data, error } = await supabase.rpc('function_name', {
  param1: 'value1'
});
```

#### Webhook Pattern
```typescript
// Receive events from external services
app.post('/webhooks/twilio', (req, res) => {
  const event = req.body;
  // Verify signature
  // Process event
  res.json({ success: true });
});
```

### Data Flow Examples

#### Registration Flow
1. Client: POST /register with hCaptcha token
2. Server: Verify hCaptcha (https://hcaptcha.com/siteverify)
3. Server: Check duplicate phone
4. Server: Hash password
5. Server: Insert pending_registrations
6. Server: Call /sms-send-code
7. Service: Send via Twilio Verify
8. Client: Receives SMS
9. Client: POST /verify-sms-code with code
10. Server: Verify with Twilio
11. Server: Create auth user
12. Server: Create profile
13. Server: Send welcome email (MailerSend)
14. Client: Receive session tokens

#### Patient Notification Flow
1. Trigger: Check-in missed, appointment reminder, alert
2. Server: Query notification preferences
3. Server: Check recipient availability
4. Server: Send via preferred channel:
   - Email: MailerSend API
   - SMS: Twilio API
   - Push: Firebase Cloud Messaging
5. Server: Log delivery status
6. Server: Schedule retry if failed

#### Claude AI Integration Flow
1. Client: Request with prompt
2. Server: Rate limit check
3. Server: Cost estimate calculation
4. Server: Call Claude API (https://api.anthropic.com/v1/messages)
5. Server: Log to claude_api_audit
6. Server: Calculate actual cost
7. Server: Update user cost tracking
8. Server: Return response
9. Client: Display response

---

## WEBHOOK ENDPOINTS (Incoming)

### Twilio Webhooks

#### SMS Delivery Status
```
POST /webhooks/twilio/sms-status
Headers: X-Twilio-Signature
Body: {
  "MessageSid": "...",
  "MessageStatus": "delivered|failed|undelivered",
  "To": "+12125551234"
}
```

#### Voice Status
```
POST /webhooks/twilio/voice-status
```

### Daily.co Webhooks

#### Room Events
```
POST /webhooks/daily/room-events
Body: {
  "event": "room.finished|room.expired",
  "roomName": "...",
  "timestamp": "ISO8601"
}
```

### Stripe/Payment Webhooks (if integrated)

#### Charge Events
```
POST /webhooks/stripe
Headers: Stripe-Signature
Body: Stripe Event Object
```

---

