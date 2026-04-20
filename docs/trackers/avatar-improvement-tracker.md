# Patient Avatar Improvement Tracker

> **Priority:** Secondary (after ONC certification + MCP chain completion)
> **Created:** 2026-04-20
> **Current Status:** 0/6 items complete
> **Estimated total:** ~32 hours across 2 sessions
> **System Grade:** A- (Production ready, minor gaps)

---

## Current State

The Patient Avatar system is **production-ready** with 7,600+ lines across 57 files:
- 2D SVG rendering (male/female/neutral/pregnant, 5 skin tones, front/back)
- 3D WebGL anatomy viewer (6 body system layers via Z-Anatomy)
- 111 marker types across 13 clinical categories
- SmartScribe AI auto-detection with clinician confirmation workflow
- Status badge ring (code status, isolation, precautions, alerts)
- Integrated into 7 clinical views (shift handoff, census, physician panel, telehealth, chart, care plan, banner)
- Priority scoring system (150-weight entries) for dashboard display
- Full audit trail in `patient_marker_history`

**What's working well (don't touch):**
- 2D SVG system (fast, accessible, clinically correct)
- Priority scoring for dashboard thumbnails
- SmartScribe → pending → confirm workflow
- Badge ring with CDC isolation color standards
- Marker library decomposition (was 1,625-line god file, now modular)
- Pregnancy support with trimester-aware rendering
- Phlebotomy/vein access marker system

---

## Session Plan

| Session | Focus | Items | Hours | Status |
|---------|-------|-------|-------|--------|
| **1** | Clinical data sync + search/filter + export | AVT-1, AVT-2, AVT-3 | ~16 | PENDING |
| **2** | Bulk import + history UI + 3D persistence | AVT-4, AVT-5, AVT-6 | ~16 | PENDING |

---

## Items

### AVT-1: Clinical Data Sync (HIGH PRIORITY — Patient Safety)

**Problem:** Markers are standalone annotations, not synced to the patient's problem list, medication list, or allergy table. A condition can exist in `fhir_conditions` with no marker on the avatar, creating a false "nothing to worry about" impression. Conversely, a nurse can add a marker that contradicts what's in the chart.

**Solution:** Sync function that pulls from existing FHIR services and auto-populates/reconciles markers.

**Implementation:**
```
1. Create `syncConditionsToMarkers(patientId)` in patientAvatarService.ts
2. Query fhir_conditions, allergy_intolerances, fhir_medication_requests for patient
3. Map each to appropriate marker type (ICD-10 → marker_type mapping)
4. Check for existing markers to avoid duplicates
5. Create new markers with source: 'fhir_sync', status: 'pending_confirmation'
6. Add "Sync from Chart" button in AvatarFullBody.tsx toolbar
7. Optional: auto-sync on PatientAvatarPage load (with last-synced check)
```

**Files to modify:**
- `src/services/patientAvatarService.ts` — add sync methods
- `src/components/patient-avatar/AvatarFullBody.tsx` — add sync button
- `src/services/migration-engine/targetSchema.ts` — ICD-10 → marker_type map (may reuse existing)

**Estimated:** ~8 hours
**Regression check:** Ensure existing manual markers are not duplicated or overwritten

---

### AVT-2: Marker Search & Filter (Usability at Scale)

**Problem:** When a patient has 15+ markers, the full body view becomes crowded with no way to filter. Clinicians can't quickly find "just the devices" or "just the chest markers."

**Solution:** Filter bar in AvatarFullBody with category filter, body region filter, and text search.

**Implementation:**
```
1. Add filter state to AvatarFullBody.tsx (category, region, search text)
2. Create FilterBar component (dropdowns + search input)
3. Filter markers array before rendering
4. Show active filter count badge
5. "Clear filters" button
```

**Files to create/modify:**
- `src/components/patient-avatar/MarkerFilterBar.tsx` — new component
- `src/components/patient-avatar/AvatarFullBody.tsx` — integrate filter state

**Estimated:** ~4 hours

---

### AVT-3: Export to PDF (Nursing Handoff)

**Problem:** The avatar can't be printed or included in a handoff report. Nursing shift handoff — where this avatar lives — needs a printable one-page summary.

**Solution:** Export button that generates a PDF with avatar image + marker list + details.

**Implementation:**
```
1. Use html2canvas to capture SVG avatar as image
2. Generate PDF with:
   - Patient name, DOB, MRN (header)
   - Avatar image (front + back)
   - Badge ring summary (code status, isolation, precautions)
   - Marker table (sorted by priority): type, location, date, instructions
3. Add "Export PDF" button to PatientAvatarPage toolbar
4. Reuse existing generateTextSummary() for text portion
```

