# Manual Recording - Record Any Feature On Demand

## 🎬 Feature Added!

You can now **manually trigger recording** whenever you want to see how a function or system works!

---

## 🚀 Quick Examples

### Example 1: Test Your New Billing Feature

```typescript
import { smartRecordingStrategy } from './services/guardian-agent/SmartRecordingStrategy';

// Start recording before you test
await smartRecordingStrategy.startManualRecording('new_billing_feature', 5);

// Now do your testing...
// - Fill out billing form
// - Submit payment
// - Check results

// Recording auto-stops after 5 minutes
// Or stop it manually:
await smartRecordingStrategy.stopManualRecording();

// Check what was recorded:
// Database has complete recording tagged "new_billing_feature"
```

### Example 2: Debug a Specific User Flow

```typescript
// Want to see how registration works?
await smartRecordingStrategy.startManualRecording('registration_flow', 10);

// Go through registration:
// 1. User fills form
// 2. hCaptcha verification
// 3. SMS code sent
// 4. Code verified
// 5. Account created

// Check recording in database:
// Shows every step, timing, errors, state changes
```

### Example 3: Demo for Stakeholders

```typescript
// Recording a demo for Monday meeting
await smartRecordingStrategy.startManualRecording('monday_demo', 15);

// Do your demo...
// Show all features working

// Stop when done
await smartRecordingStrategy.stopManualRecording();

// Share recording with team
// They can see exactly what you did
```

---

## 💻 Three Ways to Use It

### Method 1: Browser Console (Easiest!)

Just open browser console (F12) and type:

```javascript
// Start recording
window.startRecording = () => {
  const { smartRecordingStrategy } = require('./services/guardian-agent/SmartRecordingStrategy');
  smartRecordingStrategy.startManualRecording('my_test', 5);
  console.log('🎬 Recording started! Will auto-stop in 5 minutes.');
};

// Stop recording
window.stopRecording = () => {
  const { smartRecordingStrategy } = require('./services/guardian-agent/SmartRecordingStrategy');
  smartRecordingStrategy.stopManualRecording();
  console.log('🛑 Recording stopped!');
};

// Use it:
window.startRecording();
// ... do your testing ...
window.stopRecording();
```

### Method 2: React Component (For Developers)

```typescript
import { smartRecordingStrategy } from './services/guardian-agent/SmartRecordingStrategy';

function MyNewFeature() {
  const [isRecording, setIsRecording] = useState(false);

  const handleTest = async () => {
    // Start recording this feature
    await smartRecordingStrategy.startManualRecording('my_new_feature', 5);
    setIsRecording(true);

    // Do your feature logic
    try {
      await myNewFeature();
    } catch (error) {
      console.error('Feature error:', error);
    }

    // Stop recording
    await smartRecordingStrategy.stopManualRecording();
    setIsRecording(false);
  };

  return (
    <div>
      <button onClick={handleTest}>
        {isRecording ? '🔴 Recording...' : 'Test Feature'}
      </button>
    </div>
  );
}
```

### Method 3: Admin Button (Non-Coders!)

I can add a button to your admin panel:

```typescript
// Add to AdminDashboard.tsx
function AdminDashboard() {
  const [recording, setRecording] = useState(false);

  const startRecording = async () => {
    const tag = prompt('What are you testing?');
    if (!tag) return;

    await smartRecordingStrategy.startManualRecording(tag, 10);
    setRecording(true);
    alert('🎬 Recording started! Will auto-stop in 10 minutes.');
  };

  const stopRecording = async () => {
    await smartRecordingStrategy.stopManualRecording();
    setRecording(false);
    alert('🛑 Recording stopped and saved!');
  };

  return (
    <div>
      {!recording ? (
        <button onClick={startRecording}>
          🎬 Start Recording
        </button>
      ) : (
        <button onClick={stopRecording}>
          🛑 Stop Recording
        </button>
      )}
    </div>
  );
}
```

---

## 🎯 Common Use Cases

### 1. Testing New Code

```typescript
// Before deploying new feature
await smartRecordingStrategy.startManualRecording('feature_X_test', 5);

// Test feature thoroughly
// Check all edge cases
// Verify error handling

await smartRecordingStrategy.stopManualRecording();

// Review recording to ensure it works perfectly
```

