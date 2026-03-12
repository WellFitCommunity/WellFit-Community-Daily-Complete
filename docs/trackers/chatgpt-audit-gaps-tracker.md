# ChatGPT Audit Gaps Tracker

> **Source:** `docs/audits/CHATGPT_ARCHITECTURE_AUDIT_2026-03-12.md`
> **Created:** 2026-03-12
> **Purpose:** Close all actionable gaps identified across 3 ChatGPT audit passes

---

## Session 1 — Quick Wins (< 1 session)

### S1-1: Full-Text Search → GlobalSearchBar Wiring
**Gap:** GIN/tsvector indexes exist on `code_cpt`, `code_icd10`, `code_hcpcs`, `fhir_immunizations` but GlobalSearchBar doesn't query them.
**Fix:**
1. Add a `searchMedicalCodes()` function to `voiceSearchService.ts` that queries full-text indexes via Supabase RPC
2. Create PostgreSQL function `search_medical_codes(p_query TEXT)` that searches across CPT, ICD-10, HCPCS using `to_tsquery`
3. Wire into GlobalSearchBar as a new entity type (`medical_code`)
4. Add result routing (click a code → navigate to relevant coding panel)
5. Tests for the new search path

**Status:** DONE
**Estimated:** 2-3 hours

**Delivered:**
- Migration `20260312092826_search_medical_codes_function.sql` — PostgreSQL function searching CPT, ICD-10, HCPCS with full-text + ILIKE fallback
- `medical_code` entity type added to `EntityType` union, route map, icons, colors, labels
- `searchMedicalCodes()` function in `voiceSearchService.ts` — calls RPC, normalizes relevance to match scores
- `parseMedicalCodeCommand()` parser — detects "code 99213", "CPT knee replacement", "ICD diabetes", etc.
- GlobalSearchBar wired to dispatch `medical_code` searches
- Search examples updated ("code 99213", "CPT knee replacement")

---

### S1-2: Governance Scripts → GitHub Actions CI
**Gap:** `scripts/governance-check.sh` and `scripts/governance-drift-check.sh` exist but don't run automatically on push.
**Fix:**
1. Create `.github/workflows/governance-check.yml`
2. Trigger on push to `main` and on PRs
3. Run `bash scripts/governance-check.sh` — fail the build on violations
4. Run `bash scripts/governance-drift-check.sh` — report drift as warnings (non-blocking initially)
5. Add status badge to README or PROJECT_STATE

**Status:** DONE
**Estimated:** 1-2 hours

**Delivered:**
- Governance job added to `.github/workflows/ci-cd.yml` (Job 1b) — runs on every push/PR
- `governance-check.sh` runs as blocking step — violations fail the pipeline
- `governance-drift-check.sh` runs as non-blocking step — drift reported as warnings
- `ci-summary` job includes governance in `needs` array and reports status in summary table
- Chose to integrate into existing CI pipeline rather than separate workflow (fewer moving parts)

---

## Session 2 — AI Decision Audit Chain (1 session)

### S2-1: Create `ai_decision_chain` Migration
**Gap:** Spec exists at `docs/compliance/AI_DECISION_AUDIT_CHAIN.md` but table doesn't exist.
**Fix:**
1. Read the spec thoroughly — extract table schema
2. Create migration `supabase/migrations/YYYYMMDD_ai_decision_chain.sql`
3. Table: `ai_decision_chain` with columns: `id`, `chain_id`, `parent_decision_id`, `link_type` (trigger/context/decision/action/outcome/verification), `actor` (ai_skill_key, guardian, human), `model_version`, `input_summary`, `output_summary`, `confidence_score`, `tenant_id`, `patient_id`, `created_at`
4. Enable RLS with tenant isolation
5. Add indexes on `chain_id`, `tenant_id`, `patient_id`, `link_type`, `created_at`
6. Push migration: `npx supabase db push`

**Status:** DONE (migration created, awaiting `db push` approval)
**Estimated:** 2 hours

