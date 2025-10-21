# Nurse Shift Handoff Testing Guide

## Overview
The **Smart Shift Handoff Dashboard** is an AI-assisted patient prioritization system that helps nurses during shift changes. The system auto-scores patient risk levels and allows nurses to quickly confirm or adjust them.

## Where to Find It

### In the UI:
1. **Nurse Panel**: `/nurse` route
2. **Section**: "Smart Shift Handoff - Patient Prioritization" (🔄 icon)
3. **Default State**: Opened by default when you visit the nurse panel

## How It Works

### System Architecture:
```
┌─────────────────────┐
│   Patient Data      │
│  (vitals, meds,     │
│   conditions, etc)  │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  AI Auto-Scoring    │
│  (calculates risk)  │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ Nurse Dashboard     │
│ - Confirm (1-click) │
│ - Adjust (manual)   │
└─────────────────────┘
```

## Database Tables

The handoff system uses these tables:

| Table | Purpose |
|-------|---------|
| `shift_handoff_risk_scores` | Stores AI-calculated risk scores for each patient |
| `shift_handoff_events` | Clinical events that affect risk (lab results, vital changes, etc) |
| `shift_handoff_overrides` | Nurse adjustments to auto-scores |
| `handoff_packets` | Complete handoff documentation |
| `handoff_logs` | Audit trail of handoff activities |

## How to Test

### ✅ Step 1: Check if Functions Exist

```sql
-- Run this in your Supabase SQL editor or psql:
\df get_current_shift_handoff
\df nurse_review_handoff_risk
\df calculate_shift_handoff_risk
```

**Expected Result**: All three functions should exist.

### ✅ Step 2: Verify Tables Exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%handoff%'
ORDER BY table_name;
```

**Expected Result**: You should see 8 handoff tables:
- handoff_attachments
- handoff_logs
- handoff_packets
- handoff_risk_snapshots
- handoff_sections
- shift_handoff_events
- shift_handoff_overrides
- shift_handoff_risk_scores

### ✅ Step 3: Create Test Patients

The handoff system needs patients to work with. Run this to create test data:

```sql
-- Insert test patients
INSERT INTO profiles (user_id, first_name, last_name, dob, role, room_number)
VALUES
  (gen_random_uuid(), 'John', 'Doe', '1950-01-15', 'patient', '101'),
  (gen_random_uuid(), 'Jane', 'Smith', '1945-03-22', 'patient', '102'),
  (gen_random_uuid(), 'Robert', 'Johnson', '1960-07-10', 'senior', '103')
RETURNING user_id, first_name, last_name, room_number;
```

### ✅ Step 4: Generate Risk Scores

The system needs to calculate risk scores for the shift handoff:

```sql
-- Calculate risk scores for all patients for the current shift
SELECT calculate_shift_handoff_risk(user_id, 'night')
FROM profiles
WHERE role IN ('patient', 'senior');
```

**Expected Result**: Should return risk scores like 'LOW', 'MEDIUM', 'HIGH', or 'CRITICAL'.

### ✅ Step 5: View Handoff Dashboard Data

```sql
-- Get the shift handoff summary (what nurses see)
SELECT * FROM get_current_shift_handoff('night');
```

**Expected Columns**:
- patient_id
- patient_name
- room_number
- final_risk_level (e.g., 'HIGH', 'MEDIUM', 'LOW', 'CRITICAL')
- auto_risk_level
- nurse_reviewed (boolean)
- nurse_adjusted (boolean)
- handoff_priority (lower number = higher priority)
- risk_factors (array of reasons)
- clinical_snapshot (JSON with vitals, conditions, etc)
- recent_events (JSON with recent changes)

### ✅ Step 6: Test in the UI

1. **Login as a Nurse**:
   - Go to `/nurse-login`
   - Enter nurse PIN (or use admin to set up a nurse account)

2. **Navigate to Nurse Panel**:
   - Should automatically go to `/nurse`
   - Look for "Smart Shift Handoff - Patient Prioritization" section
   - It should be expanded by default

3. **Expected UI Elements**:
   - **Shift Type Selector**: Day / Evening / Night tabs
   - **Patient Cards**: Color-coded by risk level
     - 🔴 CRITICAL (red)
     - 🟠 HIGH (orange)
     - 🟡 MEDIUM (yellow)
     - 🟢 LOW (green)
   - **One-Click Confirm**: ✅ button to confirm auto-score
   - **Adjust Button**: Allows nurse to override with their own assessment
   - **Metrics**: Shows pending reviews, confirmed count, adjusted count

4. **Test Actions**:
   - ✅ Click "Confirm" on a patient → Should mark as reviewed
   - 🔧 Click "Adjust" → Should open modal to change risk level
   - 🎉 Complete all patients → Should show celebration animation

### ✅ Step 7: Verify Nurse Review Works

```sql
-- After confirming a patient in UI, check the database:
SELECT
  patient_id,
  auto_risk_level,
  nurse_risk_level,
  nurse_reviewed_at,
  nurse_adjustment_reason
