// =====================================================
// MCP Prior Auth Server — FHIR Claim Converter (Da Vinci PAS)
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function handleToFHIRClaim(
  args: Record<string, unknown>,
  sb: SupabaseClient
) {
  const { data: priorAuth, error } = await sb
    .from('prior_authorizations')
    .select('*')
    .eq('id', args.prior_auth_id)
    .single();

  if (error) throw error;

  // Convert to FHIR Claim resource (Da Vinci PAS profile)
  const fhirClaim = {
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
    diagnosis: (priorAuth.diagnosis_codes as string[]).map((code: string, index: number) => ({
      sequence: index + 1,
      diagnosisCodeableConcept: {
        coding: [{
          system: 'http://hl7.org/fhir/sid/icd-10-cm',
          code: code
        }]
      }
    })),
    item: (priorAuth.service_codes as string[]).map((code: string, index: number) => ({
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

  return {
    fhir_claim: fhirClaim,
    prior_auth_id: priorAuth.id,
    profile: 'http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim'
  };
}
