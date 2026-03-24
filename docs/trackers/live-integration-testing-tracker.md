# Live Integration Testing Tracker

> **Mocks validate logic. Live tests validate reality. We need both.**

**Created:** 2026-03-24
**Priority:** P2 — Not blocking demos, but closes the gap between "tests pass" and "it actually works"
**Estimated effort:** ~16 hours across 2-3 sessions
**Foundation:** `supabase/functions/__tests__/mcp-integration.test.ts` (already calls live Supabase)

---

## Context

We have 11,597+ unit/component tests using mocks — they verify logic, state, and UI behavior. But mocked tests can't catch:
- RLS policies that silently block queries
- Migrations that didn't push
- Edge functions that crash at runtime despite clean compilation
- Schema mismatches between code and real database

The MCP integration test already proves the live-test pattern works. This tracker extends it to critical paths.

---

## What We Already Have

| Asset | Count | Type |
|-------|-------|------|
| MCP integration test (live Supabase) | 1 file, 9+ servers | Real HTTP calls |
| Edge function logic tests | 112 files | Local/mocked |
| FHIR R4 logic tests | 738 lines, 25+ test steps | Local/mocked |
| Component tests | 11,500+ | Mocked Supabase |

---

## Track 1: Infrastructure Setup

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1-1 | Create `TEST-0001` tenant in Supabase | TODO | Dedicated test tenant, invisible to demo tenant `WF-0001` |
| 1-2 | Create test helper: synthetic data factory | TODO | Insert/cleanup functions for patients, check-ins, etc. |
| 1-3 | Create test runner script for integration tests | TODO | `scripts/test-integration.sh` — runs Deno tests against live Supabase |
| 1-4 | Add CI workflow for integration tests | TODO | Separate from unit tests (slower, needs secrets) |

---

## Track 2: Critical Path Tests (Priority Order)

| # | Edge Function / Flow | What It Validates | Status |
|---|---------------------|-------------------|--------|
| 2-1 | `create-checkin` | Real check-in insert → verify row exists → cleanup | TODO |
| 2-2 | `login` | Real auth flow → token returned → session valid | TODO |
| 2-3 | RLS tenant isolation | Insert as tenant A → query as tenant B → must return empty | TODO |
| 2-4 | `fhir-r4` | Real FHIR Patient read → valid Bundle response | TODO |
| 2-5 | `fhir-r4` metadata | Capability statement from live endpoint | TODO |
| 2-6 | Caregiver PIN access | Grant PIN → verify access → expire → verify blocked | TODO |
| 2-7 | `envision-login` | Admin auth flow → TOTP setup → session valid | TODO |

---

## Track 3: Expand to Remaining Edge Functions

| # | Category | Functions | Status |
|---|----------|-----------|--------|
| 3-1 | Clinical AI | `ai-readmission-predictor`, `ai-fall-risk-predictor`, `ai-care-plan-generator` | TODO |
| 3-2 | Medications | `check-drug-interactions`, `ai-medication-reconciliation` | TODO |
| 3-3 | Messaging | `send-sms`, `send-email` (verify accepted, not necessarily delivered) | TODO |
| 3-4 | SMART on FHIR | `smart-authorize`, `smart-token` | TODO |
| 3-5 | Public Health | `immunization-registry-submit`, `syndromic-surveillance-submit` | TODO |
| 3-6 | Billing | `generate-837p`, `ai-billing-suggester` | TODO |

---

## Track 4: Convert Existing Mocked Tests to Live

| # | Test File | Current Tests | Live Tests Needed | Status |
|---|-----------|---------------|-------------------|--------|
| 4-1 | `fhir-r4/__tests__/index.test.ts` | 25+ logic steps | Add live endpoint calls alongside | TODO |
| 4-2 | `login/__tests__/index.test.ts` | Logic validation | Add real auth round-trip | TODO |
| 4-3 | `bed-management/__tests__/index.test.ts` | Logic validation | Add real bed query | TODO |
| 4-4 | `guardian-agent/__tests__/index.test.ts` | Logic validation | Add real monitoring check | TODO |

---

## Success Criteria

- [ ] `TEST-0001` tenant exists and is isolated from demo data
- [ ] `scripts/test-integration.sh` runs all live tests and reports pass/fail
- [ ] Track 2 (7 critical paths) all pass against live Supabase
- [ ] Tests create their own data and clean up — no residue in database
- [ ] CI runs integration tests on push (separate job from unit tests)

---

## Rules

1. **Synthetic data only** — `'Test Patient Alpha'`, DOB `'2000-01-01'`, tenant `TEST-0001`
2. **Tests clean up after themselves** — delete what they create, even on failure
3. **Same Supabase project** — RLS tenant isolation keeps test data invisible to demos
4. **Don't replace mocks** — live tests are a SECOND layer, not a replacement for unit tests
5. **Edge function must be deployed** before live tests can run against it
