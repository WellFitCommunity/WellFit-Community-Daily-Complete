# WellFit Community Daily Complete - System Architecture Diagrams

**Documentation Date:** November 4, 2025
**System Version:** 0.1.0
**Architecture Status:** Production-Grade Healthcare Platform

---

## Table of Contents

1. [High-Level System Architecture](#1-high-level-system-architecture)
2. [Component Interaction Diagram](#2-component-interaction-diagram)
3. [Data Flow Architecture](#3-data-flow-architecture)
4. [Authentication & Authorization Flow](#4-authentication--authorization-flow)
5. [FHIR Integration Architecture](#5-fhir-integration-architecture)
6. [Billing & Claims Processing Flow](#6-billing--claims-processing-flow)
7. [AI Services Architecture](#7-ai-services-architecture)
8. [Database Entity Relationship Diagram](#8-database-entity-relationship-diagram)
9. [Security & Compliance Layers](#9-security--compliance-layers)
10. [Deployment Architecture](#10-deployment-architecture)

---

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WellFit Community Daily                         │
│                    Complete Healthcare Platform                         │
└─────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                     │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Web App     │  │  Mobile PWA  │  │  Kiosk Mode  │  │  Offline    │ │
│  │  (React)     │  │  (React      │  │  (CHW        │  │  Mode       │ │
│  │              │  │   Native)    │  │   Tablets)   │  │  (IndexedDB)│ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                                    │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────┐      ┌──────────────────────────────────┐  │
│  │  Vercel Edge Functions  │      │  Supabase Edge Functions (Deno)  │  │
│  │  ─────────────────────  │      │  ──────────────────────────────  │  │
│  │  • Auth (login/logout)  │      │  • Registration & enrollment     │  │
│  │  • Email send           │      │  • Admin management              │  │
│  │  • SMS send             │      │  • Clinical workflows            │  │
│  │  • Profile management   │      │  • Billing & coding              │  │
│  │  • Admin role mgmt      │      │  • Real-time transcription       │  │
│  │  • Anthropic proxy      │      │  • Guardian Agent API            │  │
│  └─────────────────────────┘      └──────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                      BUSINESS LOGIC LAYER                                 │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  FHIR        │  │  Billing     │  │  AI          │  │  Care       │ │
│  │  Services    │  │  Services    │  │  Services    │  │  Coordination│ │
│  │  ──────────  │  │  ──────────  │  │  ──────────  │  │  ──────────  │ │
│  │  • Resources │  │  • Claims    │  │  • Claude    │  │  • Handoffs │ │
│  │  • Mapping   │  │  • Coding    │  │  • Guardian  │  │  • Discharge│ │
│  │  • Sync      │  │  • 837P Gen  │  │  • Scribe    │  │  • Readmit  │ │
│  │  • Search    │  │  • CCM Auto  │  │  • Decision  │  │  • EMS      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                        │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              Supabase PostgreSQL Database                        │   │
│  │              ─────────────────────────────                        │   │
│  │  • 50+ Tables (Clinical, Billing, Admin, FHIR)                   │   │
│  │  • Row-Level Security (RLS) - 100+ policies                      │   │
│  │  • AES-256-GCM Encryption (PHI fields)                           │   │
│  │  • 60+ Performance Indexes                                       │   │
│  │  • Audit Logging (7-year retention)                              │   │
│  │  • Real-time Subscriptions                                       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌────────────────────┐    ┌─────────────────────┐                      │
│  │  Supabase Storage  │    │  Firebase Storage   │                      │
│  │  ────────────────  │    │  ────────────────── │                      │
│  │  • Documents       │    │  • Images/Photos    │                      │
│  │  • Lab reports     │    │  • Meal pictures    │                      │
│  │  • Audio files     │    │  • Avatars          │                      │
│  └────────────────────┘    └─────────────────────┘                      │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS                                  │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Healthcare Systems     Communication        AI/ML Services              │
│  ──────────────────     ─────────────        ───────────────             │
│  • Epic FHIR R4         • Twilio SMS         • Anthropic Claude          │
│  • Cerner FHIR R4       • MailerSend         • Deepgram Transcription    │
│  • Allscripts           • Firebase FCM       • Drug Interaction API      │
│  • Change Healthcare    • Daily.co Video                                 │
│    (Clearinghouse)                                                        │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Key Characteristics:**
- **Multi-tenant architecture** with branding support
- **Offline-first PWA** with IndexedDB caching
- **HIPAA-compliant** at every layer
- **Real-time** capabilities via WebSockets and Supabase subscriptions
- **Serverless** Edge Functions for scalability

---

## 2. Component Interaction Diagram

```
USER INTERACTIONS → COMPONENTS → SERVICES → DATABASE

┌─────────────────────────────────────────────────────────────────────┐
│                     SENIOR/PATIENT FLOW                             │
└─────────────────────────────────────────────────────────────────────┘

User Login
    │
    ├──→ LoginPage.tsx
    │       │
    │       ├──→ AuthContext.tsx (signInEmailPassword)
    │       │       │
    │       │       └──→ Supabase Auth API
    │       │               │
    │       │               └──→ auth.users table (RLS check)
    │       │
    │       └──→ SessionTimeoutContext (start timer: 8 hours)
    │
    └──→ DashboardPage.tsx (after login)
            │
            ├──→ HealthInsightsWidget
            │       │
            │       └──→ Supabase query: fhir_observations, check_ins
            │
            ├──→ CommunityMoments
            │       │
            │       └──→ Supabase query: community_moments (RLS: own + approved)
            │
            ├──→ UpcomingAppointments
            │       │
            │       └──→ Supabase query: telehealth_appointments
            │
            └──→ TriviaGame (engagement)
                    │
                    └──→ Local state + memory_lane_trivia table

Daily Check-In Flow
    │
    └──→ CheckInPage.tsx
            │
            ├──→ Mood selection → check_ins.mood_score
            ├──→ Symptoms → check_ins.symptoms (JSONB)
            ├──→ Pain level → check_ins.pain_level
            ├──→ Sleep hours → check_ins.sleep_hours
            │
            └──→ Supabase INSERT → check_ins table
                    │
                    └──→ Trigger: update_last_check_in()
                            │
                            └──→ profiles.last_check_in = NOW()


┌─────────────────────────────────────────────────────────────────────┐
│                     PHYSICIAN/PROVIDER FLOW                         │
└─────────────────────────────────────────────────────────────────────┘

SMART Scribe Recording
    │
    └──→ PhysicianPanel → ScribeRecorder Component
            │
            ├──→ getUserMedia() → Microphone access
            │
            ├──→ WebSocket → Deepgram API (real-time transcription)
            │       │
            │       └──→ Transcript chunks every 250ms
            │
            ├──→ Every 10 seconds:
            │       │
            │       └──→ Edge Function: realtime_medical_transcription
            │               │
            │               ├──→ Anthropic Claude API (Sonnet 4.5)
            │               │       │
            │               │       └──→ Generate:
            │               │               • SOAP note (S, O, A, P sections)
            │               │               • CPT codes (99213, 99214, etc.)
            │               │               • ICD-10 codes
            │               │               • HPI, ROS, PE
            │               │
            │               └──→ Response → Update UI in real-time
            │
            └──→ On Stop Recording:
                    │
                    └──→ Save to scribe_sessions table
                            │
                            ├──→ transcription_text
                            ├──→ ai_note_subjective/objective/assessment/plan
                            ├──→ suggested_cpt_codes (JSONB array)
                            ├──→ suggested_icd10_codes (JSONB array)
                            └──→ recording_duration_seconds

Patient Chart Review
    │
    └──→ PhysicianPanel → Patient Selection
            │
            ├──→ Load FHIR Resources:
            │       │
            │       ├──→ fhir_observations (vitals, labs)
            │       ├──→ fhir_conditions (problem list)
            │       ├──→ fhir_medication_requests (active meds)
            │       ├──→ fhir_allergies (allergy list)
            │       └──→ encounters (visit history)
            │
            └──→ Care Plan Management:
                    │
                    └──→ CarePlanService.getActive(patientId)
                            │
                            └──→ fhir_care_plans table


┌─────────────────────────────────────────────────────────────────────┐
│                     ADMIN/BILLING FLOW                              │
└─────────────────────────────────────────────────────────────────────┘

Generate Claim (837P)
    │
    └──→ BillingPanel → ClaimGenerator
            │
            ├──→ Select encounter + scribe session
            │
            ├──→ Load suggested codes:
            │       │
            │       └──→ scribe_sessions.suggested_cpt_codes
            │
            ├──→ Validate codes:
            │       │
            │       └──→ billingDecisionTreeService.validateClaim()
            │               │
            │               ├──→ NODE A: Date of service check
            │               ├──→ NODE B: Code compatibility
            │               ├──→ NODE C: SDOH code validation
            │               ├──→ NODE D: CCM time aggregation
            │               ├──→ NODE E: Modifier logic
            │               └──→ NODE F: Final approval
            │
            ├──→ Edge Function: generate-837p
            │       │
            │       └──→ Generate X12 EDI file
            │               │
            │               ├──→ ISA segment (Interchange header)
            │               ├──→ GS segment (Group header)
            │               ├──→ ST segment (Transaction set)
            │               ├──→ CLM segment (Claim)
            │               ├──→ SV1 segments (Service lines)
            │               └──→ SE/GE/IEA trailers
            │
            └──→ Submit to Clearinghouse:
                    │
                    ├──→ POST to Change Healthcare API
                    │
                    └──→ Store in clearinghouse_batches
                            │
                            └──→ Status: submitted → acknowledged → paid


┌─────────────────────────────────────────────────────────────────────┐
│                     CARE COORDINATION FLOW                          │
└─────────────────────────────────────────────────────────────────────┘

Patient Handoff (Inter-Facility Transfer)
    │
    └──→ HandoffPacketCreator
            │
            ├──→ Gather patient data:
            │       │
            │       ├──→ Demographics (profiles)
            │       ├──→ Active medications (fhir_medication_requests)
            │       ├──→ Allergies (allergy_intolerances)
            │       ├──→ Recent vitals (fhir_observations)
            │       ├──→ Problem list (fhir_conditions)
            │       ├──→ Care team (fhir_care_teams)
            │       └──→ Risk score (risk_assessment_results)
            │
            ├──→ Create handoff_packets record
            │       │
            │       ├──→ packet_data (JSONB)
            │       ├──→ sending_facility
            │       ├──→ receiving_facility
            │       └──→ transmission_method (FHIR, HL7, PDF)
            │
            └──→ Notifications:
                    │
                    ├──→ SMS to receiving facility (Twilio)
                    ├──→ Email with PDF (MailerSend)
                    └──→ FHIR DocumentReference upload
```

---

## 3. Data Flow Architecture

```
DATA FLOW: User Registration → Verification → Profile Completion

┌──────────────────────────────────────────────────────────────────────┐
│                      REGISTRATION WORKFLOW                           │
└──────────────────────────────────────────────────────────────────────┘

Step 1: User fills registration form
    │
    └──→ RegisterPage.tsx
            │
            ├──→ Collect: email, phone, password, name, dob
            │
            ├──→ hCaptcha verification
            │       │
            │       └──→ Edge Function: verify-hcaptcha
            │               │
            │               └──→ hCaptcha API validation
            │
            └──→ Edge Function: register
                    │
                    ├──→ Create user: supabase.auth.admin.createUser()
                    │       │
                    │       └──→ auth.users table (Supabase Auth)
                    │
                    ├──→ Insert profile: profiles table
                    │       │
                    │       └──→ email_verified = false
                    │               phone_verified = false
                    │               onboarded = false
                    │
                    ├──→ Assign role: user_roles table
                    │       │
                    │       └──→ role = 'senior' (default)
                    │
                    └──→ Send verification:
                            │
                            ├──→ SMS code (Twilio)
                            └──→ Welcome email (MailerSend)

Step 2: User verifies phone
    │
    └──→ VerifyCodePage.tsx
            │
            ├──→ User enters SMS code
            │
            └──→ Edge Function: verify-sms-code
                    │
                    ├──→ Validate code (stored in verification_codes table)
                    │
                    └──→ Update: profiles.phone_verified = true
                                  profiles.verified_at = NOW()

Step 3: Consent & Demographics
    │
    ├──→ ConsentPrivacyPage.tsx
    │       │
    │       └──→ Update: profiles.consent = true
    │
    ├──→ DemographicsPage.tsx
    │       │
    │       └──→ Update: profiles (address, emergency contact, insurance)
    │                     profiles.demographics_complete = true
    │
    └──→ Redirect to Dashboard (onboarded = true)


┌──────────────────────────────────────────────────────────────────────┐
│                   CLINICAL DATA FLOW (FHIR)                          │
└──────────────────────────────────────────────────────────────────────┘

External EHR → WellFit → Patient Chart

Epic FHIR Sync Flow:
    │
    ├──→ SMART on FHIR Launch
    │       │
    │       ├──→ User authenticates at Epic
    │       │
    │       ├──→ OAuth2 code exchange (PKCE)
    │       │       │
    │       │       └──→ Receive: access_token, patient context
    │       │
    │       └──→ Store: fhir_connections table
    │                   (access_token, expires_at, patient_id)
    │
    ├──→ Periodic sync (every 15 minutes):
    │       │
    │       └──→ Edge Function: enhanced-fhir-export
    │               │
    │               ├──→ Fetch from Epic:
    │               │       │
    │               │       ├──→ GET /Patient/{id}
    │               │       ├──→ GET /Observation?patient={id}&category=vital-signs
    │               │       ├──→ GET /MedicationRequest?patient={id}&status=active
    │               │       ├──→ GET /Condition?patient={id}
    │               │       ├──→ GET /AllergyIntolerance?patient={id}
    │               │       └──→ GET /Immunization?patient={id}
    │               │
    │               ├──→ Transform to WellFit schema:
    │               │       │
    │               │       └──→ fhirMappingService.normalize()
    │               │
    │               ├──→ Store in database:
    │               │       │
    │               │       ├──→ fhir_observations
    │               │       ├──→ fhir_medication_requests
    │               │       ├──→ fhir_conditions
    │               │       └──→ allergy_intolerances
    │               │
    │               └──→ Log sync: fhir_sync_logs
    │                       │
    │                       └──→ records_processed, records_succeeded, errors
    │
    └──→ Conflict resolution:
            │
            └──→ If Epic data ≠ WellFit data:
                    │
                    ├──→ Insert: fhir_sync_conflicts
                    │       │
                    │       └──→ fhir_data vs community_data (JSONB)
                    │
                    └──→ Manual resolution by clinician


┌──────────────────────────────────────────────────────────────────────┐
│                      BILLING DATA FLOW                               │
└──────────────────────────────────────────────────────────────────────┘

Encounter → Scribe → Codes → Claim → Clearinghouse → Payment

1. Clinical Encounter
    │
    └──→ encounters table (created on patient arrival)
            │
            └──→ status = 'in-progress'

2. Provider Documentation (SMART Scribe)
    │
    └──→ Real-time recording → scribe_sessions table
            │
            ├──→ transcription_text
            ├──→ suggested_cpt_codes (AI-generated)
            └──→ suggested_icd10_codes (AI-generated)

3. Billing Review
    │
    └──→ Admin reviews codes
            │
            ├──→ Decision Tree validation
            │       │
            │       └──→ billingDecisionTreeService.processEncounter()
            │
            └──→ Create claim: billing_claims table
                    │
                    ├──→ claim_status = 'draft'
                    ├──→ Link: encounter_id, patient_id, provider_id
                    └──→ claim_line_items (CPT codes with modifiers)

4. Claim Generation
    │
    └──→ Edge Function: generate-837p
            │
            ├──→ Load data:
            │       │
            │       ├──→ Patient demographics (profiles)
            │       ├──→ Provider NPI (fhir_practitioners)
            │       ├──→ Claim lines (claim_line_items)
            │       └──→ Fee schedule (fee_schedules)
            │
            ├──→ Generate X12 EDI 837P file
            │       │
            │       └──→ Format: professional claim (not institutional)
            │
            └──→ Update: billing_claims.claim_status = 'ready_to_submit'

5. Clearinghouse Submission
    │
    └──→ Batch submission
            │
            ├──→ Create: clearinghouse_batches
            │       │
            │       ├──→ batch_id (unique)
            │       ├──→ file_content (X12 EDI)
            │       ├──→ claim_count
            │       └──→ status = 'pending'
            │
            ├──→ POST to Change Healthcare API
            │
            └──→ Receive 997 Acknowledgment
                    │
                    ├──→ Parse response
                    │
                    └──→ Update: clearinghouse_batches.status = 'acknowledged'

6. Payment Posting
    │
    └──→ Receive 835 ERA (Electronic Remittance Advice)
            │
            ├──→ Parse 835 file
            │
            ├──→ Match to claims: claim_control_number
            │
            ├──→ Create: payments table
            │       │
            │       ├──→ amount_paid
            │       ├──→ adjustment_codes
            │       └──→ payment_date
            │
            └──→ Update: billing_claims.claim_status = 'paid' | 'denied' | 'partial'
```

---

## 4. Authentication & Authorization Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                  AUTHENTICATION METHODS OVERVIEW                     │
└──────────────────────────────────────────────────────────────────────┘

Method 1: Email/Password
    │
    └──→ LoginPage → AuthContext.signInEmailPassword()
            │
            ├──→ supabase.auth.signInWithPassword({ email, password })
            │       │
            │       └──→ Supabase Auth validates against auth.users
            │
            ├──→ On success:
            │       │
            │       ├──→ Session created (JWT token)
            │       ├──→ Refresh token stored (HttpOnly cookie)
            │       └──→ Session timeout: 8 hours
            │
            └──→ RLS context:
                    │
                    └──→ auth.uid() = user's UUID (used in all RLS policies)

Method 2: SMS/OTP
    │
    └──→ LoginPage → AuthContext.sendPhoneOtp()
            │
            ├──→ supabase.auth.signInWithOtp({ phone, channel: 'sms' })
            │       │
            │       └──→ Twilio sends 6-digit code
            │
            └──→ User enters code → AuthContext.verifyPhoneOtp()
                    │
                    └──→ supabase.auth.verifyOtp({ phone, token })

Method 3: Admin PIN Authentication
    │
    └──→ AdminLoginPage → AdminAuthContext.verifyPinAndLogin()
            │
            ├──→ User enters 4-8 digit PIN
            │
            ├──→ Edge Function: verify-admin-pin
            │       │
            │       ├──→ Query: staff_pins table
            │       │       │
            │       │       └──→ WHERE user_id = X AND role = 'admin'
            │       │
            │       ├──→ bcrypt.compare(pin, pin_hash)
            │       │
            │       └──→ Generate admin_token (120-minute TTL)
            │
            ├──→ Store token in memory ONLY (not localStorage)
            │
            └──→ Admin session expires after 2 hours (strict timeout)

Method 4: WebAuthn/Passkey
    │
    └──→ PasskeySetup → passkeyService.registerPasskey()
            │
            ├──→ Edge Function: passkey-register-start
            │       │
            │       └──→ Generate challenge (WebAuthn credential options)
            │
            ├──→ navigator.credentials.create() → Biometric prompt
            │       │
            │       └──→ User approves via Touch ID / Face ID / Fingerprint
            │
            ├──→ Edge Function: passkey-register-finish
            │       │
            │       ├──→ Verify attestation
            │       └──→ Store: passkey_credentials table
            │
            └──→ Future logins:
                    │
                    └──→ navigator.credentials.get() → Instant authentication

Method 5: SMART on FHIR OAuth2
    │
    └──→ Epic Launch → smartOnFhir.getAuthorizationUrl()
            │
            ├──→ PKCE parameters:
            │       │
            │       ├──→ code_challenge (SHA-256 of verifier)
            │       ├──→ state (random nonce)
            │       └──→ scope: 'launch/patient patient/*.read user/*.read'
            │
            ├──→ Redirect to Epic authorization endpoint
            │
            ├──→ User authorizes at Epic
            │
            ├──→ Callback: SmartCallbackPage
            │       │
            │       └──→ smartOnFhir.exchangeCodeForToken(code)
            │               │
            │               └──→ Receives: access_token, patient context
            │
            └──→ Store session: sessionStorage (scoped to Epic patient)


┌──────────────────────────────────────────────────────────────────────┐
│                  AUTHORIZATION (RBAC + RLS)                          │
└──────────────────────────────────────────────────────────────────────┘

Role Hierarchy (Top → Bottom):
    │
    ├──→ super_admin (Level 1) - Full system access
    ├──→ department_head (Level 2) - Executive oversight
    ├──→ clinical_supervisor (Level 3) - Clinical operations
    ├──→ nurse_practitioner / physician_assistant (Level 4) - Advanced practice
    ├──→ physician / doctor / nurse (Level 5) - Direct care
    ├──→ case_manager / social_worker / chw (Level 5) - Care coordination
    ├──→ physical_therapist (Level 6) - Allied health
    └──→ admin (Level 7) - Administrative

Row-Level Security (RLS) Examples:

Table: profiles
    │
    └──→ Policy: "Users can read own profile"
            │
            └──→ USING (auth.uid() = user_id)

Table: fhir_observations
    │
    ├──→ Policy: "Patients can read own observations"
    │       │
    │       └──→ USING (patient_id = auth.uid())
    │
    └──→ Policy: "Clinicians can read assigned patients"
            │
            └──→ USING (
                    EXISTS (
                      SELECT 1 FROM fhir_care_teams ct
                      WHERE ct.patient_id = fhir_observations.patient_id
                      AND ct.member_user_id = auth.uid()
                    )
                  )

Table: billing_claims
    │
    ├──→ Policy: "Admins can view all claims"
    │       │
    │       └──→ USING (
                    EXISTS (
                      SELECT 1 FROM user_roles
                      WHERE user_id = auth.uid()
                      AND role IN ('admin', 'super_admin')
                    )
                  )
    │
    └──→ Policy: "Providers can view their own claims"
            │
            └──→ USING (provider_id = auth.uid())

Access Control Flow:
    │
    └──→ User Request → Database Query
            │
            ├──→ Supabase Auth: Identify auth.uid()
            │
            ├──→ RLS Policy Check:
            │       │
            │       ├──→ Evaluate USING clause
            │       │       │
            │       │       └──→ If true: Return rows
            │       │           If false: Return empty set
            │       │
            │       └──→ No RLS bypass (even for service_role in some cases)
            │
            └──→ Response to client
```

---

## 5. FHIR Integration Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│              FHIR R4 INTEROPERABILITY ARCHITECTURE                   │
└──────────────────────────────────────────────────────────────────────┘

EHR Systems                WellFit Platform              Database
─────────────             ──────────────────             ─────────

┌─────────────┐           ┌──────────────────┐         ┌──────────────┐
│ Epic        │◄─────────►│ EpicFHIRAdapter  │◄───────►│ fhir_        │
│ FHIR R4     │  OAuth2   │                  │ Mapping │ connections  │
└─────────────┘  SMART    └──────────────────┘         └──────────────┘
                                  │
┌─────────────┐                   │                    ┌──────────────┐
│ Cerner      │◄──────────────────┼───────────────────►│ fhir_patient_│
│ FHIR R4     │                   │                    │ mappings     │
└─────────────┘                   │                    └──────────────┘
                                  │
┌─────────────┐                   ▼                    ┌──────────────┐
│ Allscripts  │           ┌──────────────────┐         │ fhir_        │
│ FHIR R4     │           │ Universal        │         │ sync_logs    │
└─────────────┘           │ Adapter Registry │         └──────────────┘
                          └──────────────────┘
                                  │                    ┌──────────────┐
┌─────────────┐                   │                    │ fhir_        │
│ Generic     │◄──────────────────┘                    │ resource_sync│
│ FHIR Server │                                        └──────────────┘
└─────────────┘


FHIR Resource Sync Flow:
──────────────────────────

1. Connection Setup
    │
    └──→ fhir_connections table
            │
            ├──→ fhir_server_url (e.g., https://fhir.epic.com/...)
            ├──→ ehr_system ('EPIC', 'CERNER', 'ALLSCRIPTS')
            ├──→ access_token (OAuth2 Bearer token)
            ├──→ token_expiry (refresh before expiration)
            └──→ sync_frequency (15 minutes default)

2. Patient Mapping
    │
    └──→ fhir_patient_mappings table
            │
            ├──→ community_user_id (WellFit user)
            ├──→ fhir_patient_id (Epic patient ID)
            ├──→ connection_id (which EHR)
            └──→ sync_status ('active', 'paused', 'error')

3. Resource Fetch (Example: Observations)
    │
    └──→ GET https://fhir.epic.com/api/FHIR/R4/Observation?
            patient=eHBTXkpNeEXOhpADG5zKgLw3&
            category=vital-signs&
            date=ge2025-10-01
            │
            ├──→ Headers:
            │       Accept: application/fhir+json
            │       Authorization: Bearer {access_token}
            │
            └──→ Response: FHIR Bundle
                    │
                    └──→ {
                          "resourceType": "Bundle",
                          "type": "searchset",
                          "entry": [
                            {
                              "resource": {
                                "resourceType": "Observation",
                                "id": "12345",
                                "status": "final",
                                "category": [{
                                  "coding": [{
                                    "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                                    "code": "vital-signs"
                                  }]
                                }],
                                "code": {
                                  "coding": [{
                                    "system": "http://loinc.org",
                                    "code": "8480-6",
                                    "display": "Systolic blood pressure"
                                  }]
                                },
                                "subject": {"reference": "Patient/eHBTXkpNeEXOhpADG5zKgLw3"},
                                "effectiveDateTime": "2025-11-04T10:30:00Z",
                                "valueQuantity": {
                                  "value": 120,
                                  "unit": "mmHg",
                                  "system": "http://unitsofmeasure.org",
                                  "code": "mm[Hg]"
                                }
                              }
                            }
                          ]
                        }

4. Mapping & Normalization
    │
    └──→ fhirMappingService.normalizeObservation()
            │
            ├──→ Extract fields:
            │       │
            │       ├──→ LOINC code → observation_code
            │       ├──→ valueQuantity → value + unit
            │       ├──→ effectiveDateTime → observation_datetime
            │       └──→ status → status
            │
            └──→ Insert: fhir_observations table
                    │
                    ├──→ patient_id (WellFit UUID)
                    ├──→ observation_type ('vital-signs')
                    ├──→ observation_code ('8480-6')
                    ├──→ value_quantity (120)
                    ├──→ value_unit ('mmHg')
                    ├──→ observation_datetime ('2025-11-04 10:30:00')
                    └──→ external_id ('12345' - Epic ID for deduplication)

5. Conflict Detection
    │
    └──→ If same observation exists with different value:
            │
            ├──→ Insert: fhir_sync_conflicts
            │       │
            │       ├──→ fhir_data (Epic's version)
            │       ├──→ community_data (WellFit's version)
            │       └──→ resolution_status ('pending')
            │
            └──→ Alert clinician for manual resolution

6. Logging
    │
    └──→ Insert: fhir_sync_logs
            │
            ├──→ connection_id
            ├──→ sync_type ('scheduled')
            ├──→ direction ('inbound' from Epic)
            ├──→ status ('success' or 'partial_success')
            ├──→ records_processed (50)
            ├──→ records_succeeded (48)
            └──→ errors (JSONB array of 2 failures)


Bi-Directional Sync (WellFit → Epic):
──────────────────────────────────────

Update Epic with WellFit Data (e.g., Patient-reported outcomes)
    │
    └──→ POST https://fhir.epic.com/api/FHIR/R4/Observation
            │
            ├──→ Body: FHIR Observation resource
            │       │
            │       └──→ Generated from: check_ins table
            │               │
            │               └──→ Map: mood_score → Observation
            │                         code: "285854004" (SNOMED: Mood)
            │                         value: 8 (scale 1-10)
            │
            └──→ Response: Created Observation with Epic ID
                    │
                    └──→ Store Epic ID: fhir_resource_sync.fhir_resource_id


FHIR Search API (US Core Compliant):
─────────────────────────────────────

WellFit exposes FHIR-compliant search endpoints:

GET /api/fhir/Patient?family=Smith&given=John
    │
    └──→ Returns: FHIR Bundle with matching patients

GET /api/fhir/Observation?patient=123&category=vital-signs&date=ge2025-11-01
    │
    └──→ Returns: FHIR Bundle with observations

POST /api/fhir/MedicationRequest
    │
    └──→ Creates: fhir_medication_requests record

Supported Search Parameters:
- _id (logical ID)
- _lastUpdated (temporal)
- patient (reference)
- category (token)
- code (token)
- date (date range)
- status (token)
```

---

## 6. Billing & Claims Processing Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│               COMPREHENSIVE BILLING ARCHITECTURE                     │
└──────────────────────────────────────────────────────────────────────┘

STEP 1: Encounter Creation
    │
    └──→ encounters table
            │
            ├──→ patient_id
            ├──→ provider_id
            ├──→ encounter_type ('outpatient', 'telehealth', 'inpatient')
            ├──→ started_at
            └──→ status ('in-progress')

STEP 2: Clinical Documentation (SMART Scribe)
    │
    └──→ Real-time recording → scribe_sessions table
            │
            ├──→ Deepgram transcription
            │
            ├──→ Claude AI analysis (every 10 seconds)
            │       │
            │       └──→ Generates:
            │               ├──→ SOAP note
            │               ├──→ CPT codes (e.g., 99213, 99214)
            │               ├──→ ICD-10 codes (e.g., E11.9, I10)
            │               ├──→ HPI, ROS, Physical Exam
            │               └──→ CCM time tracking
            │
            └──→ Store: scribe_sessions
                    ├──→ suggested_cpt_codes (JSONB array)
                    ├──→ suggested_icd10_codes (JSONB array)
                    ├──→ recording_duration_seconds (for E/M level)
                    └──→ is_ccm_eligible (Boolean)

STEP 3: SDOH Screening (if applicable)
    │
    └──→ SDOH assessment → sdoh_assessments table
            │
            ├──→ food_insecurity_score
            ├──→ housing_stability_score
            ├──→ transportation_barriers
            ├──→ social_isolation_score
            │
            └──→ sdohBillingService.generateCodes()
                    │
                    ├──→ Z-codes generated (Z59.4, Z59.0, Z55.0, etc.)
                    ├──→ Complexity score calculated (1-100)
                    └──→ CCM tier assigned (basic, moderate, complex)

STEP 4: Code Generation & Reconciliation
    │
    ├──→ Decision Tree Path:
    │       │
    │       └──→ billingDecisionTreeService.processEncounter()
    │               │
    │               ├──→ NODE A: Validate date of service (< 1 year old)
    │               ├──→ NODE B: Check code compatibility (E/M + procedures)
    │               ├──→ NODE C: SDOH code validation (primary dx required)
    │               ├──→ NODE D: CCM time aggregation (>= 20 min/month)
    │               ├──→ NODE E: Modifier logic (-25, -59, -GT, -95)
    │               └──→ NODE F: Final approval gate
    │
    ├──→ AI Path:
    │       │
    │       └──→ Edge Function: coding-suggest
    │               │
    │               └──→ Claude Sonnet 4.5 analysis
    │                       │
    │                       └──→ Returns: CPT + ICD-10 + confidence scores
    │
    ├──→ SDOH Path:
    │       │
    │       └──→ sdohBillingService (Z-codes + complexity)
    │
    └──→ Reconciliation Logic:
            │
            └──→ Priority: Decision Tree > AI > SDOH > Fallback
                    │
                    └──→ Final codes: claim_line_items table

STEP 5: Fee Schedule Lookup
    │
    └──→ fee_schedules table (10,000+ items)
            │
            ├──→ Query: WHERE cpt_code = '99214'
            │       AND payer_type = 'Medicare'
            │       AND effective_date <= encounter_date
            │       AND (expiration_date IS NULL OR expiration_date >= encounter_date)
            │
            └──→ Returns:
                    ├──→ base_rate ($109.35)
                    ├──→ modifier_adjustments (JSONB)
                    │       └──→ {"-25": 0.50, "-GT": 0.00}
                    └──→ Calculate total: $109.35 * 0.50 = $54.68 (with -25)

STEP 6: Claim Creation
    │
    └──→ billing_claims table
            │
            ├──→ encounter_id (link to visit)
            ├──→ patient_id
            ├──→ provider_id (NPI required)
            ├──→ payer_id (insurance company)
            ├──→ claim_status ('draft')
            ├──→ total_charges ($163.03)
            ├──→ claim_control_number (unique ID)
            └──→ claim_line_items (array):
                    │
                    ├──→ Line 1: CPT 99214, ICD-10 E11.9, charge $109.35
                    ├──→ Line 2: CPT 99490 (CCM), charge $53.68
                    └──→ Total lines: 2

STEP 7: 837P EDI File Generation
    │
    └──→ Edge Function: generate-837p
            │
            ├──→ Load claim data + patient demographics + provider NPI
            │
            ├──→ Generate X12 EDI 837P format:
            │       │
            │       ├──→ ISA*00*          *00*          *ZZ*WELLFIT        *ZZ*CHANGEHC       *251104*1430*^*00501*000000001*0*P*:~
            │       ├──→ GS*HC*WELLFIT*CHANGEHC*20251104*1430*1*X*005010X222A1~
            │       ├──→ ST*837*0001*005010X222A1~
            │       ├──→ BHT*0019*00*CLAIM123*20251104*1430*CH~
            │       ├──→ NM1*41*2*WELLFIT COMMUNITY*****46*12345~ (Submitter)
            │       ├──→ NM1*40*2*CHANGE HEALTHCARE*****46*67890~ (Receiver)
            │       ├──→ HL*1**20*1~ (Billing Provider)
            │       ├──→ NM1*85*2*WELLFIT CLINIC*****XX*1234567890~ (Provider NPI)
            │       ├──→ HL*2*1*22*1~ (Subscriber)
            │       ├──→ NM1*IL*1*SMITH*JOHN****MI*ABC123456~ (Patient)
            │       ├──→ HL*3*2*23*0~ (Patient)
            │       ├──→ CLM*CLAIM123*163.03***11:B:1*Y*A*Y*Y~ (Claim)
            │       ├──→ DTP*431*D8*20251104~ (Date of service)
            │       ├──→ SV1*HC:99214*109.35*UN*1***1:2:3:4~ (Service line 1)
            │       ├──→ SV1*HC:99490*53.68*UN*1***1~ (Service line 2)
            │       ├──→ SE*35*0001~ (Transaction set trailer)
            │       ├──→ GE*1*1~ (Group trailer)
            │       └──→ IEA*1*000000001~ (Interchange trailer)
            │
            └──→ Control Numbers:
                    ├──→ ISA Interchange Control: 000000001 (unique per batch)
                    ├──→ GS Group Control: 1 (increments per group)
                    └──→ ST Transaction Control: 0001 (increments per claim)

STEP 8: Clearinghouse Submission
    │
    └──→ clearinghouse_batches table
            │
            ├──→ batch_id ('BATCH-20251104-001')
            ├──→ clearinghouse ('Change Healthcare')
            ├──→ file_content (X12 EDI 837P)
            ├──→ claim_count (1)
            ├──→ total_amount ($163.03)
            ├──→ submission_method ('API')
            ├──→ status ('pending')
            │
            └──→ POST to Change Healthcare API
                    │
                    ├──→ Endpoint: https://api.changehealthcare.com/claims/submit
                    ├──→ Headers: Authorization: Bearer {api_key}
                    ├──→ Body: X12 EDI file
                    │
                    └──→ Response: Submission ID + Status

STEP 9: Acknowledgment (997/999)
    │
    └──→ Clearinghouse sends 997 Functional Acknowledgment
            │
            ├──→ AK1*HC*1~ (Functional group acknowledged)
            ├──→ AK2*837*0001~ (Transaction set 837, control 0001)
            ├──→ AK5*A~ (Accepted)
            ├──→ AK9*A*1*1*1~ (All accepted)
            │
            └──→ Update: clearinghouse_batches.status = 'acknowledged'
                          clearinghouse_batches.acknowledgment_file = (997 content)

STEP 10: Payment Posting (835 ERA)
    │
    └──→ Receive 835 Electronic Remittance Advice
            │
            ├──→ CLP*CLAIM123*1*163.03*145.00**12*123456789~ (Claim payment)
            │       │
            │       └──→ 1 = Paid, 2 = Denied, 3 = Partial
            │
            ├──→ SVC*HC:99214*109.35*95.00**1~ (Service line payment)
            ├──→ SVC*HC:99490*53.68*50.00**1~
            ├──→ CAS*PR*1*18.03~ (Patient responsibility adjustment)
            │
            └──→ Parse and post payment:
                    │
                    ├──→ payments table
                    │       ├──→ claim_id
                    │       ├──→ amount_paid ($145.00)
                    │       ├──→ patient_responsibility ($18.03)
                    │       ├──→ adjustment_codes (JSONB: {'PR-1': 18.03})
                    │       └──→ payment_date
                    │
                    └──→ Update: billing_claims.claim_status = 'paid'

CCM Billing Automation:
───────────────────────

Chronic Care Management (CPT 99490, 99487, 99489):
    │
    └──→ ccmAutopilotService
            │
            ├──→ Track time spent on CCM activities:
            │       │
            │       ├──→ Phone calls (duration logged)
            │       ├──→ Care plan updates
            │       ├──→ Medication reconciliation
            │       └──→ Care coordination
            │
            ├──→ Monthly time aggregation (per patient):
            │       │
            │       └──→ ccm_time_logs table
            │               ├──→ patient_id
            │               ├──→ activity_type
            │               ├──→ duration_minutes
            │               └──→ logged_at
            │
            ├──→ Auto-billing logic:
            │       │
            │       └──→ At month end:
            │               │
            │               ├──→ SUM(duration_minutes) GROUP BY patient_id
            │               │
            │               └──→ If >= 20 min: Bill 99490 ($53.68)
            │                   If >= 40 min: Bill 99487 ($101.84)
            │                   If 40 min + additional: Bill 99489 (add-on)
            │
            └──→ Compliance validation:
                    │
                    ├──→ Requires: Comprehensive care plan documented
                    ├──→ Requires: Consent signed by patient
                    └──→ Requires: 24/7 access to care team
```

---

## 7. AI Services Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                   AI/ML SERVICES OVERVIEW                            │
└──────────────────────────────────────────────────────────────────────┘

Service 1: Claude Core Service
    │
    └──→ claudeService.ts (1,044 lines)
            │
            ├──→ Model Selection:
            │       │
            │       ├──→ Haiku 4.5 (claude-4-5-haiku-20250926)
            │       │       ├──→ Speed: <1 second
            │       │       ├──→ Cost: $0.25/1M input, $1.25/1M output
            │       │       └──→ Use: UI text, translations, simple tasks
            │       │
            │       ├──→ Sonnet 4.5 (claude-sonnet-4-5-20250929)
            │       │       ├──→ Speed: 3-5 seconds
            │       │       ├──→ Cost: $3/1M input, $15/1M output
            │       │       └──→ Use: Billing codes, clinical docs, safety
            │       │
            │       └──→ Opus 4.1 (claude-opus-4-20250514)
            │               ├──→ Speed: 10-15 seconds
            │               ├──→ Cost: $15/1M input, $75/1M output
            │               └──→ Use: Complex reasoning (rare)
            │
            ├──→ Rate Limiting:
            │       │
            │       ├──→ 60 requests/minute per user
            │       ├──→ Daily limit: $50/user
            │       ├──→ Monthly limit: $500/user
            │       └──→ Cost estimation before each request
            │
            ├──→ PHI Protection:
            │       │
            │       ├──→ All calls via Edge Functions (server-side only)
            │       ├──→ Aggressive de-identification:
            │       │       ├──→ Email redacted → [EMAIL]
            │       │       ├──→ Phone redacted → [PHONE]
            │       │       ├──→ SSN redacted → [SSN]
            │       │       ├──→ Dates redacted → [DATE]
            │       │       └──→ Ages redacted → [AGE]
            │       │
            │       └──→ Audit logging: Every request logged with ID
            │
            └──→ Caching Strategy:
                    │
                    └──→ Prompt caching for repeated contexts
                            (reduces cost by 90% for repeated prefixes)

Service 2: SMART Scribe Real-Time Transcription
    │
    └──→ supabase/functions/realtime_medical_transcription/
            │
            ├──→ Input: Audio chunks from microphone
            │
            ├──→ Deepgram nova-2-medical model
            │       │
            │       ├──→ WebSocket streaming
            │       ├──→ Medical vocabulary optimized
            │       ├──→ Punctuation and capitalization
            │       └──→ <100ms latency
            │
            ├──→ Every 10 seconds → Claude AI analysis:
            │       │
            │       ├──→ Model: Sonnet 4.5 (accuracy critical)
            │       │
            │       ├──→ Prompt: "You are Riley, an AI medical scribe..."
            │       │
            │       └──→ Generates:
            │               │
            │               ├──→ SOAP Note:
            │               │       ├──→ Subjective (patient complaints)
            │               │       ├──→ Objective (vitals, exam findings)
            │               │       ├──→ Assessment (diagnosis)
            │               │       └──→ Plan (treatment, orders)
            │               │
            │               ├──→ Billing Codes:
            │               │       ├──→ CPT codes with confidence scores
            │               │       ├──→ ICD-10 diagnosis codes
            │               │       └──→ E/M level justification
            │               │
            │               ├──→ HPI (History of Present Illness)
            │               ├──→ ROS (Review of Systems)
            │               └──→ PE (Physical Exam)
            │
            └──→ Conversational Coaching:
                    │
                    └──→ "Riley" provides real-time suggestions:
                            ├──→ "Great! You've captured the chief complaint."
                            ├──→ "Don't forget to document the review of systems."
                            └──→ "This visit qualifies for 99214 based on complexity."

Service 3: Guardian Agent (Autonomous Healing)
    │
    └──→ supabase/functions/guardian-agent-api/
            │
            ├──→ Monitoring Cycle: Every 5 seconds
            │
            ├──→ Error Detection (20+ categories):
            │       │
            │       ├──→ Runtime errors (JS exceptions)
            │       ├──→ Network failures (fetch errors)
            │       ├──→ Database errors (Supabase RLS failures)
            │       ├──→ Build errors (TypeScript, webpack)
            │       ├──→ Dependency errors (missing packages)
            │       ├──→ Security errors (CSP violations, XSS attempts)
            │       └──→ Performance errors (slow queries, memory leaks)
            │
            ├──→ Healing Strategies (13 types):
            │       │
            │       ├──→ Code fix (patch TypeScript errors)
            │       ├──→ Dependency update (npm install)
            │       ├──→ Configuration change (.env, tsconfig)
            │       ├──→ RLS policy adjustment (fix access errors)
            │       ├──→ Migration rollback (database issues)
            │       ├──→ Cache clear (stale data)
            │       ├──→ Service restart (Edge Functions)
            │       ├──→ Rollback deployment (if recent deploy)
            │       ├──→ Code refactor (performance optimization)
            │       ├──→ Index creation (slow queries)
            │       ├──→ Security patch (vulnerabilities)
            │       ├──→ Documentation update (outdated docs)
            │       └──→ Test generation (missing coverage)
            │
            ├──→ Autonomous Execution (NO human approval):
            │       │
            │       ├──→ Assess error severity (1-10 scale)
            │       │
            │       ├──→ If severity >= 7: Immediate auto-fix
            │       │   If severity 4-6: Auto-fix with notification
            │       │   If severity < 4: Log and monitor
            │       │
            │       └──→ Execute healing strategy
            │               │
            │               ├──→ Apply code changes
            │               ├──→ Commit to git
            │               ├──→ Create GitHub PR (auto-merged if tests pass)
            │               └──→ Deploy to production
            │
            ├──→ Guardian Eyes (Snapshot Recording):
            │       │
            │       └──→ Every healing action:
            │               ├──→ Before snapshot (error state)
            │               ├──→ Healing action taken
            │               ├──→ After snapshot (healed state)
            │               └──→ Verification (tests passed?)
            │
            └──→ Continuous Learning:
                    │
                    └──→ Each healing builds "memory":
                            ├──→ Error patterns learned
                            ├──→ Successful strategies remembered
                            └──→ Future similar errors: Instant fix

Service 4: Medical Coding AI
    │
    ├──→ claudeCodingService.ts (293 lines)
    │       │
    │       ├──→ Input: Clinical note text
    │       │
    │       ├──→ Model: Sonnet 4.5 (billing accuracy critical)
    │       │
    │       └──→ Output:
    │               ├──→ CPT codes with justifications
    │               ├──→ ICD-10 codes (primary + secondary)
    │               ├──→ HCPCS codes (if applicable)
    │               └──→ Confidence scores (0-100)
    │
    └──→ sdohBillingService.ts (457 lines)
            │
            ├──→ Input: SDOH assessment data
            │
            ├──→ Mapping Logic:
            │       │
            │       ├──→ Food insecurity → Z59.4
            │       ├──→ Housing instability → Z59.0
            │       ├──→ Transportation barriers → Z59.82
            │       ├──→ Social isolation → Z60.2
            │       └──→ Financial strain → Z59.5
            │
            ├──→ Complexity Scoring:
            │       │
            │       └──→ Algorithm:
            │               ├──→ Each SDOH factor: +10 points
            │               ├──→ Severity weighting: x1.5 for "high"
            │               └──→ Total score: 0-100
            │
            └──→ CCM Tier Assignment:
                    │
                    ├──→ Score 0-30: Basic CCM (99490)
                    ├──→ Score 31-60: Moderate CCM (99487)
                    └──→ Score 61-100: Complex CCM (99487 + 99489)

Service 5: Drug Interaction Checker
    │
    └──→ drugInteractionService.ts
            │
            ├──→ Input: Array of medication codes (RxNorm)
            │
            ├──→ FDB MedKnowledge API call
            │       │
            │       └──→ POST /interactions
            │               Body: {
            │                 "medications": [
            │                   {"rxnorm": "313782"}, // Lisinopril
            │                   {"rxnorm": "855333"}  // Ibuprofen
            │                 ]
            │               }
            │
            └──→ Output:
                    │
                    ├──→ Severity: low, moderate, high, critical
                    ├──→ Description: "May increase bleeding risk"
                    ├──→ Recommendation: "Monitor INR closely"
                    └──→ Therapeutic alternatives: [...]

Service 6: Dashboard Personalization AI
    │
    └──→ dashboardPersonalizationAI.ts
            │
            ├──→ Track user behavior:
            │       │
            │       ├──→ Widget clicks
            │       ├──→ Page views
            │       ├──→ Time of day patterns
            │       └──→ Feature usage frequency
            │
            ├──→ Model: Haiku 4.5 (speed critical)
            │
            ├──→ Analysis:
            │       │
            │       └──→ Predict next likely action
            │               ├──→ "User checks vitals widget at 8am daily"
            │               ├──→ "User plays Trivia on weekends"
            │               └──→ "User ignores meal tracking"
            │
            └──→ Layout Optimization:
                    │
                    └──→ Reorder dashboard widgets:
                            ├──→ Most-used → Top
                            ├──→ Time-relevant → Prioritized
                            └──→ Unused → Hidden or bottom

AI Cost Management:
───────────────────

Total Monthly AI Spend Estimate:
    │
    ├──→ Claude API: $1,200-1,800/month
    │       ├──→ Scribe: $800 (200 sessions/day x 30 days)
    │       ├──→ Coding: $200 (100 claims/day)
    │       ├──→ Guardian: $100 (monitoring)
    │       └──→ Misc: $100 (dashboards, chat)
    │
    └──→ Deepgram: $200-400/month
            └──→ 200 sessions/day x 15 min avg = 90,000 min/month
```

---

## 8. Database Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                  KEY ENTITY RELATIONSHIPS                            │
└──────────────────────────────────────────────────────────────────────┘

auth.users (Supabase Auth)
    │
    ├───────────────────────────────────────┐
    │                                       │
    ▼                                       ▼
profiles                              user_roles
├─ user_id (PK, FK)                   ├─ user_id (PK, FK)
├─ email                              ├─ role (PK)
├─ phone                              └─ department
├─ first_name, last_name
├─ date_of_birth                           │
├─ role (text)                             │
├─ role_code (int)                         │
└─ last_check_in                           ▼
    │                                  roles
    │                                  ├─ id (PK)
    │                                  ├─ role_name
    ├──────────────────────┐           ├─ role_code
    │                      │           └─ description
    ▼                      ▼
check_ins              encounters
├─ id (PK)             ├─ id (PK)
├─ user_id (FK)        ├─ patient_id (FK → profiles.user_id)
├─ mood_score          ├─ provider_id (FK → profiles.user_id)
├─ symptoms (JSONB)    ├─ encounter_type
├─ pain_level          ├─ started_at
├─ sleep_hours         ├─ ended_at
└─ created_at          └─ status
                            │
                            ├────────────────────────────┐
                            │                            │
                            ▼                            ▼
                    scribe_sessions              fhir_observations
                    ├─ id (PK)                   ├─ id (PK)
                    ├─ encounter_id (FK)         ├─ patient_id (FK)
                    ├─ patient_id (FK)           ├─ encounter_id (FK, nullable)
                    ├─ provider_id (FK)          ├─ observation_type
                    ├─ transcription_text        ├─ observation_code (LOINC)
                    ├─ ai_note_subjective        ├─ value_quantity
                    ├─ ai_note_objective         ├─ value_unit
                    ├─ ai_note_assessment        ├─ observation_datetime
                    ├─ ai_note_plan              └─ status
                    ├─ suggested_cpt_codes
                    ├─ suggested_icd10_codes          │
                    └─ recording_duration_seconds     │
                            │                         │
                            ▼                         │
                    billing_claims                    │
                    ├─ id (PK)                        │
                    ├─ encounter_id (FK)              │
                    ├─ patient_id (FK)                │
                    ├─ provider_id (FK)               │
                    ├─ payer_id (FK)                  │
                    ├─ claim_status                   │
                    ├─ total_charges                  │
                    └─ claim_control_number           │
                            │                         │
                            ├────────────┐            │
                            │            │            │
                            ▼            ▼            │
                   claim_line_items  payments        │
                   ├─ id (PK)        ├─ id (PK)      │
                   ├─ claim_id (FK)  ├─ claim_id (FK)│
                   ├─ cpt_code       ├─ amount_paid  │
                   ├─ icd10_codes    ├─ patient_resp │
                   ├─ modifiers      └─ payment_date │
                   ├─ units                           │
                   └─ charge_amount                   │
                                                      │
profiles (patient_id)                                 │
    │                                                 │
    ├───────────────────────────────────────────────┐│
    │                                               ││
    ▼                                               ▼▼
fhir_medication_requests                   fhir_conditions
├─ id (PK)                                 ├─ id (PK)
├─ patient_id (FK)                         ├─ patient_id (FK)
├─ medication_code (RxNorm)                ├─ condition_code (SNOMED)
├─ medication_display                      ├─ clinical_status
├─ status (active, stopped)                ├─ verification_status
├─ intent (order, plan)                    ├─ onset_datetime
├─ dosage_text                             ├─ abatement_datetime
├─ prescriber_id (FK → fhir_practitioners) └─ severity
└─ authored_on
    │
    │
profiles (patient_id)
    │
    ├─────────────────────────────────────┐
    │                                     │
    ▼                                     ▼
allergy_intolerances               fhir_immunizations
├─ id (PK)                         ├─ id (PK)
├─ patient_id (FK)                 ├─ patient_id (FK)
├─ allergy_type                    ├─ vaccine_code (CVX)
├─ substance_code                  ├─ status (completed)
├─ clinical_status                 ├─ occurrence_datetime
├─ verification_status             ├─ lot_number
├─ criticality                     └─ performer_id (FK)
└─ reaction (JSONB array)

profiles (patient_id)
    │
    ├─────────────────────────────────────┐
    │                                     │
    ▼                                     ▼
fhir_care_plans                    fhir_care_teams
├─ id (PK)                         ├─ id (PK)
├─ patient_id (FK)                 ├─ patient_id (FK)
├─ status (active, completed)      ├─ name
├─ intent (plan, order)            ├─ status (active, inactive)
├─ title                           ├─ category (JSONB)
├─ description                     └─ members (JSONB array)
├─ period_start                        ├─ role_code
├─ period_end                          ├─ member_user_id (FK)
├─ care_team_id (FK)                   └─ is_primary_contact
├─ addresses (JSONB)
├─ goals (JSONB)
└─ activities (JSONB)

FHIR Interoperability Tables:

fhir_connections
├─ id (PK)
├─ name (e.g., "Epic FHIR")
├─ fhir_server_url
├─ ehr_system (EPIC, CERNER)
├─ access_token
├─ token_expiry
└─ sync_frequency
    │
    ├───────────────────────────┐
    │                           │
    ▼                           ▼
fhir_patient_mappings    fhir_sync_logs
├─ id (PK)               ├─ id (PK)
├─ community_user_id (FK)├─ connection_id (FK)
├─ fhir_patient_id       ├─ sync_type
├─ connection_id (FK)    ├─ direction (inbound/outbound)
└─ sync_status           ├─ status (success/error)
                         ├─ records_processed
                         └─ errors (JSONB)

Telehealth Tables:

telehealth_appointments
├─ id (PK)
├─ patient_id (FK)
├─ provider_id (FK)
├─ scheduled_start
├─ scheduled_end
├─ daily_room_url (Daily.co)
├─ room_name
├─ status (scheduled, in-progress, completed)
└─ encounter_id (FK, created on join)

Care Coordination Tables:

handoff_packets
├─ id (PK)
├─ patient_id (FK)
├─ sending_facility
├─ receiving_facility
├─ packet_data (JSONB)
│   ├─ demographics
│   ├─ medications
│   ├─ allergies
│   ├─ vitals
│   ├─ problem_list
│   └─ care_team
├─ transmission_method
└─ created_at

readmission_tracking
├─ id (PK)
├─ patient_id (FK)
├─ initial_discharge_date
├─ readmission_date
├─ days_between (calculated)
├─ readmission_diagnosis
├─ was_preventable (Boolean)
└─ risk_score (1-100)

Audit & Security Tables:

audit_logs
├─ id (PK)
├─ event_type
├─ event_category (PHI_ACCESS, AUTH, etc.)
├─ actor_user_id (FK)
├─ actor_ip_address
├─ operation
├─ resource_type
├─ success (Boolean)
├─ error_message
└─ metadata (JSONB)

login_attempts
├─ id (PK)
├─ user_id (FK, nullable)
├─ identifier (email/phone)
├─ attempt_type (password, pin, mfa)
├─ success (Boolean)
├─ ip_address
└─ created_at

account_lockouts
├─ id (PK)
├─ user_id (FK)
├─ identifier
├─ lockout_type (rate_limit, manual)
├─ locked_at
├─ locked_until
└─ unlocked_at
```

---

## 9. Security & Compliance Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│                 SECURITY ARCHITECTURE (Defense in Depth)             │
└──────────────────────────────────────────────────────────────────────┘

Layer 1: Network & Transport Security
──────────────────────────────────────

HTTPS Enforcement
    │
    ├──→ All traffic: TLS 1.3
    ├──→ HSTS enabled (max-age=31536000; includeSubDomains)
    └──→ Certificate: Vercel automatic SSL

Content Security Policy (CSP)
    │
    └──→ Headers:
            default-src 'self';
            script-src 'self' 'unsafe-inline' https://hcaptcha.com;
            style-src 'self' 'unsafe-inline';
            img-src 'self' data: https:;
            connect-src 'self' https://*.supabase.co https://api.deepgram.com;
            frame-ancestors 'none';

CORS Policy
    │
    └──→ Strict allowlist:
            ├──→ https://wellfit.com
            ├──→ https://*.vercel.app
            └──→ GitHub Codespaces (dynamic)


Layer 2: Authentication & Authorization
────────────────────────────────────────

Multi-Factor Authentication
    │
    ├──→ Email/Password + SMS OTP
    ├──→ WebAuthn/Passkey (biometric)
    └──→ Admin PIN (secondary verification)

Session Security
    │
    ├──→ JWT tokens (short-lived: 8 hours)
    ├──→ Refresh tokens (HttpOnly cookie, 30 days max)
    ├──→ Admin tokens (memory-only, 2 hours)
    └──→ Activity-based timeout with cross-tab sync

Rate Limiting
    │
    ├──→ Login attempts: 5 in 15 minutes
    ├──→ API calls: 60/minute per user
    └──→ AI requests: Cost-based limits ($50/day, $500/month)

Row-Level Security (RLS)
    │
    └──→ PostgreSQL policies on every table:
            ├──→ auth.uid() context enforcement
            ├──→ Role-based access (RBAC)
            └──→ Department-scoped data access


Layer 3: Data Encryption
─────────────────────────

Encryption at Rest
    │
    ├──→ Database: AES-256-GCM (Supabase managed)
    ├──→ PHI fields: Additional AES-256-GCM layer
    │       │
    │       └──→ Algorithm:
    │               ├──→ Master key: REACT_APP_ENCRYPTION_KEY (base64, 32 bytes)
    │               ├──→ Patient-specific key derivation: PBKDF2(master_key + patient_id)
    │               ├──→ IV: Random 12 bytes per encryption
    │               └──→ Encrypted format: {iv}:{ciphertext}:{authTag}
    │
    └──→ File storage: Supabase Storage encryption (AES-256)

Encryption in Transit
    │
    └──→ TLS 1.3 for all network traffic

PHI Field Encryption
    │
    └──→ Fields encrypted (50+ total):
            ├──→ profiles: email, phone, ssn, address, emergency_contact
            ├──→ check_ins: symptoms, notes
            ├──→ scribe_sessions: transcription_text, ai_notes
            ├──→ encounters: chief_complaint, notes
            └──→ All FHIR resources: sensitive clinical data


Layer 4: Data Access Controls
──────────────────────────────

Principle of Least Privilege
    │
    ├──→ Service role: Only for Edge Functions
    ├──→ Anon key: Public client access (RLS enforced)
    └──→ Role-specific access scopes

Audit Logging (HIPAA §164.312(b))
    │
    └──→ All PHI access logged:
            ├──→ Who accessed (user_id)
            ├──→ What data (resource_type, resource_id)
            ├──→ When (timestamp with timezone)
            ├──→ Where (IP address)
            ├──→ How (operation: SELECT, INSERT, UPDATE, DELETE)
            ├──→ Why (metadata: context)
            └──→ Retention: 7 years (HIPAA requirement)

Data Minimization
    │
    └──→ AI services:
            ├──→ Aggressive de-identification before Claude API
            ├──→ Only necessary fields sent
            └──→ Response does not contain PHI


Layer 5: Application Security
──────────────────────────────

Input Validation
    │
    ├──→ Yup schemas for forms
    ├──→ Zod schemas for API requests
    └──→ DOMPurify for HTML sanitization

SQL Injection Prevention
    │
    └──→ Supabase client: Parameterized queries only
            (No raw SQL from client)

XSS Prevention
    │
    ├──→ React auto-escaping
    ├──→ DOMPurify for user-generated content
    └──→ CSP headers block inline scripts

CSRF Prevention
    │
    ├──→ SameSite cookies (Strict)
    └──→ State parameter validation (OAuth flows)

Bot Protection
    │
    └──→ hCaptcha on registration and high-value forms


Layer 6: Operational Security
──────────────────────────────

Backup & Disaster Recovery
    │
    ├──→ Supabase: Daily automated backups
    ├──→ Point-in-time recovery: Up to 7 days
    ├──→ Backup verification: Automated weekly drills
    └──→ RTO: < 4 hours, RPO: < 1 hour

Monitoring & Alerting
    │
    ├──→ Real-time security dashboard
    ├──→ MTTD (Mean Time To Detect): < 1 minute
    ├──→ MTTR (Mean Time To Respond): < 15 minutes
    └──→ Anomaly detection: Guardian Agent monitoring

Penetration Testing
    │
    ├──→ Daily automated scans (7 tests)
    ├──→ Module-specific tests (12 tests)
    └──→ Reports: security-reports/daily/

Incident Response Plan
    │
    ├──→ Detection → Containment → Investigation → Remediation → Notification
    ├──→ Data breach notification: Automated 4-factor risk assessment
    └──→ HIPAA breach notification: < 60 days if required


Layer 7: Compliance Controls (SOC2 + HIPAA)
───────────────────────────────────────────

SOC2 Trust Service Criteria (10/10 implemented)
    │
    ├──→ CC1: Control Environment (RBAC, policies)
    ├──→ CC2: Communication (audit logs, dashboards)
    ├──→ CC3: Risk Assessment (Guardian Agent, pen testing)
    ├──→ CC4: Monitoring (real-time alerts)
    ├──→ CC5: Control Activities (RLS, encryption)
    ├──→ CC6: Logical Access (MFA, session timeouts)
    ├──→ CC7: System Operations (backup, DR)
    ├──→ A1: Availability (99.9% uptime SLA)
    ├──→ C1: Confidentiality (PHI encryption)
    └──→ P1: Privacy (GDPR-compliant data deletion)

HIPAA Compliance
    │
    ├──→ Technical Safeguards (§164.312)
    │       ├──→ Access controls (RLS, RBAC)
    │       ├──→ Audit controls (comprehensive logging)
    │       ├──→ Integrity controls (checksums, versioning)
    │       └──→ Transmission security (TLS 1.3)
    │
    ├──→ Physical Safeguards (§164.310)
    │       └──→ Cloud provider responsibility (Supabase SOC2 certified)
    │
    ├──→ Administrative Safeguards (§164.308)
    │       ├──→ Security management process
    │       ├──→ Assigned security responsibility
    │       ├──→ Workforce training (documented)
    │       └──→ Contingency planning (DR plan)
    │
    └──→ Breach Notification Rule (§164.404-414)
            ├──→ Automated detection
            ├──→ 4-factor risk assessment
            ├──→ Notification within 60 days
            └──→ HHS reporting (if ≥500 individuals affected)
```

---

## 10. Deployment Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                  PRODUCTION DEPLOYMENT TOPOLOGY                      │
└──────────────────────────────────────────────────────────────────────┘

Users (Browsers, Mobile Apps)
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CDN Layer (Vercel Edge Network)              │
│  • Global edge caching (300+ locations)                         │
│  • Static assets (JS, CSS, images)                              │
│  • DDoS protection                                              │
│  • Automatic compression (Brotli, gzip)                         │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Application Layer (Vercel)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React SPA (Static Site Generation)                      │  │
│  │  • Build: react-scripts build                            │  │
│  │  • Output: Static HTML/JS/CSS                            │  │
│  │  • Service Worker: Offline support (PWA)                 │  │
│  │  • IndexedDB: Client-side caching                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Vercel Serverless Functions (api/ directory)            │  │
│  │  • Runtime: Node.js 20.x                                 │  │
│  │  • Cold start: <500ms                                    │  │
│  │  • Max duration: 10 seconds (Hobby), 60s (Pro)           │  │
│  │  • Auto-scaling: Unlimited concurrent executions         │  │
│  │  • Functions:                                            │  │
│  │    ├─ /api/auth/login.ts                                 │  │
│  │    ├─ /api/auth/logout.ts                                │  │
│  │    ├─ /api/email/send.ts                                 │  │
│  │    ├─ /api/sms/send.ts                                   │  │
│  │    └─ /api/anthropic-chats.ts                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│              Backend Services Layer (Supabase)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database (AWS RDS)                           │  │
│  │  • Version: PostgreSQL 15.x                              │  │
│  │  • Region: us-west-1 (primary)                           │  │
│  │  • Connection pooler: PgBouncer (6543)                   │  │
│  │  • Direct connection: 5432                               │  │
│  │  • Storage: 8 GB (expandable to 50 GB on free tier)      │  │
│  │  • Encryption: AES-256-GCM at rest                       │  │
│  │  • Backups: Daily snapshots (7-day retention)            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Supabase Auth                                           │  │
│  │  • JWT tokens (HS256)                                    │  │
│  │  • Session management                                    │  │
│  │  • OAuth providers (future: Google, Apple)              │  │
│  │  • MFA support (TOTP, SMS)                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Supabase Storage                                        │  │
│  │  • Object storage (S3-compatible)                        │  │
│  │  • Buckets: documents, images, audio                     │  │
│  │  • Max file size: 50 MB (default)                        │  │
│  │  • Access control: RLS policies                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Supabase Edge Functions (Deno Runtime)                  │  │
│  │  • Runtime: Deno 1.x                                     │  │
│  │  • Regions: Multi-region deployment                      │  │
│  │  • Cold start: <100ms (Deno isolates)                    │  │
│  │  • Max duration: 2 minutes (longer than Vercel)          │  │
│  │  • Deployed functions: 60+                               │  │
│  │  • Key functions:                                        │  │
│  │    ├─ register (user signup)                             │  │
│  │    ├─ verify-admin-pin (admin auth)                      │  │
│  │    ├─ realtime_medical_transcription (SMART Scribe)      │  │
│  │    ├─ guardian-agent-api (autonomous healing)            │  │
│  │    ├─ generate-837p (claims generation)                  │  │
│  │    └─ enhanced-fhir-export (EHR sync)                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Supabase Realtime                                       │  │
│  │  • WebSocket connections                                 │  │
│  │  • Database change subscriptions                         │  │
│  │  • Broadcast messages                                    │  │
│  │  • Presence tracking                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                 External Services Layer                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  Anthropic       │  │  Deepgram        │  │  Twilio      │ │
│  │  Claude API      │  │  Transcription   │  │  SMS/Voice   │ │
│  │  ──────────────  │  │  ──────────────  │  │  ──────────  │ │
│  │  • Sonnet 4.5    │  │  • nova-2-medical│  │  • SMS send  │ │
│  │  • Haiku 4.5     │  │  • WebSocket     │  │  • Verify    │ │
│  │  • Rate limits   │  │  • Real-time     │  │  • Voice     │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  MailerSend      │  │  Daily.co        │  │  hCaptcha    │ │
│  │  Email Delivery  │  │  Video (HIPAA)   │  │  Bot Protect │ │
│  │  ──────────────  │  │  ──────────────  │  │  ──────────  │ │
│  │  • Transactional │  │  • Telehealth    │  │  • Site key  │ │
│  │  • Templates     │  │  • Room creation │  │  • Verify    │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │  Epic FHIR R4    │  │  Change          │                   │
│  │  EHR Integration │  │  Healthcare      │                   │
│  │  ──────────────  │  │  Clearinghouse   │                   │
│  │  • OAuth2        │  │  ──────────────  │                   │
│  │  • SMART launch  │  │  • 837P submit   │                   │
│  │  • Patient data  │  │  • 835 ERA       │                   │
│  └──────────────────┘  └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘


Deployment Process:
───────────────────

1. Code Push → GitHub
    │
    └──→ GitHub Actions workflow
            ├──→ Lint: npm run lint
            ├──→ Typecheck: npm run typecheck
            ├──→ Tests: npm test
            └──→ Build: npm run build

2. Vercel Auto-Deploy (on main branch)
    │
    ├──→ Build static site
    ├──→ Deploy to CDN
    ├──→ Deploy serverless functions
    └──→ Live URL: https://wellfit-community-daily.vercel.app

3. Supabase Edge Functions Deploy
    │
    └──→ Manual deployment:
            npx supabase functions deploy {function-name}
            (or CI/CD pipeline for production)

4. Database Migrations
    │
    └──→ Apply via direct SQL execution:
            PGPASSWORD="..." psql -h ... -f migration.sql


Environment Configuration:
──────────────────────────

Development (.env.local):
    REACT_APP_SUPABASE_URL=http://localhost:54321
    REACT_APP_SUPABASE_ANON_KEY=local-anon-key
    (All other services: sandbox/test keys)

Production (Vercel Environment Variables):
    REACT_APP_SUPABASE_URL=https://xkybsjnvuohpqpbkikyn.supabase.co
    REACT_APP_SUPABASE_ANON_KEY=production-anon-key
    REACT_APP_ANTHROPIC_API_KEY=production-key
    (All services: production keys)


High Availability & Scaling:
────────────────────────────

Frontend (Vercel):
    ├──→ Auto-scaling: Unlimited
    ├──→ Geographic distribution: Global CDN
    └──→ Uptime SLA: 99.99%

Backend (Supabase):
    ├──→ Database: Vertical scaling (upgrade tier)
    ├──→ Connection pooling: PgBouncer (handles 1000+ concurrent)
    ├──→ Read replicas: Available on Pro tier
    └──→ Uptime SLA: 99.9%

Disaster Recovery:
    ├──→ RTO (Recovery Time Objective): < 4 hours
    ├──→ RPO (Recovery Point Objective): < 1 hour
    └──→ Backup strategy: Daily automated + on-demand manual
```

---

## Summary Statistics

**System Architecture Metrics:**

| Metric | Value |
|--------|-------|
| Total Components | 150+ features across 9 categories |
| Frontend Pages | 49 pages |
| React Components | 100+ components |
| Vercel API Endpoints | 11 serverless functions |
| Supabase Edge Functions | 60+ Deno functions |
| Database Tables | 50+ tables |
| FHIR Resources | 23 resources (13 US Core compliant) |
| External Services | 11 integrations |
| Security Controls | 24/24 implemented (HIPAA + SOC2) |
| RLS Policies | 100+ policies |
| API Rate Limits | 3 tiers (login, API, AI) |
| Deployment Targets | Vercel (frontend) + Supabase (backend) |

**Technology Stack:**

- **Frontend:** React 18.3, TypeScript 4.9, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Edge Functions, Auth, Storage, Realtime)
- **Serverless:** Vercel Functions (Node.js 20.x) + Supabase Edge Functions (Deno)
- **AI/ML:** Anthropic Claude (Sonnet 4.5, Haiku 4.5), Deepgram (nova-2-medical)
- **Communication:** Twilio (SMS), MailerSend (Email), Daily.co (Video)
- **Integration:** FHIR R4, Epic, Cerner, Change Healthcare

---

**Document Version:** 1.0
**Last Updated:** November 4, 2025
**Maintained By:** Systems Documentation Team
