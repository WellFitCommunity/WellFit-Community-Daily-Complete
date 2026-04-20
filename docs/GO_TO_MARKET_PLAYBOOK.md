# Go-to-Market Playbook — Envision ATLUS I.H.I.S.

> **This is not a pitch deck. This is an execution plan.**
> Written 2026-04-20 based on full codebase audit + market analysis.
> Update this document as you complete each action item.

---

## Table of Contents

1. [Current Reality](#current-reality)
2. [Why Nobody's Biting (Yet)](#why-nobodys-biting-yet)
3. [The Demo Login Strategy](#the-demo-login-strategy)
4. [Move 1: Anthropic Partnership](#move-1-anthropic-partnership)
5. [Move 2: Pick ONE Use Case](#move-2-pick-one-use-case)
6. [Move 3: Get the Letter of Intent](#move-3-get-the-letter-of-intent)
7. [Move 4: SBIR/STTR Grants](#move-4-sbirsttr-grants)
8. [Move 5: Publish the Story](#move-5-publish-the-story)
9. [Move 6: Conferences & Pitch Competitions](#move-6-conferences--pitch-competitions)
10. [The Cross-Model Adversarial Loop](#the-cross-model-adversarial-loop)
11. [The FHIR/HL7 Story — What People Said Was Impossible](#the-fhirhl7-story--what-people-said-was-impossible)
12. [The Numbers (For Every Pitch)](#the-numbers-for-every-pitch)
13. [Who Pitches What](#who-pitches-what)
14. [Timeline — 90-Day Sprint](#timeline--90-day-sprint)
15. [What NOT to Do](#what-not-to-do)

---

## Current Reality

**What we have:**
- Production platform live on the internet, behind authentication
- Two products: WellFit (community wellness) + Envision Atlus (clinical care management)
- 16 MCP servers (96+ tools), 169 edge functions, 248 database tables
- 11,726 tests at 100% pass rate, 0 lint warnings
- ONC 170.315 certification: 27+ criteria ready, 13 gaps remaining
- RPM (Remote Patient Monitoring) fully wired
- Church outreach pipeline as first customer segment
- Total development cost: ~$645
- Team: Maria (AI System Director) + Akima (CCO, BSN, RN, CCM)

**What we don't have:**
- Paying customers (yet)
- Letter of intent from a healthcare buyer
- Visibility outside our immediate network
- Sales infrastructure
- Investor relationships

**What's blocking us:**
- The product is invisible — behind auth, no public demo path
- We're describing the full platform when we should lead with one pain point
- Enterprise healthcare sales requires warm introductions we don't have yet
- Nobody knows this exists

---

## Why Nobody's Biting (Yet)

It's not the product. It's distribution. Four specific problems:

### 1. Selling to the Wrong Layer
Hospital CIOs and IT departments are gatekeepers. Their job is to say no. They have Epic contracts, 18-month procurement cycles, and zero incentive to take risks. Cold outreach to IT will not work.

**Who to sell to instead:** CFOs (readmission penalties cost money), Quality Directors (readmission rates are their metric), Practice Managers (RPM is a revenue generator), Senior Living Facility Directors (they need wellness tech and have short procurement cycles).

### 2. The Pitch Is Too Big
"We built an entire healthcare platform" sounds like we're competing with Epic. Nobody believes a two-person team competes with Epic. And we shouldn't — that's not what we're doing.

**Fix:** Lead with ONE pain point, not the full platform. Show the rest after they're interested.

### 3. No Warm Network
Enterprise healthcare sales runs on relationships. Conferences, referrals, former colleagues. We have deep domain expertise but not a Rolodex of hospital innovation directors.

**Fix:** Use the channels we DO have — churches (Maria's network), nursing community (Akima's network), AI community (Anthropic/Claude Code), grant programs (designed for non-traditional founders).

### 4. GitHub Is Invisible to Buyers
Hospital executives and VCs don't browse GitHub. The product is in the best possible place for developers and the worst possible place for buyers.

**Fix:** Demo login, published story, conference visibility, direct outreach to Anthropic.

---

## The Demo Login Strategy

**Yes — create a demo login. This is the single highest-impact thing you can do this week.**

Nobody funds or buys software they can't touch. Every conversation — with Anthropic, investors, hospital execs, church leaders — ends with "can I see it?" If the answer is "you need to create an account and go through all the steps," you lose them.

### What to Build

**A dedicated demo tenant with a pre-loaded demo account.**

| Element | Detail |
|---------|--------|
| **Tenant** | `DEMO-0001` (license digit `0` — shows both products) |
| **Demo URL** | Your production URL + a `/demo` landing page |
| **Demo credentials** | A shared login: `demo@wellfitcommunity.com` / simple password |
| **Demo role** | Admin role (so they can see everything) |
| **Data** | Pre-loaded synthetic patients, check-ins, vitals, care plans, risk scores |
| **Guardrails** | Read-only where possible. If they can create data, it resets nightly. |

### Demo Landing Page Content

A simple page (can be a route in the app) that says:

```
Welcome to Envision ATLUS I.H.I.S.

Built by a superintendent and a nurse using AI. $645 total cost.
16 MCP servers. 11,726 tests. HIPAA-compliant. ONC certification in progress.

[Log in to Demo]
Email: demo@wellfitcommunity.com
Password: ________

What you'll see:
- Community wellness dashboard (daily check-ins, mood tracking, caregiver alerts)
- Clinical care management (bed board, readmission risk, AI progress notes)
- Patient engagement metrics
- Remote patient monitoring

Questions? maria@wellfitcommunity.com
```

### Synthetic Demo Data Requirements

| Data Type | Quantity | Notes |
|-----------|----------|-------|
| Patients | 20-30 | Obviously fake names: "Test Patient Alpha," "Demo Senior Beta" |
| Check-ins | 90 days of history | Mix of compliant and missed for realistic patterns |
| Vitals | BP, HR, SpO2, glucose readings | Normal ranges with a few flagged values |
| Care plans | 5-8 active | Varied conditions: CHF, diabetes, fall risk, post-surgical |
| Risk scores | All 20-30 patients scored | Mix of low/medium/high risk |
| Caregivers | 3-5 linked | Shows the caregiver access flow |
| Bed board | 2 units, 20 beds | Mix of occupied/available/cleaning |

### Security Rules for Demo

- Demo tenant is isolated via RLS (same as any other tenant)
- Demo account has a specific `demo` role or uses admin role with read-heavy permissions
- No real PHI anywhere in demo data — all synthetic (Rule #15 in CLAUDE.md)
- Demo data resets nightly via a scheduled edge function or cron job
- Demo account cannot access other tenants' data
- Rate limit the demo account more aggressively (prevent abuse)
- Log demo usage for analytics (who's looking, what they click on)

### Who Gets the Demo Link

| Audience | What to Show First | Why |
|----------|-------------------|-----|
| Anthropic | Full platform — they want to see technical breadth | Validates their MCP + Claude Code thesis |
| Hospital executives | Readmission dashboard only, then expand | Solve their pain first, impress with depth second |
| Church leaders | Community wellness side (check-ins, caregiver access) | That's what they're buying |
| Investors / grant reviewers | Full platform with the numbers | They're evaluating capability |
| Akima's nursing network | Clinical tools (bed board, AI notes, med reconciliation) | They understand the clinical value immediately |

---

## Move 1: Anthropic Partnership

**Priority: HIGHEST. Do this first.**

You are the best Claude Code case study that exists. A non-engineer built a 170K-line HIPAA healthcare platform with 16 MCP servers using their tool. They need to know about it.

### What You're Asking For

Not traditional VC funding. You're asking for:
1. **Case study feature** — Anthropic publishes your story on their blog/site
2. **Ecosystem fund** — Anthropic has invested in companies building on their platform
3. **MCP showcase** — Your 16 servers are the most complete MCP implementation in healthcare
4. **Conference slot** — Anthropic sponsors events; they could feature you
5. **Direct partnership** — Co-marketing, technical support, early access to new features

Any ONE of these changes your trajectory overnight.

### How to Reach Them

**Option A — Email (do this first)**
- To: developer-relations@anthropic.com, partnerships@anthropic.com
- Also try: sales@anthropic.com with subject flagging it as a case study, not a support request
- CC: any Anthropic employees you've interacted with

**Option B — Social media**
- Post on X/Twitter tagging @AnthropicAI and @alexalbert (Alex Albert, head of Claude relations)
- Post on LinkedIn tagging Anthropic and Dario Amodei
- Post in the Anthropic Discord community channel

**Option C — Claude Code community**
- GitHub discussions on the Claude Code repo: https://github.com/anthropics/claude-code
- Share your story in the community section

### The Email Template

```
Subject: Built a HIPAA healthcare platform with Claude Code — $645 total, zero engineers

Hi Anthropic team,

I'm Maria, AI System Director at Envision VirtualEdge Group. My co-founder
Akima is a registered nurse with 23 years of clinical experience. Neither
of us is a software engineer.

Using Claude Code over 11 months, we built Envision ATLUS — a production
HIPAA-compliant healthcare platform:

- 16 MCP servers (96+ tools) across FHIR, HL7, X12, prior auth, medical
  coding, drug interactions, NPI validation, CMS coverage, and clinical AI
- 169 Supabase edge functions
- 248 database tables with row-level security
- 11,726 tests at 100% pass rate
- ONC 170.315 certification: 27+ criteria ready
- Multi-tenant white-label architecture
- Total development cost: ~$645

The platform is live in production. We've also documented our methodology
for how domain experts (not engineers) can build enterprise software with AI:
[link to AI_DEVELOPMENT_METHODOLOGY.md or a hosted version]

Demo available: [your demo URL with credentials]
GitHub: [repo link if public, or offer private access]

We'd love to discuss:
- Being featured as a Claude Code / MCP case study
- Partnership opportunities
- The Anthropic ecosystem fund

This isn't a theory about AI replacing engineers. It's a working system
built by a superintendent and a nurse, running in production today.

Happy to demo anytime.

Maria
AI System Director, Envision VirtualEdge Group LLC
maria@wellfitcommunity.com
```

### What to Have Ready Before Sending

- [ ] Demo login working (Move 0 above)
- [ ] `AI_DEVELOPMENT_METHODOLOGY.md` hosted somewhere readable (GitHub pages, Notion, or a simple web page)
- [ ] 2-minute screen recording of the platform in action (Loom or similar)
- [ ] The numbers memorized: $645, 11,726 tests, 16 MCP servers, 169 functions, 248 tables, 0 engineers

---

## Move 2: Pick ONE Use Case

**Stop selling the platform. Sell the pain you solve.**

### Option A: Readmission Prevention (Hospitals)

| Element | Detail |
|---------|--------|
| **The pain** | CMS Hospital Readmissions Reduction Program penalizes hospitals up to 3% of Medicare reimbursement. A 500-bed hospital loses $3-10M/year. |
| **Your pitch** | "We connect discharged patients to daily wellness check-ins. Our AI predicts who's at risk of readmission within 30 days. Your care team gets alerts before the patient shows up in the ED again." |
| **What to demo** | `CommunityReadmissionDashboard` — the three views: metrics, high-risk members, active alerts |
| **Who to pitch** | Hospital CFOs, VP of Quality, Chief Nursing Officers |
| **Price point** | $5-15 per monitored patient per month, or value-based (% of penalty savings) |
| **Your advantage** | The community engagement layer (check-ins, mood tracking, caregiver alerts) is what Epic MyChart doesn't have |

### Option B: RPM Revenue (Primary Care / Practices)

| Element | Detail |
|---------|--------|
| **The pain** | Medicare CPT 99453-99458 = $165+/patient/month in RPM revenue. Most practices don't capture it because they lack the tech infrastructure. |
| **Your pitch** | "Your patients are already checking in daily through our app. We turn those check-ins into billable RPM encounters. You generate $300-500K/year in new revenue with no additional staff." |
| **What to demo** | Check-in flow + vitals capture + RPM claim service |
| **Who to pitch** | Practice managers, primary care group administrators, ACO leaders |
| **Price point** | % of RPM revenue generated (revenue share), or flat monthly per provider |
| **Your advantage** | You already have the daily engagement. Most RPM solutions struggle with patient compliance. Your community layer solves that. |

### Option C: Senior Community Wellness (Churches / Senior Living)

| Element | Detail |
|---------|--------|
| **The pain** | Churches and senior living communities have no wellness technology. They track health by "nobody's seen Mrs. Johnson in two weeks." |
| **Your pitch** | "Daily check-ins for your seniors. Mood tracking. Caregiver alerts when someone misses a check-in. Emergency contact escalation. Built for people who aren't tech-savvy." |
| **What to demo** | Check-in flow, caregiver access, missed check-in alerts |
| **Who to pitch** | Church administrators, senior living facility directors, community health orgs |
| **Price point** | $2-5 per user per month, or flat monthly for the organization |
| **Your advantage** | This is your warmest network. Maria is an assistant pastor. Akima has community connections. The sales cycle is weeks, not months. |

### Recommendation

**Start with Option C (churches) for revenue. Pursue Option A (hospitals) for the big win.**

Churches give you:
- Fast sales cycle (pastor says yes, you're in)
- Real users generating real data
- Revenue (even small) proves the model
- Case studies and testimonials for hospital conversations

Hospitals give you:
- The funding narrative ("we have hospital traction")
- High-value contracts ($50K-500K/year per hospital)
- ONC certification justification

**Do both in parallel. Churches fund the company. Hospitals fund the growth.**

---

## Move 3: Get the Letter of Intent

**The hospital president who's interested is your most valuable asset right now.**

One signed LOI — even non-binding — transforms every conversation:
- Anthropic: "A hospital is piloting our MCP-powered platform"
- Investors: "We have healthcare buyer validation"
- Grants: "We have a clinical partner for testing"

### What to Ask For

A one-page letter on hospital letterhead:

```
[Hospital Letterhead]

Letter of Intent — Technology Evaluation

[Hospital Name] has reviewed the Envision ATLUS Intelligent Healthcare
Interoperability System developed by Envision VirtualEdge Group LLC.

We are interested in evaluating the platform's readmission prevention
and care coordination capabilities in a pilot program.

This letter expresses our intent to participate in a pilot evaluation.
It is non-binding and does not constitute a financial commitment.

[Signature]
[Name, Title]
[Date]
```

### How to Get It

- Akima or Maria (whoever has the relationship) schedules a 30-minute demo
- Show ONLY the readmission dashboard and check-in flow
- At the end: "Would you be willing to sign a letter of interest? No cost, no commitment. Just a statement that you'd like to evaluate this."
- Have the letter pre-written. Make it easy to say yes.

### Action Items

- [ ] Identify the hospital president contact (name, email, relationship owner)
- [ ] Prepare a 15-minute demo script (readmission dashboard only)
- [ ] Draft the LOI letter
- [ ] Schedule the meeting
- [ ] After signing: scan and save to `docs/business/` in the repo

---

## Move 4: SBIR/STTR Grants

**Non-dilutive funding designed for exactly what you're doing.**

These grants are federal money for small businesses doing innovation. You keep 100% of your company. Many programs specifically seek non-traditional founders.

### Target Programs

| Program | Agency | Amount | Fit |
|---------|--------|--------|-----|
| **SBIR Phase I** | NIH (NIA, NIMHD, NINR) | $275K | Senior wellness technology, health disparities, nursing informatics |
| **SBIR Phase II** | NIH | $1M+ | Requires Phase I, or can apply for Fast-Track (I+II combined) |
| **LEAP** | ONC | Up to $750K | Health IT innovation — your ONC certification work is directly relevant |
| **AHRQ** | HHS | $150-300K | Care coordination, patient safety, readmission prevention |
| **CMS Innovation Center** | CMS | Varies | Models that reduce cost/improve quality — RPM + readmission prevention |
| **NSF SBIR** | NSF | $275K Phase I | AI/ML innovation — your AI governance methodology qualifies |
| **Minority Business Development** | MBDA | Varies | If applicable — check eligibility |

### Why You're Competitive

Grant reviewers love:
- **Non-traditional founders** — superintendent + nurse, not Stanford CS grads
- **Domain expertise** — 23 years nursing experience is irreplaceable
- **Working prototype** — you're past the idea stage; the product exists
- **HIPAA compliance** — you've already solved the hard regulatory problem
- **Cost efficiency** — $645 development cost demonstrates fiscal responsibility
- **Community impact** — senior wellness, health disparities, care deserts

### How to Apply

1. **Register in SAM.gov** (System for Award Management) — required for all federal grants. Takes 2-4 weeks. **Start this immediately.**
2. **Get a DUNS number** (now UEI) — also required. Free, takes a few days.
3. **Create an account on grants.gov** — where you submit applications
4. **Find open solicitations** — search "health information technology" or "remote patient monitoring" or "care coordination"
5. **Write the application** — or use Claude to draft it based on your existing documentation

### Key Deadlines to Watch

SBIR/STTR have recurring deadlines (usually 3x/year for NIH):
- **NIH SBIR/STTR:** Usually January 5, April 5, September 5
- **ONC:** Check healthit.gov for current solicitations
- **NSF:** Rolling for some programs

### Action Items

- [ ] Register on SAM.gov (do this TODAY — it takes weeks)
- [ ] Get UEI number
- [ ] Create grants.gov account
- [ ] Search for open solicitations matching your profile
- [ ] Draft a 1-page specific aims document (the core of any NIH application)

---

## Move 5: Publish the Story

**The story is the distribution channel.** You don't have a sales team. You have a story that sells itself — if people can find it.

### The Article

**Title:** "How a Superintendent and a Nurse Built Enterprise Healthcare Software With AI — For $645"

**Outline:**

1. **The hook:** We're not engineers. I have a degree in Social and Behavioral Science. Akima is a nurse. We built a HIPAA-compliant healthcare platform with 16 AI servers, 11,726 tests, and ONC certification in progress. Total cost: $645.

2. **The problem we solved:** Healthcare has a 30-day gap between hospital discharge and home. Patients fall through the cracks. Hospitals lose millions in readmission penalties. Nobody connects the hospital to the home.

3. **How we built it:** Using Claude Code and a governance methodology we developed over 11 months. Not prompt engineering — governance engineering. We identified AI's predictable failure modes and built systems to redirect them.

4. **What we learned:** Prompting is not the skill. Domain expertise is the skill. A nurse who knows what medication reconciliation should do is more valuable than an engineer who knows how to code it. AI provides the coding. Humans provide the knowledge.

5. **The methodology:** Five pillars — governance document, autonomous memory, enforcement hooks, cross-AI adversarial auditing, sub-agent governance. Any organization can replicate this.

6. **The call to action:** Link to demo. Link to methodology. Contact info.

### Where to Publish

| Platform | Why | Expected Reach |
|----------|-----|----------------|
| **LinkedIn** | Your existing network + healthcare professionals | 1K-10K views if it resonates |
| **Hacker News** | Tech community, VCs monitor it, high virality | 10K-100K+ views if it hits front page |
| **Health Affairs Blog** | Healthcare policy audience, grant reviewers read it | Targeted but high-value |
| **Medium / Substack** | Permanent, shareable, shows up in Google | Long-tail traffic |
| **Anthropic Discord / Community** | Direct line to people who care about Claude Code | Targeted, leads to partnership |
| **X/Twitter** | Tag @AnthropicAI, @alexalbert__, @daboross | Tech community amplification |

### The LinkedIn Version (Shorter)

```
I'm not an engineer. I have a degree in Social and Behavioral Science.
I'm an assistant pastor and a superintendent.

My co-founder Akima is a registered nurse with 23 years of experience.
She's never written a line of code.

Together, using Claude Code, we built:
- A HIPAA-compliant healthcare platform
- 16 MCP servers with 96+ tools
- 11,726 tests at 100% pass rate
- FHIR, HL7, and X12 interoperability
- ONC certification in progress (27+ criteria ready)
- Remote patient monitoring — fully wired
- Multi-tenant white-label architecture

Total development cost: $645.

This is not a demo. This is production software running on the internet today.

The insight that made it possible: Prompting is NOT the skill.
Governance is the skill.

AI has predictable failure modes. If you identify them and build systems
that redirect AI away from them, you get enterprise-quality output —
regardless of which AI model you use.

We documented the entire methodology. Happy to share.

#HealthIT #AI #ClaudeCode #Healthcare #Innovation
```

### Action Items

- [ ] Write the full article (use Claude to draft from `AI_DEVELOPMENT_METHODOLOGY.md`)
- [ ] Post LinkedIn version this week
- [ ] Submit to Hacker News (title matters — keep it factual, not clickbait)
- [ ] Submit to Health Affairs Blog (they accept pitches)
- [ ] Record a 2-minute Loom video walking through the platform

---

## Move 6: Conferences & Pitch Competitions

**Don't pay for a booth. Apply to speak or pitch.**

### Target Events

| Event | When | What to Do | Why |
|-------|------|-----------|-----|
| **HLTH** | October 2026 | Apply to Startup Showcase, Innovation Stage | Biggest health innovation conference. Investors attend. |
| **ViVE** | March 2027 | Apply to Innovation Theater | Health IT focused. More technical audience. |
| **HIMSS** | March 2027 | Apply to SPARK innovation program | Largest health IT conference. Enterprise buyers attend. |
| **Anthropic events** | Ongoing | Ask to be featured at their developer events | You're their case study |
| **AI Engineer Summit** | Varies | Apply to speak on AI governance methodology | Technical credibility |
| **Local startup pitch nights** | Monthly in most cities | Pitch. Practice. Get feedback. Build network. | Low stakes, high learning |

### Pitch Competition Targets

| Competition | Prize | Fit |
|-------------|-------|-----|
| HLTH Startup Showcase | Exposure + prizes | Healthcare innovation |
| MassChallenge HealthTech | $100K+ in support | Accepts non-traditional founders |
| Blueprint Health | Accelerator program | Healthcare startups |
| Dreamit HealthTech | Accelerator + funding | Healthcare + AI |
| Google for Startups | Cloud credits + mentorship | AI-powered startups |

### Action Items

- [ ] Check HLTH 2026 application deadlines (usually opens 6 months before)
- [ ] Check ViVE 2027 Innovation Theater applications
- [ ] Apply to 2-3 pitch competitions this quarter
- [ ] Prepare a 3-minute pitch (distilled from Move 2)

---

## The Cross-Model Adversarial Loop

**This is your quality assurance methodology. It's why the codebase has zero lint warnings, zero `any` types, and zero CORS wildcards across 170K+ lines. Lead with this when talking to technical audiences.**

### How It Works

```
Claude Code builds the code
        |
        v
ChatGPT reviews the code (adversarial audit)
        |
        v
Maria filters findings (domain expertise decides what matters)
        |
        v
Claude Code fixes what ChatGPT found
        |
        v
Repeat
```

### Why It Works

Claude and ChatGPT have **different blind spots** — not different capabilities, different blind spots. They were trained on different data, with different RLHF, different safety tuning. The bugs Claude misses are not the same bugs ChatGPT misses.

- **ChatGPT is better at finding things that are wrong.** It's a strong critic. It catches patterns, inconsistencies, things that "feel off."
- **Claude is better at fixing things correctly.** It understands the codebase, follows the governance rules, respects the architecture, and makes surgical changes.
- **Maria is the filter.** Neither model has the domain expertise to know whether a finding matters clinically. The human provides judgment.

This is the same principle cybersecurity firms use with red teams — you don't ask the people who built the vault to test the vault.

### Real Results

| Metric | Before Cross-AI Auditing | After |
|--------|--------------------------|-------|
| `any` type violations | 1,400+ | 0 |
| Lint warnings | 1,671 | 0 |
| Edge functions with zero auth | 5+ critical | 0 critical |
| profiles.user_id regressions | 34 (discovered 2026-04-20) | 0 |

### Why This Matters for the Pitch

**To Anthropic:**
> "Your mid-tier model (Sonnet) built most of this platform. Combined with cross-model adversarial auditing — where ChatGPT finds bugs and Claude fixes them — we achieve enterprise-quality output at mid-tier cost. Our governance methodology makes Sonnet enterprise-grade."

**To technical audiences:**
> "No single AI should trust its own output. We use cross-model adversarial testing — different AI finds the problem, our AI fixes the problem, our domain expertise validates the fix. That's why we have zero lint warnings across 170K lines."

**To investors:**
> "The quality isn't from expensive AI. It's from the methodology. Most of this was built with the mid-tier model. The governance system — not the model tier — produces enterprise-quality output. That means anyone with domain expertise can replicate this."

### The Model Progression

The platform was built across four model generations, proving the methodology is model-agnostic:

| Model | Era | What Was Built |
|-------|-----|---------------|
| Claude Opus 4.0 | Early 2025 | Initial scaffolding, core architecture |
| Claude 4.1 | Mid 2025 | Database schema, early services |
| Claude Sonnet 4.5 | Late 2025 | **Bulk of the platform** — FHIR, HL7, MCP servers, test suite |
| Claude Sonnet/Opus 4.6 | Early 2026 | Hardening, adversarial audits, ONC prep |

**Key point:** The governance system (CLAUDE.md, hooks, trackers) survived every model transition. Rules written for Opus 4.0 still apply to Opus 4.6. The methodology is the constant. The model is the variable.

---

## The FHIR/HL7 Story — What People Said Was Impossible

**People said:** "There's no way you can build FHIR." "You have to have HL7 backwards compatibility." "That takes a team of engineers who specialize in healthcare interoperability."

**What actually happened:** Claude scaffolded the entire interoperability layer when Maria asked.

### What We Have

**8,645 lines** of FHIR/HL7/X12 interoperability code in edge functions. **5,394 lines** of frontend FHIR services. **122 database migrations** referencing FHIR/HL7 tables.

#### FHIR R4 (Modern Standard)

| Component | What It Does |
|-----------|-------------|
| 18 FHIR resource types mapped | Patient, MedicationRequest, Condition, Procedure, Observation, Immunization, CarePlan, CareTeam, Practitioner, Encounter, DocumentReference, AllergyIntolerance, Goal, Location, Organization, Medication, DiagnosticReport, PractitionerRole |
| 21 individual resource services | Full CRUD per resource type, plus specialty modules (cardiology, dental, oncology, labor & delivery) |
| Conformance statement | `fhir-metadata` — tells other systems what we support (required by FHIR spec) |
| SMART on FHIR OAuth2 | 5 edge functions: authorize, token, revoke, register-app, configuration |
| Bulk export | Paginated, validated, no `SELECT *` |
| C-CDA export | Consolidated Clinical Document Architecture — required by ONC |
| AI semantic mapper | `ai-fhir-semantic-mapper` — uses Claude to map non-standard data to FHIR |
| Patient summary aggregation | Cross-resource patient context with care team resolution |

#### HL7 v2.x (Legacy Standard — Backwards Compatibility)

| Component | What It Does |
|-----------|-------------|
| HL7 parser | Parses pipe-delimited HL7 v2.x messages (ADT, ORU, ORM) |
| HL7 validator | Validates message structure against expected types |
| HL7 to FHIR converter | Transforms legacy HL7 → modern FHIR R4 |
| HL7 ACK generator | Generates acknowledgment responses (AA, AE, AR) |
| HL7 receiver | Edge function that accepts inbound HL7 messages |

#### X12 EDI (Claims & Prior Auth)

| Component | What It Does |
|-----------|-------------|
| X12 837P generator | Professional claims in EDI format |
| X12 278 generator | Prior authorization requests |
| X12 278 parser | Prior authorization responses |
| X12 parser | General X12 transaction parsing |
| X12 validator | Transaction validation |
| X12 to FHIR converter | EDI → FHIR transformation |

### What This Replaces

| Product/Service | Annual License Cost | We Built It For |
|----------------|--------------------|-----------------| 
| Mirth Connect / NextGen Connect | $50-200K/year | $0 (built-in) |
| Rhapsody Integration Engine | $200-500K/year | $0 (built-in) |
| Health Gorilla FHIR API | $100-300K/year | $0 (built-in) |
| 3M CodeFinder (coding/DRG) | $500K+/year | $0 (MCP server) |
| Surescripts integration | $150-400K/year | In progress (ONC-12) |

### Why This Matters

**For hospital buyers:** "We don't replace Epic. We speak Epic's language. We accept HL7 messages from your systems, transform them into FHIR, and give your AI tools standardized data to work with. No integration project. No middleware vendor. It's built in."

**For ONC certification:** FHIR R4 support is required for multiple ONC criteria. We already have it. That's why 27+ criteria are certified-ready before we even started the gap closure work.

**For investors:** "Healthcare interoperability is a $200K-500K/year line item for every hospital. We eliminated it. That's not a feature — it's a cost structure advantage that makes us competitive at any price point."

**For Anthropic:** "Claude didn't just write application code. It scaffolded a complete FHIR R4 + HL7 v2.x + X12 interoperability layer — the same infrastructure that health IT companies raise $10-50M to build. When Maria asked, Claude built it."

---

## The Numbers (For Every Pitch)

Memorize these. Use them in every conversation.

### Development Numbers

| Metric | Value |
|--------|-------|
| Total development cost | ~$645 |
| Engineers on team | 0 |
| Development time | 11 months |
| Lines of code | 170K+ |
| Tests | 11,726 (100% pass rate) |
| Test suites | 583 |
| Lint warnings | 0 |
| Edge functions | 169 |
| MCP servers | 16 (96+ tools) |
| Database tables | 248 |
| AI clinical skills | 40+ |
| FHIR resource types | 18 (full CRUD) |
| FHIR resource services | 21 (+ specialty modules) |
| HL7/X12 interoperability | Bidirectional (v2.x, 837P, 278, C-CDA) |
| FHIR/HL7 code (edge functions) | 8,645 lines |
| FHIR/HL7 code (frontend services) | 5,394 lines |
| Database migrations (FHIR/HL7) | 122 files |
| SMART on FHIR OAuth | 5 edge functions |
| Primary model used | Sonnet (mid-tier) — not the most expensive model |
| Sessions with Claude Code | 2,100+ |

### Market Numbers

| Metric | Value | Source |
|--------|-------|--------|
| Hospital readmission penalties | $3-10M/year per hospital | CMS HRRP |
| RPM market size | $175B projected by 2027 | Grand View Research |
| RPM revenue per practice (500 patients) | $300-500K/year | CMS CPT 99453-99458 |
| Prior auth admin waste | $35B/year | CAQH Index |
| US hospitals | 6,000+ | AHA |
| Senior living communities | 30,000+ | NIC |
| Traditional dev cost for equivalent platform | $2-5M | Industry benchmarks |

### Comparison Numbers

| What We Built | Traditional Cost | Our Cost | Savings |
|---------------|-----------------|----------|---------|
| Full platform | $2-5M | $645 | 99.97% |
| Integration engine (Mirth/Rhapsody equiv.) | $200-500K/year license | $0 (built-in) | 100% |
| DRG grouper (3M/Optum equiv.) | $500K+/year | $0 (MCP server) | 100% |
| ONC certification prep | $500K-1M (consultants + dev) | ~$645 + Drummond fees | 90%+ |

---

## Who Pitches What

| Audience | Who Leads | Why | What They Show |
|----------|-----------|-----|----------------|
| Churches / community orgs | **Maria** | She's the pastor, she speaks their language | Community wellness, check-ins, caregiver access |
| Hospital executives | **Akima** | She's the nurse, she speaks clinical language | Readmission dashboard, clinical tools |
| Anthropic | **Maria** | She built it with their tool, she knows the methodology | Full platform + methodology doc |
| Grant reviewers | **Both** | Maria for innovation/methodology, Akima for clinical validity | Written application + demo |
| Investors / VCs | **Maria** (lead), Akima (clinical credibility) | Maria tells the story, Akima validates the domain | Pitch deck + demo + LOI |
| Nursing / clinical conferences | **Akima** | She's a peer, they trust her | Clinical workflows, AI-assisted care |
| Tech / AI conferences | **Maria** | She represents the AI governance methodology | Methodology + platform |

---

## Timeline — 90-Day Sprint

### Week 1 (This Week)

- [ ] **Set up demo login** — Create demo tenant, synthetic data, demo credentials
- [ ] **Register on SAM.gov** — Federal grants require this. It takes 2-4 weeks. Start NOW.
- [ ] **Write LinkedIn post** — Use the template above. Post it.
- [ ] **Email Anthropic** — Use the template above. Send it.

### Week 2-3

- [ ] **Demo page live** — Simple landing page with credentials and "what you'll see"
- [ ] **Full article written** — "How a Superintendent and a Nurse Built Enterprise Healthcare Software"
- [ ] **Post to Hacker News** — After the article is live
- [ ] **Contact hospital president** — Schedule the demo meeting
- [ ] **UEI number obtained** — Needed for grants

### Week 4-6

- [ ] **Hospital demo delivered** — 15 minutes, readmission dashboard only
- [ ] **LOI signed** — Non-binding letter on hospital letterhead
- [ ] **SAM.gov registration complete** — Ready to apply for grants
- [ ] **Grants.gov account created** — Search for open solicitations
- [ ] **2-3 church pilots started** — Real users, real data, real feedback

### Week 7-10

- [ ] **SBIR application drafted** — Use AI to help write it from existing docs
- [ ] **HLTH/ViVE applications submitted** — Speaker or startup showcase
- [ ] **Anthropic response received** — Follow up if no response after 2 weeks
- [ ] **Church pilot metrics collected** — User count, check-in compliance, engagement

### Week 11-13

- [ ] **Grant application submitted** — SBIR, AHRQ, or ONC depending on deadlines
- [ ] **First revenue** — Even $100/month from church pilots proves the model
- [ ] **Pitch competition entered** — At least one application submitted
- [ ] **Anthropic case study published** — Or partnership agreement in progress

---

## What NOT to Do

| Don't | Why | Do This Instead |
|-------|-----|----------------|
| Pay for a conference booth | $5-10K with no guaranteed ROI at your stage | Apply to speak or pitch for free |
| Hire a salesperson yet | You need product-market fit first, not a sales team | Sell the first 5 customers yourself |
| Build more features | The product is already beyond what buyers need to see | Sell what you have |
| Try to sell to hospital IT departments | They are gatekeepers whose job is to say "no" | Sell to CFOs, quality directors, practice managers |
| Describe the full platform in first contact | It overwhelms and sounds like you're competing with Epic | Lead with ONE pain point, reveal depth after interest |
| Wait for everything to be perfect | ONC certification, remaining MCP items, god file cleanup | Ship with what you have. Iterate based on customer feedback. |
| Spend money on ads | Wrong stage. You need warm introductions, not cold traffic | Invest time in relationships, not ad spend |
| Give the source code to anyone | It's your IP | Demo access only. Source stays private. |
| Undervalue the AI methodology | It's your second product | Document it. Publish it. It opens doors the platform can't. |

---

## Appendix: Quick Reference — What We Say to Each Audience

### To Anthropic
"We built 16 MCP servers and a full healthcare platform using Claude Code. $645. Zero engineers. You built the protocol — we built the healthcare implementation. We want to be your case study."

### To a Hospital CFO
"Your readmission penalties cost you $X million last year. We keep discharged patients engaged at home with daily check-ins and AI risk prediction. Your care team gets alerts before the patient shows up in the ED again."

### To a Practice Manager
"Medicare pays $165+ per patient per month for remote patient monitoring. Your patients are already checking in through our app. We turn those check-ins into billable RPM encounters. New revenue, no new staff."

### To a Church Leader
"Your seniors need someone checking on them every day. Our app sends daily wellness check-ins, tracks mood and symptoms, and alerts caregivers if someone misses a check-in. Built for people who aren't tech-savvy."

### To an Investor
"Two non-engineers built a HIPAA healthcare platform for $645 using AI. 16 MCP servers, ONC certification in progress, RPM fully wired. A hospital president wants to pilot. We need $500K to close 5 hospital pilots and complete ONC certification."

### To a Grant Reviewer
"We developed a novel AI governance methodology that enables domain experts — not engineers — to build enterprise-grade healthcare software. The result is a production FHIR-enabled, HIPAA-compliant platform addressing readmission prevention and remote patient monitoring in underserved communities. Total development cost: $645."
