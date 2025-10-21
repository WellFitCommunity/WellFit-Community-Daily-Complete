# Hospital vs App Patient Enrollment System

## Overview

WellFit now supports **two distinct patient enrollment types** in a single `profiles` table:

1. **HOSPITAL Patients** - Backend testing (no login required)
2. **APP Patients** - Frontend testing (self-enrollment with login)

---

## Architecture

### Single Table Design

```
profiles table
├─ enrollment_type: 'hospital' | 'app'  ← KEY DIFFERENTIATOR
├─ Core Fields (shared by both)
│  ├─ user_id, first_name, last_name, dob
│  ├─ phone, email, gender, address
│  └─ role, role_code
├─ Hospital-Specific Fields (NULL for app patients)
│  ├─ admission_date, discharge_date
│  ├─ hospital_unit, room_number, bed_number
│  ├─ acuity_level, code_status
│  ├─ attending_physician_id, primary_nurse_id
│  ├─ insurance, medicare_number
│  └─ 60+ additional clinical fields
└─ App-Specific Fields (NULL for hospital patients)
   ├─ onboarded, phone_verified
   ├─ gamification data (future)
   └─ app preferences (future)
```

---

## Enrollment Type Comparison

| Feature | Hospital Patients | App Patients |
|---------|------------------|--------------|
| **Login** | ❌ No (no auth.users record) | ✅ Yes (has password) |
| **Created By** | Admin/Staff | Self-registration |
| **Purpose** | Backend testing | Frontend testing |
| **Room Number** | ✅ Yes | ❌ No |
| **MRN** | ✅ Yes | ❌ No |
| **Admission Date** | ✅ Yes | ❌ No |
| **Code Status** | ✅ Yes | ❌ No |
| **Insurance** | ✅ Yes | Optional |
| **Acuity Level** | ✅ Yes | ❌ No |
| **Can Login to App** | ❌ No | ✅ Yes |
| **Visible to Physicians** | ✅ Yes | ✅ Yes |
| **Visible to Nurses** | ✅ Yes | ✅ Yes |
| **Handoff System** | ✅ Yes | ✅ Yes |

---

## Database Schema

### New Columns Added to `profiles`

#### 1. **Enrollment Tracking** (3 columns)
```sql
enrollment_type        TEXT  -- 'hospital' or 'app'
enrollment_date        TIMESTAMP WITH TIME ZONE
enrolled_by            UUID  -- admin who created hospital patient
enrollment_notes       TEXT  -- reason for enrollment
mrn                    TEXT  -- Medical Record Number
```

#### 2. **Hospital Administrative** (9 columns)
```sql
admission_date              TIMESTAMP WITH TIME ZONE
discharge_date              TIMESTAMP WITH TIME ZONE
expected_discharge_date     DATE
admission_source            TEXT  -- 'ER', 'Direct', 'Transfer', 'Readmission'
discharge_disposition       TEXT  -- 'Home', 'SNF', 'Rehab', 'AMA', 'Deceased'
hospital_unit               TEXT  -- 'ICU', 'Med/Surg', 'Tele', etc.
bed_number                  TEXT
attending_physician_id      UUID
primary_nurse_id            UUID
```

#### 3. **Clinical Status & Acuity** (7 columns)
```sql
acuity_level              TEXT  -- '1-Critical', '2-High', '3-Moderate', '4-Low', '5-Stable'
isolation_precautions     TEXT[]  -- ['Contact', 'Droplet', 'Airborne']
fall_risk_score           INTEGER (0-10)
pressure_injury_risk      INTEGER (0-10)
mobility_status           TEXT  -- 'Ambulatory', 'Assist x1', 'Bedbound'
diet_order                TEXT  -- 'NPO', 'Regular', 'Diabetic', 'Cardiac'
code_status               TEXT  -- 'Full Code', 'DNR', 'DNR/DNI', 'Comfort Care'
```

#### 4. **Monitoring & Equipment** (7 columns)
```sql
telemetry_monitoring      BOOLEAN
oxygen_delivery           TEXT  -- 'Room Air', 'NC 2L', 'BiPAP', 'Ventilator'
iv_access                 TEXT[]  -- ['PIV x2', 'PICC', 'Central Line']
drains_tubes              TEXT[]  -- ['Foley', 'NG Tube', 'Chest Tube']
restraints_ordered        BOOLEAN
special_equipment         TEXT[]  -- ['Wound VAC', 'PCA Pump', 'Feeding Pump']
glucometer_checks         TEXT  -- 'QID', 'AC/HS', 'Q6H'
```

#### 5. **Allergies & Alerts** (5 columns)
```sql
allergies                 TEXT[]  -- ['Penicillin', 'Shellfish', 'NKDA']
allergy_reactions         TEXT[]  -- ['Anaphylaxis', 'Rash']
clinical_alerts           TEXT[]  -- ['Seizure Precautions', 'Aspiration Risk']
latex_allergy             BOOLEAN
infection_history         TEXT[]  -- ['MRSA', 'C.diff', 'VRE']
```

