# Epic App Orchard Application - WellFit Community

## Application Strategy

**CRITICAL:** This Epic application focuses ONLY on the **community-facing patient engagement app** for the "Are You OK?" senior welfare check program. Do NOT mention the comprehensive FHIR R4 EHR integration capabilities.

---

## App Profile Information

### App Name
```
WellFit Community - Senior Wellness & Welfare Check Platform
```

### App Tagline (One sentence)
```
Community health platform connecting seniors, family caregivers, and law enforcement
for daily wellness check-ins and emergency welfare checks.
```

### App Category
Select these categories ONLY:
- ✅ **Patient Engagement**
- ✅ **Remote Patient Monitoring**
- ✅ **Social Determinants of Health (SDOH)**
- ✅ **Care Coordination**
- ✅ **Community Health**

**DO NOT SELECT:**
- ❌ Clinical Documentation
- ❌ EHR Integration
- ❌ Provider Tools
- ❌ Population Health Management

### App Type
- ✅ **Web Application (Server-Side)**
- ✅ **Patient-Facing Mobile App**

### FHIR Version
- ✅ **R4** (for patient demographics only)

---

## App Description (COPY THIS EXACTLY)

```markdown
## WellFit Community - Keeping Seniors Safe and Connected

### Overview
WellFit Community is a patient-facing mobile and web application that helps seniors
stay safe at home through daily "Are You OK?" wellness check-ins, while enabling
law enforcement constables and family caregivers to coordinate emergency welfare checks
when seniors don't respond.

This is NOT an EHR system or clinical documentation tool. This is a community health
and public safety platform that integrates with Epic to pull basic patient demographics
for seniors who enroll in local "Are You OK?" programs run by constables' offices.

### The Problem We Solve
Many seniors live alone and are at risk of falls, medical emergencies, or other
incidents where they cannot call for help. Law enforcement agencies run "Are You OK?"
programs to check on seniors, but these require frequent in-person welfare checks
that strain resources and may miss time-sensitive emergencies.

### How WellFit Community Works

**Daily Wellness Check-Ins (Patient-Facing):**
- Seniors receive a daily text message or app notification: "Good morning! Are you OK?"
- They respond with a simple tap/text to confirm they're safe
- Family members can see check-in status
- If missed: Automated escalation to emergency contacts, then constables

**Emergency Welfare Checks (Law Enforcement):**
- When seniors don't respond to check-ins for 2-6 hours (configurable)
- Constables receive dispatch alerts with critical safety information
- Emergency access instructions (key location, door codes)
- Mobility status (bed-bound, wheelchair user, etc.)
- Medical equipment (oxygen tanks, dialysis machines)
- Communication needs (hearing impaired, cognitive impairment)
- Pet information (for officer safety)
- Emergency contacts readily available

**Family Caregiver Portal:**
- Family members update senior emergency information
- View daily check-in history
- Receive alerts if wellness check missed
- Update medications, mobility status, emergency contacts

### Epic Integration (READ-ONLY, LIMITED SCOPE)

WellFit Community connects to Epic ONLY to:

1. **Patient Demographics** (Patient.read)
   - Pull patient name, date of birth, address, phone number
   - Link Epic patient to WellFit Community user account
   - Verify patient identity for program enrollment

2. **Emergency Contact Information** (RelatedPerson.read - optional)
   - Retrieve family contacts already in Epic
   - Pre-populate emergency contact forms for family

**We DO NOT:**
- ❌ Write any data back to Epic
- ❌ Read clinical notes or provider documentation
- ❌ Access billing or insurance information
- ❌ Read lab results or diagnostic reports
- ❌ Synchronize care plans or treatment information
- ❌ Export bulk patient data from Epic

**Data Flow:**
```
Epic EHR → (FHIR Patient.read only) → WellFit Community → Family/Constables
```

All wellness check-in data, emergency response information, and welfare check
reports stay IN WellFit Community. They are NOT written back to Epic. Clinical
findings discovered during welfare checks are communicated verbally to healthcare
providers who document them in Epic.

### Target Users

**Primary Users (Patient-Facing):**
- Seniors living at home (age 65+)
- Family caregivers
- Emergency contacts

**Secondary Users (Emergency Response):**
- Constables / Law Enforcement Officers
- Community health workers
- Social workers
- Volunteer check-in coordinators

**NOT for Clinical Staff:**
- This app is not for physicians, nurses, or clinical teams
- Clinical documentation remains in Epic

### Use Cases

**Use Case 1: Daily Wellness Check-Ins**
- 85-year-old senior Mrs. Smith lives alone with fall risk
- Every morning at 10am, receives "Are you OK?" text message
- Responds "Yes, I'm fine" with one tap
- Family sees green checkmark in app
- No constable intervention needed

**Use Case 2: Missed Check-In with Safe Resolution**
- Mr. Johnson doesn't respond to 10am check-in
- 12pm: Automated reminder sent
- 2pm: Alert sent to daughter (emergency contact)
- 2:15pm: Daughter calls dad, he was gardening and didn't hear phone
- Daughter marks check-in complete in app
- No constable dispatch needed

**Use Case 3: Emergency Welfare Check**
- Ms. Williams doesn't respond to check-in or reminders
- 4pm (6 hours): Constable receives dispatch alert
- Constable opens WellFit app and sees:
  - She uses walker, has oxygen tank in bedroom
  - Spare key under flower pot by side door
  - Small dog (Pomeranian) inside - may bark
  - Neighbor contact: Mrs. Chen next door
- Constable performs welfare check with full context
- Finds Ms. Williams fell and can't get up
- Calls EMS with medical info from app
- EMS transports, incident documented in WellFit (not Epic)

**Use Case 4: Family Updates Emergency Info**
- Mr. Davis's daughter updates his mobility status to "wheelchair-bound" after stroke
- Adds new medication: blood thinner
- Updates emergency access: now has Ring doorbell, code is 1234
- Changes escalation delay from 6 hours to 2 hours (high priority)
- Constables automatically see updated info in dispatch system

### Integration Touchpoints with Epic

**Enrollment Flow:**
1. Senior or family enrolls in "Are You OK?" program (in-person at constable office)
2. Constable staff searches Epic for patient by name/DOB
3. **Epic FHIR API returns**: Patient demographics (name, DOB, address, phone)
4. WellFit Community creates user account linked to Epic patient ID
5. Family completes emergency response information form (stored in WellFit ONLY)
6. Daily check-ins begin

**Ongoing Sync:**
- WellFit polls Epic once per week to update patient demographics (address changes, phone updates)
- If patient moves or Epic updates address, WellFit reflects new address for constables
- No clinical data is synced

**No Data Written Back to Epic:**
- Wellness check-in history stays in WellFit
- Emergency response information stays in WellFit
- Welfare check reports stay in WellFit
- If clinical intervention needed: Provider documents in Epic manually

### Privacy & Compliance

**HIPAA Compliant:**
- BAA executed with Epic and healthcare organizations
- All patient data encrypted at rest (AES-256) and in transit (TLS 1.3)
- Role-based access control (family sees only their senior, constables see only their jurisdiction)
- Full audit logging of all data access
- Minimum necessary access principle
- Patient/family consent required for enrollment

**Consent Model:**
- Seniors sign consent form authorizing:
  - WellFit Community to pull demographics from Epic
  - Law enforcement constables to access emergency response info for welfare checks
  - Family caregivers to update information
  - SMS/app notifications for check-ins
- Consent can be revoked anytime

**Data Retention:**
- Active program participation: Data retained
- Program exit: 90-day grace period, then deleted
- Welfare check incident reports: 7-year retention for legal/liability
- Epic patient linkage: Deleted upon program exit

### Security

**Authentication:**
- Patient/family: Email + password or SSO
- Law enforcement: Email + MFA required (Google Authenticator)
- Role-based access control (RBAC)

**Data Protection:**
- Encryption at rest: AES-256
- Encryption in transit: TLS 1.3
- Epic FHIR credentials encrypted in Supabase Vault
- Access tokens rotated every 60 minutes
- No PHI in client-side storage (localStorage, cookies)

**Audit Logging:**
- All Epic API calls logged with: timestamp, user, patient ID, data accessed
- All emergency response info views logged
- All welfare check dispatches logged
- Logs retained 7 years for compliance

### Technical Architecture

**Frontend:**
- React web app (desktop for constables, mobile-responsive for family/seniors)
- React Native mobile app (iOS/Android for seniors and family)

**Backend:**
- Supabase (PostgreSQL database, authentication, APIs)
- Row-level security (RLS) for multi-tenant isolation

**Epic Integration:**
- SMART on FHIR OAuth 2.0
- PKCE flow for security
- Patient.read scope only
- RelatedPerson.read scope (optional, for emergency contacts)

**No Epic App Orchard Components:**
- This is a standalone app, not an embedded Epic App
- Users access via web browser or mobile app
- EHR launch NOT required (standalone launch only)

### Compliance Certifications

**Current:**
- HIPAA compliant architecture
- SOC 2 Type II in progress (expected Q2 2026)

**Planned:**
- ONC Health IT Certification (if required by states for patient access)

### Pricing Model

**Free for Patients:**
- Seniors and family caregivers use the app at no cost
- Funded by constable offices / public safety budgets

**B2G (Business to Government):**
- Constable offices / law enforcement agencies pay annual subscription
- Pricing: $2 per senior per month ($24/year)
- Example: 100 seniors = $2,400/year for constable office

### Geographic Scope

**Launch Markets:**
- Texas (Precinct 3 constable offices statewide)

**Future Expansion:**
- Other states with constable/sheriff "Are You OK?" programs
- Municipal police departments
- Fire department community paramedicine programs

### Patient Population

**Target Demographics:**
- Seniors age 65+
- Living independently at home (not nursing homes)
- At risk: Falls, cognitive impairment, mobility issues, chronic conditions
- Often living alone or with limited family nearby

**Program Eligibility:**
- Must have Epic patient record at local healthcare organization
- Must consent to program participation
- Must have phone capable of receiving SMS OR family caregiver with smartphone

### Success Metrics

**Patient Engagement:**
- Daily check-in completion rate: Target 95%
- Time to respond to check-in: Target <2 hours

**Public Safety:**
- Welfare check response time: Target <30 minutes from alert
- False alarm rate: Target <10%
- Lives saved / emergencies detected: Primary outcome

**Healthcare Integration:**
- Epic patient linking accuracy: Target 99%+
- Demographics sync errors: Target <1%

### Differentiation from MyChart

**Epic MyChart:**
- Access medical records (labs, notes, imaging)
- Secure messaging with providers
- Appointment scheduling
- Prescription refills
- Bill payment

**WellFit Community:**
- Daily wellness check-ins (not in MyChart)
- Emergency welfare check coordination with law enforcement
- Family caregiver collaboration tools
- Emergency response information for constables
- Public safety focus, not clinical care

**Many seniors use BOTH:**
- MyChart for healthcare (appointments, records, messaging doctors)
- WellFit Community for safety (wellness check-ins, family monitoring, constable welfare checks)

They serve completely different purposes and do not overlap.

### Roadmap (Future Enhancements)

**Phase 1 (Current):**
- Daily wellness check-ins
- Constable dispatch dashboard
- Family emergency info management

**Phase 2 (6 months):**
- Voice call option for non-smartphone seniors
- Geofencing alerts (optional, privacy-sensitive)
- Neighbor network (block captains check on seniors)

**Phase 3 (12 months):**
- Integration with 911 CAD systems
- Multi-language support (Spanish, Vietnamese)
- Medication reminder integration

**We will NOT add:**
- Clinical documentation features (belongs in Epic)
- Provider-facing tools (use Epic)
- Billing or claims management
- Lab result tracking
- Appointment scheduling

### Support & Training

**Family/Senior Support:**
- Video tutorials in app
- Toll-free support hotline (8am-8pm local time)
- Email support: support@thewellfitcommunity.org
- FAQ knowledge base

**Law Enforcement Training:**
- On-site training at constable offices (2 hours)
- Ongoing webinars and refresher training
- Dedicated account manager for agencies
- 24/7 technical support for dispatch systems

### Contact Information

**Company:**
Envision VirtualEdge Group LLC

**App Contact:**
Maria LeBlanc
maria@thewellfitcommunity.org
832-576-3448

**Website:**
https://thewellfitcommunity.org

**Privacy Policy:**
https://thewellfitcommunity.org/privacy

**Terms of Service:**
https://thewellfitcommunity.org/terms
```