FROM shift_handoff_risk_scores
WHERE nurse_reviewed_at IS NOT NULL
ORDER BY nurse_reviewed_at DESC
LIMIT 5;
```

**Expected Result**:
- `nurse_reviewed_at` should have a timestamp
- If nurse just confirmed: `nurse_risk_level` should be NULL (means they agreed)
- If nurse adjusted: `nurse_risk_level` should have their override value

## Common Issues & Troubleshooting

### Issue 1: "No patients to handoff"
**Cause**: No patient data in the system
**Fix**: Run Step 3 above to create test patients

### Issue 2: "No risk scores calculated"
**Cause**: Risk calculation function hasn't run
**Fix**: Run Step 4 above to generate risk scores

### Issue 3: "Function does not exist"
**Cause**: Migration files not applied
**Fix**:
```bash
# Find handoff migrations
ls supabase/migrations/*handoff*.sql

# Apply them manually
PGPASSWORD="..." psql -h ... -f supabase/migrations/XXXXX_handoff_migration.sql
```

### Issue 4: Empty dashboard in UI
**Cause**: No data for selected shift type
**Fix**:
1. Check which shift you have data for (night/day/evening)
2. Switch shift tabs in the UI
3. Or generate data for current shift using Step 4

## Success Criteria

✅ **Working Handoff System:**
1. Database functions exist and return data
2. UI shows patient cards with risk levels
3. Nurse can confirm auto-scores (1-click)
4. Nurse can adjust risk levels when needed
5. Dashboard metrics update in real-time
6. Celebration animation appears when all patients reviewed

## Key Features to Test

### 1. Auto-Scoring
- System calculates risk automatically
- Based on: vitals, medications, conditions, recent events
- Prioritizes CRITICAL patients first

### 2. Nurse Review
- **Confirm**: Nurse agrees with auto-score (NULL override)
- **Adjust**: Nurse changes the risk level with a reason

### 3. Metrics Dashboard
```
┌─────────────────────────────────────┐
│  Pending Reviews: 12                │
│  Confirmed (Auto): 8                │
│  Adjusted (Manual): 2               │
│  Bypass Used: 1/3 (this shift)      │
└─────────────────────────────────────┘
```

### 4. Risk Factors Display
Each patient card shows **why** they're high risk:
- "BP trending up (145/95 → 160/100)"
- "New antibiotic started"
- "3+ chronic conditions"
- "Fall risk score: 8/10"

## Advanced Testing

### Test Real-Time Updates
```sql
-- Simulate a vital sign change
INSERT INTO shift_handoff_events (
  patient_id,
  event_type,
  event_description,
  risk_impact
) VALUES (
  '...patient-uuid...',
  'vital_sign_change',
  'Blood pressure spike: 180/110',
  'increase'
);

-- Recalculate risk
SELECT calculate_shift_handoff_risk('...patient-uuid...', 'night');
```

Dashboard should update showing new risk level.

### Test Bypass Functionality
Nurses get 3 bypasses per shift for emergencies:
1. Click "Bypass" button
2. Enter reason
3. Submit handoff without reviewing all patients
4. Check bypass count decrements

## Production Readiness Checklist

- [ ] All 8 handoff tables exist
- [ ] All 3 RPC functions work
- [ ] Auto-scoring calculates correctly
- [ ] Nurse can confirm auto-scores
- [ ] Nurse can adjust with reasons
- [ ] Bypass system works (3 per shift)
- [ ] Celebration shows when complete
- [ ] Audit trail logs all actions
- [ ] Real-time updates work
- [ ] Shift transitions (day→evening→night)

## Support

If handoff is not working:
1. Check database tables exist (Step 2)
2. Check functions exist (Step 1)
3. Create test patients (Step 3)
4. Generate risk scores (Step 4)
5. Check UI console for errors (F12 → Console)
6. Verify nurse is logged in with correct role

---

**Last Updated**: 2025-10-21
**Version**: 1.0
**Component**: Smart Shift Handoff Dashboard
