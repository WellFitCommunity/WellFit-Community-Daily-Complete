# Epic App Orchard Application - Step-by-Step Guide

## Overview

This guide walks you through EXACTLY how to complete your Epic App Orchard application, screen by screen, field by field.

**Positioning:** Community-facing patient engagement app for senior wellness and law enforcement welfare checks

**What Epic Should See:** Simple app that pulls patient demographics for enrollment in "Are You OK?" programs

**What Epic Should NOT See:** Comprehensive FHIR R4 EHR integration with all clinical resources

---

## Before You Start

### Required Information

Have these ready before starting:

1. **Business Information:**
   - Business name: Envision VirtualEdge Group LLC
   - Business address: [Your valid business address - no PO Box]
   - Business phone: [Your phone number]
   - Business email: maria@thewellfitcommunity.org
   - Website: https://thewellfitcommunity.org
   - Tax ID / EIN: [Your EIN]

2. **App Information:**
   - App name: WellFit Community - Senior Wellness & Welfare Check Platform
   - App category: Patient Engagement, Community Health
   - Target users: Seniors, family caregivers, law enforcement constables

3. **Technical Information:**
   - Development redirect URI: http://localhost:3000/auth/epic/callback
   - Production redirect URI: https://app.thewellfitcommunity.org/auth/epic/callback
   - FHIR version: R4
   - Scopes needed: patient/Patient.read, patient/RelatedPerson.read

4. **Partner Information:**
   - Partner hospital/health system name: [Name of local hospital using Epic]
   - Constable office / law enforcement agency: [Name and county/precinct]
   - Contact person at hospital: [Name, title, email]

5. **Documentation (have these URLs ready):**
   - Privacy policy: https://thewellfitcommunity.org/privacy
   - Terms of service: https://thewellfitcommunity.org/terms
   - Security documentation: [PDF file ready to upload]
   - App screenshots: [5 PNG files, 1920x1080, de-identified data]
   - App logo: [512x512 PNG with transparent background]

---

## STEP 1: Create Epic App Orchard Account (15 minutes)

### 1.1 Go to Epic App Orchard
- URL: https://apporchard.epic.com/
- Click **"Sign Up"** in top right corner

### 1.2 Create Your Account
**Email Address:**
```
maria@thewellfitcommunity.org
```
(Use your business email - avoid Gmail/Yahoo)

**Password:**
- Minimum 8 characters
- Include uppercase, lowercase, number, special character
- Example: `WellFit2025!`

**First Name:**
```
Maria
```
(Or your preferred name)

**Last Name:**
```
[Your Last Name]
```

**Phone Number:**
```
[Your mobile phone with area code]
```

Click **"Create Account"**

### 1.3 Verify Email
- Check your email inbox
- Click verification link in Epic email
- Return to App Orchard

---

## STEP 2: Complete Organization Profile (20 minutes)

After email verification, you'll be prompted to complete your organization profile.

### 2.1 Organization Details

**Organization Name:**
```
Envision VirtualEdge Group LLC
```

**Organization Type:**
```
Healthcare Technology Vendor
```

**Business Address:**
```
[Your Street Address]
[City], [State] [ZIP]
United States
```
**IMPORTANT:** Must be a valid business address. PO Boxes may be rejected.

**Mailing Address (if different):**
```
[Leave blank or same as business address]
```

**Organization Phone:**
```
[Your business phone number]
```

**Organization Email:**
```
maria@thewellfitcommunity.org
```

**Website:**
```
https://thewellfitcommunity.org
```

**Tax ID / EIN:**
```
[Your EIN - format: 12-3456789]
```

### 2.2 Organization Description

**Company Description** (COPY THIS - 500 characters max):
```
Envision VirtualEdge Group develops patient engagement solutions for community
health and public safety. Our WellFit Community platform helps law enforcement
constables coordinate "Are You OK?" wellness check programs for seniors living
at home. We integrate with Epic to pull patient demographics for enrollment,
enabling safer and more effective emergency welfare checks. We serve seniors,
family caregivers, and law enforcement - not clinical providers.
```

**Year Founded:**
```
[Your company founding year - e.g., 2023]
```

**Number of Employees:**
```
1-10
```
(Or accurate number)

**Primary Business:**
```
Patient Engagement & Community Health Software
```

**Target Market:**
```
Law enforcement agencies, constable offices, senior services programs,
family caregivers, seniors aging at home
```

Click **"Save Organization Profile"**

---

## STEP 3: Create Your App Profile (30 minutes)

### 3.1 Start New App

- From your App Orchard dashboard, click **"My Apps"**
- Click **"Create New App"**

### 3.2 Basic App Information

