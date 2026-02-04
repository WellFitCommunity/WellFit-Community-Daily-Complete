# Epic App Orchard Application - Quick Reference Cheat Sheet

## 🎯 TL;DR - Key Points

**What Epic Should See:**
- ✅ Public safety app for senior wellness checks
- ✅ Patient demographics ONLY (read-only)
- ✅ Community-facing (law enforcement + family caregivers)
- ✅ Complementary to Epic (not competitive)

**What Epic Should NOT See:**
- ❌ Comprehensive FHIR R4 EHR integration
- ❌ Clinical data synchronization
- ❌ Provider-facing tools
- ❌ Writing data back to Epic

---

## ✅ DO SAY / ❌ DON'T SAY

### About Your App

| ✅ DO SAY | ❌ DON'T SAY |
|----------|-------------|
| "Patient-facing wellness check app for seniors" | "Comprehensive FHIR integration platform" |
| "Public safety tool for law enforcement welfare checks" | "EHR interoperability solution" |
| "Community health worker coordination" | "Clinical documentation system" |
| "Daily wellness check-ins and emergency response" | "Population health management platform" |
| "Family caregiver portal" | "Provider-facing care coordination tool" |

### About Epic Integration

| ✅ DO SAY | ❌ DON'T SAY |
|----------|-------------|
| "Pull patient demographics for enrollment only" | "Synchronize comprehensive patient data" |
| "Read-only integration, limited scope" | "Bi-directional data sync" |
| "Patient.read and RelatedPerson.read scopes" | "Full FHIR R4 resource support" |
| "No data written back to Epic" | "We update Epic with wellness check results" |
| "Epic remains system of record for clinical care" | "We're building a better EHR" |

### About Your Users

| ✅ DO SAY | ❌ DON'T SAY |
|----------|-------------|
| "Seniors, family caregivers, law enforcement constables" | "Clinicians, physicians, nurses" |
| "Community health workers and social workers" | "Healthcare providers and medical staff" |
| "Non-clinical public safety personnel" | "Clinical care teams" |

### About Data Flow

| ✅ DO SAY | ❌ DON'T SAY |
|----------|-------------|
| "Epic → (demographics) → WellFit Community → Family/Constables" | "Epic ↔ WellFit Community (bidirectional sync)" |
| "One-way, read-only pull of demographics" | "Real-time clinical data synchronization" |
| "Weekly sync to update contact information" | "Continuous sync of all patient resources" |

### About Functionality

| ✅ DO SAY | ❌ DON'T SAY |
|----------|-------------|
| "Daily wellness check-ins ('Are you OK?')" | "Clinical documentation and charting" |
| "Emergency access information for constables" | "Provider order entry and prescribing" |
| "Family emergency contact management" | "Care plan authoring and management" |
| "Welfare check dispatch and coordination" | "Clinical decision support" |

### About Positioning vs. Epic

| ✅ DO SAY | ❌ DON'T SAY |
|----------|-------------|
| "Complementary to Epic for public safety" | "Alternative to Epic for small practices" |
| "We integrate WITH Epic" | "We replace Epic functionality" |
| "Epic is system of record, we're coordination layer" | "We're disrupting the EHR market" |
| "Enhances Epic's value for community health" | "We do what Epic does but better" |

### About MyChart

| ✅ DO SAY | ❌ DON'T SAY |
|----------|-------------|
| "Different user base (law enforcement vs patients)" | "We're like MyChart but better" |
| "Different use case (safety vs medical records)" | "We're replacing MyChart patient portal" |
| "Many seniors use BOTH - no overlap" | "We compete with MyChart" |
| "MyChart is for healthcare, WellFit is for safety" | "MyChart doesn't do wellness check-ins right" |

### About FHIR Scopes

| ✅ DO SAY | ❌ DON'T SAY |
|----------|-------------|
| "Requesting patient/Patient.read for demographics" | "Requesting all FHIR R4 resources" |
| "Requesting patient/RelatedPerson.read for contacts" | "Requesting Observation, Condition, Medication..." |
| "No write scopes needed - read-only" | "We need write scopes for future features" |
| "Minimal scopes for stated use case" | "We want comprehensive access just in case" |

### About Security & Compliance