---

## FHIR Scopes to Request

### Patient-Level Scopes (User-Mediated Access)

**Request ONLY these scopes:**

```
patient/Patient.read
patient/RelatedPerson.read
```

**Justification to Epic:**

**patient/Patient.read:**
```
Required to pull patient demographics (name, date of birth, address, phone number)
when seniors enroll in constable-run "Are You OK?" programs. This ensures accurate
patient identification and enables constables to reach the correct address during
emergency welfare checks. Demographics are synced weekly to keep contact information
current.
```

**patient/RelatedPerson.read:**
```
Optional scope to pre-populate emergency contact forms with family members already
listed in Epic, saving time during enrollment and ensuring consistency. Family
caregivers can edit/add contacts in WellFit Community as needed.
```

### System-Level Scopes (Backend Service - Optional)

**ONLY request if absolutely necessary:**

```
system/Patient.read
```

**Justification to Epic:**
```
Allows constable offices to enroll multiple seniors in batch (e.g., 50 seniors at
a community health fair) without requiring each senior to individually authenticate.
Pre-authorized by healthcare organization via BAA. Used only for initial enrollment,
not ongoing data sync.
```

**DO NOT REQUEST:**
- ❌ Observation.read (no vitals needed)
- ❌ Condition.read (no diagnosis needed)
- ❌ MedicationRequest.read (family enters meds manually in WellFit)
- ❌ Any write scopes (read-only integration)

