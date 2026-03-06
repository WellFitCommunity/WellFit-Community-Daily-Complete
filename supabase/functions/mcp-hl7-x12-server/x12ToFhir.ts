// =====================================================
// X12 to FHIR R4 Conversion
// Purpose: Convert X12 837P claims to FHIR Claim + Bundle
// =====================================================

import type { FHIRResource, FHIRClaim, FHIRBundle } from './types.ts';
import { parseX12 } from './x12Parser.ts';

/**
 * Convert an X12 837P claim to a FHIR Claim resource and Bundle.
 * Parses the X12 content and maps fields to FHIR R4 Claim structure.
 */
export function x12ToFHIR(x12Content: string): {
  claim: FHIRClaim;
  bundle: FHIRBundle;
} {
  const parsed = parseX12(x12Content);

  // Create Patient resource from parsed claim data
  const patientId = `patient-${parsed.interchangeControlNumber || Date.now()}`;
  const patient: FHIRResource = {
    resourceType: 'Patient',
    id: patientId,
    name: parsed.patientName ? [{ text: parsed.patientName }] : undefined,
  };

  const claim: FHIRClaim = {
    resourceType: 'Claim' as const,
    id: `claim-${parsed.claimId || Date.now()}`,
    status: 'active',
    type: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/claim-type',
        code: 'professional'
      }]
    },
    use: 'claim',
    created: new Date().toISOString(),
    provider: {
      display: parsed.providerName
    },
    insurer: {
      display: parsed.payerName
    },
    patient: {
      reference: `Patient/${patientId}`,
      display: parsed.patientName
    },
    total: {
      value: parsed.totalCharges,
      currency: 'USD'
    },
    diagnosis: parsed.diagnoses.map((code, idx) => ({
      sequence: idx + 1,
      diagnosisCodeableConcept: {
        coding: [{
          system: 'http://hl7.org/fhir/sid/icd-10-cm',
          code: code
        }]
      }
    })),
    item: parsed.procedures.map((proc, idx) => ({
      sequence: idx + 1,
      productOrService: {
        coding: [{
          system: 'http://www.ama-assn.org/go/cpt',
          code: proc.code
        }]
      },
      quantity: { value: proc.units },
      unitPrice: { value: proc.charges, currency: 'USD' },
      net: { value: proc.charges * proc.units, currency: 'USD' }
    })),
    billablePeriod: parsed.serviceDate ? {
      start: parsed.serviceDate,
      end: parsed.serviceDate
    } : undefined
  };

  const bundle: FHIRBundle = {
    resourceType: 'Bundle' as const,
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: [
      { fullUrl: `urn:uuid:${patient.id}`, resource: patient },
      { fullUrl: `urn:uuid:${claim.id}`, resource: claim }
    ]
  };

  return { claim, bundle };
}