| ✅ DO SAY | ❌ DON'T SAY |
|----------|-------------|
| "HIPAA-compliant architecture with BAA" | "We don't need BAA, it's public safety data" |
| "Full encryption at rest and in transit" | "Security features coming in future release" |
| "Role-based access control with audit logging" | "Open access for all constables" |
| "SOC 2 Type II certification in progress" | "We'll worry about compliance later" |

---

## 📋 Application Quick Checklist

### Before Submission
- [ ] App name mentions "Senior Wellness" or "Welfare Check"
- [ ] Description says "public safety" or "community health"
- [ ] Description says "read-only demographics only"
- [ ] Description says "we do NOT write to Epic"
- [ ] ONLY Patient.read and RelatedPerson.read scopes requested
- [ ] Screenshots use test/synthetic data (no real patients)
- [ ] Privacy policy published and linked
- [ ] Hospital partner identified with letter of support
- [ ] NO mention of "FHIR R4 comprehensive integration"

---

## 🚨 Red Flags That Will Get You Rejected

1. **Requesting too many scopes**
   - ❌ Requesting Observation, Condition, MedicationRequest, etc.
   - ✅ Request ONLY Patient + RelatedPerson

2. **Positioning as EHR/clinical tool**
   - ❌ "We help providers document care"
   - ✅ "We help constables perform welfare checks"

3. **Vague use case**
   - ❌ "We improve patient engagement"
   - ✅ "We enable daily wellness check-ins for seniors and emergency welfare checks by law enforcement"

4. **No healthcare partner**
   - ❌ Submitting without hospital confirmation
   - ✅ Letter of support from Epic-using hospital

5. **Real patient data in screenshots**
   - ❌ Screenshots from production with real names
   - ✅ Test data only: "John Smith, 123 Main St"

6. **Competitive positioning**
   - ❌ "We're building a better EHR than Epic"
   - ✅ "Epic remains the system of record for clinical care"

---

## 🎯 FHIR Scopes to Request

### ✅ Request These ONLY:

```
launch/patient
patient/Patient.read
patient/RelatedPerson.read
offline_access
```

### ❌ DO NOT Request:

```
patient/Observation.read
patient/Condition.read
patient/MedicationRequest.read
patient/AllergyIntolerance.read
patient/Immunization.read
patient/Procedure.read
patient/Encounter.read
patient/CarePlan.read
patient/CareTeam.read
patient/Goal.read
patient/DiagnosticReport.read
system/*.read (unless absolutely necessary for batch enrollment)
Any *.write scopes
```

---

## 💬 Elevator Pitch (60 seconds)

```
WellFit Community is a public safety app that helps law enforcement constables
perform emergency welfare checks on seniors living at home.

Seniors receive a daily "Are you OK?" notification via text or mobile app. If
they don't respond for 2-6 hours, constables are alerted and can access critical
safety information: mobility status (bed-bound, wheelchair user), medical equipment
(oxygen, dialysis), emergency access instructions (key location, door codes), and
pet information.

We integrate with Epic to pull patient demographics (name, DOB, address, phone)
when seniors enroll in the program. This ensures constables have the correct
address for welfare checks. That's it - just demographics for enrollment. We
don't read clinical data, don't write anything back to Epic, and serve law
enforcement and family caregivers, not clinicians.

Epic remains the system of record for all clinical care. We're a public safety
tool, not an EHR. Think of us as complementary to Epic - helping keep Epic
patients safe at home.
```

---

## 📞 Epic Reviewer Questions - Quick Answers

### "Why do you need Epic integration?"
```
To pull patient demographics (name, DOB, address, phone) when seniors enroll
in constable-run SHIELD Program wellness checks. Ensures accurate addresses for
emergency welfare checks. Manually copying data leads to errors.
```

### "Is this a competitor to Epic?"
```
No. We're not an EHR, clinical documentation system, or provider tool. We're
a public safety app for law enforcement and family caregivers. Epic remains
the system of record for clinical care. Zero overlap.
```

### "Why not use MyChart?"
```
MyChart is for medical records and patient-provider communication. We're for
daily wellness check-ins and law enforcement welfare checks. Different users
(constables vs patients), different purpose (safety vs healthcare). Many
seniors use both - no overlap.
```

