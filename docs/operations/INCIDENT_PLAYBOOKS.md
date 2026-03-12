# Incident Playbooks

> **Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.**
> Proprietary and confidential.

**Last updated:** 2026-03-12
**Owner:** Maria (AI System Director), Akima (CCO)

---

## Severity Definitions & SLAs

| Severity | Definition | Response SLA | Resolution Target | Notification |
|----------|-----------|-------------|-------------------|--------------|
| **P1 - Critical** | Service down, PHI exposed, patient safety at risk | 15 minutes | 4 hours | Maria + Akima immediately |
| **P2 - High** | Degraded service, single component failure, security anomaly | 1 hour | 24 hours | Maria within 1 hour |
| **P3 - Medium** | Non-urgent issue, policy violation, cost anomaly | Next business day | 1 week | Tracked in audit log |

## Escalation Contacts

| Role | Person | Contact Method |
|------|--------|---------------|
| AI System Director | Maria | maria@wellfitcommunity.com |
| CCO (Compliance) | Akima | akima@wellfitcommunity.com |
| Supabase Support | — | Supabase Dashboard > Support |

## AI Authority Scope (Global)

All playbooks reference what AI agents (Guardian Agent, Claude Code, health-monitor) may do autonomously versus what requires human approval.

| AI May Do Autonomously | Requires Human Approval |
|------------------------|------------------------|
| Log alerts to `audit_logs` and `security_alerts` | Disable user accounts |
| Trip circuit breakers on failing services | Delete or modify production data |
| Send notification emails/SMS via existing channels | Rotate JWT signing keys |
| Restart individual edge functions via health-monitor | Change RLS policies |
| Flag suspicious activity for review | Deploy new edge function versions |
| De-escalate alerts after automated checks pass | Grant or revoke admin roles |
| Quarantine suspicious AI output before it reaches users | Modify `ALLOWED_ORIGINS` or CORS configuration |

---

## Category 1: Infrastructure Failures

### 1.1 P1: Supabase Database Unreachable

**Detection:**
- `health-monitor` edge function reports `unhealthy` status for database checks
- Guardian Agent logs `SYSTEM_ERROR` with `supabase_connection_refused`
- Application returns 500 errors on all data queries
- Supabase Dashboard status page shows incident

**Severity & SLA:** P1 — 15 minute response. All data operations halted. Both WellFit and Envision Atlus affected.

**Immediate Actions (first 5 minutes):**

1. Check Supabase status page: `https://status.supabase.com`
2. Verify from CLI:
   ```bash
   npx supabase db ping --project-ref xkybsjnvuohpqpbkikyn
   ```
3. Check if the project is paused:
   ```bash
   npx supabase projects list
   ```
4. Notify Maria and Akima immediately
5. If project is paused, restore it:
   ```bash
   npx supabase projects restore xkybsjnvuohpqpbkikyn
   ```

**Investigation Steps:**

1. Check Supabase Dashboard > Database > Logs for connection errors
2. Review recent migrations that may have caused issues:
   ```bash
   npx supabase migration list --project-ref xkybsjnvuohpqpbkikyn
   ```
3. Check if connection pool is exhausted (Dashboard > Database > Roles > active connections)
4. Review `audit_logs` from the last known healthy state for unusual activity

**Resolution Steps:**

| Cause | Fix |
|-------|-----|
| Project paused | `npx supabase projects restore xkybsjnvuohpqpbkikyn` |
| Connection pool exhausted | Kill idle connections via Dashboard > SQL Editor: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '10 minutes';` |
| Supabase outage | Wait for Supabase resolution; enable offline fallback if available (`mobile-sync` edge function) |
| Bad migration | Roll back: create a new migration reversing the change, then `npx supabase db push` |

**AI Authority:** Guardian Agent may log alerts and send notifications. It may NOT attempt database recovery operations or run migrations.

**Post-Incident:**
- Document in `audit_logs` with category `INFRASTRUCTURE_INCIDENT`
- If downtime > 30 minutes, file Supabase support ticket
- Review if `self_reports` fallback path (System A offline storage) captured patient data during outage
- Update `docs/PROJECT_STATE.md` with incident summary

---

### 1.2 P1: Edge Function Deployment Failure (All Functions Down)

**Detection:**
- `health-monitor` `check_all` action returns all agents as `unreachable`
- Multiple 502/503 errors across all edge function endpoints
- `system-status` edge function itself unreachable
- Patient check-ins failing (`create-checkin` down)

**Severity & SLA:** P1 — 15 minute response. All AI services, auth, check-ins, and clinical workflows halted.

**Immediate Actions (first 5 minutes):**

1. Verify edge function runtime status:
   ```bash
   npx supabase functions list --project-ref xkybsjnvuohpqpbkikyn
   ```
2. Test a known-good function directly:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" \
     "https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/system-status" \
     -H "Authorization: Bearer ${SB_ANON_KEY}"
   ```
3. Notify Maria immediately
4. Check Supabase Dashboard > Edge Functions for deployment errors

**Investigation Steps:**

1. Check if a recent deployment introduced the failure:
   ```bash
   git log --oneline -5 -- supabase/functions/
   ```
2. Review edge function logs in Supabase Dashboard > Edge Functions > Logs
3. Check if `_shared/` utilities have a syntax error (breaks all functions that import them):
   - `supabase/functions/_shared/env.ts`
   - `supabase/functions/_shared/cors.ts`
   - `supabase/functions/_shared/supabaseClient.ts`
   - `supabase/functions/_shared/auditLogger.ts`
4. Check if Deno runtime version changed (review `supabase/functions/deno.json`)

**Resolution Steps:**

| Cause | Fix |
|-------|-----|
| Bad deployment of `_shared/` | Revert the commit: `git revert <commit>`, then redeploy: `npx supabase functions deploy --no-verify-jwt` |
| Supabase edge runtime outage | Wait for resolution; document SLA breach |
| Deno version incompatibility | Pin Deno version in `supabase/functions/deno.json` and redeploy |
| Individual function syntax error cascading | Deploy functions individually to isolate: `npx supabase functions deploy <function-name> --no-verify-jwt` |

**AI Authority:** Guardian Agent may log alerts. Claude Code may investigate logs. Neither may redeploy functions without Maria's approval.

**Post-Incident:**
- Document which functions were affected and for how long
- Verify all 11 MCP servers are responding after recovery
- Run `health-monitor` `check_all` to confirm full recovery
- If patient check-ins were lost, review `self_reports` fallback data

