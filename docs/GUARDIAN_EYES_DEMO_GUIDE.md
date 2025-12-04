# Guardian Eyes Demo Guide

## Overview

Guardian Eyes is a visual recording system that captures what happens when the Guardian Agent detects and fixes issues. It uses **rrweb** to record the actual screen activity during self-healing operations.

---

## How to Trigger a Recording for Demo

### Option 1: Browser Console (Easiest for Demo)

1. Open the WellFit app in Chrome/Edge
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Go to the **Console** tab
4. Paste and run:

```javascript
// Access the Guardian Eyes Recorder
const recorder = window.__guardianEyesRecorder;

// If not exposed, import it dynamically
if (!recorder) {
  console.log('Recorder not on window, using import...');
}

// Start a manual recording
(async () => {
  // Import the recorder
  const { guardianEyesRecorder } = await import('/src/services/guardian-agent/GuardianEyesRecorder.ts');

  // Start recording
  const sessionId = await guardianEyesRecorder.startRecording({
    triggerType: 'manual',
    triggerDescription: 'Demo recording for presentation - Guardian Eyes visual capture'
  });

  console.log('🎥 Recording started! Session ID:', sessionId);
  console.log('Navigate around the app, then run: window.stopGuardianDemo()');

  // Expose stop function
  window.stopGuardianDemo = async () => {
    const result = await guardianEyesRecorder.stopRecording('Demo complete');
    console.log('🎬 Recording saved!', result);
    return result;
  };
})();
```

5. Navigate around the app (click buttons, open panels, etc.)
6. When done, run in console:

```javascript
window.stopGuardianDemo()
```

---

### Option 2: Add a Demo Button (Temporary Component)

If you want a visible button for the demo, add this to any admin page temporarily:

```tsx
// Add this import at top of file
import { guardianEyesRecorder } from '../../services/guardian-agent/GuardianEyesRecorder';

// Add this component inside your page
const GuardianDemoButton = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleToggle = async () => {
    if (!isRecording) {
      const id = await guardianEyesRecorder.startRecording({
        triggerType: 'manual',
        triggerDescription: 'Demo recording for presentation'
      });
      setSessionId(id);
      setIsRecording(true);
    } else {
      await guardianEyesRecorder.stopRecording('Demo complete');
      setIsRecording(false);
      setSessionId(null);
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`px-4 py-2 rounded-lg font-bold ${
        isRecording
          ? 'bg-red-600 text-white animate-pulse'
          : 'bg-green-600 text-white'
      }`}
    >
      {isRecording ? '🔴 Stop Recording' : '🎥 Start Guardian Eyes Demo'}
    </button>
  );
};
```

---

### Option 3: Trigger Real Self-Healing (Best for Authentic Demo)

To trigger an actual Guardian Agent healing operation (which auto-records):

1. **Simulate a Security Issue**: Open console and run:

```javascript
// This will trigger Guardian Agent to detect and potentially heal
window.dispatchEvent(new ErrorEvent('error', {
  error: new Error('Potential XSS vulnerability detected in user input'),
  message: 'Security vulnerability detected'
}));
```

2. **Simulate an API Failure**:

```javascript
// Trigger a network error that Guardian will catch
fetch('/api/nonexistent-endpoint').catch(() => {
  console.log('API failure triggered - Guardian should detect');
});
```

3. **Check Guardian Status**:

```javascript
// See what Guardian Agent is doing
const agent = window.__guardianAgent;
if (agent) {
  console.log('Guardian State:', agent.getState());
  console.log('Guardian Health:', agent.getHealth());
  console.log('Guardian Stats:', agent.getStatistics());
}
```

---

## Where Recordings Are Stored

| Location | What's There |
|----------|--------------|
| **Supabase Storage** | `guardian-eyes-recordings` bucket - actual JSON recording files |
| **Database Table** | `guardian_eyes_sessions` - metadata about each recording |

---

## Viewing Recordings

### In the App

Navigate to the Security Panel and look for the Guardian Eyes section. Recordings can be viewed using the `GuardianEyesPlayer` component.

### Direct Database Query

```sql
-- See all recordings
SELECT
  session_id,
  trigger_type,
  trigger_description,
  duration_seconds,
  event_count,
  recording_started_at,
  retention_type,
  reviewed
FROM guardian_eyes_sessions
ORDER BY recording_started_at DESC
LIMIT 10;
```

### Get Recording Status

```javascript
// In browser console
const { guardianEyesRecorder } = await import('/src/services/guardian-agent/GuardianEyesRecorder.ts');
console.log('Recording Status:', guardianEyesRecorder.getStatus());
```

---

## Recording Trigger Types

| Type | When It's Used |
|------|----------------|
| `security_vulnerability` | XSS, SQL injection, insecure storage detected |
| `phi_exposure` | PHI/HIPAA violation detected |
| `memory_leak` | Memory leak or runaway subscription detected |
| `api_failure` | API endpoint failure requiring intervention |
| `healing_operation` | General self-healing operation |
| `system_health` | System health check triggered healing |
| `manual` | Manually triggered (for demos) |

---

## Quick Demo Script

### 1. Start Recording
```javascript
// Run in browser console
const { guardianEyesRecorder } = await import('/src/services/guardian-agent/GuardianEyesRecorder.ts');
await guardianEyesRecorder.startRecording({
  triggerType: 'manual',
  triggerDescription: 'Live demo - Guardian Eyes visual capture system'
});
console.log('🎥 RECORDING - navigate around the app now');
```

### 2. Do Some Actions
- Click around the dashboard
- Open some panels
- Maybe trigger an error

### 3. Stop Recording
```javascript
const result = await guardianEyesRecorder.stopRecording('Demo finished');
console.log('🎬 Saved!', result);
```

### 4. Show the Recording
- Go to Security Panel
- Find the recording in Guardian Eyes section
- Play it back with the `GuardianEyesPlayer`

---

## Retention Options

| Option | Duration | How to Set |
|--------|----------|------------|
| Standard | 10 days | Default |
| Extended | 30 days | Click "Save for 30 Days" in UI |
| Permanent | Forever | Click "Save Forever" in UI |

---

## Troubleshooting

### Recording won't start
- Check browser console for errors
- Ensure rrweb is loaded: `console.log(typeof rrweb)`
- Check if already recording: `guardianEyesRecorder.getStatus()`

### Recording won't save
- Check Supabase connection
- Ensure `guardian-eyes-recordings` bucket exists
- Check RLS policies allow insert

### Can't find recordings
- Check `guardian_eyes_sessions` table in Supabase
- Verify `storage_path` column has valid paths
- Check bucket for actual files

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/services/guardian-agent/GuardianEyesRecorder.ts` | Main recorder class |
| `src/components/security/GuardianEyesPlayer.tsx` | Playback component |
| `src/services/guardian-agent/AgentBrain.ts` | Calls recorder during healing |
| `supabase/migrations/20251204210000_guardian_eyes_storage.sql` | Database setup |

---

*Last Updated: December 4, 2025*
