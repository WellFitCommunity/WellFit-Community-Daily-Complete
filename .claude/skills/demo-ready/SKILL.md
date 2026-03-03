# /demo-ready — Hospital Pilot Readiness Check

Validate that the Envision ATLUS I.H.I.S. platform is ready for a hospital pilot demonstration. Runs 12 checks across code quality, infrastructure, clinical AI, interoperability, and security.

## Steps

### Step 1: Code Quality Gate

```bash
npm run typecheck && npm run lint && npm test
```

**Report:**
```
[1/12] Code Quality
  typecheck: X errors
  lint: X errors, X warnings
  tests: X passed, X failed (Y suites)
```

**Baseline (must meet or exceed):**
- 0 typecheck errors
- 0 lint errors, 0 warnings
- 10,600+ tests passing, 0 failed

If ANY fail, stop and fix before continuing.

### Step 2: Environment Variables

Verify all required Vite env vars are configured:

```bash
# Check .env or .env.local for required vars
```

**Required (frontend):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_HCAPTCHA_SITE_KEY`

**Required (Supabase secrets):**
- `SB_ANON_KEY` or `SUPABASE_ANON_KEY` (JWT format)
- `SB_SECRET_KEY` or `SB_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `ALLOWED_ORIGINS` (explicit domains, no wildcards)

Report missing vars as blockers.

### Step 3: Database Schema Integrity

Verify schema is current:

```bash
npx supabase migration list
```

**Check:**
- No unapplied migrations
- 248+ tables in public schema
- RLS enabled on all tenant-scoped tables

Report unapplied migration count.

### Step 4: Edge Function Deployment

Verify all edge functions are deployed and healthy:

```bash
npx supabase functions list
```

**Baseline:** 137+ functions deployed.

**Spot-check critical functions (health endpoint or list response):**
- `login`, `envision-login` (auth)
- `create-checkin` (community)
- `ai-readmission-predictor` (clinical AI)
- `ai-soap-note-generator` (documentation)
- `fhir-r4` (interoperability)
- `smart-authorize`, `smart-token` (SMART on FHIR)

Report any missing or errored functions.

### Step 5: MCP Server Health

Verify all 11 MCP servers respond to ping:

| # | Server | Tool Count |
|---|--------|-----------|
| 1 | mcp-claude-server | 3 |
| 2 | mcp-fhir-server | 14 |
| 3 | mcp-hl7-x12-server | 9 |
| 4 | mcp-prior-auth-server | 11 |
| 5 | mcp-clearinghouse-server | 10 |
| 6 | mcp-cms-coverage-server | 8 |
| 7 | mcp-npi-registry-server | 9 |
| 8 | mcp-postgres-server | 5 |
| 9 | mcp-medical-codes-server | 7 |
| 10 | mcp-edge-functions-server | 5 |
| 11 | mcp-medical-coding-server | 11 |

**Total: 96 tools across 11 servers.**

Check that MCP server files exist and export the expected tool count:

```
Use Grep to search for `tools/list` handlers in supabase/functions/mcp-*/index.ts
```

Report any server with missing files or incorrect tool registration.

### Step 6: AI Skills Validation

Verify AI skill registry is complete and models are pinned:

```sql
SELECT skill_key, model, is_active, patient_description IS NOT NULL as has_transparency
FROM ai_skills
ORDER BY skill_number;
```

**Check:**
- All active skills have pinned model versions (not `latest`)
- All skills have `patient_description` (HTI-2 transparency)
- 26+ edge function AI skills registered
- 19+ service-layer AI skills registered

Use Grep to scan for unversioned model references:

```
Search src/services/ and supabase/functions/ for model strings without version dates
```

Report any skill with `model = 'latest'` or missing `patient_description`.

### Step 7: FHIR Interoperability

Verify FHIR R4 infrastructure is intact:

**Check files exist:**
- `supabase/functions/fhir-r4/index.ts`
- `supabase/functions/fhir-metadata/index.ts`
- `supabase/functions/smart-authorize/index.ts`
- `supabase/functions/smart-token/index.ts`
- `supabase/functions/ccda-export/index.ts`

