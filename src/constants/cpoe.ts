/**
 * CPOE (Computerized Provider Order Entry) shared constants.
 *
 * Used by:
 *   - MedicationOrderForm (ONC 170.315(a)(1))
 *   - LabOrderForm (ONC 170.315(a)(2)) — coming in ONC-2
 *   - ImagingOrderForm (ONC 170.315(a)(3)) — coming in ONC-3
 *
 * Code systems:
 *   - SNOMED CT for routes of administration (HL7 OID 2.16.840.1.113883.6.96)
 *   - FHIR R4 priority codes for order priority
 *   - HL7 / FHIR R4 timing units for dosage frequency
 */

import type { MedicationRequest } from '../types/fhir/medications';

// =============================================================================
// ROUTES OF ADMINISTRATION (SNOMED CT subset — covers ~95% of inpatient orders)
// =============================================================================

export interface RouteOfAdministration {
  /** Display label shown in the form */
  label: string;
  /** SNOMED CT code */
  code: string;
  /** Human-readable SNOMED display */
  display: string;
}

export const ROUTES_OF_ADMINISTRATION: readonly RouteOfAdministration[] = [
  { label: 'Oral (by mouth)', code: '26643006', display: 'Oral route' },
  { label: 'Intravenous (IV)', code: '47625008', display: 'Intravenous route' },
  { label: 'Intramuscular (IM)', code: '78421000', display: 'Intramuscular route' },
  { label: 'Subcutaneous (SC)', code: '34206005', display: 'Subcutaneous route' },
  { label: 'Topical', code: '6064005', display: 'Topical route' },
  { label: 'Inhaled', code: '447694001', display: 'Respiratory tract route' },
  { label: 'Sublingual', code: '37161004', display: 'Sublingual route' },
  { label: 'Rectal', code: '37161003', display: 'Per rectum' },
  { label: 'Ophthalmic (eye)', code: '54485002', display: 'Ophthalmic route' },
  { label: 'Otic (ear)', code: '10547007', display: 'Otic route' },
  { label: 'Nasal', code: '46713006', display: 'Nasal route' },
  { label: 'Transdermal', code: '45890007', display: 'Transdermal route' },
] as const;

// =============================================================================
// COMMON DOSAGE UNITS
// =============================================================================

export const DOSAGE_UNITS: readonly string[] = [
  'mg',
  'g',
  'mcg',
  'mL',
  'L',
  'unit',
  'IU',
  'mEq',
  'tablet',
  'capsule',
  'drop',
  'puff',
  'patch',
  '%',
] as const;

// =============================================================================
// FREQUENCY PRESETS (maps to FHIR Timing.repeat.frequency + period + periodUnit)
// =============================================================================

export interface FrequencyPreset {
  label: string;
  frequency: number;
  period: number;
  periodUnit: NonNullable<MedicationRequest['dosage_timing_period_unit']>;
}

export const FREQUENCY_PRESETS: readonly FrequencyPreset[] = [
  { label: 'Once daily', frequency: 1, period: 1, periodUnit: 'd' },
  { label: 'Twice daily (BID)', frequency: 2, period: 1, periodUnit: 'd' },
  { label: 'Three times daily (TID)', frequency: 3, period: 1, periodUnit: 'd' },
  { label: 'Four times daily (QID)', frequency: 4, period: 1, periodUnit: 'd' },
  { label: 'Every 4 hours', frequency: 1, period: 4, periodUnit: 'h' },
  { label: 'Every 6 hours', frequency: 1, period: 6, periodUnit: 'h' },
  { label: 'Every 8 hours', frequency: 1, period: 8, periodUnit: 'h' },
  { label: 'Every 12 hours', frequency: 1, period: 12, periodUnit: 'h' },
  { label: 'As needed (PRN)', frequency: 1, period: 1, periodUnit: 'd' },
  { label: 'At bedtime', frequency: 1, period: 1, periodUnit: 'd' },
  { label: 'Weekly', frequency: 1, period: 1, periodUnit: 'wk' },
] as const;

// =============================================================================
// ORDER PRIORITY (FHIR R4 RequestPriority value set)
// =============================================================================

export type OrderPriority = NonNullable<MedicationRequest['priority']>;

export interface PriorityOption {
  value: OrderPriority;
  label: string;
  description: string;
}

export const ORDER_PRIORITIES: readonly PriorityOption[] = [
  { value: 'routine', label: 'Routine', description: 'Normal priority — fill within standard timeframe' },
  { value: 'urgent', label: 'Urgent', description: 'Higher priority — fill as soon as practical' },
  { value: 'asap', label: 'ASAP', description: 'Very high priority — fill immediately' },
  { value: 'stat', label: 'STAT', description: 'Highest priority — emergency, fill now' },
] as const;
