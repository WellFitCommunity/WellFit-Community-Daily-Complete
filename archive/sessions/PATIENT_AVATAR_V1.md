# Patient Avatar Visualization System

Interactive SVG-based human body diagram for visualizing patient medical devices, conditions, and markers.

## Architecture

| Component | Location | Purpose |
|-----------|----------|---------|
| `PatientAvatar` | `src/components/patient-avatar/PatientAvatar.tsx` | Main container (compact/expanded modes) |
| `AvatarBody` | `src/components/patient-avatar/AvatarBody.tsx` | SVG body with skin tones & gender |
| `AvatarThumbnail` | `src/components/patient-avatar/AvatarThumbnail.tsx` | Compact view for patient lists |
| `AvatarFullBody` | `src/components/patient-avatar/AvatarFullBody.tsx` | Expanded modal with marker sidebar |
| `AvatarMarker` | `src/components/patient-avatar/AvatarMarker.tsx` | Individual marker component |
| `StatusBadgeRing` | `src/components/patient-avatar/StatusBadgeRing.tsx` | Badges displayed around avatar |
| `MarkerForm` | `src/components/patient-avatar/MarkerForm.tsx` | Add/edit marker form |
| `MarkerDetailPopover` | `src/components/patient-avatar/MarkerDetailPopover.tsx` | Marker details popup |

## Database Tables

| Table | Purpose |
|-------|---------|
| `patient_avatars` | Skin tone & gender preferences per patient |
| `patient_markers` | Active markers (devices, conditions, wounds) |
| `patient_marker_history` | Audit trail of marker changes |
| `condition_marker_mappings` | ICD-10 → marker type mappings for auto-population |

## Two-Layer Indicator System

### Layer 1: Anatomical Markers (On Body)

Markers positioned directly on the avatar body:

| Category | Color | Examples |
|----------|-------|----------|
| **Critical** | Red | Central lines, chest tubes, tracheostomy |
| **Moderate** | Yellow | PICC lines, foleys, G-tubes, drains |
| **Informational** | Blue | Surgical incisions, implants, joint replacements |
| **Monitoring** | Purple | CGM, cardiac monitor, insulin pump |
| **Chronic** | Green | CHF, COPD, diabetes, CKD |
| **Neurological** | Orange | Stroke, Parkinson's, Alzheimer's, MS |

### Layer 2: Status Badges (Around Avatar)

Badges displayed around the avatar perimeter via `StatusBadgeRing`:

| Position | Badge Types |
|----------|-------------|
| **Top** | Code Status (Full Code, DNR, DNI, Comfort Care) |
| **Left** | Precautions (Fall Risk, Aspiration, NPO, Seizure, Bleeding, Elopement) |
| **Right** | Isolation + Alerts (Contact, Droplet, Airborne, Allergies, Difficult Airway) |

#### Isolation Color Codes (Clinical Standard)

| Color | Isolation Type | Pathogens |
|-------|---------------|-----------|
| Yellow | Contact | MRSA, VRE, C.diff |
| Green | Droplet | Flu, RSV, Pertussis |
| Blue | Airborne | TB, Measles, COVID |
| Purple | Protective | Neutropenic, BMT |

## Priority Scoring (AI-Ranked Display)

When a patient has many conditions, use `getTopPriorityMarkers()` to show the most critical:

```typescript
import { getTopPriorityMarkers } from './components/patient-avatar';

// Get top 6 conditions for thumbnail (excludes status badges)
const topMarkers = getTopPriorityMarkers(markers, 6);
```

### Priority Weights

| Condition Type | Priority Score |
|---------------|---------------|
| DNR/DNI/Comfort Care | 140-150 |
| Airborne Isolation | 125-130 |
| Fall Risk/Allergies | 115-125 |
| Critical Devices (Trach, Central Lines) | 105-110 |
| Acute Neuro (Stroke, TBI) | 95-105 |
| Chronic Conditions | 50-80 |
| Informational | 20 |

### Recency Bonuses

| Flag | Bonus Points |
|------|-------------|
| `requires_attention` | +50 |
| `pending_confirmation` | +25 |
| Created in last 12h | +25 |
| Created in last 24h | +15 |
| Has complications to watch | +20 |

## Auto-Population from Diagnoses

