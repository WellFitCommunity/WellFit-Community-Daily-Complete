# Texas Market Reconnaissance — Honest Assessment (2026-05-20)

> **Purpose:** Real recon on Texas-specific EHR/EMR RFPs, RHTP status, and honest assessment of whether there's money to be made in Texas given big-vendor entrenchment.
> **Source:** WebSearch recon May 2026 + general healthcare-IT market knowledge.
> **Caveat:** Verify specific procurement dates and contact details directly with the agencies cited — state procurement timelines shift.

---

## The headline numbers for Texas

| Detail | Value |
|---|---|
| Texas RHTP plan name | **Rural Texas Strong** |
| Plan submitted | Nov 3, 2025 (HHSC to CMS) |
| Plan approved by CMS | **April 7, 2026** |
| Texas annual allocation | **~$281.3 million per year** |
| Texas 5-year total | **~$1.4 billion** (FY2026-FY2030) |
| Administering agency | Texas HHSC (Health and Human Services Commission) |
| Analyst partner | **TORCH** (Texas Organization of Rural & Community Hospitals) |
| Status (May 2026) | Procurement just spinning up |

This is the **early window** — plan approved 6 weeks ago. Procurement opportunities are starting to publish. Vendor positioning happens NOW.

---

## Critical structural facts

### HHSC will NOT meet with vendors

From the HHSC RHTP page directly:
> *"HHSC is not meeting with potential vendors or applicants for the Rural Texas Strong Program to maintain fairness for all parties and protect future procurements related to the Rural Health Transformation Program."*

This is standard quiet-period behavior. **Don't try to schedule a meeting** — it'll be politely declined and might burn a relationship.

### How procurement IS announced

HHSC posts opportunities through:
- **GovDelivery** — email notifications (subscribe at HHSC site)
- **Electronic State Business Daily (ESBD)** — Texas state procurement portal
- **HHSC Grants Page** — public listings

**Action:** Subscribe to all three. Monitor daily.

### TORCH is the gatekeeper AND the channel

HHSC contracted TORCH to do the data and research analysis to determine financial and operational strength of Texas rural hospitals. **TORCH has insight into which hospitals need what.**

TORCH operates:
- **Corporate Membership** — vendor program
- **Endorsed Vendors** program (current endorsed partner: Solarwinds for RMM)
- **Group Purchasing** via Alliant Purchasing exclusive endorsement
- **Annual Conference** (April 13-16, 2026 at Loews Arlington — already past; next major event Fall 2026)

**TORCH membership is the single highest-leverage relationship play in Texas rural healthcare.**

---

## Active RFPs I identified

### 1. Hidalgo County EHR System and Implementation
- **RFP #:** RFP-26-0047-03-25-04
- **Deadline:** March 25, 2026 (passed — check award status)
- **Strategic fit:** Border county, ~92% Hispanic/Latino population, rural and underserved. **Direct match to your cultural competency MCP server's Latino profile.**
- **Action:** Check if award was made. If not, watch for re-issue. If awarded, identify winning vendor and assess if subcontract opportunity exists.

### 2. Burke Center EHR (LMHA/LIDDA)
- **Type:** Local Mental Health Authority / Local IDD Authority
- **Deadline:** February 2, 2026 (passed)
- **Contract period:** May 30, 2026 - May 30, 2028
- **Strategic note:** LMHA/LIDDA is a recurring Texas procurement category. ~37 LMHAs statewide, many with rural service areas. Your behavioral health integration (psych med alerts, SDOH assessments) fits.
- **Action:** Add LMHA/LIDDA to your active RFP watch list — these procurements rotate.

### 3. Texas Medicaid Enterprise System (MES) Modernization
- **Type:** Multi-year portfolio of modular contracts
- **Scope:** Transforming the Medicaid Management Information Systems (MMIS)
- **Strategic note:** Texas Medicaid serves ~5M+ people. Modular contracts mean smaller vendors can win specific modules. Your MCP architecture, FHIR services, and AI-driven care coordination are all candidate modules.
- **Action:** Track via HHSC procurement forecast (published quarterly).

