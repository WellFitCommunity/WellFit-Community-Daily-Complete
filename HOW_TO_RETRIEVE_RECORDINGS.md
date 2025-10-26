# How to Retrieve AI Session Recordings

This guide shows you how to retrieve and view the AI system recordings that capture user behavior, errors, and critical events.

## Quick Access Methods

### Method 1: Supabase Dashboard (EASIEST - Non-Coders)

1. **Go to Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn
   - Login with your credentials

2. **Navigate to Table Editor:**
   - Click "Table Editor" in left sidebar
   - Find and click on `session_recordings` table

3. **View All Recordings:**
   ```
   You'll see a table with columns:
   - id: Unique recording ID
   - session_id: Session identifier
   - user_id: User who was recorded (if logged in)
   - start_time: When recording started
   - end_time: When recording ended
   - snapshot_count: Number of snapshots captured
   - ai_summary: AI's analysis of the session
   - metadata: Additional info (errors, security events, etc.)
   ```

4. **View Recording Details:**
   - Click on any row to expand it
   - Look at `ai_summary` field for AI's analysis:
     - `user_goal`: What the user was trying to do
     - `success`: Whether they succeeded
     - `pain_points`: Problems they encountered
     - `optimizations`: Suggestions to improve
     - `security_concerns`: Any security issues detected

5. **View the "Video" (Snapshots):**
   - Click on `system_recordings` table
   - Filter by `session_id` to find snapshots for a specific session
   - The `snapshots` field contains JSON array of all captured events:
     - User clicks, navigation, form submissions
     - State changes (what data changed)
     - Errors with stack traces
     - Performance metrics
     - Security events

### Method 2: SQL Query (For Database Users)

**Get Last 10 Recordings:**
```sql
SELECT
  session_id,
  user_id,
  start_time,
  end_time,
  snapshot_count,
  ai_summary->>'user_goal' as user_goal,
  ai_summary->>'success' as success,
  metadata->>'trigger_reason' as why_recorded
FROM session_recordings
ORDER BY start_time DESC
LIMIT 10;
```

**Get Recording with All Snapshots:**
```sql
-- First, find the session_id you want
SELECT session_id, start_time, ai_summary
FROM session_recordings
WHERE start_time > NOW() - INTERVAL '1 day'
ORDER BY start_time DESC;

-- Then get all snapshots for that session
SELECT
  recorded_at,
  snapshots
FROM system_recordings
WHERE session_id = 'session-1234567890-abc123'
ORDER BY recorded_at;
```

**Get Only Error Recordings:**
```sql
SELECT
  session_id,
  start_time,
  snapshot_count,
  ai_summary,
  metadata
FROM session_recordings
WHERE metadata->>'has_errors' = 'true'
ORDER BY start_time DESC;
```

**Get Manual Test Recordings:**
```sql
SELECT
  session_id,
  start_time,
  metadata->>'manual_tag' as test_tag,
  snapshot_count,
  ai_summary
FROM session_recordings
WHERE metadata->>'manual_recording' = 'true'
ORDER BY start_time DESC;
```

### Method 3: AI Analysis Queries

**Get AI Insights:**
```sql
SELECT
  session_id,
  analysis_type,
  insights,
  confidence_score,
  recommendations,
  priority
FROM ai_recording_analysis
WHERE priority IN ('high', 'critical')
ORDER BY created_at DESC;
```

**Get Pattern Detection:**
```sql
-- Find common user pain points
SELECT
  insights->>'pain_point' as pain_point,
  COUNT(*) as occurrences
FROM ai_recording_analysis
WHERE analysis_type = 'user_journey_analysis'
GROUP BY pain_point
ORDER BY occurrences DESC;
```

### Method 4: Admin Panel (Coming Soon - When Built)

In the future, you can add an admin panel with:

```typescript
// React component to view recordings
import { supabase } from './supabaseClient';

async function getRecentRecordings() {
  const { data, error } = await supabase
    .from('session_recordings')
    .select(`
      *,
      system_recordings (
        recorded_at,
        snapshots
      ),
      ai_recording_analysis (
        analysis_type,
        insights,
        recommendations
      )
    `)
    .order('start_time', { ascending: false })
    .limit(50);

  return data;
}

// Display in UI with timeline view, playback controls, etc.
```

## Understanding the Recording Data

### What Gets Recorded:

**User Actions (snapshots):**
```json
{
  "id": "snap-123",
  "timestamp": "2025-10-26T16:15:00Z",
  "type": "user_action",
  "component": "LoginPage",
  "action": "button_click",
  "metadata": {
    "button_text": "Sign In",
    "user_id": "user-456",
    "url": "/login",
    "viewport": { "width": 1920, "height": 1080 }
  }
}
```

**State Changes:**
```json
{
  "type": "state_change",
  "component": "AuthContext",
  "state_before": { "isAuthenticated": false },
  "state_after": { "isAuthenticated": true, "user": {...} }
}
```