**Delivered:**
- Migration `20260312094244_ai_decision_chain.sql` — full table from spec with RLS, CHECK constraints, 8 indexes
- Follows spec exactly: trigger_type, decision_type, outcome enums; human_override + review fields; partial index on overrides

---

### S2-2: Decision Chain Service + TypeScript Types
**Gap:** No service layer to write/read decision chain entries.
**Fix:**
1. Create `src/types/aiDecisionChain.ts` — interfaces matching the table
2. Create `src/services/aiDecisionChainService.ts` — functions: `startChain()`, `addLink()`, `getChain()`, `getChainsByPatient()`
3. Use `ServiceResult<T>` pattern, `auditLogger`, proper error handling
4. Tests for the service

**Status:** DONE
**Estimated:** 2-3 hours

**Delivered:**
- `src/types/aiDecisionChain.ts` — full type definitions: `AiDecisionChainRow`, `StartChainInput`, `AddLinkInput`, `ReviewDecisionInput`, `ChainSummary`, all enums as union types
- `src/services/aiDecisionChainService.ts` — 6 functions: `startChain()`, `addLink()`, `getChain()`, `getChainsByPatient()`, `reviewDecision()`, `getOpenChains()`
- `src/services/__tests__/aiDecisionChainService.test.ts` — 10 tests covering CRUD, error handling, defaults, override workflows
- All use `ServiceResult<T>` pattern, `auditLogger`, `err: unknown` error handling

---

### S2-3: Wire Clinical AI Edge Functions to Decision Chain
**Gap:** AI edge functions make clinical decisions but don't record decision chains.
**Fix:**
1. Create shared helper `supabase/functions/_shared/decisionChain.ts` — `recordDecisionLink()` function for edge functions
2. Wire into highest-impact AI functions first:
   - `ai-readmission-predictor` — records trigger (discharge event), context (patient data), decision (risk score), action (alert created)
   - `ai-fall-risk-predictor` — same pattern
   - `ai-missed-checkin-escalation` — records trigger (missed check-ins), decision (escalation score), action (caregiver notified)
3. Each edge function gets 10-15 lines added (fire-and-forget writes)
4. Test with manual edge function invocation

**Status:** DONE
**Estimated:** 3-4 hours

**Delivered:**
- `supabase/functions/_shared/decisionChain.ts` — shared helper with `recordDecisionLink()` (fire-and-forget, never throws)
- `ai-readmission-predictor/index.ts` — records clinical decision with Compass Riley confidence score + risk level
- `ai-fall-risk-predictor/index.ts` — records clinical decision with risk category and score
- `ai-missed-checkin-escalation/index.ts` — records escalation decision with consecutive missed count and caregiver notification status
- All use fire-and-forget pattern (async IIFE with `.catch()`) — decision chain write never blocks the response

---

### S2-4: Decision Chain Auditor Query View
**Gap:** No way for auditors to trace decisions.
**Fix:**
1. Create PostgreSQL view `v_ai_decision_trace` — joins chain links in order, shows full trigger→outcome path
2. `security_invoker = on` (enforces RLS)
3. Optional: Admin UI panel to browse decision chains (can defer to future session)

**Status:** DONE (migration created, awaiting `db push` approval)
**Estimated:** 1-2 hours

**Delivered:**
- Migration `20260312094500_ai_decision_trace_view.sql` — `v_ai_decision_trace` view
- `security_invoker = on` enforces RLS on underlying `ai_decision_chain` table
- Includes chain_position (ordered), chain_link_count, chain_has_pending window functions
- Joins profiles for reviewer_name display
- Admin UI panel deferred to future session

---

## Session 3 — Medical Synonym Dictionary (1 session)

### S3-1: Build Medical Synonym Lookup Table
**Gap:** Search doesn't map "heart attack" → "myocardial infarction" or "high blood pressure" → "hypertension."
**Fix:**
1. Create migration with `medical_synonyms` table: `id`, `canonical_term`, `synonym`, `code_system` (ICD-10/CPT/SNOMED), `code`, `category` (condition/procedure/medication)
2. Seed with common clinical synonym pairs (50-100 high-value mappings)
3. Enable RLS (public read)
4. Push migration

