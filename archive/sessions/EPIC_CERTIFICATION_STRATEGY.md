# Epic Certification Strategy - Positioning WellFit Community

## Executive Summary

**Critical Context**: Epic is protective of their market position and can reject applications from perceived competitors. WellFit Community must be positioned as a **complementary patient engagement solution** that enhances Epic's value, not replaces it.

---

## 🎯 Key Positioning Strategy

### What Epic Wants to See:
✅ **Complementary solutions** that enhance their platform
✅ **Patient engagement tools** that improve outcomes
✅ **Remote monitoring** for post-discharge care
✅ **Community health workers** supporting Epic users
✅ **Social determinants of health (SDOH)** tracking
✅ **Population health** initiatives
✅ **Care coordination** tools

### What Epic REJECTS:
❌ EHR replacement or alternative systems
❌ Clinical documentation systems
❌ Order entry systems
❌ Billing/revenue cycle management
❌ Direct competition with Epic modules
❌ "We do what Epic does but better"

---

## 📝 Step-by-Step Epic App Orchard Registration

### STEP 1: Create Your Epic Developer Account (Week 1)

**Action Items:**

1. **Go to Epic App Orchard**
   - URL: https://apporchard.epic.com/
   - Click "Sign Up" (top right)

2. **Complete Organization Profile**

   **Organization Name:**
   ```
   Envision VirtualEdge Group LLC
   ```

   **Business Type:**
   ```
   Healthcare Technology Vendor - Patient Engagement Solutions
   ```

   **Company Description (CRITICAL - Use This Exact Positioning):**
   ```
   Envision VirtualEdge Group develops patient engagement and community
   health worker (CHW) solutions that complement EHR systems. Our WellFit
   Community platform helps healthcare organizations extend care beyond
   clinic walls by empowering Community Health Workers to support patients
   with social determinants of health, medication adherence, and wellness
   activities. We integrate WITH Epic to pull patient data for our CHW
   teams, ensuring continuity of care and reducing readmissions.
   ```

3. **Contact Information**
   - **Primary Contact:** [Your Name]
   - **Email:** maria@thewellfitcommunity.org (or your business email)
   - **Phone:** [Your phone number]
   - **Website:** https://thewellfitcommunity.org

4. **Business Address**
   - Must be a valid business address (PO Box may be rejected)

---

### STEP 2: Create Your App Profile (Week 1)

**Navigate to:** My Apps → Create New App

**App Information (Use These EXACT Categories):**

**App Name:**
```
WellFit Community Health Worker Platform
```

**App Tagline (One sentence):**
```
Community Health Worker platform that integrates with Epic to support
patients with SDOH needs, medication adherence, and post-discharge care.
```

**App Category (Select Multiple):**
- ✅ Patient Engagement
- ✅ Remote Patient Monitoring
- ✅ Population Health
- ✅ Care Coordination
- ✅ Social Determinants of Health (SDOH)

**App Type:**
- ✅ Web Application (Server-Side)

**FHIR Version:**
- ✅ R4 (Latest stable)

---

### STEP 3: Write Your App Description (MOST CRITICAL)

**Epic will read this carefully. Use this positioning:**

```markdown
## WellFit Community Health Worker Platform

### Overview
WellFit Community is a patient engagement and community health worker (CHW)
coordination platform designed to COMPLEMENT Epic EHR systems. We help
healthcare organizations extend care beyond the clinic by empowering CHW teams
to support patients with social determinants of health, chronic disease
management, and post-discharge care coordination.

### How We Integrate with Epic
WellFit Community connects to Epic via FHIR APIs to:
1. Read patient demographics and care plans
2. Retrieve observation data (vitals, labs) for CHW review
3. Access medication lists to support adherence coaching
4. Pull condition/diagnosis information for targeted interventions
5. Sync care team information for coordinated support

### Use Cases
- **Post-Discharge Support**: CHWs follow up with patients after hospital
  discharge to ensure medication adherence and prevent readmissions
- **SDOH Screening**: Community workers assess housing, food security,
  transportation needs
- **Chronic Disease Management**: Support patients with diabetes, hypertension,
  COPD between clinic visits
- **Medication Adherence**: CHWs help patients understand and follow medication
  regimens
- **Care Coordination**: Bridge clinical care (in Epic) with community resources

### Data Flow
Epic EHR → (FHIR API) → WellFit Community → CHW Mobile App → Community Health Worker

We READ data from Epic to inform CHW interventions. We do NOT write clinical
documentation back to Epic. Any clinical findings are documented by licensed
providers in Epic.

### Target Users
- Community Health Workers (CHWs)
- Care Coordinators
- Population Health Teams
- Social Workers
- Patients (via mobile app for self-management)

### Compliance
- HIPAA compliant
- SOC 2 Type II certified (in progress)
- PHI encryption at rest and in transit
- Audit logging of all data access
```

