# Claude for Healthcare — Gap Tracker

**Created:** February 8, 2026
**Audited against:** Anthropic Claude for Healthcare (JPM26 launch)
**Current state:** 11 MCP servers, 98 tools, 7,064 tests, 0 errors

---

## Tasks 1-10: COMPLETE

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | CMS Coverage MCP connector | ✅ Done | 6e370fd8 (Jan 16) |
| 2 | NPI Registry MCP connector | ✅ Done | 6e370fd8 (Jan 16) |
| 3 | ICD-10/Medical Codes MCP connector | ✅ Done | Pre-existing |
| 4 | FHIR R4 MCP server (20 resource types) | ✅ Done | Pre-existing |
| 5 | Prior Authorization MCP server + workflow | ✅ Done | 2ba98e6d |
| 6 | Clearinghouse MCP (claims/eligibility/ERA) | ✅ Done | Pre-existing |
| 7 | HL7/X12 MCP (message transformation) | ✅ Done | Pre-existing |
| 8 | MFA/TOTP enforcement for admin/clinical | ✅ Done | df9b54ae (Feb 8) |
| 9 | Quality Measures Engine (HEDIS/MIPS/Star) | ✅ Done | c533d386 (Feb 8) |
| 10 | PubMed MCP connector (6 tools + ping) | ✅ Done | (Feb 9) |

---

## Tasks 11-15: REMAINING

| # | Task | What's Missing | Effort | Status |
|---|------|---------------|--------|--------|
| 11 | **Decompose MedicineCabinet.tsx** (896 lines) | Exceeds 600-line god file limit. Extract sub-components. File: `src/components/patient/MedicineCabinet.tsx` | 2-4 hrs | ⏳ Pending |
| 12 | **Care Gap Detection UI** | Services exist (`ImmunizationService`, `CareCoordinationService`, `VaccineGapsWidget`). No dedicated Care Gap dashboard component. | 1-2 days | ⏳ Pending |
| 13 | **Clinical Note Summarization UI** | Edge functions exist (`ai-soap-note-generator`, `ai-progress-note-synthesizer`, `ai-discharge-summary`). No admin component to view/generate summaries. | 1 day | ⏳ Pending |
| 14 | **DSI Transparency / AI Model Cards UI** | DB table `ai_model_cards` exists (migration `20260122150001_dsi_transparency.sql`). No UI to view or manage model cards. HTI-1 requires documenting all AI/ML models. | 1-2 days | ⏳ Pending |
| 15 | **God files (7 files over 600 lines)** | `fhir.ts` (2,050), `enterpriseMigrationEngine.ts` (2,025), `HL7ToFHIRTranslator.ts` (1,678), `markerTypeLibrary.ts` (1,624), `FhirIntegrationService.ts` (1,460), `FhirAiService.ts` (1,425), `EnhancedFhirService.ts` (1,321) | 2-3 days | ⏳ Pending |

---

## Change Log

| Date | Change | By |
|------|--------|-----|
| 2026-02-08 | Tracker created — 9 complete, 6 remaining | Claude Opus 4.6 |
| 2026-02-09 | Task #10 PubMed MCP server — 6 tools + ping, Tier 1 external_api | Claude Opus 4.6 |
