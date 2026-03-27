# /god-check — God File Detection (600-Line Limit)

Scan the codebase for files exceeding the 600-line maximum. CLAUDE.md Rule #12: "No god files — 600 line max per file, decompose don't degrade."

## Steps

### Step 1: Scan Source Files

```bash
find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -30
```

Flag any file over 600 lines.

### Step 2: Scan Edge Functions

```bash
find supabase/functions/ -name "*.ts" -not -path "*__tests__*" -not -path "*node_modules*" | xargs wc -l | sort -rn | head -20
```

Flag any file over 600 lines.

### Step 3: Categorize Violations

For each file over 600 lines:
- **Critical (800+):** Must decompose immediately
- **Warning (600-799):** Decompose before next feature addition
- **Approaching (500-599):** Watch — do not add code without checking

### Step 4: Report

```
God File Check (600-line limit)
───────────────────────────────
src/ files scanned:    X
edge function files:   X

❌ CRITICAL (800+ lines):
  [file:lines] — suggested decomposition

⚠️ WARNING (600-799 lines):
  [file:lines]

👀 APPROACHING (500-599 lines):
  [file:lines]

✅ All clear: X files, 0 violations
```

### Step 5: Suggest Decomposition

For each critical violation, suggest a decomposition strategy:
- Extract by responsibility (types, handlers, utils)
- Barrel re-export pattern (`component-name/index.ts`)
- Verify with `bash scripts/typecheck-changed.sh && npm test` after decomposition
