# HL7 FHIR Launch Checklist - Quick Action Guide

**Status:** ✅ All FHIR migrations are ALREADY APPLIED to your database!

---

## ✅ GOOD NEWS - Already Done

Looking at your migration status, **ALL FHIR database tables are already created** in your production database:

- ✅ `20251017000002_fhir_interoperability_system.sql` - APPLIED
- ✅ `20251017100000_fhir_medication_request.sql` - APPLIED
- ✅ `20251017100001_fhir_condition.sql` - APPLIED
- ✅ `20251017100002_fhir_diagnostic_report.sql` - APPLIED
- ✅ `20251017100003_fhir_procedure.sql` - APPLIED
- ✅ `20251017100004_us_core_extensions.sql` - APPLIED
- ✅ `20251017120000_fhir_observations.sql` - APPLIED
- ✅ `20251017130000_fhir_immunizations.sql` - APPLIED
- ✅ `20251017140000_fhir_care_plan.sql` - APPLIED
- ✅ `20251017150000_fhir_practitioner.sql` - APPLIED
- ✅ `20251018000000_ensure_fhir_procedures_exists.sql` - APPLIED

**Database Status:** 100% Ready for FHIR Integration ✅

---

## 🎯 What You Need to Do Before Launch

### Priority 1: Register with an EHR Vendor (START NOW)

This is your **critical path** - it can take 1-4 weeks for approval.

#### Choose Your EHR System:

**Option A: Epic (Recommended - 60% of US hospitals use Epic)**
```
1. Go to: https://fhir.epic.com/Developer/Apps
2. Click "Sign Up for a Developer Account"
3. Fill out registration form
4. Select app type: "Patient Standalone Launch"
5. Request these FHIR scopes:
   - patient/*.read
   - patient/*.write (if you need to write data back)
   - launch/patient
   - openid fhirUser
6. Set redirect URI: https://your-domain.com/smart-callback
7. Submit for approval
8. Wait 1-4 weeks for approval email
9. You'll receive: Client ID + FHIR Base URL
```

**Option B: Cerner (Oracle Health)**
```
1. Go to: https://code-console.cerner.com/
2. Register developer account
3. Create new application
4. Request same scopes as Epic
5. Wait for approval (usually 1-2 weeks)
6. You'll receive: Client ID + Tenant ID
```

**Option C: Testing/Sandbox (For immediate testing)**
```
Use SMART Health IT public sandbox:
- FHIR URL: https://launch.smarthealthit.org/v/r4/sim/
- No registration required
- Good for testing, not production
```

---

### Priority 2: Configure Environment Variables (10 minutes)

Once you receive your EHR credentials, add to Vercel environment variables:

```env
# Core FHIR Configuration
REACT_APP_FHIR_ENABLED=true

# Your EHR Connection (Epic example)
REACT_APP_FHIR_DEFAULT_SERVER=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
REACT_APP_FHIR_CLIENT_ID=your_epic_client_id_here

# Sync Settings (start conservative)
REACT_APP_FHIR_AUTO_SYNC_ENABLED=false  # Manual sync only at first
REACT_APP_FHIR_SYNC_BATCH_SIZE=50
REACT_APP_FHIR_SYNC_RETRY_ATTEMPTS=3

# If using Epic specifically:
REACT_APP_EPIC_FHIR_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
REACT_APP_EPIC_CLIENT_ID=your_epic_client_id

# If using Cerner specifically:
REACT_APP_CERNER_FHIR_URL=https://fhir-ehr-code.cerner.com/r4/your-tenant-id
REACT_APP_CERNER_CLIENT_ID=your_cerner_client_id
```

**How to add in Vercel:**
1. Go to your Vercel project dashboard
2. Settings → Environment Variables
3. Add each variable above
4. Click "Save"
5. Redeploy your app

---

### Priority 3: Test FHIR Connection (30 minutes after env vars added)

Once environment variables are configured:

1. **Navigate to Admin Dashboard:**
   ```
   https://your-domain.com/admin/fhir-integration
   ```

2. **Create EHR Connection:**
   - Click "Add Connection"
   - Fill in:
     - Name: "Epic Production" (or your EHR name)
     - FHIR Server URL: (from Epic/Cerner)
     - EHR System: Select "EPIC" or "CERNER"
     - Client ID: (from Epic/Cerner registration)
     - Sync Frequency: "Manual" (start here)
     - Sync Direction: "Pull" or "Bidirectional"
   - Click "Save"

3. **Test Connection:**
   - Click "Test Connection" button
   - Expected result: "✅ Connection successful" + FHIR version info
   - If failed: Check FHIR URL format and client ID

4. **Authenticate (OAuth):**
   - Click "Authenticate" button
   - You'll be redirected to Epic/Cerner login
   - Login with your EHR credentials
   - Approve scopes
   - Redirected back to your app
   - Connection status should now be "Active"

---

### Priority 4: Map Test Patient (15 minutes)

Before going live, test with ONE patient:

1. **In Admin Dashboard:**
   - Navigate to "Patient Mappings" tab
   - Click "Add Mapping"

2. **Fill in mapping:**
   - Community User ID: [Select a test patient from your system]
   - FHIR Patient ID: [Get from EHR - example: "e63wRTbPfr1p8UW81d8Seiw3"]
   - Connection: [Select the connection you created]
   - Click "Save"

3. **How to get FHIR Patient ID:**
   - Option A: From EHR system (usually in patient record)
   - Option B: Search via FHIR API:
     ```bash
     curl "https://fhir.epic.com/.../Patient?identifier=MRN|12345" \
       -H "Authorization: Bearer YOUR_TOKEN"
     ```
   - Option C: Ask your EHR admin