Database triggers automatically create markers when conditions are added to `fhir_conditions` or `encounter_diagnoses` tables.

### ICD-10 Mappings

50+ ICD-10 code patterns are pre-seeded in `condition_marker_mappings`:

| ICD-10 Pattern | Marker Type | Category |
|---------------|-------------|----------|
| E10.% | Diabetes Type 1 | Chronic |
| E11.% | Diabetes Type 2 | Chronic |
| I50.% | Heart Failure (CHF) | Chronic |
| I63.% | Stroke (CVA) | Neurological |
| J44.% | COPD | Chronic |
| N18.5 | CKD Stage 5 | Chronic |
| G20 | Parkinson's Disease | Neurological |

### Bulk Sync Function

To populate markers from existing conditions:

```sql
SELECT * FROM sync_patient_markers_from_conditions('patient-uuid');
-- Returns: { created_count, skipped_count, conditions_processed }
```

## SmartScribe Integration

When SmartScribe transcription completes, call `onSmartScribeComplete()` to auto-detect markers:

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

**Detection patterns:**
- Device insertions: "placed central line", "inserted PICC", "started IV access"
- Device removals: "removed foley", "discontinued central line"
- Conditions: "patient has COPD", "diagnosed with CHF"

## Usage Examples

### Basic Thumbnail

```tsx
import { AvatarThumbnail } from './components/patient-avatar';

<AvatarThumbnail
  patientId={patient.id}
  patientName="John Doe"
  skinTone="medium"
  genderPresentation="neutral"
  markers={patientMarkers}
/>
```

### With Status Badges & Allergy Count

```tsx
<AvatarThumbnail
  patientId={patient.id}
  patientName="John Doe"
  skinTone="medium"
  genderPresentation="neutral"
  markers={patientMarkers}
  allergyCount={3}  // Shows count on allergy badge
  onBadgeClick={(marker) => handleBadgeClick(marker)}
/>
```

### Time-Based Change Detection (Shift Handoff)

Highlight markers created/updated since a specific time:

```tsx
// Highlight changes from last 12 hours
const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

<AvatarThumbnail
  patientId={patient.id}
  markers={markers}
  showChangesSince={twelveHoursAgo}
/>
// Shows cyan "What's New" badge if any markers changed
// New markers highlighted with glow effect
```

### Full Avatar (Expandable)

```tsx
import { PatientAvatar } from './components/patient-avatar';

<PatientAvatar
  patientId={patient.id}
  patientName="John Doe"
  initialMode="compact"  // or "expanded"
  editable={true}
/>
```

### Standalone Status Badge Ring

```tsx
import { StatusBadgeRing } from './components/patient-avatar';

<StatusBadgeRing
  markers={patientMarkers}
  size="sm"  // sm, md, lg
  allergyCount={3}
  onBadgeClick={(marker) => handleBadgeClick(marker)}
/>
```

## Current Integrations

- **ShiftHandoffDashboard** - Avatar thumbnails in patient cards (high acuity + standard sections)

## Props Reference

### AvatarThumbnail Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `patientId` | string | Yes | Patient UUID |
| `patientName` | string | No | Display name |
| `skinTone` | SkinTone | Yes | light, mediumLight, medium, mediumDark, dark |
| `genderPresentation` | GenderPresentation | Yes | male, female, neutral |
| `markers` | PatientMarker[] | Yes | Array of markers |
| `pendingCount` | number | No | Count of pending SmartScribe markers |
| `allergyCount` | number | No | Count for allergy badge |
| `showChangesSince` | Date \| string | No | Highlight changes since this time |
| `onBadgeClick` | (marker) => void | No | Status badge click handler |
| `onClick` | () => void | No | Thumbnail click handler |

### StatusBadgeRing Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `markers` | PatientMarker[] | Yes | Array of markers |
| `size` | 'sm' \| 'md' \| 'lg' | No | Badge size |
| `allergyCount` | number | No | Count for allergy badge |
| `onBadgeClick` | (marker) => void | No | Badge click handler |

## Marker Type Library

120+ marker types defined in `src/components/patient-avatar/constants/markerTypeLibrary.ts`:

