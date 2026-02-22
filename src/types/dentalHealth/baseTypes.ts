/**
 * Dental Health Base Types
 * Union type aliases for dental health module enumerations.
 * Integration: Chronic disease management, FHIR mapping, CDT billing
 */

export type DentalProviderRole =
  | 'dentist'
  | 'dental_hygienist'
  | 'orthodontist'
  | 'periodontist'
  | 'endodontist'
  | 'oral_surgeon'
  | 'prosthodontist'
  | 'pediatric_dentist';

export type DentalVisitType =
  | 'initial_exam'
  | 'routine_cleaning'
  | 'comprehensive_exam'
  | 'emergency'
  | 'follow_up'
  | 'consultation'
  | 'procedure'
  | 'screening';

export type DentalAssessmentStatus =
  | 'draft'
  | 'completed'
  | 'reviewed'
  | 'approved'
  | 'cancelled';

export type ToothCondition =
  | 'healthy'
  | 'cavity'
  | 'filling'
  | 'crown'
  | 'bridge'
  | 'implant'
  | 'root_canal'
  | 'extraction'
  | 'missing'
  | 'fractured'
  | 'abscessed'
  | 'impacted';

export type PeriodontalStatus =
  | 'healthy'
  | 'gingivitis'
  | 'mild_periodontitis'
  | 'moderate_periodontitis'
  | 'severe_periodontitis'
  | 'advanced_periodontitis';

export type TreatmentPriority =
  | 'emergency'
  | 'urgent'
  | 'routine'
  | 'elective'
  | 'preventive';

export type DentalImageType =
  | 'periapical'
  | 'bitewing'
  | 'panoramic'
  | 'cephalometric'
  | 'intraoral_photo'
  | 'cbct'
  | 'occlusal';

export type DentalProcedureStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type ReferralStatus =
  | 'pending'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'declined';

export type TreatmentPlanStatus =
  | 'proposed'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'on_hold';