---

### 1.3 P2: Single Edge Function Failure

**Detection:**
- `health-monitor` reports one agent as `unhealthy` or `unreachable`
- Specific feature stops working (e.g., AI readmission predictions fail but check-ins work)
- Guardian Agent creates a `SecurityAlert` with `category: 'service_failure'`

**Severity & SLA:** P2 — 1 hour response. Scope depends on which function.

**Critical function triage:**

| Function | Impact if Down | Escalate to P1? |
|----------|---------------|-----------------|
| `create-checkin` | Patient check-ins fail | Yes — core workflow |
| `login` / `register` | No new logins | Yes — auth blocked |
| `envision-login` | Clinical staff locked out | Yes — clinical workflow |
| `ai-readmission-predictor` | Risk scores stale | No — fallback to last known |
| `ai-soap-note-generator` | Manual note writing | No — clinical workaround exists |
| `guardian-agent` | Monitoring blind spot | Yes — security gap |
| `health-monitor` | No health checks | Yes — watchdog down |
| `bed-management` | Bed board stale | P2 unless census critical |

**Immediate Actions:**

1. Identify the failed function from `health-monitor` output or error logs
2. Test it directly:
   ```bash
   curl -s -w "\n%{http_code}" \
     "https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/<function-name>" \
     -H "Authorization: Bearer ${SB_ANON_KEY}" \
     -H "Content-Type: application/json" \
     -d '{"action":"health"}'
   ```
3. Check function-specific logs in Supabase Dashboard

**Investigation Steps:**

1. Review the function's `index.ts` for recent changes:
   ```bash
   git log --oneline -5 -- supabase/functions/<function-name>/
   ```
2. Check if the function depends on an external API that is down (Claude API, NPI registry, etc.)
3. Check if rate limiting is the cause (`supabase/functions/_shared/mcpRateLimiter.ts` thresholds)
4. For AI functions, check if `modelFallback.ts` attempted fallback and also failed

**Resolution Steps:**

1. If code error: fix and redeploy the single function:
   ```bash
   npx supabase functions deploy <function-name> --no-verify-jwt
   ```
2. If external dependency down: the `modelFallback.ts` system should handle Claude/OpenAI failover. If both fail, wait for upstream recovery.
3. If rate limited: adjust limits in `MCP_RATE_LIMITS` config or wait for window reset.

**AI Authority:** `health-monitor` may attempt recovery via its `recover` action. Guardian Agent may log and notify. Neither may modify function code.

**Post-Incident:**
- Log recovery in `audit_logs`
- If the function was an AI clinical service, verify no stale predictions are being served

---

### 1.4 P2: MCP Server Unresponsive

**Detection:**
- MCP tool calls return timeouts or connection errors
- `mcp-edge-functions-server` `list_functions` or `ping` fails
- Specific MCP tool (e.g., `mcp__fhir__search_resources`) returns errors

**Severity & SLA:** P2 — 1 hour response. Impact depends on which MCP server (see tier table below).

| MCP Server | Tier | Impact if Down |
|------------|------|---------------|
| `mcp-fhir-server` | 3 (Admin) | FHIR CRUD blocked, My Health Hub stale |
| `mcp-hl7-x12-server` | 3 (Admin) | EDI transactions halted |
| `mcp-prior-auth-server` | 3 (Admin) | Prior auth workflow blocked |
| `mcp-clearinghouse-server` | 1 (Public) | Claims submission halted |
| `mcp-cms-coverage-server` | 1 (Public) | Coverage lookups fail |
| `mcp-npi-registry-server` | 1 (Public) | Provider validation degraded |
| `mcp-postgres-server` | 2 (User) | Direct DB analytics blocked |
| `mcp-claude-server` | 3 (Admin) | AI proxy down — all AI edge functions affected (escalate to P1) |
| `mcp-medical-codes-server` | 2 (User) | Code lookups fail |
| `mcp-edge-functions-server` | 3 (Admin) | Function management blocked |
| `mcp-pubmed-server` | 1 (Public) | Literature search unavailable |

**Immediate Actions:**

1. Ping the specific MCP server:
   ```bash
   # Example for FHIR server
   curl -s "https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/mcp-fhir-server" \
     -H "Authorization: Bearer ${SB_SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{"method":"ping"}'
   ```
2. Check if the underlying edge function is deployed:
   ```bash
   npx supabase functions list --project-ref xkybsjnvuohpqpbkikyn | grep mcp
   ```
3. If `mcp-claude-server` is down, escalate to P1 (all AI services affected)

**Investigation Steps:**

1. Check MCP auth gate (`supabase/functions/_shared/mcpAuthGate.ts`) — is the service role key valid?
2. Check rate limiter (`supabase/functions/_shared/mcpRateLimiter.ts`) — has the server hit its limit?
3. Check query timeout settings (`supabase/functions/_shared/mcpQueryTimeout.ts`)
4. Review MCP audit logs (`supabase/functions/_shared/mcpAudit.ts`) for recent errors

**Resolution Steps:**

1. Redeploy the specific MCP server:
   ```bash
   npx supabase functions deploy mcp-<server-name>-server --no-verify-jwt
   ```
2. If auth issue: verify `SB_SERVICE_ROLE_KEY` is set in Supabase secrets
3. If rate limited: wait for window reset or temporarily increase limit

**AI Authority:** Health-monitor may attempt recovery. Guardian Agent may log alerts. Neither may modify MCP server code or auth configuration.

**Post-Incident:**
- Verify all 11 MCP servers responding via ping
- Check `mcp_cost_metrics` for any unusual patterns before failure

---

## Category 2: Clinical AI Failures

### 2.1 P1: AI Hallucinated Clinical Recommendation

**Detection:**
- Clinician reports incorrect medication, dose, or diagnosis suggestion
- `clinicalOutputValidator.ts` flags a `RejectedCode` but it was overridden or bypassed
- `ai_transparency_log` shows AI output that contradicts known patient data
- `promptInjectionGuard.ts` detected `upcoding_instruction` or `drg_manipulation` pattern

**Severity & SLA:** P1 — 15 minute response. Patient safety risk. HIPAA and malpractice implications.

**Immediate Actions (first 5 minutes):**

1. **STOP the specific AI skill immediately** — set `is_active = false` in `ai_skills`:
   ```sql
   UPDATE ai_skills SET is_active = false
   WHERE skill_key = '<affected-skill-key>';
   ```
