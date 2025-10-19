# Testing Guide: AI-Powered Adaptive Dashboard

**Status:** ✅ READY FOR TESTING
**Phase:** Test-and-Break (no real patient data)
**Deployment:** Edge Function deployed, database ready

---

## 🎯 What You're Testing

The **AI-Powered Adaptive Dashboard** learns from each user's behavior and automatically reorganizes the admin panel to show the most relevant sections first.

### Features to Test:

1. **Behavioral Learning**
   - Dashboard tracks which sections you open/close
   - Learns your usage patterns over 30 days
   - Automatically prioritizes your most-used sections

2. **AI-Powered Insights** (Claude Haiku 4.5)
   - Analyzes your behavior patterns
   - Provides personalized welcome messages
   - Suggests relevant sections based on time of day
   - Detects workflow patterns

3. **Adaptive Layout**
   - Sections reorder based on usage frequency
   - "High Priority" badges for frequently-used sections
   - "Learning..." badges during initial usage
   - Collapsible sections remember your preferences

---

## ✅ Deployment Status

### Database Setup: ✅ READY
- Table: `admin_usage_tracking` - **EXISTS**
- RLS Policies: **ACTIVE**
  - ✅ Users can only see their own data
  - ✅ Users can insert their own tracking data
  - ✅ Admins can view all data for analytics
- Indexes: **CREATED** (fast queries on user_id, created_at, section_id)

### Edge Function: ✅ DEPLOYED
- Function: `claude-personalization` - **ACTIVE**
- PHI Redaction: **ENABLED**
- Audit Logging: **ENABLED**
- Model: Claude Haiku 4.5 (ultra-fast, cheap)

### Frontend Code: ✅ BUILT
- Build Status: **PASSING** (no TypeScript errors)
- Components: IntelligentAdminPanel, AdaptiveCollapsibleSection
- Services: dashboardPersonalizationAI, userBehaviorTracking

---

## 🧪 How to Test

### Test 1: Basic Tracking (5 minutes)

**Goal:** Verify behavior tracking works

1. **Log in as test admin user**
   - Use your test account (not real patient data)

2. **Open the Admin Panel**
   - Navigate to `/admin` or wherever IntelligentAdminPanel is used

3. **Interact with sections:**
   - Open "Revenue Dashboard" - wait 10 seconds
   - Close it
   - Open "Patient Engagement" - wait 5 seconds
   - Close it
   - Open "Revenue Dashboard" again - wait 10 seconds

4. **Verify tracking in database:**
   ```sql
   SELECT
     section_name,
     action,
     time_spent,
     created_at
   FROM admin_usage_tracking
   WHERE user_id = 'YOUR_TEST_USER_ID'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

**Expected Results:**
- ✅ 3+ rows in `admin_usage_tracking` table
- ✅ Actions: 'open' entries for each section
- ✅ `time_spent` values populated (in seconds)
- ✅ No data from other users visible (RLS working)

---

### Test 2: Pattern Recognition (10 minutes)

**Goal:** Verify AI learns your behavior

1. **Create a usage pattern:**
   - Over 3-5 minutes, interact with the same 2-3 sections repeatedly
   - Example pattern:
     - Open "Revenue Dashboard" 5 times
     - Open "CCM Autopilot" 3 times
     - Open "Patient Engagement" 2 times

2. **Refresh the page**
   - The dashboard should reload with your pattern data

3. **Check for personalization:**
   - Look for "High Priority" badges on frequently-used sections
   - Check if sections reordered (most-used at top)
   - Look for personalized welcome message

**Expected Results:**
- ✅ "Revenue Dashboard" shows "High Priority" badge (most opened)
- ✅ Welcome message mentions your frequently-used sections
- ✅ Sections reordered by usage frequency
- ✅ AI suggestions appear (e.g., "You often use Revenue Dashboard in the morning")

---

### Test 3: AI Insights (15 minutes)

**Goal:** Verify Claude Haiku 4.5 integration works

1. **Build up usage history:**
   - Interact with 5-7 different sections
   - Spend different amounts of time in each
   - Repeat over 2-3 sessions (log out/log back in)

2. **Check AI-generated content:**
   - Look for personalized welcome message (changes based on time of day)
   - Look for AI suggestions (e.g., "Based on your workflow...")
   - Check for "Learning..." badges on new sections

3. **Verify audit logging:**
   ```sql
   SELECT
     request_type,
     model,
     input_tokens,
     output_tokens,
     cost,
     success,
     created_at
   FROM claude_usage_logs
   WHERE request_type = 'dashboard_prediction'
   AND user_id = 'YOUR_TEST_USER_ID'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

