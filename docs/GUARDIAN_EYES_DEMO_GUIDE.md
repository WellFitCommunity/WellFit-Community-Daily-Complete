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

## Guardian Agent Sandbox Systems

The Guardian Agent has **two sandbox systems** for enterprise-grade safety:

### 1. Safety Constraints Sandbox (Pre-Execution Validation)

Tests fixes BEFORE they're applied. Located in `SafetyConstraints.ts`.

#### Protected Resources (NEVER Auto-Modified)

| Category | Protected Paths |
|----------|-----------------|
| **Core Libraries** | `node_modules/`, `package.json`, `package-lock.json`, `tsconfig.json`, `src/contexts/`, `src/services/supabase`, `src/services/auth` |
| **Shared Libraries** | `src/utils/`, `src/lib/`, `src/hooks/`, `src/types/` |
| **Infrastructure** | `supabase/migrations/`, `.env`, `.env.production`, `Dockerfile`, `docker-compose.yml` |
| **Security-Critical** | `src/services/guardian-agent/` (can't modify itself!), `src/components/auth/`, `src/middleware/` |

#### Allowed Autonomous Actions

These can run without human approval:
- `retry_with_backoff` - Retry failed API calls with exponential backoff
- `circuit_breaker` - Stop calling failing services temporarily
- `fallback_to_cache` - Use cached data when live data unavailable
- `graceful_degradation` - Reduce functionality instead of crashing
- `state_rollback` - Revert to previous known-good state
- `resource_cleanup` - Clean up memory leaks, orphaned subscriptions
- `session_recovery` - Recover expired/broken sessions
- `dependency_isolation` - Isolate failing dependencies

#### Actions Requiring Human Approval

These ALWAYS need SOC staff approval:
- `auto_patch` - Any code changes
- `configuration_reset` - Config file changes
- `data_reconciliation` - Data modifications
- `security_lockdown` - Security-related actions
- `emergency_shutdown` - Critical system actions

#### Safety Validation Rules

| Rule | What It Blocks |
|------|----------------|
| No file system writes | `write_file`, `modify_file` actions |
| No production deploys | `deploy`, `publish` actions |
| No AI code generation | `generate_code`, `ai_fix` without approval |
| No schema changes | `alter_table`, `drop_table` actions |

#### Rate Limiter

Prevents "action storms":
- Max 3 of same action type per 60 seconds
- Cooldown period enforced between same action types
- Prevents runaway healing loops

---

### 2. Execution Sandbox (Runtime Isolation)

Enforces security during tool execution. Located in `ExecutionSandbox.ts`.

#### Per-Tool Security Policies

Each tool has its own allow-list:

| Tool | Allowed Domains | Max Time | Max Concurrent |
|------|-----------------|----------|----------------|
| `guardian.retry-api` | (inherits from original call) | 30s | 10 |
| `guardian.circuit-breaker` | (none - no network) | 5s | 1 |
| `guardian.cache-fallback` | (none - no network) | 10s | 20 |
| `guardian.state-rollback` | (none - no network) | 15s | 5 |
| `guardian.resource-cleanup` | (none - no network) | 20s | 3 |
| `guardian.session-recovery` | `api.wellfit.community` only | 10s | 10 |
| `fhir.read-observation` | `fhir.wellfit.community` only | 15s | 20 |
| `ehr.write-note` | `ehr.wellfit.community` only | 20s | 10 |

#### Network Isolation

- Overrides browser's `fetch()` function
- Blocks ANY network call not in the tool's allow-list
- Logs all allowed and denied network access
- Wildcard support (e.g., `*.wellfit.community`)

#### Database Isolation

- Each tool declares which tables it can access
- Access to unauthorized tables is blocked
- All access attempts are logged

#### File System Isolation

- Each tool declares allowed paths
- Access outside allowed paths is blocked
- Prevents tools from reading sensitive files

#### Access Logging

Every resource access is logged:
```typescript
{
  timestamp: Date,
  toolId: string,
  resourceType: 'network' | 'database' | 'filesystem',
  resource: string,
  allowed: boolean,
  reason?: string
}
```

Query denied access for security monitoring:
```javascript
// In browser console
const sandbox = window.__guardianSandbox;
if (sandbox) {
  console.log('Denied Access:', sandbox.getDeniedAccess());
}
```

---

### How the Sandboxes Work Together

```
┌─────────────────────────────────────────────────────────────────┐
│                    ISSUE DETECTED                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: SAFETY CONSTRAINTS (Pre-check)                         │
│  ────────────────────────────────────────                       │
│  ✓ Is action in allowed list?                                   │
│  ✓ Does it touch protected files?                               │
│  ✓ Is it rate-limited?                                          │
│  ✓ Does it need human approval?                                 │
│                                                                  │
│  If FAILS → Block action, store for human review                │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (if passes)
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: SANDBOX TEST (Dry run)                                 │
│  ────────────────────────────────                               │
│  ✓ Simulate all steps in isolation                              │
│  ✓ Check each step for policy violations                        │
│  ✓ Log what WOULD happen (side effects)                         │
│                                                                  │
│  If FAILS → Block action, log errors                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (if passes)
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: GUARDIAN EYES STARTS RECORDING                         │
│  ───────────────────────────────────────                        │
│  🎥 rrweb begins capturing screen activity                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: EXECUTION SANDBOX (Runtime)                            │
│  ────────────────────────────────────                           │
│  ✓ Enforce domain allow-lists (network isolation)               │
│  ✓ Block unauthorized network calls                             │
│  ✓ Enforce execution timeouts                                   │
│  ✓ Enforce concurrency limits                                   │
│  ✓ Log all resource access                                      │
│                                                                  │
│  If TIMEOUT → Abort action, rollback                            │
│  If BLOCKED → Log violation, continue if possible               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: GUARDIAN EYES STOPS RECORDING                          │
│  ────────────────────────────────────                           │
│  🎬 Recording saved to Supabase Storage                         │
│  📋 Metadata saved to guardian_eyes_sessions                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: AUDIT LOG & ALERT                                      │
│  ─────────────────────────────                                  │
│  📝 Full audit trail created                                    │
│  🚨 Alert sent to Security Panel                                │
│  👀 SOC staff can review recording                              │
└─────────────────────────────────────────────────────────────────┘
```

---

### Action Constraints (Runtime Limits)

| Constraint | Value |
|------------|-------|
| Max execution time | 30 seconds |
| Max retries | 3 |
| Max concurrent healings | 5 |
| Action cooldown | 60 seconds |
| Max memory usage | 85% |
| Max affected resources | 10 |

---

### Key Sandbox Files

| File | Purpose |
|------|---------|
| `src/services/guardian-agent/SafetyConstraints.ts` | Pre-execution validation, protected resources, rate limiting |
| `src/services/guardian-agent/ExecutionSandbox.ts` | Runtime isolation, allow-lists, network/DB/file access control |
| `src/services/guardian-agent/AgentBrain.ts` | Orchestrates safety checks before healing |
| `src/services/guardian-agent/SAFETY_AND_COMPLIANCE.md` | Full safety documentation |
| `src/services/guardian-agent/SECURITY_ARCHITECTURE.md` | Security architecture details |

---

### FAQ for Presentation

**Q: Can the Guardian Agent modify its own code?**
> No. `src/services/guardian-agent/` is in the protected resources list. The agent cannot modify itself.

**Q: Can it access production databases directly?**
> Only through approved tools with table allow-lists. Each tool declares which tables it can access.

**Q: What if it tries to call an unauthorized API?**
> The Execution Sandbox overrides `fetch()` and blocks any domain not in the tool's allow-list. The attempt is logged.

**Q: Can it run forever?**
> No. Max execution time is 30 seconds. Actions that exceed this are automatically aborted.

**Q: What if it tries to do the same thing over and over?**
> Rate limiter blocks more than 3 of the same action type per minute.

**Q: Can it deploy code to production?**
> No. `deploy` and `publish` actions are blocked at the safety validation step.

**Q: Who reviews the recordings?**
> SOC staff (Security Operations Center) can view recordings in the Security Panel and approve/reject fixes.

**Q: How long are recordings kept?**
> 10 days by default. Can be extended to 30 days or permanent for important issues.

---

*Last Updated: December 4, 2025*
