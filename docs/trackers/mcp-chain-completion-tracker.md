# MCP Chain Completion Tracker — Final Gaps

> **Source:** Code audit of all 16 MCP servers + 6 prior trackers — 2026-03-28
> **Verified by:** Claude Opus 4.6 — all servers read, all prior tracker items cross-referenced
> **Goal:** Close remaining 12 MCP gaps for hospital pilot readiness
> **Estimated total:** ~49 hours across 2 sessions + 1 external blocker
> **Prior trackers:** mcp-completion, mcp-hardening, mcp-blind-spots, mcp-infrastructure-repair, mcp-production-readiness, mcp-server-compliance (all cross-referenced)

---

## Status Summary

| Category | Done | Remaining |
|----------|------|-----------|
| Prior tracker items (6 trackers) | 61/73 | 12 open |
| MCP servers real end-to-end | 15/16 | 1 stub (clearinghouse) |
| Security hardening | — | 3 items (~15h) |
| Revenue/clinical features | — | 4 items (~34h) |
| External blockers | — | 1 (clearinghouse creds) |
| Clinical review | — | 1 (Akima) |
| Deferred by design | — | 1 (tool utilization) |

---

## Session 1 — Security Hardening (Must Fix Before Pilot) (~15 hours)

| # | Gap | Description | Files to Modify | Est. Hours | Status |
|---|-----|-------------|-----------------|-----------|--------|
| MCP-1 | `claude-chat` relay hardening | Open relay with no input sanitization, no mandatory safety system prompt. Any authenticated user can pass arbitrary prompts to Claude API. **HIGH risk.** | `supabase/functions/claude-chat/index.ts` — add mandatory safety system prompt, apply `sanitizeClinicalInput()` to all user messages, apply `strictDeidentify()` before API call, add per-user rate limiting | 4 | TODO |
| MCP-2 | `claude-personalization` injection guard | Accepts arbitrary `prompt` field, uses regex-only PHI redaction (not structural). **MEDIUM risk.** | `supabase/functions/claude-personalization/index.ts` — replace `redact()` with `strictDeidentify()`, wrap prompt in `sanitizeClinicalInput()` XML delimiters, add `CONDENSED_DRIFT_GUARD` to system prompt, log injection detection events | 3 | TODO |
| MCP-3 | Live adversarial testing against Claude API | Guard functions verified in unit tests but Claude's actual obedience to guards is untested against live API. 40 attack prompts against high-risk functions. ~$5-15 API cost. | Test against: `ai-patient-qa-bot`, `ai-soap-note-generator`, `ai-check-in-questions`, `claude-chat`, `claude-personalization`. Document results. | 8 | TODO |

**Session 1 subtotal:** ~15 hours

### Session 1 Notes
- **MCP-1 is the highest priority.** `claude-chat` is a direct relay to Claude with user-supplied system prompts. Hardening pattern: prepend mandatory safety prompt → sanitize user input → deidentify PHI → rate limit → log.
- **MCP-2 uses the same shared utilities** (`sanitizeClinicalInput`, `strictDeidentify`, `CONDENSED_DRIFT_GUARD`) already deployed in other edge functions. This is wiring, not invention.
- **MCP-3 should run after MCP-1 and MCP-2 are deployed.** Send real attack prompts to the hardened functions and verify Claude refuses. Document pass/fail per attack vector.

---

## Session 2 — Revenue & Clinical Features (~34 hours)

