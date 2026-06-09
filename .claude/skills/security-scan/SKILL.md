# /security-scan — HIPAA Security Compliance Scan

Automated scanning for HIPAA compliance violations, CORS/CSP security, MCP server auth, edge function hardening, and code hygiene. Run before commits, demos, and audits.

## Steps

### Step 1: PHI Logging Violations

Scan ALL source code for console statements that could leak PHI:

```
Grep for console\.(log|error|warn|info|debug) in src/ — exclude __tests__/ and *.test.ts(x)
```

**Violations:**
- Any `console.*` in `src/services/`, `src/components/`, `src/hooks/`, `src/contexts/`
- Exception: Test files are allowed to use console for debugging

Report file:line for each violation.

### Step 2: TypeScript `any` Type Regression

Scan for `any` type usage that bypasses type safety:

```
Grep for ": any" and "as any" in src/ — exclude __tests__/, *.test.ts(x), *.d.ts
```

**Current baseline: 0 `any` types in production code** (eliminated Jan 2026).

Report any new occurrences as regressions. Each one is a violation.

### Step 3: Database RLS Policy Coverage

Verify Row-Level Security is enabled on all tenant-scoped tables:

```sql
-- Count RLS-enabled tables
SELECT COUNT(*) FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;

-- Find tables WITHOUT RLS (potential gaps)
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT IN ('schema_migrations')
ORDER BY tablename;
```

**Baseline (live 2026-06-09, project `xkybsjnvuohpqpbkikyn`): 681 tables, 658 RLS-enabled (96.6%), 23 without RLS — all reference/system/metrics.** All tenant-scoped tables must have RLS. (Re-query live each run; the table count grows.)

Tables without RLS are acceptable ONLY if they are:
- Reference/lookup tables (code sets, static config) — e.g. `code_cpt`, `code_hcpcs`, `code_icd10`, `code_modifiers`, `cpt_code_reference`, `dea_schedule_reference`, `dental_cdt_codes`, `ref_*`, `disability_types`, `sdoh_domains`, `claim_flag_types`, `pdmp_state_config`, `encounter_valid_transitions`
- System tables — `schema_migrations`, `spatial_ref_sys`, `query_cache`, `connection_pool_metrics`
- ML/metrics tables with no tenant PHI — e.g. `sdoh_detection_accuracy`

Report any tenant-scoped table missing RLS as critical.

### Step 4: CORS/CSP Wildcard Scan

Scan for forbidden wildcard patterns:

```
Grep for: frame-ancestors \*, connect-src \*, Access-Control-Allow-Origin.*\*
Scan: src/, supabase/functions/, public/
```

Also check:
```
Grep for: WHITE_LABEL_MODE in supabase/functions/ and src/
```

**Any wildcard in CORS or CSP is a HIPAA violation** (164.312(e)(1) transmission security).

Report file:line for each wildcard found.

### Step 5: Hardcoded Secrets Scan

Scan for exposed credentials:

```
Grep for: sk-ant-, AKIA, BEGIN PRIVATE KEY, BEGIN RSA, postgres://, mysql://
Scan: entire repo — exclude node_modules/, .git/, dist/
```

Also check for Supabase keys accidentally committed:

```
Grep for: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 (JWT header prefix)
Scan: src/, supabase/functions/ — exclude *.test.*, __tests__/
```

Report any match as critical.

### Step 6: Edge Function Auth Gate

Verify all edge functions enforce authentication:

```
Grep for: mcpAuthGate|corsFromRequest|handleOptions|withCORS|requireUser|requireRole|getUser|getClaims|cors\(
Scan: supabase/functions/*/index.ts
```

> **Helper names vary — match all of them or you WILL get false positives.** The codebase uses at least three CORS/auth helper shapes: `corsFromRequest`/`handleOptions` (`_shared/cors.ts`), `withCORS`/`requireUser`/`requireRole` (`_shared/auth.ts`), and a lowercase `cors(origin, …)` helper. A grep for only `corsFromRequest|handleOptions` falsely flagged `send-appointment-reminder`, `sms-send-code`, `sms-verify-code`, and `validate-hcaptcha` on 2026-06-09 — all four are actually authed or intentionally public.

**Every edge function must either:**
1. Use `mcpAuthGate` (MCP servers), OR
2. Use a CORS+auth helper (`corsFromRequest`/`withCORS`/`cors`) + JWT verification (`getUser`/`getClaims`/`requireUser`), OR
3. Be explicitly public (login, register, health-monitor, pre-auth OTP/captcha flows)

**Known public functions (no JWT — public by design):**
- `login`, `register`, `envision-login`
- `health-monitor`, `system-status`
- `smart-configuration`, `fhir-metadata`
- `verify-hcaptcha`, `validate-hcaptcha`
- `sms-send-code`, `sms-verify-code` (pre-auth login/OTP — must still have scoped CORS + rate-limit + captcha; see SS-3)

Report any non-public function missing auth as critical. **Before flagging, open the function** — confirm it doesn't use one of the helper shapes above under a different name.

### Step 7: MCP Server Security

Verify all MCP servers (17 live as of 2026-06-09 — enumerate `supabase/functions/mcp-*`, do not hardcode the count) have proper security controls:

**For each server in `supabase/functions/mcp-*`:**

1. **Auth binding:** Uses `mcpAuthGate` and/or `createClient` with per-request JWT (not shared client)
   ```
   Grep for: mcpAuthGate|createClient in supabase/functions/mcp-*/index.ts
   ```

2. **Rate limiting:** Has rate limit configuration (often inside `mcpAuthGate`)
   ```
   Grep for: rateLimit|RATE_LIMIT|mcpAuthGate in supabase/functions/mcp-*/
   ```

