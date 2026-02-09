/**
 * FHIR Oncology Observation Service
 * FHIR R4 compliant mapping for oncology observations
 * Resources: Observation (labs, staging, tumor markers, performance status)
 */

import { supabase } from '../../../lib/supabaseClient';
import { getErrorMessage } from '../../../lib/getErrorMessage';
import type {
  OncLabMonitoring,
  OncStaging,
  OncCancerRegistry,
} from '../../../types/oncology';
import type { FHIRObservation, FHIRApiResponse } from './types';
import { ONCOLOGY_LOINC_CODES } from './codes';
import {
  buildOncologyObservation,
  interpretANC,
  interpretHemoglobin,
  interpretPlatelets,
  interpretECOGStatus,
} from './helpers';

export class OncologyObservationService {
  /**
   * Create FHIR Observations from lab monitoring results
   */
  static async createObservationsFromLabs(
    labs: OncLabMonitoring
  ): Promise<FHIRApiResponse<FHIRObservation[]>> {
    try {
      const observations: FHIRObservation[] = [];

      // WBC
      if (labs.wbc !== null) {
        observations.push(
          buildOncologyObservation({
            code: ONCOLOGY_LOINC_CODES.WBC,
            display: 'White Blood Cell Count',
            patientId: labs.patient_id,
            effectiveDateTime: labs.lab_date,
            valueQuantity: {
              value: labs.wbc,
              unit: '10^3/uL',
              system: 'http://unitsofmeasure.org',
              code: '10*3/uL',
            },
            referenceRangeLow: 4.5,
            referenceRangeHigh: 11.0,
          })
        );
      }

      // ANC
      if (labs.anc !== null) {
        observations.push(
          buildOncologyObservation({
            code: ONCOLOGY_LOINC_CODES.ANC,
            display: 'Absolute Neutrophil Count',
            patientId: labs.patient_id,
            effectiveDateTime: labs.lab_date,
            valueQuantity: {
              value: labs.anc,
              unit: '/uL',
              system: 'http://unitsofmeasure.org',
              code: '/uL',
            },
            referenceRangeLow: 1500,
            referenceRangeHigh: 8000,
            interpretation: interpretANC(labs.anc),
          })
        );
      }

      // Hemoglobin
      if (labs.hemoglobin !== null) {
        observations.push(
          buildOncologyObservation({
            code: ONCOLOGY_LOINC_CODES.HEMOGLOBIN,
            display: 'Hemoglobin',
            patientId: labs.patient_id,
            effectiveDateTime: labs.lab_date,
            valueQuantity: {
              value: labs.hemoglobin,
              unit: 'g/dL',
              system: 'http://unitsofmeasure.org',
              code: 'g/dL',
            },
            referenceRangeLow: 12.0,
            referenceRangeHigh: 17.5,
            interpretation: interpretHemoglobin(labs.hemoglobin),
          })
        );
      }

      // Platelets
      if (labs.platelets !== null) {
        observations.push(
          buildOncologyObservation({
            code: ONCOLOGY_LOINC_CODES.PLATELETS,
            display: 'Platelet Count',
            patientId: labs.patient_id,
            effectiveDateTime: labs.lab_date,
            valueQuantity: {
              value: labs.platelets,
              unit: '/uL',
              system: 'http://unitsofmeasure.org',
              code: '/uL',
            },
            referenceRangeLow: 150000,
            referenceRangeHigh: 400000,
            interpretation: interpretPlatelets(labs.platelets),
          })
        );
      }

      // Tumor marker
      if (labs.tumor_marker_name && labs.tumor_marker_value !== null) {
        const markerCode = getMarkerCode(labs.tumor_marker_name);
        if (markerCode) {
          observations.push(
            buildOncologyObservation({
              code: markerCode,
              display: labs.tumor_marker_name,
              patientId: labs.patient_id,
              effectiveDateTime: labs.lab_date,
              valueQuantity: {
                value: labs.tumor_marker_value,
                unit: labs.tumor_marker_unit || 'unknown',
                system: 'http://unitsofmeasure.org',
                code: labs.tumor_marker_unit || 'unknown',
              },
            })
          );
        }
      }

      // Store in FHIR observations table
      for (const obs of observations) {
        await supabase.from('fhir_observations').insert({
          patient_id: labs.patient_id,
          resource_type: 'Observation',
          resource_data: obs,
          loinc_code: obs.code.coding?.[0]?.code,
          status: 'final',
        });
      }

      return { success: true, data: observations };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Create FHIR Observations from TNM staging
   */
  static async createObservationsFromStaging(
    staging: OncStaging
  ): Promise<FHIRApiResponse<FHIRObservation[]>> {
    try {
      const observations: FHIRObservation[] = [];

      // T Stage
      observations.push(
        buildOncologyObservation({
          code: ONCOLOGY_LOINC_CODES.TNM_T,
          display: 'Primary Tumor (T)',
          patientId: staging.patient_id,
          effectiveDateTime: staging.staging_date,
          valueString: staging.t_stage,
        })
      );

      // N Stage
      observations.push(
        buildOncologyObservation({
          code: ONCOLOGY_LOINC_CODES.TNM_N,
          display: 'Regional Lymph Nodes (N)',
          patientId: staging.patient_id,
          effectiveDateTime: staging.staging_date,
          valueString: staging.n_stage,
        })
      );

      // M Stage
      observations.push(
        buildOncologyObservation({
          code: ONCOLOGY_LOINC_CODES.TNM_M,
          display: 'Distant Metastasis (M)',
          patientId: staging.patient_id,
          effectiveDateTime: staging.staging_date,
          valueString: staging.m_stage,
        })
      );

      // Overall Stage
      observations.push(
        buildOncologyObservation({
          code: ONCOLOGY_LOINC_CODES.OVERALL_STAGE,
          display: 'Overall Cancer Stage',
          patientId: staging.patient_id,
          effectiveDateTime: staging.staging_date,
          valueString: `Stage ${staging.overall_stage} (${staging.staging_type}, AJCC ${staging.ajcc_edition}th)`,
        })
      );

      for (const obs of observations) {
        await supabase.from('fhir_observations').insert({
          patient_id: staging.patient_id,
          resource_type: 'Observation',
          resource_data: obs,
          loinc_code: obs.code.coding?.[0]?.code,
          status: 'final',
        });
      }

      return { success: true, data: observations };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Create FHIR Observation for ECOG performance status
   */
  static async createObservationFromECOG(
    registry: OncCancerRegistry
  ): Promise<FHIRApiResponse<FHIRObservation>> {
    try {
      const observation = buildOncologyObservation({
        code: ONCOLOGY_LOINC_CODES.ECOG,
        display: 'ECOG Performance Status',
        patientId: registry.patient_id,
        effectiveDateTime: registry.updated_at,
        valueQuantity: {
          value: registry.ecog_status,
          unit: '{score}',
          system: 'http://unitsofmeasure.org',
          code: '{score}',
        },
        referenceRangeLow: 0,
        referenceRangeHigh: 2,
        interpretation: interpretECOGStatus(registry.ecog_status),
      });

      await supabase.from('fhir_observations').insert({
        patient_id: registry.patient_id,
        resource_type: 'Observation',
        resource_data: observation,
        loinc_code: ONCOLOGY_LOINC_CODES.ECOG,
        status: 'final',
      });

      return { success: true, data: observation };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Get oncology observations for a patient
   */
  static async getOncologyObservations(
    patientId: string,
    loincCodes?: string[]
  ): Promise<FHIRApiResponse<FHIRObservation[]>> {
    try {
      let query = supabase
        .from('fhir_observations')
        .select('resource_data')
        .eq('patient_id', patientId)
        .eq('resource_type', 'Observation');

      if (loincCodes && loincCodes.length > 0) {
        query = query.in('loinc_code', loincCodes);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(50);

      if (error) {
        return { success: false, error: error.message };
      }

      const observations = (data || []).map(
        (row: { resource_data: unknown }) => row.resource_data as FHIRObservation
      );

      return { success: true, data: observations };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }
}

// =====================================================
// Helper: Map tumor marker name to LOINC code
// =====================================================

function getMarkerCode(markerName: string): string | null {
  const normalized = markerName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const markerMap: Record<string, string> = {
    cea: ONCOLOGY_LOINC_CODES.CEA,
    ca125: ONCOLOGY_LOINC_CODES.CA_125,
    ca199: ONCOLOGY_LOINC_CODES.CA_19_9,
    psa: ONCOLOGY_LOINC_CODES.PSA,
    afp: ONCOLOGY_LOINC_CODES.AFP,
    hcg: ONCOLOGY_LOINC_CODES.HCG,
  };
  return markerMap[normalized] || null;
}