### 4. University of Texas Health Science Center (RFP 744-1826)
- **Type:** EHR + Revenue Cycle Management
- **Status:** Verify current cycle — historical RFP referenced in search
- **Action:** Check current status at uth.edu/buy

### 5. Watch list — categories likely to publish during 2026
- Rural hospital EHR modernization (RHTP-funded)
- CHW workforce technology (RHTP-funded)
- Behavioral health integration (LMHA/LIDDA)
- Telehealth infrastructure (rural-focused)
- Care coordination platforms (Medicaid MCO procurements)

---

## The Texas competitive landscape — honest version

### Big players who dominate

| Vendor | Where they dominate in Texas |
|---|---|
| **Epic** | Major health systems (Baylor Scott & White, Memorial Hermann, Texas Health Resources, Methodist, Cook Children's, MD Anderson, Christus) |
| **Cerner / Oracle Health** | Some health systems + military/VA |
| **CPSI / TruBridge** | **Dominant in rural Texas** — most Critical Access Hospitals |
| **athenahealth** | Small/medium ambulatory practices |
| **eClinicalWorks** | Small/medium ambulatory + community health |
| **NextGen** | Small/medium specialty practices |

**You are not going to displace Epic at a major health system.** Stop thinking about that path.

### Where the gap is (where you compete)

| Buyer type | Current vendor situation | Your opportunity |
|---|---|---|
| Rural hospitals (CAH) | CPSI/TruBridge legacy | Modern AI-native alternative for new build-outs or modernization |
| FQHCs | Mixed (athenahealth, eClinicalWorks, OpenEMR) | Underserved by AI tooling, CHW workflows |
| RHCs | Many on outdated/manual systems | Greenfield for modern offline-first SaaS |
| LMHA/LIDDAs | Old behavioral health systems | Modern integrated behavioral + medical |
| Faith-based community clinics | Often Practice Fusion / paper | Mission-aligned, culturally relevant tooling |
| Medicaid MCO subcontracts | Various legacy modules | MES modernization opens slots for AI care coordination |

**This is the unserved-Texas-market position.** It's not glamorous. It's real.

### Gatekeeping — honest analysis

**Yes, gatekeeping exists.** Specifically:

1. **TORCH endorsement is a closed list** — getting on it requires relationship-building over time
2. **CPSI has decades-old contracts** with rural Texas hospitals — switching costs are real
3. **HHSC pre-positions vendors in transformation plans** — if you weren't named in Rural Texas Strong, you're not in the first wave
4. **Hospital association recommendations** carry weight — TORCH, Texas Hospital Association (THA), Texas Medical Association (TMA)

**But here's the truth about gatekeeping:** It rewards persistence and credentials, not exclusion of new entrants. The gatekeepers genuinely want better products for their members. They just need the credential signals to introduce you.

---

## Texas-specific advantages you have

### 1. HUB Certification (Historically Underutilized Business)
Texas operates a state procurement preference program for businesses owned 51%+ by:
- Asian Pacific American
- Black American
- Hispanic American
- Native American
- Service-Disabled Veteran
- **Woman**

**You qualify as woman-owned.** If you're also Black American or another category, you qualify in multiple categories.

State agencies have HUB spending goals. Being HUB-certified gets you on preference lists, automatic RFP notifications in your NAICS codes, and dedicated outreach from state agencies trying to meet HUB targets.

**This is free. Apply immediately at comptroller.texas.gov/purchasing/vendor/hub.**

### 2. Texas residency
HHSC and other state agencies favor Texas-domiciled businesses. Your headquarters address matters.

### 3. Border county cultural alignment
Your cultural competency MCP server has Latino and Immigrant/Refugee profiles. **Texas has 14 counties along the Mexico border** with majority-Hispanic populations and chronic healthcare underservice. Hidalgo, Cameron, Webb, El Paso, Starr, Maverick, Val Verde — these are RHTP-priority counties.

**Almost no competing vendor has built-in cultural competency profiling at the architecture level.** This is a defensible Texas-specific differentiator.

### 4. Faith-based health alignment
Christus Health, Methodist Healthcare, and Baylor Scott & White all operate rural Texas facilities. **Your assistant-pastor background + the WellFit community engagement product align with mission-driven faith-based health values.** This is a relationship advantage at faith-based system level that secular vendors don't have.

### 5. Nephrology pilot (when complete)
Texas has the **third-highest ESRD population in the country** (after California and Florida). A successful nephrology pilot becomes immediately citable in Texas-specific conversations.

---

## The action plan — Texas-specific, ranked by ROI

### This month (May 2026)

1. **Apply for HUB certification** at comptroller.texas.gov/purchasing/vendor/hub. Free. Takes ~30 days.
2. **Subscribe to GovDelivery** for HHSC RHTP announcements.
3. **Set up ESBD daily monitoring** for relevant NAICS codes (541511 software publishing, 621498 all other outpatient health, 621112 physician offices, 622110 general medical hospitals).
4. **Become a TORCH Corporate Member** — see torchnet.org/membership.html. Even if the annual fee is $5-10k, this is the relationship channel.

### Next 60 days

5. **Identify 3-5 TORCH-member rural Texas hospitals** that are likely RHTP subgrantees. Public TORCH membership list is your prospect list.
6. **Draft Texas-specific one-pagers** for: rural hospital CFOs, FQHC CEOs, LMHA executive directors, Medicaid MCO procurement leads.
7. **Submit nephrology pilot case study material** to TORCH for publication consideration.

### Next 6 months

8. **Attend the TORCH Fall meeting** (date TBD — check torchnet.org/upcoming-events.html).
9. **Apply to be on Alliant Purchasing's vendor list** — TORCH's exclusive endorsed GPO partner. Gets you in front of rural Texas hospitals at discount-vendor positioning.
10. **Engage state Medicaid MCO procurement teams** (Superior HealthPlan, Molina Texas, Centene/WellCare, Aetna Better Health, UnitedHealthcare Community Plan). These plans have rural Medicaid populations and need care coordination tools.

### Pre-pilot vs post-pilot

| If pilot not yet shipped | If pilot has shipped |
|---|---|
| Lead with methodology + RHTP-funded category alignment | Lead with production reference + nephrology outcomes |
| Apply for SBIR Phase I in parallel | Begin direct conversations with named TORCH hospitals |
| Focus on relationship building (TORCH, HUB, faith-based) | Begin responding to relevant RFPs |
| Time horizon to first Texas contract: 12-18 months | Time horizon to first Texas contract: 6-12 months |

---

## Realistic dollar expectations for Texas specifically

| Scenario | Likely deal size | Timeline |
|---|---|---|
| First Texas rural hospital pilot (TORCH-introduced) | $50k-$200k | 9-15 months |
| RHTP subgrant via state-named subgrantee | $200k-$2M | 12-18 months |
| Direct HHSC contract (modular MES) | $500k-$5M | 18-30 months |
| Texas Medicaid MCO care coordination contract | $300k-$3M/year | 12-24 months |
| Multi-hospital network deal (5+ rural hospitals) | $500k-$2M | 18-24 months |
| Faith-based system partnership (Christus, Methodist) | $500k-$5M | 18-30 months |

**Realistic 24-month Texas-only ARR target: $300k-$1.5M.** That's not the whole business — that's just Texas. Stack with other states as RHTP rolls out.

---

## The honest gatekeeping answer

> **"Are the big players retrofitting and gatekeeping?"**

Yes. CPSI is retrofitting AI capabilities into their legacy stack (badly). Epic is adding rural modules (slowly). Athenahealth is pursuing FQHCs (priced wrong for the smallest ones). TORCH guards endorsements carefully. HHSC has a fairness curtain right now.

**But:**

1. Retrofitting AI onto a 2005 architecture takes 3-5 years and ships compromised. Your AI-native architecture wins on capability, not just price.
2. Gatekeepers protect their members. If you have the credentials (HUB, production reference, mission alignment), gatekeepers will introduce you because *their members need what you have*.
3. The $1.4B in RHTP money flowing to Texas over 5 years is more than the entire current rural-Texas-EHR market revenue. There is room.
4. **You don't need to take Epic's customers.** You need to take the customers Epic doesn't want — which is most of rural Texas.

---

## What this is NOT

- Not a guarantee. Texas state procurement is unpredictable.
- Not financial advice. Verify all numbers with qualified counsel before contracting.
- Not a substitute for talking to a Texas-experienced healthcare IT M&A advisor before any acquisition conversation.

What this IS: an evidence-based, Texas-specific honest assessment so you can make informed decisions about where to spend the next 30, 90, 180 days.

---

## Related documents

- `docs/RHTP_OPPORTUNITY.md` — federal RHTP context (this Texas doc is the state-specific application)
- `docs/MONETIZATION_PATHS.md` — general monetization paths
- `docs/RURAL_AMERICA_POSITIONING.md` — codebase evidence for rural-targeting
- `docs/trackers/nephrology-module-tracker.md` — the pilot path (Texas has third-highest ESRD population, highly relevant)

---

## Sources (verify directly when home)

- [Rural Health Transformation Program | Texas Provider Finance Department](https://pfd.hhs.texas.gov/rural-health-transformation-program)
- [Rural Hospital Finance | Texas HHS](https://www.hhs.texas.gov/providers/medicaid-business-resources/medicaid-supplemental-payment-directed-payment-programs/rural-hospital-finance)
- [Rural Health Transformation (RHT) Program | CMS](https://www.cms.gov/priorities/rural-health-transformation-rht-program/overview)
- [Tracking State Preparation for the Rural Health Transformation Program](https://shvs.org/tracking-state-preparation-for-the-rural-health-transformation-program/)
- [State Rural Health Transformation Programs and Applications | Rural Health Information Hub](https://www.ruralhealthinfo.org/resources/lists/rhtp)
- [CMS Announces $50 Billion in Awards to Strengthen Rural Health in All 50 States](https://www.cms.gov/newsroom/press-releases/cms-announces-50-billion-awards-strengthen-rural-health-all-50-states)
- [Rural Health Transformation in Texas | COPE Health Solutions](https://copehealthsolutions.com/cblog/rural-health-transformation-in-texas-what-federal-funding-means-for-rural-providers-hospitals-and-fqhcs/)
- [TORCH — Texas Organization of Rural & Community Hospitals](https://www.torchnet.org/)
- [TORCH Endorsed Vendors](https://www.torchnet.org/endorsed-partners.html)
- [TORCH IT Services](https://www.torchnet.org/it-services.html)
- [TORCH Group Purchasing (Alliant)](https://www.torchnet.org/group-purchasing.html)
- [Texas HHS Procurement Opportunities](https://www.hhs.texas.gov/business/contracting-hhs/procurement-opportunities)
- [Texas HHS Procurement Forecast (PDF)](https://apps.hhs.texas.gov/procurement-calendar/procurement-forecast.pdf)
- [Texas HHS Health IT Strategic Plan (PDF)](https://www.hhs.texas.gov/sites/default/files/documents/laws-regulations/policies-rules/1115-waiver/waiver-renewal/health-it-strategic-plan-draft.pdf)
- [Texas HHS Managed Care Contract Management](https://www.hhs.texas.gov/services/health/medicaid-chip/managed-care-contract-management)
- [Hidalgo County EHR RFP (PDF)](https://media.governmentnavigator.com/media/bid/1773093000_03-09-2026_RFP-26-0047-03-25-04.pdf)
- [Burke Center EHR RFP (PDF)](https://media.governmentnavigator.com/media/bid/1767635176_ESBD_480028_1767370860077_RFP__100_BKEHR_for_Electronic_Health_Record_System.pdf)
- [Electronic Health Records Bids & RFPs | BidPrime](https://www.bidprime.com/bid/category/ehr-emr)
- [Bipartisan Policy Center — Advancing Technology Innovation through RHTP](https://bipartisanpolicy.org/explainer/advancing-technology-innovation-through-the-rural-health-transformation-program/)