2. Notify Maria AND Akima immediately — clinical compliance issue
3. Document exactly what the AI recommended and what was correct
4. Check if the recommendation was acted upon (check `clinical_notes`, `medications`, `encounter_diagnoses`)

**Investigation Steps:**

1. Pull the AI transparency log for the specific interaction:
   ```sql
   SELECT * FROM ai_transparency_log
   WHERE skill_key = '<affected-skill>'
   AND created_at > now() - interval '24 hours'
   ORDER BY created_at DESC LIMIT 20;
   ```
2. Check the `ai_confidence_scores` for the affected prediction:
   ```sql
   SELECT * FROM ai_confidence_scores
   WHERE skill_key = '<affected-skill>'
   AND created_at > now() - interval '24 hours'
   ORDER BY confidence_score ASC LIMIT 10;
   ```
3. Review the prompt version in `ai_prompt_versions` — was a recent prompt change deployed?
4. Check if `clinicalOutputValidator.ts` was properly invoked (review edge function logs)
5. Check if `clinicalGroundingRules.ts` constraints were active
6. Inspect `promptInjectionGuard.ts` scan results — was the input manipulated?

**Resolution Steps:**

1. Keep the AI skill disabled until root cause is identified
2. If prompt regression: revert to previous prompt version in `ai_prompt_versions`
3. If validator bypass: fix the validation path in the edge function
4. If model hallucination: add the specific case to `clinicalGroundingRules.ts` as a constraint
5. Before re-enabling, test with the exact input that caused the hallucination
6. Re-enable only with Maria and Akima approval:
   ```sql
   UPDATE ai_skills SET is_active = true
   WHERE skill_key = '<affected-skill-key>';
   ```

**AI Authority:** Guardian Agent may disable the skill (`is_active = false`). It may NOT re-enable it. It may NOT modify clinical grounding rules or prompts. All clinical AI changes require human approval.

**Post-Incident:**
- File in `breachNotificationService` if PHI was involved in the hallucination
- Add regression test case to the affected edge function's test suite
- Update `ai_model_cards` with the failure mode documentation
- Review if model version pinning (`ai_skills.model`) was correct
- Akima reviews for clinical compliance implications

---

### 2.2 P1: AI Readmission Predictor Returning Incorrect Risk Scores

**Detection:**
- Clinical staff notices risk scores inconsistent with patient acuity
- `v_readmission_dashboard_metrics` shows sudden statistical shifts
- `ai_accuracy_metrics` shows accuracy drop below threshold
- `readmission_risk_predictions` table shows anomalous score distributions

**Severity & SLA:** P1 — 15 minute response. Incorrect risk scores can cause incorrect discharge decisions.

**Immediate Actions (first 5 minutes):**

1. Disable the predictor:
   ```sql
   UPDATE ai_skills SET is_active = false
   WHERE skill_key = 'readmission_risk_predictor';
   ```
2. Notify Maria and Akima
3. Flag all predictions from the last 24 hours for manual review:
   ```sql
   UPDATE readmission_risk_predictions
   SET needs_review = true
   WHERE created_at > now() - interval '24 hours';
   ```

**Investigation Steps:**

1. Check prediction distribution for anomalies:
   ```sql
   SELECT
     date_trunc('hour', created_at) as hour,
     avg(risk_score) as avg_score,
     min(risk_score) as min_score,
     max(risk_score) as max_score,
     count(*) as predictions
   FROM readmission_risk_predictions
   WHERE created_at > now() - interval '48 hours'
   GROUP BY 1 ORDER BY 1;
   ```
2. Compare against `ai_accuracy_metrics`:
   ```sql
   SELECT * FROM ai_accuracy_metrics
   WHERE skill_key = 'readmission_risk_predictor'
   ORDER BY evaluated_at DESC LIMIT 10;
   ```
3. Check if the model version changed in `ai_skills.model`
4. Review `ai-readmission-predictor` edge function logs for errors
5. Check if input data pipeline is corrupted (missing vitals, wrong patient context)

**Resolution Steps:**

| Root Cause | Fix |
|-----------|-----|
| Model version changed | Revert `ai_skills.model` to previous pinned version |
| Input data corrupted | Fix upstream data source; rerun predictions |
| Prompt regression | Revert prompt in `ai_prompt_versions` |
| Statistical drift | Recalibrate with recent outcomes data |

**AI Authority:** Guardian Agent may disable the predictor. It may NOT modify risk scores, delete predictions, or change model versions.

**Post-Incident:**
- Manual clinical review of all flagged predictions
- Akima reviews for patient safety implications
- Update `ai_model_cards` with failure documentation
- Consider adding statistical monitoring to `guardian-agent`

---

### 2.3 P2: AI Service Circuit Breaker Tripped

**Detection:**
- `modelFallback.ts` logs show primary model failed 5+ consecutive times
- Fallback to secondary model (OpenAI) triggered
- `claude_usage_logs` shows elevated error rates
- Edge function logs show `CIRCUIT_BREAKER_OPEN` entries

**Severity & SLA:** P2 — 1 hour response. AI features degraded but fallback is active.

**Immediate Actions:**

1. Verify fallback model is producing acceptable results
2. Check Claude API status: `https://status.anthropic.com`
3. Review `claude_usage_logs` for the error pattern:
   ```sql
   SELECT error_type, count(*), max(created_at)
   FROM claude_usage_logs
   WHERE error_type IS NOT NULL
   AND created_at > now() - interval '1 hour'
   GROUP BY error_type;
   ```

**Investigation Steps:**

1. Check if rate limiting caused the circuit break:
   ```sql
   SELECT * FROM claude_usage_logs
   WHERE created_at > now() - interval '2 hours'
   ORDER BY created_at DESC LIMIT 50;
   ```
2. Verify API key validity (`ANTHROPIC_API_KEY` in Supabase secrets)
3. Check `modelFallback.ts` fallback chain — is the secondary model also failing?
4. Review `mcp_cost_metrics` for token usage spikes that may have triggered rate limits

**Resolution Steps:**

1. If Claude API outage: wait for resolution; fallback model handles traffic
2. If rate limited: reduce request volume or request limit increase from Anthropic
3. If API key expired: rotate key in Supabase secrets and redeploy affected functions
4. If fallback also failing: manually disable non-critical AI skills until recovery

**AI Authority:** `modelFallback.ts` handles failover autonomously. Guardian Agent may log alerts. Neither may change API keys or modify fallback chain configuration.

