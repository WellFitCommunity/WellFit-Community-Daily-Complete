# ADR-001: Emotional Resilience Hub Architecture

**Status**: Proposed
**Date**: 2025-10-18
**Deciders**: Engineering team, Product leadership
**Decision Type**: Architectural

---

## Context and Problem Statement

WellFit is expanding NurseOS to include an **Emotional Resilience Hub** for burnout prevention in community/outpatient nurses (care managers, NPs, home health RNs, LPNs in skilled nursing).

Key questions:
1. Should this be a **microservice** or **module within the existing monolith**?
2. How do we enable **standalone sales** (NurseOS only) vs **bundled sales** (WellFit + NurseOS)?
3. How do we avoid **tech debt** while maintaining **code integrity** and **schema cleanliness**?
4. How do we ensure **zero duplication** of FHIR Practitioner resources?
5. What's the **handoff strategy** for future engineers?

---

## Decision Drivers

### Business Requirements:
- **Bundled sales**: Sell Resilience Hub as add-on to existing CCM Autopilot customers
- **Standalone sales**: Sell NurseOS Resilience Hub to organizations not using WellFit community features
- **Feature flags**: Enable/disable modules per organization (licensing tiers)
- **Fast time to market**: 6-8 week MVP for Phase 1

### Technical Requirements:
- **FHIR compliance**: Reuse existing FHIR Practitioner resources (no duplication)
- **HIPAA compliance**: PHI protection, audit logging, RLS policies
- **Zero tech debt**: Clean schema, proper foreign keys, no orphaned data
- **Maintainability**: Clear module boundaries, easy to test
- **Performance**: Sub-200ms API responses, efficient database queries

### Operational Requirements:
- **Single deployment**: Minimize operational complexity
- **Gradual rollout**: Feature flags for A/B testing
- **Monitoring**: Track burnout trends across organization
- **Scalability**: Support 1,000+ providers per organization

---

## Considered Options

### Option 1: Modular Monolith with Feature Flags ✅ (Selected)

**Architecture:**
```
WellFit Platform (Single Deployment)
├── Core Module
│   ├── Supabase Auth (shared)
│   ├── FHIR Resources (shared: Practitioners, Encounters, etc.)
│   └── RLS Policies
│
├── Patient Module
│   ├── CheckInTracker (patient emotional state)
│   ├── PHQ-9/GAD-7 (depression/anxiety screening)
│   └── Community features
│
└── NurseOS Module ← NEW
    ├── CCM Autopilot (existing)
    ├── Command Center (existing)
    ├── Resilience Hub (new - toggled via feature flag)
    │   ├── provider_burnout_assessments table
    │   ├── provider_daily_checkins table
    │   ├── resilience_training_modules table
    │   ├── provider_support_circles table
    │   └── resilienceHubService.ts
    └── Future: Brain Generator, Medication Guardian
```

**Database Strategy:**
- **Single PostgreSQL instance** (Supabase)
- **Shared tables**: `fhir_practitioners`, `auth.users`, `profiles`, `encounters`
- **Module-specific tables**: Prefixed with `provider_*` for NurseOS Resilience Hub
- **Foreign keys**: All `provider_*` tables reference `fhir_practitioners(id)` and `auth.users(id)`
- **RLS policies**: Separate policies for patient vs provider data (minimum necessary principle)

**Feature Flags:**
- `nurseos_feature_flags` table with keys: `resilience_hub`, `command_center`, `brain_generator`, `medication_guardian`
- Frontend: Conditional rendering based on feature flag state
- Backend: RPC functions check feature flag before executing

**Standalone Deployment:**
- **Phase 1 (Now)**: Feature flags hide patient/community UI when `standalone: true`
- **Phase 2 (6-12 months)**: Separate React app (`nurseos-app/`) that shares backend API
- **Phase 3 (12-24 months)**: Extract to microservice if revenue justifies operational overhead

**Pros:**
- ✅ Shared FHIR resources (zero duplication)
- ✅ Single deployment (low operational overhead)
- ✅ Atomic database transactions (burnout assessment + encounter data)
- ✅ Faster time to market (no inter-service communication)
- ✅ Easier debugging (single codebase)
- ✅ Feature flags enable gradual rollout and A/B testing
- ✅ Clear path to microservice extraction later

