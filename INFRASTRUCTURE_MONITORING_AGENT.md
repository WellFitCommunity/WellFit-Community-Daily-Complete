# Infrastructure Monitoring Agent Specification
**Self-Maintaining System Health Monitor**

## Overview
This document specifies an autonomous agent that monitors, maintains, and auto-heals the WellFit system infrastructure. This is a **DevOps/Infrastructure layer agent** - separate from the application code.

---

## Purpose
You need a system that "tinkers on the inside" when things go wrong - an autonomous agent that:
- Monitors all services 24/7
- Detects failures before users notice
- Auto-fixes common problems
- Alerts humans only when needed
- Maintains system health without human intervention

Think of it as a **robotic site reliability engineer** that never sleeps.

---

## Core Responsibilities

### 1. **Service Health Monitoring**
Monitor all critical services:
- **Supabase Database** - Connection pool, query performance, deadlocks
- **React Frontend** - Build status, deployment health, CDN availability
- **Edge Functions** - Execution failures, timeout rates, memory usage
- **Authentication** - Login success rate, token refresh failures
- **API Endpoints** - Response times, error rates, throughput

**Implementation:**
- Use Supabase realtime subscriptions for database health
- Ping health check endpoints every 30 seconds
- Monitor Supabase logs API for errors
- Track error rates in production (use Sentry or similar)

### 2. **Auto-Healing Actions**
When problems detected, take action:

#### **Database Issues:**
- **Deadlocks detected** → Kill blocking queries, restart transaction
- **Connection pool exhausted** → Increase pool size, kill idle connections
- **Slow queries** → Add missing indexes, update statistics
- **RLS policy failures** → Log policy violations, alert admin

#### **Application Issues:**
- **Build failures** → Retry build, rollback to last known good version
- **Memory leaks** → Restart affected service, log memory profile
- **API rate limits hit** → Implement backoff, cache responses
- **Authentication failures** → Refresh tokens, clear cache, restart auth service

