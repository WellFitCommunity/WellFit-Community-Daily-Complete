# Telehealth Go-Live Checklist

**You're getting the Daily.co API key now - here's exactly what to do next!**

## Step 1: Add API Key to Supabase (2 minutes)

### Option A: Via Supabase Dashboard (Easiest)
```
1. Go to: https://supabase.com/dashboard
2. Select your WellFit project
3. Click "Project Settings" (bottom left)
4. Click "Edge Functions" tab
5. Scroll to "Secrets"
6. Click "Add new secret"
7. Name: DAILY_API_KEY
8. Value: [paste your Daily.co API key]
9. Click "Save"
```

### Option B: Via CLI (If you prefer terminal)
```bash
npx supabase secrets set DAILY_API_KEY=your_daily_api_key_here --project-ref xkybsjnvuohpqpbkikyn
```

### Verify It's Set
```bash
npx supabase secrets list --project-ref xkybsjnvuohpqpbkikyn
```

You should see:
```
✓ DAILY_API_KEY
✓ ANTHROPIC_API_KEY
✓ DEEPGRAM_API_KEY
✓ SUPABASE_URL
✓ SUPABASE_SERVICE_ROLE_KEY
```

---

## Step 2: Deploy Database Migration (1 minute)

```bash
PGPASSWORD="MyDaddyLovesMeToo1" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.xkybsjnvuohpqpbkikyn \
  -d postgres \
  -f supabase/migrations/20251020200000_create_telehealth_tables.sql
```

**Expected output:**
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
... (lots of CREATE statements)
COMMENT
```

### Verify Tables Created
```bash
PGPASSWORD="MyDaddyLovesMeToo1" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.xkybsjnvuohpqpbkikyn \
  -d postgres \
  -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'telehealth%';"
```

**Expected output:**
```
      table_name
------------------------
 telehealth_sessions
 telehealth_session_events
```

✅ **If you see both tables, you're good!**

---

## Step 3: Deploy Edge Functions (2 minutes)

### Deploy Room Creation Function
```bash
npx supabase functions deploy create-telehealth-room --project-ref xkybsjnvuohpqpbkikyn
```

**Expected output:**
```
Deploying function create-telehealth-room...
Function deployed successfully!
```

### Deploy Patient Token Function
```bash
npx supabase functions deploy create-patient-telehealth-token --project-ref xkybsjnvuohpqpbkikyn
```

**Expected output:**
```
Deploying function create-patient-telehealth-token...
Function deployed successfully!
```

### Verify Functions Are Deployed
```bash
npx supabase functions list --project-ref xkybsjnvuohpqpbkikyn
```

**Look for:**
```
✓ create-telehealth-room
✓ create-patient-telehealth-token
```

✅ **If you see both functions, you're ready!**

---

## Step 4: Test Telehealth (5 minutes)

### 4.1 Log in to WellFit
```
Go to your WellFit app
Log in as a physician
```

### 4.2 Navigate to Physician Panel
```
Click "Physician Panel" or go to /physician-panel
```

### 4.3 Select a Test Patient
```
In the Patient Selector (left side):
- Search for any patient
- Click on their name
- Patient summary loads on right
```

### 4.4 Launch Telehealth
```
Scroll to "Clinical Tools & Medical Records" section
You'll see THREE new telehealth buttons:
  📹 Telehealth Visit (blue/teal border)
  🚨 ER Telehealth (red border, pulsing)
  ⚡ Urgent Care Visit (orange border)

Click "Telehealth Visit" to test
```

### 4.5 Expected Behavior
```
1. Screen shows "Start Telehealth Visit"
2. Patient name displayed
3. Badge shows "Outpatient Visit"
4. Click "Start Video Call" button
5. System creates Daily.co room (takes 2-3 seconds)
6. Video interface loads
7. You should see your camera feed!
```

### 4.6 Test Controls
```
Once in the call:
✓ Click microphone button to mute/unmute
✓ Click video button to turn camera on/off
✓ Click transcription button to enable SmartScribe
✓ Click red phone button to end call
```

### 4.7 Test ER Telehealth (Bonus)
```
Select a patient
Click "🚨 ER Telehealth" button
Notice the red "ER TELEHEALTH" badge (pulsing)
Emergency visits skip waiting room!
```

---

## Step 5: Check Logs (Verify Everything Works)

### View Function Logs
```bash
# Check room creation logs
npx supabase functions logs create-telehealth-room --project-ref xkybsjnvuohpqpbkikyn