**Check FHIR tables:**
- `fhir_patients`, `fhir_practitioners`, `fhir_conditions`
- `fhir_medication_requests`, `fhir_observations`
- `fhir_connections`, `fhir_resource_sync`

**Check My Health Hub routes exist in App.tsx:**
- `/my-health`, `/health-observations`, `/immunizations`
- `/care-plans`, `/allergies`, `/conditions`
- `/medicine-cabinet`, `/health-records-download`

Report any missing FHIR components.

### Step 8: Clinical AI Guardrails

Verify Compass Riley grounding and safety:

**Check files exist:**
- `supabase/functions/_shared/compass-riley/` (7+ modules)
- `supabase/functions/_shared/cultural-competency/` (MCP tools)

**Check guardrails in code:**
- Temperature 0.1 on clinical calls (Grep for `temperature:`)
- Grounding tags: `[STATED]`, `[INFERRED]`, `[GAP]`
- Confidence scoring logged to `ai_confidence_scores`
- Circuit breaker on Claude service (5-failure halt)

Report any clinical AI call with temperature > 0.3.

### Step 9: Security Posture

Run the core security checks (subset of `/security-scan`):

**CORS/CSP:**
- No wildcards in `ALLOWED_ORIGINS`
- No `frame-ancestors *` or `connect-src *`

**Secrets:**
- No hardcoded API keys in source (Grep for `sk-ant-`, `AKIA`, `BEGIN PRIVATE KEY`)
- No `console.log` in production code (Grep `src/` excluding test files)

**Auth:**
- Edge functions use `mcpAuthGate` or equivalent JWT verification
- No `getSession()` on server-side (must use `getClaims()` or `getUser()`)

Report any violations as blockers.

### Step 10: Tenant Isolation

Verify multi-tenant security:

- `get_current_tenant_id()` function exists in database
- RLS policies reference `tenant_id` on all tenant-scoped tables
- Edge functions derive tenant from JWT, not from request body

Use Grep to check for tenant_id bypass patterns.

### Step 11: Build & Bundle

```bash
npm run build
```

**Check:**
- Build succeeds with 0 errors
- Bundle size reasonable (report `dist/` total size)
- No `process.env.REACT_APP_*` references in built output

### Step 12: Demo Data Readiness

Verify demo/test data exists:

```sql
-- Check default test tenant
SELECT id, tenant_code, organization_name
FROM tenants WHERE tenant_code = 'WF-0001';

-- Check test patients exist
SELECT COUNT(*) FROM profiles WHERE tenant_id = '2b902657-6a20-4435-a78a-576f397517ca';

-- Check AI skills are active
SELECT COUNT(*) FROM ai_skills WHERE is_active = true;
```

## Output Format

```
HOSPITAL PILOT READINESS CHECK
===

[1/12]  Code Quality ........... PASS/FAIL
[2/12]  Environment Variables ... PASS/FAIL
[3/12]  Database Schema ........ PASS/FAIL
[4/12]  Edge Functions ......... PASS/FAIL (X/137 deployed)
[5/12]  MCP Servers ............ PASS/FAIL (X/11 healthy)
[6/12]  AI Skills .............. PASS/FAIL (X active, X pinned)
[7/12]  FHIR Interop ........... PASS/FAIL
[8/12]  Clinical AI Guardrails . PASS/FAIL
[9/12]  Security Posture ....... PASS/FAIL
[10/12] Tenant Isolation ....... PASS/FAIL
[11/12] Build & Bundle ......... PASS/FAIL (X MB)
[12/12] Demo Data .............. PASS/FAIL

---
RESULT: PILOT READY / NOT READY
Blockers: (list any FAIL items)
Warnings: (list any non-critical issues)
```

## Rules

- Run ALL 12 checks. Do not skip any.
- A single FAIL in steps 1, 9, or 10 (code quality, security, tenant isolation) blocks the entire check.
- Steps 4-8 can have warnings without blocking if the specific demo doesn't need that feature.
- Report exact counts — not "looks good."
- If the build fails, that's a blocker regardless of everything else.
- Do NOT fix issues during this skill — report them. Fixing is a separate task.
