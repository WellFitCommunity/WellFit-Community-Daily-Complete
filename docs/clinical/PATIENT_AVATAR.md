# Patient Avatar Visualization System v2

**Last Updated:** December 26, 2025
**Status:** Production-Ready
**Total Code:** 7,600+ lines across 15 files

Interactive SVG-based human body visualization for medical devices, conditions, precautions, and clinical alerts.

---

## System Overview

| Metric | Value |
|--------|-------|
| Components | 9 React components |
| Hooks | 3 custom hooks |
| Services | 2 service layers |
| Database Tables | 3 (with RLS) |
| Marker Types | 111 |
| Marker Categories | 13 |
| Status Badge Types | 18 |
| Body Regions | 40+ anatomical regions |
| Skin Tones | 5 |
| SmartScribe Keywords | 500+ |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PatientAvatar                          │
│                   (Main Container)                          │
│  ┌─────────────────┐     ┌──────────────────────────────┐  │
│  │ AvatarThumbnail │ ←→  │      AvatarFullBody          │  │
│  │   (Compact)     │     │       (Expanded)             │  │
│  │                 │     │  ┌────────────────────────┐  │  │
│  │ ┌─────────────┐ │     │  │      AvatarBody        │  │  │
│  │ │ StatusBadge │ │     │  │   (SVG Male/Female)    │  │  │
│  │ │    Ring     │ │     │  │  ┌──────────────────┐  │  │  │
│  │ └─────────────┘ │     │  │  │  AvatarMarker    │  │  │  │
│  │ ┌─────────────┐ │     │  │  │  (Colored Dots)  │  │  │  │
│  │ │  AvatarBody │ │     │  │  └──────────────────┘  │  │  │
│  │ │  (Compact)  │ │     │  └────────────────────────┘  │  │
│  │ └─────────────┘ │     │  ┌────────────────────────┐  │  │
│  └─────────────────┘     │  │ MarkerDetailPopover    │  │  │
│                          │  │ (Click to expand)      │  │  │
│                          │  └────────────────────────┘  │  │
│                          └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────┐        ┌──────────────────────┐
│  MarkerForm     │        │  AvatarSettingsForm  │
│ (Add/Edit)      │        │ (Skin/Gender Prefs)  │
└─────────────────┘        └──────────────────────┘
```

---

## Component Reference

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| `PatientAvatar` | `PatientAvatar.tsx` | 261 | Main container - mode switching, state coordination |
| `AvatarBody` | `AvatarBody.tsx` | 445 | SVG bodies (male/female/neutral), 5 skin tones, front/back views |
| `AvatarThumbnail` | `AvatarThumbnail.tsx` | 287 | Compact view with badge ring, top 6 priority markers |
| `AvatarFullBody` | `AvatarFullBody.tsx` | 403 | Expanded interactive view, marker editing, confirmation UI |
| `AvatarMarker` | `AvatarMarker.tsx` | 224 | Individual marker dot with category color, click handling |
| `StatusBadgeRing` | `StatusBadgeRing.tsx` | 631 | Badge ring (precautions, isolation, code status, alerts) |
| `MarkerForm` | `MarkerForm.tsx` | 464 | Create/edit marker modal with body region selection |
| `MarkerDetailPopover` | `MarkerDetailPopover.tsx` | 339 | Marker details, confirm/reject/edit/deactivate actions |
| `AvatarSettingsForm` | `AvatarSettingsForm.tsx` | 183 | Skin tone and gender presentation preferences |

**Location:** `src/components/patient-avatar/`

---

## Database Schema

### Tables

```sql
-- Patient avatar preferences (1 per patient)
patient_avatars
├── id (UUID PK)
├── patient_id (FK, UNIQUE)
├── skin_tone (light|mediumLight|medium|mediumDark|dark)
├── gender_presentation (male|female|neutral)
├── created_at, updated_at

