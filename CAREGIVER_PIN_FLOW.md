# Caregiver PIN Flow - Complete Implementation Guide

## Overview
This document explains the complete caregiver access flow, including how seniors set PINs and how caregivers use them to access senior health information.

## Problem Solved
Previously, the caregiver dashboard existed but had no way for caregivers to authenticate access to senior records. Seniors had no way to set a PIN that caregivers could use. This implementation creates a complete, secure flow.

## Architecture

### Database Tables
- **`caregiver_pins`** - Stores hashed PINs for seniors
  - `senior_user_id` (UUID) - Senior's user ID
  - `pin_hash` (TEXT) - PBKDF2 hashed PIN (salt:hash format)
  - `updated_at` (TIMESTAMP) - Last update time
  - `updated_by` (UUID) - User who updated the PIN

- **`caregiver_access_log`** - HIPAA compliance audit log
  - `caregiver_id` (UUID) - Caregiver who accessed
  - `senior_id` (UUID) - Senior whose data was accessed
  - `access_time` (TIMESTAMP) - When access occurred
  - `caregiver_name` (TEXT) - Caregiver's full name
  - `senior_name` (TEXT) - Senior's full name

### Roles
- **Senior** (role_code: 4, role: 'senior') - Patients who set PINs
- **Caregiver** (role_code: 6, role: 'caregiver') - Care providers who access senior data

## Complete User Flows

### Flow 1: Senior Registration & PIN Setup

1. **Registration** ([RegisterPage.tsx](src/pages/RegisterPage.tsx))
   - User selects "Senior" role from dropdown
   - Completes phone, password, name, email
   - System creates account with role_code=4

2. **Login** ([LoginPage.tsx](src/pages/LoginPage.tsx))
   - Senior logs in with phone + password (Senior mode)
   - System checks onboarding status

3. **Onboarding Steps** (Sequential)
   - **Demographics** (`/demographics`) - Complete profile info
   - **Consent** (`/consent-photo`) - Photo consent
   - **PIN Setup** (`/set-caregiver-pin`) - **NEW STEP**
     - Senior creates 4-digit PIN
     - PIN is hashed using PBKDF2 (100,000 iterations)
     - Stored in `caregiver_pins` table
   - **Dashboard** (`/dashboard`) - Complete!

4. **Updating PIN Later** ([SettingsPage.tsx](src/pages/SettingsPage.tsx))
   - Senior goes to Settings → Security & Login section
   - Clicks "Set/Update Caregiver PIN"
   - Can change PIN anytime

### Flow 2: Caregiver Registration & Login

1. **Registration** ([RegisterPage.tsx](src/pages/RegisterPage.tsx))
   - User selects "Caregiver" role from dropdown
   - **Email is required** for caregivers (for emergency notifications)
   - Completes phone, password, name, email
   - System creates account with role_code=6

2. **Login** ([LoginPage.tsx](src/pages/LoginPage.tsx))
   - Caregiver logs in with:
     - **Option A**: Phone + password (Senior mode)
     - **Option B**: Email + password (Admin mode)
   - System detects caregiver role
   - Auto-redirects to `/caregiver-dashboard`

3. **Dashboard Redirect** ([DashboardPage.tsx](src/pages/DashboardPage.tsx))
   - If caregiver accidentally lands on `/dashboard`
   - System auto-redirects to `/caregiver-dashboard`

### Flow 3: Caregiver Accessing Senior Data

1. **Caregiver Dashboard** ([CaregiverDashboardPage.tsx](src/pages/CaregiverDashboardPage.tsx))
   - Caregiver is already logged into their account
   - Sees form requesting:
     - Senior's phone number (e.g., +1 555-123-4567)
     - Senior's 4-digit PIN

2. **PIN Validation**
   - System finds senior by phone number in `profiles` table
   - Retrieves hashed PIN from `caregiver_pins` table
   - Calls `hash-pin` edge function with `action: 'verify'`
   - Edge function uses PBKDF2 to verify PIN matches hash

3. **Audit Logging (HIPAA Compliance)**
   - **BEFORE** granting access, system logs to `caregiver_access_log`:
     - Who accessed (caregiver_id, caregiver_name)
     - Whose data (senior_id, senior_name)
     - When (access_time)
   - If logging fails, access is DENIED (compliance requirement)

4. **Access Granted**
   - Caregiver sees senior's basic info
   - Can click "View Health Dashboard" or "View Health Reports"
   - Can "End Session" to access a different senior

## Security Features

### PIN Hashing (PBKDF2)
- **Edge Function**: [supabase/functions/hash-pin/index.ts](supabase/functions/hash-pin/index.ts)
- **Algorithm**: PBKDF2 with SHA-256
- **Iterations**: 100,000 (OWASP recommended minimum)
- **Salt**: 16 bytes, cryptographically random
- **Storage Format**: `base64(salt):base64(hash)`

### PIN Validation
- Weak PINs rejected: 0000, 1234, 1111, 2222, etc.
- Must be exactly 4 digits
- PINs must match on confirmation

### Access Control
- Caregivers can ONLY access seniors who have set a PIN
- PIN verification required for each senior access
- Each access is logged for audit trail
- Role verification at multiple checkpoints

## API Endpoints

### Edge Function: hash-pin
**Location**: `supabase/functions/hash-pin/index.ts`

**Hash a PIN**:
```javascript
const { data } = await supabase.functions.invoke('hash-pin', {
  body: { pin: '1234' }
});
// Returns: { hashed: 'R3p8...==:j9kL...==' }
```

**Verify a PIN**:
```javascript
const { data } = await supabase.functions.invoke('hash-pin', {
  body: {
    pin: '1234',
    action: 'verify',
    storedHash: 'R3p8...==:j9kL...=='
  }
});
// Returns: { valid: true/false }
```