### "Do you write data back to Epic?"
```
No. Read-only integration. Wellness check-ins, emergency info, and welfare
check reports stay in WellFit. Clinical findings go to providers who document
in Epic manually. We have no write scopes.
```

### "Will you request more scopes later?"
```
No current plans. Demographics and emergency contacts are sufficient. If we
were to expand (e.g., medication reminders), we'd submit a new scope request
for Epic's review and approval. We understand scope approval is ongoing.
```

---

## 📊 Key Metrics for Epic

**When Epic asks about volume/impact:**

```
PILOT: 50-100 seniors in [County/Agency]
YEAR 1: 500-1,000 seniors across [Region]
YEAR 3: 2,000-5,000 seniors statewide

CONSTABLES SERVED: 10-20 constable offices in Year 1
WELFARE CHECKS PREVENTED: 80-90% reduction in false alarms
LIVES SAVED: Primary outcome metric
```

---

## 🗓️ Timeline Summary

| Milestone | Duration |
|-----------|----------|
| Create Epic account & complete app profile | Week 1 |
| Create documentation (privacy policy, security PDF) | Week 2 |
| Submit application to Epic | Week 3 |
| Epic initial review | Weeks 3-5 |
| Respond to Epic questions | Weeks 4-6 |
| Receive sandbox credentials | Weeks 5-6 |
| Complete sandbox testing | Weeks 7-9 |
| Epic certification testing | Weeks 8-10 |
| Request production credentials | Week 10-11 |
| Receive production credentials & go-live | Week 12+ |

**Total: 12-16 weeks (3-4 months)**

---

## 📁 Files to Prepare

1. **Privacy Policy** → https://thewellfitcommunity.org/privacy
2. **Terms of Service** → https://thewellfitcommunity.org/terms
3. **Security Documentation PDF** (3-5 pages)
4. **App Screenshots** (5 images, 1920x1080 PNG, test data only)
5. **App Logo** (512x512 PNG, transparent background)
6. **Hospital Letter of Support** (on hospital letterhead)

---

## ⚠️ Final Warning: What NOT to Mention

**NEVER say these things to Epic:**

1. "We have full FHIR R4 integration with Epic, Cerner, and Meditech"
2. "We're achieving 100% US Core compliance with all 13 resources"
3. "We sync CareTeam, CarePlan, Observation, Condition, Medication data"
4. "We have bidirectional sync capabilities"
5. "We're building an EHR interoperability platform"
6. "We help providers document clinical care"
7. "We're disrupting the EHR market"
8. "We're like Epic but easier to use"

**Instead, say:**

1. "We pull patient demographics for enrollment in public safety programs"
2. "We support Patient.read and RelatedPerson.read scopes only"
3. "We're a public safety and community health tool, not an EHR"
4. "We're read-only and complementary to Epic"
5. "Epic remains the system of record for all clinical care"

---

## 📞 Contact Epic Support

**Epic App Orchard Support:**
- Email: apporchard@epic.com
- Response time: 1-3 business days
- Include your application ID in all emails

**Epic FHIR Documentation:**
- https://fhir.epic.com/

**If Stuck for >2 Weeks:**
1. Email apporchard@epic.com with application ID
2. Call Epic main line: 608-271-9000 (ask for App Orchard team)
3. Contact hospital Epic analyst (your partner organization)

---

## ✅ Success Indicators

**You're on track if:**
- ✅ Epic approves your app description within 1-2 weeks
- ✅ Epic asks clarifying questions (not rejection - engagement!)
- ✅ Epic recognizes you're complementary, not competitive
- ✅ Hospital partner confirms support
- ✅ Sandbox credentials received by Week 6
- ✅ Production credentials received by Week 12

**Warning signs:**
- ⚠️ Epic asks "Are you building an EHR?" (revise positioning)
- ⚠️ Epic says "These scopes are too broad" (reduce to Patient + RelatedPerson)
- ⚠️ Epic asks "How is this different from a clinical tool?" (emphasize public safety)

---

**Last Updated:** November 11, 2025
**Version:** 1.0
**Positioning:** Public Safety / Community Health (NOT comprehensive EHR integration)

**Remember:** Be patient, be honest, be complementary. Focus on the welfare check use case. Keep scopes minimal. Partner with a hospital. You'll get approved!
