# MCP Infrastructure Repair Tracker

> **Purpose:** Close the 20% gap in MCP server infrastructure — test coverage, validation consistency, audit logging completeness, and minor inconsistencies identified in the 2026-03-16 audit.

**Created:** 2026-03-16
**Owner:** Maria (approved direction), Claude implementing
**Estimated Total:** ~20-24 hours across 3-4 sessions
**Baseline:** 15 MCP servers, 132 tools, 9 shared modules, 92.3% production-ready (24/26 items)

---

## Audit Summary (2026-03-16)

| Metric | Current | Target |
|--------|---------|--------|
| Test Coverage | 15/15 servers (100%) ✅ | 15/15 (100%) |
| Declarative Input Validation | 4/15 servers | 11/15 (Tier 1 exempt) |
| Audit Logging (success ops) | 5/15 servers | 15/15 |
| Rate Limit Consistency | 14/15 | 15/15 |
| Health Check Endpoints | 14/15 | 15/15 |
| Handler Extraction | 13/15 | 15/15 |

---

## P1 — Test Coverage (Highest Impact)

Missing test suites for 9 servers. Prioritized by blast radius (orchestrators and revenue first).

| # | Item | Server | Tools | Risk Level | Est. Hours | Status |
|---|------|--------|-------|------------|-----------|--------|
| P1-1 | Edge functions orchestrator tests | `mcp-edge-functions-server` | 13 | High (orchestrates SMS, email, push, billing) | 3 | ✅ Done (41 steps) |
| P1-2 | Chain orchestrator tests | `mcp-chain-orchestrator` | 5 REST | High (clinical workflow chains) | 2 | ✅ Done (35 steps) |
| P1-3 | DRG grouper tests | `mcp-drg-grouper-server` | 6 | High (revenue calculations) | 2 | ✅ Done (33 steps) |
| P1-4 | Medical coding tests | `mcp-medical-coding-server` | 10 | Medium (billing codes) | 2 | ✅ Done (27 steps) |
| P1-5 | NPI registry tests | `mcp-npi-registry-server` | 9 | Medium (external API proxy) | 1.5 | ✅ Done (42 steps) |
| P1-6 | CMS coverage tests | `mcp-cms-coverage-server` | 9 | Medium (coverage lookups) | 1.5 | ✅ Done (48 steps) |
| P1-7 | PubMed server tests | `mcp-pubmed-server` | 7 | Low (reference data) | 1 | ✅ Done (41 steps) |
| P1-8 | Postgres server tests | `mcp-postgres-server` | 6 | Medium (direct DB queries) | 1.5 | ✅ Done (41 steps) |
| P1-9 | Cultural competency tests | `mcp-cultural-competency-server` | 8 | Low (reference data) | 1 | ✅ Done (88 steps) |

**P1 subtotal:** ~16 hours across 2 sessions → **Completed in 1 session (2026-03-24), ~396 test steps total**

---

## P2 — Input Validation Consistency

Normalize all servers to use declarative `VALIDATION` registry from `mcpInputValidator.ts`. Tier 1 external API servers exempt (external APIs handle their own validation).

| # | Item | Server | Current Pattern | Est. Hours | Status |
|---|------|--------|----------------|-----------|--------|
| P2-1 | FHIR server validation schemas | `mcp-fhir-server` (18 tools) | Handler-delegated | 2 | ⬜ Todo |
| P2-2 | HL7/X12 validation schemas | `mcp-hl7-x12-server` (12 tools) | Handler-delegated | 1.5 | ⬜ Todo |
| P2-3 | Edge functions validation | `mcp-edge-functions-server` (13 tools) | Minimal | 1 | ⬜ Todo |
| P2-4 | Postgres server validation | `mcp-postgres-server` (6 tools) | Inline | 0.5 | ⬜ Todo |
| P2-5 | NPI registry validation | `mcp-npi-registry-server` (9 tools) | Inline | 0.5 | ⬜ Todo |
| P2-6 | CMS coverage validation | `mcp-cms-coverage-server` (9 tools) | Inline | 0.5 | ⬜ Todo |
| P2-7 | Cultural competency validation | `mcp-cultural-competency-server` (8 tools) | Minimal | 0.5 | ⬜ Todo |

**P2 subtotal:** ~6.5 hours (1 session)

---

## P3 — Audit Logging Completeness

Add `logMCPAudit()` for successful operations to servers that currently only log errors. HIPAA requires knowing who queried what, not just who hit errors.

| # | Item | Servers Affected | Est. Hours | Status |
|---|------|-----------------|-----------|--------|
| P3-1 | Tier 1 success audit logging | npi-registry, pubmed, clearinghouse | 1.5 | ⬜ Todo |
| P3-2 | Tier 2 success audit logging | cms-coverage, postgres, medical-codes, cultural-competency | 2 | ⬜ Todo |
| P3-3 | Tier 3 remaining success logging | edge-functions, medical-coding, drg-grouper | 1.5 | ⬜ Todo |

**P3 subtotal:** ~5 hours (same session as P2)

---

## P4 — Minor Fixes

| # | Item | Description | Est. Hours | Status |
|---|------|-------------|-----------|--------|
| P4-1 | Cultural competency auth fix | Add proper JWT auth consistent with other Tier 2 servers (currently hardcoded fallback, no identity tracking) | 1 | ⬜ Todo |
| P4-2 | Rate limit constant normalization | Move `mcp-cultural-competency-server` from inline `checkInMemoryRateLimit()` to shared `MCP_RATE_LIMITS` constant | 0.5 | ⬜ Todo |
| P4-3 | Chain orchestrator health check | Add GET health check endpoint matching other servers' `handleHealthCheck()` | 0.5 | ⬜ Todo |
| P4-4 | HL7/X12 handler extraction | Extract inline `handleToolCall()` (235 lines) to `toolHandlers.ts` | 1 | ⬜ Todo |
| P4-5 | Clearinghouse handler extraction | Extract inline dispatch to `toolHandlers.ts` | 0.5 | ⬜ Todo |

**P4 subtotal:** ~3.5 hours (same session as P2/P3)

---

## Session Plan

| Session | Priorities | Focus | Est. Hours | Status |
|---------|-----------|-------|-----------|--------|
| Session 1 | P1-1 through P1-9 | All 9 MCP server test suites (~396 steps) | 8-9 | ✅ Done (2026-03-24) |
| Session 2 | P2, P3, P4 | Validation, audit logging, minor fixes | 8-10 | ⬜ Next |

---

## Existing Blocked Items (Not In Scope)

| Item | Reason | Owner |
|------|--------|-------|
| P3-3 Clearinghouse credentials | Awaiting Waystar/Change Healthcare/Availity API keys | Tenant config (external) |
| P4-4 Clinical review of chain approval | Awaiting clinical team sign-off | Akima |

---

## What This Tracker Does NOT Cover

- New MCP server creation (that's a separate feature request)
- MCP protocol version upgrades
- Performance optimization (current response times are acceptable)
- The clearinghouse credential gap (already tracked separately)