-- Active markers on body (N per patient)
patient_markers
├── id (UUID PK)
├── patient_id (FK)
├── category (critical|moderate|informational|monitoring|chronic|neurological)
├── marker_type (e.g., 'central_line_jugular')
├── display_name (human-readable label)
├── body_region (e.g., 'neck', 'chest_right')
├── position_x, position_y (0-100 coordinates)
├── body_view (front|back)
├── source (manual|smartscribe|import)
├── source_transcription_id (FK to transcriptions)
├── status (pending_confirmation|confirmed|rejected)
├── confidence_score (0-1 from SmartScribe)
├── details (JSONB - insertion_date, care_instructions, complications_watch)
├── is_active (soft delete)
├── requires_attention (boolean flag)
├── created_by (FK to auth.users)
├── created_at, updated_at

-- Audit trail for all marker changes
patient_marker_history
├── id (UUID PK)
├── marker_id (FK)
├── action (created|updated|deactivated|reactivated|confirmed|rejected|position_changed)
├── changed_by (FK)
├── previous_values, new_values (JSONB diffs)
├── notes (text)
├── created_at
```

### RLS Policies
- All tables have Row-Level Security enabled
- Users can only view/edit markers for patients they have access to
- Audit trail is append-only

---

## Two-Layer Indicator System

### Layer 1: Anatomical Markers (On Body)

Positioned directly on the SVG body at specific coordinates:

| Category | Color | Priority Range | Examples |
|----------|-------|----------------|----------|
| **Critical** | Red | 100-150 | Central lines, chest tubes, tracheostomy, ventilator |
| **Moderate** | Yellow | 50-80 | PICC lines, foleys, G-tubes, drains, blown veins |
| **Informational** | Blue | 20-40 | Surgical incisions, joint replacements, implants |
| **Monitoring** | Purple | 60-75 | CGM, cardiac monitor, insulin pump, holter |
| **Chronic** | Green | 50-80 | CHF, COPD, diabetes, CKD, hypertension |
| **Neurological** | Orange | 70-105 | Stroke, Parkinson's, Alzheimer's, MS, epilepsy |

### Layer 2: Status Badges (Around Avatar)

Displayed in the `StatusBadgeRing` around the avatar perimeter:

| Position | Badge Types | Colors |
|----------|-------------|--------|
| **Top** | Code Status | Green (Full Code), Red (DNR), Purple (Comfort Care) |
| **Left** | Precautions | Red/Yellow/Orange (Fall, Aspiration, NPO, Seizure, Bleeding, Elopement) |
| **Right** | Isolation + Alerts | Yellow/Green/Blue/Purple (Contact, Droplet, Airborne, Protective) |
| **Bottom** | Alerts | Red/Orange (Allergies, Difficult IV, Difficult Airway, Limb Alert) |

#### Isolation Color Codes (CDC Standard)

| Color | Type | Pathogens |
|-------|------|-----------|
| Yellow | Contact | MRSA, VRE, C.diff |
| Green | Droplet | Flu, RSV, Pertussis |
| Blue | Airborne | TB, Measles, COVID |
| Purple | Protective | Neutropenic, BMT |

---

## 111 Marker Types (13 Categories)

### Complete Category Breakdown

| Category | Count | Marker Types |
|----------|-------|--------------|
| **VASCULAR_ACCESS** | 11 | PICC (single/double/triple lumen), Central Lines (subclavian/jugular/femoral), Peripheral IV, Midline Catheter, Port-a-Cath, Dialysis Catheter, Arterial Line, AV Fistula |
| **VEIN_ACCESS** | 12 | Blown Vein, Scarred Vein, Preferred Site, Avoid Arm, Rolling Veins, Fragile Veins, Ultrasound Guided Required, Vein Finder Recommended, Small Gauge Needle, Warm Compress First, Hand Veins Only, Foot Veins Backup, External Jugular |
| **DRAINAGE_TUBE** | 10 | Foley, Suprapubic Catheter, Chest Tube, JP Drain, Hemovac, Penrose Drain, NG Tube, G-Tube/PEG, J-Tube, Tracheostomy, Nephrostomy |
| **WOUND_SURGICAL** | 10 | Surgical Incision, Pressure Injuries (Stage 1-4 + Unstageable), Laceration, Skin Tear, Ostomy (Colostomy/Ileostomy/Urostomy) |
| **ORTHOPEDIC** | 6 | Fracture Site, External Fixator, Cast/Splint, Joint Replacements (Hip/Knee/Shoulder) |
| **MONITORING_DEVICE** | 4 | CGM, Cardiac Monitor Leads, Continuous Pulse Ox, Holter Monitor |
| **IMPLANT** | 8 | Pacemaker, ICD, Insulin Pump, Pain Pump, VP Shunt, DBS, Cochlear Implant, Spinal Cord Stimulator |
| **CHRONIC_CONDITION** | 11 | CHF, CAD, AFib, COPD, Asthma, Diabetes (Type 1/2), CKD, ESRD, PAD, Cancer |
| **NEUROLOGICAL** | 14 | Stroke (Ischemic/Hemorrhagic), Parkinson's, Alzheimer's, Dementia (General/Vascular/Lewy Body), Epilepsy, MS, Occipital Neuralgia, Trigeminal Neuralgia, Neuropathy (Peripheral/Diabetic), TBI, Myasthenia Gravis |
| **PRECAUTION** | 6 | Fall Risk, Aspiration Risk, NPO, Seizure Precautions, Bleeding Precautions, Elopement Risk |
| **ISOLATION** | 4 | Contact, Droplet, Airborne, Protective |
| **CODE_STATUS** | 5 | Full Code, DNR, DNI, DNR/DNI, Comfort Care |
| **ALERT** | 5 | Allergies, Latex Allergy, Difficult Airway, Limb Alert, Difficult IV Access |

**Library Location:** `src/components/patient-avatar/constants/markerTypeLibrary.ts` (1,625 lines)

---

## Priority Scoring System

When a patient has many markers, `getTopPriorityMarkers()` returns the most critical for thumbnail display:

```typescript
import { getTopPriorityMarkers } from './components/patient-avatar';