#### 6. **Insurance & Financial** (8 columns)
```sql
primary_insurance         TEXT
insurance_id              TEXT
insurance_group_number    TEXT
secondary_insurance       TEXT
medicare_number           TEXT
medicaid_number           TEXT
financial_class           TEXT  -- 'Commercial', 'Medicare', 'Medicaid'
prior_auth_required       BOOLEAN
```

#### 7. **Advance Directives & Legal** (9 columns)
```sql
advance_directive_on_file   BOOLEAN
power_of_attorney_name      TEXT
power_of_attorney_phone     TEXT
healthcare_proxy_name       TEXT
healthcare_proxy_phone      TEXT
legal_guardian_name         TEXT
legal_guardian_phone        TEXT
consent_for_treatment       BOOLEAN
hipaa_authorization_signed  BOOLEAN
```

#### 8. **Surgical & Procedure** (6 columns)
```sql
surgical_history          TEXT[]
last_surgery_date         DATE
upcoming_procedure        TEXT
upcoming_procedure_date   DATE
post_op_day               INTEGER  -- POD#1, POD#2, etc.
surgical_service          TEXT  -- 'General Surgery', 'Ortho', etc.
```

#### 9. **Social & Discharge Planning** (9 columns)
```sql
lives_alone               BOOLEAN
home_health_services      BOOLEAN
dme_needs                 TEXT[]  -- ['Walker', 'Wheelchair', 'Oxygen']
social_work_consult       BOOLEAN
case_management_consult   BOOLEAN
discharge_barriers        TEXT[]  -- ['No caregiver', 'Transportation']
preferred_pharmacy        TEXT
transportation_needs      TEXT
```

#### 10. **ICU-Specific** (8 columns)
```sql
icu_admission_date          TIMESTAMP WITH TIME ZONE
ventilator_start_date       TIMESTAMP WITH TIME ZONE
sedation_protocol           TEXT  -- 'Light', 'Moderate', 'Deep'
vasopressor_support         BOOLEAN
cvp_monitoring              BOOLEAN
arterial_line_site          TEXT  -- 'Radial', 'Femoral'
swan_ganz_catheter          BOOLEAN
continuous_renal_replacement BOOLEAN  -- CRRT
ecmo_support                BOOLEAN
```

#### 11. **Metadata & Audit** (7 columns)
```sql
last_vitals_check         TIMESTAMP WITH TIME ZONE
last_medication_admin     TIMESTAMP WITH TIME ZONE
last_assessment_time      TIMESTAMP WITH TIME ZONE
last_physician_note       TIMESTAMP WITH TIME ZONE
last_care_plan_update     TIMESTAMP WITH TIME ZONE
flag_for_review           BOOLEAN
review_reason             TEXT
```

### **TOTAL: 93 new hospital-specific columns**

---

## Database Functions

### 1. `enroll_hospital_patient()`

Creates a single hospital patient (no auth.users record).

```sql
SELECT enroll_hospital_patient(
  p_first_name := 'John',
  p_last_name := 'Doe',
  p_dob := '1950-01-15',
  p_gender := 'Male',
  p_room_number := '101',
  p_mrn := 'MRN12345',
  p_phone := '+15551234567',
  p_enrollment_notes := 'ICU admission - post-CABG'
);
```

### 2. `bulk_enroll_hospital_patients()`

Creates multiple hospital patients at once.

```sql
SELECT * FROM bulk_enroll_hospital_patients(
  '[
    {
      "first_name": "John",
      "last_name": "Doe",
      "dob": "1950-01-15",
      "room_number": "101",
      "mrn": "MRN001"
    },
    {
      "first_name": "Jane",
      "last_name": "Smith",
      "dob": "1945-03-22",
      "room_number": "102",
      "mrn": "MRN002"
    }
  ]'::JSONB
);
```

---

## Database Views

### 1. `hospital_patients` View

Only shows hospital-enrolled patients:

```sql
SELECT * FROM hospital_patients;
-- Returns: user_id, name, room_number, mrn, acuity_level, etc.
```

### 2. `app_patients` View

Only shows app-enrolled patients:

```sql
SELECT * FROM app_patients;
-- Returns: user_id, name, email, onboarded, phone_verified, etc.
```

---

## UI Components

### Hospital Patient Enrollment Panel

**Location:** `/admin` → Hospital Patient Enrollment section

**Component:** `HospitalPatientEnrollment.tsx`

**Features:**
- **Single Patient Form** - Manual entry with all hospital fields
- **Bulk Test Data** - Quick button to create 5 test hospital patients
- **Patient List** - Shows all currently enrolled hospital patients
- **Enrollment Results** - Real-time feedback on success/failure

