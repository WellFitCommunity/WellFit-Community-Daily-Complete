# Paper Form Scanner with OCR - Rural Hospital Solution

## The Problem
Rural hospitals often lose power/internet and must fall back to paper forms. When systems come back online, staff shouldn't have to manually re-enter dozens of patients.

## The Solution
**Snap a photo of the paper form → AI extracts data → Auto-populates enrollment**

---

## How It Works

```
┌──────────────────┐
│ 1. Paper Form    │  Nurse fills out standardized form
│    (Printed PDF) │  Patient info, vitals, meds, conditions
└────────┬─────────┘
         │
         ↓ (Take photo with iPad/tablet)
┌──────────────────┐
│ 2. Photo Upload  │  Upload to WellFit app
│    (Camera/File) │  Supports: JPG, PNG, PDF, HEIC
└────────┬─────────┘
         │
         ↓ (Send to Claude Vision API)
┌──────────────────┐
│ 3. OCR Extraction│  Claude 3.7 Sonnet with vision
│    (AI-Powered)  │  Reads handwriting + printed text
└────────┬─────────┘
         │
         ↓ (Structured JSON)
┌──────────────────┐
│ 4. Data Preview  │  Staff reviews extracted data
│    (Confirm/Edit)│  Fix any OCR errors
└────────┬─────────┘
         │
         ↓ (Bulk create)
┌──────────────────┐
│ 5. Auto-Enroll   │  Creates hospital patients
│    (Database)    │  Generates vitals, meds, conditions
└──────────────────┘
```

---

## Features

### 1. **Standardized Paper Form (PDF Template)**
Printable form with:
- ☐ Patient Name (First, Last)
- ☐ DOB (MM/DD/YYYY)
- ☐ Gender (M/F/Other)
- ☐ Room Number
- ☐ MRN
- ☐ Acuity Level (1-5)
- ☐ Code Status (Full/DNR/Comfort)
- ☐ Chief Complaint
- ☐ Vitals (BP, HR, O2, Temp)
- ☐ Allergies
- ☐ Current Medications
- ☐ Active Conditions

### 2. **Mobile/Tablet Upload**
- Camera capture (take photo)
- File upload (scan from desktop)
- Batch upload (multiple forms at once)
- Preview before processing

### 3. **AI OCR with Claude Vision**
- Reads handwritten text
- Reads printed text
- Handles messy handwriting
- Extracts structured data
- Validates dates, room numbers, etc.

### 4. **Data Preview & Correction**
- Shows extracted data in editable form
- Highlights low-confidence fields
- Allows manual corrections
- Batch review mode (multiple patients)

### 5. **Bulk Enrollment**
- Creates all patients at once
- Auto-generates clinical data
- Calculates risk scores
- Ready for physician/nurse panels

---

## Technical Implementation

### API Flow

```typescript
// 1. Upload photo
const formData = new FormData();
formData.append('file', photo);

// 2. Call Claude Vision API
const response = await fetch('/api/extract-patient-form', {
  method: 'POST',
  body: formData
});

// 3. Get structured JSON
const patients = await response.json();
// [
//   {
//     firstName: "John",
//     lastName: "Doe",
//     dob: "1950-01-15",
//     roomNumber: "101",
//     ...
//   }
// ]

// 4. Preview & confirm
<PatientDataPreview patients={patients} onConfirm={handleBulkEnroll} />

// 5. Bulk enroll
await supabase.rpc('bulk_enroll_hospital_patients', { patients });
```

### Claude Vision Prompt

```
You are analyzing a hospital patient intake form.
Extract the following fields:

REQUIRED:
- Patient Name (split into first_name, last_name)
- Date of Birth (format as YYYY-MM-DD)
- Gender (M/F/Other)

OPTIONAL:
- Room Number
- MRN (Medical Record Number)
- Acuity Level (1-Critical to 5-Stable)
- Code Status (Full Code, DNR, DNR/DNI, Comfort Care)
- Chief Complaint
- Allergies (array)
- Current Medications (array)
- Active Conditions (array)

VITALS (if present):
- Blood Pressure (format: "120/80")
- Heart Rate (number)
- O2 Saturation (number)
- Temperature (number)
- Respiratory Rate (number)

Return ONLY valid JSON array. Handle messy handwriting gracefully.
If you can't read something, use null.
Mark low confidence fields with "confidence": "low".

Example output:
[
  {
    "first_name": "John",
    "last_name": "Doe",
    "dob": "1950-01-15",
    "gender": "Male",
    "room_number": "101",
    "mrn": "MRN001",
    "acuity_level": "2-High",
    "code_status": "Full Code",
    "chief_complaint": "Chest pain",
    "allergies": ["Penicillin"],
    "vitals": {
      "bp": "160/95",
      "hr": 88,
      "o2_sat": 94,
      "temp": 37.2
    },
    "confidence": {
      "mrn": "low"  // Handwriting unclear
    }
  }
]
```

