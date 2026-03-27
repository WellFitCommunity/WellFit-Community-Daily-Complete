# /audit-check — Audit Logging Compliance Check

Verify that all production code uses `auditLogger` instead of `console.log`, and that critical operations have proper audit trails. CLAUDE.md Rule #3: "No console.log — use auditLogger for all logging."

## Steps

### Step 1: Console Statement Violations

```
Grep for console\.(log|error|warn|info|debug) in src/ — exclude __tests__/, *.test.ts(x), *.test.js(x), setupTests.ts
```

**Baseline: 0 violations in production code.**

Report file:line for each violation.

### Step 2: Edge Function Console Violations

```
Grep for console\.(log|error|warn|info|debug) in supabase/functions/ — exclude __tests__/, *.test.ts
```

Edge functions should use the shared `createLogger()` or `EdgeFunctionLogger`, not raw console.

### Step 3: Missing Audit Logger in Services

```
Grep for files in src/services/ that do NOT import auditLogger
```

Cross-reference with files that have `catch` blocks — any catch without an auditLogger call is a silent error.

### Step 4: Database Audit Log Health

```sql
SELECT
  date_trunc('day', created_at) as day,
  count(*) as entries,
  count(DISTINCT action_type) as unique_actions
FROM audit_logs
WHERE created_at > now() - interval '7 days'
GROUP BY day
ORDER BY day DESC;
```

Report: daily audit volume and action variety. Flag if any day has 0 entries (logging may be broken).

### Step 5: PHI Access Log Health

```sql
SELECT
  date_trunc('day', accessed_at) as day,
  count(*) as accesses,
  count(DISTINCT user_id) as unique_users
FROM phi_access_logs
WHERE accessed_at > now() - interval '7 days'
GROUP BY day
ORDER BY day DESC;
```

Report: PHI access logging volume. Required for HIPAA compliance.

### Step 6: Report

```
Audit Logging Compliance
────────────────────────
[1] Console violations (src/):        X found
[2] Console violations (edge fn):     X found
[3] Services missing auditLogger:     X of Y
[4] Audit log volume (7d):            X entries, Y actions/day avg
[5] PHI access log volume (7d):       X entries
[6] Overall: ✅ COMPLIANT / ❌ X VIOLATIONS FOUND
```

If violations found, list each with file:line and suggest the fix (replace `console.X` with `auditLogger.X`).
