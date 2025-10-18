# NurseOS Target Audience Decision Document

## Executive Summary
This document clarifies the target user base for NurseOS and the Emotional Resilience Hub to ensure proper feature alignment and go-to-market strategy.

---

## Decision: Start with **Community/Outpatient Nurses** (CCM/RPM Focus)

**Rationale:**
1. Aligns with existing WellFit infrastructure (CCM Autopilot, remote patient monitoring)
2. Faster time to market (6-8 weeks vs 6-12 months)
3. Lower regulatory barriers (no hospital EHR integration required)
4. Existing revenue stream (CCM billing codes already implemented)
5. Market timing: CMS expanded CCM reimbursement in 2023-2024

---

## Target User Profiles

### Primary Users (Phase 1)

#### 1. **Care Manager RN (Chronic Care Management)**
- **Employer**: ACOs, Medicare Advantage plans, primary care groups
- **Panel Size**: 50-150 chronic disease patients
- **Workflow**: Remote check-ins, phone triage, care plan updates
- **Burnout Drivers**:
  - High volume of patient calls (20-40/day)
  - Emotional labor (lonely seniors, health anxiety)
  - Isolation (working from home or small office)
  - Metric pressure (engagement targets, quality scores)
- **Needs from Resilience Hub**:
  - Daily emotional check-ins (track compassion fatigue)
  - Virtual peer support circles (combat isolation)
  - Boundary-setting training (saying no to after-hours calls)
  - Self-compassion exercises (reduce guilt over missed follow-ups)

#### 2. **Nurse Practitioner (Telehealth/Hybrid)**
- **Employer**: Telehealth companies, primary care clinics, retail health
- **Panel Size**: 15-30 patients/day (telehealth), 100+ active panel
- **Workflow**: Virtual visits, medication management, chronic disease follow-up
- **Burnout Drivers**:
  - Screen fatigue (8-10 hours of video calls)
  - Diagnostic uncertainty (limited physical exam)
  - Scope of practice battles
  - Administrative burden (prior authorizations)
- **Needs from Resilience Hub**:
  - Micro-break reminders (between telehealth visits)
  - Stress management tools (breathing exercises, grounding)
  - Professional development resources (evidence-based practice)
  - Workload analytics (identify overload patterns)

#### 3. **Home Health RN**
- **Employer**: Home health agencies, hospice organizations
- **Caseload**: 25-35 patients (weekly visits)
- **Workflow**: In-home visits, wound care, patient education, care coordination
- **Burnout Drivers**:
  - Driving fatigue (5-8 visits/day across large geography)
  - Safety concerns (unsafe neighborhoods, hoarder homes)
  - Emotional attachment to patients (long-term relationships)
  - Documentation burden (EMR charting after hours)
- **Needs from Resilience Hub**:
  - Trauma support (after difficult patient situations)
  - Safety protocols and resources
  - End-of-shift decompression rituals
  - Compassionate detachment training

#### 4. **Licensed Practical Nurse (LPN) - Skilled Nursing Facility**
- **Employer**: Nursing homes, assisted living facilities
- **Patient Load**: 15-25 residents per shift
- **Workflow**: Medication administration, wound care, resident monitoring
- **Burnout Drivers**:
  - Chronic understaffing (doing RN + CNA work)
  - Moral distress (inadequate staffing = poor care quality)
  - Physical exhaustion (heavy lifting, 12-hour shifts)
  - Lack of professional recognition
- **Needs from Resilience Hub**:
  - Moral injury support resources
  - Advocacy scripts (reporting unsafe conditions)
  - Physical self-care (stretching, ergonomics)
  - Peer validation (shared experiences with other LPNs)

---

### Secondary Users (Phase 2 - Hospital Expansion)

#### 5. **Hospital Bedside RN (Med/Surg, ICU, ER)**
- **Employer**: Hospitals, health systems
- **Patient Load**: 4-6 (ICU) to 6-8 (med/surg) patients per shift
- **Workflow**: 12-hour shifts, direct patient care, rapid response
- **Burnout Drivers**:
  - Shift chaos (codes, emergencies, admissions)
  - Moral distress (end-of-life, futile care)
  - Lateral violence (toxic team dynamics)
  - Mandatory overtime
- **Needs from Resilience Hub**:
  - Post-code debriefing protocols
  - Shift-to-shift handoff notes (Brain Generator)
  - Real-time peer support (during shift)
  - Trauma-informed self-care

#### 6. **Nurse Administrator/Manager**
- **Employer**: Hospitals, clinics, health systems
- **Reports**: 15-50 nurses
- **Workflow**: Staffing, budgeting, performance management, quality metrics
- **Burnout Drivers**:
  - Dual loyalty (staff advocate vs administration pressure)
  - Staffing crisis management
  - Regulatory compliance stress
  - Loss of clinical identity
- **Needs from Resilience Hub**:
  - Team wellness dashboards (monitor staff burnout trends)
  - Leadership resilience training
  - Difficult conversation scripts
  - Boundary setting with administrators

---

## Phase 1 Feature Priorities (Community/Outpatient Focus)

### Must-Have (MVP):
1. **Daily Emotional Check-Ins** (stress, energy, mood + workload indicators)
   - Specifically ask: # patients contacted today, # difficult calls, overtime hours
2. **Maslach Burnout Inventory (MBI)** adapted for outpatient setting
3. **Virtual Peer Support Circles** (async + scheduled video meetings)
4. **Self-Care Resource Library** (apps, articles, crisis hotlines)
5. **Feature Flag System** (enable/disable Resilience Hub per organization)

