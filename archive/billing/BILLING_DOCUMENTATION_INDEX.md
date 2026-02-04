# WellFit Billing System Documentation Index

## Overview

This documentation package provides a comprehensive exploration of the WellFit Community billing and claims processing system. Two companion documents are included to serve different audiences.

---

## Documentation Files

### 1. BILLING_EXPLORATION_SUMMARY.md (Executive Level)
**Purpose**: High-level overview for architects, product managers, and stakeholders
**Length**: ~350 lines
**Contains**:
- System scale and complexity metrics
- Key findings and innovations
- Technology stack
- Strengths and patterns
- Integration points
- Recommendations for future enhancement

**Best for**:
- Understanding system architecture at a glance
- Executive briefings
- Design review meetings
- Feature planning

---

### 2. BILLING_SYSTEM_DOCUMENTATION.md (Technical Deep Dive)
**Purpose**: Comprehensive technical reference for developers
**Length**: 1,115 lines
**Contains**:

#### Section 1: Billing Workflow (from encounter to submission)
- 10-step end-to-end process flow
- UnifiedBillingService entry point
- Financial tracking
- HIPAA compliance features

#### Section 2: CPT & ICD-10 Code Generation
- Database schema for code tables
- Decision tree-based code generation
- AI coding suggestions
- Code reconciliation logic

#### Section 3: 837P Claim File Generation
- Edge Function architecture (Deno)
- X12 837P segment structure with examples
- 3-tier control number management
- Data validation and sanitization
- Claim storage and audit logging

#### Section 4: CCM Billing Automation
- CCM billing codes and requirements
- Time tracking aggregation logic
- Auto-loading from scribe sessions
- Compliance validation checks

#### Section 5: Fee Schedules & Payment Tracking
- Fee schedule database structure
- Fee lookup and application logic
- Payment tracking workflow
- Clearinghouse batch integration

#### Section 6: Clearinghouse Integration
- Clearinghouse protocol support
- Response processing (997, 835, 999)
- Batch submission workflow examples

#### Section 7: SDOH Billing Codes
- Z-code mapping and complexity scoring
- SDOH assessment process
- Documentation requirements by tier
- Integration with coding suggestions

#### Section 8: Billing Decision Tree Logic
- Complete 6-node architecture diagram
- NODE A through NODE F detailed logic
- E/M level determination algorithm
- Modifier application rules
- Medical necessity validation
- 80/20 fast path optimization

#### Summary Tables
- Key metrics and configuration thresholds
- File manifest
- Technology stack
- Enhancement recommendations

**Best for**:
- Implementing features
- Understanding algorithms
- Code review
- Integration development
- Troubleshooting

---

## Quick Navigation

### For Understanding the Workflow
1. Start: BILLING_EXPLORATION_SUMMARY.md → "System Scale & Complexity"
2. Deep dive: BILLING_SYSTEM_DOCUMENTATION.md → "Section 1: Billing Workflow"
3. Orchestration: UnifiedBillingService.processBillingWorkflow() in codebase

### For CPT/ICD-10 Code Generation
1. Overview: BILLING_EXPLORATION_SUMMARY.md → "CPT & ICD-10 Code Generation"
2. Details: BILLING_SYSTEM_DOCUMENTATION.md → "Section 2: CPT & ICD-10 Code Generation"
3. Decision Tree: BILLING_SYSTEM_DOCUMENTATION.md → "Section 8: Decision Tree Logic"
4. Code: BillingDecisionTreeService in src/services/

### For X12 837P Generation
1. Overview: BILLING_EXPLORATION_SUMMARY.md → "X12 837P Implementation"
2. Details: BILLING_SYSTEM_DOCUMENTATION.md → "Section 3: 837P Claim File Generation"
3. Code: supabase/functions/generate-837p/index.ts

### For CCM Billing
1. Overview: BILLING_EXPLORATION_SUMMARY.md → "CCM Automation"
2. Details: BILLING_SYSTEM_DOCUMENTATION.md → "Section 4: CCM Billing Automation"
3. Code: CCMAutopilotService in src/services/

### For SDOH & Social Determinants
1. Overview: BILLING_EXPLORATION_SUMMARY.md → "SDOH Integration"
2. Details: BILLING_SYSTEM_DOCUMENTATION.md → "Section 7: SDOH Billing Codes"
3. Code: SDOHBillingService in src/services/

### For Decision Tree Logic
1. Architecture: BILLING_EXPLORATION_SUMMARY.md → "Decision Tree System"
2. Complete spec: BILLING_SYSTEM_DOCUMENTATION.md → "Section 8: Billing Decision Tree Logic"
3. Code: BillingDecisionTreeService in src/services/

---

## Key Findings at a Glance

### Scale
- 3,259 lines of service code
- 5 core services
- 497-line Edge Function
- 11+ database tables

### Architecture
- 10-step billing workflow
- 6-node decision tree
- 3-tier control numbers
- Multi-source code reconciliation

### Features
- HIPAA audit logging
- SDOH complexity scoring
- CCM automation
- X12 837P generation
- Clearinghouse integration
- Fee schedule management

### Standards Compliance
- X12 837P (EDI)
- CMS billing rules
- HIPAA §164.312(b)
- Medicare 2024 rates

### Technology
- TypeScript (5 services)
- PostgreSQL + Supabase
- Deno Edge Function
- RLS security

---

## Code Locations

