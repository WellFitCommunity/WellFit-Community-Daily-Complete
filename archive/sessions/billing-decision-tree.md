# Billing Decision Tree - Smart Billing and Coding System

## Overview

The Billing Decision Tree implements an **integral minimum logic** approach to automatically and accurately determine CPT codes, ICD-10 codes, and billing amounts based on clinical documentation. It follows the 80/20 rule: handle the most common scenarios efficiently while routing complex cases to manual review.

## Architecture

### Decision Flow

```
Input (Patient Encounter)
    ↓
[Node A] Eligibility & Authorization
    ↓
[Node B] Service Classification (Procedural vs E/M)
    ↓
[Node C] Procedure CPT Lookup    OR    [Node D] E/M Level Determination
    ↓
[Node E] Modifier Application
    ↓
[Node F] Fee Schedule Lookup
    ↓
Output (Billable Claim Line)
```

## Key Components

### 1. Decision Tree Nodes

#### Node A: Service and Payer Validation
**Question:** Is the patient eligible and service authorized?

- **Yes** → Proceed to Node B
- **No** → Output: "Claim Denied (Ineligible/Unauthorized)" or "Send Prior Authorization Request"

**Implementation:** [billingDecisionTreeService.ts:230-271](../src/services/billingDecisionTreeService.ts#L230-L271)

#### Node B: Diagnosis and Procedure Classification
**Question:** Is the service procedural or evaluation/management (E/M)?

- **Procedural** → Go to Node C (Procedure Logic)
- **E/M** → Go to Node D (E/M Logic)

**Implementation:** [billingDecisionTreeService.ts:366-393](../src/services/billingDecisionTreeService.ts#L366-L393)

#### Node C: Procedure Logic
**Question:** Is the procedure found in CPT cross-reference table?

- **Yes** → Assign primary CPT Code and go to Node E
- **No** → Output: "Manual Review Required (Unlisted Procedure)"

**Implementation:** [billingDecisionTreeService.ts:395-426](../src/services/billingDecisionTreeService.ts#L395-L426)

#### Node D: E/M Logic
**Question:** Does the documentation meet required elements for a level 3 service?

- **Yes** → Assign E/M Code (e.g., 99203 or 99213) and go to Node E
- **No** → Re-evaluate for next lowest/highest level, then go to Node E

**Implementation:** [billingDecisionTreeService.ts:428-468](../src/services/billingDecisionTreeService.ts#L428-L468)

#### Node E: Modifiers and Billing Determination
**Question:** Are there special circumstances or co-surgeries?

- **Yes** → Append appropriate CPT Modifier (e.g., -25, -59, -80)
- **No** → Proceed directly to Node F

**Implementation:** [billingDecisionTreeService.ts:470-494](../src/services/billingDecisionTreeService.ts#L470-L494)

#### Node F: Fee Schedule Lookup
**Question:** Is this service covered by the Payer's Fee Schedule or Contract?

- **Yes** → Apply contracted rate to determine Billed Amount
- **No** → Apply standard Charge Master Rate

**Implementation:** [billingDecisionTreeService.ts:496-522](../src/services/billingDecisionTreeService.ts#L496-L522)

### 2. Final Output

The decision tree generates a **Complete Billable Claim Line** containing:

- CPT Code + Modifiers
- ICD-10 Codes (Diagnosis)
- Billed Amount
- Payer ID
- Medical Necessity Validation Status

## Usage Examples

### Example 1: Simple Office Visit

```typescript
import { BillingDecisionTreeService } from './services/billingDecisionTreeService';

const input = {
  patientId: 'patient-123',
  payerId: 'payer-456',
  policyStatus: 'active',
  encounterId: 'encounter-789',
  encounterType: 'office_visit',
  serviceDate: '2025-10-14',
  providerId: 'provider-111',
  presentingDiagnoses: [
    { term: 'Hypertension', icd10Code: 'I10', isPrimary: true }
  ],
  proceduresPerformed: [],
  timeSpent: 25 // minutes
};

const result = await BillingDecisionTreeService.processEncounter(input);

if (result.success && result.claimLine) {
  console.log('Claim Line Generated:');
  console.log(`CPT: ${result.claimLine.cptCode}`);
  console.log(`ICD-10: ${result.claimLine.icd10Codes.join(', ')}`);
  console.log(`Amount: $${result.claimLine.billedAmount}`);
  console.log(`Medical Necessity: ${result.claimLine.medicalNecessityValidated ? 'Valid' : 'Invalid'}`);
}

// Decision path taken:
result.decisions.forEach(decision => {
  console.log(`[${decision.nodeId}] ${decision.question}`);
  console.log(`  Answer: ${decision.answer}`);
  console.log(`  Rationale: ${decision.rationale}`);
});
```

**Expected Output:**
```
Claim Line Generated:
CPT: 99213
ICD-10: I10
Amount: $145.00
Medical Necessity: Valid

[NODE_A] Is the patient eligible and service authorized?
  Answer: Yes - Eligible
  Rationale: Patient has active coverage with payer

[NODE_B] Is the service procedural or evaluation/management?
  Answer: evaluation_management
  Rationale: Encounter type "office_visit" is evaluation/management in nature

[NODE_D] Does documentation meet required elements for E/M level?
  Answer: Yes - Level 3
  Rationale: E/M Level 3 determined (99213). Documentation score: 75%

[NODE_E] Are there special circumstances requiring modifiers?
  Answer: No
  Rationale: No modifiers required

[NODE_F] Is service covered by payer fee schedule or contract?
  Answer: Yes - $145.00
  Rationale: Applied contracted rate: $145.00
```

### Example 2: Telehealth Visit with SDOH Enhancement

```typescript
const telehealthInput = {
  patientId: 'patient-456',
  payerId: 'medicare-001',
  policyStatus: 'active',
  encounterId: 'encounter-999',
  encounterType: 'telehealth',
  serviceDate: '2025-10-14',
  providerId: 'provider-222',
  presentingDiagnoses: [
    { term: 'Type 2 Diabetes', icd10Code: 'E11.9', isPrimary: true },
    { term: 'Depression', icd10Code: 'F32.9' }
  ],
  proceduresPerformed: [],
  timeSpent: 30
};

// Process through decision tree
const result = await BillingDecisionTreeService.processEncounter(telehealthInput);

// Enhance with SDOH codes
const enhancedResult = await BillingDecisionTreeService.enhanceWithSDOH(
  result,
  telehealthInput.patientId
);

if (enhancedResult.success && enhancedResult.claimLine) {
  console.log('Enhanced Claim Line:');
  console.log(`CPT: ${enhancedResult.claimLine.cptCode}`);
  console.log(`Modifiers: ${enhancedResult.claimLine.cptModifiers.join(', ')}`);
  console.log(`ICD-10 Codes: ${enhancedResult.claimLine.icd10Codes.join(', ')}`);
  console.log(`Amount: $${enhancedResult.claimLine.billedAmount}`);
}
```

**Expected Output:**
```
Enhanced Claim Line:
CPT: 99213
Modifiers: 95 (Telehealth)
ICD-10 Codes: E11.9, F32.9, Z59.3 (Food insecurity), Z60.2 (Social isolation)
Amount: $145.00
```

### Example 3: Procedure with Manual Review

```typescript
const procedureInput = {
  patientId: 'patient-789',
  payerId: 'payer-789',
  policyStatus: 'active',
  encounterId: 'encounter-111',
  encounterType: 'surgery',
  serviceDate: '2025-10-14',
  providerId: 'provider-333',
  presentingDiagnoses: [
    { term: 'Appendicitis', icd10Code: 'K35.80', isPrimary: true }
  ],
  proceduresPerformed: [
    { description: 'Novel laparoscopic technique' }
  ]
};

const result = await BillingDecisionTreeService.processEncounter(procedureInput);

if (result.requiresManualReview) {
  console.log('⚠️ Manual Review Required');
  console.log(`Reason: ${result.manualReviewReason}`);
  console.log('Warnings:');
  result.warnings.forEach(warning => {
    console.log(`  - ${warning.message}`);
    console.log(`    Suggestion: ${warning.suggestion}`);
  });
}
```

**Expected Output:**
```
⚠️ Manual Review Required
Reason: Unlisted procedure code - requires manual review
Warnings:
  - Procedure not found in CPT reference table
    Suggestion: Use appropriate unlisted procedure code or consult coding specialist
```

## Integration with Existing Systems

### SDOH Billing Service Integration

The decision tree seamlessly integrates with the existing SDOH billing service:

```typescript
// Standard decision tree processing
const result = await BillingDecisionTreeService.processEncounter(input);

// Enhance with SDOH-specific codes and CCM recommendations
const enhancedResult = await BillingDecisionTreeService.enhanceWithSDOH(
  result,
  input.patientId
);

// Result includes:
// - Original medical codes (ICD-10, CPT)
// - SDOH Z-codes (Z59.*, Z60.*)
// - CCM eligibility and recommendations
// - Enhanced reimbursement calculations
```

### Database Schema Requirements

The decision tree requires the following database tables:

1. **patients** - Patient demographics and insurance information
2. **codes_cpt** - CPT code reference table
3. **codes_icd10** - ICD-10 code reference table
4. **codes_modifiers** - CPT modifier reference
5. **fee_schedule_items** - Payer-specific fee schedules
6. **coding_rules** - Medical necessity validation rules

## Configuration

### Decision Tree Config

```typescript
const customConfig: DecisionTreeConfig = {
  enableEligibilityCheck: true,
  requireAuthorization: true,
  enableMedicalNecessityCheck: true,
  enable80_20FastPath: true,
  manualReviewThreshold: 70,
  autoApproveConfidence: 90,
  commonScenarios: [
    {
      scenarioId: 'routine_office_visit',
      name: 'Routine Office Visit',
      encounterTypes: ['office_visit'],
      defaultCPTCodes: ['99213', '99214'],
      defaultICD10Codes: ['Z00.00'],
      frequency: 45,
      autoApproveThreshold: 85,
      requiresReview: false
    }
  ]
};

const result = await BillingDecisionTreeService.processEncounter(input, customConfig);
```

## Compliance Features

### Medical Necessity Validation

The decision tree automatically validates CPT-ICD10 combinations against:

- **NCD (National Coverage Determination)** references
- **LCD (Local Coverage Determination)** references
- Internal coding rules stored in database
- Pattern matching for required/excluded diagnosis combinations

### Audit Trail

Every decision includes complete rationale:

```typescript
result.decisions.forEach(decision => {
  console.log({
    node: decision.nodeId,
    question: decision.question,
    answer: decision.answer,
    rationale: decision.rationale,
    timestamp: decision.timestamp
  });
});
```

### Validation and Warnings

The system provides comprehensive validation:

```typescript
// Errors (blocking issues)
result.validationErrors.forEach(error => {
  console.log(`ERROR [${error.code}]: ${error.message}`);
});

// Warnings (non-blocking issues)
result.warnings.forEach(warning => {
  console.log(`WARNING [${warning.code}]: ${warning.message}`);
  console.log(`Suggestion: ${warning.suggestion}`);
});
```

## 80/20 Rule Implementation

The decision tree prioritizes the most common scenarios:

1. **Fast Path (80%)** - Routine office visits, telehealth, common procedures
   - Automatically approved if confidence > 90%
   - Minimal manual intervention required

2. **Manual Review (20%)** - Complex cases, unlisted procedures, unusual combinations
   - Routed to coding specialists
   - Complete audit trail provided

## Performance Optimization

### Hierarchical Data Strategy

- **Coding rules** stored in database lookup tables
- **CPT/ICD-10 mappings** cached for fast retrieval
- **Fee schedules** pre-loaded for common payers
- **Decision nodes** query only necessary data

### Minimal Logic Path

The tree stops at the first blocking issue:
- Invalid eligibility → Immediate denial (no further processing)
- Unlisted procedure → Immediate manual review flag
- Medical necessity failure → Error with specific guidance

## Error Handling

```typescript
if (!result.success) {
  if (result.validationErrors.length > 0) {
    // Handle validation errors
    console.log('Validation failed:', result.validationErrors);
  }

  if (result.requiresManualReview) {
    // Route to manual review queue
    console.log('Manual review required:', result.manualReviewReason);
  }
}
```

## Future Enhancements

1. **Machine Learning Integration** - Train models on historical coding patterns
2. **Real-time Payer Eligibility API** - Live verification with payer systems
3. **Advanced NLP** - Extract diagnoses and procedures from clinical notes
4. **Predictive Denial Analysis** - Flag high-risk claims before submission
5. **Auto-correction** - Suggest fixes for common coding errors

## API Reference

See [billingDecisionTree.ts](../src/types/billingDecisionTree.ts) for complete type definitions.

See [billingDecisionTreeService.ts](../src/services/billingDecisionTreeService.ts) for implementation details.

## Support

For questions or issues, contact the development team or file an issue in the project repository.
