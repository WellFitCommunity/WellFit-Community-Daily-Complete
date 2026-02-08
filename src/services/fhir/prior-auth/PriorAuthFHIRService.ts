/**
 * Prior Authorization FHIR Resource Conversion
 * Da Vinci PAS Implementation Guide compliant
 *
 * Converts prior authorization data to FHIR Claim and ClaimResponse resources
 */

import type { PriorAuthorization, PriorAuthDecision } from './types';

/**
 * Convert prior authorization to FHIR Claim resource (for PA request)
 * Following Da Vinci PAS Implementation Guide
 */
export function toFHIRClaimResource(priorAuth: PriorAuthorization): Record<string, unknown> {
  return {
    resourceType: 'Claim',
    id: priorAuth.fhir_resource_id || priorAuth.id,
    meta: {
      profile: ['http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim']
    },
    status: priorAuth.status === 'draft' ? 'draft' : 'active',
    type: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/claim-type',
        code: 'professional'
      }]
    },
    use: 'preauthorization',
    patient: {
      reference: `Patient/${priorAuth.patient_id}`
    },
    created: priorAuth.created_at,
    insurer: {
      identifier: {
        value: priorAuth.payer_id
      },
      display: priorAuth.payer_name
    },
    provider: {
      identifier: {
        system: 'http://hl7.org/fhir/sid/us-npi',
        value: priorAuth.ordering_provider_npi
      }
    },
    priority: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/processpriority',
        code: priorAuth.urgency === 'stat' ? 'stat' :
              priorAuth.urgency === 'urgent' ? 'urgent' : 'normal'
      }]
    },
    diagnosis: priorAuth.diagnosis_codes.map((code, index) => ({
      sequence: index + 1,
      diagnosisCodeableConcept: {
        coding: [{
          system: 'http://hl7.org/fhir/sid/icd-10-cm',
          code: code
        }]
      }
    })),
    item: priorAuth.service_codes.map((code, index) => ({
      sequence: index + 1,
      productOrService: {
        coding: [{
          system: 'http://www.ama-assn.org/go/cpt',
          code: code
        }]
      },
      servicedDate: priorAuth.date_of_service,
      quantity: {
        value: priorAuth.requested_units || 1
      }
    })),
    supportingInfo: priorAuth.clinical_notes ? [{
      sequence: 1,
      category: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/claiminformationcategory',
          code: 'info'
        }]
      },
      valueString: priorAuth.clinical_notes
    }] : undefined
  };
}

/**
 * Convert prior authorization to FHIR ClaimResponse resource
 * Following Da Vinci PAS Implementation Guide
 */
export function toFHIRClaimResponseResource(
  priorAuth: PriorAuthorization,
  decision?: PriorAuthDecision
): Record<string, unknown> {
  const outcome = decision?.decision_type === 'approved' ? 'complete' :
                  decision?.decision_type === 'denied' ? 'error' :
                  decision?.decision_type === 'partial_approval' ? 'partial' : 'queued';

  return {
    resourceType: 'ClaimResponse',
    id: `${priorAuth.id}-response`,
    meta: {
      profile: ['http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claimresponse']
    },
    status: 'active',
    type: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/claim-type',
        code: 'professional'
      }]
    },
    use: 'preauthorization',
    patient: {
      reference: `Patient/${priorAuth.patient_id}`
    },
    created: decision?.decision_date || new Date().toISOString(),
    insurer: {
      identifier: {
        value: priorAuth.payer_id
      }
    },
    request: {
      reference: `Claim/${priorAuth.fhir_resource_id || priorAuth.id}`
    },
    outcome: outcome,
    preAuthRef: priorAuth.auth_number,
    preAuthPeriod: priorAuth.expires_at ? {
      start: priorAuth.approved_at,
      end: priorAuth.expires_at
    } : undefined,
    item: priorAuth.service_codes.map((_code, index) => ({
      itemSequence: index + 1,
      adjudication: [{
        category: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/adjudication',
            code: 'submitted'
          }]
        }
      }]
    })),
    error: decision?.decision_type === 'denied' ? [{
      code: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/adjudication-error',
          code: decision.denial_reason_code || 'other',
          display: decision.denial_reason_description
        }]
      }
    }] : undefined
  };
}