3. **Input validation:** Has a validation schema
   ```
   Grep for: VALIDATION|inputSchema|validateInput|zod|z\. in supabase/functions/mcp-*/
   ```

4. **Tenant isolation:** Derives tenant_id from JWT, not from tool args
   ```
   Grep for: tenant_id|tenantId in supabase/functions/mcp-*/
   ```

> **Tenant isolation does NOT apply to public-reference servers.** Per `governance-boundaries.md` §S9, `mcp-npi-registry-server` (T1), `mcp-pubmed-server` (T1), `mcp-cms-coverage-server` (T2), and `mcp-medical-codes-server` (T2) serve only public, no-PHI reference data — absence of `tenant_id` in these is correct, not a finding. Servers that serve real member/patient data (e.g. `mcp-community-engagement-server`, `mcp-patient-context-server`) MUST scope by tenant.

Report any MCP server missing the controls that apply to its tier.

### Step 8: JWT Verification

Verify proper JWT handling:

```
Grep for: getSession\(\) in supabase/functions/ — this is INSECURE on server-side
```

**`getSession()` must NOT be used in edge functions.** Use `getClaims()` or `getUser()` instead.

Also verify JWKS endpoint usage:
```
Grep for: .well-known/jwks in supabase/functions/
```

Report any `getSession()` in edge functions as critical.

### Step 9: God File Check

Scan for files exceeding the 600-line limit:

```bash
# Production code only — exclude tests and generated files (the latter are exempt by design)
find src \( -name '*.ts' -o -name '*.tsx' \) | grep -vE '(__tests__|\.test\.|\.generated\.)' \
  | xargs wc -l 2>/dev/null | awk '$1>600 && $2!="total"' | sort -rn | head -40
```

**Baseline (live 2026-06-09): 152 production files over 600 lines.** This is NOT zero — the 600-line rule is baselined (`scripts/god-file-baseline.txt`) and enforced only against NEW god files, and `supabase/functions/` isn't scanned at all. Decomposition is tracked in **`docs/trackers/god-file-decomposition-tracker.md`** (Tier-1 top-10 done; this is steady incremental work, not a sprint).

Report the current count and the worst offenders. Exclude `*.generated.ts` (e.g. `database.generated.ts`, ~62k lines — generated, exempt) and test files (helpers, not production). A FAIL here is a tracked code-quality regression, not a compliance violation.

### Step 10: PHI in Frontend Check

Verify no PHI fields are exposed in client-side code:

```
Grep for: ssn|social_security|date_of_birth_raw|full_address
Scan: src/components/, src/hooks/ — exclude __tests__/
```

**Allowed patterns:**
- `date_of_birth` in a type definition (interface, not usage)
- Patient ID references (IDs are not PHI)
- Test fixture data with obviously fake values

Report any direct PHI field access in UI components.

### Step 11: Audit Logging Coverage

Verify audit logging is present in critical services:

```
Grep for: auditLogger in src/services/
```

**Services that MUST have audit logging:**
- PHI encryption/decryption
- Patient data access
- FHIR operations
- AI clinical decisions
- Authentication events
- Admin operations

Count services with auditLogger vs total services. Report coverage percentage **as informational only.**

> **The raw `auditLogger`-in-file percentage is misleading — do NOT report it as a compliance gap.** God-file decomposition has split services into many pure helper/type/constant sub-modules (`readmission/clinicalFactors.ts`, `fhir-integrator/types.ts`, `billing-decision-tree/utils.ts`) that have no PHI-touch path and whose *parent* service does the logging. On 2026-06-09 the blanket grep read 254/576 = 44%, which understates real coverage badly. For an accurate signal, use the `/audit-check` skill (PHI-touch-specific: which services that write/read a PHI table or call a clinical AI edge function lack logging on that path). That is tracked as **SS-2** in `docs/trackers/security-scan-findings-2026-06-09.md`.

## Output Format

```
HIPAA SECURITY COMPLIANCE SCAN
===

[1/11]  PHI Logging ............. PASS/FAIL (X violations)
[2/11]  any Type Regression ..... PASS/FAIL (X occurrences)
[3/11]  RLS Coverage ............ PASS/FAIL (X/Y tables with RLS)
[4/11]  CORS/CSP Wildcards ...... PASS/FAIL (X wildcards found)
[5/11]  Hardcoded Secrets ....... PASS/FAIL (X exposures)
[6/11]  Edge Function Auth ...... PASS/FAIL (X/Y functions secured)
[7/11]  MCP Server Security ..... PASS/FAIL (X/N servers compliant — N = live mcp-* count, 17 on 2026-06-09)
[8/11]  JWT Verification ........ PASS/FAIL
[9/11]  God Files (>600 lines) .. PASS/FAIL (X violations)
[10/11] PHI in Frontend ......... PASS/FAIL
[11/11] Audit Logging ........... PASS/FAIL (X% coverage)

---
RESULT: COMPLIANT / NON-COMPLIANT
Critical: (list any critical violations)
Warnings: (list any non-critical findings)

HIPAA References:
  164.312(a)(1) — Access Control (RLS, auth)
  164.312(a)(2)(iv) — Encryption
  164.312(b) — Audit Controls (logging)
  164.312(e)(1) — Transmission Security (CORS/CSP)
```

## Rules

- Run ALL 11 checks. Do not skip any.
- Steps 1, 3, 4, 5, 6, 8 are critical — any FAIL blocks compliance.
- Steps 2, 9 are code quality — FAIL is a regression, not a compliance violation.
- Prefer the Grep tool for all searches (better output formatting). If the Grep/Glob tools are not available in the session, fall back to bash `grep -rn` / `find` — the results are equivalent.
- Report exact file:line for every violation.
- Do NOT fix issues during this skill — report them. Fixing is a separate task.
- Cross-reference findings with HIPAA section numbers.
