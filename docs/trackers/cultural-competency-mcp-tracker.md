# Cultural Competency MCP Server — Tracker

> **Purpose:** Build an MCP server that provides culturally-informed clinical context when the AI encounters patients from specific backgrounds — veterans, unhoused individuals, Spanish-speaking patients, Black/African American patients, isolated elderly, Indigenous populations, and others. This context feeds into all 26 AI skills, adjusting communication style, clinical considerations, and care plan recommendations.

**Total Estimated Sessions:** 3-4
**Priority:** After MCP Server Compliance tracker + Compass Riley V2 reasoning modes
**Started:** 2026-03-03 (Sessions 1+2 completed same day)
**Design Origin:** Brainstorm session 2026-02-28 (Maria + Claude Opus 4.6 + Perplexity design spec)

---

## Core Philosophy

> "These things matter. If we can spin it up, it calls on what it needs."

Cultural competency is not optional decoration — it directly impacts clinical outcomes. A veteran with PTSD needs different communication than an isolated elderly person. A homeless patient has different barriers to medication adherence. Language and cultural context affect how you explain care plans, medications, and follow-up instructions.

---

## What the MCP Server Provides

When any AI skill needs cultural context, it calls the Cultural Competency MCP server. The server returns:

| Data Category | What It Contains | Example |
|---------------|-----------------|---------|
| **Communication Style** | Language preferences, formality level, family involvement norms | Spanish-speaking: include family in care decisions (*familismo*) |
| **Clinical Considerations** | Population-specific health risks, screening recommendations | Black/AA: hypertension prevalence, sickle cell awareness, keloid risk |
| **Barriers to Care** | Access challenges, trust factors, social determinants | Unhoused: no refrigeration for meds, no stable address for follow-up |
| **Cultural Health Practices** | Traditional/complementary medicine, spiritual healing | Indigenous: traditional medicine integration, community-based healing |
| **Trust & Historical Context** | Medical mistrust factors, historical trauma | Black/AA: Tuskegee legacy; Veterans: VA system frustrations |
| **Support Systems** | Community resources, culturally relevant support networks | Isolated elderly: church connections, meals-on-wheels, senior centers |
| **SDOH Coding Hooks** | ICD-10 Z-codes that apply to this population | Unhoused: Z59.0; Veteran: check for Z56.82, Z91.82 |

---

## Population Profiles (Initial Set)

| # | Population | Key Considerations |
|---|-----------|-------------------|
| 1 | **Veterans** | PTSD triggers, VA benefits navigation, military culture ("suck it up" delays care-seeking), combat exposures (burn pits, Agent Orange, Gulf War illness), moral injury, TBI screening, substance use stigma |
| 2 | **Unhoused / Homeless** | No refrigeration (insulin, biologics), no stable address (follow-up, mail-order pharmacy), shelter schedules, street health risks, dignity-first language, foot care, exposure-related conditions |
| 3 | **Spanish-Speaking / Latino** | *Familismo* (family-centered decisions), *respeto* (formal address), *remedios caseros* (home remedies — ask about herbal supplements for drug interactions), *susto/nervios* (culture-bound syndromes), diabetes/obesity prevalence |
| 4 | **Black / African American** | Medical mistrust (Tuskegee, Henrietta Lacks), hair/skin assessment differences (keloids, dermatosis papulosa nigra), sickle cell trait/disease awareness, hypertension prevalence, church as support system, maternal mortality disparity |
| 5 | **Isolated Elderly** | Social isolation as independent health risk factor (mortality equivalent to 15 cigarettes/day), technology barriers (telehealth), fall risk, cognitive decline screening, polypharmacy risk, end-of-life preferences, widow/widower grief |
| 6 | **Indigenous / Native American** | Traditional medicine integration (do not dismiss), tribal health sovereignty, historical trauma (boarding schools, forced relocation), high rates of diabetes/substance use, community-based healing circles, Indian Health Service navigation |
| 7 | **Immigrant / Refugee** | TB screening (high-prevalence origin countries), vaccine catch-up schedules, trauma-informed care (conflict zones), documentation fears affecting care-seeking, interpreter requirements (not family members for medical interpretation) |
| 8 | **LGBTQ+ Elderly** | Isolation (many without family support), discrimination history in healthcare, specific screening needs, chosen family as support system, hormone therapy considerations in aging |

---

## MCP Server Architecture

### Server Identity

| Property | Value |
|----------|-------|
| Server name | `mcp-cultural-competency-server` |
| Location | `supabase/functions/mcp-cultural-competency-server/` |
| Security tier | Tier 2 (authenticated, no service role required) |
| Auth | JWT validation via shared `mcpAuthGate.ts` |
| Rate limit | 30 req/min (lower — reference data, not high-frequency) |

