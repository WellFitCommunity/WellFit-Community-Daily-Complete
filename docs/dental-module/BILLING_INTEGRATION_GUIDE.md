# Dental Module Billing & Reimbursement Integration Guide

## Executive Summary

The WellFit Dental Health Module provides comprehensive billing integration through **Current Dental Terminology (CDT) codes**, enabling reimbursement pathways via Medicare Advantage, Medicaid SDOH programs, Chronic Care Management (CCM), and commercial insurance plans.

This document outlines billing strategies, coding guidelines, reimbursement mechanisms, and revenue optimization for the dental module within the broader WellFit ecosystem.

---

## Table of Contents

1. [CDT Code System Overview](#cdt-code-system-overview)
2. [Reimbursement Pathways](#reimbursement-pathways)
3. [FHIR Integration for Billing](#fhir-integration-for-billing)
4. [Coding Guidelines](#coding-guidelines)
5. [Revenue Optimization Strategies](#revenue-optimization-strategies)
6. [Documentation Requirements](#documentation-requirements)
7. [Compliance & Regulatory Considerations](#compliance--regulatory-considerations)

---

## 1. CDT Code System Overview

### What are CDT Codes?

**Current Dental Terminology (CDT)** is a code set maintained by the American Dental Association (ADA) for reporting dental procedures and services. CDT codes are analogous to CPT codes in medicine and are required for:

- Insurance claim submission
- Fee schedule development
- Utilization review
- Outcomes tracking
- Quality measurement

### CDT Code Structure

- **Format**: `D####` (e.g., D1110, D0120)
- **Categories**:
  - **D0000-D0999**: Diagnostic
  - **D1000-D1999**: Preventive
  - **D2000-D2999**: Restorative
  - **D3000-D3999**: Endodontics
  - **D4000-D4999**: Periodontics
  - **D5000-D5899**: Prosthodontics (Removable)
  - **D5900-D5999**: Maxillofacial Prosthetics
  - **D6000-D6199**: Implant Services
  - **D7000-D7999**: Oral & Maxillofacial Surgery
  - **D8000-D8999**: Orthodontics
  - **D9000-D9999**: Adjunctive General Services

### Database Implementation

The WellFit dental module includes a **`dental_cdt_codes`** reference table with:

- Code and description
- Typical fee ranges (low/high)
- Medicare/Medicaid coverage flags
- Preventive classification
- Effective/termination dates

**Example Query**:
```sql
SELECT * FROM dental_cdt_codes WHERE preventive = true AND active = true;
```

---

## 2. Reimbursement Pathways

### A. Medicare Advantage Plans

**Overview**: Traditional Medicare does not cover most dental services, but **Medicare Advantage (Part C)** plans often include dental benefits as supplemental coverage.

**Reimbursable Services**:
- Preventive care (cleanings, exams): D0120, D0140, D1110, D1120
- X-rays: D0210, D0220, D0330
- Fluoride treatments (for high-risk seniors): D1206, D1208
- **Link to Chronic Care Management (CCM)**: Dental assessments can be coded as part of CCM services when tied to chronic disease management (diabetes, heart disease).

**Billing Strategy**:
- **Dual coding**: Use CDT codes + ICD-10 codes for chronic conditions
  - Example: D4341 (periodontal scaling) + E11.9 (Type 2 diabetes) demonstrates medical necessity
- **Annual Wellness Visit (AWV)** integration: Dental screenings during AWV can enhance reimbursement for preventive care

**Revenue Potential**: $50-$150 per preventive visit per Medicare Advantage member

---

### B. Medicaid & SDOH Programs

**Overview**: Many state Medicaid programs now reimburse for **Social Determinants of Health (SDOH)** services, including dental care linked to chronic disease prevention.

**Covered Services by State** (varies):
- **Emergency dental care**: Always covered
- **Preventive services**: Increasingly covered for adults (historically only children)
- **Restorative care**: Limited coverage in some states

**Medicaid SDOH Reimbursement Codes**:
- **Z-codes** (ICD-10) for SDOH screening:
  - Z59.9 (Problem related to housing/economic circumstances) – can link to lack of dental care access
  - Z91.89 (Other specified personal risk factors) – poor oral hygiene as nutritional barrier

**Billing Strategy**:
- Document **nutrition impact**: "Patient unable to consume vegetables due to missing teeth → increased diabetes complications"
- Use **care coordination codes** (G-codes) for CHW-led dental referral coordination
- **Value-Based Care Contracts**: Medicaid ACOs/MCOs may pay per-member-per-month (PMPM) for dental preventive services

**Revenue Potential**: $30-$80 per preventive visit; $200-$500 per restorative procedure (if covered)

---

### C. Chronic Care Management (CCM) & Remote Patient Monitoring (RPM)

**Overview**: Dental health assessments and monitoring can qualify under:
- **CCM (CPT 99490)**: $60-$80/month for 20+ minutes of chronic care coordination
- **RPM (CPT 99457)**: $50-$100/month for remote physiologic monitoring

**How Dental Integrates**:
- **Patient-Reported Dental Health Tracking**: Use the `patient_dental_health_tracking` table for RPM data
  - Track: dry mouth (medication side effect), gum bleeding, pain scores
  - Transmit data via FHIR Observation resources to EHR
- **CCM Inclusion**: Dental assessments during CCM care plans for patients with:
  - Diabetes (periodontal disease risk)
  - Heart disease (oral-systemic health link)
  - Stroke survivors (dysphagia + oral health)

**Coding Example**:
```
Service Date: 01/15/2025
CPT 99490: Chronic Care Management (20 min)
ICD-10: E11.9 (Type 2 diabetes), K05.10 (Chronic gingivitis)
Notes: "Coordinated dental referral for gum disease affecting glucose control; patient education on oral-diabetes link"
Reimbursement: $65
```

**Revenue Potential**: $50-$100/month/patient (when dental is part of comprehensive CCM)

---

### D. Commercial Insurance Plans

**Overview**: Most commercial dental plans cover:
- **100% preventive care**: Exams, cleanings, X-rays (2x/year)
- **80% basic restorative**: Fillings, simple extractions
- **50% major restorative**: Crowns, bridges, dentures

**Billing Strategy**:
- **Medical-Dental Integration**: Bill medical insurance (not dental) for dental services related to:
  - Pre-surgical clearance (D0120 exam before cardiac surgery)
  - Trauma/accident-related dental injuries (E-codes)
  - Oral cancer screening (D0431) for tobacco users under medical coverage

**Revenue Potential**: $75-$150 per preventive visit; $100-$2,000 for restorative procedures

---

### E. Grant-Funded Programs

**Overview**: Dental services for underserved populations can be funded through:
- **HRSA Health Center Program**: Community health centers receive grants for integrated medical-dental care
- **CMS Innovation Center Models**: Accountable Health Communities (AHC) Model includes dental referrals
- **Private Foundations**: Robert Wood Johnson Foundation, DentaQuest Foundation fund oral health equity programs

**Revenue Mechanism**:
- **Capitated payments**: Fixed amount per patient for comprehensive care (including dental)
- **Performance bonuses**: Tied to metrics (e.g., % of diabetic patients receiving dental exams)

**Revenue Potential**: $200-$500 per patient per year (capitated funding)

---

## 3. FHIR Integration for Billing

### FHIR Resource Mapping

The WellFit dental module maps CDT codes to FHIR R4 resources for interoperability with billing systems:

| FHIR Resource | Purpose | Billing Use |
|---------------|---------|-------------|
| **Procedure** | Completed dental procedures | Claims submission via CDT codes |
| **Observation** | Clinical measurements (probing depths, plaque index) | Quality metrics, risk stratification |
| **Condition** | Diagnosed dental conditions (periodontitis, caries) | ICD-10 mapping for medical necessity |
| **DiagnosticReport** | Assessment summaries | Documentation for claim review |
| **ServiceRequest** | Referrals to specialists | Coordination of care billing |

### Example FHIR Procedure Resource

```json
{
  "resourceType": "Procedure",
  "status": "completed",
  "code": {
    "coding": [
      {
        "system": "http://www.ada.org/cdt",
        "code": "D1110",
        "display": "Prophylaxis - adult"
      },
      {
        "system": "http://snomed.info/sct",
        "code": "234960005",
        "display": "Dental prophylaxis"
      }
    ]
  },
  "subject": {
    "reference": "Patient/12345"
  },
  "performedDateTime": "2025-11-09T10:00:00Z",
  "performer": [
    {
      "actor": {
        "reference": "Practitioner/67890"
      }
    }
  ]
}
```

### Billing System Integration

**Workflow**:
1. Provider completes dental procedure → Documented in `dental_procedures` table
2. `DentalObservationService.createFHIRProcedure()` generates FHIR Procedure resource
3. FHIR resource sent to billing system via API/integration engine
4. Billing system generates claim with CDT code
5. Claim submitted to payer (EDI 837D for dental claims)

---

## 4. Coding Guidelines

### Preventive Services (High-Priority for Reimbursement)

| CDT Code | Description | Typical Fee | Frequency | Billing Tips |
|----------|-------------|-------------|-----------|--------------|
| **D0120** | Periodic oral evaluation | $50-$100 | 2x/year | Document changes since last visit |
| **D0140** | Limited oral evaluation | $50-$100 | As needed | For problem-focused visits |
| **D0150** | Comprehensive oral evaluation | $75-$150 | New patients | Initial assessment only |
| **D1110** | Prophylaxis - adult | $75-$150 | 2x/year | Key preventive service |
| **D1206** | Fluoride varnish | $25-$50 | 2-4x/year | High-risk patients (diabetes, dry mouth) |
| **D1351** | Sealant - per tooth | $30-$60 | Once per tooth | Preventive for seniors with dry mouth |

### Diagnostic Services (Billable Separately)

| CDT Code | Description | Typical Fee | Billing Tips |
|----------|-------------|-------------|--------------|
| **D0210** | Complete series X-rays | $100-$200 | Once every 3-5 years |
| **D0220** | Periapical - first image | $25-$50 | As needed for diagnosis |
| **D0330** | Panoramic X-ray | $75-$150 | Every 3-5 years |

### Restorative Services (Link to Medical Necessity)

| CDT Code | Description | Typical Fee | ICD-10 Link | Medical Necessity Justification |
|----------|-------------|-------------|-------------|--------------------------------|
| **D2140** | Amalgam filling - 1 surface | $100-$200 | K02.9 (Dental caries) | Prevent tooth loss → maintain nutrition |
| **D2391** | Composite - 1 surface, posterior | $125-$250 | K02.9 | Restore chewing function → diabetic diet compliance |
| **D2750** | Crown - porcelain fused to metal | $900-$1,600 | K08.1 (Tooth loss) | Enable proper nutrition for CHF patient |

### Periodontal Services (High Medical Necessity)

| CDT Code | Description | Typical Fee | ICD-10 Link | Medical Necessity Justification |
|----------|-------------|-------------|-------------|--------------------------------|
| **D4341** | Periodontal scaling - 4+ teeth/quadrant | $150-$300 | K05.3 (Chronic periodontitis) + E11.9 (Diabetes) | Gum disease control improves glucose control |
| **D4910** | Periodontal maintenance | $100-$200 | K05.3 | Prevent exacerbation → reduce systemic inflammation |

---

## 5. Revenue Optimization Strategies

### Strategy 1: Dual Coding (Medical + Dental)

**Concept**: Bill medical insurance for dental services that have clear medical necessity.

**Example**:
- **Scenario**: Diabetic patient with severe gum disease
- **Dental Claim**: D4341 (periodontal scaling) - $200
- **Medical Claim**: 99490 (CCM) including dental coordination - $65
- **Total Revenue**: $265 (vs. $200 if only dental billed)

**ICD-10 Codes to Link**:
- E11.9: Type 2 diabetes
- K05.3: Chronic periodontitis
- I25.10: Atherosclerotic heart disease (link to periodontal bacteria)

---

### Strategy 2: Integrate Dental into CCM/RPM Programs

**Implementation**:
1. Enroll patients with chronic conditions in CCM
2. Include dental health assessment in monthly care coordination
3. Use `patient_dental_health_tracking` table for RPM data (dry mouth, bleeding gums)
4. Bill CPT 99490 (CCM) or 99457 (RPM) with dental as care component

**Revenue Boost**: +$50-$100/month/patient

---

### Strategy 3: Value-Based Contracts

**Metrics to Negotiate**:
- % of diabetic patients receiving annual dental exam
- % of heart disease patients with healthy periodontal status
- Reduction in ED visits for dental emergencies

**Payment Models**:
- **Shared savings**: Earn % of savings from prevented hospitalizations
- **Quality bonuses**: $50-$200 per patient meeting dental quality metrics

---

### Strategy 4: Grant Capture for Underserved Populations

**Target Grants**:
- **HRSA Health Center Program**: $500K-$2M for integrated medical-dental clinics
- **DentaQuest Foundation**: Grants for oral health equity initiatives
- **CDC Community Health Grants**: Dental preventive services for chronic disease populations

**Application Positioning**: Use WellFit's FHIR-compliant dental module as "innovative technology infrastructure"

---

## 6. Documentation Requirements

### For Reimbursement Approval

**Every dental claim must include**:

1. **CDT Code**: Specific procedure code
2. **ICD-10 Code**: Diagnosis justifying procedure
3. **Clinical Notes**: Assessment, treatment rationale
4. **Tooth Number(s)**: If procedure is tooth-specific
5. **Provider Credentials**: License number, NPI

**Enhanced Documentation for Medical Necessity**:
- Link to chronic condition: "Periodontal disease exacerbating patient's diabetes control (HbA1c 9.2%)"
- Nutritional impact: "Missing molars preventing patient from chewing vegetables → worsening CHF diet compliance"
- Medication side effects: "Dry mouth from 5 medications → increased cavity risk"

### FHIR Documentation

The dental module automatically generates FHIR resources for compliance:

- **Observation**: Clinical measurements (stored in `dental_observations` table)
- **Procedure**: All completed procedures with CDT codes
- **Condition**: Active dental conditions with SNOMED codes
- **DiagnosticReport**: Assessment summaries

---

## 7. Compliance & Regulatory Considerations

### HIPAA Compliance

- All dental data stored with **RLS (Row Level Security)** in Supabase
- PHI encrypted at rest and in transit
- Audit logging for all data access

### Billing Fraud Prevention

**Red Flags to Avoid**:
- Upcoding: Billing higher-level service than performed
- Unbundling: Billing components separately when should be bundled
- Phantom billing: Billing for services not rendered

**WellFit Safeguards**:
- Procedures linked to assessments (`assessment_id` foreign key)
- Provider ID required for all billable services
- Timestamp verification (procedure_date validation)

### State Licensing

**Provider Requirements**:
- Dentist: DDS or DMD license
- Hygienist: State-specific licensure
- NPI (National Provider Identifier) required for billing

**Database Field**: `provider_role` in `dental_assessments` tracks credential type

---

## Summary: Revenue Potential

| Reimbursement Pathway | Per-Patient Revenue/Year | Volume Potential | Total Annual Revenue (1,000 patients) |
|----------------------|--------------------------|------------------|---------------------------------------|
| Medicare Advantage Preventive | $150-$300 | High | $150K-$300K |
| Medicaid SDOH + Preventive | $100-$200 | Medium | $100K-$200K |
| CCM/RPM Dental Integration | $600-$1,200 | Medium | $600K-$1.2M |
| Commercial Insurance | $200-$500 | High | $200K-$500K |
| Grant Funding (Capitated) | $200-$500 | Low | $200K-$500K |
| **TOTAL** | **$1,250-$2,700** | - | **$1.25M-$2.7M** |

---

## Next Steps for Implementation

1. **Configure billing system integration** (EDI 837D claims)
2. **Train staff** on dual coding strategies (medical + dental)
3. **Establish value-based contracts** with payers
4. **Apply for grants** using this module as infrastructure differentiator
5. **Monitor revenue metrics** via `dental_procedures` financial fields

---

## Contact for Billing Support

For questions about dental module billing integration:
- **Technical**: WellFit Development Team
- **Billing**: Revenue Cycle Management Team
- **Compliance**: HIPAA Officer

---

*Document Version: 1.0*
*Last Updated: November 9, 2025*
*Maintained by: WellFit Community Health Platform*