---

### STEP 4: Request FHIR Scopes (Week 1-2)

**IMPORTANT: Only request what you NEED. Epic reviews each scope carefully.**

**Select These Scopes:**

#### Patient-Level (User-Facing/Patient Consent Required)
```
patient/Patient.read           # Patient demographics
patient/Observation.read       # Vitals, labs (for CHW review)
patient/Condition.read         # Diagnoses (for care planning)
patient/MedicationRequest.read # Current medications
patient/AllergyIntolerance.read # Allergies (safety)
patient/CarePlan.read          # Care plans
patient/CareTeam.read          # Care team members
patient/Goal.read              # Patient goals
```

#### System-Level (Backend Service/Pre-authorized)
```
system/Patient.read            # Batch patient lookups
system/Observation.read        # Population health reporting
system/Condition.read          # Disease registry
system/MedicationRequest.read  # Medication adherence tracking
```

**Justification for Each Scope (Epic WILL Ask):**

**Patient.read:**
```
Required to identify patients, display demographics to CHWs, and link Epic
patients to WellFit Community user accounts.
```

**Observation.read:**
```
CHWs need to see recent vitals (BP, glucose, weight) to assess patient status
during home visits and phone check-ins. Helps identify concerning trends.
```

**Condition.read:**
```
CHWs must know patient diagnoses (diabetes, CHF, COPD) to provide appropriate
support and education. Essential for care planning.
```

**MedicationRequest.read:**
```
Critical for medication adherence support. CHWs help patients understand
medication regimens, identify barriers to adherence, and coordinate with
pharmacies.
```

**AllergyIntolerance.read:**
```
Safety requirement. CHWs conducting home visits must be aware of allergies
(medications, foods, environmental) to provide safe care coordination.
```

**CarePlan.read:**
```
CHWs align their support activities with physician-created care plans in Epic.
Ensures coordinated, patient-centered care.
```

**CareTeam.read:**
```
CHWs need to know who else is involved in patient care (PCP, specialists,
case managers) for effective care coordination.
```

**Goal.read:**
```
Patient goals (weight loss, A1C reduction, smoking cessation) guide CHW
interventions and accountability conversations.
```

---

### STEP 5: Configure OAuth/SMART Settings (Week 2)

**Redirect URIs (Add All):**

Development:
```
http://localhost:3000/smart-callback
http://localhost:3000/auth/epic/callback
```

Staging:
```
https://staging.thewellfitcommunity.org/smart-callback
https://staging.thewellfitcommunity.org/auth/epic/callback
```

Production:
```
https://app.thewellfitcommunity.org/smart-callback
https://app.thewellfitcommunity.org/auth/epic/callback
https://thewellfitcommunity.org/smart-callback
```

**Launch Types:**
- ✅ Standalone Launch (user initiates from WellFit app)
- ✅ EHR Launch (launched from Epic patient context)

**Token Endpoint Auth Method:**
```
client_secret_post
```

**PKCE Required:**
```
Yes (Epic requires PKCE for all apps)
```

---

### STEP 6: Upload Required Documentation (Week 2-3)

Epic requires these documents before approval:

#### 1. Privacy Policy
**Must include:**
- What patient data you collect
- How you use it (CHW support, care coordination)
- Who you share it with (CHWs, care coordinators)
- How patients can access/delete their data
- HIPAA compliance statement
- Epic data handling statement

**Template Location:** Create at `https://thewellfitcommunity.org/privacy`

#### 2. Terms of Service
**Must include:**
- User responsibilities
- Epic data usage restrictions
- Prohibited uses
- Termination rights

**Template Location:** Create at `https://thewellfitcommunity.org/terms`

#### 3. Security Documentation
Epic wants to see:
- Encryption methods (TLS 1.3, AES-256)
- Authentication (OAuth 2.0 + MFA)
- Access controls (RBAC)
- Audit logging
- Incident response plan
- Backup/disaster recovery

