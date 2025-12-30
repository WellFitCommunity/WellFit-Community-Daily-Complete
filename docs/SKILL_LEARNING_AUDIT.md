# AI Skills Learning Loop Audit

> Generated: December 2025
> Purpose: Identify skills that could benefit from proactive confirmation and continuous learning

---

## Current Learning Systems

| System | Type | Status | Notes |
|--------|------|--------|-------|
| **Voice Learning Service** | Proactive | ✅ ENHANCED | "Did I hear correctly?" + manual corrections |
| **Guardian Agent** | Passive | ✅ Active | Learns from error patterns automatically |
| **Behavior Tracking** | Passive | ✅ Active | Learns UI preferences automatically |
| **Dashboard Personalization** | Passive | ✅ Active | Adapts layout based on usage |

---

## Skills Needing Learning Loops (Priority Order)

### High Priority - Direct Patient Impact

These skills generate clinical content that providers edit. Learning from edits would significantly improve accuracy.

| # | Skill | Current State | Recommended Learning Pattern |
|---|-------|---------------|------------------------------|
| 18 | **SOAP Note Auto-Generator** | No learning | Track edits to generated notes, learn provider preferences for section length, terminology, and structure |
| 20 | **Care Plan Auto-Generator** | No learning | Learn from goal modifications, intervention adjustments, and timeline changes |
| 26 | **Medication Reconciliation AI** | No learning | Learn from pharmacist corrections to discrepancy analysis |
| 25 | **Contraindication Detector** | No learning | Track false positives/negatives, learn from overrides with reason |
| 23 | **Treatment Pathway Recommender** | No learning | Track which recommendations providers accept/reject |

### Medium Priority - Documentation Quality

These skills generate documentation that could improve with provider feedback.

| # | Skill | Current State | Recommended Learning Pattern |
|---|-------|---------------|------------------------------|
| 19 | **Discharge Summary Generator** | No learning | Learn section preferences, common additions, tone |
| 21 | **Progress Note Synthesizer** | No learning | Learn which trends providers find most relevant |
| 22 | **Referral Letter Generator** | No learning | Learn specialist preferences, formatting, detail level |
| 17 | **Caregiver Briefing Generator** | No learning | Learn family communication preferences, detail level |
| 29 | **Medication Instructions Generator** | No learning | Learn patient education preferences by condition |

### Medium Priority - Risk Assessment

These skills make predictions that could improve with outcome feedback.

| # | Skill | Current State | Recommended Learning Pattern |
|---|-------|---------------|------------------------------|
| 30 | **Fall Risk Predictor** | No learning | Track actual falls vs predictions, learn local risk factors |
| 31 | **Medication Adherence Predictor** | No learning | Track actual adherence vs predictions |
| 32 | **Care Escalation Scorer** | No learning | Track escalation outcomes, learn threshold preferences |
| 2 | **Readmission Risk Predictor** | No learning | Track actual readmissions vs predictions |
| 33 | **Infection Risk Predictor** | No learning | Track actual HAIs vs predictions |

### Lower Priority - Admin/Billing

These skills assist with administrative tasks and could benefit from feedback.

| # | Skill | Current State | Recommended Learning Pattern |
|---|-------|---------------|------------------------------|
| 1 | **Billing Code Suggester** | Cache only | Learn from code acceptance/rejection patterns |
| 35 | **Schedule Optimizer** | No learning | Learn scheduling preferences, constraint priorities |
| 14 | **Patient Education Generator** | No learning | Learn readability preferences, topic depth |

---

## Recommended Learning Pattern: Edit Tracking

For documentation-generating skills, implement this pattern:

```
1. AI generates content
2. Provider reviews and edits
3. System detects diff between original and edited
4. If significant edits:
   a. Store edit pattern (original → corrected)
   b. Optionally ask: "Should Riley learn from this edit?"
   c. Feed into provider-specific learning profile
5. Next generation incorporates learned patterns
```

### Database Schema Addition Needed

```sql
-- Track AI output corrections for learning
CREATE TABLE ai_output_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  skill_id TEXT NOT NULL,
  provider_id UUID NOT NULL REFERENCES profiles(user_id),
  original_output JSONB NOT NULL,
  corrected_output JSONB NOT NULL,
  correction_type TEXT, -- 'terminology', 'structure', 'content', 'style'
  context JSONB, -- patient condition, specialty, etc.
  applied_count INTEGER DEFAULT 1,
  confidence NUMERIC(3,2) DEFAULT 0.8,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_applied_at TIMESTAMPTZ
);

-- Index for quick learning lookup
CREATE INDEX idx_ai_corrections_provider_skill
  ON ai_output_corrections(provider_id, skill_id);
```

---

## Recommended Proactive Confirmation Pattern

For skills where the AI might be uncertain, implement "Did I understand correctly?":

```typescript
interface ConfirmableOutput {
  content: string | object;
  confidence: number;
  uncertainAreas: Array<{
    field: string;
    value: string;
    confidence: number;
    alternatives?: string[];
  }>;
}

// Trigger confirmation when:
// 1. Overall confidence < 0.7
// 2. Any field confidence < 0.6
// 3. Known problem area from previous corrections
```

### Skills to Implement Proactive Confirmation

| Skill | Trigger Condition |
|-------|-------------------|
| SOAP Note Generator | When HPI or assessment section confidence is low |
| Billing Code Suggester | When code confidence < 0.8 |
| Contraindication Detector | When interaction severity is uncertain |
| Care Plan Generator | When goal specificity is ambiguous |
| Medication Instructions | When dosage timing is unclear |

---

## Implementation Roadmap

### Phase 1: Foundation (Current Sprint)
- [x] Voice Learning proactive confirmation ✅
- [ ] Create `ai_output_corrections` table schema
- [ ] Create `LearningService` base class for skills

### Phase 2: Clinical Documentation
- [ ] Add edit tracking to SOAP Note Generator
- [ ] Add edit tracking to Care Plan Generator
- [ ] Add edit tracking to Discharge Summary Generator

### Phase 3: Decision Support
- [ ] Add feedback loop to Treatment Pathway Recommender
- [ ] Add outcome tracking to Risk Predictors
- [ ] Add override tracking to Contraindication Detector

### Phase 4: All Skills
- [ ] Standardize learning interface across all 46 active skills
- [ ] Dashboard for viewing/managing learned corrections
- [ ] Export/import learned patterns across tenants

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Edit rate reduction | -30% | Track edits before/after learning |
| Provider satisfaction | +20% | Quarterly survey scores |
| Time to document | -25% | Time from AI generation to save |
| Correction reuse rate | 70% | How often learned corrections apply |

---

## Notes

- All learning must be **per-provider** to respect individual preferences
- Tenant admins can share learned patterns across providers (opt-in)
- Learning data is PHI-adjacent and requires the same security controls
- Consider federated learning for cross-tenant improvements (future)