**Post-Incident:**
- Review token usage patterns that led to the circuit break
- Verify `mcp_cost_metrics` reflects actual costs during fallback period
- Consider adjusting circuit breaker thresholds if too sensitive

---

### 2.4 P2: Claude API Rate Limited or Down

**Detection:**
- HTTP 429 responses from Anthropic API
- `modelFallback.ts` activating fallback for all requests
- `claude_usage_logs` shows spike in `rate_limited` error types
- Multiple AI edge functions failing simultaneously

**Severity & SLA:** P2 — 1 hour. Escalate to P1 if fallback model also fails.

**Immediate Actions:**

1. Check Anthropic status: `https://status.anthropic.com`
2. Verify `modelFallback.ts` is actively falling back:
   ```sql
   SELECT count(*) as fallback_count
   FROM claude_usage_logs
   WHERE was_fallback = true
   AND created_at > now() - interval '1 hour';
   ```
3. If total API outage (not rate limit), prioritize clinical AI functions over community AI functions

**Investigation Steps:**

1. Check current token usage against limits:
   ```sql
   SELECT
     date_trunc('hour', created_at) as hour,
     sum(input_tokens + output_tokens) as total_tokens,
     count(*) as requests
   FROM claude_usage_logs
   WHERE created_at > now() - interval '24 hours'
   GROUP BY 1 ORDER BY 1 DESC;
   ```
2. Identify which skill is consuming the most tokens:
   ```sql
   SELECT skill_key, count(*), sum(input_tokens + output_tokens) as tokens
   FROM claude_usage_logs
   WHERE created_at > now() - interval '6 hours'
   GROUP BY skill_key ORDER BY tokens DESC LIMIT 10;
   ```
3. Check if a runaway process is making excessive requests

**Resolution Steps:**

| Cause | Fix |
|-------|-----|
| Rate limited | Reduce non-critical AI call volume; batch where possible |
| API key issue | Rotate in Supabase secrets |
| Runaway process | Identify and kill the offending edge function invocation |
| Full outage | Wait; fallback model covers critical paths |

**AI Authority:** `modelFallback.ts` handles failover autonomously. No AI agent may change API keys or billing configuration.

**Post-Incident:**
- Review `mcp_cost_metrics` for the period
- Adjust rate limiting in `mcpRateLimiter.ts` if needed
- Consider implementing request queuing for non-urgent AI calls

---

## Category 3: Data Integrity

### 3.1 P1: PHI Exposure Detected

**Detection:**
- PHI found in application logs, edge function logs, or error messages
- Patient data visible to wrong tenant (RLS failure)
- `phi_access_logs` shows access by unauthorized user
- Akima or Maria identifies PHI in non-secure channel (email, chat, screenshot)
- Security scan flags PHI in git commit history

**Severity & SLA:** P1 — 15 minute response. HIPAA breach notification may be required (45 CFR 164.400-414).

**Immediate Actions (first 5 minutes):**

1. **Contain the exposure** — identify where PHI is visible and restrict access
2. Notify Maria AND Akima immediately — breach notification timeline starts
3. Start a breach incident via `breachNotificationService`:
   ```typescript
   // Record the incident
   await breachNotificationService.createIncident({
     title: 'PHI Exposure - [brief description]',
     breach_type: 'unauthorized_disclosure',
     severity: 'critical',
     phi_types_involved: ['names', 'dob', 'ssn'], // list what was exposed
     description: 'Detailed description of exposure'
   });
   ```
4. If PHI is in logs, purge the affected log entries
5. If PHI is in git history, do NOT force-push — document and consult legal

**Investigation Steps:**

1. Determine scope — how many patients affected:
   ```sql
   SELECT count(DISTINCT user_id) as affected_patients
   FROM phi_access_logs
   WHERE accessed_at > '<incident-start-time>'
   AND user_id NOT IN (SELECT user_id FROM user_roles WHERE role = 'admin');
   ```
2. Determine what PHI was exposed (names, DOB, SSN, diagnoses, etc.)
3. Determine who had access to the exposed data
4. Check `audit_logs` for the code path that leaked PHI
5. If tenant isolation failure: check RLS policies on the affected table

**Resolution Steps:**

1. Fix the code path that exposed PHI
2. Purge PHI from any logs or caches where it was stored
3. `breachNotificationService` manages the 4-factor risk assessment:
   - Nature and extent of PHI involved
   - Unauthorized person who accessed PHI
   - Whether PHI was actually viewed
   - Extent of risk mitigation
4. If > 500 individuals affected: HHS notification required within 60 days
5. If media notification required: Akima coordinates

**AI Authority:** Guardian Agent may log the incident and create alerts. It may NOT assess breach severity, make notification decisions, or contact patients. All breach decisions require Akima (CCO) approval.

**Post-Incident:**
- Complete breach risk assessment within 24 hours
- Document in `breachNotificationService` system
- File with HHS if required (60-day deadline)
- Implement fix and add regression test
- Review all similar code paths for the same vulnerability

---

### 3.2 P1: RLS Bypass Detected (Cross-Tenant Data Access)

**Detection:**
- User sees data from another tenant
- `audit_logs` show queries returning data with mismatched `tenant_id`
- Security scan finds a table without RLS enabled
- `rls_policy_audit` shows policy was dropped or modified
- `guardian-agent` creates a `SecurityAlert` with `category: 'rls_bypass'`

**Severity & SLA:** P1 — 15 minute response. Multi-tenant isolation failure.

**Immediate Actions (first 5 minutes):**