**Format:** PDF document (2-5 pages)

#### 4. HIPAA Business Associate Agreement (BAA)
- Epic will provide their standard BAA template
- Have your legal counsel review
- Sign and upload

#### 5. App Screenshots
Upload 3-5 screenshots showing:
1. CHW dashboard (de-identified data)
2. Patient profile (test data only)
3. Care plan view
4. Medication adherence tracking
5. SDOH assessment form

**Requirements:**
- 1920x1080 resolution
- PNG format
- No real patient data (use test/synthetic data)

#### 6. App Icon/Logo
- 512x512 pixels
- PNG with transparent background
- Professional quality

---

### STEP 7: Answer Epic's Security Questionnaire (Week 3)

Epic will send a security questionnaire. Key questions:

**Q: Where is patient data stored?**
```
A: Patient data is stored in Supabase PostgreSQL database hosted on AWS
(US-East-1). Data is encrypted at rest (AES-256) and in transit (TLS 1.3).
Backups are encrypted and retained for 30 days.
```

**Q: How do you handle Epic FHIR credentials?**
```
A: Client secrets are stored in Supabase Vault (encrypted key management).
Access tokens are encrypted in database and rotated every 60 minutes.
Refresh tokens are encrypted and rotated per Epic expiration policy.
```

**Q: Who has access to Epic data?**
```
A: Access is role-based:
- Community Health Workers: Read-only access to assigned patients
- Care Coordinators: Read-only access to care team patients
- Administrators: Configuration only, no patient data access
- Developers: No production data access (use de-identified sandbox only)

All access is logged with user ID, timestamp, patient ID, and data accessed.
```

**Q: Do you write data back to Epic?**
```
A: No. WellFit Community is read-only. CHW observations and interventions
are documented in WellFit. Clinical documentation remains in Epic,
entered by licensed providers.
```

**Q: How do you ensure HIPAA compliance?**
```
A:
- Business Associate Agreement with Epic
- Employee HIPAA training (annual)
- Minimum necessary access principle
- Encrypted data storage and transmission
- Audit logging of all PHI access
- Annual security risk assessments
- Incident response plan with 60-day breach notification
```

**Q: What happens if WellFit Community shuts down?**
```
A: Our BAA includes data return provisions. We will:
1. Provide Epic healthcare organizations with data export (FHIR format)
2. Securely delete all patient data within 30 days
3. Provide certificate of destruction
4. Revoke all API credentials
```

---

### STEP 8: Submit Application for Review (Week 3)

**Before submitting:**
- [ ] App description clearly positions as COMPLEMENTARY
- [ ] All required documents uploaded
- [ ] Privacy policy published and linked
- [ ] Terms of service published and linked
- [ ] Screenshots show professional, HIPAA-compliant UI
- [ ] Security questionnaire completed
- [ ] Contact information current
- [ ] All redirect URIs tested

**Click:** Submit for Epic Review

**Expected Timeline:**
- Initial review: 1-2 weeks
- Questions/revisions: 1-2 weeks
- Final approval: 1-2 weeks
- **Total: 4-8 weeks**

---

### STEP 9: Respond to Epic Reviewer Feedback (Week 4-6)

Epic reviewers may ask clarifying questions. **Common questions:**

**"How is this different from Epic's MyChart patient portal?"**
```
CORRECT ANSWER:
"WellFit Community is designed for Community Health Workers to coordinate
care between clinic visits, not for direct patient access to medical records.
MyChart is patient-facing for records access and messaging. We complement
MyChart by empowering CHWs to support patients who need extra help navigating
care, addressing SDOH barriers, and adhering to treatment plans. Many patients
using WellFit also use MyChart - they serve different purposes."
```

**"Why do you need system-level scopes?"**
```
CORRECT ANSWER:
"System-level scopes enable our population health features:
1. Identify high-risk patients for CHW outreach (pre-authorized by healthcare org)
2. Generate reports on medication adherence across patient panels
3. Track SDOH interventions at population level
4. Bulk export for analytics (diabetes registry, CHF monitoring)

Patient-level scopes are for individual CHW-patient interactions.
System-level scopes are for organizational care management."
```

**"Do you plan to add clinical documentation features?"**
```
CORRECT ANSWER:
"No. Clinical documentation belongs in Epic. WellFit Community tracks CHW
activities (phone calls, home visits, resource referrals) for care
coordination purposes. Any clinical findings discovered by CHWs are
communicated to providers who document in Epic. We intentionally stay
in our lane as a CHW coordination tool."
```

