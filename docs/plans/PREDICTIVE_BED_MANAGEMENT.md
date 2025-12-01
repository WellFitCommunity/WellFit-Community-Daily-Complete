# Predictive Bed Management System - Architecture Plan

## Overview

An intelligent hospital bed management system that predicts bed availability day-to-day,
integrates with existing ADT data, and serves as both source of truth AND ADT consumer.

## Target Users (Envision Atlus Only)

1. **Bed Control / Admissions** - Real-time bed board, incoming patient placement
2. **Charge Nurses** - Unit census, staffing alignment, acuity overview
3. **Hospital Administrators** - Capacity forecasting, operational metrics

## Core Architecture

### Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                      HOSPITAL UNITS                              │
│  (ICU, Med-Surg, Telemetry, L&D, ED Holding, etc.)              │
└─────────────────────────────────────────────────────────────────┘
         │
         │ 1:many
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BEDS                                     │
│  - Physical bed inventory                                        │
│  - Equipment/features (telemetry, bariatric, isolation)         │
│  - Current status (available, occupied, cleaning, blocked)      │
└─────────────────────────────────────────────────────────────────┘
         │
         │ 1:many (assignments over time)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BED ASSIGNMENTS                               │
│  - Patient → Bed mapping                                         │
│  - Admission, transfer, discharge timestamps                     │
│  - Expected discharge date (prediction input)                    │
└─────────────────────────────────────────────────────────────────┘
         │
         │ aggregates to
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DAILY CENSUS                                  │
│  - Snapshot per unit per day                                     │
│  - Actual vs predicted occupancy                                 │
│  - Admissions, discharges, transfers in/out                     │
└─────────────────────────────────────────────────────────────────┘
         │
         │ feeds into
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 AVAILABILITY FORECASTS                           │
│  - ML-predicted bed availability by day/unit                     │
│  - Confidence intervals                                          │
│  - Factors: LOS patterns, scheduled admits, day-of-week trends  │
└─────────────────────────────────────────────────────────────────┘
```

### New Tables

#### 1. `hospital_units` - Physical care units
- Links to facility and department
- Staffing model (nurse:patient ratio)
- Target/max census
- Acuity levels accepted (ICU vs step-down vs floor)

#### 2. `beds` - Individual bed inventory
- Room number, bed position (A/B/Window/Door)
- Bed type (standard, bariatric, pediatric, OB, ICU)
- Equipment flags (telemetry, isolation capable, negative pressure)
- Status with timestamp (available, occupied, dirty, blocked, maintenance)

#### 3. `bed_assignments` - Patient ↔ Bed relationship
- Active assignment + history
- Admit datetime, expected discharge, actual discharge
- Reason for assignment (admission, transfer, patient request)

#### 4. `daily_census_snapshots` - Daily roll-up per unit
- Census counts at midnight and current
- Admissions, discharges, transfers (in/out)
- Occupied bed hours, average acuity
- Variance from predictions

#### 5. `bed_availability_forecasts` - ML predictions
- Forecasted available beds per unit per day
- Prediction generated timestamp
- Confidence level, model version
- Input factors captured (historical LOS, scheduled surgeries, etc.)

#### 6. `los_benchmarks` - Length of Stay baselines
- DRG/diagnosis-based expected LOS
- Unit-specific adjustments
- Used for discharge prediction

#### 7. `scheduled_arrivals` - Known incoming demand
- Scheduled surgeries, planned admissions, ED boarding
- Expected unit destination
- Feed into forecasting

### Integration Strategy

**Bi-directional ADT Support:**

1. **Inbound (ADT Consumer)**
   - Accept HL7 ADT messages (A01 admit, A02 transfer, A03 discharge)
   - FHIR Encounter updates
   - Real-time bed status sync from external systems

2. **Outbound (Source of Truth)**
   - Generate ADT events when beds assigned via our UI
   - Expose API for other systems to query bed status
   - Webhook notifications for status changes

### Prediction Algorithm

```
Forecast(unit, date) =
  Current Available
  + Expected Discharges (based on LOS predictions)
  - Scheduled Admissions
  - ED Boarding Demand (historical pattern)
  + Seasonal Adjustment (day-of-week, holidays)
  + Weather/Event Factor (optional external data)
```

**LOS Prediction per Patient:**
- Base LOS from DRG/diagnosis benchmarks
- Adjust for: age, comorbidities, acuity score
- Adjust for: time already in hospital (remaining LOS)
- Incorporate discharge planning status

### Key Functions

1. `get_unit_census(unit_id, datetime)` - Point-in-time census
2. `get_bed_availability(facility_id, date_range)` - Forecast view
3. `assign_bed(patient_id, bed_id, expected_los)` - Admit/transfer
4. `release_bed(assignment_id, discharge_type)` - Discharge workflow
5. `predict_discharges(unit_id, date)` - Which patients likely leaving
6. `get_acuity_matched_beds(patient_acuity, required_equipment[])` - Smart placement
7. `calculate_unit_forecast(unit_id, days_ahead)` - Prediction engine
8. `record_census_snapshot()` - Scheduled job (midnight + intervals)

### Views/Dashboards

1. **Real-Time Bed Board** - Visual grid of all beds by unit
2. **Capacity Forecast** - 7-day lookahead chart
3. **Unit Dashboard** - Charge nurse view with census, acuity, staffing
4. **Discharge Planning** - Patients with predicted discharge dates
5. **Historical Analytics** - Occupancy trends, LOS trends, prediction accuracy

### RLS & Access Control

- All tables scoped to `tenant_id` (hospital system level)
- Bed board visible to: admin, nurse, bed_control, care_manager roles
- Forecasts visible to: admin, hospital_admin roles
- Assignment changes require: nurse+ role

### Testing Strategy

1. **Unit Tests**
   - Census calculation logic
   - LOS prediction algorithm
   - Bed matching logic

2. **Integration Tests**
   - ADT message processing
   - Forecast generation
   - Bed status transitions

3. **E2E Tests**
   - Full admit → transfer → discharge workflow
   - Prediction accuracy validation

## Implementation Order

1. ✅ Migration: Core tables (units, beds, assignments, census)
2. ✅ Migration: Forecasting tables (forecasts, benchmarks, arrivals)
3. □ Edge Functions: Bed operations (assign, release, status change)
4. □ Edge Functions: Census/forecast calculations
5. □ UI: Bed Board component
6. □ UI: Forecast dashboard
7. □ Tests: Full coverage
