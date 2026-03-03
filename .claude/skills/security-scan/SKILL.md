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

**Baseline: 248+ tables total.** All tenant-scoped tables must have RLS.

Tables without RLS are acceptable ONLY if they are:
- Reference/lookup tables (code sets, static config)
- System tables (schema_migrations, etc.)

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
Grep for: mcpAuthGate|corsFromRequest|handleOptions
Scan: supabase/functions/*/index.ts
```

**Every edge function must either:**
1. Use `mcpAuthGate` (MCP servers), OR
2. Use `corsFromRequest` + JWT verification (regular edge functions), OR
3. Be explicitly public (login, register, health-monitor)

**Known public functions (no auth required):**
- `login`, `register`, `envision-login`
- `health-monitor`, `system-status`
- `smart-configuration`, `fhir-metadata`
- `verify-hcaptcha`

Report any non-public function missing auth as critical.

### Step 7: MCP Server Security

Verify all 11 MCP servers have proper security controls:

**For each server in `supabase/functions/mcp-*`:**

1. **Auth binding:** Uses `createClient` with per-request JWT (not shared client)
   ```
   Grep for: createClient in supabase/functions/mcp-*/index.ts
   ```

2. **Rate limiting:** Has rate limit configuration
   ```
   Grep for: rateLimit|RATE_LIMIT in supabase/functions/mcp-*/
   ```

3. **Input validation:** Has VALIDATION schema
   ```
   Grep for: VALIDATION|inputSchema in supabase/functions/mcp-*/
   ```

4. **Tenant isolation:** Derives tenant_id from JWT, not from tool args
   ```
   Grep for: tenant_id.*payload|payload.*tenant in supabase/functions/mcp-*/
   ```

Report any MCP server missing these controls.

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
find src/ -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -rn | head -20
```

**Baseline: 0 god files** (all previously decomposed).

Report any file over 600 lines with its current line count.

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

Count services with auditLogger vs total services. Report coverage percentage.

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
[7/11]  MCP Server Security ..... PASS/FAIL (X/11 servers compliant)
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
- Use the Grep tool (not bash grep) for all searches — better output formatting.
- Report exact file:line for every violation.
- Do NOT fix issues during this skill — report them. Fixing is a separate task.
- Cross-reference findings with HIPAA section numbers.
