/**
 * QRDA Export Types
 *
 * ONC Criteria: 170.315(c)(2), (c)(3)
 */

export interface QRDAExportOptions {
  tenantId: string;
  measureIds: string[];
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  exportType: 'QRDA_I' | 'QRDA_III';
  patientId?: string;
}

export interface QRDAExportResult {
  exportId: string;
  xml: string;
  measureIds: string[];
  exportType: 'QRDA_I' | 'QRDA_III';
  patientCount?: number;
  validationStatus: 'pending' | 'valid' | 'invalid';
  validationErrors?: string[];
}

export interface PatientData {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  address_line1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
}

export interface MeasureResult {
  measure_id: string;
  initial_population: boolean;
  denominator: boolean;
  denominator_exclusion: boolean;
  denominator_exception: boolean;
  numerator: boolean;
  numerator_exclusion: boolean;
}

export interface AggregateData {
  measure_id: string;
  initial_population_count: number;
  denominator_count: number;
  denominator_exclusion_count: number;
  denominator_exception_count: number;
  numerator_count: number;
  performance_rate: number | null;
}

export interface ExportHistoryRow {
  id: string;
  export_type: string;
  measure_ids: string[];
  created_at: string;
  validation_status: string;
  patient_count: number;
}
