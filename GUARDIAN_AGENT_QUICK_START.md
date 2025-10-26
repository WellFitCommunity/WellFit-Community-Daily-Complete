# Guardian Agent - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Import Guardian Agent (30 seconds)

```typescript
// In your main app initialization file (e.g., src/App.tsx or src/index.tsx)
import { AgentBrain } from './services/guardian-agent/AgentBrain';
import { realtimeSecurityMonitor } from './services/guardian-agent/RealtimeSecurityMonitor';
import { securityAlertNotifier } from './services/guardian-agent/SecurityAlertNotifier';

// Create guardian instance
const guardianAgent = new AgentBrain({
  autoHealEnabled: true,
  learningEnabled: true,
  requireApprovalForCritical: true,
  maxConcurrentHealings: 3,
});

// Export for use throughout app
export { guardianAgent };
```

### Step 2: Start Monitoring (30 seconds)

```typescript
// In your app startup (useEffect or similar)
useEffect(() => {
  // Start real-time security monitoring
  realtimeSecurityMonitor.startMonitoring();

  // Register alert callback
  realtimeSecurityMonitor.onAlert(async (alert) => {
    if (alert.severity === 'critical' || alert.severity === 'high') {
      await securityAlertNotifier.notify({
        alertId: alert.id,
        severity: alert.severity,
        title: alert.title,
        description: alert.description || '',
        timestamp: alert.created_at,
        channels: ['email'], // Sends to info@thewellfitcommunity.org
      });
    }
  });

  return () => {
    realtimeSecurityMonitor.stopMonitoring();
  };
}, []);
```

### Step 3: Use in Error Handlers (1 minute)

```typescript
// Wrap your error handlers with Guardian Agent
try {
  // Your code here
  const result = await riskyOperation();
} catch (error) {
  // Let Guardian Agent analyze and potentially heal
  await guardianAgent.analyze(error, {
    component: 'MyComponent',
    filePath: 'src/components/MyComponent.tsx',
    userId: currentUser?.id,
    sessionId: session?.id,
    timestamp: new Date(),
  });

  // Still show error to user if needed
  toast.error('Operation failed');
}
```

### Step 4: Monitor Dashboard (Optional, 2 minutes)

```typescript
// Create a security dashboard component
function SecurityDashboard() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({});

  useEffect(() => {
    // Get critical alerts
    realtimeSecurityMonitor.getCriticalAlerts(10)
      .then(setAlerts);

    // Get 24-hour statistics
    realtimeSecurityMonitor.getEventStatistics(24)
      .then(setStats);
  }, []);

  return (
    <div>
      <h2>Security Alerts</h2>
      <p>Total Events (24h): {stats.total}</p>
      <p>Critical Alerts: {alerts.length}</p>

      {alerts.map(alert => (
        <div key={alert.id} className={`alert-${alert.severity}`}>
          <h3>{alert.title}</h3>
          <p>{alert.description}</p>
          <span>{alert.created_at}</span>
        </div>
      ))}
    </div>
  );
}
```

---

## 📋 That's It!

Guardian Agent is now:
- ✅ Monitoring for security threats
- ✅ Auto-healing vulnerabilities
- ✅ Logging everything to database
- ✅ Sending email alerts
- ✅ Ready for production

---

## 🔍 Verify It's Working

### Check Database

```sql
-- View recent security events
SELECT * FROM security_events
ORDER BY timestamp DESC
LIMIT 10;

-- View active alerts
SELECT * FROM security_alerts
WHERE status IN ('new', 'investigating')
ORDER BY created_at DESC;

-- View audit trail
SELECT * FROM audit_logs
WHERE resource_type = 'guardian_agent_action'
ORDER BY timestamp DESC
LIMIT 10;
```

### Check Console

Look for these log messages:
```
[RealtimeSecurityMonitor] ✅ Subscribed to security_alerts
[RealtimeSecurityMonitor] ✅ Subscribed to security_events
[RealtimeSecurityMonitor] 🚀 Real-time monitoring started
[SecurityAlertNotifier] Initialized channels: { email: true, ... }
```

---

## 🧪 Test It

