# Patient Role Migration Guide

## Overview
Added universal "patient" role (ID 16) to support all age groups while maintaining backward compatibility with "senior" role (ID 4).

## Current State (Post-Migration)

### Roles Table
| Role ID | Name | Purpose | Age Range |
|---------|------|---------|-----------|
| **4** | `senior` | Legacy care recipients | 55+ years |
| **16** | `patient` | Universal care recipients | All ages (0-120+) |

### Age Thresholds
- **Senior Status**: Age 55+ (senior wellness program standard)
- **Pediatric**: Age 0-17
- **Adult**: Age 18-54
- **Senior**: Age 55+

## Migration Applied
**Date**: 2025-11-10
**File**: `supabase/migrations/20251110000000_add_patient_role.sql`

```sql
INSERT INTO public.roles (id, name)
VALUES (16, 'patient')
ON CONFLICT (id) DO NOTHING;
```

## Frontend Changes
1. **Login Page** (`src/pages/LoginPage.tsx`):
   - Added "Patient Login (Phone)" button
   - Both patient and senior use phone/password authentication

2. **Registration Page** (`src/pages/RegisterPage.tsx`):
   - "Patient" is now the default role (first option)
   - "Senior" remains available for backward compatibility

3. **TypeScript Types** (`src/types/roles.ts`):
   - Added `RoleCode.PATIENT = 16`
   - Marked `senior` role as DEPRECATED

## Future Data Migration (When Ready)

### Option 1: Migrate All Senior Users to Patient Role
```sql
-- Update existing senior users to patient role
UPDATE public.profiles
SET role = 'patient',
    role_code = 16
WHERE role = 'senior' OR role_code = 4;

-- Add is_senior flag based on age (55+)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_senior BOOLEAN DEFAULT FALSE;

UPDATE public.profiles
SET is_senior = TRUE
WHERE role_code = 16
  AND date_part('year', age(COALESCE(date_of_birth, '1960-01-01'::date))) >= 55;
```

### Option 2: Keep Both Roles, Add Age Demographics
```sql
-- Add age demographics columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS age_group TEXT CHECK (age_group IN ('pediatric', 'adult', 'senior'));

-- Auto-populate age_group based on DOB
CREATE OR REPLACE FUNCTION update_age_group()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL THEN
    CASE
      WHEN date_part('year', age(NEW.date_of_birth)) < 18 THEN
        NEW.age_group := 'pediatric';
      WHEN date_part('year', age(NEW.date_of_birth)) BETWEEN 18 AND 54 THEN
        NEW.age_group := 'adult';
      WHEN date_part('year', age(NEW.date_of_birth)) >= 55 THEN
        NEW.age_group := 'senior';
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_age_group_on_dob
BEFORE INSERT OR UPDATE OF date_of_birth ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION update_age_group();
```

## Recommended Approach

**Use "patient" role for all new enrollments** and determine senior status by age demographics (55+), not role.

### Benefits:
1. **FHIR Compliance**: Aligns with industry standard
2. **Age Flexibility**: Supports pediatric (0-17), adult (18-54), senior (55+)
3. **Methodist Healthcare**: Enterprise-ready for multi-generational care
4. **Backward Compatible**: Existing "senior" users continue working

## UI/UX Recommendations

### Registration Form
- Default role: "Patient"
- Collect Date of Birth (required)
- Auto-set `age_group` based on DOB
- Show age-appropriate welcome message

### Dashboard
- Age 55+: Show senior-focused UI (larger text, trivia, affirmations)
- Age 18-54: Show adult wellness features
- Age 0-17: Show pediatric/guardian portal

## Code References
- Migration: `/supabase/migrations/20251110000000_add_patient_role.sql`
- TypeScript Types: `/src/types/roles.ts:86` (RoleCode.PATIENT = 16)
- Login Page: `/src/pages/LoginPage.tsx:19` (Mode type)
- Registration: `/src/pages/RegisterPage.tsx:25` (PUBLIC_ROLES)

## Notes
- **Senior age threshold**: 55+ (senior wellness program standard)
- **Not 65+**: That's Medicare/geriatric threshold - too high for wellness programs
- AARP starts at 50, many senior centers use 55+
- WellFit uses **55+** for senior designation