---

### Priority 5: Test Sync (20 minutes)

Now test the actual data synchronization:

1. **Perform Manual Sync:**
   - In admin dashboard, select your connection
   - Click "Sync from FHIR" (pull data from EHR)
   - Watch progress indicator
   - Wait for completion (should take 10-60 seconds for one patient)

2. **Verify Success:**
   - Click "View Sync Logs" tab
   - Latest log should show:
     - Status: "Success" ✅
     - Records Processed: 1+
     - Records Succeeded: 1+
     - Errors: 0

3. **Check Patient Data:**
   - Navigate to your patient's profile
   - Verify new data appeared:
     - Medications from EHR
     - Vitals/observations from EHR
     - Conditions/diagnoses from EHR
     - Lab results (if any)

4. **If Errors Occurred:**
   - Check sync log "Errors" column
   - Common issues:
     - Missing patient mapping → Add mapping
     - Token expired → Re-authenticate
     - Invalid FHIR ID → Verify patient ID in EHR
   - Fix and retry

---

### Priority 6: Production Rollout (1-2 days)

Once test sync succeeds:

1. **Map All Patients:**
   - Option A: One-by-one in admin UI
   - Option B: Bulk import via CSV (you'll need to create this)
   - Each patient needs: Community ID + FHIR Patient ID

2. **Initial Sync:**
   - Perform manual sync for all patients
   - Monitor sync logs closely
   - Resolve any errors immediately

3. **Enable Auto-Sync (Optional):**
   - After 24 hours of successful manual syncs
   - Update environment variable:
     ```env
     REACT_APP_FHIR_AUTO_SYNC_ENABLED=true
     ```
   - Set frequency in admin dashboard (hourly/daily)
   - Monitor for first 48 hours

4. **Train Your Team:**
   - Show admins how to:
     - Add new patient mappings
     - Trigger manual syncs
     - Resolve conflicts
     - Read sync logs
   - Show clinical staff:
     - Where synced data appears
     - How allergy alerts work
     - How to verify data accuracy

---

## 📊 Timeline Summary

| Task | Time Required | Can Start |
|------|---------------|-----------|
| Register with EHR | 1-4 weeks (waiting) | ✅ NOW |
| Configure env vars | 10 minutes | After EHR approval |
| Test connection | 30 minutes | After env vars |
| Map test patient | 15 minutes | After connection |
| Test sync | 20 minutes | After mapping |
| Production rollout | 1-2 days | After successful test |

**Total Timeline:** 2-5 weeks (mostly waiting for EHR approval)

---

## 🚨 Common Mistakes to Avoid

1. ❌ **Don't skip sandbox testing** - Always test in sandbox before production
2. ❌ **Don't enable auto-sync immediately** - Start with manual sync
3. ❌ **Don't forget to authenticate** - OAuth token expires regularly
4. ❌ **Don't ignore sync errors** - Failed syncs can cause data inconsistencies
5. ❌ **Don't sync all patients at once** - Start with a small batch (10-20)
6. ❌ **Don't forget RLS** - Verify patients can only see their own data

---

## 🆘 Quick Troubleshooting

### "Test Connection Failed"
- ✅ Check FHIR URL has no trailing slash
- ✅ Verify client ID is correct (no typos)
- ✅ Confirm app is approved by EHR vendor
- ✅ Check Vercel logs for detailed error

### "401 Unauthorized"
- ✅ Click "Re-authenticate" in admin dashboard
- ✅ Complete OAuth flow again
- ✅ New token will be saved

### "Patient Mapping Not Found"
- ✅ Create mapping first (step 4 above)
- ✅ Verify FHIR patient ID is correct
- ✅ Check spelling/formatting of IDs

### "Sync Takes Too Long"
- ✅ Reduce batch size: `REACT_APP_FHIR_SYNC_BATCH_SIZE=25`
- ✅ Sync fewer patients at once
- ✅ Check your internet connection
- ✅ Verify EHR system isn't rate-limiting you

---

## ✅ Launch Day Checklist

**Before launch, verify ALL of these:**

- [ ] All FHIR migrations applied (✅ Already done!)
- [ ] EHR vendor approved your app
- [ ] Environment variables configured in Vercel
- [ ] Test connection succeeded
- [ ] Test patient mapped
- [ ] Test sync completed successfully
- [ ] Verified synced data appears correctly
- [ ] Team trained on FHIR dashboard
- [ ] Monitoring/alerts configured
- [ ] Rollback plan documented
- [ ] Support contact (EHR vendor) identified

---

## 📞 Need Help?

**If you get stuck:**

1. Check detailed guide: [docs/HL7_FHIR_LAUNCH_READINESS.md](./docs/HL7_FHIR_LAUNCH_READINESS.md)
2. Check FHIR interoperability guide: [docs/FHIR_INTEROPERABILITY_GUIDE.md](./docs/FHIR_INTEROPERABILITY_GUIDE.md)
3. Check Epic/Cerner documentation
4. Ask me for help with specific error messages!

---

## 🎉 You're Almost Ready!

Your FHIR integration is **fully implemented and database-ready**. You just need to:

1. ⏳ **Register with EHR vendor** (START THIS NOW - takes 1-4 weeks)
2. ⚙️ **Configure environment variables** (10 minutes)
3. 🧪 **Test connection & sync** (1 hour)
4. 🚀 **Roll out to production** (1-2 days)

**The hard part is done - now it's just configuration!**

---

**Last Updated:** October 18, 2025
**Status:** Database ready ✅ | Awaiting EHR registration ⏳