**Cons:**
- ⚠️ Requires discipline to maintain module boundaries (enforce via code reviews)
- ⚠️ Larger codebase (but organized into clear directories)
- ⚠️ Harder to scale modules independently (unlikely to be needed at current scale)

---

### Option 2: Microservices from Day 1 ❌ (Rejected)

**Architecture:**
```
├── WellFit Core Service
│   ├── Patient features
│   └── Community features
│
├── NurseOS Resilience Hub Service (separate deployment)
│   ├── Own database
│   ├── FHIR Practitioner copy (duplicate!)
│   └── REST API to WellFit Core
│
└── API Gateway (routes requests)
```

**Pros:**
- ✅ Clear service boundaries
- ✅ Can scale independently
- ✅ Can sell as truly separate product

**Cons:**
- ❌ **Duplicate FHIR Practitioner data** (sync nightmare)
- ❌ **Distributed transactions** (burnout + workload data across services)
- ❌ 3-5x operational overhead (separate deployments, monitoring, logging)
- ❌ Longer time to market (inter-service communication, API versioning)
- ❌ Network latency (cross-service calls)
- ❌ **Premature optimization** (not needed at current scale)

**Decision:** Rejected. Microservices are overkill for Phase 1. Revisit at 10,000+ providers or $1M+ ARR from NurseOS alone.

---

### Option 3: Separate Database Schema (Logical Separation) ❌ (Rejected)

**Architecture:**
```
Single PostgreSQL Instance
├── public schema (shared: auth, FHIR)
├── patient schema (patient-facing tables)
└── nurseos schema (provider-facing tables)
```

**Pros:**
- ✅ Logical separation of concerns
- ✅ Namespace clarity

**Cons:**
- ❌ **Foreign key constraints across schemas** (Supabase RLS complications)
- ❌ More complex queries (`nurseos.provider_burnout JOIN public.fhir_practitioners`)
- ❌ Harder to manage migrations (multiple schema changes)
- ❌ **Overkill** for current needs

**Decision:** Rejected. Use table prefixes (`provider_*`) instead of separate schemas. Simpler for current scale.

---

## Decision Outcome

**Selected: Option 1 - Modular Monolith with Feature Flags**

### Implementation Plan:

#### Phase 1: MVP (Weeks 1-8)
1. **Database Schema** (Week 1)
   - Create `provider_burnout_assessments`, `provider_daily_checkins`, `resilience_training_modules`, `provider_training_completions`, `resilience_resources`, `nurseos_feature_flags`
   - Add foreign keys to `fhir_practitioners` and `auth.users`
   - Implement RLS policies (providers see own data, admins see all)

2. **Service Layer** (Week 2-3)
   - Create `src/services/resilienceHubService.ts`
   - RPC functions: `submitDailyCheckin()`, `getBurnoutAssessments()`, `getResilienceModules()`, `trackModuleCompletion()`
   - Helper functions: `calculateBurnoutRisk()`, `checkInterventionNeeded()`

3. **TypeScript Types** (Week 2)
   - Define types in `src/types/nurseos.ts` aligned with FHIR naming conventions
   - `ProviderBurnoutAssessment`, `ProviderDailyCheckin`, `ResilienceModule`, `SupportCircle`

4. **UI Components** (Week 4-6)
   - `src/components/nurseos/ResilienceHubDashboard.tsx` - Main dashboard
   - `src/components/nurseos/DailyCheckinForm.tsx` - Quick check-in
   - `src/components/nurseos/BurnoutAssessmentForm.tsx` - MBI questionnaire
   - `src/components/nurseos/ResilienceLibrary.tsx` - Training modules browser
   - `src/components/nurseos/SupportCircles.tsx` - Peer support UI

5. **NursePanel Integration** (Week 7)
   - Add "Emotional Resilience Hub 🧘" collapsible section to NursePanel
   - Feature flag check: Only render if `resilience_hub` enabled
   - Role-based access: `allowedRoles={['nurse', 'admin', 'super_admin']}`

6. **Feature Flag UI** (Week 7)
   - Add toggle to AdminSettingsPanel for super admins
   - `enable_resilience_hub` boolean setting

