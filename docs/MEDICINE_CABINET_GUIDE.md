># Medicine Cabinet Feature - Complete Setup Guide

## 🎯 Overview

The **Medicine Cabinet** is an AI-powered medication management system that allows seniors to:
1. **Scan medication labels** with their phone camera
2. **AI automatically reads** and extracts all medication information
3. **Store medications** in their personal digital cabinet
4. **Set reminders** for when to take medications
5. **Track adherence** and see how well they're staying on schedule
6. **Sync to FHIR** for doctors to see in EHR systems

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Step-by-Step Setup](#step-by-step-setup)
3. [Environment Variables](#environment-variables)
4. [Database Migration](#database-migration)
5. [How It Works](#how-it-works)
6. [User Interface](#user-interface)
7. [API Reference](#api-reference)
8. [FHIR Integration](#fhir-integration)
9. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Prerequisites
- ✅ WellFit Community platform installed
- ✅ Anthropic Claude API key (for vision)
- ✅ Supabase database access

### 3-Minute Setup

```bash
# 1. Run the migration
npx supabase db push

# 2. Add environment variables to .env.local
echo "REACT_APP_ANTHROPIC_API_KEY=your_api_key_here" >> .env.local

# 3. Restart your app
npm run dev
```

That's it! The Medicine Cabinet is now active.

---

## 📝 Step-by-Step Setup

### Step 1: Database Migration

The migration creates these tables:
- `medications` - Stores all medication information
- `medication_reminders` - Reminder schedules
- `medication_doses_taken` - Adherence tracking
- `medication_image_extractions` - AI extraction metadata

**Run the migration:**

```bash
# If using Supabase CLI
npx supabase migration repair --status applied 20251016000001
npx supabase db push

# Or apply manually through Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Copy contents of: supabase/migrations/20251016000001_medicine_cabinet.sql
# 3. Click "Run"
```

**Verify migration success:**
```sql
-- Run this in Supabase SQL Editor
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'medication%';

-- Should return:
-- medications
-- medication_reminders
-- medication_doses_taken
-- medication_image_extractions
```

### Step 2: Environment Variables

Add these to your `.env.local` file:

```env
# ============================================================================
# MEDICINE CABINET CONFIGURATION
# ============================================================================

# Required: Anthropic API Key for Claude Vision (medication label reading)
REACT_APP_ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Claude Model (default is fine for most users)
REACT_APP_CLAUDE_DEFAULT_MODEL=claude-3-5-sonnet-20241022

# Optional: Medication scanning settings
REACT_APP_MEDICATION_MAX_IMAGE_SIZE=10485760  # 10MB in bytes
REACT_APP_MEDICATION_MIN_CONFIDENCE=0.7        # 0.0 to 1.0
REACT_APP_MEDICATION_AUTO_SAVE_THRESHOLD=0.8   # Auto-save if confidence >= 0.8
```

### Step 3: Get Your Anthropic API Key

1. Go to: https://console.anthropic.com/
2. Sign up or log in
3. Navigate to "API Keys"
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-`)
6. Add to `.env.local`:
   ```env
   REACT_APP_ANTHROPIC_API_KEY=sk-ant-api03-YOUR-KEY-HERE
   ```

**Important:** Never commit your API key to git!

### Step 4: Add Medicine Cabinet to Your App

#### Option A: Add to existing routes

```typescript
// src/App.tsx or your routing file
import { MedicineCabinet } from './components/patient/MedicineCabinet';

// Add to your routes
<Route path="/medicine-cabinet" element={<MedicineCabinet />} />
```

#### Option B: Add to user dashboard

```typescript
// src/components/Dashboard.tsx
import { useMedicineCabinet } from './hooks/useMedicineCabinet';

function Dashboard() {
  const { medications, loading } = useMedicineCabinet(userId);

  return (
    <div>
      <h2>My Medications ({medications.length})</h2>
      {/* Show medications list */}
    </div>
  );
}
```

### Step 5: Test the System

1. **Start your app:**
   ```bash
   npm run dev
   ```

2. **Navigate to Medicine Cabinet** (e.g., `/medicine-cabinet`)

3. **Test label scanning:**
   - Take a photo of a medication bottle
   - Upload it through the interface
   - AI will extract and display information
   - Review and confirm to save

4. **Verify database:**
   ```sql
   -- Check that medication was saved
   SELECT medication_name, dosage, status, ai_confidence
   FROM medications
   WHERE user_id = 'your-user-id';
   ```

---

## 🔧 Environment Variables - Complete Reference

### Required Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `REACT_APP_ANTHROPIC_API_KEY` | Claude API key for vision | `sk-ant-api03-...` | ✅ Yes |

### Optional Variables

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `REACT_APP_CLAUDE_DEFAULT_MODEL` | Claude model to use | `claude-3-5-sonnet-20241022` | Latest model |
| `REACT_APP_CLAUDE_MAX_TOKENS` | Max tokens per request | `4000` | Higher = more detailed |
| `REACT_APP_MEDICATION_MAX_IMAGE_SIZE` | Max image size in bytes | `10485760` (10MB) | Prevents huge uploads |
| `REACT_APP_MEDICATION_MIN_CONFIDENCE` | Minimum confidence to accept | `0.7` | 0.7 = 70% confidence |
| `REACT_APP_MEDICATION_AUTO_SAVE_THRESHOLD` | Auto-save confidence threshold | `0.8` | 0.8 = 80% |

### Environment File Template

Create `.env.local` with:

```env
# Copy from .env.example and add your keys

# Anthropic (Required for Medicine Cabinet)
REACT_APP_ANTHROPIC_API_KEY=sk-ant-your-key-here

# Claude Settings (Optional - use defaults if unsure)
REACT_APP_CLAUDE_DEFAULT_MODEL=claude-3-5-sonnet-20241022
REACT_APP_CLAUDE_MAX_TOKENS=4000

# Medicine Cabinet Settings (Optional)
REACT_APP_MEDICATION_MAX_IMAGE_SIZE=10485760
REACT_APP_MEDICATION_MIN_CONFIDENCE=0.7
REACT_APP_MEDICATION_AUTO_SAVE_THRESHOLD=0.8
```

---

## ⚙️ How It Works

### 1. User Takes Photo

User opens Medicine Cabinet and clicks "Scan Medication Label"
- Opens camera or file picker
- User takes photo of medication bottle
- Photo is validated (size, format)

### 2. AI Extracts Information

Image is sent to Claude Vision API:
```
Image → Claude Vision → Structured Data
```

Claude extracts:
- Medication name (generic & brand)
- Dosage & strength
- Instructions ("Take twice daily")
- Prescribing doctor
- Pharmacy information
- Refill details
- NDC code (National Drug Code)
- Warnings & side effects

### 3. Confidence Scoring

AI assigns a confidence score (0.0 to 1.0):

- **0.9-1.0**: Crystal clear label
  - → Auto-saves to database
  - → User gets confirmation

- **0.7-0.9**: Most information clear
  - → Shows extracted data
  - → User reviews & confirms

- **0.0-0.7**: Poor quality or unclear
  - → Flags for manual entry
  - → User fills in missing info

### 4. Storage

Medication is saved to database:
```
medications table:
  - All extracted information
  - AI confidence score
  - Extraction notes
  - Status: active/discontinued/completed
```

### 5. FHIR Sync

If FHIR integration is enabled:
```
Database → FHIRMedicationStatement → EHR System
```

Doctor sees medication in Epic/Cerner/etc.

---

## 🎨 User Interface

### For Patients

**Medicine Cabinet Dashboard:**
```
┌─────────────────────────────────────────┐
│  My Medicine Cabinet                   │
│                                         │
│  [📷 Scan Medication Label]            │
│  [➕ Add Manually]                     │
│                                         │
│  Active Medications (5)                 │
│  ┌────────────────────────────┐       │
│  │ 💊 Lisinopril 10mg         │       │
│  │ Take once daily            │       │
│  │ Next dose: Today 8:00 AM   │       │
│  │ Refill due: Dec 15         │       │
│  └────────────────────────────┘       │
│                                         │
│  ┌────────────────────────────┐       │
│  │ 💊 Metformin 500mg         │       │
│  │ Take twice daily with food │       │
│  │ Next dose: Today 12:00 PM  │       │
│  └────────────────────────────┘       │
└─────────────────────────────────────────┘
```

**Scanning Flow:**
```
1. Click "Scan Medication Label"
2. Take photo or upload image
3. AI processes (shows progress bar)
4. Review extracted information
5. Confirm or edit details
6. Medication added to cabinet
```

### For Caregivers/Admins

**Admin View:**
```
┌─────────────────────────────────────────┐
│  Patient Medications                    │
│                                         │
│  Patient: John Smith                    │
│  ┌────────────────────────────┐       │
│  │ 💊 5 Active Medications    │       │
│  │ 📊 92% Adherence Rate      │       │
│  │ ⚠️ 2 Need Refills Soon     │       │
│  └────────────────────────────┘       │
│                                         │
│  Medications Needing Attention:         │
│  • Lisinopril - Refill due in 3 days   │
│  • Metformin - Missed 2 doses this week │
└─────────────────────────────────────────┘
```

---

## 🔌 API Reference

### Using the Hook

```typescript
import { useMedicineCabinet } from './hooks/useMedicineCabinet';

function MyComponent() {
  const {
    medications,
    loading,
    error,
    scanMedicationLabel,
    addMedication,
    deleteMedication
  } = useMedicineCabinet(userId);

  const handleScan = async (file: File) => {
    const result = await scanMedicationLabel(file);
    if (result) {
      console.log('Extracted:', result.medication);
    }
  };

  return (
    <div>
      {medications.map(med => (
        <div key={med.id}>
          {med.medication_name} - {med.dosage}
        </div>
      ))}
    </div>
  );
}
```

### Direct API Usage

```typescript
import medicationAPI from './api/medications';

// Get all medications
const response = await medicationAPI.getMedications(userId);
if (response.success) {
  console.log(response.data); // Medication[]
}

// Scan label
const scanResult = await medicationAPI.extractMedicationFromImage(
  userId,
  imageFile
);

// Add medication manually
await medicationAPI.createMedication({
  user_id: userId,
  medication_name: 'Aspirin',
  dosage: '81mg',
  instructions: 'Take once daily',
  status: 'active'
});

// Get adherence rate
const adherence = await medicationAPI.getMedicationAdherence(
  userId,
  medicationId,
  30 // last 30 days
);
```

---

## 🏥 FHIR Integration

### Automatic Sync to EHR

Medications are automatically converted to FHIR MedicationStatement resources:

```javascript
// Your medication in WellFit
{
  medication_name: "Lisinopril",
  dosage: "10mg",
  instructions: "Take once daily",
  frequency: "once daily",
  route: "oral"
}

// Becomes FHIR MedicationStatement
{
  resourceType: "MedicationStatement",
  status: "active",
  medicationCodeableConcept: {
    text: "Lisinopril 10mg"
  },
  dosage: [{
    text: "Take once daily",
    timing: {
      repeat: {
        frequency: 1,
        period: 1,
        periodUnit: "d"
      }
    },
    route: {
      coding: [{
        system: "http://snomed.info/sct",
        code: "26643006",
        display: "oral"
      }]
    }
  }]
}
```

### Syncing Medications to Epic/Cerner

```typescript
// In FHIR Interoperability Dashboard
import { fhirIntegrator } from './services/fhirInteroperabilityIntegrator';

// Export patient data including medications
const bundle = await fhirService.exportPatientDataWithMedications(userId);

// Push to FHIR server
await fhirIntegrator.syncToFHIR(connectionId, [userId]);

// Now doctor sees medications in Epic!
```

---

## 🐛 Troubleshooting

### Issue: "API key not configured"

**Problem:** Medicine Cabinet shows error about missing API key

**Solution:**
```bash
# 1. Check .env.local exists
ls -la .env.local

# 2. Verify API key is set
grep ANTHROPIC .env.local

# 3. Restart app
npm run dev
```

### Issue: Label scanning fails

**Problem:** AI cannot read medication label

**Common causes:**
- Blurry photo
- Label partially obscured
- Poor lighting
- Image too small

**Solutions:**
1. Take photo in good lighting
2. Ensure label is in focus
3. Try uploading from gallery if camera quality is poor
4. Enter information manually if scan fails

### Issue: Low confidence score

**Problem:** AI extracts info but confidence is <0.7

**Why:** Label quality, unusual format, or handwritten notes

**Solution:**
1. Review extracted information carefully
2. Correct any errors
3. Fill in missing fields
4. Click "Confirm" to save

### Issue: Medications not syncing to FHIR

**Problem:** Medications don't appear in EHR

**Check:**
```typescript
// 1. Verify FHIR connection is active
const connections = await fhirIntegrator.getConnections();
console.log(connections); // Check status

// 2. Test connection
const testResult = await fhirIntegrator.testConnection(connectionId);
console.log(testResult); // Should be success: true

// 3. Check patient mapping exists
const mapping = await fhirIntegrator.getPatientMapping(userId, connectionId);
console.log(mapping); // Should have fhirPatientId

// 4. Try manual sync
await fhirIntegrator.syncToFHIR(connectionId, [userId]);
```

### Issue: Database errors

**Problem:** Cannot save medication

**Check:**
```sql
-- 1. Verify tables exist
SELECT tablename FROM pg_tables
WHERE tablename = 'medications';

-- 2. Check RLS policies
SELECT * FROM pg_policies
WHERE tablename = 'medications';

-- 3. Test insert manually
INSERT INTO medications (
  user_id,
  medication_name,
  status
) VALUES (
  'your-user-id',
  'Test Medication',
  'active'
);
```

---

## 📊 Usage Analytics

### Track Feature Adoption

```sql
-- Total medications scanned
SELECT COUNT(*) as total_scanned
FROM medication_image_extractions
WHERE extraction_success = true;

-- Average confidence score
SELECT AVG(confidence_score) as avg_confidence
FROM medication_image_extractions;

-- Most common medications
SELECT medication_name, COUNT(*) as count
FROM medications
GROUP BY medication_name
ORDER BY count DESC
LIMIT 10;

-- Adherence rates
SELECT
  user_id,
  AVG(adherence_rate) as avg_adherence
FROM (
  SELECT * FROM get_medication_adherence_rate(user_id, 30)
) GROUP BY user_id;
```

---

## 🎓 User Training Tips

### For Seniors

**Taking Good Photos:**
1. Use good lighting (natural light is best)
2. Hold phone steady
3. Get close enough to read label
4. Make sure entire label is in frame
5. Avoid glare or shadows

**Understanding Confidence Scores:**
- ✅ Green (90%+): AI is very confident - auto-saved
- ⚠️ Yellow (70-90%): Please review carefully
- ❌ Red (<70%): Please check and fill in missing info

**Setting Reminders:**
1. Tap medication
2. Click "Add Reminder"
3. Choose time (e.g., 8:00 AM)
4. Select days (Daily, Mon-Fri, etc.)
5. Choose notification method (Push, SMS, Email)

### For Caregivers

**Monitoring Adherence:**
- Check "Adherence Rate" on patient dashboard
- Review "Missed Doses" report
- Set up alerts for low adherence

**Managing Refills:**
- System auto-flags medications needing refills
- Set threshold (default: 7 days before)
- Contact pharmacy proactively

---

## 🚀 Advanced Features

### Batch Scanning

Scan multiple medications at once:

```typescript
const images = [file1, file2, file3];
const results = await medicationLabelReader.extractFromMultipleImages(images);

results.forEach(result => {
  if (result.success) {
    console.log('Extracted:', result.medication.medicationName);
  }
});
```

### Custom Reminders

Set complex reminder schedules:

```typescript
await medicationAPI.createMedicationReminder({
  medication_id: medId,
  user_id: userId,
  time_of_day: '08:00:00',
  days_of_week: [1, 2, 3, 4, 5], // Monday-Friday only
  notification_method: 'all' // Push + SMS + Email
});
```

### Medication Interactions

Check for drug interactions (coming soon):

```typescript
// Future feature
const interactions = await medicationAPI.checkInteractions(
  [medication1Id, medication2Id]
);
```

---

## 📞 Support

Need help? Check:
- This guide
- [FHIR Integration Guide](./FHIR_INTEROPERABILITY_GUIDE.md)
- [API Documentation](../src/api/medications.ts)
- Claude API docs: https://docs.anthropic.com/

---

## ✅ Checklist

Before going to production:

- [ ] Database migration applied successfully
- [ ] Anthropic API key configured
- [ ] Test medication scanning with real labels
- [ ] Verify FHIR sync (if using)
- [ ] Train users on how to take good photos
- [ ] Set up monitoring for API usage/costs
- [ ] Configure reminder notifications
- [ ] Test on actual mobile devices
- [ ] Review and adjust confidence thresholds
- [ ] Set up backup/restore procedures

---

**🎉 Your Medicine Cabinet is ready! Users can now scan and manage their medications with AI-powered ease.**