**Expected Results:**
- ✅ Personalized welcome message (not generic)
- ✅ AI suggestions based on your usage patterns
- ✅ Audit log entries in `claude_usage_logs` table
- ✅ Model: `claude-haiku-4-5-20250919`
- ✅ Cost: ~$0.0001 per request (very cheap)
- ✅ `success = true`

---

### Test 4: HIPAA Compliance (10 minutes)

**Goal:** Verify no PHI is stored or sent to Claude

1. **Create section with "bad" name (simulated PHI):**
   - This is a code-level test - you'd need to modify IntelligentAdminPanel.tsx
   - Try adding a test section with title: "Patient: John Doe john@test.com"

2. **Open that section**

3. **Check database:**
   ```sql
   SELECT section_name
   FROM admin_usage_tracking
   WHERE user_id = 'YOUR_TEST_USER_ID'
   AND created_at > NOW() - INTERVAL '5 minutes'
   ORDER BY created_at DESC;
   ```

**Expected Results:**
- ✅ Section name is sanitized to "generic-section" (PHI blocked)
- ✅ Warning in browser console: "HIPAA: Blocked PHI in section name"
- ✅ No email/phone/SSN visible in database

---

### Test 5: Multi-User Isolation (5 minutes)

**Goal:** Verify users can't see each other's data (RLS working)

1. **Log in as Test User A**
   - Interact with 3 sections

2. **Log out and log in as Test User B**
   - Interact with 2 different sections

3. **Check database for User A:**
   ```sql
   -- This query should ONLY return User A's data when run as User A
   SELECT user_id, section_name, COUNT(*)
   FROM admin_usage_tracking
   GROUP BY user_id, section_name;
   ```

4. **Try to query User B's data directly (should fail):**
   ```sql
   -- This should return 0 rows due to RLS
   SELECT * FROM admin_usage_tracking
   WHERE user_id = 'USER_B_UUID';
   ```

**Expected Results:**
- ✅ User A sees only their own data
- ✅ User B sees only their own data
- ✅ Cross-user query returns 0 rows (RLS blocking)
- ✅ Admin users can see ALL data (admin policy working)

---

### Test 6: Error Handling (5 minutes)

**Goal:** Verify graceful degradation when AI fails

1. **Simulate AI failure:**
   - Temporarily remove/invalidate ANTHROPIC_API_KEY in Supabase secrets
   - Or modify Edge Function to throw error

2. **Reload admin panel**

3. **Observe behavior:**
   - Dashboard should still load
   - Sections should still be usable
   - Fallback to pattern-based insights (no AI)

