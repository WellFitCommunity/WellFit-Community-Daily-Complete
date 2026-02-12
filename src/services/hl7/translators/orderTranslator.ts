/**
 * HL7 ORC/AL1/DG1/IN1 Segment to FHIR Resource Translators
 *
 * Converts HL7 v2.x segments to FHIR R4 resources:
 * - ORC (Common Order) → ServiceRequest
 * - AL1 (Allergy) → AllergyIntolerance
 * - DG1 (Diagnosis) → Condition
 * - IN1 (Insurance) → Coverage
 */

import type {
  ORCSegment,
  OBRSegment,
  AL1Segment,
  DG1Segment,
  IN1Segment,
} from '../../../types/hl7v2';

import type {
  FHIRServiceRequest,
  FHIRAllergyIntolerance,
  FHIRCondition,
  FHIRCoverage,
} from './types';

import {
  translateOrderStatus,
  translateOrderIntent,
  translateAllergenCategory,
  translateAllergySeverity,
  translateDiagnosisType,
} from './statusMaps';

import {
  translateDateTime,
  translateDate,
  translateCodedElement,
  translateExtendedPersonToReference,
  generateResourceId,
} from './commonTranslators';

import { translatePriority } from './statusMaps';

// ============================================================================
// ORC → FHIR ServiceRequest
// ============================================================================

/**
 * Translate an ORC segment (with optional OBR) to a FHIR ServiceRequest resource
 */
export function orcToServiceRequest(
  orc: ORCSegment,
  obr: OBRSegment | undefined,
  sourceSystem: string
): FHIRServiceRequest {
  const serviceRequest: FHIRServiceRequest = {
    resourceType: 'ServiceRequest',
    id: generateResourceId('ServiceRequest'),
    meta: {
      source: sourceSystem,
      lastUpdated: new Date().toISOString(),
    },
    status: translateOrderStatus(orc.orderStatus),
    intent: translateOrderIntent(orc.orderControl),
    subject: { reference: 'Patient/unknown' }, // Will be linked later
  };

  // Identifiers
  serviceRequest.identifier = [];
  if (orc.placerOrderNumber) {
    serviceRequest.identifier.push({
      use: 'official',
      type: { text: 'Placer Order Number' },
      value: orc.placerOrderNumber,
    });
  }
  if (orc.fillerOrderNumber) {
    serviceRequest.identifier.push({
      use: 'usual',
      type: { text: 'Filler Order Number' },
      value: orc.fillerOrderNumber,
    });
  }

  // Code from OBR if available
  if (obr?.universalServiceIdentifier) {
    serviceRequest.code = translateCodedElement(obr.universalServiceIdentifier);
  }

  // Priority
  if (obr?.priority) {
    serviceRequest.priority = translatePriority(obr.priority);
  }

  // Authored on
  if (orc.dateTimeOfTransaction) {
    serviceRequest.authoredOn = translateDateTime(orc.dateTimeOfTransaction);
  }

  // Requester (ordering provider)
  if (orc.orderingProvider && orc.orderingProvider.length > 0) {
    serviceRequest.requester = translateExtendedPersonToReference(orc.orderingProvider[0]);
  }

  // Reason
  if (obr?.reasonForStudy) {
    serviceRequest.reasonCode = obr.reasonForStudy.map((r) => translateCodedElement(r));
  }

  // Clinical info as note
  if (obr?.relevantClinicalInfo) {
    serviceRequest.note = [{ text: obr.relevantClinicalInfo }];
  }

  return serviceRequest;
}

// ============================================================================
// AL1 → FHIR AllergyIntolerance
// ============================================================================

/**
 * Translate an AL1 segment to a FHIR AllergyIntolerance resource
 */
export function al1ToAllergyIntolerance(
  al1: AL1Segment,
  sourceSystem: string
): FHIRAllergyIntolerance {
  const allergy: FHIRAllergyIntolerance = {
    resourceType: 'AllergyIntolerance',
    id: generateResourceId('AllergyIntolerance'),
    meta: {
      source: sourceSystem,
      lastUpdated: new Date().toISOString(),
      profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance'],
    },
    patient: { reference: 'Patient/unknown' }, // Will be linked later
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
          code: 'active',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
          code: 'confirmed',
        },
      ],
    },
  };

  // Allergen code
  allergy.code = translateCodedElement(al1.allergenCode);

  // Category based on allergen type
  if (al1.allergenTypeCode?.identifier) {
    allergy.category = [translateAllergenCategory(al1.allergenTypeCode.identifier)];
  }

  // Criticality from severity
  if (al1.allergySeverityCode) {
    allergy.criticality = translateAllergySeverity(al1.allergySeverityCode);
  }

  // Onset date
  if (al1.identificationDate) {
    allergy.onsetDateTime = translateDate(al1.identificationDate);
  }

  // Reactions
  if (al1.allergyReaction && al1.allergyReaction.length > 0) {
    allergy.reaction = [
      {
        manifestation: al1.allergyReaction.map((r) => ({
          text: r,
        })),
      },
    ];
  }

  return allergy;
}