| # | Gap | Description | Files to Create/Modify | Est. Hours | Status |
|---|-----|-------------|------------------------|-----------|--------|
| MCP-4 | RPM billing infrastructure | Cannot bill Medicare RPM codes (CPT 99453-99458) for home vital monitoring. Need: enrollment table, device assignment, automated time tracking from check-in vitals, monthly billing summary, integration with 837P claim generation. | New migration: `_rpm_enrollment_tracking.sql`, new: `src/services/rpmBillingService.ts`, modify: `src/services/rpmClaimService.ts` (already exists, needs wiring) | 12 | TODO |
| MCP-5 | Wearable vitals → clinician dashboard | Apple Watch/Fitbit/Garmin data collected in `wearable_vital_signs` but invisible to clinicians. Need: 7/30/90-day vital trend charts, threshold-based alerts (abnormal BP, HR, SpO2, glucose), integration with PatientChartNavigator or DoctorsViewPage. | New: `src/components/admin/WearableVitalsDashboard.tsx`, modify: `src/components/chart/PatientChartNavigator.tsx` (add Wearables tab), new: `src/services/wearableAlertService.ts` | 8 | TODO |
| MCP-6 | Home vitals → FHIR Observation conversion | Check-in vitals and wearable data not converted to FHIR Observations. External EHRs cannot see home-generated vitals via FHIR API. | New: `supabase/functions/convert-vitals-to-fhir/index.ts`, LOINC code mapping (BP: 85354-9, HR: 8867-4, SpO2: 2708-6, glucose: 2345-7, temp: 8310-5, weight: 29463-7), provenance tracking (self-report vs device) | 6 | TODO |
| MCP-7 | Clearinghouse external API | `mcp-clearinghouse-server` is 100% stub. `loadConfig()` returns null. No real API calls to Waystar/Change Healthcare/Availity. **BLOCKED on vendor sandbox credentials.** | `supabase/functions/mcp-clearinghouse-server/client.ts` — wire `loadConfig()` to `clearinghouse_config` table, implement real HTTP calls to clearinghouse API, add credential management | 8-12 | BLOCKED |

**Session 2 subtotal:** ~34 hours (26 buildable + 8-12 blocked)

### Session 2 Notes
- **MCP-4 has partial infrastructure:** `rpmClaimService.ts` already exists, `rpm` encounter type is supported, fee schedule has 2026 CMS RPM rates seeded. The gap is enrollment tracking and automated time calculation.
- **MCP-5 and MCP-6 are connected:** Wearable data needs to be visible to clinicians (MCP-5) AND convertible to FHIR for external systems (MCP-6). Build MCP-5 first (clinician value), then MCP-6 (interop value).
- **MCP-7 remains BLOCKED.** Handler logic is structurally correct — once credentials are wired in, the server should work. No code changes needed until creds arrive.

---

## Non-Code Items (No Session Required)

| # | Gap | Description | Owner | Status |
|---|-----|-------------|-------|--------|
| MCP-8 | Cultural competency clinical review | Akima needs to validate prevalence rates, screening tools, drug interaction warnings, and trust factors across 8 population profiles. | Akima | PENDING |
| MCP-9 | Tool utilization gap (76/94 tools unwired) | 76 of ~140 total tools have no UI consumer. Each unwired tool is untested in production. Acceptable for pilot — tools exist for future integrations. | Deferred | ACCEPTED |

---

## Regression Checks

```bash
# After Session 1 — verify security hardening
grep -r "sanitizeClinicalInput\|strictDeidentify" supabase/functions/claude-chat/ --include="*.ts"  # Should find both
grep -r "CONDENSED_DRIFT_GUARD\|FULL_DRIFT_GUARD" supabase/functions/claude-personalization/ --include="*.ts"  # Should find drift guard
grep -r "rateLimiter\|checkRateLimit" supabase/functions/claude-chat/ --include="*.ts"  # Should find rate limiting

# After Session 2 — verify revenue/clinical features
grep -r "rpm_enrollment\|rpm_billing" supabase/migrations/ --include="*.sql" -l  # Should find RPM migration
grep -r "wearable_vital_signs" src/components/ --include="*.tsx" -l  # Should find dashboard component
grep -r "convert-vitals-to-fhir" supabase/functions/ -l  # Should find edge function directory
grep -r "85354-9\|8867-4\|2708-6" supabase/functions/ --include="*.ts"  # Should find LOINC codes
```

---

## Timeline

| Session | Focus | Items | Hours | Status |
|---------|-------|-------|-------|--------|
| **1** | Security hardening — claude-chat, claude-personalization, live adversarial testing | MCP-1 through MCP-3 | ~15 | **NEXT** |
| **2** | Revenue — RPM billing, wearable dashboard, FHIR vitals conversion | MCP-4 through MCP-6 | ~26 | PENDING |
| **—** | Clearinghouse activation (when creds arrive) | MCP-7 | ~8-12 | BLOCKED |
| **—** | Akima clinical review of cultural competency profiles | MCP-8 | 0 code | PENDING |

**Total buildable work:** ~41 hours (2 sessions)
**Blocked work:** ~8-12 hours (clearinghouse, awaiting vendor)
**Non-code work:** Akima review + tool utilization acceptance