**"Are you planning an Epic App for in-EHR integration?"**
```
SAFE ANSWER:
"We're focused on standalone integration first via FHIR APIs. In the future,
we'd love to explore Epic App integration to enable EHR launch (e.g., provider
clicks patient chart → launches WellFit to assign CHW). This would enhance
Epic's value by making CHW coordination seamless. We'd follow Epic's App
development guidelines and partner with Epic for certification."
```

---

### STEP 10: Receive Sandbox Credentials (Week 6-7)

Once approved for sandbox testing:

**Epic will provide:**
- Sandbox Client ID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Sandbox FHIR Base URL: `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4`

**Test Patients Available:**
```javascript
const epicTestPatients = [
  {
    id: 'Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB',
    name: 'Jason Argonaut',
    mrn: '1234567'
  },
  {
    id: 'erXuFYUfucBZaryVksYEcMg3',
    name: 'Derrick Lin',
    mrn: '2345678'
  },
  {
    id: 'eq081-VQEgP8drUUqCWzHfw3',
    name: 'Amy Shaw',
    mrn: '3456789'
  }
];
```

**Add to `.env.local`:**
```bash
REACT_APP_EPIC_SANDBOX_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
REACT_APP_EPIC_SANDBOX_CLIENT_ID=your_sandbox_client_id_here
REACT_APP_EPIC_USE_SANDBOX=true
```

**Test Your Integration:**
```bash
npm run dev
# Navigate to Admin → FHIR Integrations
# Add Epic Sandbox connection
# Test patient data retrieval
```

---

### STEP 11: Complete Epic Certification Requirements (Week 8-10)

Epic may require certification testing:

**Functional Testing:**
- [ ] Successful OAuth 2.0 + SMART launch
- [ ] PKCE flow implementation
- [ ] Token refresh handling
- [ ] Read patient demographics
- [ ] Read observations (vitals)
- [ ] Read medications
- [ ] Read conditions
- [ ] Read care plans
- [ ] Handle errors gracefully (404, 401, 500)
- [ ] Respect rate limits (1000 req/hour)

**Security Testing:**
- [ ] TLS 1.3 enforcement
- [ ] No hardcoded credentials
- [ ] Encrypted token storage
- [ ] Session timeout (15 minutes idle)
- [ ] Audit logging enabled
- [ ] PHI access controls verified

**Usability Testing:**
- [ ] Clear error messages for users
- [ ] Help documentation available
- [ ] Contact support information visible

**Epic will provide test cases.** You must demonstrate success on each.

---

### STEP 12: Request Production Credentials (Week 10-12)

After sandbox certification passes:

**Submit Production Request:**
- Hospital/Health System Name: [Your Partner Organization]
- Epic Instance URL: [Provided by hospital IT]
- Go-live Date: [Target date]
- Technical Contact at Hospital: [Name, email, phone]
- Expected Patient Volume: [e.g., 500 patients in first year]

**Epic will coordinate with hospital to:**
1. Verify hospital authorizes your app
2. Configure FHIR API access on their Epic instance
3. Generate production client ID and secret
4. Whitelist your redirect URIs
5. Enable requested scopes

**You will receive:**
- Production Client ID
- Production Client Secret (store securely!)
- Hospital-specific FHIR base URL

---

### STEP 13: Production Deployment (Week 12+)

**Store Production Credentials:**

**.env.production:**
```bash
REACT_APP_EPIC_FHIR_URL=https://fhir.yourhospital.epic.com/FHIR/R4
REACT_APP_EPIC_CLIENT_ID=prod_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
REACT_APP_EPIC_USE_SANDBOX=false
```

**Supabase Production Secrets:**
```bash
npx supabase secrets set EPIC_CLIENT_SECRET="prod_secret_here" --project-ref YOUR_PROD_REF
```

**Test with Real Hospital:**
1. Coordinate go-live date with hospital IT
2. Test with 5-10 pilot patients first
3. Monitor logs for errors
4. Validate data accuracy
5. Train CHWs on new Epic integration features
6. Expand to full patient population

---

## 🚨 RED FLAGS TO AVOID

**DO NOT say these things to Epic:**

