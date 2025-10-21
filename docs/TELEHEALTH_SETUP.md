# WellFit Telehealth Platform - Setup Guide

## Overview

WellFit now includes a comprehensive HIPAA-compliant telehealth platform powered by Daily.co, integrated with SmartScribe for real-time medical transcription and coding suggestions.

### Features

- **HIPAA-Compliant Video Consultations**: Encrypted end-to-end video calls
- **SmartScribe Integration**: Real-time transcription and CPT/ICD-10 coding during calls
- **ER Telehealth**: Emergency remote consultations with priority handling
- **Stethoscope Audio Streaming**: Support for Bluetooth digital stethoscopes (Eko, Littmann, Thinklabs)
- **Encounter Tracking**: Automatic FHIR encounter creation and billing integration
- **Patient Waiting Room**: Professional waiting experience for patients
- **Recording & Compliance**: Cloud recordings for documentation and training

## Prerequisites

1. **Daily.co Account** (HIPAA-compliant tier required)
2. **Supabase Project** (already configured)
3. **Anthropic API Key** (for SmartScribe - already configured)
4. **Digital Stethoscope** (optional, for remote auscultation)

## Step 1: Daily.co Account Setup

### 1.1 Create Daily.co Account

1. Go to [https://www.daily.co](https://www.daily.co)
2. Sign up for a **Healthcare/HIPAA plan** (required for HIPAA compliance)
3. Navigate to **Developers > API Keys**
4. Create a new API key with full permissions

### 1.2 Sign BAA (Business Associate Agreement)

1. Contact Daily.co sales to sign the BAA
2. This is **required** for HIPAA compliance
3. Much simpler than Twilio's process!

### 1.3 Enable Required Features

In your Daily.co dashboard, ensure these features are enabled:
- ✅ Cloud Recording
- ✅ Advanced Audio (for stethoscope streaming)
- ✅ Waiting Rooms
- ✅ Screen Sharing

## Step 2: Configure Supabase Secrets

Add your Daily.co API key to Supabase:

```bash
# Using Supabase CLI
npx supabase secrets set DAILY_API_KEY=your_daily_api_key_here

# Or via Supabase Dashboard:
# Project Settings > Edge Functions > Secrets
# Add: DAILY_API_KEY = your_daily_api_key_here
```

Verify all required secrets are set:

```bash
npx supabase secrets list
```

You should see:
- ✅ `DAILY_API_KEY`
- ✅ `ANTHROPIC_API_KEY` (for SmartScribe)
- ✅ `DEEPGRAM_API_KEY` (for transcription)
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

## Step 3: Deploy Database Migration

Run the telehealth migration:

```bash
PGPASSWORD="your_db_password" psql -h your_db_host -p 6543 -U postgres.your_project_ref -d postgres -f supabase/migrations/20251020200000_create_telehealth_tables.sql
```

This creates:
- `telehealth_sessions` table
- `telehealth_session_events` table
- RLS policies
- Audit triggers

Verify migration:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'telehealth%';

-- Should return:
-- telehealth_sessions
-- telehealth_session_events
```

## Step 4: Deploy Edge Functions

Deploy the telehealth edge functions:

```bash
# Deploy room creation function
npx supabase functions deploy create-telehealth-room --project-ref your_project_ref

# Deploy patient token function
npx supabase functions deploy create-patient-telehealth-token --project-ref your_project_ref
```

Verify deployment:

```bash
npx supabase functions list --project-ref your_project_ref
```

## Step 5: Test the Integration

### 5.1 Provider Flow

1. Log in as a physician
2. Navigate to **Physician Panel**
3. Select a patient from the patient list
4. Click one of the telehealth buttons:
   - **Telehealth Visit** - Standard outpatient
   - **ER Telehealth** - Emergency consultation
   - **Urgent Care Visit** - Same-day care

5. The system will:
   - Create a Daily.co room
   - Create an encounter in the database
   - Generate a secure meeting token
   - Launch the video interface

6. During the call:
   - Use **SmartScribe** button to enable real-time transcription
   - Connect digital stethoscope via **Stethoscope** button
   - Mute/unmute audio and video as needed

### 5.2 Patient Flow

Patients join via a link sent to them (future feature: patient portal):

```
https://your-domain.com/telehealth/join?session=SESSION_ID
```

The patient waiting room:
- Shows provider name
- Displays "waiting" status until provider joins
- Allows audio/video testing
- Shows HIPAA compliance notice

## Step 6: Stethoscope Setup (Optional)

### Supported Devices

1. **Eko CORE/DUO**
   - Pair via Bluetooth
   - Install Eko app for initial setup
   - Select as audio input in browser

2. **3M Littmann CORE**
   - Pair via Bluetooth
   - Use 3M Littmann companion app for setup
   - Select as audio input

3. **Thinklabs One**
   - Connect via USB or Bluetooth
   - Direct audio streaming to browser

### Browser Setup

1. Pair stethoscope with computer/tablet via Bluetooth
2. In Chrome/Edge: `chrome://settings/content/microphone`
3. Allow microphone access for your WellFit domain
4. During telehealth call, click **Stethoscope** button
5. Select your Bluetooth stethoscope from device list

### Audio Quality Tips

- Use wired connection when possible for best quality
- Ensure stethoscope is fully charged
- Test audio before patient encounter
- Use headphones to prevent echo/feedback

## Step 7: SmartScribe Integration

SmartScribe automatically works during telehealth calls:

1. Click **SmartScribe** toggle during call
2. Sidebar opens with real-time transcription
3. System provides:
   - Live transcript
   - CPT code suggestions
   - ICD-10 diagnosis codes
   - Revenue optimization tips
   - SDOH Z-codes
   - Documentation prompts

### Revenue Optimization

SmartScribe analyzes conversation in real-time and suggests:
- Higher-level E/M codes when documentation supports it
- Missed CPT codes (e.g., preventive counseling)
- SDOH assessments that qualify for Z-codes
- CCM billing opportunities

Example:
```
Detected: Patient has multiple chronic conditions
Suggestion: CCM 99490 (+$70) - Document 20+ minutes
Missing: Blood pressure discussed - suggest 99401 counseling code
```

## Security & Compliance

### HIPAA Compliance Checklist

- ✅ Daily.co BAA signed
- ✅ End-to-end encryption enabled
- ✅ Cloud recordings encrypted at rest
- ✅ PHI access logged in `phi_access_logs`
- ✅ Session events tracked in `telehealth_session_events`
- ✅ RLS policies enforce provider-patient access control

### Audit Logging

All telehealth activity is automatically logged:

```sql
-- View telehealth sessions
SELECT * FROM telehealth_sessions WHERE provider_id = 'YOUR_USER_ID';

-- View session events
SELECT * FROM telehealth_session_events WHERE session_id = 'SESSION_ID';

-- View PHI access logs
SELECT * FROM phi_access_logs WHERE access_type = 'telehealth_session';
```

### Data Retention

Default retention policies:
- **Session metadata**: 7 years (compliance requirement)
- **Recordings**: 90 days (configurable)
- **Transcripts**: De-identified, stored permanently for training
- **PHI access logs**: 7 years

## Troubleshooting

### Issue: "Failed to create Daily.co room"

**Solution:**
1. Verify `DAILY_API_KEY` is set correctly in Supabase secrets
2. Check Daily.co dashboard for API rate limits
3. Ensure your Daily.co plan has available room capacity
4. Check edge function logs: `npx supabase functions logs create-telehealth-room`

### Issue: "Cannot connect stethoscope"

**Solution:**
1. Verify Bluetooth is enabled and stethoscope is paired
2. Grant microphone permissions in browser
3. Try selecting device manually in system audio settings
4. Restart browser and re-pair device

### Issue: "SmartScribe not transcribing"

**Solution:**
1. Verify `DEEPGRAM_API_KEY` and `ANTHROPIC_API_KEY` are set
2. Check microphone permissions
3. Ensure SmartScribe toggle is enabled
4. Check function logs: `npx supabase functions logs realtime_medical_transcription`

### Issue: "Patient cannot join room"

**Solution:**
1. Verify patient has correct session ID
2. Check that session is in 'active' status
3. Ensure session hasn't expired (24-hour limit)
4. Generate new patient token if needed

## Cost Estimates

### Daily.co Pricing (HIPAA Tier)

Approximate costs (check Daily.co for current pricing):
- **Base plan**: ~$99/month
- **Per participant minute**: ~$0.004/min
- **Recording storage**: ~$0.02/GB/month

Example monthly cost for 100 telehealth visits (30 min avg):
- 100 visits × 30 min × 2 participants = 6,000 participant-minutes
- 6,000 × $0.004 = $24/month
- **Total**: ~$123/month + recording storage

### Billing Opportunities

Average reimbursement per telehealth visit:
- **Outpatient E/M**: $75-150 (99213-99214)
- **ER Consultation**: $150-300 (99284-99285)
- **Urgent Care**: $100-200
- **With SmartScribe optimization**: +$20-80 additional codes

**ROI**: First 2-3 telehealth visits pay for entire monthly cost!

## ER Telehealth Workflow

Emergency telehealth has special features:

1. **Priority Handling**: No waiting room - immediate connection
2. **Extended Participant Limit**: Up to 10 participants (for specialists)
3. **Automatic Recording**: Always enabled for legal protection
4. **Enhanced Logging**: All actions logged with timestamps
5. **Stethoscope Priority**: Audio quality optimized for auscultation

### ER Use Cases

- Remote triage for emergency departments
- Rural hospital specialist consultation
- Post-discharge follow-up
- Stroke/STEMI evaluation
- Mental health crisis intervention

## Next Steps

1. ✅ Complete Daily.co account setup and BAA
2. ✅ Configure Supabase secrets
3. ✅ Deploy migrations and functions
4. ✅ Test with internal team
5. ⬜ Train clinical staff
6. ⬜ Create patient onboarding materials
7. ⬜ Set up patient portal telehealth access
8. ⬜ Configure automated appointment reminders with telehealth links

## Support

- **Daily.co Support**: support@daily.co
- **WellFit Issues**: GitHub Issues
- **HIPAA Questions**: Consult your compliance officer

## Advanced Configuration

### Custom Branding

Customize the telehealth interface in `TelehealthConsultation.tsx`:

```typescript
// Change colors, logos, etc.
const BRAND_PRIMARY = '#your-color';
const BRAND_LOGO = '/path/to/logo.png';
```

### Recording Settings

Configure automatic recording:

```sql
-- Enable recording for all ER visits
UPDATE telehealth_sessions
SET recording_enabled = true
WHERE encounter_type = 'er';
```

### Analytics

Track telehealth usage:

```sql
-- Monthly telehealth volume
SELECT
  DATE_TRUNC('month', started_at) as month,
  encounter_type,
  COUNT(*) as session_count,
  AVG(EXTRACT(EPOCH FROM (ended_at - started_at))/60) as avg_duration_minutes
FROM telehealth_sessions
WHERE started_at > NOW() - INTERVAL '1 year'
GROUP BY month, encounter_type
ORDER BY month DESC;
```

---

**You now have a fully functional HIPAA-compliant telehealth platform integrated with AI-powered clinical documentation!**