- **Vascular Access**: PICC, Central Lines (Jugular, Subclavian, Femoral), Ports, AV Fistula
- **Vein Access & Phlebotomy**: Blown Vein, Scarred Vein, Preferred Site, Ultrasound Required, Rolling Veins
- **Drainage & Tubes**: Foley, NG/OG, Chest Tube, JP Drain, G-Tube, Tracheostomy
- **Wounds & Surgical**: Pressure Injuries (Stage I-IV), Ostomies, Surgical Sites
- **Orthopedic**: Fractures, Joint Replacements, External Fixators
- **Monitoring**: CGM, Cardiac Monitor, Insulin Pump, Pulse Ox
- **Implants**: Pacemaker, ICD, DBS, Cochlear Implant, VP Shunt
- **Chronic Conditions**: CHF, COPD, Diabetes (T1/T2), CKD (Stage 1-5), Hypertension
- **Neurological**: Stroke, Parkinson's, Alzheimer's, Dementia, MS, Epilepsy
- **Precautions**: Fall Risk, Aspiration, NPO, Seizure, Bleeding, Elopement
- **Isolation**: Contact, Droplet, Airborne, Protective
- **Code Status**: Full Code, DNR, DNI, DNR/DNI, Comfort Care
- **Alerts**: Allergies, Latex Allergy, Difficult Airway, Difficult IV Access, Limb Alert

## Vein Access & Phlebotomy System

Track vein quality and access requirements to help phlebotomists prepare properly.

### Difficult IV Access Badge

Shows as a status badge (orange) when patient is a hard stick:

```tsx
// Appears automatically when patient has difficult_iv_access marker
<AvatarThumbnail markers={markers} />  // Orange badge shows on right
```

### Vein Quality Markers (Anatomical)

| Marker Type | Display Name | Category | Purpose |
|-------------|--------------|----------|---------|
| `blown_vein` | Blown Vein | Moderate | Previous failed IV site |
| `scarred_vein` | Scarred Vein | Moderate | Chemo, dialysis, or IV drug use damage |
| `preferred_vein` | Preferred Access Site | Informational | "This vein works" |
| `avoid_access` | Avoid This Arm | Critical | Mastectomy, lymphedema, fistula side |
| `rolling_veins` | Rolling Veins | Moderate | Veins move during access |
| `fragile_veins` | Fragile Veins | Moderate | Elderly, steroid skin, bruise easily |

### Equipment Requirements

| Marker Type | Display Name | Category | What to Bring |
|-------------|--------------|----------|---------------|
| `ultrasound_guided` | Ultrasound Guided Required | Critical | Bring ultrasound machine |
| `vein_finder` | Vein Finder Recommended | Moderate | Bring AccuVein/NIR device |
| `small_gauge_needle` | Small Gauge Required | Moderate | Butterfly, 23-25 gauge |
| `warm_compress_first` | Warm Compress First | Informational | Apply heat before attempt |

### Alternative Access Sites

| Marker Type | Display Name | Category | When to Use |
|-------------|--------------|----------|-------------|
| `hand_veins_only` | Hand Veins Only | Moderate | AC veins unavailable |
| `foot_veins_backup` | Foot Veins (Backup) | Moderate | Upper extremity exhausted |
| `external_jugular_backup` | External Jugular (Last Resort) | Critical | All peripheral failed |

### Priority Scoring for Phlebotomy

| Marker | Priority | Rationale |
|--------|----------|-----------|
| `difficult_iv_access` (badge) | 120 | Know immediately |
| `ultrasound_guided` | 100 | Bring equipment |
| `avoid_access` | 95 | Safety critical |
| `external_jugular_backup` | 85 | Indicates severe DVA |
| `scarred_vein` | 60 | Plan around |
| `blown_vein` | 55 | Avoid this site |
| `rolling_veins` | 50 | Technique adjustment |
| `small_gauge_needle` | 45 | Bring right supplies |
| `preferred_vein` | 35 | Helpful tip |

## Helper Functions

```typescript
import {
  getMarkerTypeDefinition,     // Get definition by marker_type
  findMarkerTypeByKeywords,    // Find by text (SmartScribe)
  calculateMarkerPosition,     // With laterality adjustment
  getStatusBadgeTypes,         // All badge types
  getAnatomicalMarkerTypes,    // All body marker types
  calculateMarkerPriority,     // Score a single marker
  getTopPriorityMarkers,       // Top N for display
} from './components/patient-avatar';
```

---

*Last Updated: 2025-12-14*
