# /clinical-validate — Clinical Validation Hooks Health Check

Verify that AI-generated clinical codes (ICD-10, CPT, DRG, HCPCS) are being validated against government reference data. Check rejection rates, stale reference data, and validation coverage.

## Steps

### Step 1: Validation Feedback Summary

```sql
SELECT
  source,
  count(*) as total,
  count(*) FILTER (WHERE status = 'rejected') as rejected,
  count(*) FILTER (WHERE status = 'flagged') as flagged,
  count(*) FILTER (WHERE status = 'valid') as valid
FROM validation_feedback
WHERE created_at > now() - interval '7 days'
GROUP BY source
ORDER BY total DESC;
```

Report: total validations, rejection rate per AI source.

### Step 2: Reference Data Freshness

```sql
SELECT
  data_source,
  last_updated,
  record_count,
  CASE
    WHEN last_updated < now() - interval '90 days' THEN 'STALE'
    WHEN last_updated < now() - interval '30 days' THEN 'WARNING'
    ELSE 'FRESH'
  END as freshness
FROM reference_data_versions
ORDER BY last_updated ASC;
```

**Alert:** Any STALE reference data means AI validations may miss invalid codes.

### Step 3: Recent Rejected Codes

```sql
SELECT source, code_type, code_value, rejection_reason, created_at
FROM validation_feedback
WHERE status = 'rejected'
ORDER BY created_at DESC
LIMIT 10;
```

Report the 10 most recent rejections. Flag any patterns (same code rejected repeatedly = possible AI hallucination pattern).

### Step 4: Validation Coverage

Check that all active AI edge functions have validation hooks wired:

```
Grep for "validateClinicalOutput" in supabase/functions/ai-*/index.ts and supabase/functions/mcp-medical-coding-server/
```

Report: X of Y AI functions have validation hooks. List any missing.

### Step 5: Report

```
Clinical Validation Health
──────────────────────────
[1] Validations (7d):   X total, X rejected (Y%), X flagged
[2] Reference Data:     X sources — Y fresh, Z stale
[3] Recent Rejections:  Top patterns: [list]
[4] Hook Coverage:      X/Y AI functions wired
[5] Overall:            ✅ HEALTHY / ⚠️ ATTENTION NEEDED / ❌ ACTION REQUIRED
```
