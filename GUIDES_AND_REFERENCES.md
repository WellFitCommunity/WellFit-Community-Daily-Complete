# WellFit Guides & Quick References
**Consolidated:** October 27, 2025
**Purpose:** All setup guides, testing guides, deployment guides, and quick reference documentation

---

## Quick Links
- [Deployment Guide](#deployment-guide)
- [Testing Guide](#testing-guide)
- [Database Setup](#database-setup)
- [API Keys & Credentials](#api-keys--credentials)
- [Common Workflows](#common-workflows)
- [Troubleshooting](#troubleshooting)

---

## Deployment Guide

### Local Development Setup

**Prerequisites:**
- Node.js 18+ installed
- npm 9+ installed
- Git installed
- Supabase CLI installed: `npm install -g supabase`

**Steps:**
```bash
# 1. Clone repository
git clone https://github.com/Envision-VirtualEdge-Group/WellFit-Community-Daily-Complete.git
cd WellFit-Community-Daily-Complete

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env

# 4. Add your API keys to .env (see Credentials section below)

# 5. Link to Supabase project
npx supabase link --project-ref xkybsjnvuohpqpbkikyn

# 6. Run database migrations
npx supabase db push

# 7. Start development server
npm run dev

# 8. Open browser to http://localhost:3000
```

### Production Deployment

**Hosting:** Netlify (recommended) or Vercel

**Netlify Deployment:**
```bash
# 1. Install Netlify CLI
npm install -g netlify-cli

# 2. Build production bundle
npm run build

# 3. Deploy to Netlify
netlify deploy --prod --dir=build

# 4. Configure environment variables in Netlify dashboard
# Settings > Environment variables > Add all keys from .env
```

**Environment Variables Required:**
- REACT_APP_SUPABASE_URL
- REACT_APP_SUPABASE_ANON_KEY
- REACT_APP_ANTHROPIC_API_KEY
- REACT_APP_DEEPGRAM_API_KEY
- REACT_APP_HCAPTCHA_SITE_KEY
- REACT_APP_ENCRYPTION_KEY
- REACT_APP_DAILY_CO_API_KEY

### Database Migrations

**Apply new migration:**
```bash
# Create migration file
npx supabase migration new migration_name

# Edit the .sql file in supabase/migrations/

# Apply to remote database
PGPASSWORD="$DATABASE_PASSWORD" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.xkybsjnvuohpqpbkikyn \
  -d postgres \
  -f supabase/migrations/YYYYMMDDHHMMSS_migration_name.sql
```

**Rollback migration:**
```bash
# Manually write a rollback .sql file
# Apply it the same way as forward migration
```

### Edge Functions Deployment

**Deploy all functions:**
```bash
cd supabase/functions
for func in */; do
  npx supabase functions deploy "${func%/}" --project-ref xkybsjnvuohpqpbkikyn
done
```

**Deploy single function:**
```bash
npx supabase functions deploy realtime_medical_transcription --project-ref xkybsjnvuohpqpbkikyn
```

**View function logs:**
```bash
npx supabase functions logs realtime_medical_transcription --project-ref xkybsjnvuohpqpbkikyn
```

---

## Testing Guide

### Run All Tests

```bash
# Unit tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint

# Build verification
CI=true npm run build
```

### Test Coverage

```bash
# Generate coverage report
npm test -- --coverage

# View coverage in browser
open coverage/lcov-report/index.html
```

### Manual Testing Checklist

**Registration Flow:**
1. Go to /register
2. Fill form with test data
3. Complete hCaptcha
4. Verify email sent
5. Click verification link
6. Verify redirect to login
7. Log in with new credentials

**Physician Scribe Workflow:**
1. Log in as physician
2. Select patient from list
3. Navigate to SMART Scribe tab
4. Click "Start Recording"
5. Speak clinical note (30+ seconds)
6. Verify Riley coaching appears
7. Verify billing codes appear
8. Verify SOAP note generates
9. Click "Stop Recording"
10. Verify session saved to database

**Nurse Enrollment Flow:**
1. Log in as nurse
2. Click "Enroll New Patient"
3. Fill patient demographics
4. Complete hCaptcha
5. Submit form
6. Verify patient appears in list
7. Verify audit log entry created

**Admin Billing Workflow:**
1. Log in as admin
2. Navigate to Billing tab
3. Select patient with scribe session
4. Click "Generate Claim"
5. Verify codes pre-populated from scribe
6. Add additional codes if needed
7. Click "Generate 837P"
8. Verify claim file downloads

### Integration Testing

**Epic FHIR Integration Test:**
```bash
# Requires Epic credentials (test environment)
# See: HOW_TO_GET_CLEARINGHOUSE_API_KEYS.md

# Test patient fetch
curl -X GET "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Patient/123" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test from app: PhysicianPanel → Patient List → Epic Sync
```

**Deepgram Real-Time Transcription Test:**
```bash
# In browser console while recording:
# Check WebSocket connection
wsRef.current?.readyState // Should be 1 (OPEN)

# Check transcript updates
transcript // Should update every 250ms
```

---

## Database Setup

### Schema Overview

**Core Tables:**
- `profiles` - User demographics (129 fields including FHIR resources)
- `user_roles` - RBAC assignments
- `scribe_sessions` - Medical scribe recordings
- `audit_logs` - HIPAA audit trail

**Billing Tables:**
- `billing_claims` - Insurance claims
- `claim_line_items` - CPT/ICD-10 codes
- `payments` - Payment tracking

**Clinical Tables:**
- `encounters` - Patient visits
- `observations` - Vital signs, labs
- `medications` - Medication list
- `conditions` - Problem list

**Full schema:** 89 tables, 2,400+ columns

### Common Database Queries

**Check scribe sessions:**
```sql
SELECT id, patient_id, provider_id,
       recording_duration_seconds,
       is_ccm_eligible,
       LENGTH(transcription_text) as transcript_length,
       jsonb_array_length(suggested_cpt_codes) as code_count,
       created_at
FROM scribe_sessions
ORDER BY created_at DESC
LIMIT 10;
```

**Check audit logs:**
```sql
SELECT event_type, event_category,
       user_id, success,
       metadata->>'patientId' as patient_id,
       created_at
FROM audit_logs
WHERE event_category = 'PHI_ACCESS'
ORDER BY created_at DESC
LIMIT 20;
```

**Check patient enrollment:**
```sql
SELECT p.user_id, p.first_name, p.last_name,
       p.email, p.role,
       r.role_name,
       p.created_at
FROM profiles p
LEFT JOIN user_roles ur ON p.user_id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE p.role = 'patient'
ORDER BY p.created_at DESC;
```

**Check RLS policies:**
```sql
SELECT tablename, policyname,
       cmd as operation,
       qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Database Backup & Restore

**Manual backup:**
```bash
PGPASSWORD="$DATABASE_PASSWORD" pg_dump \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.xkybsjnvuohpqpbkikyn \
  -d postgres \
  --no-owner \
  --no-acl \
  -F c \
  -f backup_$(date +%Y%m%d_%H%M%S).dump
```

**Restore from backup:**
```bash
PGPASSWORD="$DATABASE_PASSWORD" pg_restore \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.xkybsjnvuohpqpbkikyn \
  -d postgres \
  --no-owner \
  --no-acl \
  backup_20251027_120000.dump
```

---

## API Keys & Credentials

### Quick Reference

**Location:** `.env` file (NOT committed to git)

**Required Keys:**

1. **Supabase**
   - REACT_APP_SUPABASE_URL=https://xkybsjnvuohpqpbkikyn.supabase.co
   - REACT_APP_SUPABASE_ANON_KEY=[Get from Supabase Dashboard > Settings > API]

2. **Anthropic (Claude)**
   - REACT_APP_ANTHROPIC_API_KEY=[Get from console.anthropic.com]
   - Used for: SMART Scribe AI analysis

3. **Deepgram**
   - REACT_APP_DEEPGRAM_API_KEY=[Get from deepgram.com/console]
   - Used for: Real-time speech-to-text

4. **hCaptcha**
   - REACT_APP_HCAPTCHA_SITE_KEY=[Get from hcaptcha.com/dashboard]
   - Used for: Registration bot prevention

5. **Daily.co (Telehealth)**
   - REACT_APP_DAILY_CO_API_KEY=[Get from daily.co/dashboard]
   - Used for: Video consultations

6. **Encryption**
   - REACT_APP_ENCRYPTION_KEY=[Generate with: openssl rand -base64 32]
   - Used for: PHI field encryption

7. **Clearinghouse (Billing)**
   - See: HOW_TO_GET_CLEARINGHOUSE_API_KEYS.md
   - Used for: 837P claim submission

### How to Get Clearinghouse API Keys

**Steps:**
1. Choose clearinghouse provider:
   - Change Healthcare (recommended)
   - Availity
   - Trizetto

2. Apply for account:
   - Business verification (EIN, business license)
   - HIPAA compliance attestation
   - Technical integration review

3. Complete testing:
   - Submit test claims to sandbox environment
   - Verify 997/999 acknowledgment handling
   - Pass certification tests

4. Get production credentials:
   - Production API endpoint
   - API key / Client ID
   - Secret key

5. Add to `.env`:
   ```
   REACT_APP_CLEARINGHOUSE_API_KEY=your_key
   REACT_APP_CLEARINGHOUSE_ENDPOINT=https://api.changehealthcare.com/
   ```

**Timeline:** 2-4 weeks from application to production access

---

## Common Workflows

### Add a New User Role

**Steps:**
1. Add role to database:
```sql
INSERT INTO roles (role_name, role_code, description)
VALUES ('Pharmacist', 'PHARMACIST', 'Medication management');
```

2. Create RLS policies for the role:
```sql
-- Allow pharmacists to view patient medications
CREATE POLICY pharmacist_view_medications
ON medications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.role_code = 'PHARMACIST'
  )
);
```

3. Update frontend role types:
```typescript
// src/types/roles.ts
export type UserRole =
  | 'patient'
  | 'physician'
  | 'nurse'
  | 'admin'
  | 'pharmacist'; // ADD THIS
```

4. Add role to registration flow (if self-service)
5. Add role-specific dashboard component
6. Test access controls

### Add a New FHIR Resource

**Example: Adding AllergyIntolerance**

1. Update database schema:
```sql
ALTER TABLE profiles
ADD COLUMN fhir_allergy_intolerance JSONB;
```

2. Create TypeScript interface:
```typescript
// src/types/fhir.ts
export interface AllergyIntolerance {
  resourceType: 'AllergyIntolerance';
  id?: string;
  clinicalStatus: CodeableConcept;
  verificationStatus: CodeableConcept;
  type?: 'allergy' | 'intolerance';
  category?: ('food' | 'medication' | 'environment' | 'biologic')[];
  criticality?: 'low' | 'high' | 'unable-to-assess';
  code?: CodeableConcept;
  patient: Reference;
  reaction?: Array<{
    substance?: CodeableConcept;
    manifestation: CodeableConcept[];
    severity?: 'mild' | 'moderate' | 'severe';
  }>;
}
```

3. Add to UI (PhysicianPanel):
```typescript
// src/components/physician/AllergySection.tsx
// Display list of allergies
// Add/edit/delete functionality
// Validate against FHIR spec
```

4. Add to Epic integration:
```typescript
// src/services/epicFhirService.ts
async function fetchAllergies(patientId: string) {
  const response = await fetch(
    `${EPIC_BASE_URL}/AllergyIntolerance?patient=${patientId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/fhir+json'
      }
    }
  );
  return response.json();
}
```

### Deploy a Hotfix

**Process:**
```bash
# 1. Create hotfix branch
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug-fix

# 2. Make fix (minimal changes only)
# Edit files...

# 3. Test locally
npm run typecheck
npm test
CI=true npm run build

# 4. Commit
git add .
git commit -m "hotfix: Fix critical bug in scribe recording"

# 5. Push and create PR
git push origin hotfix/critical-bug-fix
gh pr create --title "HOTFIX: Critical scribe bug" --body "Fixes issue where..."

# 6. Get emergency review
# Tag reviewer with @mention in PR

# 7. Merge to main
gh pr merge --squash

# 8. Deploy to production immediately
netlify deploy --prod --dir=build

# 9. Monitor for errors
# Check Supabase logs, user reports

# 10. Create post-mortem doc (if major incident)
```

---

## Troubleshooting

### Common Issues

#### "Cannot connect to database"

**Symptoms:** App shows "Database connection error"

**Causes:**
- Supabase project paused (free tier inactivity)
- Network issue
- Invalid credentials in .env

**Fix:**
```bash
# 1. Check Supabase project status
# Go to: https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn

# 2. If paused, click "Resume project"

# 3. Verify credentials
cat .env | grep SUPABASE

# 4. Test connection
PGPASSWORD="$DATABASE_PASSWORD" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.xkybsjnvuohpqpbkikyn \
  -d postgres \
  -c "SELECT 1"
```

#### "hCaptcha widget not showing"

**Symptoms:** Registration page shows empty box where hCaptcha should be

**Causes:**
- Missing REACT_APP_HCAPTCHA_SITE_KEY in .env
- Ad blocker blocking hCaptcha script
- CSP (Content Security Policy) blocking hCaptcha

**Fix:**
```bash
# 1. Check .env has key
grep HCAPTCHA .env

# 2. If missing, add it:
echo "REACT_APP_HCAPTCHA_SITE_KEY=your_site_key" >> .env

# 3. Restart dev server
npm run dev

# 4. Disable ad blocker temporarily
# 5. Check browser console for CSP errors
```

#### "Recording starts but no transcript"

**Symptoms:** SMART Scribe recording indicator shows, but no text appears

**Causes:**
- Microphone permission denied
- Deepgram API key invalid
- WebSocket connection failed
- Edge function error

**Fix:**
```bash
# 1. Check microphone permission in browser
# Look for microphone icon in address bar

# 2. Check Deepgram API key
grep DEEPGRAM .env

# 3. Check browser console for WebSocket errors
# Look for: "WebSocket connection failed"

# 4. Check Edge function logs
npx supabase functions logs realtime_medical_transcription

# 5. Test Deepgram API directly
curl -X POST "https://api.deepgram.com/v1/listen" \
  -H "Authorization: Token YOUR_DEEPGRAM_KEY" \
  -H "Content-Type: audio/wav" \
  --data-binary @test_audio.wav
```

#### "SOAP note not generating"

**Symptoms:** Transcript and codes appear, but no SOAP note section

**Causes:**
- Edge function not updated (old version deployed)
- Claude API error
- Transcript too short (< 50 words)

**Fix:**
```bash
# 1. Redeploy Edge function
cd supabase/functions/realtime_medical_transcription
npx supabase functions deploy realtime_medical_transcription --project-ref xkybsjnvuohpqpbkikyn

# 2. Check Claude API key
# In Supabase dashboard: Edge Functions > Secrets
# Verify ANTHROPIC_API_KEY is set

# 3. Speak longer clinical note (30+ seconds)

# 4. Check Edge function logs for errors
npx supabase functions logs realtime_medical_transcription
```

#### "Database insert fails: RLS policy violation"

**Symptoms:** "Error saving session: RLS policy violation"

**Causes:**
- User not authenticated
- User doesn't have required role
- RLS policy too restrictive

**Fix:**
```bash
# 1. Check user authentication
# In browser console:
await supabase.auth.getUser()

# 2. Check user role
SELECT ur.user_id, r.role_code
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = 'USER_ID_HERE';

# 3. Check RLS policies
SELECT policyname, qual
FROM pg_policies
WHERE tablename = 'scribe_sessions'
AND cmd = 'INSERT';

# 4. If policy too restrictive, update it
# (Be careful - don't bypass security!)
```

---

## Recording & Telehealth

### Manual Recording Guide

**For providers without AI scribe:**

1. Start voice recorder on phone/computer
2. Conduct patient visit normally
3. After visit, stop recording
4. Upload audio file to WellFit portal
5. AI will process and generate:
   - Transcript
   - SOAP note
   - Billing codes
6. Review and approve

**Upload location:** PhysicianPanel > Documentation > Upload Recording

### Retrieve Past Recordings

**Database query:**
```sql
SELECT id, patient_id, provider_id,
       recording_started_at,
       recording_duration_seconds,
       transcription_text,
       ai_note_subjective, ai_note_objective,
       ai_note_assessment, ai_note_plan,
       created_at
FROM scribe_sessions
WHERE provider_id = 'YOUR_USER_ID'
ORDER BY created_at DESC;
```

**Via UI:** PhysicianPanel > Documentation > Past Sessions

### Telehealth Go-Live Checklist

**Pre-Launch (1 week before):**
- [ ] Test Daily.co integration in staging
- [ ] Verify HIPAA BAA with Daily.co signed
- [ ] Train staff on video visit workflow
- [ ] Create patient instruction guide
- [ ] Test on multiple devices/browsers

**Launch Day:**
- [ ] Provider starts video visit from PhysicianPanel
- [ ] Patient receives SMS with join link
- [ ] Patient clicks link → Video starts (no app download)
- [ ] Encounter auto-created in database
- [ ] Recording enabled (if consented)

**Post-Visit:**
- [ ] Recording auto-saved to scribe_sessions
- [ ] SOAP note generated
- [ ] Billing codes suggested
- [ ] Patient satisfaction survey sent

---

## Paper Form Scanner

**Purpose:** Convert paper intake forms to structured FHIR data

**Setup:**
1. Install scanner app on iPad/tablet
2. Configure OCR settings (Tesseract or Google Cloud Vision)
3. Map form fields to FHIR Patient resource
4. Test with sample forms

**Workflow:**
1. Patient fills paper form at check-in
2. Staff scans form with iPad
3. OCR extracts text
4. AI (Claude) maps to structured data
5. Staff reviews for accuracy
6. Save to patient chart

**Accuracy:** ~95% for printed text, ~85% for handwriting

---

## Drug Interaction Checker

**API:** FDB MedKnowledge (First Databank)

**Setup:**
```bash
# Add to .env
REACT_APP_FDB_API_KEY=your_fdb_key
REACT_APP_FDB_API_ENDPOINT=https://api.fdbhealth.com/

# Install FDB client
npm install @fdbhealth/med-knowledge-client
```

**Usage:**
```typescript
// Check interactions between medications
import { checkInteractions } from '@/services/drugInteractionService';

const interactions = await checkInteractions([
  'acetaminophen 500mg',
  'warfarin 5mg',
  'ibuprofen 200mg'
]);

// Returns: [{
//   severity: 'moderate',
//   description: 'Ibuprofen may increase bleeding risk with warfarin',
//   recommendation: 'Monitor INR closely'
// }]
```

---

**Sources:**
- AI_SYSTEM_RECORDING_GUIDE.md
- CREDENTIALS_QUICK_REFERENCE.md
- DEPLOYMENT_GUIDE.md
- DRUG_INTERACTION_API_GUIDE.md
- HANDOFF_TESTING_GUIDE.md
- HOW_TO_GET_CLEARINGHOUSE_API_KEYS.md
- HOW_TO_RETRIEVE_RECORDINGS.md
- IMMEDIATE_ACTION_PLAN.md
- IMPLEMENTATION_INSTRUCTIONS.md
- MANUAL_RECORDING_GUIDE.md
- MCP_SETUP_COMPLETE.md
- PAPER_FORM_SCANNER_DESIGN.md
- PAPER_FORM_SCANNER_GUIDE.md
- PAPER_FORM_SCANNER_SETUP.md
- PWA_PRODUCTION_VERIFICATION.md
- QUICK_TEST_GUIDE.md
- REGISTRATION_FIX_GUIDE.md
- SCHEMA_VERIFICATION.md
- SMART_RECORDING_EXPLAINED.md
- TELEHEALTH_GO_LIVE_CHECKLIST.md
- TELEHEALTH_TESTING.md
- TESTING_AND_QA_GUIDE.md
- TESTING_PROGRESS_REPORT.md
- TEST_FIXES_NEEDED.md
- VERIFICATION_REPORT.md
