# Connected Health Devices - Integration Roadmap

> Last Updated: 2026-01-28
> Status: Phase 2A Complete

---

## Overview

The Connected Health Devices feature allows users to connect Bluetooth-enabled medical devices to track vital signs. Data is stored in the `wearable_connections` and `wearable_vital_signs` database tables.

### Supported Devices

| Device | Route | Database Type | Readings Stored |
|--------|-------|---------------|-----------------|
| Smartwatch | `/wearables` | `smartwatch` | Steps, heart rate, sleep, fall detection |
| Smart Scale | `/devices/scale` | `smart_scale` | Weight, BMI, body fat, muscle mass |
| Blood Pressure Monitor | `/devices/blood-pressure` | `bp_monitor` | Systolic, diastolic, pulse |
| Glucometer | `/devices/glucometer` | `glucometer` | Glucose value, meal context |
| Pulse Oximeter | `/devices/pulse-oximeter` | `pulse_oximeter` | SpO2 percentage, pulse rate |

---

## Current Implementation (Phase 1 - Complete)

### What's Built

- **DeviceService** (`src/services/deviceService.ts`)
  - Connection management (connect, disconnect, status check)
  - CRUD operations for all vital sign types
  - Proper audit logging and error handling
  - TypeScript interfaces for all data types

- **Device Pages** (`src/pages/devices/`)
  - SmartScalePage - Weight tracking with BMI/body composition
  - BloodPressureMonitorPage - BP tracking with status classification
  - GlucometerPage - Glucose tracking with meal context
  - PulseOximeterPage - SpO2 tracking with status alerts

- **My Health Hub** (`src/pages/MyHealthHubPage.tsx`)
  - Device tile grid with navigation
  - Connection status indicators (visual only)

- **Test Coverage** (`src/pages/devices/__tests__/`)
  - 58 tests across 4 test files
  - Covers rendering, loading, connection, data display, errors, navigation

### Database Schema

```sql
-- Device connections
wearable_connections (
  id, user_id, device_type, device_model, connected,
  last_sync, sync_frequency_minutes, permissions_granted
)

-- Vital sign readings
wearable_vital_signs (
  id, user_id, device_id, vital_type, value, unit,
  measured_at, metadata
)
```

---

## Known Gaps (Phase 2 Backlog)

### Priority 1: Critical Fixes - COMPLETE

#### 1.1 MyHealthHubPage - Dynamic Connection Status ✅
**Status:** Complete (commit `0fdd5487`)

Device tiles now fetch real connection status from `DeviceService.getAllConnections()`.

---

#### 1.2 DeviceService Test Coverage ✅
**Status:** Complete (commit `0fdd5487`)

38 tests covering all DeviceService methods including:
- Connection management (connect, disconnect, status)
- All reading types (weight, BP, glucose, SpO2)
- Validation (see 3.2)
- Error handling

---

### Priority 2: User Experience

#### 2.1 Data Visualization - Trend Charts ✅
**Status:** Complete

Implemented reusable `VitalTrendChart` component using Recharts:
- Line charts for all vital types (weight, BP, glucose, SpO2)
- Time range selection (7/30/90 days)
- Reference lines for healthy ranges
- Color-coded data series
- Responsive design

Files:
- `src/components/devices/VitalTrendChart.tsx` - Reusable chart component
- 10 tests in `VitalTrendChart.test.tsx`
- Integrated into all 4 device pages

---

#### 2.2 Manual Entry Forms
**Issue:** "Enter Manually" buttons navigate away to `/health-observations`.

**Required:**
- Inline forms on each device page
- Pre-filled device type and current timestamp
- Validation for reasonable ranges
- Success confirmation

**Impact:** Friction in manual data entry workflow.

**Effort:** Medium (2-3 hours per device)

---

### Priority 3: Patient Safety

#### 3.1 Critical Value Alerts ✅
**Status:** Complete

Implemented `CriticalValueAlert` component with detection functions:
- SpO2: Critical < 90%, Warning 90-94%
- BP Systolic: Critical < 90 or > 180, Warning outside 100-160
- BP Diastolic: Critical < 60 or > 120, Warning outside 65-100
- Glucose: Critical < 54 or > 400 mg/dL, Warning < 70 or > 250
- Pulse: Critical < 40 or > 150, Warning outside 50-120

Features:
- Visual alert banners (red for critical, yellow for warning)
- Action recommendations for each alert type
- Dismissible alerts with session state
- Aria attributes for accessibility
- 25 unit tests for detection functions and component