1. Identify the affected table(s)
2. Verify RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public'
   AND rowsecurity = false;
   ```
3. If a table has RLS disabled, re-enable immediately:
   ```sql
   ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
   ```
4. Notify Maria and Akima — this is also a potential PHI breach (see 3.1)

**Investigation Steps:**

1. Check which tables lack RLS policies:
   ```sql
   SELECT t.tablename
   FROM pg_tables t
   LEFT JOIN pg_policies p ON t.tablename = p.tablename
   WHERE t.schemaname = 'public'
   AND p.policyname IS NULL
   AND t.rowsecurity = true;
   ```
2. Check `rls_policy_audit` for recent policy changes:
   ```sql
   SELECT * FROM rls_policy_audit
   ORDER BY changed_at DESC LIMIT 20;
   ```
3. Check if a view is missing `security_invoker = on`:
   ```sql
   SELECT viewname
   FROM pg_views
   WHERE schemaname = 'public';
   -- Cross-reference with migration 20260208020000_security_advisor_errors.sql
   ```
4. Review recent migrations for RLS-related changes:
   ```bash
   git log --oneline --all -- supabase/migrations/ | head -10
   ```

**Resolution Steps:**

1. Re-enable RLS on any unprotected table
2. Add missing policies (minimum: tenant isolation):
   ```sql
   CREATE POLICY "Tenant isolation" ON public.<table>
     FOR ALL
     USING (tenant_id = get_current_tenant_id())
     WITH CHECK (tenant_id = get_current_tenant_id());
   ```
3. Fix any views missing `security_invoker = on`
4. Push the fix:
   ```bash
   npx supabase db push
   ```
5. Assess if cross-tenant data was actually accessed (may trigger 3.1 PHI breach process)

**AI Authority:** Guardian Agent may detect and alert. It may NOT modify RLS policies or run migrations. All database security changes require human approval.

**Post-Incident:**
- Full RLS audit of all 248+ tables
- Document which tenants were affected
- If PHI crossed tenants, invoke breach process (3.1)
- Add automated RLS verification to `guardian-agent` checks

---

### 3.3 P2: FHIR Sync Conflict (EHR Data Mismatch)

**Detection:**
- `fhir_sync_conflicts` table has new unresolved entries
- `fhir_sync_logs` shows `conflict` status
- My Health Hub (`/my-health`) displays stale or contradictory data
- `enhanced-fhir-export` or `fhir-r4` edge function logs show version conflicts

**Severity & SLA:** P2 — 1 hour response. Patient data may be stale but not lost.

**Immediate Actions:**

1. Check conflict count and scope:
   ```sql
   SELECT resource_type, count(*), max(created_at)
   FROM fhir_sync_conflicts
   WHERE resolved = false
   GROUP BY resource_type;
   ```
2. Determine if conflicts affect active patient care (check against `encounters` with `status = 'in-progress'`)

**Investigation Steps:**

1. Review specific conflicts:
   ```sql
   SELECT * FROM fhir_sync_conflicts
   WHERE resolved = false
   ORDER BY created_at DESC LIMIT 20;
   ```
2. Check EHR connection status:
   ```sql
   SELECT * FROM fhir_connections
   WHERE is_active = true;
   ```
3. Check `fhir_resource_sync` for last successful sync:
   ```sql
   SELECT resource_type, max(last_synced_at), count(*)
   FROM fhir_resource_sync
   GROUP BY resource_type;
   ```

**Resolution Steps:**

1. For version conflicts: the EHR is the source of truth. Accept remote version:
   ```sql
   UPDATE fhir_sync_conflicts
   SET resolved = true, resolution = 'accepted_remote'
   WHERE id IN (<conflict-ids>);
   ```
2. Re-trigger sync for affected resources:
   ```sql
   UPDATE fhir_resource_sync
   SET needs_sync = true
   WHERE resource_type = '<affected-type>';
   ```
3. If connection issue: check `fhir_token_lifecycle` for expired tokens

**AI Authority:** Guardian Agent may log conflicts. `ai-fhir-semantic-mapper` may assist with mapping resolution. Neither may overwrite patient clinical data without clinician review.

**Post-Incident:**
- Document which patient records were affected
- Verify My Health Hub shows correct data after resolution
- Review sync frequency settings

---

### 3.4 P3: Data Retention Policy Violation

**Detection:**
- `data_retention_policies` shows overdue purge jobs
- `consent_expiration_alerts` has unaddressed expired consents
- `gdpr_deletion_requests` has pending requests past SLA
- Audit review finds data retained beyond policy period

**Severity & SLA:** P3 — Next business day. Compliance risk but not immediate safety issue.

**Immediate Actions:**

1. Review pending retention actions:
   ```sql
   SELECT * FROM data_retention_policies
   WHERE next_purge_date < now()
   AND is_active = true;
   ```
2. Check pending deletion requests:
   ```sql
   SELECT * FROM gdpr_deletion_requests
   WHERE status = 'pending'
   ORDER BY requested_at ASC;
   ```

**Investigation Steps:**

1. Determine why purge jobs did not run (cron failure, edge function error)
2. Check `data_deletion_log` for last successful purge
3. Verify `consent_expiration_alerts` are being processed

**Resolution Steps:**

1. Execute overdue purges manually (with Akima approval)
2. Process pending deletion requests
3. Log all actions in `data_deletion_log`
4. Fix the cron/automation that missed the scheduled purge

**AI Authority:** Guardian Agent may alert on overdue retention actions. It may NOT delete patient data. All data deletion requires Akima (CCO) approval.

**Post-Incident:**
- Update retention automation to prevent recurrence
- Document in compliance log
- Akima reviews for regulatory reporting requirements

---

## Category 4: Security Incidents

### 4.1 P1: Unauthorized Access to Admin Functions

**Detection:**
- `admin_audit_log` shows admin actions by non-admin user
- `login_attempts` shows successful login with elevated privileges from unknown source
- `guardian-agent` `SecurityAlert` with `severity: 'critical'` and `category: 'unauthorized_access'`
- `securityAutomationService.ts` triggers `AutomatedResponse` of type `lockout`

**Severity & SLA:** P1 — 15 minute response. Potential full system compromise.

**Immediate Actions (first 5 minutes):**

1. **Lock the compromised account immediately:**
   ```sql
   INSERT INTO account_lockouts (user_id, locked_at, reason, locked_by)
   VALUES ('<user-id>', now(), 'Unauthorized admin access detected', 'incident-response');
   ```
2. Revoke all active sessions for the user:
   ```sql
   -- Via Supabase Auth admin API
   SELECT auth.admin_delete_user_sessions('<user-id>');
   ```
3. Notify Maria and Akima immediately
4. Check if admin PIN was compromised:
   ```sql
   SELECT * FROM admin_audit_log
   WHERE user_id = '<user-id>'
   AND created_at > now() - interval '24 hours'
   ORDER BY created_at DESC;
   ```

**Investigation Steps:**

1. Review what the unauthorized user accessed:
   ```sql
   SELECT * FROM admin_audit_log
   WHERE user_id = '<user-id>'
   ORDER BY created_at DESC LIMIT 50;
   ```
2. Check `phi_access_logs` for PHI exposure:
   ```sql
   SELECT * FROM phi_access_logs
   WHERE user_id = '<user-id>'
   AND accessed_at > now() - interval '24 hours';
   ```
3. Review `login_attempts` for the attack vector:
   ```sql
   SELECT * FROM login_attempts
   WHERE user_id = '<user-id>'
   OR ip_address = '<suspicious-ip>'
   ORDER BY attempted_at DESC LIMIT 50;
   ```
4. Check `user_roles` for unauthorized role escalation:
   ```sql
   SELECT * FROM user_roles
   WHERE user_id = '<user-id>';
   ```
5. Check `envision-login`, `envision-totp-verify`, and `verify-admin-pin` logs for bypass

**Resolution Steps:**

1. Remove unauthorized role grants:
   ```sql
   DELETE FROM user_roles
   WHERE user_id = '<user-id>'
   AND role IN ('super_admin', 'admin')
   AND granted_at > '<suspicious-timestamp>';
   ```
2. Force password reset for affected account
3. If TOTP was compromised: regenerate TOTP secret via `admin-totp-setup`
4. Review and revoke any SMART on FHIR tokens issued during compromise
5. If PHI was accessed: invoke breach process (3.1)

**AI Authority:** `securityAutomationService.ts` may automatically lock accounts and revoke tokens per `DEFAULT_SECURITY_THRESHOLDS`. Guardian Agent may log and alert. Neither may grant roles, modify user data, or make breach notification decisions.

**Post-Incident:**
- Full access audit for the compromised period
- Review all admin access paths for similar vulnerabilities
- Akima reviews for HIPAA breach implications
- Update `securityAutomationService.ts` thresholds if needed

---

### 4.2 P1: JWT Signing Key Compromise Suspected

**Detection:**
- Tokens appearing with valid signatures but for users that should not exist
- Unusual `sub` claims in JWTs that do not match `auth.users`
- Supabase security advisory about key exposure
- `password_history` or `login_attempts` show impossible patterns

**Severity & SLA:** P1 — 15 minute response. If confirmed, all tokens in circulation are untrustworthy.

**Immediate Actions (first 5 minutes):**

1. Notify Maria and Akima immediately — this is the highest severity security event
2. Do NOT immediately revoke the key (causes all users to be signed out — see timing below)
3. Confirm the suspicion by checking for impossible tokens:
   ```sql
   -- Look for sessions with user IDs not in auth.users
   SELECT s.user_id
   FROM auth.sessions s
   LEFT JOIN auth.users u ON s.user_id = u.id
   WHERE u.id IS NULL;
   ```

**Investigation Steps:**

1. Determine if the JWT secret or signing key was exposed:
   - Check git history for accidental commits of secrets
   - Check edge function logs for key logging
   - Check if Supabase issued a security advisory
2. Determine scope: which key type was compromised?
   - Legacy JWT secret (HS256) — affects `anon` and `service_role` keys
   - Asymmetric signing key (ES256/RS256) — affects user JWTs only
3. Check `audit_logs` for actions taken with suspicious tokens

**Resolution Steps (follow exact order — see CLAUDE.md JWT section):**

1. Create a new standby signing key (asymmetric ES256 preferred):
   ```bash
   supabase gen signing-key --algorithm ES256
   ```
2. Import the new key to Supabase and wait 20 minutes for JWKS cache propagation
3. Rotate keys (new key becomes active)
4. Wait `access_token_expiry + 15 minutes` before revoking old key
5. Revoke the compromised key
6. If legacy JWT secret was compromised: this also invalidates `anon` and `service_role` keys — coordinate with Supabase support

**AI Authority:** No AI agent may rotate or revoke JWT signing keys. This is a human-only operation requiring Maria's direct action in Supabase Dashboard.

**Post-Incident:**
- Full audit of all actions during the compromise window
- Rotate all related secrets (API keys, service role keys)
- Review how the key was exposed and prevent recurrence
- Akima reviews for HIPAA breach implications
- Document in `breachNotificationService` if PHI was accessed with forged tokens

---

### 4.3 P2: Failed Login Brute Force Detected

**Detection:**
- `guardian-agent` `SecurityAlert` with `category: 'brute_force'`
- `securityAutomationService.ts` `failed_logins_threshold` exceeded (default: 5 in 15 minutes)
- `login_attempts` shows rapid failures from single IP or for single user
- `login-security` edge function logs show elevated failure rate

**Severity & SLA:** P2 — 1 hour response. Account may be targeted but not yet compromised.

**Immediate Actions:**

1. Check if auto-lockout was triggered:
   ```sql
   SELECT * FROM account_lockouts
   WHERE locked_at > now() - interval '1 hour'
   ORDER BY locked_at DESC;
   ```
2. Review the attack pattern:
   ```sql
   SELECT
     COALESCE(ip_address, 'unknown') as ip,
     count(*) as attempts,
     count(DISTINCT user_id) as targeted_users,
     min(attempted_at) as first_attempt,
     max(attempted_at) as last_attempt
   FROM login_attempts
   WHERE success = false
   AND attempted_at > now() - interval '1 hour'
   GROUP BY ip_address
   ORDER BY attempts DESC LIMIT 10;
   ```

**Investigation Steps:**

1. Determine if single-target or credential stuffing (multiple accounts):
   ```sql
   SELECT user_id, count(*) as failures
   FROM login_attempts
   WHERE success = false
   AND attempted_at > now() - interval '6 hours'
   GROUP BY user_id
   HAVING count(*) > 3
   ORDER BY failures DESC;
   ```
2. Check if any attempts succeeded after the failures (account may be compromised)
3. Review `hcaptcha` verification logs — was bot protection bypassed?

**Resolution Steps:**

| Scenario | Action |
|----------|--------|
| Single IP attacking one account | `securityAutomationService` auto-locks; verify lockout is active |
| Credential stuffing (many accounts) | Block IP at edge (Supabase Dashboard > Network); notify all targeted users |
| Successful login after failures | Treat as potential compromise (see 4.1) |
| Bot bypass (hCaptcha failing) | Check `verify-hcaptcha` edge function; rotate site key if needed |

**AI Authority:** `securityAutomationService.ts` may auto-lock accounts per configured thresholds. Guardian Agent may log alerts. Neither may block IPs at the network level or modify auth configuration.

**Post-Incident:**
- Review if rate limiting thresholds need adjustment
- Check `password_history` for targeted accounts (were they using weak passwords?)
- Consider adding IP-based rate limiting if not already active

---

### 4.4 P2: CORS Origin Violation Spike

**Detection:**
- Edge function logs show repeated CORS rejection (403 responses)
- `cors.ts` rejecting requests from origins not in `ALLOWED_ORIGINS`
- Sudden spike in preflight (OPTIONS) requests from unknown domains
- Guardian Agent alerts on unusual request patterns

**Severity & SLA:** P2 — 1 hour response. May indicate clickjacking attempt or misconfigured tenant.

**Immediate Actions:**

1. Identify the rejected origins from edge function logs
2. Determine if the origin is a legitimate tenant domain that was not added to `ALLOWED_ORIGINS`
3. If the origin is unknown: this may be an attack — do NOT add it

**Investigation Steps:**

1. Check current allowed origins:
   ```bash
   # In Supabase secrets
   npx supabase secrets list --project-ref xkybsjnvuohpqpbkikyn | grep ALLOWED_ORIGINS
   ```
2. Review the rejected origin against known tenant domains in `tenants` table:
   ```sql
   SELECT id, name, domain FROM tenants WHERE is_active = true;
   ```
3. Check if the spike correlates with a new tenant onboarding (missing domain config)
4. If unknown origin: check if it is an iframe embed attempt (clickjacking)

**Resolution Steps:**

| Cause | Fix |
|-------|-----|
| New tenant domain not added | Add to `ALLOWED_ORIGINS`: `npx supabase secrets set ALLOWED_ORIGINS="existing,new-domain"` then redeploy functions |
| Clickjacking attempt | No action needed — CORS is correctly blocking. Log the origin for security review. |
| Misconfigured client | Fix the client's origin configuration |

**AI Authority:** Guardian Agent may log alerts. No AI agent may modify `ALLOWED_ORIGINS` or deploy CORS changes. This requires Maria's approval (per CLAUDE.md: no CORS/CSP wildcards).

**Post-Incident:**
- Document the incident origin and resolution
- If attack: review CSP `frame-ancestors` policy is correctly set to `'none'` or explicit domains
- Verify no `WHITE_LABEL_MODE=true` was enabled

---

## Category 5: AI Repair Failures

### 5.1 P2: Guardian Agent Made Unauthorized Architectural Change

**Detection:**
- `guardian-agent` or `guardian-agent-api` logs show a repair action beyond its authority
- Code changes committed that bypass governance boundaries (see `.claude/rules/governance-boundaries.md`)
- `guardianApprovalService.ts` shows an approval that was not human-authorized
- Guardian repair modified clinical data, RLS policies, or infrastructure configuration

**Severity & SLA:** P2 — 1 hour response. Escalate to P1 if clinical data or security was affected.

**Immediate Actions:**

1. Identify what the Guardian Agent changed:
   ```sql
   SELECT * FROM audit_logs
   WHERE event_type LIKE 'GUARDIAN_%'
   AND created_at > now() - interval '24 hours'
   ORDER BY created_at DESC;
   ```
2. Assess if the change crossed AI Authority boundaries (see global scope table at top)
3. If the change affected clinical data or security: escalate to P1

**Investigation Steps:**

1. Review the Guardian Agent's repair log:
   ```sql
   SELECT * FROM security_alerts
   WHERE category LIKE 'guardian%'
   AND created_at > now() - interval '24 hours'
   ORDER BY created_at DESC;
   ```
2. Check if `guardianApprovalService.ts` was bypassed or had a logic error
3. Review `guardianFlowEngine.ts` for the decision path that led to the unauthorized action
4. Check `src/services/guardian-agent/` for recent code changes:
   ```bash
   git log --oneline -10 -- src/services/guardian-agent/
   ```

**Resolution Steps:**

1. Revert the unauthorized change:
   ```bash
   git revert <commit-hash>  # If it was a code change
   ```
   ```sql
   -- If it was a data change, restore from backup or audit trail
   ```
2. Fix the authority boundary in `guardianFlowEngine.ts` or `guardianApprovalService.ts`
3. Add the specific scenario to the Guardian Agent's deny-list
4. Test that the boundary is now enforced

**AI Authority:** This is an incident about AI exceeding its authority. Resolution requires human review. No AI agent may self-modify its own authority boundaries.

**Post-Incident:**
- Document the unauthorized action in detail
- Update Guardian Agent authority rules
- Review all recent Guardian Agent actions for similar boundary violations
- Consider adding a second-agent verification for high-impact repairs

---

### 5.2 P2: AI Repair Introduced Regression (Tests Failing)

**Detection:**
- `npm test` shows failures after an AI-driven repair
- CI/CD pipeline fails on a commit generated by AI tooling
- `health-monitor` detects degraded functionality after a repair
- Edge function that was "fixed" now fails differently

**Severity & SLA:** P2 — 1 hour response. Feature regression, not data loss.

**Immediate Actions:**

1. Identify the failing tests:
   ```bash
   npm test 2>&1 | tail -30
   ```
2. Identify the commit that introduced the regression:
   ```bash
   git log --oneline -5
   ```
3. Revert the bad commit if possible:
   ```bash
   git revert <commit-hash>
   ```

**Investigation Steps:**

1. Run typecheck to see if types are broken:
   ```bash
   npm run typecheck 2>&1 | head -30
   ```
2. Run lint to check for rule violations:
   ```bash
   npm run lint 2>&1 | head -30
   ```
3. Determine if the AI repair violated CLAUDE.md rules:
   - Did it introduce `any` types?
   - Did it delete tests instead of fixing them?
   - Did it use `console.log` instead of `auditLogger`?
   - Did it exceed 600 lines in any file?

**Resolution Steps:**

1. Revert the regression commit
2. Re-run the full verification checkpoint:
   ```bash
   npm run typecheck && npm run lint && npm test
   ```
3. Apply the original fix correctly, following CLAUDE.md rules
4. Verify all 10,893+ tests pass before committing

**AI Authority:** AI agents may attempt repairs but MUST run the verification checkpoint (`npm run typecheck && npm run lint && npm test`) before considering work done. If 2+ repair attempts fail, the AI MUST stop and escalate to Maria (STOP AND ASK protocol).

**Post-Incident:**
- Document which CLAUDE.md rules the AI repair violated
- Review if the AI agent had access to CLAUDE.md during the repair
- Update sub-agent instructions if governance rules were not enforced

---

### 5.3 P3: AI Cost Spike (Runaway Token Usage)

**Detection:**
- `mcp_cost_metrics` shows daily cost exceeding 2x normal baseline
- `claude_usage_logs` shows a single skill consuming abnormal token volume
- `/cost-check` skill reports budget alert
- Anthropic billing dashboard shows unexpected charges

**Severity & SLA:** P3 — Next business day. Financial impact, not safety or data issue.

**Immediate Actions:**

1. Identify the source of the spike:
   ```sql
   SELECT
     skill_key,
     count(*) as calls,
     sum(input_tokens) as input_tokens,
     sum(output_tokens) as output_tokens,
     sum(estimated_cost_usd) as total_cost
   FROM claude_usage_logs
   WHERE created_at > now() - interval '24 hours'
   GROUP BY skill_key
   ORDER BY total_cost DESC LIMIT 10;
   ```
2. If a single skill is responsible, check if it is in a retry loop
3. Disable the runaway skill if cost is accelerating:
   ```sql
   UPDATE ai_skills SET is_active = false
   WHERE skill_key = '<runaway-skill>';
   ```

**Investigation Steps:**

1. Check for retry loops (same patient/input repeated):
   ```sql
   SELECT patient_id, count(*) as calls
   FROM claude_usage_logs
   WHERE skill_key = '<runaway-skill>'
   AND created_at > now() - interval '24 hours'
   GROUP BY patient_id
   HAVING count(*) > 10
   ORDER BY calls DESC;
   ```
2. Check if `modelFallback.ts` is ping-ponging between providers (each attempt costs tokens)
3. Review `ai_prompt_versions` — did a prompt change increase token usage?
4. Check `mcp_cost_metrics` for MCP server costs:
   ```sql
   SELECT server_name, sum(total_cost) as cost
   FROM mcp_cost_metrics
   WHERE recorded_at > now() - interval '24 hours'
   GROUP BY server_name
   ORDER BY cost DESC;
   ```

**Resolution Steps:**

| Cause | Fix |
|-------|-----|
| Retry loop | Fix the error causing retries; add circuit breaker |
| Prompt too large | Optimize prompt in `ai_prompt_versions`; reduce context window |
| Unnecessary calls | Add caching layer or batch processing |
| Model too expensive | Switch to Haiku for appropriate skills (check `ai_skills.model`) |

**AI Authority:** Guardian Agent may flag cost anomalies and disable non-critical skills. It may NOT change billing configuration or model assignments without Maria's approval.

**Post-Incident:**
- Run `/cost-check` to get full cost analysis
- Review all skill model assignments — are expensive models being used for simple tasks?
- Set up cost alerting thresholds if not already configured
- Document the normal daily baseline for future comparison

---

## Post-Incident Template

Use this template for all post-incident documentation. Store in `audit_logs` with `event_type = 'INCIDENT_REPORT'`.

```
## Incident Report: [TITLE]

