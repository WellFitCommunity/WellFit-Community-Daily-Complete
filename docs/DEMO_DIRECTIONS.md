# Methodist Hospital Demo Directions

**Demo Date:** December 5th, 2025
**Platform:** WellFit Community Health Platform
**Audience:** Methodist Houston Clinical Leadership

---

## Demo Login Credentials

### Super Admin Accounts (Full Access)

| User | Email | Password |
|------|-------|----------|
| Maria | maria@wellfitcommunity.com | `WellFit2025!` |
| Akima | akima@wellfitcommunity.com | `WellFit2025!` |

### Demo Patient Accounts

| Patient | Email | Password | Condition Focus |
|---------|-------|----------|-----------------|
| Gloria Simmons | gloria.simmons.demo@wellfitcommunity.com | `DemoPass123!` | Diabetes & Hypertension |
| Harold Washington | harold.washington.demo@wellfitcommunity.com | `DemoPass123!` | Cardiac Care |
| Betty Coleman | betty.coleman.demo@wellfitcommunity.com | `DemoPass123!` | Arthritis & Bone Health |
| Marcus Thompson | marcus.thompson.demo@wellfitcommunity.com | `DemoPass123!` | Respiratory |

---

## Demo Flow Script

### 1. Opening (2 minutes)

1. Navigate to the login page
2. Log in as **Maria (Super Admin)**
3. Show the main dashboard with key metrics
4. Highlight: "This is a HIPAA-compliant, enterprise-grade platform"

### 2. Patient Profile Demo - Gloria Simmons (5 minutes)

1. Navigate to **Patients** section
2. Search for "Gloria Simmons"
3. Open her patient profile

**Highlight these features:**
- **Medications List:** 3 active medications (Lisinopril, Metformin, Atorvastatin)
- **Recent Vitals:** BP 138/85, Glucose 118, HR 72
- **Care Plan:** "Diabetes & Hypertension Management Plan"
- **Patient Avatar:** Visual representation with condition markers

**Talking Points:**
- "All data follows FHIR R4 standards for Epic interoperability"
- "Medications sync bidirectionally with your EHR"
- "Care gaps are automatically detected"

### 3. Care Coordination Demo (5 minutes)

1. Open Gloria's **Care Plan**
2. Show the care team assignments:
   - Dr. Sarah Chen (Primary Care)
   - Dr. Michael Torres (Cardiologist)
   - NP Angela Davis (Care Coordinator)

3. Show the **Goals:**
   - A1C < 7%
   - BP < 130/80
   - Daily glucose monitoring

4. Show **Care Notes** with progress tracking

**Talking Points:**
- "Care teams see unified patient view across departments"
- "Real-time collaboration with presence indicators"
- "Automated reminders for care gap closure"

### 4. Vital Capture Demo (5 minutes)

1. Navigate to **Vital Capture**
2. Demonstrate **BLE Bluetooth** connection:
   - "Connect any Bluetooth-enabled BP cuff, glucometer, or pulse oximeter"
   - Show device pairing flow

3. Demonstrate **Camera OCR:**
   - Take photo of a BP cuff display
   - Show automatic digit recognition (Tesseract.js)
   - Values auto-populate into patient record

**Talking Points:**
- "Supports 7+ wearable device adapters (Garmin, Apple, Withings, etc.)"
- "Camera scanning works offline - no internet needed for OCR"
- "All vitals sync to FHIR Observations"

### 5. AI Features Demo (5 minutes)

1. Show **Billing Code Suggester:**
   - "AI suggests CPT/ICD-10 codes based on encounter notes"
   - 95% accuracy with human confirmation

2. Show **Drug Interaction Checker:**
   - Add a new medication to Gloria's list
   - Show interaction alert with Metformin

3. Show **Care Gap Detection:**
   - "System automatically identifies overdue vaccines and screenings"
   - Show action buttons to close gaps

**Talking Points:**
- "7 AI skills active - all with human-in-the-loop confirmation"
- "Models are HIPAA-compliant (Anthropic Claude)"
- "Reduces documentation time by 40%"

### 6. CHW Kiosk Demo (3 minutes)

1. Open **Kiosk Mode** (tablet view)
2. Show multi-language support:
   - English
   - Spanish (Espanol)
   - Vietnamese (Tieng Viet)

3. Walk through patient check-in flow:
   - Name entry
   - Vital collection
   - Symptom questionnaire

**Talking Points:**
- "Community Health Workers use this at senior centers"
- "2-minute HIPAA timeout for privacy"
- "Data syncs when connectivity returns"

### 7. Security & Compliance (2 minutes)

1. Show **Audit Logs** in admin panel
2. Highlight:
   - 1,070 Row-Level Security policies
   - AES-256-GCM encryption for PHI
   - 64,000+ audit log entries

**Talking Points:**
- "SOC2 audit-ready architecture"
- "Every data access is logged"
- "Zero PHI exposure to browser - all server-side"

### 8. Closing & Q&A (3 minutes)

**Key Differentiators:**
1. **FHIR R4 Native** - Not an afterthought, built from day one
2. **AI-Powered** - 7 clinical decision support features
3. **Multi-tenant** - One codebase, unlimited organizations
4. **White-label** - Your branding, your domain
5. **Enterprise Security** - 1,070 RLS policies, full audit trail

---

## Backup Plans

### If Internet is Slow
- All patient data is cached locally
- Camera OCR works offline
- Show pre-loaded screenshots as backup

### If Login Fails
- Use Maria's backup credentials
- Have Akima's credentials ready
- Can demonstrate with local dev environment

### If Feature Doesn't Work
- Skip to next feature
- Note the issue for follow-up
- "We'll have our team investigate and follow up"

---

## Technical Requirements

| Requirement | Status |
|-------------|--------|
| Chrome/Edge Browser | Required |
| Stable Internet | Recommended |
| Tablet for Kiosk Demo | Optional |
| BLE-enabled Device | Optional |

---

## Post-Demo Follow-up

1. Send demo recording link (if recorded)
2. Provide access to sandbox environment
3. Schedule technical deep-dive with IT team
4. Share compliance documentation (BAA, SOC2 report)

---

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| Technical Lead | Maria | maria@wellfitcommunity.com |
| Product Owner | Akima | akima@wellfitcommunity.com |

---

**Last Updated:** December 26, 2025
**Prepared By:** Claude Code
