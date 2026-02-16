/**
 * FHIR L&D Procedure Service
 * Maps delivery records and labor procedures to FHIR R4 Procedure resources
 */

import { supabase } from '../../../lib/supabaseClient';
import { getErrorMessage } from '../../../lib/getErrorMessage';
import type { LDDeliveryRecord } from '../../../types/laborDelivery';
import type { FHIRProcedure, FHIRApiResponse, FHIRCodeableConcept } from './types';
import { LD_SNOMED_CODES } from './codes';

/** Map delivery method to SNOMED CT code */
function getDeliveryMethodCode(method: string): { code: string; display: string } {
  const map: Record<string, { code: string; display: string }> = {
    spontaneous_vaginal: { code: LD_SNOMED_CODES.SPONTANEOUS_VAGINAL, display: 'Normal delivery procedure' },
    assisted_vacuum: { code: LD_SNOMED_CODES.VACUUM_DELIVERY, display: 'Vacuum extraction delivery' },
    assisted_forceps: { code: LD_SNOMED_CODES.FORCEPS_DELIVERY, display: 'Forceps delivery' },
    cesarean_planned: { code: LD_SNOMED_CODES.CESAREAN, display: 'Cesarean section - planned' },
    cesarean_emergent: { code: LD_SNOMED_CODES.CESAREAN, display: 'Cesarean section - emergent' },
    vbac: { code: LD_SNOMED_CODES.SPONTANEOUS_VAGINAL, display: 'Vaginal birth after cesarean' },
  };
  return map[method] ?? { code: LD_SNOMED_CODES.SPONTANEOUS_VAGINAL, display: method.replace(/_/g, ' ') };
}

/** Map anesthesia type to FHIR CodeableConcept */
function getAnesthesiaCode(anesthesia: string): FHIRCodeableConcept | null {
  if (anesthesia === 'none') return null;
  const display = anesthesia.replace(/_/g, ' ');
  return {
    coding: [{
      system: 'http://snomed.info/sct',
      code: anesthesia === 'epidural' ? LD_SNOMED_CODES.EPIDURAL : '399097000',
      display: `${display} anesthesia`,
    }],
    text: `${display} anesthesia`,
  };
}

export class LDProcedureService {
  /**
   * Create FHIR Procedure from delivery record
   */
  static async createProcedureFromDelivery(
    delivery: LDDeliveryRecord
  ): Promise<FHIRApiResponse<FHIRProcedure>> {
    try {
      const methodCode = getDeliveryMethodCode(delivery.method);

      const procedure: FHIRProcedure = {
        resourceType: 'Procedure',
        status: 'completed',
        code: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: methodCode.code,
            display: methodCode.display,
          }],
          text: methodCode.display,
        },
        subject: {
          reference: `Patient/${delivery.patient_id}`,
          type: 'Patient',
        },
        performedDateTime: delivery.delivery_datetime,
      };

      // Add delivery provider
      if (delivery.delivery_provider_id) {
        procedure.performer = [{
          actor: {
            reference: `Practitioner/${delivery.delivery_provider_id}`,
            type: 'Practitioner',
          },
        }];
      }

      // Complications as FHIR complication codes
      if (delivery.complications.length > 0) {
        procedure.complication = delivery.complications.map((c) => ({
          coding: [{ system: 'http://snomed.info/sct', display: c }],
          text: c,
        }));
      }

      // Anesthesia as usedCode
      const anesthesiaCode = getAnesthesiaCode(delivery.anesthesia);
      if (anesthesiaCode) {
        procedure.usedCode = [anesthesiaCode];
      }

      // Notes with EBL and labor duration
      const notes: string[] = [];
      notes.push(`EBL: ${delivery.estimated_blood_loss_ml} mL`);
      if (delivery.labor_duration_hours) {
        notes.push(`Labor duration: ${delivery.labor_duration_hours} hours`);
      }
      if (delivery.second_stage_duration_min) {
        notes.push(`Second stage: ${delivery.second_stage_duration_min} minutes`);
      }
      if (delivery.episiotomy) {
        notes.push('Episiotomy performed');
      }
      if (delivery.laceration_degree !== null && delivery.laceration_degree !== undefined && delivery.laceration_degree > 0) {
        notes.push(`${delivery.laceration_degree}° laceration`);
      }
      procedure.note = [{ text: notes.join('; ') }];

      // Store the FHIR Procedure
      await supabase.from('fhir_procedures').insert({
        patient_id: delivery.patient_id,
        resource_type: 'Procedure',
        resource_data: procedure,
        snomed_code: methodCode.code,
        status: 'completed',
      });

      return { success: true, data: procedure };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }
}
