# Patient Handoff System - Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Step 1: Apply Database Migrations

```bash
cd /workspaces/WellFit-Community-Daily-Complete

# Option A: Apply all pending migrations
npx supabase db push

# Option B: Apply specific migrations
npx supabase migration up --file 20251003190000_patient_handoff_system.sql
npx supabase migration up --file 20251003190001_handoff_storage_bucket.sql
```

### Step 2: Verify Database Setup

```sql
-- Connect to your Supabase SQL editor and run:

-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'handoff_%';

-- Expected output:
-- handoff_packets
-- handoff_sections
-- handoff_attachments
-- handoff_logs

-- Check storage bucket
SELECT * FROM storage.buckets WHERE id = 'handoff-attachments';

-- Expected: 1 row showing the bucket configuration
```

### Step 3: Add Routes to Your App

In your `App.tsx` or routing file:

```typescript
import LiteSenderPortal from './components/handoff/LiteSenderPortal';
import ReceivingDashboard from './components/handoff/ReceivingDashboard';

// Add these routes:
<Route
  path="/handoff/send"
  element={<LiteSenderPortal facilityName="Your Facility Name" />}
/>

<Route
  path="/handoff/receive"
  element={<ReceivingDashboard facilityName="Your Facility Name" />}
/>
```

### Step 4: Test the System

1. **Navigate to Admin Panel** (`/admin`)
   - Find "Patient Handoff System" section
   - Should show empty statistics (0 transfers)

2. **Create a Test Transfer** (`/handoff/send`)
   - Fill out patient demographics
   - Set urgency to "Urgent"
   - Add test vitals (BP: 120/80, HR: 75)
   - Add sender info
   - Upload a test PDF
   - Submit

3. **Verify in Admin Panel**
   - Should now show 1 total transfer
   - Status: "Sent"
   - Click "Export to Excel" to test export

4. **Acknowledge Transfer** (`/handoff/receive`)
   - See the pending transfer
   - Click "View Details"
   - Click "Acknowledge Receipt"
   - Add notes

5. **Verify Acknowledgement**
   - Go back to Admin Panel
   - Status should be "Acknowledged"
   - Average acknowledgement time should show

---

## 🔧 Troubleshooting

### Migration Fails with "relation already exists"
This is OK! Means tables already exist. Migrations are idempotent (safe to re-run).

### "Storage bucket not found" error
Create manually in Supabase Dashboard:
1. Go to Storage
2. Create new bucket: `handoff-attachments`
3. Set to **Private**
4. File size limit: **52428800** (50MB)
5. Allowed MIME types: `application/pdf,image/jpeg,image/png`

### "Permission denied" when creating packet
Check RLS policies:
```sql
-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename LIKE 'handoff_%';

-- Should show rowsecurity = true for all tables
```

### Files won't upload
Check storage policies:
```sql
SELECT * FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage';

-- Should see policies for handoff-attachments bucket
```

### Admin Panel doesn't show handoff section
1. Verify you're logged in as admin
2. Check import statement in AdminPanel.tsx:
   ```typescript
   import AdminTransferLogs from '../handoff/AdminTransferLogs';
   ```
3. Clear browser cache and reload

---

## 📍 Key URLs

| Function | URL | Auth Required |
|----------|-----|---------------|
| Lite Sender Portal | `/handoff/send` | No (tokenized) |
| Receiving Dashboard | `/handoff/receive` | Yes (hospital staff) |
| Admin Audit Logs | `/admin` → Patient Handoff System | Yes (admin) |
| Token-Based View | `/handoff/receive/:token` | No (token validates) |

---

## 🎯 Next Steps After Setup

1. **Customize Facility Names**
   - Update `facilityName` prop in routes
   - Make dynamic based on tenant/location

2. **Enable Email/SMS Notifications**
   - See `PATIENT_HANDOFF_IMPLEMENTATION.md` section on notifications
   - Integrate with your Twilio/email service

3. **Implement Proper Encryption**
   - **CRITICAL:** Replace base64 with AES-256-GCM
   - See implementation guide for code examples

4. **Add FHIR Export**
   - Use your existing FHIR infrastructure
   - Export handoff packets as FHIR Bundles

5. **Set Up Monitoring**
   - Watch `handoff_logs` table for errors
   - Set alerts for packets not acknowledged within 2 hours
   - Monitor average acknowledgement times

---

## 💡 Pro Tips

### For Multi-Tenant Deployments
Use environment variables or tenant context:

```typescript
// Get facility name from branding config
import { getCurrentBranding } from '../branding.config';

const branding = getCurrentBranding();

<LiteSenderPortal
  facilityName={`${branding.appName} - Transfer Desk`}
/>
```

### For Testing Locally
Set token expiry to 5 minutes instead of 72 hours:

```sql
-- Temporary for testing
UPDATE handoff_packets
SET access_expires_at = now() + interval '5 minutes'
WHERE id = 'your-packet-id';
```

### For Compliance Audits
Export logs monthly:

```typescript
// Run on the 1st of each month
const lastMonth = {
  date_from: '2025-09-01',
  date_to: '2025-09-30'
};

const stats = await HandoffService.getStats(lastMonth);
// Export to Excel and submit to compliance officer
```

---

## ✅ Success Checklist

- [ ] Migrations applied successfully
- [ ] 4 tables exist in database
- [ ] Storage bucket created
- [ ] Admin Panel shows Patient Handoff section
- [ ] Can create a test transfer
- [ ] Can view transfer in receiving dashboard
- [ ] Can acknowledge transfer
- [ ] Can export to Excel
- [ ] Audit logs show all events
- [ ] Files upload and download successfully

If all checkboxes are checked, **you're ready to go!** 🎉

---

## 🙏 Support

Questions? Check:
1. Full implementation guide: `PATIENT_HANDOFF_IMPLEMENTATION.md`
2. Your Supabase logs for errors
3. Browser console for client-side errors
4. Database query logs for RLS policy issues

**May this system serve your community well and honor God's calling.** 🙏