// Get top 6 markers for thumbnail (excludes status badges)
const topMarkers = getTopPriorityMarkers(markers, 6);
```

### Base Priority by Condition Type

| Condition Type | Priority Score |
|----------------|----------------|
| DNR/DNI/Comfort Care | 140-150 |
| Airborne Isolation | 125-130 |
| Fall Risk / Allergies | 115-125 |
| Critical Devices (Trach, Central Lines) | 105-110 |
| Acute Neuro (Stroke, TBI) | 95-105 |
| Chronic Conditions | 50-80 |
| Informational | 20 |

### Recency & Attention Bonuses

| Flag | Bonus Points |
|------|--------------|
| `requires_attention` | +50 |
| `pending_confirmation` | +25 |
| Created in last 12h | +25 |
| Created in last 24h | +15 |
| Has `complications_watch` | +20 |

---

## Vein Access & Phlebotomy System

Specialized markers for IV teams and phlebotomists.

### Difficult IV Access Badge

Appears automatically as an orange status badge when patient has `difficult_iv_access` marker.

### Vein Quality Markers

| Marker | Category | Purpose |
|--------|----------|---------|
| `blown_vein` | Moderate | Previous failed IV site |
| `scarred_vein` | Moderate | Chemo, dialysis, or IV drug use damage |
| `preferred_vein` | Informational | "This vein works" |
| `avoid_access` | Critical | Mastectomy, lymphedema, fistula side |
| `rolling_veins` | Moderate | Veins move during access |
| `fragile_veins` | Moderate | Elderly, steroid skin, bruise easily |

### Equipment Requirements

| Marker | Category | What to Bring |
|--------|----------|---------------|
| `ultrasound_guided` | Critical | Ultrasound machine |
| `vein_finder` | Moderate | AccuVein/NIR device |
| `small_gauge_needle` | Moderate | Butterfly, 23-25 gauge |
| `warm_compress_first` | Informational | Apply heat before attempt |

### Alternative Access Sites

| Marker | Category | When to Use |
|--------|----------|-------------|
| `hand_veins_only` | Moderate | AC veins unavailable |
| `foot_veins_backup` | Moderate | Upper extremity exhausted |
| `external_jugular_backup` | Critical | All peripheral failed |

---

## SmartScribe Integration

Automatic marker detection from clinical transcriptions.

**Service:** `src/services/smartscribe-avatar-integration.ts` (320 lines)

### Entity Extraction

```typescript
import { onSmartScribeComplete } from '../services/smartscribe-avatar-integration';

