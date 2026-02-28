# Envision ATLUS I.H.I.S. -- User Manual

> **Intelligent Healthcare Interoperability System**
> For patients, caregivers, nurses, doctors, and administrators

> Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [For Patients and Seniors (WellFit)](#for-patients-and-seniors-wellfit)
3. [For Caregivers](#for-caregivers)
4. [For Nurses](#for-nurses)
5. [For Doctors and Providers](#for-doctors-and-providers)
6. [For Case Managers and Social Workers](#for-case-managers-and-social-workers)
7. [For Community Health Workers](#for-community-health-workers)
8. [For Administrators](#for-administrators)
9. [For Super Administrators](#for-super-administrators)
10. [Specialty Modules](#specialty-modules)
11. [Voice Commands](#voice-commands)
12. [EMS and Emergency Services](#ems-and-emergency-services)
13. [Accessibility Features](#accessibility-features)
14. [Privacy and Security](#privacy-and-security)
15. [Getting Help](#getting-help)

---

## Getting Started

### What Is This System?

Envision ATLUS I.H.I.S. is a health and wellness platform with two parts:

- **WellFit** -- A community wellness app for patients, seniors, and caregivers. Use it to check in on your health each day, track your medications, connect with your care team, and stay active.
- **Envision Atlus** -- A clinical care system for nurses, doctors, and hospital staff. It helps manage patient beds, write clinical notes, track medications, handle billing, and more.

You may use just one part or both, depending on your organization.

### Creating Your Account

There are three ways to get an account:

**1. Sign up yourself (WellFit App)**

- Go to `/register` or `/wellfit/register`
- Fill in your first name, last name, phone number, and email
- Create a password (at least 8 characters)
- Choose your role: Patient, Senior, Volunteer, Caregiver, Contractor, or Regular User
- Complete the security check (hCaptcha)
- Agree to the Terms of Service and Privacy Policy
- You will receive a text message with a verification code
- Enter the code on the next screen to finish setting up your account

**2. Enrolled by a nurse or admin (WellFit App)**

- A nurse or administrator creates your account for you
- They will give you a temporary password
- Log in and change your password in Settings

**3. Hospital patient record (Envision Atlus only)**

- Hospital staff create a clinical record for you
- This is for the hospital's internal use -- you do not log in with this type of record

### Logging In

**For patients and seniors:**
- Go to `/login` or `/wellfit/login`
- Enter your phone number and password
- Tap **Log In**

**For clinical staff (nurses, doctors, administrators):**
- Go to `/envision/login` or `/admin-login`
- Enter your credentials
- If your account requires two-factor authentication (2FA), you will be asked for a code from your authenticator app

**Forgot your password?**
- Tap **Forgot Password** on the login screen
- Go to `/reset-password`
- Follow the steps to set a new password

### Your Dashboard

After you log in, you are taken to the dashboard that matches your role:

| Your Role | Where You Go | Route |
|-----------|-------------|-------|
| Patient or Senior | Senior Community Dashboard | `/dashboard` |
| Caregiver | Caregiver Dashboard | `/caregiver-dashboard` |
| Nurse | Nurse Dashboard | `/nurse-dashboard` |
| Doctor or Physician | Physician Dashboard | `/physician-dashboard` |
| Case Manager | Case Manager Dashboard | `/case-manager-dashboard` |
| Social Worker | Social Worker Dashboard | `/social-worker-dashboard` |
| Admin | Admin Panel | `/admin` |
| Super Admin | Can access all dashboards | `/dashboard` (then navigate) |

---

## For Patients and Seniors (WellFit)

### Your Home Screen

When you log in, your home screen shows:

- **A daily greeting** personalized for you
- **Quick check-in buttons** -- Tell us how you feel today with one tap
- **Weather** for your area
- **Today's meal idea** -- A healthy recipe suggestion
- **Daily scripture or affirmation** -- An encouraging message
- **Upcoming appointments** -- Your next video visit
- **Community photo** -- A recent photo from your community
- **Emergency contact** -- Quick access to call for help

### Daily Check-In

**What it does:** Each day, you can record how you are feeling, your health numbers, and what you have been doing. Your care team uses this information to keep you healthy.

**How to use it:**

1. Go to `/check-in`
2. **Select your mood** -- Choose from Great, Good, Okay, Not Great, Sad, Anxious, Tired, or Stressed
3. **Enter your health numbers** (if you have them):
   - Blood pressure (top and bottom numbers)
   - Heart rate
   - Blood oxygen (SpO2) -- you can use the built-in pulse oximeter tool
   - Blood sugar (glucose)
   - Weight
4. **Tell us about your day:**
   - Physical activity (Walking, Gym, Swimming, Yoga, Dancing, Gardening, etc.)
   - Social engagement (Phone calls, Family visits, Church, etc.)
   - Any symptoms you are having
   - Notes about your day
5. Tap **Check In** to save

**Voice input:** You can tap the microphone button next to any text field to speak instead of type. This works in Chrome and Edge browsers.

**What happens with your data:** Your check-in is saved securely. Your care team can see your trends over time. If you report an emergency, the system will show crisis resources and can contact your emergency contact.

**Tip:** Try to check in at the same time each day. You can set a daily reminder time in Settings.

### My Health Hub

**What it does:** This is your central place to view all of your health information in one spot.

**How to get there:** Go to `/my-health`

**What you can see:**

| Section | Route | What It Shows |
|---------|-------|--------------|
| My Appointments | `/telehealth-appointments` | Your scheduled video doctor visits |
| My Vitals and Labs | `/health-observations` | Blood pressure, heart rate, lab results |
| My Vaccines | `/immunizations` | Your immunization records and any vaccines you may need |
| My Medications | `/medicine-cabinet` | Your current medications with AI-powered tracking |
| My Care Plans | `/care-plans` | Your active care plans and health goals |
| My Allergies | `/allergies` | Your allergies and intolerances |
| My Conditions | `/conditions` | Your medical conditions and diagnoses |

**Connected Devices:** If you have any of these devices, you can connect them to track your health automatically:

- Smartwatch (fall detection, heart rate, steps) -- Go to `/wearables`
- Smart Scale (weight, BMI) -- Go to `/devices/scale`
- Blood Pressure Monitor -- Go to `/devices/blood-pressure`
- Glucometer (blood sugar) -- Go to `/devices/glucometer`
- Pulse Oximeter (blood oxygen) -- Go to `/devices/pulse-oximeter`

**Download Your Records:** Tap "Download My Health Records" to go to `/health-records-download`. You can export your records in these formats:
- **PDF** -- Best for printing and sharing with your doctor
- **FHIR Bundle (JSON)** -- Standard healthcare format
- **C-CDA Document** -- Works with most hospital systems
- **CSV** -- Spreadsheet format

You have the right to access your own health records. This is required by federal law (the 21st Century Cures Act).

### Medicine Cabinet

**What it does:** Track all of your medications in one place.

**How to get there:** Go to `/medicine-cabinet`

**What you can do:**
- View all your current medications
- See when to take each medication
- Mark doses as taken
- Get AI-powered information about your medications
- Check for possible drug interactions

### Dental Health

**What it does:** Track your dental health, see your dental records, and get educational tips.

**How to get there:** Go to `/dental-health`

**What you can see:**
- A summary of your dental health
- Self-tracking tools for brushing and flossing
- Risk alerts
- Educational content about dental care

### Wellness and Engagement Activities

**Ask a Nurse:** Go to `/ask-nurse` to send a question to your care team. You can type or use voice input. A nurse will respond, and you may also see AI-suggested answers.

**Word Find Game:** Go to `/word-find` for a fun word puzzle game to keep your mind sharp.

**Memory Lane Trivia:** Go to `/memory-lane-trivia` for trivia questions designed to bring back good memories and keep you thinking.

**Community Moments:** Go to `/community` to see photos and stories shared by your community.

### Self-Reporting

**What it does:** A separate way to report how you are feeling, especially if you missed your daily check-in.

**How to get there:** Go to `/self-reporting`

You can record your mood, symptoms, blood pressure, blood sugar, blood oxygen, weight, physical activity, and social engagement.

### Telehealth Appointments

**What it does:** See your upcoming video doctor visits and join them right from the app.

**How to get there:** Go to `/telehealth-appointments`

**How to join a video visit:**
1. Find your appointment in the list
2. When it is time, tap **Join Call**
3. Allow your browser to use your camera and microphone
4. Your doctor will appear on screen

### Settings

**How to get there:** Go to `/settings`

**What you can change:**
- **Display** -- Font size (small, medium, large, extra-large)
- **Preferred name** -- What you want to be called
- **Notifications** -- Turn check-in reminders on or off, set your reminder time
- **Emergency contact** -- Name and phone number of someone to call in an emergency
- **Language** -- Choose your preferred language
- **Caregiver PIN** -- Set a 4-digit PIN to share with family members (see Caregivers section)
- **Passkey setup** -- Set up passwordless login using your device
- **Who viewed my data** -- See a history of who has accessed your health information

### Other Useful Pages

| Page | Route | What It Does |
|------|-------|-------------|
| Profile | `/profile` | View and edit your personal information |
| Demographics | `/demographics` | Update your demographic details |
| Health Insights | `/health-insights` | AI-generated insights about your health trends |
| Health Dashboard | `/health-dashboard` | A detailed view of your health data |
| Consent Management | `/consent-management` | Manage your privacy consents |
| Notice of Privacy Practices | `/notice-of-privacy-practices` | Read how your data is protected |
| Request Amendments | `/my-amendments` | Request changes to your health records |
| Help | `/help` | AI-powered help page to answer your questions |

---

## For Caregivers

If you are a family member or friend helping to care for someone, you can view their health information using a simple PIN system. You do not need to create an account.

### PIN-Based Access

**Step 1: Your loved one sets a PIN**
- The person you care for goes to `/set-caregiver-pin` in their Settings
- They create a 4-digit PIN and share it with you

**Step 2: You access their health data**
1. Go to `/caregiver-access`
2. Enter:
   - Your loved one's phone number
   - The 4-digit PIN they gave you
   - Your name and phone number (for the access log)
3. Tap **Access Health Data**

**Step 3: View their health information**
- You are taken to a read-only health dashboard at `/senior-view/:seniorId`
- You can see their recent check-ins, mood trends, and medications
- You can view printable health reports at `/senior-reports/:seniorId`

**Important:**
- Your session lasts 30 minutes, then you are automatically logged out
- All access is logged -- your loved one can see who viewed their data and when
- If the person changes their PIN, any previous PIN stops working
- You can only view data -- you cannot make changes

### Getting Alerts

If your loved one misses their daily check-in, the system can send you a notification so you can check on them.

### Registered Caregiver Dashboard

If you have been enrolled as a caregiver (role code 6) with a full account, you also have access to the Caregiver Dashboard at `/caregiver-dashboard`.

---

## For Nurses

### Nurse Dashboard

**How to get there:** Go to `/nurse-dashboard` or `/nurse-panel`

When you log in as a nurse, you are taken to your Nurse Dashboard. It is organized into tabs:

**Clinical Tab:**
- **Patient Priority Board** -- AI-ranked list of your patients by acuity and need
- **Risk Assessment Manager** -- View and manage patient risk scores
- **Shift Handoff Dashboard** -- Accept or hand off patients at shift change
- **Patient Enrollment** -- Enroll new patients with a generated temporary password
- **Question Manager** -- View and respond to patient questions with AI suggestions

**Telehealth Tab:**
- **Telehealth Scheduler** -- Schedule and manage video visits

**Documentation Tab:**
- **SmartScribe** -- AI-powered voice transcription for nursing notes (simple mode, no billing codes)
- **CCM Autopilot** -- Automatic tracking of patient interaction time for Chronic Care Management billing
- **Reports** -- View and export clinical reports

**Wellness Tab:**
- **NurseOS Resilience Hub** -- Resources for nurse wellness and burnout prevention
- **Claude Care Assistant** -- AI assistant for clinical questions

### Nurse Office Dashboard

**How to get there:** Go to `/nurse-office`

A comprehensive workspace with six tabs organized for the nursing workflow, including clinical tools, patient management, documentation, care coordination, reporting, and administration sections.

### Bed Management

**How to get there:** Go to `/bed-management`

**What you can do:**
- See all beds in the facility organized by unit
- Check which beds are available, occupied, or being cleaned
- Assign patients to beds
- Track bed status changes

**Voice commands:** You can say things like "Mark bed 205A ready" or "Start cleaning room 302."

### Shift Handoff

**How to get there:** Go to `/shift-handoff`

**What it does:** When your shift ends and a new nurse takes over, this tool helps you hand off your patients safely.

**How it works:**
1. View your current patients sorted by acuity (most critical first)
2. Each patient card shows their Patient Avatar with markers for devices, conditions, and precautions
3. Review the AI-generated shift summary
4. Add your own notes
5. The incoming nurse accepts the handoff
6. Everything is logged for safety

**Voice commands:** You can say "Accept all handoffs" or "Escalate patient in room 101."

### Medication Management

**How to get there:** Go to `/medication-manager`

**What you can do:**
- View all medications for your patients
- Track doses given
- Check for drug interactions
- Review AI-generated medication instructions

### Compass Riley (AI Scribe) -- SmartScribe Mode

**How to get there:** Go to `/compass-riley`

For nurses, Compass Riley runs in **SmartScribe mode** -- simple voice transcription to reduce documentation burden. You speak, and it writes your notes.

**How to use it:**
1. Select your patient
2. Choose **SmartScribe** mode (the default for nurses)
3. Tap the record button
4. Speak naturally about the patient encounter
5. The AI transcribes your words in real time
6. Review and save the note

### Nurse Census Board

**How to get there:** Go to `/nurse-census`

View all patients on your unit at a glance, with Patient Avatar indicators showing devices, conditions, and alert statuses.

### Patient Avatar

**What it does:** A visual body map showing every device, condition, and precaution on a patient. Colored dots on the body show central lines, tubes, wounds, and more. Badges around the body show code status, isolation type, fall risk, and allergies.

**Color guide:**
- **Red dots** -- Critical devices (central lines, chest tubes, tracheostomy)
- **Yellow dots** -- Moderate items (PICC lines, foley catheters, drains)
- **Blue dots** -- Informational (surgical incisions, implants)
- **Purple dots** -- Monitoring devices (heart monitor, insulin pump)
- **Green dots** -- Chronic conditions (diabetes, COPD, heart failure)
- **Orange dots** -- Neurological conditions (stroke, Parkinson's, epilepsy)

You can add markers, confirm AI-suggested markers from SmartScribe, or remove outdated markers.

---

## For Doctors and Providers

### Physician Dashboard

**How to get there:** Go to `/physician-dashboard`

When you log in as a physician, you are taken to your Physician Dashboard. It includes:

- **Patient Priority Board** -- AI-ranked list of patients sorted by clinical urgency
- **Patient Selector** -- Search and select patients from your panel
- **Patient Summary Card** -- Quick view of selected patient's vitals, conditions, risk level, and active medications
- **Quick Stats** -- Total patients, critical alerts, and pending tasks
- **Command Palette** -- Keyboard shortcut (Ctrl+K) for fast navigation
- **Workflow Mode Switcher** -- Toggle between Rounding, Charting, and Review modes

**Dashboard sections include:**
- SmartScribe / Compass Riley (AI documentation)
- Risk Assessments
- CCM Autopilot (Chronic Care Management billing)
- Telehealth (schedule and conduct video visits)
- Reports and Analytics
- Clinical Resources
- Physician Wellness Hub
- Claude Care Assistant (AI clinical reasoning partner)

### Physician Office Dashboard

**How to get there:** Go to `/physician-office`

A comprehensive six-tab workspace with 14 composed admin sections, organized for daily physician workflows.

### Patient Chart

**How to get there:** Go to `/patient-chart/:patientId`

A unified patient chart with tabs for:
- Medications
- Care plans
- Lab results
- Vital signs
- Immunizations
- Clinical notes
- Encounters

### Compass Riley (AI Scribe) -- Full Mode

**How to get there:** Go to `/compass-riley`

For physicians, Compass Riley runs in its full mode with three operating modes:

**1. Compass Riley Mode (default)**
- Full AI scribe with billing intelligence
- Speak naturally during the patient encounter
- AI generates SOAP notes, CPT codes, and ICD-10 codes
- Progressive clinical reasoning -- gets smarter as the encounter continues
- Anti-hallucination grounding -- only documents what was said
- PubMed evidence citations when relevant

**2. Consultation Mode**
- Switch to this when you want Riley to be a clinical reasoning partner
- Dictate a case and get:
  - Structured case presentation
  - Socratic reasoning steps
  - Differential diagnosis with red flags and key tests
  - Cannot-miss diagnosis warnings
  - Confidence calibration

**3. Peer Consult Prep**
- Generate SBAR-formatted consultation requests tailored to 12 specialties
- Urgency badges (stat, urgent, routine)

### Orders, Results, and Clinical Notes

**Clinical Alerts:** Go to `/clinical-alerts` to see all active alerts for your patients.

**Doctors View:** Go to `/doctors-view` to see the latest check-in vitals and self-reports from your community patients (blood pressure, heart rate, SpO2, glucose, mood, symptoms).

### AI-Assisted Documentation

The system includes AI tools that help with documentation:
- **SOAP Note Generator** -- Automatically creates structured notes from transcriptions
- **Progress Note Synthesizer** -- Creates progress notes from encounter data
- **Discharge Summary Generator** -- Writes discharge summaries
- **Care Plan Generator** -- Creates care plans based on patient data

All AI-generated content must be reviewed and approved by a clinician before it becomes part of the medical record.

### Referral Management

**How to get there:** Go to `/referrals`

**What you can do:**
- Track external referrals
- Link referred patients
- View referral completion status
- Generate engagement reports

---

## For Case Managers and Social Workers

### Case Manager Dashboard

**How to get there:** Go to `/case-manager-dashboard`

A dashboard focused on care coordination, case management, and social services.

### Social Worker Dashboard

**How to get there:** Go to `/social-worker-dashboard`

A dashboard with tools for social determinants of health assessments, community resources, and patient advocacy.

### Care Coordination

**How to get there:** Go to `/care-coordination`

**What you can do:**
- Manage care plans across teams
- Set up team alerts
- Coordinate between providers
- Get AI recommendations for care planning

### Readmission Prevention

**How to get there:** Go to `/readmissions` or `/community-readmission`

View readmission risk data, high-risk patient lists, and active care alerts.

### Discharge Tracking

**How to get there:** Go to `/discharge-tracking`

Track discharged patients and manage post-discharge follow-ups.

### Frequent Flyer Dashboard

**How to get there:** Go to `/frequent-flyers`

Identify patients with frequent visits to coordinate better care and reduce unnecessary admissions.

---

## For Community Health Workers

### CHW Dashboard

**How to get there:** Go to `/chw/dashboard`

A home base for community health workers in the field.

### Kiosk Check-In

**How to get there:** Go to `/kiosk/check-in` (no login required)

A self-service check-in station for community health events. Patients can check in on a shared tablet or kiosk.

### Field Tools

| Tool | Route | What It Does |
|------|-------|-------------|
| Vitals Capture | `/chw/vitals-capture` | Record patient vitals during home or community visits |
| Medication Photo | `/chw/medication-photo` | Photograph medication bottles for AI-powered identification |
| SDOH Assessment | `/chw/sdoh-assessment` | Conduct social determinants of health screenings |
| Telehealth Lobby | `/chw/telehealth-lobby` | Help patients connect to video visits |
| Kiosk Dashboard | `/chw/kiosk-dashboard` | Manage the community kiosk station |

---

## For Administrators

### Admin Dashboard Overview

**How to get there:** Go to `/admin`

The Admin Panel is your command center. It is organized into categories that you can expand and collapse. Use the search bar at the top to find any section quickly.

### Patient Care

| Section | What It Does |
|---------|-------------|
| Patient Engagement and Risk Assessment | See how active your patients are and spot those at risk |
| Encounter Provider Assignments | Assign doctors and nurses to patient encounters |
| Unacknowledged Results | Track critical lab results waiting for review |
| Provider Task Queue | Route tasks to providers with deadlines |
| Result Escalation Rules | Auto-route abnormal lab values to specialists |
| Provider Coverage and On-Call | Manage provider schedules and coverage |
| Patient Handoff System | Secure transfer of care between facilities |
| Smart Shift Handoff | AI-assisted nurse shift change |
| User Management | Manage patient and staff accounts |
| Staff Role Management | Assign and change staff roles with hierarchy rules |
| User Provisioning | Create new accounts and manage pending registrations |
| Hospital Patient Enrollment | Create clinical patient records |
| Paper Form Scanner | Upload photos of paper forms for AI data extraction |

### Revenue and Billing

| Section | What It Does |
|---------|-------------|
| SmartScribe Atlus | AI transcription for billing accuracy |
| Revenue Dashboard | Real-time revenue analytics |
| CCM Autopilot | Automatic chronic care management time tracking |
| Claims Submission Center | Generate and submit 837P claims |
| Claims Appeals | AI-assisted appeal letters for denied claims |
| Prior Authorization Center | Prior auth requests and decisions |
| SDOH Billing Encoder | Code social determinants for billing |
| Provider Registry | Register billing providers via NPI Registry |
| Billing and Claims Management | Monitor claims and revenue |
| Staff Financial Savings Tracker | Track cost savings by department |
| Superbill Provider Sign-Off | Review superbills before submission |
| Claim Aging Dashboard | Track claims by aging bucket |
| Undercoding Detection | Find missed billing opportunities |
| Documentation Gap Indicator | Alerts for missing documentation that affects billing |
| HCC Opportunity Flags | Identify expiring Medicare diagnoses |
| Billing Queue | One-click superbill generation from signed encounters |
| Eligibility Verification | Check insurance coverage before billing |
| ERA Payment Posting | Match payments to claims |
| Claim Resubmission Workflow | Correct and resubmit denied claims |

### Clinical Data

| Section | What It Does |
|---------|-------------|
| Quality Measures Dashboard | Track eCQM, HEDIS, MIPS, and Star Ratings |
| Public Health Reporting | Syndromic surveillance, immunization registry, eCR |
| AI-Enhanced FHIR Analytics | Patient insights and decision support |
| FHIR Questionnaire Builder | Create clinical questionnaires |
| FHIR Data Mapper | Transform legacy data to FHIR format |
| HL7/X12 Message Lab | Parse and validate HL7 and X12 messages |
| Reports and Analytics | System-wide reporting |
| Referral Aging Analysis | Track pending referrals by age |
| Specialist Confirmation Tracking | Close the referral loop |
| Care Gap Detection | Identify preventive care gaps |
| Clinical Note Summarization | Review AI-generated notes |

### Clinical Specialties (in Admin Panel)

| Section | What It Does |
|---------|-------------|
| Cardiology Dashboard | ECG, heart failure, cardiac rehab, device monitoring |
| Labor and Delivery Dashboard | Prenatal, labor, delivery, newborn, postpartum |
| Oncology Dashboard | Cancer registry, staging, chemo/radiation tracking |

### Security and Compliance

| Section | What It Does |
|---------|-------------|
| MFA Compliance | Monitor two-factor authentication enrollment |
| Facility Security Dashboard | Real-time security monitoring |
| Audit Logs | View PHI access logs and admin actions |
| Compliance Report | HIPAA compliance status |
| Configuration Change History | Audit trail of all config changes |
| Breach Notification Engine | HIPAA breach tracking and 60-day compliance |
| BAA Tracking Dashboard | Business associate agreement management |
| Patient Amendment Review Queue | Respond to patient record change requests |
| Workforce Training Compliance | Track HIPAA training completion |
| Encounter Audit Timeline | Audit trail of encounter changes |
| DSI Transparency -- AI Model Cards | AI/ML model documentation for HTI-1 compliance |

### System Administration

| Section | What It Does |
|---------|-------------|
| Facility Management | Manage hospitals and clinics |
| Module Configuration | Turn platform features on or off |
| EDI Clearinghouse Configuration | Set up claims clearinghouse connections |
| Data Export | Export data and access advanced tools |

### Other Admin Routes

| Route | What It Does |
|-------|-------------|
| `/admin/enroll-senior` | Enroll a community member with a temporary password |
| `/admin/bulk-enroll` | Enroll multiple members at once |
| `/admin/bulk-export` | Export data in bulk |
| `/admin/settings` | Admin settings |
| `/admin/audit-logs` | View full audit log |
| `/admin/system` | System administration |
| `/admin/photo-approval` | Approve community photos |
| `/admin/time-clock` | Staff time clock management |
| `/admin/prior-auth` | Prior authorization center |
| `/admin/care-gaps` | Care gap detection |
| `/admin/clinical-notes` | Clinical note summarization |
| `/admin/model-cards` | AI model transparency cards |
| `/admin/smart-apps` | SMART on FHIR app management |
| `/admin/safer-guides` | ONC SAFER Guides self-assessment |
| `/admin/ai-accuracy` | AI accuracy monitoring |
| `/admin/ai-cost` | AI cost monitoring (super admin only) |
| `/admin/ai-revenue` | AI revenue dashboard |
| `/admin/fhir-conflicts` | FHIR data conflict resolution |
| `/admin/healthcare-algorithms` | Healthcare algorithm registry |
| `/billing` | Billing dashboard |
| `/billing/review` | Billing review dashboard |
| `/it-admin` | IT administration dashboard |
| `/template-maker` | Create document templates |
| `/admin/reports` | Printable reports |

---

## For Super Administrators

Super administrators have access to everything plus platform-level tools.

### Super Admin Dashboard

**How to get there:** Go to `/super-admin`

### Platform Tools

| Route | What It Does |
|-------|-------------|
| `/tenant-selector` | Switch between organizations in a multi-tenant setup |
| `/multi-tenant-monitor` | Monitor all organizations at once |
| `/soc-dashboard` | SOC 2 compliance monitoring |
| `/enterprise-migration` | Manage data migrations between systems |
| `/guardian/dashboard` | Guardian Agent -- AI self-healing system monitor |
| `/guardian/approvals` | Review Guardian Agent proposed fixes |
| `/admin/ai-cost` | Monitor AI spending across the platform |

---

## Specialty Modules

These modules may or may not be available depending on your organization's plan.

### Labor and Delivery

**How to get there:** Go to `/pregnancy-care`

A full maternal-fetal care dashboard with five tabs:

| Tab | What It Covers |
|-----|---------------|
| Pregnancy Overview | Current pregnancy status, risk factors, key metrics |
| Prenatal Visits | Schedule and document prenatal appointments |
| Labor and Delivery | Real-time labor tracking, fetal monitoring, delivery records |
| Newborn | Newborn assessments and care |
| Postpartum | Postpartum recovery, PPD screening, follow-up visits |

**AI Features:**
- AI Birth Plan Generator
- Postpartum Depression Early Warning System
- Contraindication Checker for obstetric medications
- Patient Education Generator

### Cardiology

**How to get there:** Go to `/heart-health`

Tools for heart health management including ECG tracking, echocardiography records, heart failure management, cardiac rehabilitation, and device monitoring.

### Oncology

**How to get there:** Go to `/cancer-care`

Cancer care management including tumor registry, TNM staging, chemotherapy and radiation tracking, side effect monitoring (CTCAE), and survivorship planning.

### Neurological Suite

**How to get there:** Go to `/neuro-suite`

A dashboard for neurological conditions with tabs for:
- Stroke management
- Dementia care
- Parkinson's disease (medication tracking, UPDRS assessments, DBS sessions, symptom diary)
- Clinical alerts
- Wearable device integration

### Memory Clinic

**How to get there:** Go to `/memory-clinic/:patientId`

Specialized tools for memory assessment and dementia care.

### Physical Therapy

**How to get there:** Go to `/physical-therapy`

Tools for physical therapists including:
- ICF-based assessments
- Treatment plans with SMART goals
- Home exercise program (HEP) management
- Outcome measures (LEFS, ODI, and more)

### Mental Health

**How to get there:** Go to `/mental-health`

Mental health screening, monitoring, and care tools.

### Dental Health

**How to get there:** Go to `/dental-health`

Patient-facing dental health tracking, including self-tracking tools, risk alerts, and educational content.

---

## Voice Commands

The system includes voice commands for hands-free use. This is especially helpful for clinical staff who have their hands full.

### How to Activate

- **Keyboard shortcut:** Press `Ctrl + Shift + V` to start listening
- **Wake word:** Say "Hey Vision" to activate

### Available Commands

| What You Say | What Happens |
|-------------|-------------|
| "Shift handoff" | Go to the Shift Handoff page |
| "Available beds" | Filter the bed board to show available beds |
| "High risk patients" | Filter to show critical patients |
| "NeuroSuite" | Go to the Neurological Suite |
| "Care coordination" | Go to Care Coordination |
| "Refresh beds" | Reload bed board data |

### Privacy Commands

| What You Say | What Happens |
|-------------|-------------|
| "Pause for 5 minutes" | Stop listening for 5 minutes |
| "Mute for 10 minutes" | Stop listening for 10 minutes |
| "Privacy for 20 minutes" | Stop listening for 20 minutes |
| "Resume" or "Unpause" | Start listening again |

### Where Voice Commands Work

- Voice commands work on every page in the system
- Some pages have extra local commands (like the Bed Management and Shift Handoff pages)
- Voice works best in Chrome and Edge browsers
- No voice recordings are stored -- everything is processed locally on your device

---

## EMS and Emergency Services

### EMS Dashboard

**How to get there:** Go to `/ems`

Basic EMS information and resources.

### EMS Metrics

**How to get there:** Go to `/ems/metrics`

Response time analytics, transport data, and performance metrics for EMS operations.

### Hospital Transfer Portal

**How to get there:** Go to `/hospital-transfer`

Manage patient transfers between facilities with HIPAA-compliant documentation.

### Transfer Logs

**How to get there:** Go to `/transfer-logs`

View the history of all patient transfers, including sending facility, receiving facility, and transfer outcomes.

### ER Dashboard

**How to get there:** Go to `/er-dashboard`

Real-time view of emergency department activity for physicians and nurses.

### Staff Wellness

**How to get there:** Go to `/staff-wellness`

Resources and tools for clinical staff wellness and resilience.

---

## Accessibility Features

This system was designed with seniors and people with disabilities in mind.

### Large Text

- All text is at least 16 pixels
- You can make text even larger in Settings (choose from small, medium, large, or extra-large)

### Touch-Friendly Design

- All buttons and tap targets are at least 44x44 pixels
- Buttons are large and clearly labeled
- There is enough space between buttons to prevent accidental taps

### High Contrast

- Dark text on light backgrounds for easy reading
- Important alerts use bold colors (red for critical, yellow for warnings)
- WCAG AA contrast standards (4.5:1 minimum ratio)

### Voice Input

- Speak instead of type on check-in forms and question pages
- Voice commands for hands-free navigation (clinical staff)
- Works in Chrome and Edge browsers

### Language Support

- Multiple languages available
- Change your language in Settings

### Simple Navigation

- Clear labels on all buttons and links
- Back buttons on every page
- Role-based dashboards -- you only see what you need

---

## Privacy and Security

### How Your Data Is Protected

- **HIPAA compliant** -- The system follows all federal healthcare privacy rules
- **Encrypted** -- Your data is encrypted when stored and when sent over the internet
- **Role-based access** -- People can only see the data their role allows
- **Automatic logout** -- You are logged out after 15 minutes of no activity (with a 2-minute warning)
- **Audit trail** -- Every time someone views or changes health data, it is logged
- **PIN-based caregiver access** -- Family members get time-limited, read-only access

### Your Rights

- **View your records** -- Use My Health Hub (`/my-health`) to see your health data at any time
- **Download your records** -- Export your data in PDF, FHIR, C-CDA, or CSV format from `/health-records-download`
- **Request changes** -- Go to `/my-amendments` to request corrections to your health records
- **Manage consent** -- Go to `/consent-management` to manage your privacy consents
- **See who viewed your data** -- Go to Settings to see your access history

### For Clinical Staff

- Two-factor authentication may be required for your account
- All PHI access is logged
- Sessions time out after 15 minutes of inactivity
- Do not share your login credentials

---

## Getting Help

### In the App

- **Help page:** Go to `/help` for an AI-powered help assistant that can answer your questions
- **Ask a Nurse:** Go to `/ask-nurse` to send a question to your care team

### Emergency

If you are having a medical emergency, call **911** immediately. The app has emergency buttons on the check-in page that connect you to crisis resources.

### Technical Support

If you have trouble logging in, the app is not working correctly, or you need help with your account, contact your organization's administrator or reach out to:

**Envision Virtual Edge Group LLC**
Email: maria@wellfitcommunity.com

### Common Questions

**Q: I forgot my password.**
A: Go to `/reset-password` and follow the steps to create a new one.

**Q: My check-in did not save.**
A: Make sure you have an internet connection. If you were offline, the app will try to save your data when you reconnect.

**Q: I cannot see my medications or lab results.**
A: Go to My Health Hub (`/my-health`) and tap the section you want to view. If data is missing, it may not have been entered into the system yet. Ask your care team.

**Q: How do I change my font size?**
A: Go to Settings (`/settings`) and look for the Display section. Choose your preferred font size.

**Q: How do I set up a caregiver PIN?**
A: Go to Settings (`/settings`), scroll to the Caregiver PIN section, and create a 4-digit PIN. Share this PIN with the family member you want to grant access to.

**Q: Can I use this on my phone?**
A: Yes. The app works on phones, tablets, and computers. It adjusts to fit your screen size.

---

*Document Version: 1.0*
*Generated: February 2026*
*Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.*