**Status:** DONE (migration created, awaiting `db push` approval)
**Estimated:** 2-3 hours

**Delivered:**
- Migration `20260312095000_medical_synonyms.sql` — table + 90+ seed synonyms + `expand_medical_synonyms()` function
- Categories: conditions (cardiovascular, endocrine, respiratory, musculoskeletal, neurological, renal, GI, mental health), medications (brand→generic), symptoms (lay→clinical)
- UNIQUE constraint on (canonical_term, synonym), full-text GIN indexes
- RLS: authenticated read-only (search expansion is non-PHI)
- `expand_medical_synonyms(p_query)` function returns canonical terms + all related synonyms

---

### S3-2: Wire Synonym Lookup into Search
**Gap:** `voiceSearchService.ts` doesn't expand search terms using synonyms.
**Fix:**
1. Create `src/services/medicalSynonymService.ts` — `expandSearchTerm(query)` returns canonical term + all synonyms
2. Modify `voiceSearchService.ts` to call synonym expansion before searching
3. Results from synonym-expanded searches get slightly lower match scores than direct matches (80 vs 100)
4. Tests for synonym expansion

**Status:** DONE
**Estimated:** 2-3 hours

**Delivered:**
- `src/services/medicalSynonymService.ts` — `expandSearchTerm()` + `getSearchTerms()` using RPC
- `voiceSearchService.ts` updated: `searchMedicalCodes()` now auto-expands via synonym service when < 5 direct results
- Synonym-expanded results capped at 80 match score (vs 100 for direct matches) per spec
- `mapMedicalCodeResults()` helper extracted to avoid duplication

---

### S3-3: Clinical Notes Full-Text Search (Foundation)
**Gap:** Index infrastructure prepared but clinical notes not searchable from UI.
**Fix:**
1. Add GIN/tsvector index on `clinical_notes.note_content` (if not already indexed)
2. Create PostgreSQL function `search_clinical_notes(p_query TEXT, p_tenant_id UUID)` with RLS
3. Wire into GlobalSearchBar as entity type `clinical_note`
4. Result click navigates to patient chart with note highlighted
5. Tests

**Status:** DONE (migration created, awaiting `db push` approval)
**Estimated:** 2-3 hours

**Delivered:**
- Migration `20260312095500_search_clinical_notes_function.sql` — GIN index on `clinical_notes.content` + `search_clinical_notes()` RPC
- `clinical_note` entity type added to `EntityType`, `ENTITY_ROUTES`, icons, colors, labels
- `searchClinicalNotes()` function in `voiceSearchService.ts` — calls RPC, returns snippets
- `parseClinicalNoteCommand()` parser — detects "notes about diabetes", "search notes hypertension", etc.
- GlobalSearchBar wired to dispatch `clinical_note` searches
- Search example added ("notes diabetes management")

---

## Deferred (Business Decision Required)

### D-1: EMS Handoff Migration Activation
**When:** When EMS feature is needed for a hospital pilot
**What:** Restore `_SKIP_20251024000004_ems_prehospital_handoff.sql`, push migration

### D-2: Burnout Discharge-to-Wellness Bridge
**When:** Future phase
**What:** Restore `_SKIP_20251028000000_discharge_to_wellness_bridge.sql` (wellness_enrollments, enhanced_check_in_responses, mental_health_screening_triggers)

---

## Progress Summary

| Session | Items | Status | Focus |
|---------|-------|--------|-------|
| S1: Quick Wins | 2 | **2/2** | Full-text search wiring + governance CI |
| S2: Decision Chain | 4 | **4/4** | Migration, service, edge function wiring, auditor view |
| S3: Synonym + Notes Search | 3 | **3/3** | Synonym dictionary, search expansion, clinical notes |
| Deferred | 2 | — | EMS + burnout bridge (business decision) |
| **Total** | **9 actionable** | **9/9** | |

**Estimated total effort:** ~20-25 hours across 3 sessions
