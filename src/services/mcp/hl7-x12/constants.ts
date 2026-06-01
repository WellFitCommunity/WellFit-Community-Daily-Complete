/**
 * HL7/X12 Transformer MCP Client — message templates, X12 helpers, 278 code maps
 *
 * Extracted from mcpHL7X12Client.ts (CLAUDE.md Commandment #12). Behavior unchanged.
 */

import type { X12278ActionCode, X12278CertificationType } from './types';

// =====================================================
// Common HL7 Message Templates
// =====================================================

export const HL7_TEMPLATES = {
  /**
   * ADT^A01 - Admit a patient
   */
  ADT_A01: (params: {
    controlId: string;
    sendingApp: string;
    sendingFacility: string;
    patientId: string;
    patientName: { family: string; given: string };
    dob: string;
    gender: 'M' | 'F' | 'O' | 'U';
    encounterId: string;
    admitDate: string;
  }) => {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    return [
      `MSH|^~\\&|${params.sendingApp}|${params.sendingFacility}|RECEIVING_APP|RECEIVING_FAC|${timestamp}||ADT^A01|${params.controlId}|P|2.4`,
      `EVN|A01|${timestamp}`,
      `PID|1||${params.patientId}||${params.patientName.family}^${params.patientName.given}|||${params.gender}`,
      `PV1|1|I|UNIT^ROOM^BED||||ATTENDING^PHYSICIAN|||||||||||${params.encounterId}||||||||||||||||||||||||${params.admitDate}`
    ].join('\r');
  },

  /**
   * ADT^A03 - Discharge a patient
   */
  ADT_A03: (params: {
    controlId: string;
    sendingApp: string;
    sendingFacility: string;
    patientId: string;
    encounterId: string;
    dischargeDate: string;
  }) => {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    return [
      `MSH|^~\\&|${params.sendingApp}|${params.sendingFacility}|RECEIVING_APP|RECEIVING_FAC|${timestamp}||ADT^A03|${params.controlId}|P|2.4`,
      `EVN|A03|${timestamp}`,
      `PID|1||${params.patientId}`,
      `PV1|1|I|||||||||||||||||${params.encounterId}|||||||||||||||||||||||||||${params.dischargeDate}`
    ].join('\r');
  },

  /**
   * ORU^R01 - Observation result
   */
  ORU_R01: (params: {
    controlId: string;
    sendingApp: string;
    sendingFacility: string;
    patientId: string;
    observationCode: string;
    observationValue: string;
    observationUnit: string;
    observationDate: string;
  }) => {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    return [
      `MSH|^~\\&|${params.sendingApp}|${params.sendingFacility}|RECEIVING_APP|RECEIVING_FAC|${timestamp}||ORU^R01|${params.controlId}|P|2.4`,
      `PID|1||${params.patientId}`,
      `OBR|1|||${params.observationCode}|||${params.observationDate}`,
      `OBX|1|NM|${params.observationCode}||${params.observationValue}|${params.observationUnit}|||N|||F`
    ].join('\r');
  }
};

// =====================================================
// Common X12 Segment Helpers
// =====================================================

export const X12_HELPERS = {
  /**
   * Format date for X12 (CCYYMMDD)
   */
  formatDate: (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  },

  /**
   * Format time for X12 (HHMM)
   */
  formatTime: (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().slice(11, 16).replace(':', '');
  },

  /**
   * Format currency for X12 (no decimal, whole cents)
   */
  formatAmount: (amount: number): string => {
    return Math.round(amount * 100).toString();
  },

  /**
   * Parse X12 date to Date object
   */
  parseDate: (x12Date: string): Date => {
    if (x12Date.length === 8) {
      const year = x12Date.slice(0, 4);
      const month = x12Date.slice(4, 6);
      const day = x12Date.slice(6, 8);
      return new Date(`${year}-${month}-${day}`);
    }
    throw new Error(`Invalid X12 date format: ${x12Date}`);
  },

  /**
   * Get place of service code description
   */
  getPlaceOfServiceName: (code: string): string => {
    const codes: Record<string, string> = {
      '11': 'Office',
      '12': 'Home',
      '21': 'Inpatient Hospital',
      '22': 'Outpatient Hospital',
      '23': 'Emergency Room',
      '24': 'Ambulatory Surgical Center',
      '31': 'Skilled Nursing Facility',
      '32': 'Nursing Facility',
      '34': 'Hospice',
      '41': 'Ambulance - Land',
      '42': 'Ambulance - Air or Water',
      '50': 'Federally Qualified Health Center',
      '51': 'Inpatient Psychiatric Facility',
      '52': 'Psychiatric Facility Partial Hospitalization',
      '53': 'Community Mental Health Center',
      '61': 'Comprehensive Inpatient Rehab Facility',
      '62': 'Comprehensive Outpatient Rehab Facility',
      '65': 'End-Stage Renal Disease Treatment Facility',
      '71': 'State/Local Public Health Clinic',
      '72': 'Rural Health Clinic',
      '81': 'Independent Laboratory'
    };
    return codes[code] || `Unknown (${code})`;
  }
};

// =====================================================
// X12 278 Action Codes (CMS-0057-F)
// =====================================================