**Files to create/modify:**
- `src/components/patient-avatar/AvatarExport.tsx` — new component
- `src/components/patient-avatar/PatientAvatarPage.tsx` — add export button
- May need: `html2canvas` or `jspdf` dependency (check if already installed)

**Estimated:** ~4 hours

---

### AVT-4: Bulk Marker Import (Admission Workflow)

**Problem:** Adding markers one at a time during patient admission (8-12 devices/conditions) is slow. No CSV import, no FHIR Bundle import, no batch creation.

**Solution:** Bulk import UI that accepts CSV or structured input.

**Implementation:**
```
1. Create BulkMarkerImport.tsx modal
2. Accept CSV with columns: marker_type, body_region, body_view, notes
3. Parse and validate against markerTypeLibrary
4. Preview list with auto-detected positions from bodyRegions.ts
5. "Import All" button creates markers in batch
6. Also support: paste from clipboard (tab-separated)
7. Also support: import from FHIR Procedure resources (past surgeries)
```

**Files to create/modify:**
- `src/components/patient-avatar/BulkMarkerImport.tsx` — new component
- `src/services/patientAvatarService.ts` — add `createMarkersBatch()` method
- `src/components/patient-avatar/PatientAvatarPage.tsx` — add import button

**Estimated:** ~6 hours

---

### AVT-5: Marker History Timeline UI

**Problem:** The `patient_marker_history` table captures every change (who/what/when), but there's no UI to view this timeline. The audit trail exists in the database with no clinician visibility.

**Solution:** Timeline panel in MarkerDetailPopover or as a tab in PatientAvatarPage.

**Implementation:**
```
1. Query patient_marker_history for a given marker_id
2. Render timeline (vertical list, newest first):
   - Icon per action type (created, updated, confirmed, rejected, deactivated)
   - "Dr. Smith confirmed on Jan 15, 2026 at 2:30 PM"
   - Show previous_values → new_values diff for updates
3. Add "History" tab or expandable section in MarkerDetailPopover
4. Add "All Changes" tab in PatientAvatarPage for patient-wide history
```

**Files to create/modify:**
- `src/components/patient-avatar/MarkerHistoryTimeline.tsx` — new component
- `src/components/patient-avatar/MarkerDetailPopover.tsx` — add history section
- `src/services/patientAvatarService.ts` — add `getMarkerHistory()` method

**Estimated:** ~4 hours

---

### AVT-6: 3D Marker Persistence Fix

**Problem:** 3D marker placement uses raycasting to get world-space coordinates (X, Y, Z). When the viewer reopens, the model may load at a slightly different position/scale, causing markers to drift from their intended location on the anatomy.

**Solution:** Store mesh name + UV coordinates instead of world-space XYZ.

**Implementation:**
```
1. On marker placement via raycasting:
   - Capture intersected mesh name (e.g., "Femur.L")
   - Calculate UV coordinates on the mesh surface (0-1 normalized)
   - Store: { meshName, uvX, uvY, normalX, normalY, normalZ }
2. On marker display:
   - Find mesh by name in loaded model
   - Convert UV coordinates back to world-space position
   - Billboard the marker to face camera
3. Fallback: if mesh not found (layer not loaded), show marker at stored world-space position
4. Migration: existing 3D markers keep world-space coords as fallback
```

**Files to modify:**
- `src/components/patient-avatar/anatomy-3d/Marker3D.tsx` — UV-based positioning
- `src/components/patient-avatar/anatomy-3d/types.ts` — add UV position interface
- `src/types/patientAvatar.ts` — extend marker position types
- Database: add `mesh_name`, `uv_x`, `uv_y` columns to `patient_markers` (migration)

**Estimated:** ~6 hours
**Note:** Only matters if 3D mode is actively used in clinical workflow. Confirm with Maria/Akima before starting.

---

## Regression Check Commands

After each item, run:
```bash
# Verify no profiles.user_id regression
grep -rn "from.*profiles.*\.eq.*['\"]id['\"]" src/components/patient-avatar/ src/services/patientAvatar* --include="*.ts" --include="*.tsx"
# Expected: 0 results

# Verify no new god files
wc -l src/components/patient-avatar/*.tsx src/components/patient-avatar/**/*.tsx | sort -rn | head -5
# All should be under 600 lines

# Standard verification
bash scripts/typecheck-changed.sh && npm run lint && npm test
```

---

## Questions for Maria/Akima Before Starting

1. **AVT-1 (Clinical sync):** Should synced markers auto-confirm or require clinician review?
2. **AVT-3 (PDF export):** Should the PDF include the 3D view or just 2D SVG?
3. **AVT-6 (3D persistence):** Is 3D mode actively used by clinicians, or is it primarily for demos?
4. **General:** Should markers auto-expire? (e.g., chest tube auto-deactivate after 14 days)