### Tools (MCP Protocol)

| # | Tool Name | Description | Input | Output |
|---|-----------|-------------|-------|--------|
| 1 | `get_cultural_context` | Full cultural profile for a population | `{ population: string }` | Cultural profile object |
| 2 | `get_communication_guidance` | How to communicate with this patient | `{ population: string, context: "medication" \| "diagnosis" \| "care_plan" \| "discharge" }` | Communication style recommendations |
| 3 | `get_clinical_considerations` | Population-specific clinical risks and screenings | `{ population: string, conditions?: string[] }` | Clinical considerations + recommended screenings |
| 4 | `get_barriers_to_care` | Access barriers and mitigation strategies | `{ population: string }` | Barriers list + mitigation suggestions |
| 5 | `get_sdoh_codes` | Relevant ICD-10 Z-codes for this population | `{ population: string }` | Z-code list with descriptions |
| 6 | `check_drug_interaction_cultural` | Cultural remedies that may interact with prescribed meds | `{ population: string, medications: string[] }` | Interaction warnings for traditional/herbal remedies |
| 7 | `get_trust_building_guidance` | Historical context and trust-building strategies | `{ population: string }` | Trust factors + recommended approaches |
| 8 | `ping` | Health check | none | `{ status: "ok" }` |

### Data Storage

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Hardcoded in edge function** | Fast, no DB dependency, version-controlled | Can't update without redeployment | **Start here** — reference data changes rarely |
| **Database table** | Tenant-customizable, updateable without deploy | Extra complexity, need migration | **Phase 2** — when tenants want custom profiles |
| **External API** | Always current, richer data | Latency, dependency, cost | **Future** — if a cultural competency API emerges |

---

## Integration Points (How Other AI Skills Use It)

| AI Skill | How It Uses Cultural Context |
|----------|------------------------------|
| **SOAP Note Generator** | Adjusts documentation style, flags culture-specific considerations |
| **Care Plan Generator** | Incorporates barriers to care, culturally appropriate goals |
| **Medication Instructions** | Adjusts language level, asks about traditional remedies |
| **Discharge Summary** | Includes culturally relevant follow-up resources |
| **Readmission Predictor** | Factors in social isolation, housing stability, support systems |
| **Patient Education** | Culturally appropriate health literacy materials |
| **Compass Riley ToT** | Cultural context feeds Tree Trigger confidence calculations |
| **SDOH Coder** | Auto-suggests relevant Z-codes based on population |
| **Patient Q&A Bot** | Adjusts communication style for community members |
| **Caregiver Briefing** | Includes cultural context for family caregivers |

---

## Session Map

| Session | Focus | Status |
|---------|-------|--------|
| 1 | MCP Server + Population Profiles (1-4) | DONE (2026-03-03) |
| 2 | Population Profiles (5-8) + Integration with 7 AI skills + tree trigger | DONE (2026-03-03) |
| 3 | Integration tests + Audit tests | DONE (2026-03-03) |
| 4 | (Optional) Database-backed profiles + Tenant customization | DEFERRED |

---

## Session 1: MCP Server Core + First 4 Populations (~6 hours)

**Goal:** Build the MCP server with 8 tools and the first 4 population profiles (Veterans, Unhoused, Spanish-Speaking, Black/AA).

### Deliverables

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1.1 | MCP server scaffold (JSON-RPC, auth gate, rate limiting) | `mcp-cultural-competency-server/index.ts` | DONE |
| 1.2 | Tool definitions and handlers | `mcp-cultural-competency-server/tools.ts`, `toolHandlers.ts` | DONE |
| 1.3 | Population profile: Veterans | `mcp-cultural-competency-server/profiles/veterans.ts` | DONE |
| 1.4 | Population profile: Unhoused | `mcp-cultural-competency-server/profiles/unhoused.ts` | DONE |
| 1.5 | Population profile: Spanish-Speaking / Latino | `mcp-cultural-competency-server/profiles/latino.ts` | DONE |
| 1.6 | Population profile: Black / African American | `mcp-cultural-competency-server/profiles/blackAA.ts` | DONE |
| 1.7 | Types — CulturalProfile, CommunicationGuidance, ClinicalConsideration interfaces | `mcp-cultural-competency-server/types.ts` | DONE |
| 1.8 | Unit tests | `culturalCompetencyMCP.test.ts` | DONE (39 tests) |
| 1.9 | Deploy + ping verification | Deployment | PENDING (needs `supabase functions deploy`) |

---

## Session 2: Remaining Populations + First Integrations (~6 hours)