7. **Testing** (Week 8)
   - Unit tests: `resilienceHubService.test.ts`
   - Integration tests: Daily check-in flow, burnout assessment scoring
   - RLS policy tests: Ensure providers can't see others' data

8. **Documentation** (Week 8)
   - User guide: How nurses use Resilience Hub
   - Admin guide: How to enable/configure
   - API documentation: Service layer functions

#### Phase 2: Standalone App (Months 3-6)
9. **Separate React App** (optional if standalone sales needed)
   - Create `apps/nurseos-app/` directory
   - Share `src/services/`, `src/types/`, Supabase client
   - Hide patient/community features (only show NurseOS modules)
   - Separate deployment: `nurseos.wellfit.app`

10. **Branding & Theming**
    - Custom logo/colors for standalone NurseOS
    - White-label option for enterprise customers

#### Phase 3: Advanced Features (Months 6-12)
11. **Manager Dashboard**
    - Aggregate burnout trends across team
    - Early warning system (critical burnout alerts)
    - Intervention tracking (did manager follow up?)

12. **Workload Balancing**
    - Auto-redistribute CCM patient panel when provider hits high burnout
    - Integrate with CCM Autopilot scheduling

13. **Longitudinal Analytics**
    - Burnout trajectory graphs (3-month, 6-month trends)
    - Correlation analysis (workload vs burnout)

---

## Module Boundaries & Code Organization

### Directory Structure:

```
src/
├── components/
│   ├── nurseos/                     ← NEW
│   │   ├── ResilienceHubDashboard.tsx
│   │   ├── DailyCheckinForm.tsx
│   │   ├── BurnoutAssessmentForm.tsx
│   │   ├── ResilienceLibrary.tsx
│   │   ├── SupportCircles.tsx
│   │   └── __tests__/
│   ├── nurse/                       ← EXISTING
│   │   └── NursePanel.tsx           (add Resilience Hub section)
│   ├── admin/                       ← EXISTING
│   │   └── AdminSettingsPanel.tsx   (add feature flag toggle)
│   └── patient/                     ← EXISTING
│       └── (patient-facing components)
│
├── services/
│   ├── resilienceHubService.ts      ← NEW
│   ├── fhirResourceService.ts       ← EXISTING (PractitionerService)
│   ├── encounterService.ts          ← EXISTING (workload data)
│   └── ccmAutopilotService.ts       ← EXISTING (integration point)
│
├── types/
│   ├── nurseos.ts                   ← NEW
│   ├── fhir.ts                      ← EXISTING
│   └── index.ts
│
└── lib/
    ├── nurseApi.ts                  ← EXISTING
    └── resilienceHubApi.ts          ← NEW (RPC wrappers)

supabase/
└── migrations/
    └── 20251018000000_resilience_hub.sql  ← NEW

docs/
└── nurseos/                         ← NEW
    ├── resilience-hub-schema.sql
    ├── target-audience-decision.md
    ├── ADR-001-resilience-hub-architecture.md
    └── user-guide.md                (TODO)
```

### Enforcing Module Boundaries:

**ESLint Rule** (to be added to `.eslintrc.json`):
```json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [
        {
          "group": ["../patient/*"],
          "message": "NurseOS modules should not import patient-facing components. Use shared services instead."
        }
      ]
    }]
  }
}
```

**Import Rules:**
- ✅ NurseOS can import: `services/`, `types/`, `contexts/AdminAuthContext`
- ✅ NurseOS can import: `fhirResourceService.ts` (PractitionerService)
- ❌ NurseOS should NOT import: `patient/` components
- ❌ Patient components should NOT import: `nurseos/` components

---

## Feature Flag Implementation

### Database Table:

```sql
CREATE TABLE nurseos_feature_flags (
  id UUID PRIMARY KEY,
  feature_key TEXT UNIQUE NOT NULL,
  feature_name TEXT NOT NULL,
  description TEXT,
  is_enabled_globally BOOLEAN DEFAULT FALSE,
  required_license_tier TEXT DEFAULT 'standard',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

INSERT INTO nurseos_feature_flags (feature_key, feature_name, is_enabled_globally, required_license_tier)
VALUES
  ('resilience_hub', 'Emotional Resilience Hub', FALSE, 'standard'),
  ('command_center', 'Nurse Command Center', TRUE, 'basic'),
  ('brain_generator', 'Nurse Brain Generator', FALSE, 'standard'),
  ('medication_guardian', 'Medication Guardian', FALSE, 'premium');
```