Files:
- `src/components/devices/CriticalValueAlert.tsx`
- `src/components/devices/__tests__/CriticalValueAlert.test.tsx`
- Integrated into BP, Glucose, and SpO2 pages

---

#### 3.2 Reading Validation ✅
**Status:** Complete

Implemented validation in `DeviceService`:
- Weight: 1-1500 lbs, BMI 5-100, body fat 1-70%, muscle mass 1-100%
- Blood Pressure: systolic 40-300, diastolic 20-200, systolic > diastolic, pulse 20-300
- Glucose: 10-800 mg/dL
- SpO2: 0-100%, pulse rate 20-300 bpm

Invalid readings are rejected with clear error messages and logged via `auditLogger.warn()`.

18 validation tests added to `deviceService.test.ts`.

---

### Priority 4: Real Device Integration

#### 4.1 Bluetooth Web API
**Issue:** "Connect" button only creates database record. No real pairing.

**Required:**
- Web Bluetooth API integration (`navigator.bluetooth`)
- Device discovery and pairing flow
- GATT service/characteristic reading
- Background sync capability

**Supported Browsers:** Chrome, Edge, Opera (not Safari/Firefox)

**Considerations:**
- Fallback for unsupported browsers
- Mobile app may be better path
- Security: HTTPS required

**Impact:** Devices don't actually connect.

**Effort:** Large (8-16 hours per device type)

---

#### 4.2 Device Data Sync
**Issue:** No mechanism to pull data from connected devices.

**Required:**
- Scheduled sync (every 15 min based on `sync_frequency_minutes`)
- Manual "Sync Now" button
- Sync status indicator (last sync time, sync in progress)
- Error handling for failed syncs

**Impact:** Data must be manually entered.

**Effort:** Large (depends on 4.1)

---

### Priority 5: Advanced Features

#### 5.1 Health Insights AI
**Issue:** Raw data without interpretation.

**Required:**
- AI analysis of trends ("Your BP has improved 10% this month")
- Correlation detection ("BP spikes correlate with missed medications")
- Personalized recommendations
- Integration with existing AI services

**Effort:** Large (8-12 hours)

---

#### 5.2 Care Team Sharing
**Issue:** Data isolated to patient.

**Required:**
- Share readings with selected providers
- Caregiver access to device data
- Export to FHIR format for EHR integration
- Consent management

**Effort:** Large (8-12 hours)

---

#### 5.3 Medication Correlation
**Issue:** No link between vitals and medications.

**Required:**
- Tag readings with recent medications
- Visualize medication timing vs vital changes
- Alert on potential medication effects

**Effort:** Medium (4-6 hours)

---

## Recommended Implementation Order

```
Phase 2A - Quick Wins ✅ COMPLETE
├── ✅ 1.1 Fix MyHealthHubPage dynamic status
├── ✅ 1.2 Add DeviceService tests
└── ✅ 3.2 Reading validation

Phase 2B - User Experience (1-2 sprints) ← NEARLY COMPLETE
├── ✅ 2.1 Trend charts (all devices)
├── 2.2 Manual entry forms
└── ✅ 3.1 Critical value alerts

Phase 3 - Device Connectivity (2-3 sprints)
├── 4.1 Bluetooth Web API (POC with one device)
└── 4.2 Device data sync

Phase 4 - Advanced (future)
├── 5.1 Health Insights AI
├── 5.2 Care Team Sharing
└── 5.3 Medication Correlation
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/services/deviceService.ts` | Core service for device management |
| `src/pages/MyHealthHubPage.tsx` | Health hub with device tiles |
| `src/pages/devices/SmartScalePage.tsx` | Weight tracking page |
| `src/pages/devices/BloodPressureMonitorPage.tsx` | BP tracking page |
| `src/pages/devices/GlucometerPage.tsx` | Glucose tracking page |
| `src/pages/devices/PulseOximeterPage.tsx` | SpO2 tracking page |
| `src/pages/devices/__tests__/*.test.tsx` | Page test files |
| `src/routes/routeConfig.ts` | Route definitions (lines 68-71) |
| `src/routes/lazyComponents.tsx` | Lazy imports (lines 191-194) |

---

## Related Documentation

- [AI First Architecture](./AI_FIRST_ARCHITECTURE.md)
- [HIPAA Compliance](../CLAUDE.md#hipaa-compliance--phi-protection---critical)
- [Testing Standards](../CLAUDE.md#test-standards---mandatory)
