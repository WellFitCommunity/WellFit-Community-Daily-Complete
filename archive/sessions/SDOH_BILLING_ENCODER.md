# SDOH Billing Encoder System

## Overview

The SDOH (Social Determinants of Health) Billing Encoder is an AI-powered billing system that integrates social determinant factors into medical coding workflow, specifically designed to maximize Chronic Care Management (CCM) reimbursement through proper Z-code utilization.

## 🎯 Key Features

### Social Determinants Integration
- **Automated Z-code identification** from patient check-ins and assessments
- **Complexity scoring** based on multiple SDOH factors
- **CCM tier determination** (Standard vs Complex) based on social barriers
- **Audit-ready documentation** with detailed justification

### Supported Z-Codes
| Code   | Description | Category | Complexity Weight |
|--------|-------------|----------|-------------------|
| Z59.0  | Homelessness | Housing | 3 (High) |
| Z59.1  | Inadequate housing | Housing | 2 (Medium) |
| Z59.3  | Food insecurity | Nutrition | 2 (Medium) |
| Z59.8  | Transportation problems | Transportation | 2 (Medium) |
| Z60.2  | Social isolation | Social | 1 (Low) |
| Z59.6  | Low income | Financial | 2 (Medium) |

### CCM Billing Codes
| Code   | Description | Time Required | 2024 Reimbursement |
|--------|-------------|---------------|-------------------|
| 99490  | Basic CCM, first 20 min | 20 minutes | $64.72 |
| 99491  | Basic CCM, additional 20 min | 20 minutes | $58.34 |
| 99487  | Complex CCM, first 60 min | 60 minutes | $145.60 |
| 99489  | Complex CCM, additional 30 min | 30 minutes | $69.72 |

## 🏗️ Architecture

### Database Schema

#### SDOH Assessments
```sql
CREATE TABLE sdoh_assessments (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL,
  encounter_id uuid,
  assessment_date date NOT NULL,
  housing_instability jsonb,
  food_insecurity jsonb,
  transportation_barriers jsonb,
  social_isolation jsonb,
  financial_insecurity jsonb,
  overall_complexity_score integer,
  ccm_eligible boolean,
  ccm_tier text CHECK (ccm_tier IN ('standard', 'complex', 'non-eligible'))
);
```

#### CCM Time Tracking
```sql
CREATE TABLE ccm_time_tracking (
  id uuid PRIMARY KEY,
  encounter_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  service_date date NOT NULL,
  activities jsonb NOT NULL,
  total_minutes integer,
  billable_minutes integer,
  suggested_codes text[],
  is_compliant boolean
);
```

#### CMS Documentation
```sql
CREATE TABLE cms_documentation (
  id uuid PRIMARY KEY,
  encounter_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  consent_obtained boolean,
  care_plan_updated boolean,
  communication_log jsonb,
  quality_measures jsonb
);
```

### Service Layer

#### SDOHBillingService
Main service class providing:
- `assessSDOHComplexity(patientId)` - Analyzes patient data for SDOH factors
- `analyzeEncounter(encounterId)` - Generates enhanced coding suggestions
- `trackCCMTime(encounterId, activities)` - Records billable activities
- `generateCMSDocumentation(encounterId)` - Creates compliance documentation
- `validateBillingCompliance(suggestion)` - Validates coding compliance

### AI Integration

#### Claude AI Analysis
- **Edge Function**: `supabase/functions/sdoh-coding-suggest/index.ts`
- **Model**: Claude 3.5 Sonnet for medical coding accuracy
- **Input**: Clinical notes, patient check-ins, existing diagnoses
- **Output**: Enhanced coding suggestions with SDOH integration

## 🖥️ User Interface

### SDOHCoderAssist Component
Enhanced coding assistant with tabbed interface:

1. **Codes Tab** - ICD-10, CPT, and HCPCS code suggestions
2. **SDOH Analysis Tab** - Social determinant factors and complexity scoring
3. **CCM Recommendation Tab** - Billing tier determination and expected revenue
4. **Compliance Tab** - Audit readiness and documentation gaps

### CCMTimeTracker Component
Real-time activity tracking for CCM compliance:
- **Timer functionality** for accurate time logging
- **Activity categorization** (assessment, care coordination, etc.)
- **Compliance checking** for CMS requirements
- **Code suggestion** based on documented time

## 📋 Usage Workflow

### 1. Encounter Analysis
```typescript
import { SDOHBillingService } from '../services/sdohBillingService';

// Analyze encounter for enhanced coding
const suggestion = await SDOHBillingService.analyzeEncounter(encounterId);
```

### 2. SDOH Assessment
```typescript
// Assess patient's social determinant factors
const assessment = await SDOHBillingService.assessSDOHComplexity(patientId);

// Example output:
{
  patientId: "uuid",
  overallComplexityScore: 7,
  ccmEligible: true,
  ccmTier: "complex",
  housingInstability: {
    zCode: "Z59.0",
    severity: "severe",
    impact: "high",
    documented: true
  },
  foodInsecurity: {
    zCode: "Z59.3",
    severity: "moderate",
    impact: "high",
    documented: true
  }
}
```

### 3. CCM Time Tracking
```typescript
const activities = [
  {
    type: 'assessment',
    duration: 30,
    description: 'Comprehensive care plan review including SDOH factors',
    provider: 'Jane Smith, RN',
    billable: true
  },
  {
    type: 'care_coordination',
    duration: 45,
    description: 'Coordinated housing assistance referral',
    provider: 'Jane Smith, RN',
    billable: true
  }
];

const timeTracking = await SDOHBillingService.trackCCMTime(
  encounterId,
  patientId,
  activities
);
```

