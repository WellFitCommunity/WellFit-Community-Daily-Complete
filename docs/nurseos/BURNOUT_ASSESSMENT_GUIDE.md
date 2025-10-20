# Burnout Assessment Guide

## Overview
The WellFit Resilience Hub uses the **Maslach Burnout Inventory (MBI)** - the gold standard for measuring burnout in healthcare professionals.

## How It Works

### Three Dimensions of Burnout

1. **Emotional Exhaustion (9 questions)**
   - Feeling emotionally drained, used up, tired
   - Max raw score: 54 (9 questions × 6 points each)
   - Normalized to 0-100 scale
   - **Higher score = More exhausted**

2. **Depersonalization (5 questions)**
   - Treating patients impersonally, becoming callous, cynicism
   - Max raw score: 30 (5 questions × 6 points each)
   - Normalized to 0-100 scale
   - **Higher score = More depersonalized**

3. **Personal Accomplishment (8 questions)**
   - Feeling effective, energetic, making a difference
   - Max raw score: 48 (8 questions × 6 points each)
   - Normalized to 0-100 scale
   - **REVERSE SCORED: Higher accomplishment = LOWER burnout**

### Composite Burnout Score Calculation

```
Composite Score = (EE × 0.4) + (DP × 0.3) + (100 - PA) × 0.3
```

**Weighted formula:**
- Emotional Exhaustion: 40% (strongest predictor)
- Depersonalization: 30%
- Personal Accomplishment: 30% (reversed)

### Risk Levels

| Composite Score | Risk Level | Action Required |
|----------------|-----------|----------------|
| 0-29 | **Low** | Maintain current self-care practices |
| 30-49 | **Moderate** | Increase self-care, consider resilience training |
| 50-69 | **High** | Urgent: Prioritize self-care, seek support |
| 70-100 | **Critical** | Crisis intervention needed, contact EAP/manager |

## Example Scoring

### Example 1: Mild Burnout
```
Emotional Exhaustion: 20/100
Depersonalization: 15/100
Personal Accomplishment: 70/100 (good!)

Composite = (20 × 0.4) + (15 × 0.3) + (100-70) × 0.3
          = 8 + 4.5 + 9
          = 21.5 → LOW RISK ✓
```

### Example 2: High Burnout
```
Emotional Exhaustion: 85/100
Depersonalization: 60/100
Personal Accomplishment: 25/100 (low accomplishment feeling)

Composite = (85 × 0.4) + (60 × 0.3) + (100-25) × 0.3
          = 34 + 18 + 22.5
          = 74.5 → CRITICAL RISK ⚠️
```

## Frequency Scale (0-6 points)

| Value | Label | Definition |
|-------|-------|-----------|
| 0 | Never | Never experienced this |
| 1 | A few times a year or less | Rarely |
| 2 | Once a month or less | Occasionally |
| 3 | A few times a month | Sometimes |
| 4 | Once a week | Weekly |
| 5 | A few times a week | Frequently |
| 6 | Every day | Daily |

## Assessment Flow

1. **Instructions Screen** (30 seconds)
   - Explains MBI, privacy policy, time requirement
   - Crisis hotline information (988)
   - Start button

2. **Question Pages** (5-7 minutes)
   - 22 questions divided into 5 pages
   - 5 questions per page for digestibility
   - Progress bar shows completion
   - Can navigate back to change answers

3. **Auto-Scoring** (Instant)
   - Scores calculated automatically in database
   - Risk level generated using CASE statement
   - Stored in `provider_burnout_assessments` table

4. **Dashboard Update** (Immediate)
   - Risk badge updates to show new level
   - Intervention alerts trigger if needed
   - Historical trend tracking begins

## Intervention Triggers

The system automatically checks if intervention is needed based on:

```sql
-- Criteria for intervention:
1. Composite burnout score >= 70 (critical)
2. Average stress level >= 8 over last 14 days
3. 5+ days with stress >= 8 in last 14 days
```

If triggered, the dashboard shows:
- Orange alert box with resources
- 988 Crisis Lifeline quick-call button
- Manager notification option
- EAP referral information

## Privacy & Compliance

### Who Can See Results?

| User Type | Access Level |
|-----------|-------------|
| **Nurse (owner)** | See own assessments, full history |
| **Admin/Care Manager** | See all assessments (for intervention) |
| **Super Admin** | See all + export aggregate reports |
| **Other Nurses** | Cannot see (RLS policy enforced) |