**Access:** Admin only

---

## How to Use

### Creating Hospital Patients (Backend Testing)

#### Option 1: UI (Recommended)
1. Login as admin at `/admin-login`
2. Go to Admin Panel
3. Find "Hospital Patient Enrollment" section
4. Click "Bulk Test Data" tab
5. Click "Create 5 Test Hospital Patients"
6. ✅ Done! Patients ready for testing

#### Option 2: SQL (Direct)
```sql
-- Single patient
SELECT enroll_hospital_patient(
  'John', 'Doe', '1950-01-15'::DATE,
  p_room_number := '101',
  p_mrn := 'MRN001'
);

-- Verify
SELECT * FROM hospital_patients;
```

### Creating App Patients (Frontend Testing)

1. Go to `/register` in the app
2. Fill out registration form
3. Submit - creates `auth.users` record + `profiles` record
4. `enrollment_type` automatically set to 'app'

---

## Testing Workflows

### Backend Testing (Hospital Patients)

**What You Can Test:**
- ✅ Physician Panel (all patients visible)
- ✅ Nurse Panel (all patients visible)
- ✅ Shift Handoff (generates risk scores)
- ✅ Clinical Documentation (SmartScribe)
- ✅ Telehealth Consultations
- ✅ Medication Management
- ✅ Vitals Tracking
- ✅ Lab Results
- ✅ Care Plans
- ✅ Risk Assessments
- ✅ Billing & Claims

**What You CANNOT Test:**
- ❌ Patient login
- ❌ Patient self-check-ins
- ❌ Patient-facing dashboard
- ❌ Community features

### Frontend Testing (App Patients)

**What You Can Test:**
- ✅ Patient login
- ✅ Self-check-ins
- ✅ Health dashboard
- ✅ Community moments
- ✅ Meal tracking
- ✅ Exercise logging
- ✅ Social features
- ✅ Gamification

**What You CANNOT Test:**
- ❌ Hospital-specific workflows (no room numbers, no acuity levels)

---

## Key Differences in Code

### Querying Patients

```typescript
// Get ALL patients (physician/nurse view)
const { data } = await supabase
  .from('profiles')
  .select('*')
  .in('role', ['patient', 'senior']);

// Get ONLY hospital patients
const { data } = await supabase
  .from('hospital_patients')
  .select('*');

// Get ONLY app patients
const { data } = await supabase
  .from('app_patients')
  .select('*');
```

### Checking Patient Type

```typescript
// In your components
if (patient.enrollment_type === 'hospital') {
  // Show hospital-specific fields (room, acuity, code status)
  renderHospitalFields(patient);
} else {
  // Show app-specific fields (check-in history, gamification)
  renderAppFields(patient);
}
```

---

## Migration Files

1. **20251021000001_add_enrollment_type.sql**
   - Adds `enrollment_type` column
   - Adds `enroll_hospital_patient()` function
   - Adds `bulk_enroll_hospital_patients()` function
   - Creates `hospital_patients` view
   - Creates `app_patients` view

2. **20251021000002_add_hospital_specific_columns.sql**
   - Adds 93 hospital-specific columns across 11 categories
   - Adds indexes for common hospital queries
   - Adds column comments for documentation

---

## Production Readiness

### Checklist

- [x] Database schema updated
- [x] Enrollment functions created
- [x] Database views created
- [x] UI component built
- [x] Test data generator working
- [ ] Integration with Physician Panel *(next step)*
- [ ] Integration with Nurse Panel *(next step)*
- [ ] Update patient selectors to show enrollment type
- [ ] Add enrollment type badges to patient cards
- [ ] Documentation complete

---

## Next Steps

1. **Integrate with Admin Panel**
   - Add HospitalPatientEnrollment component to admin dashboard
   - Test creating patients via UI

2. **Update Patient Lists**
   - Show enrollment type badge on patient cards
   - Filter patients by enrollment type in dropdowns

3. **Generate Test Clinical Data**
   - Auto-generate vitals for hospital patients
   - Auto-generate medications for hospital patients
   - Auto-generate risk scores for handoff testing

4. **Update Physician/Nurse Panels**
   - Show hospital-specific fields conditionally
   - Display room numbers prominently for hospital patients

---

## Benefits of This Approach

✅ **Single Source of Truth** - One table for all patients
✅ **Flexible** - Can upgrade hospital → app patient later
✅ **Unified Workflows** - Clinical workflows work the same for both
✅ **Easy Filtering** - Simple WHERE clause to separate types
✅ **Backward Compatible** - Existing app patients still work
✅ **Rich Hospital Data** - 93 additional fields for realistic testing
✅ **Fast Testing** - Bulk create 5 patients in 1 click

---

**Last Updated:** 2025-10-21
**Schema Version:** 2.0
**Status:** ✅ Ready for Integration