**Date:** YYYY-MM-DD HH:MM UTC
**Severity:** P1/P2/P3
**Duration:** X hours Y minutes
**Category:** [Infrastructure/Clinical AI/Data Integrity/Security/AI Repair]

### Timeline
- HH:MM — Detection: [how it was found]
- HH:MM — Response: [first action taken]
- HH:MM — Diagnosis: [root cause identified]
- HH:MM — Resolution: [fix applied]
- HH:MM — Verification: [confirmed resolved]

### Impact
- Patients affected: [count or "none"]
- PHI exposed: [yes/no — if yes, breach process invoked]
- Tenants affected: [list or "all"]
- Services degraded: [list]

### Root Cause
[One paragraph describing what went wrong and why]

### Resolution
[What was done to fix it]

### Prevention
[What changes will prevent recurrence]
- [ ] Action item 1 (owner, deadline)
- [ ] Action item 2 (owner, deadline)

### Reviewed By
- Maria: [date]
- Akima: [date, if clinical/compliance relevant]
```

---

## Quick Reference: Key File Paths

| Purpose | Path |
|---------|------|
| Guardian Agent (edge) | `supabase/functions/guardian-agent/index.ts` |
| Guardian Agent API | `supabase/functions/guardian-agent-api/index.ts` |
| Health Monitor | `supabase/functions/health-monitor/index.ts` |
| System Status | `supabase/functions/system-status/index.ts` |
| Breach Notification Service | `src/services/breachNotificationService.ts` |
| Security Automation Service | `src/services/securityAutomationService.ts` |
| Guardian Agent Client | `src/services/guardianAgentClient.ts` |
| Guardian Approval Service | `src/services/guardianApprovalService.ts` |
| Guardian Flow Engine | `src/services/guardianFlowEngine.ts` |
| Clinical Output Validator | `supabase/functions/_shared/clinicalOutputValidator.ts` |
| Prompt Injection Guard | `supabase/functions/_shared/promptInjectionGuard.ts` |
| Model Fallback Service | `supabase/functions/_shared/modelFallback.ts` |
| MCP Rate Limiter | `supabase/functions/_shared/mcpRateLimiter.ts` |
| MCP Auth Gate | `supabase/functions/_shared/mcpAuthGate.ts` |
| CORS Module | `supabase/functions/_shared/cors.ts` |
| Environment Variables | `supabase/functions/_shared/env.ts` |
| Audit Logger (edge) | `supabase/functions/_shared/auditLogger.ts` |
| Audit Logger (app) | `src/services/auditLogger.ts` |
| Governance Boundaries | `.claude/rules/governance-boundaries.md` |

## Quick Reference: Key Database Tables

| Purpose | Table |
|---------|-------|
| Audit trail | `audit_logs` |
| Admin audit | `admin_audit_log` |
| PHI access tracking | `phi_access_logs` |
| Security alerts | `security_alerts` |
| Login attempts | `login_attempts` |
| Account lockouts | `account_lockouts` |
| RLS policy changes | `rls_policy_audit` |
| AI skill registry | `ai_skills` |
| AI transparency | `ai_transparency_log` |
| AI accuracy | `ai_accuracy_metrics` |
| AI confidence | `ai_confidence_scores` |
| AI prompt versions | `ai_prompt_versions` |
| Claude usage | `claude_usage_logs` |
| MCP costs | `mcp_cost_metrics` |
| Breach incidents | (managed via `breachNotificationService`) |
| Data retention | `data_retention_policies` |
| GDPR requests | `gdpr_deletion_requests` |
| Deletion log | `data_deletion_log` |
| FHIR sync | `fhir_sync_logs`, `fhir_sync_conflicts` |
| Readmission predictions | `readmission_risk_predictions` |