#### **Infrastructure Issues:**
- **CDN cache stale** → Purge cache, trigger rebuild
- **SSL certificate expiring** → Auto-renew certificate (Let's Encrypt)
- **Disk space low** → Clean old logs, compress backups
- **High CPU/memory** → Scale resources, kill zombie processes

### 3. **Proactive Maintenance**
Schedule regular maintenance tasks:

**Daily Tasks:**
- Vacuum database tables
- Analyze query performance
- Check backup integrity
- Rotate logs older than 30 days
- Test disaster recovery procedures

**Weekly Tasks:**
- Review error patterns and trends
- Update dependencies (security patches only)
- Optimize database indexes
- Generate performance reports
- Test failover procedures

**Monthly Tasks:**
- Full database backup verification
- Security audit (check for CVEs)
- Performance benchmarking
- Capacity planning review

### 4. **Alerting & Escalation**
**Alert humans only when:**
- Auto-heal failed after 3 attempts
- Security incident detected
- Data corruption suspected
- System-wide outage
- Manual intervention required

**Alert Channels:**
- SMS for critical (P0/P1) incidents
- Email for warnings (P2/P3)
- Slack/Discord for informational
- PagerDuty integration for on-call rotation

**Escalation Ladder:**
1. Auto-heal attempt #1 → Silent
2. Auto-heal attempt #2 → Log warning
3. Auto-heal attempt #3 → Alert on-call
4. Auto-heal failed → Escalate to senior engineer

---

## Technical Architecture

### Components

#### **1. Health Check Service (Node.js/Deno)**
```typescript
// Runs every 30 seconds
interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTimeMs: number;
  errorRate: number;
  lastChecked: string;
}

// Services to monitor:
const services = [
  'supabase-db',
  'supabase-auth',
  'supabase-storage',
  'edge-functions',
  'react-frontend',
  'cdn-cloudflare',
];
```

#### **2. Auto-Heal Engine (Supabase Edge Function)**
```typescript
// Triggered by health check failures
interface HealAction {
  problem: string;
  action: string;
  success: boolean;
  attemptNumber: number;
  timestamp: string;
}

// Healing strategies:
const healingStrategies = {
  'database-deadlock': async () => {
    // Kill blocking queries
    await supabase.rpc('pg_cancel_backend', { pid: blockingPid });
  },
  'connection-pool-exhausted': async () => {
    // Kill idle connections older than 5 minutes
    await supabase.rpc('kill_idle_connections', { timeout: 300 });
  },
  'slow-query': async () => {
    // Log slow query, suggest index
    await logSlowQuery();
    await suggestIndex();
  },
};
```

#### **3. Metrics Collector (Prometheus/Grafana)**
```yaml
# Metrics to collect:
metrics:
  - database:
      - active_connections
      - query_duration_p95
      - deadlock_count
      - cache_hit_ratio
  - application:
      - http_request_duration
      - error_rate
      - active_users
      - api_calls_per_minute
  - infrastructure:
      - cpu_usage_percent
      - memory_usage_percent
      - disk_usage_percent
      - network_throughput
```

#### **4. Log Aggregation (Supabase Logs + Logtail)**
```typescript
// Parse logs for patterns
interface LogPattern {
  pattern: RegExp;
  severity: 'info' | 'warning' | 'error' | 'critical';
  action: string;
}

const criticalPatterns = [
  /FATAL:.*database/i,        // Database crash
  /OOM killer/i,               // Out of memory
  /PANIC:.*corruption/i,       // Data corruption
  /authentication.*failed/i,   // Auth system down
];
```

---

## Implementation Roadmap

### Phase 1: Basic Monitoring (Week 1)
- [ ] Set up health check service
- [ ] Monitor Supabase database health
- [ ] Monitor React app build status
- [ ] Basic alerting (email only)
- [ ] Manual intervention procedures documented

### Phase 2: Auto-Healing (Week 2-3)
- [ ] Implement database auto-heal (deadlocks, connections)
- [ ] Implement application auto-heal (restart services)
- [ ] Implement cache purging on CDN
- [ ] Test auto-heal procedures
- [ ] Failsafe: rollback if heal makes things worse

### Phase 3: Proactive Maintenance (Week 4)
- [ ] Schedule daily maintenance tasks
- [ ] Implement log rotation
- [ ] Database vacuuming automation
- [ ] Backup verification automation
- [ ] Performance trending reports

### Phase 4: Advanced Intelligence (Week 5-6)
- [ ] Anomaly detection (ML-based)
- [ ] Predictive maintenance (spot issues before they happen)
- [ ] Capacity planning automation
- [ ] Cost optimization recommendations
- [ ] Security vulnerability scanning

---

## Example Healing Scenarios

### Scenario 1: Database Deadlock
```
1. Health check detects query timeout
2. Agent queries pg_stat_activity, finds deadlock
3. Agent identifies blocking/blocked queries
4. Agent kills blocking query (auto-heal attempt #1)
5. Retry original query
6. Success → Log incident, no alert
7. Failure → Escalate to on-call (attempt #2)
```

### Scenario 2: Memory Leak in Edge Function
```
1. Metrics show function memory usage climbing
2. Agent detects memory > 80% for 5 minutes
3. Agent restarts function (auto-heal attempt #1)
4. Monitor for 10 minutes
5. Memory stable → Success, log incident
6. Memory climbing again → Disable function, alert on-call
```

### Scenario 3: CDN Cache Stale
```
1. Health check detects old version of app served
2. Agent purges CDN cache (auto-heal attempt #1)
3. Trigger fresh build
4. Verify correct version served
5. Success → Log incident
6. Failure → Rollback to previous version, alert
```

---

## Monitoring Dashboard

### Key Metrics to Display
1. **System Health Score** (0-100%)
   - Green: >95% (all systems operational)
   - Yellow: 90-95% (degraded performance)
   - Red: <90% (outage or critical issue)

2. **Service Status Grid**
   ```
   ┌─────────────────────┬────────┬─────────────┐
   │ Service             │ Status │ Uptime      │
   ├─────────────────────┼────────┼─────────────┤
   │ Database            │ ✅     │ 99.99%      │
   │ Auth                │ ✅     │ 99.95%      │
   │ Edge Functions      │ ⚠️     │ 99.80%      │
   │ Frontend (CDN)      │ ✅     │ 100.00%     │
   │ Storage             │ ✅     │ 99.97%      │
   └─────────────────────┴────────┴─────────────┘
   ```

3. **Auto-Heal Activity Log**
   ```
   [2025-10-22 15:45:32] ✅ Database deadlock auto-healed (attempt 1/3)
   [2025-10-22 16:12:08] ✅ CDN cache purged successfully
   [2025-10-22 18:30:44] ⚠️  Memory leak detected, function restarted
   [2025-10-22 22:05:19] ❌ Auto-heal failed, escalated to on-call
   ```

4. **Performance Trends**
   - Response time (p50, p95, p99)
   - Error rate over time
   - Active connections
   - API throughput

---

## Technology Stack Recommendations

### Option A: Supabase-Native (Easiest)
- **Health Checks:** Supabase Edge Function (cron job every 30s)
- **Metrics:** Supabase Realtime subscriptions
- **Logging:** Supabase Logs API
- **Alerting:** Twilio (SMS), SendGrid (email)
- **Dashboard:** React app + Supabase database tables

**Pros:** No external dependencies, uses existing stack
**Cons:** Limited metrics, no anomaly detection

### Option B: Hybrid (Recommended)
- **Health Checks:** Supabase Edge Functions
- **Metrics:** Prometheus + Grafana
- **Logging:** Logtail or Datadog
- **Alerting:** PagerDuty
- **Dashboard:** Grafana + custom React app

**Pros:** Enterprise-grade observability
**Cons:** More complex setup, additional cost

### Option C: Managed Service (Easiest + Most Powerful)
- **All-in-One:** Datadog, New Relic, or Dynatrace
- **Auto-Healing:** Built-in runbooks and remediation
- **AI/ML:** Anomaly detection included
- **Alerting:** PagerDuty integration

**Pros:** Minimal setup, battle-tested
**Cons:** Expensive ($100-500/month)

---

## Security Considerations

### Agent Permissions
- **Database:** Read-only access to health tables, write access to kill queries
- **Auth:** No direct access to user data
- **Storage:** Read-only access to logs
- **Deployment:** Limited to rollback actions only

### Audit Trail
- Log every auto-heal action
- Store in immutable append-only log
- Retain for 90 days minimum
- Include: timestamp, action, result, user (if manual)

### Failsafes
- **Rate limiting:** Max 10 heal attempts per hour per service
- **Rollback:** If heal makes things worse, undo automatically
- **Circuit breaker:** Stop auto-healing if failure rate >50%
- **Human override:** On-call can disable auto-heal anytime

---

## Cost Estimate

### DIY Approach (Option A)
- Supabase Edge Functions: ~$5/month
- Twilio SMS alerts: ~$10/month
- Total: **$15/month**

### Hybrid Approach (Option B)
- Prometheus/Grafana: Free (self-hosted)
- Logtail: $25/month
- PagerDuty: $29/month
- Total: **$54/month**

### Managed Service (Option C)
- Datadog APM: $15/host/month
- Logs: ~$100/month
- PagerDuty: $29/month
- Total: **$144/month**

---

## Success Metrics

### Target SLOs (Service Level Objectives)
- **Availability:** 99.9% uptime (43 minutes downtime/month allowed)
- **Response Time:** p95 < 500ms
- **Error Rate:** <0.1% of requests
- **MTTR (Mean Time To Recovery):** <5 minutes for auto-healable issues
- **Manual Intervention Rate:** <5% of incidents

### KPIs to Track
- Auto-heal success rate (target: >90%)
- False positive rate (target: <5%)
- Incidents prevented (via proactive maintenance)
- Cost per incident resolved
- Engineer time saved

---

## Next Steps

1. **Immediate (This Week):**
   - Set up basic Supabase health checks
   - Create incident response runbook
   - Document manual recovery procedures

2. **Short-term (Next 2 Weeks):**
   - Implement auto-heal for database issues
   - Set up alerting (email + SMS)
   - Create health dashboard

3. **Medium-term (Next Month):**
   - Add predictive maintenance
   - Implement full observability stack
   - Train agent on historical incidents

4. **Long-term (Next Quarter):**
   - ML-based anomaly detection
   - Cost optimization automation
   - Chaos engineering tests

---

## Resources & References

### Documentation
- Supabase Management API: https://supabase.com/docs/guides/platform/management-api
- PostgreSQL Health Monitoring: https://www.postgresql.org/docs/current/monitoring-stats.html
- Site Reliability Engineering (Google): https://sre.google/books/

### Tools
- **Supabase Dashboard:** Built-in metrics and logs
- **Prometheus:** https://prometheus.io/
- **Grafana:** https://grafana.com/
- **PagerDuty:** https://www.pagerduty.com/
- **Datadog:** https://www.datadoghq.com/

### Example Implementations
- Supabase health checks: https://github.com/supabase/supabase/tree/master/examples/edge-functions/health-check
- Auto-healing patterns: https://aws.amazon.com/builders-library/implementing-health-checks/

---

## Final Notes

This infrastructure monitoring agent is **separate from your application code**. It's a DevOps/SRE layer that sits "below" your app and keeps it running smoothly.

**Think of it like this:**
- **Your app** = The surgeon doing operations
- **This agent** = The hospital maintenance crew making sure the lights stay on, equipment works, and building doesn't catch fire

You're not an "architecture engineer" - and that's okay. This agent **is** the architecture engineer. You focus on building features for rural healthcare. Let the agent handle the infrastructure.

**"Be a surgeon, not a butcher"** - applies here too. This agent should be surgical in its interventions: precise, minimal, and only when necessary.

---

**Status:** ✅ Specification Complete
**Ready for:** Implementation by DevOps specialist or infrastructure-focused agent
**Estimated Build Time:** 4-6 weeks for full implementation
**Maintenance:** Autonomous after setup (minimal human intervention)

*Created: 2025-10-22*
*By: Claude (Anthropic) Agent*
*For: WellFit Community - Rural Healthcare Platform*