**Expected Results:**
- ✅ Dashboard loads (doesn't crash)
- ✅ Sections still track usage
- ✅ Pattern-based sorting works (no AI needed)
- ✅ Error logged in `claude_usage_logs` with `success = false`
- ✅ Generic welcome message shown (no AI personalization)

---

## 🔍 What to Look For (Break It!)

### Good Behaviors ✅
- Dashboard loads quickly
- Sections reorder after 5-10 interactions
- Welcome message personalizes after 3+ sessions
- No lag when opening/closing sections
- Tracking happens silently (no user friction)

### Bad Behaviors ❌ (Report These!)
- Dashboard freezes or crashes
- Sections don't reorder even after 20+ interactions
- Welcome message stays generic forever
- Errors in browser console (check DevTools)
- Slow page loads (>3 seconds)
- Data from other users visible
- PHI visible in database (emails, names, etc.)
- Missing audit logs in `claude_usage_logs`

---

## 📊 Database Queries for Testing

### Check Your Usage Data
```sql
SELECT
  section_name,
  action,
  time_spent,
  created_at
FROM admin_usage_tracking
WHERE user_id = auth.uid() -- Your ID
ORDER BY created_at DESC
LIMIT 20;
```

### Check Usage Analytics
```sql
SELECT
  section_name,
  COUNT(*) as total_opens,
  SUM(time_spent) as total_seconds,
  MAX(created_at) as last_used
FROM admin_usage_tracking
WHERE user_id = auth.uid()
AND action = 'open'
GROUP BY section_name
ORDER BY total_opens DESC;
```

### Check AI Audit Logs
```sql
SELECT
  request_type,
  model,
  input_tokens,
  output_tokens,
  cost,
  response_time_ms,
  success,
  error_message,
  created_at
FROM claude_usage_logs
WHERE request_type = 'dashboard_prediction'
AND user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;
```

### Check RLS Policies (Admin Only)
```sql
-- This should return 0 rows if you're not an admin
SELECT *
FROM admin_usage_tracking
WHERE user_id != auth.uid();
```

---

## 🐛 Common Issues & Fixes

### Issue: "Edge Function not found"
**Fix:** Run deployment again:
```bash
npx supabase functions deploy claude-personalization --project-ref xkybsjnvuohpqpbkikyn
```

### Issue: "Permission denied" when inserting tracking data
**Fix:** Verify RLS policies:
```sql
SELECT * FROM pg_policies WHERE tablename = 'admin_usage_tracking';
```

### Issue: No AI insights appearing
**Fix:**
1. Check ANTHROPIC_API_KEY is set in Supabase secrets
2. Check `claude_usage_logs` for error messages
3. Verify Edge Function deployed successfully

### Issue: Sections not reordering
**Fix:**
1. Verify you've opened sections at least 5+ times
2. Check database has tracking data
3. Try refreshing the page
4. Check browser console for errors

---

## 📈 Success Criteria

After testing, you should be able to confirm:

- ✅ **Tracking Works:** Data appears in `admin_usage_tracking` table
- ✅ **AI Works:** Personalized messages appear, audit logs in `claude_usage_logs`
- ✅ **Security Works:** RLS prevents cross-user data access
- ✅ **Compliance Works:** No PHI in database or Claude prompts
- ✅ **Performance Works:** Page loads in <3 seconds
- ✅ **UX Works:** Dashboard feels responsive and helpful

---

## 🚀 Next Steps After Testing

1. **If everything works:**
   - Continue testing with more test users
   - Monitor `claude_usage_logs` for costs (~$0.0001/request)
   - Collect feedback on UX/helpfulness

2. **If you find bugs:**
   - Document the issue with steps to reproduce
   - Check browser console for errors
   - Check Supabase logs for Edge Function errors
   - Report to development team

3. **Before production:**
   - ⚠️ Execute Anthropic BAA (see docs/COMPLIANCE_FIXES_COMPLETE.md)
   - Run full security audit
   - Test with 10+ users
   - Monitor performance under load

---

## 📞 Support

**Documentation:**
- [COMPLIANCE_FIXES_COMPLETE.md](./COMPLIANCE_FIXES_COMPLETE.md) - Compliance verification
- [COMPLIANCE_STATUS_CURRENT.md](./COMPLIANCE_STATUS_CURRENT.md) - Compliance assessment
- [HIPAA_COMPLIANCE_AI_DASHBOARD.md](./HIPAA_COMPLIANCE_AI_DASHBOARD.md) - HIPAA requirements

**Database Access:**
- Host: `aws-0-us-west-1.pooler.supabase.com`
- Port: `6543`
- Database: `postgres`
- User: `postgres.xkybsjnvuohpqpbkikyn`

**Edge Function Dashboard:**
- https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/functions

---

**Testing Phase:** Test-and-Break
**Data Status:** Test data only (no real PHI)
**Deployment Status:** ✅ Ready for testing
**Last Updated:** 2025-10-19