---

## Components to Build

### 1. **PaperFormUploader.tsx**
```tsx
<PaperFormUploader
  onExtract={(patients) => setExtractedPatients(patients)}
  onError={(error) => showError(error)}
/>
```

### 2. **ExtractedDataPreview.tsx**
```tsx
<ExtractedDataPreview
  patients={extractedPatients}
  onEdit={(index, field, value) => handleEdit(index, field, value)}
  onConfirm={() => handleBulkEnroll()}
/>
```

### 3. **PDF Template Generator**
Printable form with:
- Hospital logo area
- Clear field labels
- Checkboxes for common values
- Handwriting-friendly boxes

---

## Edge Functions Needed

### `/functions/extract-patient-form/index.ts`

```typescript
import Anthropic from "@anthropic-ai/sdk";

export async function handler(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File;

  // Convert to base64
  const buffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

  // Call Claude Vision
  const anthropic = new Anthropic({
    apiKey: Deno.env.get('ANTHROPIC_API_KEY')
  });

  const response = await anthropic.messages.create({
    model: "claude-3-7-sonnet-20250219",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: file.type,
            data: base64
          }
        },
        {
          type: "text",
          text: EXTRACTION_PROMPT // From above
        }
      ]
    }]
  });

  // Parse JSON response
  const extractedData = JSON.parse(response.content[0].text);

  return new Response(JSON.stringify(extractedData), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---

## Cost Estimate

**Claude Vision (Sonnet 3.7):**
- Input: ~$3 per 1M tokens
- Output: ~$15 per 1M tokens
- **Per form:** ~0.5¢ (200 image tokens + 500 output tokens)
- **100 forms:** ~$0.50

**Extremely affordable for rural hospitals!**

---

## Rollout Plan

### Phase 1: Build & Test (Next Session)
- [ ] Create PDF form template
- [ ] Build PaperFormUploader component
- [ ] Create extract-patient-form Edge Function
- [ ] Test with sample handwritten forms

### Phase 2: Integration
- [ ] Add to Admin Panel
- [ ] Build ExtractedDataPreview component
- [ ] Connect to bulk_enroll_hospital_patients
- [ ] Test full workflow

### Phase 3: Polish
- [ ] Add confidence indicators
- [ ] Allow manual field editing
- [ ] Batch upload support (multiple forms)
- [ ] Error handling & retries

---

## User Flow (Rural Hospital)

**Before (Old Way):**
1. Fill out paper forms during power outage
2. Power comes back
3. Spend 4 hours manually re-entering 20 patients
4. Risk of typos and data entry errors

**After (New Way):**
1. Fill out standardized paper forms during outage
2. Power comes back
3. Take photos of all 20 forms (2 minutes)
4. Upload to WellFit (1 minute)
5. AI extracts data (30 seconds)
6. Review & confirm (5 minutes)
7. **Done!** All 20 patients enrolled (8 minutes total vs 4 hours)

---

## Benefits

✅ **50x faster** than manual data entry
✅ **Fewer errors** (AI validates format)
✅ **Works with handwriting** (Claude Vision is excellent)
✅ **Extremely cheap** (~$0.005 per form)
✅ **Works offline** (fill forms on paper, upload when online)
✅ **Standardized** (consistent data format)
✅ **Accessible** (no typing required for rural staff)

---

## Next Steps

**For Next Session (when you have fresh context):**
1. Build the PDF form template
2. Create PaperFormUploader component
3. Build extract-patient-form Edge Function
4. Test with sample handwritten forms
5. Integrate into Admin Panel

**I'll create a detailed implementation guide in the next session!**

---

**Status:** 🎨 Designed & Scoped
**Priority:** 🔥 High (Rural hospital pain point)
**Complexity:** Medium (1-2 sessions to build)
**ROI:** Massive (4 hours → 8 minutes for 20 patients)
