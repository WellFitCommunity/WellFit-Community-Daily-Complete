# Guardian Agent Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Your Application                             │
│  (React Components, API Calls, Database Operations, User Actions)   │
└────────────┬────────────────────────────────────────────┬───────────┘
             │                                             │
             │ Errors, Exceptions, Anomalies              │ API Calls,
             │ Performance Issues, Security Events        │ State Updates
             │                                             │
             ▼                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       GUARDIAN AGENT LAYER                           │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐       │
│  │   Monitoring   │  │  Agent Brain   │  │    Security    │       │
│  │    System      │◄─┤   (Core AI)    ├─►│    Scanner     │       │
│  └────────────────┘  └────────────────┘  └────────────────┘       │
│          │                   │                    │                 │
│          │                   │                    │                 │
│          ▼                   ▼                    ▼                 │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐       │
│  │    Anomaly     │  │    Healing     │  │    Learning    │       │
│  │   Detection    │  │    Engine      │  │    System      │       │
│  └────────────────┘  └────────────────┘  └────────────────┘       │
│                                                                      │
└────────────┬────────────────────────────────────────────┬───────────┘
             │                                             │
             │ Healing Actions                            │ Health Status
             │ Auto-fixes                                 │ Metrics
             │                                             │
             ▼                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         User Interface                               │
│                  (Dashboard, Alerts, Notifications)                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Agent Brain (Core Intelligence)

```
┌─────────────────────────────────────────┐
│           Agent Brain                    │
├─────────────────────────────────────────┤
│                                          │
│  analyze(error, context)                 │
│    │                                     │
│    ├─► extractErrorInfo()               │
│    │                                     │
│    ├─► matchSignature()                 │
│    │     └─► Pattern Cache               │
│    │     └─► Signature Library          │
│    │                                     │
│    ├─► calculateSeverity()              │
│    │                                     │
│    ├─► shouldAutoHeal()                 │
│    │     └─► Check Config               │
│    │     └─► Check Capacity             │
│    │     └─► Check Confidence           │
│    │                                     │
│    └─► initiateHealing()                │
│          └─► Select Strategy            │
│          └─► Execute Healing            │
│          └─► Learn from Result          │
│                                          │
└─────────────────────────────────────────┘
```

### 2. Monitoring System (Continuous Surveillance)

```
┌─────────────────────────────────────────┐
│       Monitoring System                  │
├─────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────────┐    │
│  │  Performance Observer          │    │
│  │  • Slow operations             │    │
│  │  • Long tasks                  │    │
│  │  • Navigation timing           │    │
│  └────────────────────────────────┘    │
│                                          │
│  ┌────────────────────────────────┐    │
│  │  Error Monitoring              │    │
│  │  • Global error handler        │    │
│  │  • Unhandled rejections        │    │
│  │  • Resource load failures      │    │
│  └────────────────────────────────┘    │
│                                          │
│  ┌────────────────────────────────┐    │
│  │  API Monitoring (Fetch Proxy)  │    │
│  │  • Request tracking            │    │
│  │  • Response times              │    │
│  │  • Failed requests             │    │
│  └────────────────────────────────┘    │
│                                          │
│  ┌────────────────────────────────┐    │
│  │  Health Checks (Periodic)      │    │
│  │  • Memory usage                │    │
│  │  • Error rates                 │    │
│  │  • Latency trends              │    │
│  │  • Anomaly detection           │    │
│  └────────────────────────────────┘    │
│                                          │
└─────────────────────────────────────────┘
```

### 3. Healing Engine (Action Executor)

```
┌─────────────────────────────────────────┐
│         Healing Engine                   │
├─────────────────────────────────────────┤
│                                          │
│  generateSteps(issue, strategy)         │
│    │                                     │
│    └─► Strategy-Specific Steps          │
│                                          │
│  execute(action, issue)                 │
│    │                                     │
│    ├─► For each step:                   │
│    │   ├─► performAction()              │
│    │   ├─► validateStep()               │
│    │   └─► Handle timeout               │
│    │                                     │
│    ├─► On failure:                      │
│    │   └─► executeRollback()            │
│    │                                     │
│    └─► Return HealingResult             │
│          • Success/Failure              │
│          • Metrics                      │
│          • Lessons learned              │
│                                          │
└─────────────────────────────────────────┘
```