---

## OAuth / SMART Configuration

### Redirect URIs

**Development:**
```
http://localhost:3000/auth/epic/callback
```

**Staging:**
```
https://staging.thewellfitcommunity.org/auth/epic/callback
```

**Production:**
```
https://app.thewellfitcommunity.org/auth/epic/callback
https://thewellfitcommunity.org/auth/epic/callback
```

### Launch Types
- ✅ **Standalone Launch** (user initiates from WellFit app)
- ❌ EHR Launch NOT needed (we're not embedded in Epic)

### Token Endpoint Auth Method
```
client_secret_post
```

### PKCE Required
```
Yes (Epic requires PKCE for all apps)
```

### Scopes Requested (Summary)
```
launch/patient
patient/Patient.read
patient/RelatedPerson.read
offline_access
```

---

## Key Talking Points for Epic Review

### When Epic Asks: "Why do you need Epic integration?"

**CORRECT ANSWER:**
```
WellFit Community needs to link seniors enrolled in constable-run "Are You OK?"
programs to their Epic patient records. When a senior enrolls (at the constable
office or community center), we pull their demographics from Epic to ensure we have
correct address and contact information for emergency welfare checks. Without this
integration, constables would manually copy patient information, leading to errors
and outdated addresses that could delay emergency response.
```

### When Epic Asks: "Is this a competitor to Epic?"

**CORRECT ANSWER:**
```
Absolutely not. We are not an EHR, clinical documentation system, or provider tool.
WellFit Community is a public safety and family caregiver app for seniors living at
home. Epic remains the system of record for all clinical care. We simply pull patient
demographics to help constables locate seniors during welfare checks. Think of us as
a community health extension of Epic - we serve a completely different user base
(law enforcement and family caregivers, not clinicians).
```

### When Epic Asks: "Why not use MyChart?"

**CORRECT ANSWER:**
```
MyChart is excellent for patient-provider communication, but it's not designed for
daily wellness check-ins or law enforcement welfare checks. Seniors in our program
are often 80+ years old, may have cognitive impairment, and need a VERY simple "Are
you OK?" button - not medical records access. Additionally, constables need emergency
response information (key location, mobility status, oxygen equipment) that wouldn't
be appropriate in MyChart. Many seniors use both: MyChart for healthcare, WellFit
for safety.
```

### When Epic Asks: "Do you write data back to Epic?"

**CORRECT ANSWER:**
```
No. This is a read-only integration. Wellness check-in data, emergency response
information, and welfare check reports all stay in WellFit Community. If a constable
finds a medical issue during a welfare check, they communicate findings verbally to
EMS or the senior's physician, who documents it in Epic. We have no plans to write
data back to Epic - it's not our role.
```

### When Epic Asks: "What other EHR systems do you integrate with?"

**SAFE ANSWER:**
```
We're starting with Epic because it's used by [Name of Partner Hospital/Health System].
Our focus is on working with local constable offices and the healthcare organizations
they partner with. If constable offices in other regions use different EHR systems
(like Cerner or Athenahealth), we may build similar read-only demographics integrations,
but Epic is our priority and our approach will be the same: simple, read-only patient
demographics for enrollment purposes.
```

### When Epic Asks: "Are you building an Epic App?"

**SAFE ANSWER:**
```
Not at this time. WellFit Community is a standalone app accessed via web browser or
mobile app by seniors, family caregivers, and constables. We don't need to be embedded
in the Epic UI because our users are not clinicians working in the EHR. That said, if
there's value in the future (e.g., a social worker could launch WellFit from a patient
chart to enroll them in a welfare check program), we'd follow Epic's App development
guidelines and partner with Epic for certification.
```

---

## RED FLAGS TO AVOID

### DO NOT Say:
- ❌ "We have full FHIR R4 integration"
- ❌ "We support all FHIR resources"
- ❌ "We sync clinical data from Epic"
- ❌ "We're building a care coordination platform"
- ❌ "We help providers document care"
- ❌ "We have CareTeam, CarePlan, Observation integrations"
- ❌ "We're achieving 100% US Core compliance"
- ❌ "We have Epic, Cerner, and Meditech adapters"
- ❌ "We write data back to Epic"

### INSTEAD Say:
- ✅ "We pull patient demographics for enrollment only"
- ✅ "This is a public safety app, not a clinical tool"
- ✅ "We're complementary to Epic, not competitive"
- ✅ "Epic is the system of record for clinical care"
- ✅ "We serve law enforcement and family caregivers, not clinicians"
- ✅ "We're read-only and limited scope"
- ✅ "We help keep Epic patients safe at home"

---

## Documentation to Upload

### 1. Privacy Policy
**Must include:**
- What patient data we collect (name, DOB, address, phone from Epic + emergency info from family)
- How we use it (wellness check-ins, constable welfare checks)
- Who we share it with (constables, family caregivers - NOT third parties)
- How patients can access/delete their data
- HIPAA compliance statement
- Epic data handling: "We pull patient demographics from Epic for enrollment. We do not write data back to Epic."

**Create at:** `https://thewellfitcommunity.org/privacy`

### 2. Terms of Service
**Must include:**
- User responsibilities (respond to daily check-ins, keep info current)
- Epic data usage restrictions (demographics only, no clinical data)
- Prohibited uses (no resale of data, no third-party sharing)
- Termination rights

**Create at:** `https://thewellfitcommunity.org/terms`

### 3. Security Documentation (PDF - 3-5 pages)
**Include:**
- Encryption: TLS 1.3 in transit, AES-256 at rest
- Authentication: Email/password + MFA for law enforcement
- Access controls: RBAC, multi-tenant RLS
- Audit logging: All Epic API calls and data access logged
- Incident response: 60-day breach notification, Epic contact within 24h
- Backup/disaster recovery: Daily encrypted backups, 90-day retention

### 4. App Screenshots (5 images - 1920x1080 PNG)
**Include:**
1. Senior mobile app - "Are You OK?" check-in screen (use test data)
2. Family caregiver portal - Emergency info form (de-identified)
3. Constable dispatch dashboard - Welfare check queue (synthetic data)
4. Constable detail view - Emergency response info panel (test patient)
5. Check-in history calendar view (no real patient data)

**CRITICAL:** All screenshots must use test/synthetic data. No real patient information.

### 5. App Logo (512x512 PNG, transparent background)
**Design notes:**
- Professional, trustworthy
- Blue/green color scheme (safety, health)
- Simple icon seniors can recognize
- Include "WellFit Community" text or logo

---

## Timeline

| Week | Milestone |
|------|-----------|
| 1 | Create Epic App Orchard account, complete organization profile |
| 1-2 | Complete app profile, write app description |
| 2 | Create privacy policy and terms of service, publish on website |
| 2-3 | Create security documentation PDF and app screenshots |
| 3 | Submit application to Epic for review |
| 3-5 | Epic initial review, respond to questions |
| 5-6 | Epic approval for sandbox credentials |
| 6-8 | Test with Epic sandbox (using test patient IDs) |
| 8-10 | Epic certification testing (functional, security, usability) |
| 10-12 | Request production credentials (coordinate with partner hospital) |
| 12+ | Production go-live with first constable office |

**Total: 12-16 weeks (3-4 months)**

---

## Success Criteria

**Application Approved When:**
- ✅ Epic recognizes this as complementary, not competitive
- ✅ Scopes are limited to Patient.read and RelatedPerson.read only
- ✅ Positioned as public safety / family caregiver tool, not clinical app
- ✅ Clear "we don't write to Epic" message
- ✅ Partner hospital/constable office validates use case
- ✅ Privacy and security documentation approved
- ✅ Sandbox credentials received

---

## Partner Organization

**CRITICAL:** Epic approves apps faster when you have a healthcare organization partner.

**Recommended Approach:**
1. Identify hospital/health system using Epic in your target area
2. Contact their community health or population health team
3. Explain "Are You OK?" program for seniors
4. Get letter of support from hospital for Epic application
5. Include hospital name in Epic app description: "Partnering with [Hospital Name] to keep seniors safe"

**Template Letter of Support:**
```
[Hospital Letterhead]

To: Epic App Orchard Review Team

[Hospital Name] supports the WellFit Community application for Epic App Orchard
approval. We are partnering with [Constable Office / Sheriff Department] to pilot
an "Are You OK?" senior welfare check program using WellFit Community.

This application will pull patient demographics only (name, DOB, address, phone)
for seniors who consent to enroll in the program. This limited integration enables
law enforcement to perform more effective and safer welfare checks on vulnerable
seniors in our community.

We have reviewed WellFit Community's security documentation and are satisfied with
their HIPAA compliance measures. We are executing a Business Associate Agreement
and will work with WellFit Community to ensure patient privacy and data security.

Sincerely,
[Chief Medical Information Officer or VP of Population Health]
[Hospital Name]
```

---

## Questions to Prepare For

Epic reviewers may ask these questions. Prepare answers:

### Q: "How many patients will use this app?"
**A:** "We're starting with a pilot of 50-100 seniors in [County/Precinct]. If successful, we plan to expand to 500-1,000 seniors across [Region] in the first year."

### Q: "What happens if a senior has an emergency?"
**A:** "If a senior presses the emergency button in the app or fails to respond to wellness check-ins, constables are dispatched to perform a welfare check. If medical intervention is needed, constables call EMS and provide information. EMS transports to hospital where clinical care is documented in Epic. We do not document clinical care in WellFit."

### Q: "How do you ensure patient consent?"
**A:** "Seniors must sign a consent form (physical or electronic) before enrollment. The consent authorizes: (1) WellFit to pull demographics from Epic, (2) Law enforcement to access emergency response info for welfare checks, (3) Family caregivers to update information. Consent can be revoked anytime, resulting in immediate program termination and data deletion within 90 days."

### Q: "What security certifications do you have?"
**A:** "We are pursuing SOC 2 Type II certification (expected Q2 2025). Our infrastructure is HIPAA-compliant: AES-256 encryption at rest, TLS 1.3 in transit, role-based access control, full audit logging, and MFA for law enforcement users. We execute Business Associate Agreements with all healthcare organizations."

### Q: "Do you sell patient data?"
**A:** "Absolutely not. Patient data is NEVER sold, shared with third parties, or used for advertising. Data is used solely for the wellness check program as described in our privacy policy. We are funded by constable office subscriptions, not data monetization."

---

## FINAL CHECKLIST BEFORE SUBMISSION

### Organization Profile:
- [ ] Company name matches business registration
- [ ] Valid business address (not PO Box)
- [ ] Professional email domain (@thewellfitcommunity.org)
- [ ] Phone number answered during business hours

### App Profile:
- [ ] App name emphasizes "Senior Wellness" or "Welfare Check"
- [ ] App description positions as PUBLIC SAFETY tool, not clinical EHR
- [ ] Categories: Patient Engagement, SDOH, Community Health
- [ ] NO mention of "comprehensive FHIR integration" or "all FHIR resources"
- [ ] Clear statement: "We pull demographics only, read-only"

### Documentation:
- [ ] Privacy policy published at public URL
- [ ] Terms of service published at public URL
- [ ] Security documentation PDF (3-5 pages)
- [ ] App screenshots (5 images, de-identified data only)
- [ ] App logo (512x512 PNG)

### Technical:
- [ ] ONLY requesting patient/Patient.read and patient/RelatedPerson.read scopes
- [ ] All redirect URIs use HTTPS (except localhost)
- [ ] SMART on FHIR + PKCE implemented in code
- [ ] Token refresh logic working

### Legal:
- [ ] Legal counsel reviewed Epic's BAA template
- [ ] HIPAA training completed for team
- [ ] Partner hospital letter of support obtained
- [ ] Incident response plan documented

### Partner Validation:
- [ ] Hospital/health system partner identified
- [ ] Constable office / law enforcement agency confirmed
- [ ] Letter of support from hospital obtained
- [ ] Include partner names in Epic application

---

## Contact for Questions

**Epic App Orchard Support:**
- Email: apporchard@epic.com
- Response time: 1-3 business days

**Epic FHIR Documentation:**
- https://fhir.epic.com/

**WellFit Community (Internal):**
- maria@thewellfitcommunity.org

---

**Document Version:** 1.0
**Last Updated:** November 11, 2025
**Epic FHIR Version:** R4 (limited scope: demographics only)
**Positioning:** Public Safety / Community Health (NOT comprehensive EHR integration)

---

## REMEMBER: DO NOT MENTION

- ❌ Full FHIR R4 integration
- ❌ CareTeam, CarePlan, Observation resources
- ❌ Epic adapter, Cerner adapter, Meditech adapter
- ❌ 100% US Core compliance
- ❌ Bi-directional sync
- ❌ Clinical documentation
- ❌ Population health management
- ❌ Provider-facing tools

**ONLY MENTION:**
- ✅ Patient demographics (read-only)
- ✅ Emergency contact information
- ✅ Public safety / welfare checks
- ✅ Family caregiver tools
- ✅ Senior wellness check-ins
- ✅ Constable / law enforcement coordination