| Component | File | Lines |
|-----------|------|-------|
| Billing Core | src/services/billingService.ts | 436 |
| SDOH Analysis | src/services/sdohBillingService.ts | 847 |
| CCM Automation | src/services/ccmAutopilotService.ts | 209 |
| Decision Tree | src/services/billingDecisionTreeService.ts | 926 |
| Workflow | src/services/unifiedBillingService.ts | 841 |
| X12 Generation | supabase/functions/generate-837p/index.ts | 497 |
| Utilities | src/utils/billingUtils.ts | 378 |
| Types | src/types/billing.ts + others | 300+ |
| Database | supabase/migrations/ | 2,000+ |
| Tests | src/services/__tests__/ | 500+ |

---

## Important Algorithms Explained

### Decision Tree Path (6 Nodes)
```
NODE A: Validate eligibility
NODE B: Classify service (procedural vs E/M)
NODE C: Look up CPT code
NODE D: Determine E/M level (1-5)
NODE E: Apply modifiers
NODE F: Look up fee
```

### E/M Level Selection
- Time-based: >50% counseling determines level
- MDM-based: Diagnosis count + data + risk determines level
- New patient: 99201-99205
- Established: 99211-99215

### SDOH Complexity Scoring
- Base weight × severity multiplier
- Score < 2: No CCM
- Score 2-3: Standard CCM (99490/99491)
- Score >= 4: Complex CCM (99487/99489)

### CCM Time Aggregation
- Check-ins: 5 min each
- Scribe sessions: Actual duration
- Portal messages: Tracked
- Aggregated monthly
- Auto-bill eligible codes

---

## Configuration & Thresholds

| Parameter | Value | Source |
|-----------|-------|--------|
| CCM min time | 20 min | Medicare |
| SDOH complexity threshold | 4 | Internal |
| E/M time threshold | 50% | CMS |
| Manual review confidence | <70% | Internal |
| Audit readiness score | <80 | Internal |
| CPT modifiers | 4 max | X12 |
| Fee schedule items | 10,000+ | Typical |
| Processing SLA | <500ms | Target |
| Control number recycling | Monthly | Per payer |

---

## Integration Examples

### Scribe Session to Claim (auto-flow)
```
Scribe Session Created
  → suggested_cpt_codes extracted
  → suggested_icd10_codes extracted
  → CPT/ICD-10 auto-loaded to claim
  → Audit trail recorded
  → CCM codes auto-added if eligible
```

### Decision Tree to Claim
```
Decision Tree Input
  → NODE A: Eligibility check
  → NODE B: Service classification
  → NODE C: CPT lookup
  → NODE D: E/M level
  → NODE E: Modifiers
  → NODE F: Fee lookup
  → Claim line generated
```

### SDOH to CCM Billing
```
SDOH Assessment
  → Complexity score calculated
  → Z-codes identified
  → CCM tier assigned (standard/complex)
  → CPT codes determined (99490/99487)
  → Audit readiness scored
```

---

## Common Questions

**Q: How are CPT codes selected?**
A: Two paths with priority: Decision tree (deterministic) > AI suggestions (probabilistic). See Section 2 for details.

**Q: How does CCM billing work?**
A: Activities tracked monthly (check-ins, scribe sessions, messages). Billable minutes determine CPT codes (99490/99491/99487/99489). See Section 4 for details.

**Q: What is the decision tree?**
A: 6-node validation system that classifies services, looks up codes, determines E/M levels, applies modifiers, and retrieves fees. See Section 8 for complete specification.

**Q: How is X12 837P generated?**
A: Deno Edge Function builds ISA/GS/ST/SV1 segments, validates fields, manages 3-tier control numbers. See Section 3 for details.

**Q: What about HIPAA compliance?**
A: PHI access logged, all actions attributed to user ID, IP address captured, workflow events tracked. See Section 1 for details.

**Q: How are claims submitted to clearinghouses?**
A: Claims batched, X12 files generated, submitted via SFTP/API, responses tracked. See Section 5-6 for details.

**Q: What is SDOH integration?**
A: Z-codes for social determinants identified, complexity scored, CCM eligibility determined, documentation requirements specified. See Section 7 for details.

---

## For Developers

### Running the System
1. Start with UnifiedBillingService.processBillingWorkflow()
2. Understand the 10 workflow steps
3. Review BillingDecisionTreeService for logic
4. Check SDOHBillingService for AI integration
5. Review generate-837p function for X12 format

### Making Changes
1. Check type definitions in /src/types/
2. Maintain backward compatibility
3. Add audit logging for new operations
4. Include validation at service boundaries
5. Test with HIPAA compliance in mind

### Adding New Features
1. Consider which service owns the feature
2. Define types in /src/types/
3. Implement in appropriate service
4. Add validation logic
5. Include audit trail
6. Update tests

---

## Support & References

- **Clinical Coding**: Refer to CMS E/M documentation
- **X12 Standards**: Refer to X12.org official standards
- **HIPAA**: Refer to 45 CFR 164.312(b)
- **CPT Codes**: Refer to current year CPT code set
- **ICD-10 Codes**: Refer to current year ICD-10-CM code set
- **Medicare Rates**: Refer to CMS RBRVS for current year

---

## Document Maintenance

These documents are maintained as living references. Last updated: 2024-11-04

When updating:
1. Keep both summary and detailed docs in sync
2. Update code examples when logic changes
3. Revise metrics if thresholds change
4. Add migration notes for breaking changes
5. Include changelog in commit message

---

*For questions or clarifications, refer to the source code and inline comments.*