### 4. Learning System (Adaptive Intelligence)

```
┌─────────────────────────────────────────┐
│         Learning System                  │
├─────────────────────────────────────────┤
│                                          │
│  learn(issue, action, result)           │
│    │                                     │
│    ├─► Extract Features                 │
│    │   • Error type                     │
│    │   • Context                        │
│    │   • Environment                    │
│    │                                     │
│    ├─► Update Pattern Database          │
│    │   • Frequency                      │
│    │   • Outcomes                       │
│    │   • Context                        │
│    │                                     │
│    ├─► Track Strategy Success           │
│    │   • Success rates                  │
│    │   • Effectiveness                  │
│    │   • Timing metrics                 │
│    │                                     │
│    └─► Analyze for Insights             │
│          • Optimal strategies           │
│          • Anti-patterns                │
│          • Adaptations needed           │
│                                          │
└─────────────────────────────────────────┘
```

### 5. Security Scanner (Proactive Protection)

```
┌─────────────────────────────────────────┐
│        Security Scanner                  │
├─────────────────────────────────────────┤
│                                          │
│  scanCode(code, filePath)               │
│    │                                     │
│    ├─► detectXSS()                      │
│    ├─► detectSQLInjection()            │
│    ├─► detectPHIExposure()             │
│    ├─► detectAuthIssues()              │
│    ├─► detectInsecureStorage()         │
│    └─► detectCodeInjection()           │
│                                          │
│  scanForPHI(data, context)              │
│    │                                     │
│    ├─► SSN patterns                     │
│    ├─► Medical record numbers           │
│    ├─► Diagnosis codes                  │
│    └─► Medication info                  │
│                                          │
│  autoFix(vulnerability, code)           │
│    │                                     │
│    ├─► fixXSS()          → Add DOMPurify│
│    ├─► fixSQLInjection() → Add TODO     │
│    ├─► fixPHIExposure()  → Mask/Remove  │
│    └─► fixInsecureStorage() → Encrypt   │
│                                          │
└─────────────────────────────────────────┘
```

## Data Flow

### Error Detection → Healing Flow

```
1. Error Occurs in Application
   │
   ├─► Caught by Monitoring System
   │   • Global error handler
   │   • Performance observer
   │   • API interceptor
   │
   ├─► Passed to Agent Brain
   │   • Extract error info
   │   • Add context
   │
   ├─► Pattern Matching
   │   • Check cache
   │   • Match signatures
   │   • Calculate confidence
   │
   ├─► Severity Assessment
   │   • Base severity
   │   • Context factors
   │   • Impact estimation
   │
   ├─► Healing Decision
   │   • Auto-heal enabled?
   │   • Approval required?
   │   • Capacity available?
   │   • High confidence?
   │
   ├─► Strategy Selection
   │   • Historical success rates
   │   • Error category
   │   • Current state
   │
   ├─► Healing Execution
   │   • Generate steps
   │   • Execute in order
   │   • Validate each step
   │   • Handle failures
   │
   ├─► Learning
   │   • Extract patterns
   │   • Update knowledge
   │   • Track success
   │   • Adapt strategies
   │
   └─► Outcome
       • Success → Learn & Continue
       • Failure → Adapt & Retry
```

### Monitoring → Anomaly Detection Flow

```
1. Continuous Monitoring (Every 5s)
   │
   ├─► Collect Metrics
   │   • Memory usage
   │   • Latency
   │   • Error rate
   │   • Request rate
   │
   ├─► Compare to Baselines
   │   • Adaptive baselines
   │   • Historical trends
   │   • Pattern analysis
   │
   ├─► Detect Anomalies
   │   • Threshold exceeded
   │   • Unusual patterns
   │   • Trend analysis
   │
   ├─► Create Issue
   │   • Map to signature
   │   • Add context
   │   • Set severity
   │
   └─► Trigger Healing
       • Follow error flow above
```