**Goal:** Complete all 8 population profiles and wire into the 3 highest-impact AI skills.

### Deliverables

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2.1 | Population profile: Isolated Elderly | `profiles/isolatedElderly.ts` | DONE |
| 2.2 | Population profile: Indigenous / Native American | `profiles/indigenous.ts` | DONE |
| 2.3 | Population profile: Immigrant / Refugee | `profiles/immigrantRefugee.ts` | DONE |
| 2.4 | Population profile: LGBTQ+ Elderly | `profiles/lgbtqElderly.ts` | DONE |
| 2.5 | Wire into SOAP Note Generator | `ai-soap-note-generator` | DONE |
| 2.6 | Wire into Care Plan Generator | `ai-care-plan-generator` | DONE |
| 2.7 | Wire into Medication Instructions | `ai-medication-instructions` | DONE |
| 2.8 | MCP client hook for UI access | `src/hooks/useCulturalCompetency.ts` | DONE |

---

## Session 3: Full Integration + Testing (~6 hours)

**Goal:** Wire into remaining AI skills, comprehensive testing, audit verification.

### Deliverables

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 3.1 | Wire into Readmission Predictor | `ai-readmission-predictor` | DONE (wired in Session 2) |
| 3.2 | Wire into Patient Education | `ai-patient-education` | DONE (wired in Session 2) |
| 3.3 | Wire into Discharge Summary | `ai-discharge-summary` | DONE (wired in Session 2) |
| 3.4 | Wire into SDOH Coder | `sdoh-coding-suggest` | DONE (wired in Session 2) |
| 3.5 | Wire into Compass Riley Tree Trigger Engine | `compass-riley/treeTriggerEngine.ts` | DONE (wired in Session 2) |
| 3.6 | Behavioral tests — each population profile returns correct data | `culturalCompetencyMCP*.test.ts` | DONE (82 tests across 2 suites) |
| 3.7 | Integration tests — AI skills correctly incorporate cultural context | `culturalCompetencyIntegration.test.ts` | DONE (35 tests) |
| 3.8 | Audit tests — cultural context usage logged to ai_transparency_log | `culturalCompetencyAudit.test.ts` | DONE (21 tests) |

---

## Session 4 (Optional): Database-Backed Profiles (~4 hours)

**Goal:** Move population profiles from hardcoded to database-backed for tenant customization.

### Deliverables

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 4.1 | Migration: cultural_competency_profiles table | New migration | TODO |
| 4.2 | Migration: seed data from hardcoded profiles | New migration | TODO |
| 4.3 | Tenant-specific overrides (tenant_cultural_config table) | New migration | TODO |
| 4.4 | Update MCP server to read from DB with hardcoded fallback | Server files | TODO |
| 4.5 | Admin UI for managing cultural profiles | New component | TODO |

---

## Dependencies

- MCP server infrastructure (`_shared/mcpServerBase.ts`, `mcpAuthGate.ts`, `mcpRateLimiter.ts`)
- Existing MCP server patterns (11 servers already built — follow same architecture)
- `ai_skills` table — register new skill for cultural competency
- SDOH coding infrastructure (already exists: `sdoh-coding-suggest` edge function)
- Compass Riley V2 reasoning modes (for Tree Trigger integration)

---

## Data Sources & Clinical References

Population health data should be grounded in published guidelines:

| Population | Key References |
|-----------|---------------|
| Veterans | VA/DoD Clinical Practice Guidelines, PTSD Screening (PC-PTSD-5) |
| Unhoused | NHCHC Adapting Your Practice guidelines |
| Latino | CDC Hispanic/Latino Health resources, AHRQ health literacy |
| Black/AA | AHA cardiovascular disparities guidelines, ACOG maternal mortality data |
| Isolated Elderly | NIA social isolation research, AGS Beers Criteria (polypharmacy) |
| Indigenous | IHS Clinical Reporting System, ADA diabetes in Native populations |
| Immigrant/Refugee | CDC Immigrant and Refugee Health guidelines, WHO vaccine schedules |
| LGBTQ+ | WPATH Standards of Care, Fenway Institute guidelines |

---

## Future Considerations

- **Self-reported cultural preferences:** Patient registration can capture preferred language, cultural background, veteran status, housing stability — feeding directly into cultural context selection
- **Intersectionality:** A patient can be a Black veteran who is also elderly and isolated. The MCP server should handle multi-population queries and merge relevant guidance
- **Tenant customization:** Different healthcare orgs serve different populations. A VA hospital needs deep veteran profiles. A community health center needs comprehensive immigrant/refugee profiles.
- **Multilingual output:** When cultural context indicates a non-English speaker, AI skills should be able to generate output in the patient's preferred language