```typescript
// Create a test security alert
const testIssue = {
  id: 'test-' + Date.now(),
  timestamp: new Date(),
  signature: {
    id: 'test-sig',
    category: 'security_vulnerability',
    severity: 'high',
    description: 'Test vulnerability',
    healingStrategies: ['test_strategy'],
  },
  severity: 'high',
  affectedResources: ['TestComponent'],
  context: {
    component: 'TestComponent',
    timestamp: new Date(),
  },
};

const testAction = {
  id: 'action-test-' + Date.now(),
  issueId: testIssue.id,
  strategy: 'test_strategy',
  timestamp: new Date(),
  description: 'Test healing action',
  steps: [],
  expectedOutcome: 'Test passes',
  rollbackPlan: [],
  requiresApproval: false,
};

const testResult = {
  success: true,
  issueId: testIssue.id,
  actionId: testAction.id,
  stepsCompleted: 1,
  totalSteps: 1,
  outcomeDescription: 'Test passed',
  metrics: {
    timeToDetect: 10,
    timeToHeal: 50,
    resourcesAffected: 1,
    usersImpacted: 0,
  },
  lessons: ['Testing works'],
  preventiveMeasures: [],
};

// Log test action
await guardianAgent.auditLogger.logHealingAction(testIssue, testAction, testResult);

console.log('✅ Test complete! Check database for logged action.');
```

---

## 📧 Email Notifications

Email alerts automatically go to:
- **`info@thewellfitcommunity.org`** (default)

To add more recipients:
```bash
# Add to .env file
SECURITY_ALERT_EMAILS=info@thewellfitcommunity.org,admin@example.com,security@example.com
```

---

## 🎯 Common Use Cases

### 1. Catch PHI in Console Logs

```typescript
// BEFORE (vulnerable)
console.log('Patient data:', patientData);

// Guardian Agent automatically detects and fixes this!
// No code changes needed - it runs automatically
```

### 2. Fix Memory Leaks

```typescript
// Guardian Agent detects:
// - Event listeners not cleaned up
// - Intervals not cleared
// - Subscriptions not unsubscribed

// And adds cleanup code automatically!
```

### 3. Prevent SQL Injection

```typescript
// Guardian Agent detects:
const query = `SELECT * FROM users WHERE id = ${userId}`;

// And suggests parameterized queries instead
```

### 4. Monitor API Failures

```typescript
// Guardian Agent tracks API failures
// And implements circuit breakers automatically
// Preventing cascading failures
```

---

## 🆘 Troubleshooting

### Not Seeing Events?

1. Check Supabase connection:
```typescript
import { supabase } from './lib/supabaseClient';
const { data } = await supabase.from('security_events').select('count');
console.log('Database connected:', !!data);
```

2. Check monitoring status:
```typescript
const status = realtimeSecurityMonitor.getStatus();
console.log('Monitoring active:', status.isMonitoring);
```

3. Check enabled channels:
```typescript
const channels = securityAlertNotifier.getEnabledChannels();
console.log('Enabled notification channels:', channels);
```

### Not Getting Emails?

1. Verify email configuration:
```bash
# Check .env has proper email
SECURITY_ALERT_EMAILS=info@thewellfitcommunity.org
```

2. Test email notification:
```typescript
const result = await securityAlertNotifier.testNotification('email');
console.log('Email test:', result);
```

3. Check database for notification attempts:
```sql
SELECT * FROM security_alerts
WHERE notification_sent = true
ORDER BY created_at DESC;
```

---

## 📚 More Documentation

- **Full Production Guide:** `GUARDIAN_AGENT_PRODUCTION_READY.md`
- **Implementation Summary:** `GUARDIAN_AGENT_IMPLEMENTATION_SUMMARY.md`
- **PHI Detection Demo:** `GUARDIAN_AGENT_DEMO_EXAMPLE.md`

---

## 🎉 You're Done!

Guardian Agent is now protecting your application 24/7 with:
- ✅ Real-time threat detection
- ✅ Automatic security fixes
- ✅ Complete audit trails
- ✅ Instant email alerts
- ✅ HIPAA/SOC 2 compliance

**Total setup time: 5 minutes**
**Security improvement: Massive** 🛡️

---

*Need help? Email: info@thewellfitcommunity.org*