const result = await onSmartScribeComplete(
  transcriptionId,
  patientId,
  providerId,
  transcriptText
);
// result: { created: 2, removed: 0, errors: [] }
```

### Detection Patterns

| Type | Example Phrases | Action |
|------|-----------------|--------|
| **Device Insertion** | "placed central line", "inserted PICC in right arm" | Create pending marker |
| **Device Removal** | "removed foley", "discontinued chest tube" | Deactivate matching marker |
| **Condition Mention** | "patient has COPD", "diagnosed with CHF" | Create chronic marker |

### Workflow

```
Transcription completed
    ↓
extractAvatarEntities() - parses text, finds keywords
    ↓
processSmartScribeForAvatar() - creates pending markers
    ↓
Clinical user reviews in AvatarFullBody
    ↓
Confirm/Reject → Marker history tracks source & confidence
```

### Confidence Scoring

| Source | Base Confidence |
|--------|-----------------|
| SmartScribe keyword match | 0.80-0.85 |
| ICD-10 code extraction | 0.90 |
| Manual entry | 1.00 |

---

## Hooks Reference

### usePatientAvatar

```typescript
const {
  avatar,           // { skin_tone, gender_presentation }
  loading,
  error,
  updateAvatar,     // (skinTone, genderPresentation) => Promise
} = usePatientAvatar(patientId);
```

### usePatientMarkers

```typescript
const {
  markers,              // PatientMarker[]
  pendingCount,         // Number of SmartScribe pending markers
  attentionCount,       // Number requiring attention
  loading,
  error,
  refresh,              // () => void
  createMarker,         // (data) => Promise
  updateMarker,         // (id, data) => Promise
  confirmMarker,        // (id) => Promise
  rejectMarker,         // (id) => Promise
  deactivateMarker,     // (id) => Promise
  confirmAllPending,    // () => Promise
} = usePatientMarkers(patientId);
```

### useTouchGestures

```typescript
const {
  position,           // { x, y }
  scale,              // number
  rotation,           // number
  gestureHandlers,    // Event handlers for touch/mouse
} = useTouchGestures({
  initialPosition: { x: 50, y: 50 },
  onPositionChange: (pos) => updateMarkerPosition(pos),
});
```

---

## Usage Examples

### Basic Thumbnail (Patient Lists)

```tsx
import { AvatarThumbnail } from './components/patient-avatar';

<AvatarThumbnail
  patientId={patient.id}
  patientName="Gloria Simmons"
  skinTone="medium"
  genderPresentation="female"
  markers={patientMarkers}
/>
```

### With Allergy Count & Badge Click

```tsx
<AvatarThumbnail
  patientId={patient.id}
  patientName="Gloria Simmons"
  skinTone="medium"
  genderPresentation="female"
  markers={patientMarkers}
  allergyCount={3}
  onBadgeClick={(marker) => showAllergyDetails(marker)}
/>
```

### Shift Handoff - Show Recent Changes

```tsx
const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

<AvatarThumbnail
  patientId={patient.id}
  markers={markers}
  showChangesSince={twelveHoursAgo}
/>
// Shows cyan "What's New" badge if markers changed
// New markers highlighted with glow effect
```

### Full Avatar (Expandable Modal)

```tsx
import { PatientAvatar } from './components/patient-avatar';