## File Changes

### New Files Created
1. **[src/pages/SetCaregiverPinPage.tsx](src/pages/SetCaregiverPinPage.tsx)**
   - PIN setup UI for seniors
   - Validation and security checks
   - Calls hash-pin edge function
   - Updates/inserts to caregiver_pins table

### Files Modified
1. **[src/App.tsx](src/App.tsx)**
   - Added lazy import for SetCaregiverPinPage
   - Added route: `/set-caregiver-pin`

2. **[src/pages/LoginPage.tsx](src/pages/LoginPage.tsx)**
   - Added PIN check in onboarding flow (lines 175-189)
   - Seniors without PIN redirected to `/set-caregiver-pin`

3. **[src/pages/CaregiverDashboardPage.tsx](src/pages/CaregiverDashboardPage.tsx)**
   - Updated to use `caregiver_pins` table (was looking for non-existent `phone_auth`)
   - Updated to use hash-pin edge function for verification
   - Better error messages

4. **[src/pages/SettingsPage.tsx](src/pages/SettingsPage.tsx)**
   - Added Caregiver PIN section in Security settings
   - Button to navigate to `/set-caregiver-pin`

## Testing Guide

### Test Case 1: New Senior Sets PIN
1. Register as Senior (role: Senior)
2. Login with phone + password
3. Complete demographics
4. Complete consent
5. **Should be redirected to `/set-caregiver-pin`**
6. Enter 4-digit PIN (e.g., 5678)
7. Confirm PIN
8. Click "Set PIN & Continue"
9. Verify redirect to dashboard

### Test Case 2: Senior Updates PIN
1. Login as existing senior
2. Go to Settings
3. Click Security & Login section
4. Click "Set/Update Caregiver PIN"
5. Enter new PIN
6. Confirm new PIN
7. Click "Update PIN"
8. Verify success message

### Test Case 3: Caregiver Accesses Senior Data
1. Register as Caregiver (role: Caregiver, **email required**)
2. Login with phone/email + password
3. **Should be auto-redirected to `/caregiver-dashboard`**
4. Enter senior's phone number (e.g., +1 555-123-4567)
5. Enter senior's PIN (e.g., 5678)
6. Click "Access Senior Information"
7. Verify access granted with senior info displayed
8. Check `caregiver_access_log` table for audit entry

### Test Case 4: Invalid PIN
1. Login as caregiver
2. Enter correct senior phone number
3. Enter **incorrect** PIN
4. Verify error: "Invalid PIN. Please try again."
5. Verify access DENIED

### Test Case 5: Senior Without PIN
1. Login as caregiver
2. Enter phone of senior who hasn't set PIN
3. Enter any PIN
4. Verify error: "Senior PIN not set up. Please ask the senior to set their caregiver PIN in Settings."

## Database Queries

### Check if senior has PIN set
```sql
SELECT senior_user_id, updated_at
FROM caregiver_pins
WHERE senior_user_id = 'UUID_HERE';
```

### View caregiver access logs
```sql
SELECT
  caregiver_name,
  senior_name,
  access_time,
  caregiver_id,
  senior_id
FROM caregiver_access_log
ORDER BY access_time DESC
LIMIT 20;
```

### Set PIN manually (testing only)
```sql
-- Use the hash-pin edge function instead!
-- This is just for understanding the table structure
INSERT INTO caregiver_pins (senior_user_id, pin_hash, updated_at, updated_by)
VALUES (
  'senior-uuid-here',
  'salt-base64:hash-base64',
  NOW(),
  'senior-uuid-here'
);
```

## HIPAA Compliance Features

1. **Audit Logging**: Every access logged BEFORE data is shown
2. **Access Control**: PIN required for each senior access
3. **Encryption**: PINs hashed with PBKDF2, never stored plaintext
4. **Accountability**: Logs track who accessed whose data and when
5. **Logging Enforcement**: If audit log write fails, access is DENIED

## Next Steps / Enhancements

### Optional Future Improvements
1. **PIN Expiration**: Require seniors to update PIN every 90 days
2. **PIN Attempt Limiting**: Lock out after 3 failed attempts
3. **Two-Factor Auth**: SMS code to senior's phone when caregiver accesses
4. **Access Permissions**: Granular permissions (view vitals vs full access)
5. **Time-Limited Access**: PIN expires after X hours
6. **Caregiver Relationships**: Pre-authorize specific caregivers in database

## Troubleshooting

### "Senior PIN not set up" Error
- Senior needs to login and complete onboarding
- Senior will be prompted to set PIN after consent
- Or senior can set PIN manually in Settings → Security

### "Invalid PIN" Error
- Verify senior's phone number is correct (format: +1 555-123-4567)
- Verify PIN is correct 4-digit number
- Have senior reset PIN in Settings if forgotten

### Caregiver Can't Access Dashboard
- Verify account has role='caregiver' and role_code=6
- Check database: `SELECT role, role_code FROM profiles WHERE user_id='UUID'`
- Update if needed: `UPDATE profiles SET role='caregiver', role_code=6 WHERE user_id='UUID'`

### Build Warnings
- The build completes successfully
- Warnings are mostly linting (console.log, unused vars)
- No blocking errors

## Summary

✅ **Complete caregiver PIN flow implemented**
- Seniors can set/update 4-digit PIN
- PIN setup integrated into onboarding
- PIN management in Settings
- Caregivers access senior data via phone + PIN
- PBKDF2 encryption (100k iterations)
- HIPAA-compliant audit logging
- All routes connected in App.tsx
- Build passes TypeScript checks

**The system is fully functional and ready for testing!**