### Service Function:

```typescript
// src/services/featureFlagService.ts
export const isFeatureEnabled = async (featureKey: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('nurseos_feature_flags')
    .select('is_enabled_globally')
    .eq('feature_key', featureKey)
    .single();

  if (error || !data) return false;
  return data.is_enabled_globally;
};
```

### UI Usage:

```tsx
// In NursePanel.tsx
import { isFeatureEnabled } from '../../services/featureFlagService';

export default function NursePanel() {
  const [resilienceHubEnabled, setResilienceHubEnabled] = useState(false);

  useEffect(() => {
    isFeatureEnabled('resilience_hub').then(setResilienceHubEnabled);
  }, []);

  return (
    <div>
      {/* Existing sections */}

      {resilienceHubEnabled && (
        <CollapsibleSection title="Emotional Resilience Hub 🧘" defaultOpen={false}>
          <ResilienceHubDashboard />
        </CollapsibleSection>
      )}
    </div>
  );
}
```

---

## Data Ownership & RLS Policies

### Principle: **Minimum Necessary (HIPAA Compliance)**

**Provider Data Access:**
- Providers can **read** their own burnout assessments, check-ins, training completions
- Providers can **write** their own data
- Providers can **read** resilience modules and resources (public)
- Providers can **read** support circle content if they're a member

**Admin Data Access:**
- Admins/care managers can **read** all provider burnout data (for intervention)
- Admins can **NOT** write to individual provider assessments (no data manipulation)
- Super admins can **manage** feature flags

**Example RLS Policy:**
```sql
-- Providers can view own burnout assessments
CREATE POLICY "Providers can view own burnout assessments"
  ON provider_burnout_assessments FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all (for intervention purposes)
CREATE POLICY "Admins can view all burnout assessments"
  ON provider_burnout_assessments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'care_manager')
    )
  );
```

---

## Integration with Existing Features

### 1. CCM Autopilot Integration

**Data Flow:**
```
CCM Autopilot
  ↓ (track encounters)
encounters table
  ↓ (aggregate by provider)
provider_workload_metrics (materialized view)
  ↓ (join with check-ins)
Burnout Risk Calculation
  ↓ (if high risk)
Intervention Trigger (peer support, workload reduction)
```

**SQL Join:**
```sql
SELECT
  p.id,
  get_practitioner_full_name(p.*) AS name,
  COUNT(e.id) AS encounters_last_30_days,
  AVG(pdc.stress_level) AS avg_stress,
  CASE
    WHEN COUNT(e.id) > 150 AND AVG(pdc.stress_level) >= 8 THEN 'high_risk'
    ELSE 'normal'
  END AS intervention_needed
FROM fhir_practitioners p
LEFT JOIN encounters e ON e.provider_id = p.id
  AND e.date_of_service >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN provider_daily_checkins pdc ON pdc.practitioner_id = p.id
  AND pdc.checkin_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY p.id;
```

### 2. Nurse Question Manager Integration

**Use Case:** High volume of patient questions → Track as workload indicator

**Implementation:**
- Count questions claimed by each nurse per day
- If > 20 questions/day for 5+ consecutive days → Flag as burnout risk
- Prompt daily check-in: "You answered 25 questions today. How are you feeling?"

**SQL Function:**
```sql
CREATE OR REPLACE FUNCTION get_nurse_question_volume(p_user_id UUID, days INTEGER)
RETURNS INTEGER AS $$
  SELECT COUNT(*)
  FROM nurse_questions
  WHERE claimed_by = p_user_id
  AND claimed_at >= CURRENT_DATE - (days || ' days')::INTERVAL;
$$ LANGUAGE sql;
```

### 3. Risk Assessment Integration

**Use Case:** Providers managing high-risk patient panels experience more stress

**Implementation:**
- Join `patient_risk_scores` with `encounters` by provider
- Calculate % of high-risk patients per provider's panel
- High-risk patient ratio > 40% → Increase burnout risk score

---

## Migration Strategy (Zero-Downtime)