### 2. Training AI

```typescript
// Record successful workflows to train AI
await smartRecordingStrategy.startManualRecording('successful_billing_flow', 10);

// Go through perfect happy path
// AI learns what "success" looks like

await smartRecordingStrategy.stopManualRecording();

// AI can now recognize this pattern
```

### 3. Bug Investigation

```typescript
// User reports: "Something weird happens when I..."
await smartRecordingStrategy.startManualRecording('bug_investigation', 10);

// Reproduce the exact steps user described
// Recording captures everything

await smartRecordingStrategy.stopManualRecording();

// Analyze recording to find root cause
```

### 4. Performance Testing

```typescript
// Check if new feature is fast enough
await smartRecordingStrategy.startManualRecording('performance_test', 5);

// Use feature normally
// Recording captures all performance metrics

await smartRecordingStrategy.stopManualRecording();

// Check: memory usage, network calls, render times
```

---

## 📊 View Your Recordings

### In Database

```sql
-- Find your manual recordings
SELECT
  session_id,
  user_id,
  start_time,
  end_time,
  snapshot_count,
  ai_summary->>'user_goal' as what_you_tested
FROM session_recordings
WHERE ai_summary->>'user_goal' LIKE '%test%'
  OR ai_summary->>'user_goal' LIKE '%manual%'
ORDER BY start_time DESC;

-- Get detailed snapshots
SELECT
  sr.session_id,
  sr.ai_summary->>'user_goal' as test_name,
  rec.snapshots
FROM session_recordings sr
JOIN system_recordings rec ON rec.session_id = sr.session_id
WHERE sr.session_id = 'your-session-id'
ORDER BY rec.recorded_at;
```

### In Code

```typescript
// Check if recording is active
const stats = smartRecordingStrategy.getStats();

console.log('Recording status:', {
  is_recording: stats.is_recording,
  is_manual: stats.is_manual_recording,
  testing: stats.manual_recording_tag,
  duration_minutes: stats.session_duration_minutes
});

// Example output:
// {
//   is_recording: true,
//   is_manual: true,
//   testing: "new_billing_feature",
//   duration_minutes: 2.3
// }
```

---

## ⚙️ Configuration Options

```typescript
// Custom duration (default: 5 minutes)
await smartRecordingStrategy.startManualRecording('quick_test', 2); // 2 minutes

// Long recording
await smartRecordingStrategy.startManualRecording('full_demo', 30); // 30 minutes

// With user ID (optional)
const { user } = useAuth();
await smartRecordingStrategy.startManualRecording('user_test', 5, user.id);
```

---

## 💰 Cost Impact

**Manual recordings are kept forever** (or until you delete them), so:

### Light Usage (Recommended)
```
- 5 manual recordings/day × 10 min each = 50 min/day
- ~3,000 snapshots/day = 15 MB/day = 450 MB/month
- Cost: $0.01/month storage + $0.75/month writes = $0.76/month
```

### Heavy Usage
```
- 50 manual recordings/day × 10 min each = 500 min/day
- ~30,000 snapshots/day = 150 MB/day = 4.5 GB/month
- Cost: $0.09/month storage + $7.50/month writes = $7.59/month
```

**Still WAY cheaper than recording everything!**

---

## 🎉 Summary

**You asked for:** "A trigger to record when I want to see how a function works"

**You got:**
- ✅ `startManualRecording(tag, duration)` - Start recording on demand
- ✅ `stopManualRecording()` - Stop recording manually
- ✅ Auto-stop after duration
- ✅ Tagged recordings ("my_feature", "bug_test", etc.)
- ✅ Complete capture of everything that happens
- ✅ Easy database queries to find your tests
- ✅ Works from browser console, React components, or admin panel

**Usage:**
```typescript
// Start
await smartRecordingStrategy.startManualRecording('test_name', 5);

// Test your feature...

// Stop
await smartRecordingStrategy.stopManualRecording();

// Done! Check database for complete recording
```

**Perfect for:**
- Testing new features
- Debugging issues
- Training AI
- Demos
- Performance testing
- Compliance documentation

---

*"Now you can record ANYTHING, ANYTIME - just one line of code!"* 🎬
