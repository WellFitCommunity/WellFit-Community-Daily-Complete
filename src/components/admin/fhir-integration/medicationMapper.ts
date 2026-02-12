// FHIR Integration Service — Medication Statement Mapper
// Maps WellFit medications to FHIR R4 MedicationStatement resources

import type { FHIRMedicationStatement, Medication, Profile } from './types';

/** Map internal medication status to FHIR MedicationStatement status */
export function mapMedicationStatus(
  status: string
): 'active' | 'completed' | 'entered-in-error' | 'intended' | 'stopped' | 'on-hold' | 'unknown' | 'not-taken' {
  switch (status) {
    case 'active': return 'active';
    case 'completed': return 'completed';
    case 'discontinued': return 'stopped';
    default: return 'unknown';
  }
}

/** Parse a frequency string (e.g. "twice daily", "every 8 hours") into a numeric count per day */
export function parseFrequency(frequency: string): number {
  const lowerFreq = frequency.toLowerCase();
  if (lowerFreq.includes('once')) return 1;
  if (lowerFreq.includes('twice') || lowerFreq.includes('two')) return 2;
  if (lowerFreq.includes('three') || lowerFreq.includes('thrice')) return 3;
  if (lowerFreq.includes('four')) return 4;
  // Extract number from string like "every 8 hours" = 3 times per day
  const match = lowerFreq.match(/every\s+(\d+)\s+hour/);
  if (match) {
    const hours = parseInt(match[1]);
    return Math.round(24 / hours);
  }
  return 1; // Default to once daily
}

/** Map a route string to its SNOMED CT code */
export function mapRouteToSNOMED(route: string): string {
  const routeMap: Record<string, string> = {
    'oral': '26643006',
    'topical': '6064005',
    'injection': '129326001',
    'intravenous': '47625008',
    'sublingual': '37839007',
    'rectal': '37161004',
    'inhalation': '447694001'
  };
  return routeMap[route.toLowerCase()] || '26643006'; // Default to oral
}

/**
 * Create FHIR MedicationStatement resources from an array of medications.
 * Only active medications are included.
 */
export function createMedicationStatements(
  medications: Medication[],
  profile: Profile
): FHIRMedicationStatement[] {
  const statements: FHIRMedicationStatement[] = [];
  const patientReference = `Patient/${profile.user_id}`;
  const patientDisplay = `${profile.first_name} ${profile.last_name}`;

  for (const medication of medications) {
    if (medication.status !== 'active') continue; // Only sync active medications

    const statement: FHIRMedicationStatement = {
      resourceType: 'MedicationStatement',
      id: `medication-${medication.id}`,
      status: mapMedicationStatus(medication.status),
      medicationCodeableConcept: {
        coding: [
          {
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: medication.ndc_code || 'unknown',
            display: medication.medication_name
          }
        ],
        text: medication.medication_name
      },
      subject: {
        reference: patientReference,
        display: patientDisplay
      },
      effectiveDateTime: medication.prescribed_date || medication.created_at,
      dateAsserted: medication.created_at,
      informationSource: {
        reference: patientReference,
        display: 'Patient reported'
      },
      dosage: [
        {
          text: medication.instructions || `${medication.dosage} ${medication.frequency || ''}`.trim(),
          timing: medication.frequency ? {
            repeat: {
              frequency: parseFrequency(medication.frequency),
              period: 1,
              periodUnit: 'd' // day
            }
          } : undefined,
          route: medication.route ? {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: mapRouteToSNOMED(medication.route),
                display: medication.route
              }
            ]
          } : undefined,
          doseAndRate: medication.dosage ? [
            {
              doseQuantity: {
                value: parseFloat(medication.dosage.replace(/[^\d.]/g, '')) || undefined,
                unit: medication.dosage.replace(/[\d.]/g, '').trim() || 'unit',
                system: 'http://unitsofmeasure.org'
              }
            }
          ] : undefined
        }
      ],
      note: []
    };

    // Add purpose as note
    if (medication.purpose) {
      statement.note?.push({
        text: `Purpose: ${medication.purpose}`
      });
    }

    // Add side effects as note
    if (medication.side_effects && medication.side_effects.length > 0) {
      statement.note?.push({
        text: `Side effects: ${medication.side_effects.join(', ')}`
      });
    }

    // Add warnings as note
    if (medication.warnings && medication.warnings.length > 0) {
      statement.note?.push({
        text: `Warnings: ${medication.warnings.join(', ')}`
      });
    }

    statements.push(statement);
  }

  return statements;
}