<PatientAvatar
  patientId={patient.id}
  patientName="Gloria Simmons"
  initialMode="compact"  // or "expanded"
  editable={true}
  onMarkerClick={(marker) => console.log(marker)}
/>
```

### Standalone Status Badge Ring

```tsx
import { StatusBadgeRing } from './components/patient-avatar';

<StatusBadgeRing
  markers={patientMarkers}
  size="md"  // sm, md, lg
  allergyCount={3}
  onBadgeClick={(marker) => handleBadgeClick(marker)}
/>
```

---

## Props Reference

### PatientAvatar Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `patientId` | string | Yes | Patient UUID |
| `patientName` | string | No | Display name |
| `initialMode` | 'compact' \| 'expanded' | No | Starting mode (default: compact) |
| `editable` | boolean | No | Allow marker editing (default: true) |
| `onMarkerClick` | (marker) => void | No | Marker click handler |
| `onClose` | () => void | No | Close expanded mode handler |
| `skinToneOverride` | SkinTone | No | Override DB preference |
| `genderOverride` | GenderPresentation | No | Override DB preference |

### AvatarThumbnail Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `patientId` | string | Yes | Patient UUID |
| `patientName` | string | No | Display name |
| `skinTone` | SkinTone | Yes | light, mediumLight, medium, mediumDark, dark |
| `genderPresentation` | GenderPresentation | Yes | male, female, neutral |
| `markers` | PatientMarker[] | Yes | Array of markers |
| `pendingCount` | number | No | SmartScribe pending count |
| `allergyCount` | number | No | Count for allergy badge |
| `showChangesSince` | Date \| string | No | Highlight recent changes |
| `onBadgeClick` | (marker) => void | No | Badge click handler |
| `onClick` | () => void | No | Thumbnail click handler |

### StatusBadgeRing Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `markers` | PatientMarker[] | Yes | Array of markers |
| `size` | 'sm' \| 'md' \| 'lg' | No | Badge size (default: md) |
| `allergyCount` | number | No | Count for allergy badge |
| `onBadgeClick` | (marker) => void | No | Badge click handler |

---

## Service Layer

### PatientAvatarService

**File:** `src/services/patientAvatarService.ts` (553 lines)

```typescript
import { patientAvatarService } from '../services/patientAvatarService';

// Avatar preferences
const avatar = await patientAvatarService.getPatientAvatar(patientId);
await patientAvatarService.updatePatientAvatar(patientId, 'medium', 'female');

// Marker CRUD
const marker = await patientAvatarService.createMarker(patientId, markerData);
await patientAvatarService.updateMarker(markerId, updates);
await patientAvatarService.deactivateMarker(markerId, userId, 'Removed during procedure');

// SmartScribe workflow
await patientAvatarService.confirmMarker(markerId, userId);
await patientAvatarService.rejectMarker(markerId, userId, 'False positive');
await patientAvatarService.confirmAllPendingMarkers(patientId, userId);