❌ "We're building a better EHR"
❌ "Epic is too complicated, we simplify it"
❌ "We're disrupting the EHR market"
❌ "We replace Epic modules"
❌ "We write clinical documentation"
❌ "We handle billing/claims"
❌ "We're like Epic but for small practices"
❌ "Our goal is to compete with Epic"

**INSTEAD, say:**

✅ "We complement Epic by extending care to the community"
✅ "We integrate WITH Epic to enhance patient engagement"
✅ "Epic remains the system of record for clinical data"
✅ "We read from Epic to inform CHW interventions"
✅ "We help Epic customers improve outcomes"
✅ "We're Epic's partner in value-based care"

---

## 📞 Epic Contacts During Process

**App Orchard Support:**
- Email: apporchard@epic.com
- Response time: 1-3 business days

**Technical Questions:**
- Epic FHIR Documentation: https://fhir.epic.com/
- Developer Forums: https://galaxy.epic.com/

**Escalation Path:**
If stuck for >2 weeks without response:
1. Email apporchard@epic.com with application ID
2. Call Epic main line: 608-271-9000 (ask for App Orchard team)
3. Reach out to hospital Epic analyst (your partner org)

---

## 📊 Success Metrics

**You'll know you're on track when:**
- ✅ Epic approves app within 4-8 weeks
- ✅ Sandbox credentials received
- ✅ All functional tests pass
- ✅ Production credentials granted
- ✅ First hospital goes live successfully
- ✅ No security incidents in first 90 days

---

## 🎯 Final Checklist Before Submission

**Organization:**
- [ ] Company name matches business registration
- [ ] Valid business address (not PO Box)
- [ ] Professional email domain (@thewellfitcommunity.org)
- [ ] Phone number answered during business hours

**App Profile:**
- [ ] App name emphasizes "Community Health Worker" or "Patient Engagement"
- [ ] Description positions as COMPLEMENTARY to Epic
- [ ] Categories: Patient Engagement, SDOH, Care Coordination
- [ ] No mention of "EHR" or "clinical documentation system"

**Documentation:**
- [ ] Privacy policy published at public URL
- [ ] Terms of service published at public URL
- [ ] Security documentation (2-5 page PDF)
- [ ] App screenshots (5 images, de-identified data only)
- [ ] App logo (512x512 PNG)

**Technical:**
- [ ] All redirect URIs use HTTPS (except localhost)
- [ ] SMART on FHIR support implemented
- [ ] PKCE flow working in code
- [ ] Token refresh logic implemented
- [ ] Rate limiting respected (1000/hour)

**Legal:**
- [ ] Legal counsel reviewed Epic's BAA
- [ ] HIPAA training completed for team
- [ ] Incident response plan documented
- [ ] Data retention policy defined (Epic requires <7 years)

**Testing:**
- [ ] Sandbox environment configured locally
- [ ] Can successfully retrieve test patient data
- [ ] Error handling tested (network failures, invalid tokens)
- [ ] Audit logs capturing all data access

---

## 📅 Suggested Timeline

| Week | Milestone | Owner |
|------|-----------|-------|
| 1 | Create Epic App Orchard account | You |
| 1-2 | Complete app profile and documentation | You + Legal |
| 2 | Publish privacy policy and terms | You |
| 3 | Submit application to Epic | You |
| 3-4 | Epic initial review | Epic |
| 4-5 | Respond to Epic questions | You |
| 5-6 | Epic final review | Epic |
| 6-7 | Receive sandbox credentials | Epic |
| 7-9 | Complete sandbox testing | You |
| 9-10 | Epic certification testing | Epic + You |
| 10-11 | Request production credentials | You |
| 11-12 | Epic coordinates with hospital | Epic + Hospital |
| 12+ | Production go-live | You + Hospital |

**Total Time: 12-16 weeks (3-4 months)**

---

## 🎓 Key Takeaways

1. **Position as COMPLEMENTARY, not competitive**
2. **Focus on Community Health Workers and SDOH**
3. **Emphasize "read-only" integration**
4. **Epic is system of record, you're coordination layer**
5. **Be patient - process takes 3-4 months**
6. **Partner with a hospital to strengthen application**
7. **Security documentation is critical**
8. **Never say you're replacing Epic functionality**

---

**Questions? Email: maria@thewellfitcommunity.org**

**Document Version:** 1.0
**Last Updated:** October 24, 2025
**Epic FHIR Version:** R4
**Next Review:** January 2026