// ============================================================================
// DG1 → FHIR Condition
// ============================================================================

/**
 * Translate a DG1 segment to a FHIR Condition resource
 */
export function dg1ToCondition(
  dg1: DG1Segment,
  sourceSystem: string
): FHIRCondition {
  const condition: FHIRCondition = {
    resourceType: 'Condition',
    id: generateResourceId('Condition'),
    meta: {
      source: sourceSystem,
      lastUpdated: new Date().toISOString(),
      profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition'],
    },
    subject: { reference: 'Patient/unknown' }, // Will be linked later
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
        },
      ],
    },
  };

  // Diagnosis code
  if (dg1.diagnosisCode) {
    condition.code = translateCodedElement(dg1.diagnosisCode);
  } else if (dg1.diagnosisDescription) {
    condition.code = { text: dg1.diagnosisDescription };
  }

  // Category based on diagnosis type
  condition.category = [
    {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-category',
          code: translateDiagnosisType(dg1.diagnosisType),
        },
      ],
    },
  ];

  // Onset date
  if (dg1.diagnosisDateTime) {
    condition.onsetDateTime = translateDateTime(dg1.diagnosisDateTime);
  }

  // Recorded date
  if (dg1.attestationDateTime) {
    condition.recordedDate = translateDateTime(dg1.attestationDateTime);
  }

  // Recorder
  if (dg1.diagnosingClinician && dg1.diagnosingClinician.length > 0) {
    condition.recorder = translateExtendedPersonToReference(dg1.diagnosingClinician[0]);
  }

  return condition;
}

// ============================================================================
// IN1 → FHIR Coverage
// ============================================================================

/**
 * Translate an IN1 segment to a FHIR Coverage resource
 */
export function in1ToCoverage(
  in1: IN1Segment,
  sourceSystem: string
): FHIRCoverage {
  const coverage: FHIRCoverage = {
    resourceType: 'Coverage',
    id: generateResourceId('Coverage'),
    meta: {
      source: sourceSystem,
      lastUpdated: new Date().toISOString(),
    },
    status: 'active',
    beneficiary: { reference: 'Patient/unknown' }, // Will be linked later
    payor: [],
  };

  // Identifier (policy number)
  if (in1.policyNumber) {
    coverage.identifier = [
      {
        use: 'official',
        value: in1.policyNumber,
      },
    ];
  }

  // Plan type
  if (in1.planType || in1.insurancePlanId) {
    coverage.type = translateCodedElement(in1.insurancePlanId) || { text: in1.planType };
  }

  // Subscriber ID
  if (in1.insuredIdNumber && in1.insuredIdNumber.length > 0) {
    coverage.subscriberId = in1.insuredIdNumber[0];
  }

  // Period
  if (in1.planEffectiveDate || in1.planExpirationDate) {
    coverage.period = {
      start: in1.planEffectiveDate ? translateDate(in1.planEffectiveDate) : undefined,
      end: in1.planExpirationDate ? translateDate(in1.planExpirationDate) : undefined,
    };
  }

  // Payor (insurance company)
  if (in1.insuranceCompanyName && in1.insuranceCompanyName.length > 0) {
    coverage.payor = [
      {
        display: in1.insuranceCompanyName[0].organizationName,
      },
    ];
  }

  // Class (group info)
  if (in1.groupNumber || in1.groupName) {
    coverage.class = [
      {
        type: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-class', code: 'group' }],
        },
        value: in1.groupNumber || '',
        name: in1.groupName?.[0]?.organizationName,
      },
    ];
  }

  // Relationship
  if (in1.insuredRelationshipToPatient) {
    coverage.relationship = translateCodedElement(in1.insuredRelationshipToPatient);
  }

  return coverage;
}