### 4. Enhanced Coding Output
```typescript
// Example enhanced suggestion
{
  medicalCodes: {
    icd10: [
      {
        code: "E11.9",
        rationale: "Type 2 diabetes mellitus without complications",
        principal: true,
        category: "medical"
      },
      {
        code: "Z59.0",
        rationale: "Homelessness documented in patient assessment",
        principal: false,
        category: "sdoh"
      },
      {
        code: "Z59.3",
        rationale: "Food insecurity impacting diabetes management",
        principal: false,
        category: "sdoh"
      }
    ]
  },
  procedureCodes: {
    cpt: [
      {
        code: "99487",
        rationale: "Complex CCM justified by SDOH complexity score: 7",
        timeRequired: 60,
        sdohJustification: "Multiple social determinants requiring complex care coordination"
      }
    ]
  },
  ccmRecommendation: {
    eligible: true,
    tier: "complex",
    expectedReimbursement: 145.60,
    justification: "Complex care management justified by multiple SDOH factors: housing instability, food insecurity"
  }
}
```

## 💰 Revenue Impact

### CCM Reimbursement Comparison
- **Without SDOH**: Standard CCM (99490) = $64.72/month
- **With SDOH**: Complex CCM (99487) = $145.60/month
- **Revenue Increase**: 125% improvement per qualified patient

### Example Patient Case
**Medical**: E11.9 (Diabetes, unspecified)
**SDOH**: Z59.0 (Homelessness), Z59.3 (Food insecurity)
**Result**: Qualifies for Complex CCM (99487)
**Monthly Revenue**: $145.60 vs $64.72 = **$80.88 additional revenue**

## 🔒 Compliance & Audit Readiness

### CMS Requirements
- ✅ **Patient consent** documentation
- ✅ **24/7 access** to care team
- ✅ **Comprehensive care plan** with SDOH factors
- ✅ **Time tracking** with detailed activity logs
- ✅ **Communication logs** for patient interactions

### Audit Protection
- **Detailed justification** for each Z-code assignment
- **Source documentation** linking SDOH factors to clinical notes
- **Complexity scoring** algorithm with transparent methodology
- **Human review requirement** - no auto-submission of codes

## 🚀 Implementation Guide

### 1. Database Migration
```bash
# Apply the SDOH billing database migration
supabase migration up 20250929160000_fix_billing_permissions.sql
```

### 2. Component Integration
```typescript
// Add to admin billing dashboard
import { SDOHCoderAssist } from '../components/billing/SDOHCoderAssist';

function BillingDashboard() {
  return (
    <div>
      <SDOHCoderAssist
        encounterId={encounterId}
        patientId={patientId}
        onSaved={(data) => console.log('Coding saved:', data)}
      />
    </div>
  );
}
```

### 3. Edge Function Deployment
```bash
# Deploy the SDOH coding suggestion function
supabase functions deploy sdoh-coding-suggest
```

### 4. Environment Variables
```bash
# Required for AI analysis
ANTHROPIC_API_KEY=your_claude_api_key
```

## 📊 Analytics & Reporting

### Key Metrics to Track
- **SDOH factor identification rate** - % of patients with documented Z-codes
- **CCM tier distribution** - Standard vs Complex CCM qualification
- **Revenue per patient** - Monthly CCM reimbursement amounts
- **Audit readiness score** - Documentation completeness percentage
- **Time to coding** - Efficiency of SDOH analysis workflow

### Sample Queries
```sql
-- SDOH complexity distribution
SELECT
  ccm_tier,
  COUNT(*) as patient_count,
  AVG(overall_complexity_score) as avg_complexity
FROM sdoh_assessments
WHERE assessment_date >= '2024-01-01'
GROUP BY ccm_tier;

-- CCM revenue potential
SELECT
  COUNT(CASE WHEN ccm_tier = 'complex' THEN 1 END) * 145.60 as complex_revenue,
  COUNT(CASE WHEN ccm_tier = 'standard' THEN 1 END) * 64.72 as standard_revenue
FROM sdoh_assessments
WHERE ccm_eligible = true;
```

## 🔧 Configuration

### Z-Code Mapping Customization
Update `ZCODE_MAPPING` in `sdohBilling.ts` to add new social determinant codes:

```typescript
export const ZCODE_MAPPING = {
  'Z59.0': {
    category: 'housing',
    description: 'Homelessness',
    complexityWeight: 3,
    ccmImpact: 'high'
  },
  // Add new Z-codes here
  'Z55.9': {
    category: 'education',
    description: 'Educational problem, unspecified',
    complexityWeight: 1,
    ccmImpact: 'medium'
  }
};
```

### CCM Reimbursement Rates
Update `CCM_CODES` annually with current Medicare rates:

```typescript
export const CCM_CODES = {
  '99487': {
    description: 'Complex chronic care management services, first 60 minutes',
    timeRequired: 60,
    baseReimbursement: 145.60, // Update annually
    requiresSDOH: true
  }
};
```

## 🆘 Troubleshooting

### Common Issues

**Permission Denied Errors**
- Ensure migration `20250929160000_fix_billing_permissions.sql` is applied
- Verify user has admin role in `user_roles` table

**AI Analysis Failures**
- Check `ANTHROPIC_API_KEY` environment variable
- Review Edge Function logs in Supabase dashboard

**CCM Qualification Issues**
- Verify patient has 2+ chronic conditions documented
- Ensure SDOH factors are properly documented in check-ins
- Check complexity score calculation (minimum 2 for standard, 4 for complex)

### Support
For implementation support or questions about the SDOH billing encoder system, refer to the codebase documentation or contact the development team.