// Audit trail
const history = await patientAvatarService.getMarkerHistory(markerId);
```

**Pattern:** All methods return `ServiceResult<T>` with proper error handling via `auditLogger`.

---

## Current Integrations

| Component | Location | Usage |
|-----------|----------|-------|
| **ShiftHandoffDashboard** | `src/components/nurse/` | AvatarThumbnail in patient cards (high acuity + standard sections) |
| **Patient Profile** | *(ready for integration)* | Edit preferences, view full avatar |
| **Nurse Station** | *(future)* | Quick visual reference for unit census |

---

## Helper Functions

```typescript
import {
  getMarkerTypeDefinition,     // Get definition by marker_type key
  findMarkerTypeByKeywords,    // Find by text (for SmartScribe)
  calculateMarkerPosition,     // Position with laterality adjustment
  getStatusBadgeTypes,         // All badge-type markers
  getAnatomicalMarkerTypes,    // All body-positioned markers
  calculateMarkerPriority,     // Score a single marker
  getTopPriorityMarkers,       // Top N for thumbnail display
} from './components/patient-avatar';
```

---

## File Structure

```
src/components/patient-avatar/
├── PatientAvatar.tsx                 (261 lines)
├── AvatarBody.tsx                    (445 lines)
├── AvatarThumbnail.tsx               (287 lines)
├── AvatarFullBody.tsx                (403 lines)
├── AvatarMarker.tsx                  (224 lines)
├── StatusBadgeRing.tsx               (631 lines)
├── MarkerForm.tsx                    (464 lines)
├── MarkerDetailPopover.tsx           (339 lines)
├── AvatarSettingsForm.tsx            (183 lines)
├── index.ts                          (76 lines)
│
├── hooks/
│   ├── usePatientAvatar.ts           (102 lines)
│   ├── usePatientMarkers.ts          (208 lines)
│   └── useTouchGestures.ts           (205 lines)
│
├── constants/
│   ├── markerTypeLibrary.ts         (1,625 lines)
│   ├── bodyRegions.ts               (287 lines)
│   └── skinTones.ts                 (969 lines)
│
├── utils/
│   └── shiftHandoffSummary.ts       (293 lines)
│
└── __tests__/
    └── PatientAvatar.test.tsx

src/services/
├── patientAvatarService.ts          (553 lines)
└── smartscribe-avatar-integration.ts (320 lines)

src/types/
└── patientAvatar.ts                 (427 lines)

supabase/migrations/
├── _APPLIED_20251221000000_patient_avatar_tables.sql
├── 20251214100000_patient_avatar_auto_population.sql
└── 20251214110000_vein_access_markers.sql
```

---

## Testing

**File:** `src/components/patient-avatar/__tests__/PatientAvatar.test.tsx`

**Coverage:**
- Component rendering (compact/expanded modes)
- Mock hooks for avatar preferences & markers
- Marker creation/update/confirmation flows
- SmartScribe pending marker handling
- Status badge rendering

---

## Security & Compliance

| Feature | Implementation |
|---------|----------------|
| **RLS** | All tables protected by Row-Level Security |
| **Audit Trail** | All marker changes logged to `patient_marker_history` |
| **Soft Delete** | Markers use `is_active` flag, never hard deleted |
| **Source Tracking** | Every marker tracks `source` (manual/smartscribe/import) |
| **Confidence Scores** | SmartScribe markers include confidence for review |
| **No PHI Logging** | Uses `auditLogger`, never `console.log` |

---

## Shift Handoff Summary Generation

Generate text summaries for voice readback or printed reports:

```typescript
import { generateTextSummary, generateHtmlSummary } from './components/patient-avatar';

const textSummary = generateTextSummary(patient, markers);
// Output:
// Patient: Gloria Simmons
// Total Markers: 8
//
// Key Points:
// - 2 critical devices (central lines, chest tubes)
// - 1 marker pending SmartScribe confirmation
// - 3 items requiring attention
//
// Markers by Category:
//   Critical: 2
//     - Central Line (Jugular) [PENDING]
//     - Chest Tube (chest_right)
//   ...

const htmlSummary = generateHtmlSummary(patient, markers);
// Formatted HTML for print/email
```

---

## Production Readiness Checklist

| Feature | Status |
|---------|--------|
| Type Safety | ✓ Full TypeScript, no `any` |
| Error Handling | ✓ ServiceResult pattern, auditLogger |
| Database Security | ✓ RLS on all tables |
| Audit Trail | ✓ Complete change history |
| Mobile Support | ✓ Touch gesture hooks |
| Accessibility | ✓ SVG alt text, semantic HTML |
| Performance | ✓ Indexed queries, memoization |
| Testing | ✓ Unit tests with mocks |

---

*Document Version: 2.0*
*Last Updated: December 26, 2025*
*Prepared By: Claude Code*
