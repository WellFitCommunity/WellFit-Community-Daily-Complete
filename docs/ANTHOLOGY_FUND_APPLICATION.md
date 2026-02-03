# Anthology Fund Application - WellFit Community / Envision Atlus

**Applicant:** Envision VirtualEdge Group LLC
**Product:** WellFit Community (Consumer) + Envision Atlus (Clinical)
**Stage:** Pre-seed / Seed
**Application to:** Menlo Ventures Anthology Fund ($100M AI Startup Fund with Anthropic)
**Apply at:** [menlovc.com/anthology-fund-application](https://menlovc.com/anthology-fund-application/)

---

## Company Overview

**Envision Atlus / WellFit Community** is a dual-product, AI-first healthcare SaaS platform built entirely on Anthropic's Claude models. We deliver two products from a single white-label multi-tenant codebase:

- **Envision Atlus** - A full clinical care management platform for hospitals and health systems: care coordination, clinical documentation, risk prediction, discharge planning, bed management, billing optimization, FHIR/HL7/X12 interoperability, and 40+ AI-powered services. Deployable to rural critical access hospitals, community hospitals, large health systems, and public health agencies.
- **WellFit Community** - A community-facing wellness platform for patient engagement, caregiver coordination, daily check-ins, and community health worker workflows. Extends the clinical system to the patient's home and community.

**The core innovation:** Our platform is designed for AI operation, not human operation with AI assistance. Claude doesn't supplement our product - it IS the intelligence layer across 40+ specialized clinical domains.

**How we built it:** The entire platform was built by a two-person team - a Registered Nurse and an AI Director - using Claude Code as the primary development tool. No traditional engineering team. This is not a pitch deck or prototype; it is a production-grade system with 7,431 passing tests, 520 database migrations, and 141 deployed edge functions. The platform itself is proof that Claude enables domain experts to build enterprise software that meets hospital-grade standards.

---

## Problem

### Healthcare Systems Are Drowning in Complexity Without AI-Native Tools

- **28% of Medicare spending** ($170B/year) goes to potentially avoidable readmissions
- **Rural hospitals** are closing at a rate of 1 per month - they can't afford the staffing to manage modern clinical workflows
- **Community hospitals** operate on 2-3% margins and lose revenue to documentation gaps, missed billing codes, and care coordination failures
- **Large health systems** spend $1B+ on EHR migrations that still leave clinicians buried in manual documentation
- **Public health departments** rely on fragmented reporting with no AI-powered surveillance or population health analytics
- **Post-acute transitions** fail 30% of the time due to disconnected systems between hospitals, rehab, home health, and community organizations
- **Community Health Workers** spend 60% of their time on documentation instead of patients

The healthcare industry needs an AI-native platform that can serve the full spectrum - from a 25-bed rural critical access hospital to a multi-facility health system to public health agencies - without requiring a 50-person IT department to implement it.

---

## Solution

### AI-First Healthcare Platform for the Full Spectrum

We built a platform where Claude handles the intelligence across every clinical, operational, and community health workflow:

| Capability | Claude Integration | Who It Serves |
|-----------|-------------------|---------------|
| **Clinical Documentation** | SOAP notes, discharge summaries, care plans, progress notes | All hospitals - reduces 70% of documentation burden |
| **Risk Prediction** | Readmission (30/60/90 day), fall risk, infection risk, medication adherence | Hospitals, post-acute, home health |
| **Bed Management** | ML-optimized bed assignment, capacity forecasting, discharge planning | Community and large hospitals |
| **Billing & Revenue Cycle** | CPT code suggestion, claims generation, prior auth, eligibility verification | All healthcare organizations |
| **Drug Safety** | Real-time interaction detection, contraindications, medication reconciliation | All clinical settings |
| **Care Coordination** | AI-synthesized handoff notes, referral management, shift transitions | Multi-provider care teams |
| **Social Determinants** | Passive SDOH detection from conversation (patent-pending) | Public health, community health |
| **Population Health** | Cohort analysis, health equity scoring, syndromic surveillance | Public health departments |
| **Patient Engagement** | AI-personalized check-ins, caregiver briefings, patient education | Home health, community orgs |
| **Interoperability** | FHIR R4, HL7 v2.x, X12 837P/837I, SMART on FHIR | Health system migrations, data exchange |

### Technical Architecture

```
40+ Claude AI Services (Haiku/Sonnet/Opus routing)
     |
8 MCP Servers (FHIR, HL7, X12, CMS, NPI, Clearinghouse)
     |
141 Edge Functions (Deno) + 520 DB Migrations (PostgreSQL 17)
     |
Multi-Tenant White-Label SaaS (any healthcare org, any domain)
```

**Production Metrics:**
- 7,431 passing tests across 304 test suites (100% pass rate)
- Zero TypeScript `any` types (eliminated 1,400+ violations)
- Zero lint warnings (eliminated 1,671)
- HIPAA compliant with PHI audit logging
- SOC 2 Type II aligned controls
- FHIR R4 + HL7 v2.x + X12 837P interoperability

---

## Market

### Total Addressable Market

| Segment | TAM | Envision Atlus Capability |
|---------|-----|--------------------------|
| Hospital IT / Clinical Systems | $45B | Full clinical platform (EHR-adjacent, AI-native) |
| Rural & Critical Access Hospitals | $8B | Turnkey deployment, no IT team required |
| Clinical Documentation AI | $5B | SOAP notes, discharge summaries, care plans |
| Care Coordination Software | $4B | Multi-provider handoff, referral management |
| Revenue Cycle Management AI | $3B | Billing optimization, claims, prior auth |
| Remote Patient Monitoring | $8B | Community check-ins, vital capture, wearables |
| Post-Acute Care Technology | $12B | Discharge bridge, facility matching |
| Public Health Analytics | $2B | Population health, SDOH, syndromic surveillance |

### Deployment Models

| Customer Type | What They Get | Why It Works |
|---------------|---------------|--------------|
| **Rural / Critical Access Hospitals** | Full Envision Atlus clinical suite | Replaces 5-10 point solutions with one AI-native platform; no IT department needed |
| **Community Hospitals** | Clinical + care coordination + billing AI | 40+ AI services reduce documentation burden, optimize revenue cycle |
| **Large Health Systems** | White-label multi-facility deployment | Multi-tenant architecture scales across campuses; migrates off legacy systems |
| **Public Health Departments** | Population health + SDOH + surveillance | AI-powered analytics, syndromic reporting, community health worker tools |
| **Home Health / Post-Acute** | Discharge bridge + remote monitoring | Closes the transition gap between hospital and home |
| **Community Organizations** | WellFit Community platform | Senior engagement, caregiver coordination, wellness check-ins |
| **Law Enforcement** | SHIELD Program wellness check program | Senior welfare dispatch, emergency response info (deployment-ready) |

### Beachhead Strategy

**Multiple simultaneous entry points, not a single vertical:**
1. **Law enforcement agency** - SHIELD Program pilot (deployment-ready, zero acquisition cost)
2. **Rural Texas hospitals** - Critical access facilities that can't afford enterprise EHR add-ons
3. **Community health organizations** - WellFit Community for senior engagement and caregiver support

**Scale path:** Community orgs + rural hospitals -> regional health systems -> large health systems + public health

---

## Claude Integration Depth

We are not a company that uses Claude for a chatbot. We have **40+ specialized AI services**, each registered in our `ai_skills` database with individual model routing, cost tracking, and accuracy monitoring.

### Service Categories

**Clinical Decision Support (8 services):**
Readmission risk, fall risk, infection risk, medication adherence, care escalation scoring, extended prediction (30/60/90 day), population health insights, health equity analysis

**Clinical Documentation (6 services):**
SOAP notes, discharge summaries, care plans, progress notes, referral letters, medication instructions

**Medication Intelligence (4 services):**
Drug interactions, medication reconciliation, contraindications, psychotropic classification

**Patient Engagement (6 services):**
Check-in questions, patient QA bot, patient education, cultural health coaching, caregiver briefings, appointment prep instructions

**Operational AI (8 services):**
Schedule optimization, billing suggestions, FHIR semantic mapping, HL7 interpretation, field visit optimization, care team summarization, handoff risk synthesis, welfare check dispatch

**Governance & Compliance (6 services):**
HIPAA violation prediction, PHI exposure scoring, security anomaly detection, audit report generation, accuracy tracking, clinical guideline matching

### Model Routing Strategy

```
Haiku   -> Quick lookups, classification, triage (low cost, fast)
Sonnet  -> Documentation, summarization, analysis (balanced)
Opus    -> Complex clinical reasoning, multi-factor risk (highest accuracy)
```

Cost-optimized with batch inference and prediction caching.

---

## Traction

### Product Status
- **Technology Readiness Level:** 8-9 (pilot-ready to production-ready)
- **Codebase:** ~100,000+ lines of production TypeScript
- **Test Coverage:** 7,431 tests, 304 suites, 100% pass rate
- **Database:** 520 migrations (mature data model)
- **Edge Functions:** 141 deployed (Deno runtime)

### Deployment Pipeline
- **Law enforcement agency:** SHIELD Program senior welfare check deployment - deployment-ready
- **Multi-tenant architecture:** Onboard any healthcare org in days, not months
- **White-label ready:** Custom branding, domains, feature flags per tenant

### Intellectual Property
- **Patent-pending:** SDOH passive collection system (social determinants from conversation)
- **Additional patents identified:** Guardian Agent self-healing, ATLUS clinical framework
- **40+ proprietary AI implementations** across clinical domains
- **IP attestation registry** with full governance

---

## Team

### Maria LeBlanc - Co-Founder & AI Director
**Ordained Minister | Degree in Social and Behavioral Services**
- Architected and built the entire platform using Claude Code as the primary engineering tool
- Directed 40+ AI service implementations across clinical, operational, and compliance domains
- Established the AI-first development methodology: CLAUDE.md governance, cross-AI auditing (Claude + ChatGPT), zero-technical-debt enforcement
- Background in social and behavioral services brings patient-centered design to every workflow - this platform was built by someone who understands the populations it serves
- Pastoral ordination grounds the mission in service to vulnerable communities - senior welfare isn't a market opportunity, it's a calling
- **This platform is proof that a non-traditional engineering team can build enterprise-grade healthcare SaaS using AI-assisted development** - a thesis that validates Anthropic's core mission

### Akima Taylor, MDiv, BSN, RN, CCM - Co-Founder, Chief Clinical Analyst & Compliance Governor
- Registered Nurse and Certified Case Manager providing clinical domain expertise across all 40+ AI services
- Validates clinical accuracy of AI-generated documentation (SOAP notes, discharge summaries, care plans)
- Designs patient engagement workflows grounded in bedside nursing experience
- Governs regulatory compliance (HIPAA, clinical standards of care, CMS requirements)
- Master of Divinity brings pastoral care perspective to senior wellness and end-of-life coordination
- CCM certification ensures care coordination meets industry standards for case management
- Bridges the gap between AI capability and clinical reality

### Why This Team Works
Both founders are ordained ministers. Maria's pastoral ordination and behavioral services background mean the product was designed around human dignity, not technology. Akima's MDiv + BSN + CCM credentials span pastoral care, clinical nursing, and case management. Together, they represent the exact communities this platform serves: faith-rooted health leaders who understand seniors, caregivers, and the systems that fail them.

They built a platform that would typically require a 10-15 person engineering team, using Claude Code as the force multiplier.

**This team IS the Anthropic thesis:** AI doesn't replace expertise - it amplifies it. Two domain experts with Claude built what traditional teams couldn't.

---

## Use of Funds

| Category | Allocation | Purpose |
|----------|-----------|---------|
| Engineering | 40% | Hire 2 engineers for scale, mobile app, EHR integration hardening |
| Pilot Deployment | 25% | Launch 3 pilots: rural hospital, community org, law enforcement vertical |
| Compliance | 15% | SOC 2 Type II certification, HIPAA third-party audit |
| Sales & Marketing | 15% | Demo materials, HIMSS/conference presence, healthcare channel partnerships |
| Infrastructure | 5% | Claude API credits, Supabase scaling, monitoring |

---

## Ask

**Investment:** $250,000 - $500,000 (Seed)

**What this enables:**
1. Launch 3 simultaneous pilots across different customer types (rural hospital, community org, law enforcement)
2. Achieve SOC 2 Type II certification (required for health system procurement)
3. Hire first 2 team members (engineer + healthcare sales)
4. Build mobile app for patient engagement
5. Establish FHIR-based EHR integration partnerships (Epic, Cerner connectivity)

**Return potential:**
- Rural/community hospital contracts = $5,000-$25,000/month (platform + AI services)
- Large health system contracts = $50,000-$200,000/month (multi-facility, per-bed pricing)
- Community organizations = $1,000-$5,000/month (WellFit Community tier)
- Multi-tenant architecture = near-zero marginal cost per new tenant
- 40+ AI services = deep moat and switching costs
- Healthcare compliance = 12+ month barrier to entry for competitors

---

## Why Anthropic / Anthology Fund

1. **We are the proof that Claude Code changes what's possible.** Maria LeBlanc (Social & Behavioral Services) and Akima Taylor (BSN, RN, CCM) built enterprise healthcare SaaS - 7,431 tests, 520 migrations, 40+ AI services, HIPAA compliant - using Claude as the primary engineering tool. No traditional dev team. This is Anthropic's thesis made real: AI amplifies domain experts into builders.

2. **We are your healthcare reference implementation.** 40+ Claude services, HIPAA compliant, FHIR interoperable. No other startup demonstrates this depth of Claude integration in a regulated industry. We are the case study you want to tell.

3. **Our growth = your API revenue.** Every patient we serve generates Claude API calls across risk prediction, documentation, engagement, and coordination. Scale to 10,000 patients = significant recurring API consumption across 40+ services.

4. **Healthcare is your stated priority.** Daniela Amodei has identified healthcare as a key Anthology vertical. We are production-ready, not conceptual. Anthropic launched Claude for Healthcare in January 2026 - we've been building healthcare AI on Claude for over a year.

5. **Social impact alignment.** Rural hospital survival, health equity, SDOH detection, public health surveillance, senior welfare, caregiver support. From keeping rural ERs open to detecting food insecurity in conversation - this is AI for societal benefit across the full healthcare spectrum.

6. **AI-first architecture validates the Claude platform.** Our 8 MCP servers and AI-operated design prove Claude can be the intelligence backbone of enterprise healthcare systems. The entire codebase was built with Claude Code - we are living proof of the developer productivity story Anthropic tells.

---

## Contact

**Envision VirtualEdge Group LLC**
Houston, Texas

| | Maria LeBlanc | Akima Taylor |
|--|---------------|--------------|
| **Role** | Co-Founder & AI Director | Co-Founder, Chief Clinical Analyst & Compliance Governor |
| **Email** | Maria@TheWellFitCommunity.org | Akima@TheWellFitCommunity.org |
| **Phone** | 832-576-3448 | 713-291-1639 |

---

## Appendix: Key Technical Differentiators

### vs. Generic Healthcare AI Startups
| Feature | WellFit/Envision Atlus | Typical Startup |
|---------|----------------------|-----------------|
| AI services | 40+ specialized | 1-3 generic |
| AI integration | Architecture-level (AI-first) | Feature-level (AI-bolted) |
| Healthcare standards | FHIR R4 + HL7 + X12 | Maybe FHIR |
| Test coverage | 7,431 tests, 100% pass | <500 tests |
| Multi-tenant | White-label ready | Single-tenant |
| Compliance | HIPAA + SOC 2 aligned | "We plan to be HIPAA" |
| Database maturity | 520 migrations | <50 migrations |
| Patient scope | Full lifecycle (community -> acute -> post-acute) | Single point solution |

### Deployed AI Capabilities (40+)
1. Readmission Risk Prediction
2. Fall Risk Prediction
3. Infection Risk Prediction
4. Extended Readmission Prediction (30/60/90 day)
5. Medication Adherence Prediction
6. Care Escalation Scoring
7. SOAP Note Generation
8. Discharge Summary Generation
9. Care Plan Generation
10. Progress Note Synthesis
11. Referral Letter Generation
12. Medication Instructions
13. Drug Interaction Detection
14. Medication Reconciliation
15. Contraindication Detection
16. Psychotropic Classification
17. SDOH Passive Detection (patent-pending)
18. Population Health Insights
19. Health Equity Scoring
20. Cultural Health Coaching
21. Field Visit Optimization
22. Care Team Chat Summarization
23. Provider Assistant
24. Schedule Optimization
25. Smart Suggestions
26. Welfare Check Dispatch
27. Missed Check-In Escalation
28. Handoff Risk Synthesis
29. HIPAA Violation Prediction
30. PHI Exposure Risk Scoring
31. Security Anomaly Detection
32. Audit Report Generation
33. Accuracy Tracking
34. Billing Optimization
35. FHIR Semantic Mapping
36. HL7 v2 Interpretation
37. Patient Education
38. Patient QA Bot
39. Caregiver Briefing
40. Clinical Guideline Matching
41. Treatment Pathway Navigation
42. Dashboard Anomaly Detection
43. Appointment Analytics
44. Appointment Prep Instructions
45. CCM Eligibility Scoring
