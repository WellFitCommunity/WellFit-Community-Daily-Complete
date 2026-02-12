// FHIR Integration Service — Observation Resource Mapper
// Maps WellFit check-ins and health entries to FHIR R4 Observation resources

import type { FHIRObservation, CheckIn, HealthEntry, Profile } from './types';

/**
 * Create FHIR Observation resources for vital signs from a check-in.
 */
export function createVitalsObservations(
  checkIn: CheckIn,
  profile: Profile
): FHIRObservation[] {
  const observations: FHIRObservation[] = [];
  const patientReference = `Patient/${profile.user_id}`;
  const patientDisplay = `${profile.first_name} ${profile.last_name}`;

  // Blood Pressure (both values must be present)
  if (checkIn.bp_systolic != null && checkIn.bp_diastolic != null) {
    observations.push({
      resourceType: 'Observation',
      id: `bp-${checkIn.id}`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '85354-9',
            display: 'Blood pressure panel with all children optional',
          },
        ],
      },
      subject: { reference: patientReference, display: patientDisplay },
      effectiveDateTime: checkIn.created_at,
      issued: checkIn.created_at,
      component: [
        {
          code: {
            coding: [
              { system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' },
            ],
          },
          valueQuantity: {
            value: checkIn.bp_systolic,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]',
          },
        },
        {
          code: {
            coding: [
              { system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' },
            ],
          },
          valueQuantity: {
            value: checkIn.bp_diastolic,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]',
          },
        },
      ],
    });
  }

  // Heart Rate
  if (checkIn.heart_rate != null) {
    observations.push({
      resourceType: 'Observation',
      id: `hr-${checkIn.id}`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: {
        coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }],
      },
      subject: { reference: patientReference, display: patientDisplay },
      effectiveDateTime: checkIn.created_at,
      issued: checkIn.created_at,
      valueQuantity: {
        value: checkIn.heart_rate,
        unit: 'beats/min',
        system: 'http://unitsofmeasure.org',
        code: '/min',
      },
    });
  }

  // Glucose
  if (checkIn.glucose_mg_dl != null) {
    observations.push({
      resourceType: 'Observation',
      id: `glucose-${checkIn.id}`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: {
        coding: [{ system: 'http://loinc.org', code: '33747-0', display: 'Glucose measurement' }],
      },
      subject: { reference: patientReference, display: patientDisplay },
      effectiveDateTime: checkIn.created_at,
      issued: checkIn.created_at,
      valueQuantity: {
        value: checkIn.glucose_mg_dl,
        unit: 'mg/dL',
        system: 'http://unitsofmeasure.org',
        code: 'mg/dL',
      },
    });
  }

  // Pulse Oximetry (SpO2)
  if (checkIn.pulse_oximeter != null) {
    observations.push({
      resourceType: 'Observation',
      id: `spo2-${checkIn.id}`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: {
        coding: [
          { system: 'http://loinc.org', code: '2708-6', display: 'Oxygen saturation in Arterial blood' },
        ],
      },
      subject: { reference: patientReference, display: patientDisplay },
      effectiveDateTime: checkIn.created_at,
      issued: checkIn.created_at,
      valueQuantity: {
        value: checkIn.pulse_oximeter,
        unit: '%',
        system: 'http://unitsofmeasure.org',
        code: '%',
      },
    });
  }

  return observations;
}

/**
 * Create FHIR Observation resources for wellness data from a health entry.
 */
export function createWellnessObservations(
  entry: HealthEntry,
  profile: Profile
): FHIRObservation[] {
  const observations: FHIRObservation[] = [];
  const patientReference = `Patient/${profile.user_id}`;
  const patientDisplay = `${profile.first_name} ${profile.last_name}`;

  // Mood Observation
  if (entry.data && entry.data.mood) {
    observations.push({
      resourceType: 'Observation',
      id: `mood-${entry.id}`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'survey',
              display: 'Survey'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '72133-2',
            display: 'Mood assessment'
          }
        ]
      },
      subject: {
        reference: patientReference,
        display: patientDisplay
      },
      effectiveDateTime: entry.created_at,
      issued: entry.created_at,
      valueString: entry.data.mood
    });
  }

  // Activity Level Observation
  if (entry.data && entry.data.activity_description) {
    observations.push({
      resourceType: 'Observation',
      id: `activity-${entry.id}`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'activity',
              display: 'Activity'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '89574-8',
            display: 'Physical activity assessment'
          }
        ]
      },
      subject: {
        reference: patientReference,
        display: patientDisplay
      },
      effectiveDateTime: entry.created_at,
      issued: entry.created_at,
      valueString: entry.data.activity_description
    });
  }

  return observations;
}