# You should see:
# "Creating Daily.co room for encounter..."
# "Room created successfully"
```

### Check Database Records
```bash
PGPASSWORD="MyDaddyLovesMeToo1" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.xkybsjnvuohpqpbkikyn \
  -d postgres \
  -c "SELECT * FROM telehealth_sessions ORDER BY created_at DESC LIMIT 5;"
```

**You should see your test session!**

---

## Troubleshooting

### Error: "Failed to create Daily.co room"

**Check 1: API Key is Set**
```bash
npx supabase secrets list --project-ref xkybsjnvuohpqpbkikyn | grep DAILY
```

**Check 2: API Key is Valid**
```bash
# Test Daily.co API directly
curl -X GET https://api.daily.co/v1/rooms \
  -H "Authorization: Bearer YOUR_DAILY_API_KEY"

# Should return JSON with rooms list (might be empty)
```

**Check 3: Function Logs**
```bash
npx supabase functions logs create-telehealth-room --project-ref xkybsjnvuohpqpbkikyn
```

Look for error messages like:
- "Missing DAILY_API_KEY" → API key not set
- "401 Unauthorized" → Invalid API key
- "403 Forbidden" → Need to upgrade to HIPAA plan

---

### Error: "Unauthorized access to this encounter"

**Solution:**
```
This happens if you're not logged in or patient doesn't belong to you.
1. Make sure you're logged in as a physician
2. Select a patient from the patient selector
3. Try again
```

---

### Error: "Cannot connect to video"

**Check 1: Browser Permissions**
```
Chrome: chrome://settings/content/camera
Make sure WellFit domain has camera/microphone access
```

**Check 2: Internet Connection**
```
Need at least 2 Mbps for video
Test at: https://fast.com
```

---

## Success Criteria

✅ **You're live when you can:**
1. Click "Telehealth Visit" button
2. See "Start Telehealth Visit" screen
3. Click "Start Video Call"
4. See video interface with your camera
5. Toggle mute/unmute
6. End call successfully
7. See session record in database

---

## What Happens Behind the Scenes

When you click "Telehealth Visit":

```
1. PhysicianPanel creates encounter record
   → Table: encounters
   → Fields: patient_id, provider_id, encounter_type, visit_mode='telehealth'

2. Calls create-telehealth-room function
   → Creates Daily.co room via API
   → Generates secure meeting token
   → Stores in telehealth_sessions table

3. Joins Daily.co room
   → Opens video interface
   → Enables audio/video
   → Ready for patient to join

4. During call:
   → Session events logged to telehealth_session_events
   → PHI access logged to phi_access_logs
   → SmartScribe transcribes if enabled

5. On call end:
   → Updates encounter status to 'completed'
   → Sets end_time
   → Closes Daily.co room
```

---

## Daily.co Dashboard

After your first test, check Daily.co dashboard:

```
Go to: https://dashboard.daily.co
Click "Rooms"
You should see: telehealth-[encounter-id]-[timestamp]
Status: "Room created"
```

This confirms everything is working!

---

## Next Steps After Testing

1. ✅ **Test all three visit types**:
   - Regular Telehealth Visit
   - ER Telehealth
   - Urgent Care Visit

2. ✅ **Test SmartScribe during call**:
   - Click transcription button
   - Speak some medical terms
   - Watch real-time transcript appear
   - See code suggestions populate

3. ✅ **Test on different devices**:
   - Desktop (Chrome/Edge)
   - Tablet
   - Different browsers

4. ✅ **Train your team**:
   - Show physicians the buttons
   - Walk through the workflow
   - Practice with each other

5. ⬜ **Order stethoscope** (in 2 weeks):
   - Eko CORE recommended
   - ~$200 on Amazon
   - Pairs via Bluetooth
   - Works immediately

6. ⬜ **Go live with patients**:
   - Send patient telehealth links
   - Start billing for visits
   - Track revenue optimization

---

## Patient Experience (Coming Soon)

For now, you can test provider-to-provider. Later you can add:

```
Patient portal with telehealth links:
https://your-domain.com/telehealth/join?session=SESSION_ID

Patient sees:
1. Waiting room
2. "Provider will join shortly"
3. Test audio/video
4. Provider joins → call starts
```

---

**🎉 Ready to Go Live!**

Once you have your Daily.co API key:
1. Add to Supabase secrets (2 min)
2. Deploy migration (1 min)
3. Deploy functions (2 min)
4. Test it (5 min)

**Total time: 10 minutes to telehealth! 🚀**