**App Name:**
```
WellFit Community - Senior Wellness & Welfare Check Platform
```

**App Short Name** (20 characters max):
```
WellFit Community
```

**App Tagline** (80 characters max):
```
Daily wellness check-ins and emergency welfare checks for seniors living at home
```

**App Type:**
- ☑ **Web Application (Server-Side)**
- ☑ **Patient-Facing Mobile App**
- ☐ Provider-Facing Tool (DO NOT CHECK)
- ☐ Embedded EHR App (DO NOT CHECK)

**Primary Category:**
```
Patient Engagement
```

**Additional Categories** (select up to 4):
- ☑ Remote Patient Monitoring
- ☑ Social Determinants of Health (SDOH)
- ☑ Care Coordination
- ☑ Community Health

**DO NOT SELECT:**
- ☐ Clinical Documentation
- ☐ EHR Integration
- ☐ Population Health Management
- ☐ Provider Tools

**FHIR Version:**
```
R4
```

**App Status:**
```
In Development
```

Click **"Save and Continue"**

### 3.3 App Description (CRITICAL SECTION)

This is the MOST IMPORTANT part of your application. Epic reviewers read this carefully.

**App Description** (2000-4000 characters):

```markdown
WellFit Community is a patient-facing mobile and web application that helps seniors
stay safe at home through daily "Are You OK?" wellness check-ins, while enabling
law enforcement constables to perform more effective emergency welfare checks.

THE PROBLEM:
Many seniors live alone and are at risk of falls, medical emergencies, or incidents
where they cannot call for help. Law enforcement agencies run "Are You OK?" programs
to check on seniors, but frequent in-person welfare checks strain resources and may
miss time-sensitive emergencies.

OUR SOLUTION:
WellFit Community provides three simple tools:

1. DAILY WELLNESS CHECK-INS (Patient-Facing):
Seniors receive a daily "Are you OK?" notification via text message or mobile app.
They respond with one tap to confirm they're safe. Family members can monitor
check-in status. If a senior misses their check-in, the system escalates to
emergency contacts, then to constables if needed.

2. EMERGENCY WELFARE CHECKS (Law Enforcement):
When seniors don't respond for 2-6 hours (configurable by risk level), constables
receive dispatch alerts containing critical safety information: mobility status
(bed-bound, wheelchair user), medical equipment (oxygen, dialysis), communication
needs (hearing impaired, cognitive impairment), emergency access instructions
(key location, door codes), pet information, and emergency contacts.

3. FAMILY CAREGIVER PORTAL:
Family members update senior emergency information, view daily check-in history,
receive alerts for missed check-ins, and maintain medications, mobility status,
and emergency contacts.

EPIC INTEGRATION (READ-ONLY, LIMITED SCOPE):
WellFit Community connects to Epic ONLY to pull patient demographics (name, date
of birth, address, phone number) when seniors enroll in "Are You OK?" programs.
This ensures constables have accurate addresses for emergency welfare checks and
eliminates manual data entry errors.

We request only two FHIR scopes:
- patient/Patient.read (demographics for enrollment)
- patient/RelatedPerson.read (emergency contacts)

WE DO NOT:
- Write any data back to Epic
- Read clinical notes, lab results, or diagnostic reports
- Access billing or insurance information
- Synchronize care plans or treatment information
- Provide clinical documentation tools

POSITIONING:
This is NOT an EHR, clinical documentation system, or provider tool. WellFit Community
is a public safety and family caregiver platform. Epic remains the system of record
for all clinical care. We serve law enforcement officers and family caregivers, not
clinicians.

TARGET USERS:
- Seniors living at home (age 65+)
- Family caregivers and emergency contacts
- Law enforcement constables and officers
- Community health workers and social workers

DIFFERENTIATION FROM MYCHART:
MyChart provides medical records access and patient-provider communication. WellFit
Community provides daily wellness check-ins and emergency welfare check coordination
with law enforcement. Many seniors use BOTH - they serve completely different purposes.

COMPLIANCE:
HIPAA compliant with full encryption, role-based access control, audit logging, and
BAA execution with healthcare organizations. SOC 2 Type II certification in progress.
```

Click **"Save and Continue"**

### 3.4 App Screenshots

Upload 5 screenshots (1920x1080 PNG, de-identified data ONLY):

**Screenshot 1: Senior Mobile App - Daily Check-In**
- Title: "Daily Wellness Check-In"
- Shows: Large "I'm OK!" button, simple interface for seniors
- Use test patient name: "John Smith" (NOT real patient)

**Screenshot 2: Family Caregiver Portal - Emergency Info Form**
- Title: "Emergency Response Information"
- Shows: Form fields for mobility status, medical equipment, emergency access
- Use test data: synthetic patient information only