export const X12_278_ACTION_CODES: Record<string, { code: X12278ActionCode; description: string }> = {
  APPROVED: { code: 'A1', description: 'Certified in total' },
  APPROVED_MODIFIED: { code: 'A2', description: 'Certified - Modified' },
  APPROVED_PARTIAL: { code: 'A3', description: 'Certified - Partial' },
  PENDING: { code: 'A4', description: 'Pending - Additional Information Requested' },
  DENIED: { code: 'A6', description: 'Not Certified' },
  CONTACT_PAYER: { code: 'CT', description: 'Contact Payer' }
};

export const X12_278_CERTIFICATION_TYPES: Record<string, { code: X12278CertificationType; description: string }> = {
  INITIAL: { code: 'I', description: 'Initial' },
  RENEWAL: { code: 'R', description: 'Renewal/Recertification' },
  REVISED: { code: 'S', description: 'Revised' },
  EXTENSION: { code: 'E', description: 'Extension' },
  APPEAL: { code: 'A', description: 'Appeal' }
};

export const X12_278_SERVICE_TYPE_CODES: Record<string, string> = {
  '1': 'Medical Care',
  '2': 'Surgical',
  '3': 'Consultation',
  '4': 'Diagnostic X-Ray',
  '5': 'Diagnostic Lab',
  '6': 'Radiation Therapy',
  '7': 'Anesthesia',
  '8': 'Surgical Assistance',
  '12': 'Durable Medical Equipment Purchase',
  '14': 'Renal Supplies in the Home',
  '18': 'DME Rental',
  '20': 'Second Surgical Opinion',
  '21': 'Third Surgical Opinion',
  '23': 'Diagnostic Dental',
  '24': 'Periodontics',
  '25': 'Restorative',
  '26': 'Endodontics',
  '27': 'Maxillofacial Prosthetics',
  '28': 'Adjunctive Dental Services',
  '33': 'Chiropractic',
  '34': 'Chiropractic Office Visits',
  '35': 'Dental Care',
  '36': 'Dental Crowns',
  '37': 'Dental Accident',
  '38': 'Orthodontics',
  '39': 'Prosthodontics',
  '40': 'Oral Surgery',
  '41': 'Routine (Preventive) Dental',
  '42': 'Home Health Care',
  '43': 'Home Health Prescriptions',
  '45': 'Hospice',
  '48': 'Hospital - Inpatient',
  '50': 'Hospital - Outpatient',
  '51': 'Hospital - Emergency Accident',
  '52': 'Hospital - Emergency Medical',
  '53': 'Hospital - Ambulatory Surgical',
  '54': 'Long Term Care',
  '55': 'Major Medical',
  '56': 'Medically Related Transportation',
  '57': 'Air Transportation',
  '58': 'Cabulance',
  '59': 'Licensed Ambulance',
  '60': 'General Benefits',
  '61': 'In-vitro Fertilization',
  '62': 'MRI/CAT Scan',
  '63': 'Donor Procedures',
  '64': 'Acupuncture',
  '65': 'Newborn Care',
  '66': 'Pathology',
  '67': 'Smoking Cessation',
  '68': 'Well Baby Care',
  '69': 'Maternity',
  '70': 'Transplants',
  '71': 'Audiology Exam',
  '72': 'Inhalation Therapy',
  '73': 'Diagnostic Medical',
  '74': 'Private Duty Nursing',
  '75': 'Prosthetic Device',
  '76': 'Dialysis',
  '77': 'Otological Exam',
  '78': 'Chemotherapy',
  '79': 'Allergy Testing',
  '80': 'Immunizations',
  '81': 'Routine Physical',
  '82': 'Family Planning',
  '83': 'Infertility',
  '84': 'Abortion',
  '85': 'AIDS',
  '86': 'Emergency Services',
  '87': 'Cancer',
  '88': 'Pharmacy',
  '89': 'Free Standing Prescription Drug',
  '90': 'Mail Order Prescription Drug',
  '91': 'Brand Name Prescription Drug',
  '92': 'Generic Prescription Drug',
  '93': 'Podiatry',
  '94': 'Podiatry - Office Visits',
  '95': 'Podiatry - Nursing Home Visits',
  '96': 'Professional (Physician)',
  '98': 'Professional (Physician) - Office Visits',
  'A0': 'Psychiatric',
  'A1': 'Psychiatric - Room and Board',
  'A2': 'Psychotherapy',
  'A3': 'Psychiatric - Inpatient',
  'A4': 'Psychiatric - Outpatient',
  'A5': 'Psychiatric - Partial Hospitalization',
  'A6': 'Psychopharmacology',
  'A7': 'Rehabilitation',
  'A8': 'Rehabilitation - Room and Board',
  'A9': 'Rehabilitation - Inpatient',
  'AA': 'Rehabilitation - Outpatient',
  'AB': 'Occupational Therapy',
  'AC': 'Physical Therapy',
  'AD': 'Speech Therapy',
  'AE': 'Skilled Nursing Care',
  'AF': 'Skilled Nursing Care - Room and Board',
  'AG': 'Substance Abuse',
  'AH': 'Substance Abuse - Inpatient',
  'AI': 'Substance Abuse - Outpatient',
  'AJ': 'Vision (Optometry)',
  'AK': 'Frames',
  'AL': 'Routine Eye Exam',
  'AM': 'Lenses'
};