## State Management

```
┌─────────────────────────────────────────┐
│           Agent State                    │
├─────────────────────────────────────────┤
│                                          │
│  isActive: boolean                       │
│  mode: 'monitor' | 'healing' | ...      │
│                                          │
│  activeIssues: DetectedIssue[]          │
│  healingInProgress: HealingAction[]     │
│  recentHealings: HealingResult[]        │
│                                          │
│  knowledgeBase: KnowledgeEntry[]        │
│    • Pattern                            │
│    • Solution                           │
│    • Success rate                       │
│    • Effectiveness                      │
│                                          │
│  performanceMetrics:                    │
│    • issuesDetected                     │
│    • issuesHealed                       │
│    • successRate                        │
│    • avgTimeToDetect                    │
│    • avgTimeToHeal                      │
│                                          │
└─────────────────────────────────────────┘
```

## Integration Points

### React Integration

```
Application Root
  │
  ├─► GuardianErrorBoundary
  │   • Catches React errors
  │   • Reports to agent
  │   • Attempts recovery
  │   • Shows fallback UI
  │
  ├─► App Component
  │   • Initializes agent
  │   • Starts monitoring
  │   • Configures settings
  │
  └─► Components
      • Use hooks if needed
      • Normal error handling
      • Agent handles automatically
```

### Dashboard Integration

```
Admin Routes
  │
  └─► /admin/guardian
      │
      ├─► GuardianAgentDashboard
      │   │
      │   ├─► useGuardianAgent()
      │   │   • Gets state
      │   │   • Gets statistics
      │   │   • Gets health
      │   │
      │   └─► Real-time Updates
      │       • Every 2 seconds
      │       • Live metrics
      │       • Active issues
```

## Performance Optimization

### Caching Strategy

```
Pattern Cache
  • Key: error message + name
  • Value: matched signature
  • TTL: Until agent restart
  • Max size: Unlimited

Knowledge Cache
  • Recent patterns
  • Success rates
  • Strategy effectiveness
  • Updated on learning
```

### Async Operations

```
All healing operations are async:
  • Non-blocking
  • Concurrent healing (up to 5)
  • Promise-based
  • Error handling
```

### Memory Management

```
Bounded Collections:
  • metricsHistory: 1000 items
  • errorWindow: 100 items
  • recentHealings: Unlimited (consider trimming)

Cleanup:
  • Periodic GC of old patterns
  • Remove resolved issues
  • Archive old healings
```

## Security Architecture

```
┌─────────────────────────────────────────┐
│        Security Layers                   │
├─────────────────────────────────────────┤
│                                          │
│  Input Validation                        │
│    • Sanitize all inputs               │
│    • Type checking                      │
│    • Schema validation                  │
│                                          │
│  PHI Protection                          │
│    • Pattern detection                  │
│    • Automatic masking                  │
│    • Secure storage                     │
│                                          │
│  Code Scanning                           │
│    • XSS detection                      │
│    • SQL injection                      │
│    • Code injection                     │
│                                          │
│  Runtime Monitoring                      │
│    • Token validation                   │
│    • Session security                   │
│    • Access control                     │
│                                          │
└─────────────────────────────────────────┘
```

## Deployment Architecture

```
Development:
  • Auto-heal: OFF
  • Learning: ON
  • Approval required: YES
  • Verbose logging: ON

Staging:
  • Auto-heal: ON (limited)
  • Learning: ON
  • Approval required: YES
  • Full metrics: ON

Production:
  • Auto-heal: ON
  • Learning: ON
  • Approval required: NO
  • Optimized logging: ON
  • HIPAA mode: ON
```

---

This architecture provides:
- ✅ Separation of concerns
- ✅ Scalability
- ✅ Maintainability
- ✅ Testability
- ✅ Security
- ✅ Performance
- ✅ Observability
