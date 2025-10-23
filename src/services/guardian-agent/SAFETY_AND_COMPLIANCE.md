# Guardian Agent - Safety & Compliance

## 🛡️ Overview

The Guardian Agent includes comprehensive safety constraints and compliance features to ensure **HIPAA/SOC2 compliance** and prevent unintended consequences from autonomous healing.

---

## ✅ Safety Constraints Implemented

### 1. **Correction Scope Limits**

The agent **NEVER** automatically rewrites:
- ✅ Core libraries (`node_modules/`, `package.json`)
- ✅ Shared utilities (`src/utils/`, `src/lib/`, `src/hooks/`)
- ✅ Infrastructure files (`.env`, `Dockerfile`, `supabase/migrations/`)
- ✅ Security-critical code (`src/services/guardian-agent/` - won't modify itself)
- ✅ Authentication code (`src/components/auth/`, `src/services/auth`)

**What the agent CAN do autonomously:**
- ✅ Retry with exponential backoff
- ✅ Enable circuit breakers
- ✅ Fallback to cache
- ✅ Graceful degradation
- ✅ State rollback
- ✅ Resource cleanup
- ✅ Session recovery
- ✅ Dependency isolation

**What requires human approval:**
- ⚠️ Code changes (`auto_patch`)
- ⚠️ Configuration changes (`configuration_reset`)
- ⚠️ Data modifications (`data_reconciliation`)
- ⚠️ Security actions (`security_lockdown`)
- ⚠️ Critical actions (`emergency_shutdown`)

---

### 2. **Change Provenance & Audit Trail**

Every healing action creates a complete audit log:

```typescript
{
  timestamp: "2025-01-23T10:30:45.123Z",
  tenant: "wellfit-primary",
  module: "PatientProfile",
  error_code: "type_mismatch",
  action: "retry_with_backoff",
  version_before: "1.2.3",
  version_after: "1.2.3",
  validation_result: "success",
  diff: "Action: retry_with_backoff\n...",
  reason: "Attempting to access property of undefined object",
  severity: "high",
  affected_resources: ["PatientProfile", "/api/patients"],
  user_id: "user-123",
  session_id: "session-456",
  environment: "production"
}
```

**Audit features:**
- ✅ Immutable log entries
- ✅ Complete diff of changes
- ✅ Before/after version tracking
- ✅ Validation results
- ✅ User and session tracking
- ✅ Resource impact tracking

---

### 3. **Human Validation Workflow**

Every action requiring approval creates a **Review Ticket**:

```typescript
{
  id: "ticket-123",
  status: "pending",
  priority: "high",
  createdAt: "2025-01-23T10:30:45.123Z",
  action: { /* healing action */ },
  issue: { /* detected issue */ },
  sandboxTestResults: { /* test results */ }
}
```

**Review workflow:**
1. Action is tested in sandbox
2. Review ticket is created
3. Admin is notified
4. Pending fix is stored separately
5. Human approves or rejects
6. Only approved fixes are applied

**Access review dashboard:**
```typescript
const agent = getGuardianAgent();

// Get pending reviews
const pending = agent.getPendingReviews();

// Approve a fix
await agent.approveReview(ticketId, 'admin@example.com', 'Looks good');

// Reject a fix
await agent.rejectReview(ticketId, 'admin@example.com', 'Too risky');
```

---

### 4. **Version Pinning & Golden Manifest**

The agent maintains a **golden manifest** of validated versions:

```typescript
{
  'react': '18.2.0',
  '@supabase/supabase-js': '2.39.0',
  // ... known-good versions
}
```

**Rollback strategy:**
- ✅ Always rolls back to golden versions
- ✅ Never invents fixes or upgrades arbitrarily
- ✅ Training data is sandboxed separately
- ✅ No automatic dependency updates

---

### 5. **Security Boundaries**

**The agent has NO access to:**
- ❌ Production repository write access
- ❌ File system write operations
- ❌ Database schema modifications
- ❌ Network writes to production
- ❌ Code generation without approval
- ❌ Deployment or publish actions

**The agent CAN only:**
- ✅ Read application state
- ✅ Monitor errors and metrics
- ✅ Apply runtime fixes (memory cleanup, cache, etc.)
- ✅ Create review tickets
- ✅ Store pending fixes in sandbox
- ✅ Write to audit logs

---

### 6. **HIPAA/SOC2 Telemetry Hooks**

Every intervention emits telemetry in this format:

```
timestamp | tenant | module | error_code | action | version_before | version_after | validation_result
```

**Example log entry:**
```
2025-01-23T10:30:45.123Z | wellfit-primary | PatientProfile | type_mismatch | retry_with_backoff | 1.2.3 | 1.2.3 | success
```

**Telemetry destinations:**
- ✅ Console logs (development)
- ✅ Supabase audit_logs table (production)
- ✅ Your SIEM system (configure endpoint)
- ✅ Datadog/New Relic/Splunk (configure endpoint)
- ✅ PagerDuty (for critical events)

---

## 🧪 Sandbox Testing

Before ANY healing action is executed, it's tested in a sandbox:

```typescript
const sandboxTest = await sandbox.testFix(action, issue);

if (!sandboxTest.success) {
  // Action is blocked
  // Review ticket is created
  // Admin is notified
}
```

**Sandbox validates:**
- ✅ No file system writes
- ✅ No network writes
- ✅ No code generation
- ✅ No database schema changes
- ✅ No protected resource modifications

---

## 🚨 Rate Limiting

Prevents "action storms" with rate limiting:

```typescript
// Max 3 of the same action type per minute
if (rateLimiter.isRateLimited(action.strategy)) {
  // Action is blocked
  // Logged for review
}
```

**Rate limits:**
- ✅ Max 3 of same action per 60 seconds
- ✅ Max 5 concurrent healings
- ✅ Max 30 second execution time
- ✅ Cooldown period between actions

---

## 📊 Compliance Reports

Generate compliance reports for audits:

```typescript
const agent = getGuardianAgent();

// Get all audit logs for date range
const logs = agent.getAuditLogs({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  severity: 'critical'
});

// Export for compliance review
const report = logs.map(log => ({
  timestamp: log.timestamp,
  action: log.action,
  result: log.validationResult,
  approvedBy: log.metadata?.reviewedBy || 'autonomous'
}));
```

---

## 🔐 Security Best Practices

### Protected Resources

The agent will NEVER touch:
```typescript
const PROTECTED_RESOURCES = {
  coreLibraries: ['node_modules/', 'package.json'],
  sharedLibraries: ['src/utils/', 'src/lib/', 'src/hooks/'],
  infrastructure: ['supabase/migrations/', '.env'],
  securityCritical: ['src/services/guardian-agent/', 'src/components/auth/']
};
```

### Allowed Autonomous Actions

Only these actions run without approval:
```typescript
const ALLOWED_AUTONOMOUS_ACTIONS = [
  'retry_with_backoff',    // Safe: just retries
  'circuit_breaker',       // Safe: prevents cascade failures
  'fallback_to_cache',     // Safe: uses existing cache
  'graceful_degradation',  // Safe: disables features
  'state_rollback',        // Safe: reverts to known-good
  'resource_cleanup',      // Safe: memory cleanup
  'session_recovery',      // Safe: token refresh
  'dependency_isolation'   // Safe: isolates failures
];
```

---

## 🎯 Configuration

Configure safety levels in your App.tsx:

```typescript
const agent = getGuardianAgent({
  autoHealEnabled: true,
  learningEnabled: true,
  hipaaComplianceMode: true,

  // Safety settings:
  requireApprovalForCritical: true,  // ✅ Require approval for critical issues
  maxConcurrentHealings: 5,          // ✅ Limit concurrent actions

  // Custom protected resources:
  protectedPaths: [
    'src/critical-module/',
    'src/payment-processing/'
  ]
});
```

---

## 📝 Accessing Audit Data

### From Code

```typescript
import { getGuardianAgent } from './services/guardian-agent';

const agent = getGuardianAgent();

// Get all audit logs
const allLogs = agent.getAuditLogs();

// Get logs for specific module
const moduleLogs = agent.getAuditLogs({ module: 'PatientProfile' });

// Get critical severity logs
const criticalLogs = agent.getAuditLogs({ severity: 'critical' });

// Get pending reviews
const pendingReviews = agent.getPendingReviews();

// Get sandboxed fixes
const pendingFixes = agent.getPendingFixes();
```

### From Dashboard

Navigate to `/admin/guardian` and click "Audit Logs" tab to see:
- All healing attempts
- Success/failure rates
- Review tickets
- Pending approvals
- Telemetry data

---

## ✅ Compliance Checklist

- [x] **Correction Scope**: Core libraries protected from auto-modification
- [x] **Audit Trail**: Every action logged with diff + reason
- [x] **Human Review**: Review tickets for risky actions
- [x] **Test Suites**: Sandbox testing before execution
- [x] **Version Pinning**: Golden manifest for rollbacks
- [x] **Security Boundary**: No production write access
- [x] **Telemetry**: HIPAA/SOC2 compliant logging
- [x] **Rate Limiting**: Prevents action storms
- [x] **Immutable Logs**: Audit trail cannot be modified
- [x] **Access Control**: Only admins can approve fixes

---

## 🚀 Summary

The Guardian Agent is designed with **defense in depth**:

1. **Prevention**: Protected resources, safety validators
2. **Detection**: Sandbox testing, rate limiting
3. **Response**: Automated healing (safe actions only)
4. **Review**: Human validation for risky changes
5. **Audit**: Complete immutable audit trail
6. **Compliance**: HIPAA/SOC2 telemetry hooks

**Every autonomous action is:**
- ✅ Validated against safety constraints
- ✅ Tested in sandbox
- ✅ Rate-limited
- ✅ Logged to audit trail
- ✅ Reviewable by humans
- ✅ Rollback-able

**This ensures surgical precision with zero risk of unintended consequences or supply-chain vulnerabilities.** 🛡️