### Step 1: Schema Migration (Non-Breaking)
```sql
-- Add new tables (doesn't affect existing app)
CREATE TABLE provider_burnout_assessments (...);
CREATE TABLE provider_daily_checkins (...);
-- etc.

-- RLS policies prevent accidental access
ALTER TABLE provider_burnout_assessments ENABLE ROW LEVEL SECURITY;
```

### Step 2: Deploy Backend Code
- Add `resilienceHubService.ts` (new file, no changes to existing services)
- Deploy Edge Functions if needed

### Step 3: Deploy Frontend (Feature Flagged)
- Deploy NursePanel with Resilience Hub section (hidden by default)
- Feature flag `resilience_hub` = FALSE globally

### Step 4: Enable for Beta Users
- Super admin enables `resilience_hub` feature flag in AdminSettings
- Only beta organization sees new section

### Step 5: Gradual Rollout
- Monitor usage, performance, errors
- Enable for 10% → 50% → 100% of organizations

---

## Testing Strategy

### Unit Tests:
```typescript
// resilienceHubService.test.ts
describe('calculateBurnoutRisk', () => {
  it('returns critical for high emotional exhaustion + depersonalization', () => {
    const assessment = {
      emotional_exhaustion_score: 85,
      depersonalization_score: 75,
      personal_accomplishment_score: 20,
    };
    expect(calculateBurnoutRisk(assessment)).toBe('critical');
  });
});
```

### Integration Tests:
- Test full daily check-in flow (submit → retrieve → display)
- Test RLS policies (provider can't see other providers' data)
- Test intervention triggers (high burnout → auto-create support circle invitation)

### Performance Tests:
- Materialized view refresh time (< 5 seconds for 1,000 providers)
- Dashboard load time (< 200ms)
- Concurrent daily check-ins (100 providers simultaneously)

---

## Monitoring & Observability

### Metrics to Track:
1. **Adoption**: % of providers who completed at least one daily check-in
2. **Engagement**: Average check-ins per week per provider
3. **Burnout Trends**: Median burnout score across organization over time
4. **Intervention Effectiveness**: Change in burnout score after intervention
5. **Module Completion**: % of providers who completed at least one resilience module

### Alerts:
- **Critical burnout spike**: > 10% of providers hit critical level in one week
- **Low engagement**: < 20% daily check-in rate for 2+ weeks
- **System performance**: Dashboard load time > 1 second

### Dashboard (for Admins):
- Line chart: Average burnout score over 6 months
- Heatmap: Burnout risk by team/department
- Table: Providers needing intervention (sorted by risk score)

---

## Security & Compliance

### HIPAA Considerations:
- **PHI Data**: Provider emotional data is PHI (protected health information)
- **Encryption**: At rest (Supabase RLS), in transit (TLS)
- **Access Logs**: Audit trail for who accessed burnout data
- **Minimum Necessary**: RLS ensures providers only see own data

### Consent:
- Providers opt-in to Resilience Hub participation
- Clear privacy policy: "Your burnout data is confidential. Only aggregate trends shared with managers."
- Option to delete all burnout data on request (GDPR compliance)

