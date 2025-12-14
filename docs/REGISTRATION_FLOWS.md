# Registration Flows

**CRITICAL: There are THREE distinct registration flows. Each creates different database records.**

## Quick Reference Table

| Aspect | Self-Registration | Admin Enrollment | Hospital Registration |
|--------|-------------------|------------------|----------------------|
| **Product** | WellFit | WellFit | Envision Atlus |
| **auth.users Created** | YES | YES | **NO** |
| **enrollment_type** | `app` | `app` | `hospital` |
| **Can Login to App** | YES | YES | **NO** |
| **role_code** | 4,5,6,11,13 | 4 (senior) or 19 (patient) | 1 |
| **Clinical Fields** | No | No | Yes |

---

## Flow 1: Self-Registration (WellFit App)

**Who:** End users signing up themselves via `/register`

```
User fills form → SMS verification → auth.users created → profile created
```

| Aspect | Details |
|--------|---------|
| **Files** | `RegisterPage.tsx`, `supabase/functions/register/`, `sms-verify-code/` |
| **auth.users** | YES - created after SMS verification |
| **enrollment_type** | `app` |
| **role_code** | 4 (senior), 5 (volunteer), 6 (caregiver), 11 (contractor), 13 (regular) |
| **Can Login** | YES |
| **Phone Verified** | Via SMS code |

---

## Flow 2: Admin/Nurse Enrollment (WellFit App)

**Who:** Staff enrolling community members via `/enroll-senior`

```
Admin fills form → auth.users created immediately → profile created → temp password given to member
```

| Aspect | Details |
|--------|---------|
| **Files** | `EnrollSeniorPage.tsx`, `supabase/functions/enrollClient/` |
| **auth.users** | YES - created immediately by admin |
| **enrollment_type** | `app` |
| **role_code** | 4 (senior) OR 19 (patient) |
| **Can Login** | YES - with temp password from admin |
| **Phone Verified** | Auto-verified (admin-attested) |
| **Audit** | `admin_enroll_audit` table, `created_by` field |

**Role Distinction:**
- **role_code 4 (senior)** - Geriatric patients with age-specific needs and UI
- **role_code 19 (patient)** - Regular (non-geriatric) patients

---

## Flow 3: Hospital Registration (Envision Atlus Only)

**Who:** Hospital staff creating clinical patient records - **NO APP ACCESS**

```
Hospital staff fills form → profile ONLY created → NO auth.users record
```

| Aspect | Details |
|--------|---------|
| **Files** | `HospitalPatientEnrollment.tsx`, `enroll_hospital_patient()` function |
| **auth.users** | **NO** - patient cannot login |
| **enrollment_type** | `hospital` |
| **role_code** | 1 (patient - clinical context) |
| **Can Login** | **NO** - backend/clinical record only |
| **Clinical Fields** | MRN, room_number, bed_number, acuity_level, code_status, admission_date, attending_physician_id |
| **Purpose** | EHR integration, physician workflows, shift handoffs |

---

## Key Schema Fields

```sql
-- Differentiates app users from hospital-only patients
enrollment_type TEXT DEFAULT 'app' CHECK (enrollment_type IN ('hospital', 'app'))

-- Hospital-specific fields (Flow 3 only)
mrn, hospital_unit, bed_number, acuity_level, code_status,
admission_date, attending_physician_id, enrolled_by, enrollment_notes
```

## Database Views

```sql
-- Filter by enrollment type
CREATE VIEW hospital_patients AS SELECT ... WHERE enrollment_type = 'hospital';
CREATE VIEW app_patients AS SELECT ... WHERE enrollment_type = 'app';
```