### Nice-to-Have (v1.1):
6. **Resilience Training Modules** (self-compassion, boundaries, stress management)
7. **Workload Analytics Dashboard** (CCM encounter volume + emotional trends)
8. **Manager Alerts** (when team member hits critical burnout threshold)

### Future (Phase 2 - Hospital):
9. **Post-Code Debriefing** (after patient death or trauma)
10. **Real-Time Shift Support** (mobile push notifications, quick check-ins)
11. **Brain Generator Integration** (auto-handoff notes)

---

## Schema Modifications for Community/Outpatient Nurses

### Updates to `provider_daily_checkins` table:

**Original fields:**
- `shift_type` → Change to `work_setting` (options: 'remote', 'office', 'home_visits', 'telehealth', 'skilled_nursing')
- `patient_load` → Rename to `patients_contacted_today` (more relevant for CCM)
- Add new fields:
  - `difficult_patient_calls` INTEGER (# of emotionally draining calls)
  - `prior_auth_denials` INTEGER (administrative burden metric)
  - `missed_break` BOOLEAN (did you skip lunch?)
  - `after_hours_work` BOOLEAN (charting after shift end)

### Updates to `provider_burnout_assessments`:

**Add community-specific stressors:**
- JSONB field `community_specific_stressors`:
  ```json
  {
    "compassion_fatigue": 7,
    "isolation_from_team": 8,
    "telehealth_screen_fatigue": 6,
    "diagnostic_uncertainty": 5,
    "metric_pressure": 9
  }
  ```

### Updates to `resilience_training_modules`:

**Add community-relevant modules:**
- "Managing Compassion Fatigue in CCM Nursing"
- "Setting Email/Phone Boundaries with Patients"
- "Combating Isolation in Remote Work"
- "Telehealth Ergonomics and Screen Breaks"

---

## Integration with Existing WellFit Features

### Leverage Existing Infrastructure:

1. **CCM Autopilot** → Integrate workload metrics (# CCM encounters) into burnout risk calculation
2. **Nurse Question Manager** → Track time spent answering patient questions as burnout indicator
3. **Risk Assessment** → Patient risk scores (high-risk patient panels = higher provider stress)
4. **Engagement Tracking** → Provider engagement with Resilience Hub = early warning for burnout

### Data Flow:

```
CCM Autopilot (encounters/calls)
      ↓
Provider Workload Metrics (materialized view)
      ↓
Daily Check-In Prompts ("You had 8 high-risk patients today - how are YOU doing?")
      ↓
Burnout Risk Calculation
      ↓
Intervention Triggers (peer support, manager alert, self-care nudge)
```

---

## Go-to-Market Strategy

### Phase 1: Bundled with CCM (6-8 weeks)
- Position as "Nurse Wellness Add-On" to existing CCM Autopilot
- Pricing: +$5/provider/month on top of CCM license
- Target: Organizations already using WellFit CCM

### Phase 2: Standalone SaaS (3-6 months)
- Separate product: "NurseOS Resilience Hub"
- Pricing: $15-25/provider/month
- Target: Home health agencies, telehealth companies, CCM vendors

### Phase 3: Hospital Enterprise (12-24 months)
- Full NurseOS suite (Command Center + Brain + Medication Guardian + Resilience)
- Pricing: Custom enterprise licensing
- Target: Health systems with 500+ nurses

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-10-18 | Focus on community/outpatient nurses (Phase 1) | Aligns with existing CCM infrastructure, faster GTM |
| 2025-10-18 | Defer hospital-based features to Phase 2 | Requires EHR integration, longer sales cycle |
| 2025-10-18 | Use modular monolith architecture | Avoid microservice complexity while maintaining module boundaries |
| 2025-10-18 | Feature flags for gradual rollout | Enable A/B testing, incremental deployment |

---

## Next Steps for Engineering Team

1. ✅ **Schema Design** - Completed (see [resilience-hub-schema.sql](./resilience-hub-schema.sql))
2. ⏳ **ADR Creation** - In progress (modular architecture, feature flags)
3. ⏳ **TypeScript Types** - Define FHIR-aligned types for burnout resources
4. ⏳ **Service Layer** - Build `resilienceHubService.ts` with RPC calls
5. ⏳ **UI Components** - React components for NursePanel integration
6. ⏳ **Feature Flag UI** - Admin settings to enable/disable Resilience Hub
7. ⏳ **Migration Script** - Supabase migration for new tables
8. ⏳ **Seed Data** - Default resilience modules and resources
9. ⏳ **Testing** - Unit tests for service layer
10. ⏳ **Documentation** - User guide for nurses + admin configuration guide

---

## Appendix: User Research Insights

### Burnout Statistics (Community/Outpatient):
- **Home health nurses**: 52% burnout rate (highest among all nursing specialties)
- **Telehealth providers**: 47% report screen fatigue as top stressor
- **CCM nurses**: 62% work beyond scheduled hours (unpaid charting)
- **Compassion fatigue**: 71% of community nurses report symptoms

### ROI for Organizations:
- Average cost to replace one nurse: $52,000 (2023 NSI National Health Care Retention Report)
- Burnout reduction of 15% = $7,800 saved per retained nurse
- Break-even: If Resilience Hub retains 1 nurse per 50 users, it pays for itself

### References:
- American Nurses Association. (2023). Healthy Nurse, Healthy Nation Survey.
- National Council of State Boards of Nursing. (2023). Nursing Workforce Study.
- Agency for Healthcare Research and Quality. (2024). Burnout in Community Health Settings.