### HIPAA Compliance
- Provider burnout data is **PHI** (Protected Health Information)
- Encrypted at rest (Supabase RLS)
- Encrypted in transit (TLS)
- Audit logging enabled
- RLS policies prevent unauthorized access

### Data Retention
- Assessments stored indefinitely for longitudinal tracking
- User can request deletion (GDPR compliance)
- Aggregate trends anonymized after 90 days

## Evidence Base

### Research Citations

1. **Maslach, C., & Jackson, S. E. (1981).** The measurement of experienced burnout. *Journal of Organizational Behavior, 2*(2), 99-113.
   - Original MBI development study

2. **Maslach, C., & Leiter, M. P. (2016).** Understanding the burnout experience. *World Psychiatry, 15*(2), 103-111.
   - Recent review of burnout research

3. **West, C. P., et al. (2016).** Single Item Measures of Emotional Exhaustion and Depersonalization Are Useful for Assessing Burnout in Medical Professionals. *Journal of General Internal Medicine, 31*(12), 1547-1550.
   - Validation in healthcare workers

4. **American Nurses Association. (2023).** Healthy Nurse, Healthy Nation Survey.
   - 62% of nurses report high burnout levels

## Limitations

⚠️ **This is a screening tool, NOT a diagnostic tool**
- Cannot diagnose clinical depression or anxiety
- Self-reported data (subject to bias)
- Snapshot in time (burnout fluctuates)
- Should be paired with clinical judgment

**When to escalate beyond MBI:**
- Active suicidal ideation → 988 Lifeline
- Substance abuse concerns → EAP referral
- Performance issues → Manager conversation
- Persistent symptoms → Mental health professional

## Recommended Assessment Frequency

| Risk Level | Re-Assessment Schedule |
|-----------|----------------------|
| **Low** | Every 6 months |
| **Moderate** | Every 3 months |
| **High** | Every month |
| **Critical** | Weekly (plus intervention) |

## Integration with Other Features

### Daily Check-Ins
- Lightweight alternative to full MBI
- Tracks stress trends over time
- If 5+ high-stress days → Prompt full MBI

### Training Modules
- Completion tracked in relation to burnout scores
- "Did module X reduce burnout?" analysis
- Personalized module recommendations

### Support Circles
- High-burnout users auto-invited to circles
- Peer support as intervention strategy
- Anonymous sharing of struggles

## Technical Implementation

### Database Schema
```sql
CREATE TABLE provider_burnout_assessments (
  id UUID PRIMARY KEY,
  practitioner_id UUID REFERENCES fhir_practitioners(id),
  user_id UUID REFERENCES auth.users(id),

  -- Raw dimension scores (0-100)
  emotional_exhaustion_score DECIMAL(5,2),
  depersonalization_score DECIMAL(5,2),
  personal_accomplishment_score DECIMAL(5,2),

  -- Auto-calculated composite (GENERATED column)
  composite_burnout_score DECIMAL(5,2) GENERATED ALWAYS AS (
    (emotional_exhaustion_score * 0.4 +
     depersonalization_score * 0.3 +
     (100 - personal_accomplishment_score) * 0.3)
  ) STORED,

  -- Auto-calculated risk (GENERATED column)
  risk_level TEXT GENERATED ALWAYS AS (
    CASE
      WHEN composite >= 70 THEN 'critical'
      WHEN composite >= 50 THEN 'high'
      WHEN composite >= 30 THEN 'moderate'
      ELSE 'low'
    END
  ) STORED,

  -- Full questionnaire responses (JSONB)
  questionnaire_responses JSONB,

  assessment_date TIMESTAMPTZ DEFAULT NOW()
);
```

### Service Layer
- `submitBurnoutAssessment()` - Submit new assessment
- `getMyAssessments()` - Get historical assessments
- `getLatestBurnoutRisk()` - Get current risk level
- `checkInterventionNeeded()` - Check if intervention triggered

## User Experience

### Mobile-Friendly Design
- Large touch targets for frequency selection
- Progress saved if browser closed
- Can complete on phone during break
- Takes 5-7 minutes average

### Accessibility
- ARIA labels on all radio buttons
- Keyboard navigation support
- High contrast mode compatible
- Screen reader tested

### Gamification (Future)
- Badge: "Self-Aware Champion" (completed 1st assessment)
- Badge: "Resilience Tracker" (completed 4+ assessments)
- Streak tracking for quarterly assessments

---

**Questions?** Contact the engineering team or reference [ADR-001-resilience-hub-architecture.md](./ADR-001-resilience-hub-architecture.md)