### Anonymization:
- Support circle reflections can be anonymous
- Aggregate reports show trends, not individual names

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Low adoption (providers don't use it) | Medium | High | Gamification, manager encouragement, integrate with existing workflows (auto-prompt after CCM shifts) |
| Privacy concerns (providers fear data used against them) | Medium | High | Clear privacy policy, RLS, option for anonymous check-ins, no punitive use of data |
| Tech debt from poor module boundaries | Medium | Medium | ESLint rules, code reviews, ADR documentation |
| Performance issues (slow dashboard) | Low | Medium | Materialized views, database indexes, caching |
| Scope creep (too many features in Phase 1) | High | Medium | Strict MVP definition, ruthless prioritization |

---

## Success Criteria

### Phase 1 Success (8 weeks):
- ✅ 50%+ of nurses in beta organization complete at least 3 daily check-ins
- ✅ Sub-200ms dashboard load time
- ✅ Zero P0/P1 bugs in production
- ✅ Positive feedback from 80%+ of beta users

### Phase 2 Success (6 months):
- ✅ 5+ organizations using Resilience Hub as standalone product
- ✅ Measured 10%+ reduction in burnout scores over 3 months
- ✅ Retention: 1+ nurse retained due to Resilience Hub intervention (ROI positive)

---

## Alternatives Considered (and Why Rejected)

### Alternative 1: Use Existing Patient Emotional Wellness Features
**Idea:** Repurpose CheckInTracker and PHQ-9 for providers

**Why Rejected:**
- Different user needs (patients vs providers)
- Different stressors (chronic disease vs caregiver burnout)
- Confusing UX (mixing patient and provider data)
- HIPAA risk (patient and provider PHI in same tables)

### Alternative 2: Buy Off-the-Shelf Burnout Tool (BetterHelp, Ginger, etc.)
**Idea:** Integrate third-party wellness app instead of building

**Why Rejected:**
- No integration with WellFit workload data (encounters, CCM calls)
- Generic content (not healthcare-specific)
- Expensive ($$30-50/user/month vs $5-15 if we build)
- Data silos (can't correlate burnout with patient outcomes)

### Alternative 3: Build as Chrome Extension
**Idea:** Lightweight plugin for existing EHRs

**Why Rejected:**
- Can't access WellFit encounter data
- Limited UI real estate
- Browser compatibility issues
- Doesn't solve standalone deployment question

---

## Open Questions & Future Decisions

1. **Should we support SSO (SAML/OIDC) for standalone NurseOS?**
   - Decision needed by: Phase 2 (Month 3)
   - Blocker: Enterprise customers may require SSO

2. **Should peer support circles support video meetings (Zoom/Teams integration)?**
   - Decision needed by: Phase 1 completion review
   - Research: Do nurses prefer async text or sync video?

3. **Should we build mobile app (React Native) for daily check-ins?**
   - Decision needed by: Month 6
   - Research: Usage data - do nurses access from mobile during shifts?

4. **FHIR Questionnaire resource for MBI assessments?**
   - Decision needed by: Phase 2
   - Benefit: Interoperability with other EHR systems

---

## References

1. Maslach, C., & Leiter, M. P. (2016). Understanding the burnout experience. World Psychiatry, 15(2), 103-111.
2. American Nurses Association (2023). Healthy Nurse, Healthy Nation Survey.
3. Supabase RLS Best Practices: https://supabase.com/docs/guides/auth/row-level-security
4. FHIR R4 Practitioner Resource: https://www.hl7.org/fhir/practitioner.html
5. Modular Monolith Pattern: https://www.kamilgrzybek.com/blog/posts/modular-monolith-primer

---

## Appendix A: Full Database ERD

```
┌─────────────────────────────┐
│   fhir_practitioners        │ ← EXISTING (SHARED)
│─────────────────────────────│
│ id (PK)                     │
│ user_id (FK → auth.users)   │
│ npi                         │
│ family_name                 │
│ given_names                 │
│ specialties[]               │
└─────────────────────────────┘
         ↑
         │ (FK practitioner_id)
         │
┌─────────────────────────────┐
│ provider_burnout_assessments│ ← NEW
│─────────────────────────────│
│ id (PK)                     │
│ practitioner_id (FK)        │
│ user_id (FK → auth.users)   │
│ assessment_date             │
│ emotional_exhaustion_score  │
│ depersonalization_score     │
│ personal_accomplishment_    │
│   score                     │
│ composite_burnout_score     │ (GENERATED)
│ risk_level                  │ (GENERATED)
│ intervention_triggered      │
└─────────────────────────────┘

┌─────────────────────────────┐
│  provider_daily_checkins    │ ← NEW
│─────────────────────────────│
│ id (PK)                     │
│ practitioner_id (FK)        │
│ user_id (FK)                │
│ checkin_date                │
│ work_setting                │
│ stress_level                │
│ energy_level                │
│ patients_contacted_today    │
│ difficult_patient_calls     │
│ overtime_hours              │
│ missed_break                │
└─────────────────────────────┘

┌─────────────────────────────┐
│ resilience_training_modules │ ← NEW
│─────────────────────────────│
│ id (PK)                     │
│ title                       │
│ category                    │
│ content_type                │
│ evidence_based              │
│ is_active                   │
└─────────────────────────────┘
         ↑
         │ (FK module_id)
         │
┌─────────────────────────────┐
│ provider_training_completions│ ← NEW
│─────────────────────────────│
│ id (PK)                     │
│ practitioner_id (FK)        │
│ module_id (FK)              │
│ started_at                  │
│ completed_at                │
│ found_helpful               │
└─────────────────────────────┘

┌─────────────────────────────┐
│ provider_support_circles    │ ← NEW
│─────────────────────────────│
│ id (PK)                     │
│ name                        │
│ meeting_frequency           │
│ is_active                   │
└─────────────────────────────┘
         ↑
         │
         ├─────────────────────┐
         │                     │
┌────────────────────┐  ┌──────────────────────┐
│ provider_support_  │  │ provider_support_    │
│ circle_members     │  │ reflections          │
│────────────────────│  │──────────────────────│
│ circle_id (FK)     │  │ circle_id (FK)       │
│ practitioner_id    │  │ author_id (FK)       │
│ joined_at          │  │ reflection_text      │
│ is_active          │  │ is_anonymous         │
└────────────────────┘  └──────────────────────┘

┌─────────────────────────────┐
│ encounters                  │ ← EXISTING (SHARED)
│─────────────────────────────│
│ provider_id                 │
│ patient_id                  │
│ date_of_service             │
└─────────────────────────────┘
         ↓
         │ (aggregate for workload)
         ↓
┌─────────────────────────────┐
│ provider_workload_metrics   │ ← NEW (MAT VIEW)
│─────────────────────────────│
│ practitioner_id             │
│ encounters_this_month       │
│ avg_stress_last_7_days      │
│ latest_burnout_score        │
└─────────────────────────────┘
```

---

## Appendix B: Handoff Checklist for Future Engineers

### Before You Start:
- [ ] Read this ADR fully
- [ ] Read [target-audience-decision.md](./target-audience-decision.md)
- [ ] Review database schema: [resilience-hub-schema.sql](./resilience-hub-schema.sql)
- [ ] Understand existing FHIR Practitioner implementation: [supabase/migrations/20251017150000_fhir_practitioner_complete.sql](../../supabase/migrations/20251017150000_fhir_practitioner_complete.sql)

### Implementation Order:
1. **Database** → 2. **Types** → 3. **Service Layer** → 4. **UI Components** → 5. **Testing**

### Critical Files to Create:
- [ ] `supabase/migrations/20251018000000_resilience_hub.sql`
- [ ] `src/types/nurseos.ts`
- [ ] `src/services/resilienceHubService.ts`
- [ ] `src/components/nurseos/ResilienceHubDashboard.tsx`
- [ ] `src/services/__tests__/resilienceHubService.test.ts`

### Critical Files to Modify:
- [ ] `src/components/nurse/NursePanel.tsx` (add Resilience Hub section)
- [ ] `src/components/admin/AdminSettingsPanel.tsx` (add feature flag toggle)
- [ ] `src/types/index.ts` (export new types)

### Non-Negotiables (Zero Tech Debt):
- ✅ All `provider_*` tables MUST have foreign keys to `fhir_practitioners` and `auth.users`
- ✅ All tables MUST have RLS policies (no public access)
- ✅ All database writes MUST use parameterized queries (no SQL injection)
- ✅ All service functions MUST have TypeScript return types
- ✅ All new components MUST have tests (>80% coverage)
- ✅ All burnout scores MUST use DECIMAL (not FLOAT) for precision

### Code Review Checklist:
- [ ] Module boundaries respected (no `patient/` imports in `nurseos/`)
- [ ] Feature flag checked before rendering UI
- [ ] RLS policies tested (provider can't see others' data)
- [ ] Error handling present (API failures gracefully handled)
- [ ] Accessibility: ARIA labels, keyboard navigation
- [ ] Performance: Queries use indexes, no N+1 problems

### Questions? Contact:
- Architecture decisions: [Reference this ADR]
- Database schema: [Reference resilience-hub-schema.sql]
- FHIR alignment: [Reference FHIR R4 Practitioner spec]

---

**Document Control:**
- **Version**: 1.0
- **Last Updated**: 2025-10-18
- **Next Review**: After Phase 1 completion (Week 8)
- **Maintained By**: Engineering team
