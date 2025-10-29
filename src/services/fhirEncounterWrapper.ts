/**
 * FHIR Encounter Wrapper
 * Wraps existing billing encounters into FHIR R4 Encounter resources
 * Provides bidirectional mapping between billing system and FHIR
 */

import { supabase } from '../lib/supabaseClient';
import { EncounterService } from './encounterService';
import type { Encounter as BillingEncounter } from '../types/billing';

// ============================================================================
// FHIR ENCOUNTER TYPES
// ============================================================================

export interface FHIREncounter {
  resourceType: 'Encounter';
  id: string;
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  class: {
    system: string;
    code: string;
    display: string;
  };
  type?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text?: string;
  }>;
  subject: {
    reference: string;
    display?: string;
  };
  participant?: Array<{
    type?: Array<{
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    }>;
    individual?: {
      reference: string;
      display?: string;
    };
  }>;
  period?: {
    start: string;
    end?: string;
  };
  reasonCode?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text?: string;
  }>;
  diagnosis?: Array<{
    condition: {
      reference: string;
    };
    use?: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    rank?: number;
  }>;
  hospitalization?: {
    admitSource?: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
    dischargeDisposition?: {
      coding: Array<{
        system: string;
        code: string;
        display: string;
      }>;
    };
  };
  location?: Array<{
    location: {
      reference: string;
      display?: string;
    };
    status?: 'planned' | 'active' | 'reserved' | 'completed';
    period?: {
      start: string;
      end?: string;
    };
  }>;
  serviceProvider?: {
    reference: string;
    display?: string;
  };
}

// ============================================================================
// ENCOUNTER WRAPPER SERVICE
// ============================================================================

export class FHIREncounterWrapper {
  /**
   * Convert billing encounter to FHIR Encounter resource
   */
  static toFHIR(billingEncounter: BillingEncounter): FHIREncounter {
    const encounter: FHIREncounter = {
      resourceType: 'Encounter',
      id: billingEncounter.id,
      status: 'finished', // Billing encounters are historical
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB', // Ambulatory as default
        display: 'ambulatory',
      },
      subject: {
        reference: `Patient/${billingEncounter.patient_id}`,
        display: billingEncounter.patient
          ? `${billingEncounter.patient.first_name} ${billingEncounter.patient.last_name}`
          : undefined,
      },
      period: {
        start: billingEncounter.date_of_service,
      },
    };

    // Add provider as participant
    if (billingEncounter.provider) {
      encounter.participant = [
        {
          type: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                  code: 'ATND',
                  display: 'attender',
                },
              ],
            },
          ],
          individual: {
            reference: `Practitioner/${billingEncounter.provider.id}`,
            display: billingEncounter.provider.organization_name || undefined,
          },
        },
      ];
    }

    // Add diagnoses from encounter_diagnoses
    if (billingEncounter.diagnoses && billingEncounter.diagnoses.length > 0) {
      encounter.diagnosis = billingEncounter.diagnoses.map((diag, index) => ({
        condition: {
          reference: `Condition/${diag.code}`,
        },
        use: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/diagnosis-role',
              code: index === 0 ? 'AD' : 'DD',
              display: index === 0 ? 'Admission diagnosis' : 'Discharge diagnosis',
            },
          ],
        },
        rank: diag.sequence || (index + 1),
      }));
    }

    return encounter;
  }

  /**
   * Get FHIR encounter by billing encounter ID
   */
  static async getFHIREncounter(encounterId: string): Promise<FHIREncounter | null> {
    try {
      const billingEncounter = await EncounterService.getEncounter(encounterId);
      return this.toFHIR(billingEncounter);
    } catch (error) {

      return null;
    }
  }

  /**
   * Get all FHIR encounters for a patient
   */
  static async getPatientEncounters(patientId: string): Promise<FHIREncounter[]> {
    try {
      const billingEncounters = await EncounterService.getEncountersByPatient(patientId);
      return billingEncounters.map((enc) => this.toFHIR(enc));
    } catch (error) {

      return [];
    }
  }

  /**
   * Search encounters with FHIR parameters
   */
  static async searchEncounters(params: {
    patient?: string;
    date?: string;
    status?: string;
    class?: string;
    type?: string;
  }): Promise<FHIREncounter[]> {
    try {
      const filters: any = {};

      if (params.patient) filters.patientId = params.patient;
      if (params.date) {
        filters.dateFrom = params.date;
        filters.dateTo = params.date;
      }
      if (params.status) filters.status = params.status;

      const billingEncounters = await EncounterService.searchEncounters(filters);
      let fhirEncounters = billingEncounters.map((enc) => this.toFHIR(enc));

      // Filter by class if specified
      if (params.class) {
        fhirEncounters = fhirEncounters.filter((enc) => enc.class.code === params.class);
      }

      return fhirEncounters;
    } catch (error) {

      return [];
    }
  }

  // ============================================================================
  // MAPPING HELPERS
  // ============================================================================

  private static mapDiagnosisType(diagnosisType?: string): string {
    switch (diagnosisType?.toLowerCase()) {
      case 'primary':
        return 'AD'; // Admission diagnosis
      case 'secondary':
        return 'DD'; // Discharge diagnosis
      case 'admitting':
        return 'AD';
      case 'final':
        return 'DD';
      default:
        return 'DD';
    }
  }

  /**
   * Create FHIR Bundle for encounter with related resources
   */
  static async getEncounterBundle(encounterId: string): Promise<{
    resourceType: 'Bundle';
    type: 'searchset';
    total: number;
    entry: Array<{ resource: any }>;
  } | null> {
    try {
      const fhirEncounter = await this.getFHIREncounter(encounterId);
      if (!fhirEncounter) return null;

      const billingData = await EncounterService.getEncounterForBilling(encounterId);

      const bundle = {
        resourceType: 'Bundle' as const,
        type: 'searchset' as const,
        total: 1,
        entry: [
          {
            resource: fhirEncounter,
          },
        ],
      };

      // Add conditions if present
      if (billingData.diagnoses && billingData.diagnoses.length > 0) {
        // Would fetch from fhir_conditions table if they exist
        bundle.total += billingData.diagnoses.length;
      }

      // Add procedures if present
      if (billingData.procedures && billingData.procedures.length > 0) {
        // Would fetch from fhir_procedures table if they exist
        bundle.total += billingData.procedures.length;
      }

      return bundle;
    } catch (error) {

      return null;
    }
  }
}

export default FHIREncounterWrapper;
