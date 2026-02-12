// FHIR Integration Service — Immunization Resource Mapper
// Maps WellFit immunization database rows to FHIR R4 Immunization resources

import type { FHIRImmunization, ImmunizationDbRow } from './types';

/** Map an injection site string to its FHIR site code */
export function mapSiteCode(site: string): string {
  const siteMap: Record<string, string> = {
    'left arm': 'LA',
    'right arm': 'RA',
    'left deltoid': 'LD',
    'right deltoid': 'RD',
    'left thigh': 'LT',
    'right thigh': 'RT'
  };
  return siteMap[site?.toLowerCase()] || 'LA';
}

/** Map an immunization route string to its FHIR route code */
export function mapRouteCodeImmunization(route: string): string {
  const routeMap: Record<string, string> = {
    'intramuscular': 'IM',
    'subcutaneous': 'SC',
    'oral': 'PO',
    'intranasal': 'NASINHL'
  };
  return routeMap[route?.toLowerCase()] || 'IM';
}

/**
 * Map a database immunization row to a FHIR R4 Immunization resource.
 */
export function mapImmunizationToFHIR(imm: ImmunizationDbRow): FHIRImmunization {
  return {
    resourceType: 'Immunization',
    id: imm.id,
    status: imm.status,
    vaccineCode: {
      coding: [{
        system: 'http://hl7.org/fhir/sid/cvx',
        code: imm.vaccine_code,
        display: imm.vaccine_display || imm.vaccine_name || 'Unknown vaccine'
      }]
    },
    patient: {
      reference: `Patient/${imm.patient_id}`
    },
    occurrenceDateTime: imm.occurrence_datetime,
    recorded: imm.created_at,
    primarySource: imm.primary_source !== false,
    lotNumber: imm.lot_number,
    expirationDate: imm.expiration_date,
    site: imm.site_display ? {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActSite',
        code: mapSiteCode(imm.site_display),
        display: imm.site_display
      }]
    } : undefined,
    route: imm.route_display ? {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-RouteOfAdministration',
        code: mapRouteCodeImmunization(imm.route_display),
        display: imm.route_display
      }]
    } : undefined,
    doseQuantity: imm.dose_quantity_value ? {
      value: imm.dose_quantity_value,
      unit: imm.dose_quantity_unit || 'mL',
      system: 'http://unitsofmeasure.org',
      code: imm.dose_quantity_unit || 'mL'
    } : undefined,
    performer: imm.performer_actor_display ? [{
      actor: {
        display: imm.performer_actor_display
      }
    }] : undefined,
    note: imm.note ? [{
      text: imm.note
    }] : undefined,
    protocolApplied: imm.protocol_dose_number_positive_int ? [{
      doseNumberPositiveInt: imm.protocol_dose_number_positive_int,
      seriesDosesPositiveInt: imm.protocol_series_doses_positive_int
    }] : undefined,
    reaction: imm.reaction_date ? [{
      date: imm.reaction_date,
      reported: imm.reaction_reported
    }] : undefined
  };
}