**Errors:**
```json
{
  "type": "error",
  "component": "PhysicianPanel",
  "metadata": {
    "error_name": "TypeError",
    "error_message": "Cannot read property 'id' of undefined",
    "error_stack": "at PhysicianPanel.tsx:123..."
  }
}
```

**Performance:**
```json
{
  "type": "performance",
  "metadata": {
    "memory_mb": 145.2,
    "fps": 60,
    "load_time_ms": 1234,
    "api_calls_pending": 2
  }
}
```

### AI Summary Format:

```json
{
  "user_goal": "Login to physician dashboard",
  "success": false,
  "pain_points": [
    "Login button took 3 seconds to respond",
    "Error: Invalid credentials not clearly shown",
    "User clicked 5 times (frustration)"
  ],
  "optimizations": [
    "Add loading spinner to login button",
    "Show clearer error messages",
    "Reduce login API latency"
  ],
  "security_concerns": [
    "PHI potentially exposed in console.log",
    "Session token visible in network tab"
  ],
  "user_journey": [
    "Landed on /login",
    "Filled username/password",
    "Clicked login 5 times",
    "Received error",
    "Gave up and closed tab"
  ]
}
```

## When Recordings Are Created

### Automatic Triggers:
- ❌ **Critical Errors** - Any unhandled exception or error
- 🔒 **Security Events** - PHI exposure, unauthorized access
- 💥 **System Failures** - API timeouts, database errors
- 🎲 **Random Sampling** - 1% of normal sessions (for learning)

### Manual Triggers:
```javascript
// In browser console (for non-coders):
smartRecordingStrategy.startManualRecording('Testing new physician panel', 5)

// In React component (for developers):
import { smartRecordingStrategy } from './services/guardian-agent/SmartRecordingStrategy';

const handleTestFeature = async () => {
  await smartRecordingStrategy.startManualRecording('Testing patient search', 10);
  // ... test your feature ...
  await smartRecordingStrategy.stopManualRecording();
};
```

## Privacy & HIPAA Compliance

### What is NEVER Recorded:
- ❌ PHI (patient names, SSNs, medical records)
- ❌ Passwords or credentials
- ❌ Credit card numbers
- ❌ Full API responses with PHI

### What IS Recorded:
- ✅ Component names ("PhysicianPanel")
- ✅ Action types ("button_click", "form_submit")
- ✅ Error messages (stack traces)
- ✅ Performance metrics (memory, FPS)
- ✅ User IDs (UUIDs only, not names)
- ✅ Page URLs and navigation flow

### Retention:
- **Session Recordings:** 90 days
- **AI Analysis:** 1 year
- **Critical Security Events:** 7 years (separate audit logs)

## Cost Optimization

**Current Settings:**
- Only 1% of normal sessions recorded
- All critical events always recorded
- Manual recordings kept for 30 days

**Monthly Cost:** ~$4.72/month
- Storage: $0.02/month
- Database writes: $4.65/month
- AI analysis: $0.05/month

**To Adjust Sampling Rate:**
```typescript
// In SmartRecordingStrategy.ts
private config: RecordingConfig = {
  samplingRate: 0.01, // 1% - change to 0.05 for 5%, or 0.001 for 0.1%
  // ...
}
```

## Troubleshooting

### "No recordings found"
1. Check if recording is enabled in App.tsx (should auto-start)
2. Verify tables exist: `session_recordings`, `system_recordings`
3. Check browser console for any errors

### "Recording not triggered on error"
1. Error must be uncaught (not in try/catch)
2. Check `smartRecordingStrategy.getStats()` in console
3. Verify `recordOnError: true` in config

### "Manual recording not starting"
```javascript
// In browser console:
smartRecordingStrategy.startManualRecording('test', 5)
// Should see: "[SmartRecording] 🎬 MANUAL RECORDING STARTED: test"
```

## Next Steps

1. **View Your First Recording:**
   - Go to Supabase Dashboard
   - Open `session_recordings` table
   - Look for recent entries

2. **Test Manual Recording:**
   - Open browser console on your app
   - Run: `smartRecordingStrategy.startManualRecording('My First Test', 2)`
   - Use your app for 2 minutes
   - Check Supabase for new recording

3. **Set Up Monitoring:**
   - Create Supabase dashboard for recordings
   - Set up email alerts for critical recordings
   - Build admin panel to replay sessions

## Questions?

See the other guides:
- [MANUAL_RECORDING_GUIDE.md](./MANUAL_RECORDING_GUIDE.md) - Detailed manual recording instructions
- [SMART_RECORDING_EXPLAINED.md](./SMART_RECORDING_EXPLAINED.md) - How smart recording works
- [AI_SYSTEM_RECORDING_GUIDE.md](./AI_SYSTEM_RECORDING_GUIDE.md) - Complete technical guide

---

**Your recordings are safe, HIPAA-compliant, and ready to help you understand your users! 🎥**