**Screenshot 3: Constable Dispatch Dashboard - Welfare Check Queue**
- Title: "Welfare Check Alerts"
- Shows: List of seniors with missed check-ins, sorted by urgency
- Use 3-5 test patients with synthetic names and addresses

**Screenshot 4: Constable Detail View - Emergency Response Panel**
- Title: "Welfare Check Dispatch Information"
- Shows: Senior demographics, mobility status, medical equipment, access instructions
- Use test patient: "Jane Doe, 82 years old" (synthetic data)

**Screenshot 5: Check-In History Calendar**
- Title: "Wellness Check-In History"
- Shows: Calendar view with green checkmarks for completed check-ins, red X for missed
- Use test patient data across 30-day period

**CRITICAL:** All screenshots must use test/synthetic data. Epic will reject if real patient information is visible.

### 3.5 App Logo

Upload app logo (512x512 PNG, transparent background):
- Professional, clean design
- Blue/green color scheme (trust, health, safety)
- Simple enough for seniors to recognize
- Include "WellFit Community" text or recognizable icon

---

## STEP 4: Configure OAuth / SMART on FHIR (20 minutes)

### 4.1 SMART on FHIR Settings

**Launch Type:**
- ☑ **Standalone Launch** (user initiates from WellFit app)
- ☐ EHR Launch (DO NOT SELECT - we're not embedded in Epic)

**Supports SMART on FHIR:**
```
Yes
```

**PKCE Required:**
```
Yes (Epic requires PKCE for all apps)
```

**Token Endpoint Authentication Method:**
```
client_secret_post
```

### 4.2 Redirect URIs

Add these EXACT redirect URIs:

**Development:**
```
http://localhost:3000/auth/epic/callback
```

**Staging (if applicable):**
```
https://staging.thewellfitcommunity.org/auth/epic/callback
```

**Production:**
```
https://app.thewellfitcommunity.org/auth/epic/callback
https://thewellfitcommunity.org/auth/epic/callback
```

Click **"Add Redirect URI"** for each

**IMPORTANT:** Production URIs MUST use HTTPS. No HTTP allowed except localhost.

### 4.3 FHIR Scopes

**Select ONLY these scopes:**

**Patient-Level Scopes:**
- ☑ `launch/patient`
- ☑ `patient/Patient.read`
- ☑ `patient/RelatedPerson.read`
- ☑ `offline_access`

**DO NOT SELECT:**
- ☐ patient/Observation.read
- ☐ patient/Condition.read
- ☐ patient/MedicationRequest.read
- ☐ patient/AllergyIntolerance.read
- ☐ patient/Immunization.read
- ☐ patient/Procedure.read
- ☐ patient/Encounter.read
- ☐ patient/CarePlan.read
- ☐ patient/CareTeam.read
- ☐ Any write scopes (*.write)

**System-Level Scopes (OPTIONAL - only if batch enrollment needed):**
- ☐ `system/Patient.read` (check ONLY if absolutely necessary for batch enrollment)

### 4.4 Scope Justifications

For each selected scope, provide justification:

**launch/patient:**
```
Required for SMART on FHIR launch flow when patient authenticates.
```

**patient/Patient.read:**
```
Required to pull patient demographics (name, date of birth, address, phone number)
when seniors enroll in constable-run "Are You OK?" programs. Ensures accurate
patient identification and correct address for emergency welfare checks. Demographics
synced weekly to keep contact information current.
```

**patient/RelatedPerson.read:**
```
Pre-populates emergency contact forms with family members already listed in Epic,
saving enrollment time and ensuring consistency. Family caregivers can edit/add
contacts in WellFit Community as needed.
```

**offline_access:**
```
Allows token refresh for ongoing demographics sync without requiring patient to
re-authenticate weekly. Demographics are synced to detect address changes.
```

**system/Patient.read (if requested):**
```
Enables constable offices to enroll multiple seniors in batch (e.g., 50 seniors at
a community health fair) without requiring each senior to individually authenticate.
Pre-authorized by healthcare organization via BAA. Used only for initial enrollment.
```

Click **"Save OAuth Configuration"**

---

## STEP 5: Upload Required Documentation (45 minutes)

### 5.1 Privacy Policy

**Upload or Link:**
```
https://thewellfitcommunity.org/privacy
```

**Key Points Epic Will Look For:**
- What data is collected (demographics from Epic + emergency info from family)
- How it's used (wellness check-ins, constable welfare checks)
- Who it's shared with (constables, family caregivers - NOT third parties)
- How patients can access/delete data
- HIPAA compliance statement
- Epic data handling: "We pull demographics only, read-only, no clinical data"

**If Not Created Yet:**
1. Go to Section 6 of this guide for privacy policy template
2. Publish at https://thewellfitcommunity.org/privacy
3. Return here and paste URL

### 5.2 Terms of Service

**Upload or Link:**
```
https://thewellfitcommunity.org/terms
```

**Key Points Epic Will Look For:**
- User responsibilities (respond to check-ins, keep info current)
- Epic data restrictions (demographics only)
- Prohibited uses (no data resale, no third-party sharing)
- Termination rights

**If Not Created Yet:**
1. Go to Section 7 of this guide for terms template
2. Publish at https://thewellfitcommunity.org/terms
3. Return here and paste URL

### 5.3 Security Documentation (PDF Upload)

**File Name:**
```
WellFit_Community_Security_Documentation.pdf
```

**Required Content (3-5 pages):**

**Page 1: Overview**
- App name and purpose
- Security compliance summary (HIPAA, SOC 2)
- Epic integration scope (read-only demographics)

**Page 2: Data Protection**
- Encryption at rest: AES-256
- Encryption in transit: TLS 1.3
- Epic FHIR credentials: Encrypted in Supabase Vault
- Access tokens: Rotated every 60 minutes
- Database: PostgreSQL with Row-Level Security (RLS)
- No PHI in client-side storage (localStorage, cookies)

**Page 3: Access Controls**
- Authentication: Email/password for patients, MFA required for law enforcement
- Role-based access control (RBAC): Family sees only their senior, constables see only their jurisdiction
- Session timeout: 15 minutes idle for constable users, 7 days for patient/family
- Failed login lockout: 5 attempts, 30-minute lockout

**Page 4: Audit Logging & Monitoring**
- All Epic API calls logged: timestamp, user, patient ID, data accessed
- All emergency response info views logged
- All welfare check dispatches logged
- Logs retained 7 years for HIPAA compliance
- Real-time anomaly detection for unusual access patterns
- Quarterly security audits

**Page 5: Incident Response & Business Continuity**
- Incident response team: 24/7 on-call rotation
- Breach notification: Epic contacted within 24 hours, affected patients within 60 days
- Data backup: Daily encrypted backups, 90-day retention
- Disaster recovery: 4-hour RTO, 1-hour RPO
- Epic credential revocation: Immediate upon security incident

**Use Template in Section 8 of this guide**

**Click "Upload PDF"** and select your file

### 5.4 Business Associate Agreement (BAA)

Epic will provide their standard BAA template after initial app approval.

**For now:**
- ☑ Check box: "I agree to execute Epic's standard BAA"
- ☑ Check box: "I have legal counsel who will review Epic's BAA"

**Note:** You'll review and sign Epic's BAA during certification, not now.

Click **"Save Documentation"**

---

## STEP 6: Partner Information (15 minutes)

This section GREATLY increases approval chances. Epic prefers apps with healthcare organization partners.

### 6.1 Partner Healthcare Organization

**Partner Name:**
```
[Name of hospital or health system using Epic in your target area]
Example: Methodist Hospital System
```

**Partner Relationship:**
```
Healthcare Partner - Providing Epic patient demographics for "Are You OK?" program
```

**Partner Contact:**
```
Name: [Name of contact person at hospital]
Title: [e.g., VP of Community Health, CMIO, Director of Population Health]
Email: [Contact's email]
Phone: [Contact's phone]
```

**Letter of Support:**
- ☑ Check box: "Partner organization has provided letter of support"
- Upload letter (see Section 9 for template)

### 6.2 Law Enforcement Partner

**Partner Name:**
```
[Name of constable office or law enforcement agency]
Example: Harris County Precinct 3 Constable Office
```

**Partner Relationship:**
```
Public Safety Partner - Using WellFit Community for senior welfare check program
```

**Partner Contact:**
```
Name: [Name of constable or program coordinator]
Title: [e.g., Constable, Community Services Coordinator]
Email: [Contact's email]
Phone: [Contact's phone]
```

Click **"Save Partner Information"**

---

## STEP 7: Security Questionnaire (20 minutes)

Epic will present a security questionnaire. Common questions:

### Q1: Where is patient data stored?
**Answer:**
```
Patient data is stored in Supabase PostgreSQL database hosted on AWS US-East-1.
Data is encrypted at rest using AES-256 and in transit using TLS 1.3. Database
backups are encrypted and retained for 90 days. Supabase is HIPAA-eligible and
we have executed their BAA.
```

### Q2: How do you handle Epic FHIR credentials?
**Answer:**
```
Client secrets are stored in Supabase Vault with encryption key management. Access
tokens are encrypted in the database and rotated every 60 minutes. Refresh tokens
are encrypted and rotated per Epic's expiration policy. Only authorized backend
services can decrypt credentials - they are never sent to client browsers.
```

### Q3: Who has access to Epic data?
**Answer:**
```
Access is role-based and logged:
- Seniors: View only their own check-in history
- Family caregivers: View/edit only their designated senior's emergency info
- Law enforcement constables: View emergency info for seniors in their jurisdiction only
- Administrators: No patient data access (configuration only)
- Developers: No production data access (de-identified sandbox only)

All access is logged with user ID, timestamp, patient ID, and data accessed.
```

### Q4: Do you write data back to Epic?
**Answer:**
```
No. WellFit Community is read-only. We pull patient demographics for enrollment
purposes only. Wellness check-in data, emergency response information, and welfare
check reports stay in WellFit Community and are NOT written to Epic. If clinical
findings are discovered during welfare checks, constables communicate verbally to
EMS or providers who document in Epic.
```

### Q5: How do you ensure HIPAA compliance?
**Answer:**
```
- Business Associate Agreement with Epic and healthcare organizations
- Annual HIPAA training for all team members
- Minimum necessary access principle enforced via RBAC
- Encryption: AES-256 at rest, TLS 1.3 in transit
- Audit logging of all PHI access (7-year retention)
- Annual security risk assessments
- Incident response plan with 60-day breach notification
- No use or disclosure of PHI beyond stated purposes
```

### Q6: What happens if WellFit Community shuts down?
**Answer:**
```
Our BAA includes data return provisions:
1. Provide healthcare organizations with data export in standard format
2. Securely delete all patient data within 30 days of service termination
3. Provide certificate of destruction to all covered entities
4. Immediately revoke all Epic API credentials
5. Notify all enrolled seniors and family members 90 days prior to shutdown
```

### Q7: How do you handle patient consent?
**Answer:**
```
Seniors or their legal representatives must sign a consent form (electronic or
physical) before enrollment. The consent authorizes:
- WellFit Community to pull demographics from Epic for enrollment
- Law enforcement constables to access emergency response info for welfare checks
- Family caregivers to update emergency information
- SMS/app notifications for daily check-ins

Consent is stored in our database with timestamp and IP address. Patients can
revoke consent anytime, resulting in immediate program termination and data
deletion within 90 days.
```

### Q8: Do you use Epic data for any secondary purposes?
**Answer:**
```
No. Epic data (patient demographics) is used ONLY for the stated purpose: enrolling
seniors in "Are You OK?" wellness check programs and ensuring constables have
accurate contact information for emergency welfare checks. We do NOT:
- Sell or share Epic data with third parties
- Use Epic data for marketing or advertising
- Use Epic data for research (unless specific IRB approval and patient consent obtained)
- Re-identify de-identified Epic data
```

Click **"Submit Security Questionnaire"**

---

## STEP 8: Review and Submit (10 minutes)

### 8.1 Review Checklist

Before submission, verify:

**Organization Profile:**
- ☑ Company name matches business registration
- ☑ Valid business address (not PO Box)
- ☑ Professional email domain (@thewellfitcommunity.org, not Gmail)
- ☑ Phone number is current and answered

**App Profile:**
- ☑ App name emphasizes "Senior Wellness" and "Welfare Check"
- ☑ App description clearly states "patient-facing, not provider-facing"
- ☑ App description says "read-only demographics, no clinical data"
- ☑ Categories: Patient Engagement, Community Health (NOT Clinical Documentation)
- ☑ Screenshots use de-identified test data ONLY

**OAuth Configuration:**
- ☑ ONLY requesting patient/Patient.read and patient/RelatedPerson.read
- ☑ All production redirect URIs use HTTPS
- ☑ PKCE enabled
- ☑ Scope justifications provided for each scope

**Documentation:**
- ☑ Privacy policy published at public URL and linked
- ☑ Terms of service published at public URL and linked
- ☑ Security documentation PDF uploaded (3-5 pages)
- ☑ App screenshots uploaded (5 images, 1920x1080)
- ☑ App logo uploaded (512x512 PNG)

**Partner Validation:**
- ☑ Hospital/health system partner identified
- ☑ Law enforcement partner identified
- ☑ Letter of support from hospital uploaded

**Security Questionnaire:**
- ☑ All questions answered thoroughly
- ☑ Clear statement: "We do NOT write to Epic, read-only only"
- ☑ HIPAA compliance measures documented

### 8.2 Final Review

Click **"Review Application"** to see a summary of everything you've entered.

**Read carefully:**
- Does the app description sound like a public safety tool (not EHR)?
- Are scopes limited to demographics only?
- Is it clear you're read-only and not competitive with Epic?

### 8.3 Submit Application

Click **"Submit for Epic Review"**

**Confirmation Email:**
You'll receive an email from Epic within 24 hours confirming they've received your application.

**Application ID:**
Save your application ID (e.g., APP-12345-2025). You'll need this for follow-up.

---

## STEP 9: What Happens Next (Weeks 3-12)

### Week 3-4: Epic Initial Review

**Epic Reviewer Actions:**
- Reviews app description and positioning
- Checks scopes requested (looking for overreach)
- Reviews security documentation
- Validates partner organization
- Checks privacy policy and terms

**Possible Outcomes:**

**✅ Approved for Next Stage:**
- Email: "Your application has passed initial review"
- Next: Security questionnaire (if not completed) or sandbox credentials

**⚠️ Questions/Clarifications Needed:**
- Email: "We have questions about your application"
- Common questions:
  - "Why do you need RelatedPerson.read?"
  - "How is this different from MyChart?"
  - "Will you add more scopes in the future?"
- **Respond within 48 hours** using talking points from Section 10

**❌ Rejected (rare if you followed this guide):**
- Email: "Your application has been rejected"
- Reasons: Scopes too broad, positioning too competitive, missing documentation
- **You can revise and resubmit**

### Week 5-6: Epic Approval for Sandbox

**If approved:**
- Email: "Congratulations! Your sandbox credentials are ready"
- Epic provides:
  - Sandbox Client ID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
  - Sandbox FHIR Base URL: `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4`
  - Test patient IDs for testing

**Next Steps:**
- Add sandbox credentials to `.env.local`
- Test with Epic sandbox (see Section 11)
- Complete functional testing requirements

### Week 7-9: Epic Certification Testing

**Epic will ask you to demonstrate:**
- OAuth 2.0 + SMART on FHIR flow
- PKCE implementation
- Patient demographics retrieval
- Error handling (404, 401, 500 responses)
- Token refresh logic
- Rate limit respect (though not enforced in sandbox)

**Testing Checklist:**
- ☑ Successful OAuth authorization
- ☑ Patient.read returns correct demographics
- ☑ RelatedPerson.read returns emergency contacts
- ☑ Token refresh before expiration
- ☑ Graceful error handling
- ☑ No requests for unauthorized scopes
- ☑ Audit logging enabled

### Week 10-11: Request Production Credentials

**Requirements:**
- Sandbox testing complete and passed
- Partner hospital confirmed and ready
- BAA executed with Epic
- Production environment ready

**Submission:**
- Hospital/health system name
- Hospital Epic instance URL (provided by hospital IT)
- Go-live date
- Expected patient volume (number of seniors in program)

**Epic coordinates with hospital:**
- Verifies hospital authorizes your app
- Configures FHIR API access on hospital's Epic instance
- Generates production client ID and secret
- Whitelists your production redirect URIs
- Enables requested scopes

### Week 12+: Production Credentials Received

**Epic provides:**
- Production Client ID
- Production Client Secret
- Hospital-specific FHIR base URL

**Add to production environment:**
```bash
REACT_APP_EPIC_FHIR_URL=https://fhir.yourhospital.epic.com/FHIR/R4
REACT_APP_EPIC_CLIENT_ID=prod_xxxxxxxx
REACT_APP_EPIC_CLIENT_SECRET=prod_secret
```

**Go-Live:**
- Coordinate with hospital IT for go-live date
- Start with 5-10 pilot seniors
- Monitor logs for errors
- Validate data accuracy
- Expand to full program

---

## SECTION 6: Privacy Policy Template

[Content for privacy policy would go here - too long for this guide, but available upon request]

---

## SECTION 7: Terms of Service Template

[Content for terms of service would go here]

---

## SECTION 8: Security Documentation Template

[Content for security PDF would go here]

---

## SECTION 9: Hospital Letter of Support Template

```
[Hospital Letterhead or Logo]

Date: [Current Date]

To: Epic App Orchard Review Team

Re: Letter of Support for WellFit Community Application

[Hospital Name] supports the WellFit Community application for Epic App Orchard
approval. We are partnering with [Constable Office / Law Enforcement Agency] to
pilot an "Are You OK?" senior welfare check program using WellFit Community.

WellFit Community will integrate with our Epic EHR system to pull patient demographics
(name, date of birth, address, phone number) for seniors who consent to enroll in
the program. This limited, read-only integration will enable law enforcement constables
to perform more effective and safer welfare checks on vulnerable seniors in our
community.

We have reviewed WellFit Community's security documentation, including their data
encryption, access controls, and audit logging practices. We are satisfied with
their HIPAA compliance measures and data protection protocols.

We are executing a Business Associate Agreement (BAA) with Envision VirtualEdge Group
LLC (WellFit Community) and will work with them to ensure patient privacy, data
security, and compliance with all applicable regulations.

We believe this program will improve public safety for our senior patient population
and reduce unnecessary emergency department visits by enabling earlier intervention
for at-risk seniors.

We support Epic's approval of WellFit Community for FHIR API access to patient
demographics (Patient.read and RelatedPerson.read scopes) for this limited purpose.

Sincerely,

[Signature]

[Name], [Title]
[e.g., Chief Medical Information Officer, VP of Community Health]
[Hospital Name]
[Contact Email]
[Contact Phone]

[Hospital Address]
```

---

## SECTION 10: Epic Reviewer Q&A - Prepared Responses

### When Epic Asks: "Why do you need Epic integration?"

**CORRECT ANSWER:**
```
WellFit Community needs to link seniors enrolled in constable-run "Are You OK?"
programs to their Epic patient records. When a senior enrolls (at the constable
office or community center), we pull their demographics from Epic to ensure we
have the correct address and contact information for emergency welfare checks.
Without this integration, constables would manually copy patient information,
leading to errors and outdated addresses that could delay emergency response.
We sync demographics weekly to catch address changes when seniors move or update
their phone numbers.
```

### When Epic Asks: "Is this a competitor to Epic?"

**CORRECT ANSWER:**
```
Absolutely not. We are not an EHR, clinical documentation system, or provider
tool. WellFit Community is a public safety and family caregiver app for seniors
living at home. Epic remains the system of record for all clinical care. We
simply pull patient demographics to help constables locate seniors during welfare
checks and to enable family caregivers to maintain emergency information. Think
of us as a community health extension of Epic - we serve law enforcement and
family caregivers, not clinicians. We have zero overlap with Epic's clinical
functionality.
```

### When Epic Asks: "Why not use MyChart?"

**CORRECT ANSWER:**
```
MyChart is excellent for patient-provider communication and medical records access,
but it's not designed for daily wellness check-ins or law enforcement welfare checks.
Seniors in our program are often 80+ years old, may have cognitive impairment, and
need a VERY simple "Are you OK?" button - not medical records access. Additionally,
constables need emergency response information (key location, mobility status,
oxygen equipment, pet information) that wouldn't be appropriate to store in MyChart
or expose to clinical teams. Many seniors use BOTH: MyChart for healthcare
appointments and messaging doctors, WellFit for daily safety check-ins and family
monitoring. They serve completely different purposes with different user bases.
```

### When Epic Asks: "Do you write data back to Epic?"

**CORRECT ANSWER:**
```
No. This is a read-only integration. We pull demographics only (Patient.read,
RelatedPerson.read). Wellness check-in data (daily "Are you OK?" responses),
emergency response information (mobility status, medical equipment, emergency
access instructions), and welfare check reports all stay in WellFit Community.
They are NOT written back to Epic. If a constable discovers a medical issue during
a welfare check (e.g., patient fell and broke hip), they communicate findings
verbally to EMS or the senior's physician, who documents it in Epic per normal
clinical workflow. We have no plans to add write capabilities - it's not our role
to document clinical care. That belongs in Epic.
```

### When Epic Asks: "Will you request more scopes in the future?"

**SAFE ANSWER:**
```
We have no current plans to request additional scopes. Patient demographics and
emergency contacts are sufficient for the "Are You OK?" program use case. If we
were to expand functionality in the future (for example, medication reminders for
seniors, which would require MedicationRequest.read), we would submit a new scope
request with clear justification and use cases for Epic's review and approval.
We understand Epic's scope approval is not a one-time process, and we respect
the need for ongoing review as functionality changes.
```

### When Epic Asks: "What other EHR systems do you integrate with?"

**SAFE ANSWER:**
```
We're starting with Epic because it's used by [Name of Partner Hospital]. Our
focus is on working with local constable offices and the healthcare organizations
they partner with. If constable offices in other regions use different EHR systems
(like Cerner, Athenahealth, or Meditech), we may build similar read-only demographics
integrations for those systems, but Epic is our priority. Our approach will always
be the same: simple, read-only patient demographics for enrollment purposes only.
We're not building a comprehensive multi-EHR interoperability platform - we're
focused on public safety use cases.
```

---

## SECTION 11: Testing with Epic Sandbox

### 11.1 Add Sandbox Credentials to `.env.local`

```bash
# Epic Sandbox Configuration
REACT_APP_EPIC_USE_SANDBOX=true
REACT_APP_EPIC_SANDBOX_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
REACT_APP_EPIC_SANDBOX_CLIENT_ID=your_sandbox_client_id_here
```

### 11.2 Epic Sandbox Test Patients

Epic provides these test patient IDs:

```javascript
const epicTestPatients = [
  {
    id: 'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB',
    name: 'Jason Argonaut',
    mrn: '000000001'
  },
  {
    id: 'erXuFYUfucBZaryVksYEcMg3',
    name: 'Derrick Lin',
    mrn: '000000002'
  },
  {
    id: 'eq081-VQEgP8drUUqCWzHfw3',
    name: 'Amy Shaw',
    mrn: '000000003'
  }
];
```

### 11.3 Test Patient.read

```bash
# Start development server
npm run dev

# Navigate to enrollment flow
# Enter test patient ID: Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB

# Verify returned data:
# - Name: Jason Argonaut
# - DOB: 1985-08-01
# - Gender: Male
# - Address: Epic sandbox address
```

### 11.4 Test RelatedPerson.read

```bash
# In enrollment flow, after patient demographics loaded
# Click "Load Emergency Contacts from Epic"

# Verify related persons returned (if any in sandbox data)
```

### 11.5 Test OAuth Flow

```bash
# Complete flow:
1. User clicks "Connect to Epic"
2. Redirect to Epic authorization page
3. User authenticates (sandbox credentials)
4. User approves scopes
5. Redirect back to WellFit with authorization code
6. Exchange code for access token (with PKCE verifier)
7. Store access token and refresh token
8. Make Patient.read request
9. Display demographics in UI
```

### 11.6 Test Token Refresh

```bash
# Manually expire access token (change timestamp in DB)
# Make Patient.read request
# Verify app automatically refreshes token using refresh token
# Verify new access token returned and stored
# Verify Patient.read succeeds with new token
```

### 11.7 Test Error Handling

```bash
# Test 401 Unauthorized:
# - Use invalid access token
# - Verify app attempts token refresh
# - Verify graceful error message to user

# Test 404 Not Found:
# - Request non-existent patient ID
# - Verify error message: "Patient not found in Epic"

# Test 403 Forbidden:
# - Request patient outside authorized scope
# - Verify error message about insufficient permissions
```

---

## SECTION 12: Common Mistakes to Avoid

### ❌ MISTAKE 1: Requesting Too Many Scopes

**DON'T:**
- Request patient/Observation.read "just in case"
- Request system/*.read for everything
- Request write scopes

**DO:**
- Request ONLY patient/Patient.read and patient/RelatedPerson.read
- Justify each scope clearly
- Keep scope minimal for stated use case

---

### ❌ MISTAKE 2: Positioning as EHR Integration

**DON'T:**
- Say "comprehensive FHIR integration"
- Say "EHR interoperability platform"
- Say "clinical data synchronization"
- Mention "US Core compliance"

**DO:**
- Say "patient demographics for enrollment"
- Say "public safety application"
- Say "community health tool"
- Say "read-only, limited scope"

---

### ❌ MISTAKE 3: Using Real Patient Data in Screenshots

**DON'T:**
- Screenshot production environment
- Use real patient names, addresses, or MRNs
- Use real welfare check incidents

**DO:**
- Use synthetic test data only
- Names: "John Smith", "Jane Doe", "Test Patient"
- Addresses: "123 Main St, Anytown, TX 12345"
- Clear watermark: "TEST DATA ONLY"

---

### ❌ MISTAKE 4: Vague Use Case Description

**DON'T:**
- "We improve patient engagement"
- "We help coordinate care"
- "We integrate with EHRs"

**DO:**
- "We enable law enforcement constables to perform emergency welfare checks on seniors"
- "We provide daily wellness check-ins for seniors living at home"
- "We help family caregivers monitor their loved ones' safety"

---

### ❌ MISTAKE 5: No Healthcare Partner

**DON'T:**
- Submit application without hospital partner
- Say "we'll find a hospital later"
- Apply speculatively

**DO:**
- Identify specific hospital/health system using Epic
- Get letter of support before submitting
- Include hospital name and contact in application
- Coordinate with hospital IT before Epic submission

---

## Contact for Help

**Epic App Orchard Support:**
apporchard@epic.com

**WellFit Community (Internal):**
maria@thewellfitcommunity.org

**This Guide:**
docs/EPIC_APPLICATION_STEP_BY_STEP.md

---

**Last Updated:** November 11, 2025
**Version:** 1.0
**Epic FHIR Version:** R4
**Positioning:** Public Safety / Community Health (NOT comprehensive EHR integration)

**FINAL REMINDER:** Focus on wellness checks and public safety. Keep scopes minimal. Emphasize read-only demographics. Partner with a hospital. Be patient - the process takes 3-4 months.
