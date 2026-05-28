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
// SPECIMEN TYPES (for lab orders — ONC 170.315(a)(2))
// =============================================================================

export interface SpecimenType {
  /** Display label shown in the form */
  label: string;
  /** SNOMED CT specimen-type code (HL7 OID 2.16.840.1.113883.6.96) */
  code: string;
}

export const SPECIMEN_TYPES: readonly SpecimenType[] = [
  { label: 'Blood (venous)', code: '122555007' },
  { label: 'Blood (capillary / fingerstick)', code: '122554006' },
  { label: 'Urine (random)', code: '122575003' },
  { label: 'Urine (24-hour)', code: '276833005' },
  { label: 'Saliva', code: '258629007' },
  { label: 'Stool', code: '119339001' },
  { label: 'Sputum', code: '119334006' },
  { label: 'Nasopharyngeal swab', code: '258500001' },
  { label: 'Throat swab', code: '258529004' },
  { label: 'Cerebrospinal fluid', code: '258450006' },
  { label: 'Tissue biopsy', code: '119376003' },
  { label: 'Other / not applicable', code: 'other' },
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

// =============================================================================
// IMAGING MODALITIES (DICOM CID 29 — for imaging orders — ONC 170.315(a)(3))
// =============================================================================

export interface ImagingModality {
  /** Display label shown in the form */
  label: string;
  /** DICOM modality code (HL7 OID 1.2.840.10008.2.16.4) */
  code: string;
  /** Human-readable DICOM display */
  display: string;
}

export const IMAGING_MODALITIES: readonly ImagingModality[] = [
  { label: 'X-Ray (Radiography)', code: 'DX', display: 'Digital Radiography' },
  { label: 'Computed Tomography (CT)', code: 'CT', display: 'Computed Tomography' },
  { label: 'Magnetic Resonance (MRI)', code: 'MR', display: 'Magnetic Resonance' },
  { label: 'Ultrasound (US)', code: 'US', display: 'Ultrasound' },
  { label: 'Mammography', code: 'MG', display: 'Mammography' },
  { label: 'Nuclear Medicine', code: 'NM', display: 'Nuclear Medicine' },
  { label: 'Positron Emission Tomography (PET)', code: 'PT', display: 'Positron Emission Tomography' },
  { label: 'Fluoroscopy', code: 'RF', display: 'Radio Fluoroscopy' },
  { label: 'Bone Density (DXA)', code: 'BMD', display: 'Bone Mineral Densitometry' },
  { label: 'Angiography', code: 'XA', display: 'X-Ray Angiography' },
] as const;

// =============================================================================
// BODY SITES (SNOMED CT BodyStructure subset — for imaging — ONC 170.315(a)(3))
// =============================================================================

export interface BodySite {
  /** Display label shown in the form */
  label: string;
  /** SNOMED CT BodyStructure code (HL7 OID 2.16.840.1.113883.6.96) */
  code: string;
}

export const BODY_SITES: readonly BodySite[] = [
  { label: 'Head', code: '69536005' },
  { label: 'Neck', code: '45048000' },
  { label: 'Chest', code: '51185008' },
  { label: 'Abdomen', code: '113345001' },
  { label: 'Pelvis', code: '12921003' },
  { label: 'Cervical spine', code: '122494005' },
  { label: 'Thoracic spine', code: '122495006' },
  { label: 'Lumbar spine', code: '122496007' },
  { label: 'Shoulder', code: '16982005' },
  { label: 'Upper arm', code: '40983000' },
  { label: 'Elbow', code: '127949000' },
  { label: 'Forearm', code: '14975008' },
  { label: 'Wrist', code: '8205005' },
  { label: 'Hand', code: '85562004' },
  { label: 'Hip', code: '29836001' },
  { label: 'Thigh / femur', code: '68367000' },
  { label: 'Knee', code: '72696002' },
  { label: 'Lower leg / tibia', code: '30021000' },
  { label: 'Ankle', code: '344001' },
  { label: 'Foot', code: '56459004' },
  { label: 'Whole body', code: '38266002' },
  { label: 'Other (specify in notes)', code: 'other' },
] as const;

// =============================================================================
// LATERALITY (for imaging — ONC 170.315(a)(3))
// =============================================================================

/**
 * Form-level laterality. `'na'` maps to undefined on the persisted
 * ServiceRequest (body_site_laterality is nullable). The other three
 * values match ServiceRequestLaterality on the FHIR type.
 */
export type FormLaterality = 'na' | 'left' | 'right' | 'bilateral';

export interface LateralityOption {
  value: FormLaterality;
  label: string;
}

export const LATERALITY_OPTIONS: readonly LateralityOption[] = [
  { value: 'na', label: 'Not applicable' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'bilateral', label: 'Bilateral' },
] as const;
