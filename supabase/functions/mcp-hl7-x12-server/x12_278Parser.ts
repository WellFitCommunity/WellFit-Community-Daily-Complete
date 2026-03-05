// =====================================================
// X12 278 Prior Authorization Response Parser
// Purpose: Parse X12 278 Health Care Services Review
//          responses from payers
// Spec: ASC X12N 278 (005010X217)
// =====================================================

import type { PriorAuth278Response } from './types.ts';

/** Decision reason code descriptions (common subset) */
const DECISION_REASON_CODES: Record<string, string> = {
  '01': 'Clinical information does not support the need for services',
  '02': 'Service not authorized for this diagnosis',
  '03': 'Member not eligible for this service',
  '04': 'Pre-existing condition',
  '05': 'Not a covered benefit',
  '06': 'Service requires prior authorization',
  '07': 'Duplicate request',
  '08': 'Service frequency exceeded',
  '09': 'Not medically necessary',
  '10': 'Experimental or investigational',
  '11': 'Not approved provider',
  '12': 'Out of network',
  '15': 'Missing information',
  '33': 'Administrative',
  '56': 'Treatment plan not on file',
};

/** Format X12 date (CCYYMMDD) to YYYY-MM-DD */
function formatDate(x12Date: string): string {
  if (x12Date.length === 8) {
    return `${x12Date.substring(0, 4)}-${x12Date.substring(4, 6)}-${x12Date.substring(6, 8)}`;
  }
  return x12Date;
}

/**
 * Parse an X12 278 Health Care Services Review Response.
 *
 * Extracts action code (approved/denied/pending), authorization number,
 * effective dates, payer info, and denial reasons from the 278 response.
 */
export function parse278Response(x12Content: string): PriorAuth278Response {
  const segments = x12Content.split('~').filter(s => s.trim());

  const result: PriorAuth278Response = {
    transaction_set_id: '',
    control_number: '',
    original_control_number: '',
    action_code: '',
    payer: { name: '', id: '' },
    raw_segments: segments,
    segment_count: segments.length,
    loop_count: 0
  };

  let currentLoop = '';

  for (const segment of segments) {
    const fields = segment.split('*');
    const segmentId = fields[0];

    switch (segmentId) {
      case 'ST':
        result.transaction_set_id = fields[2] || '';
        break;

      case 'BHT':
        // BHT03 = reference identification (original control number for responses)
        result.original_control_number = fields[3] || '';
        break;

      case 'HL':
        result.loop_count = (result.loop_count || 0) + 1;
        // HL03 determines loop type
        currentLoop = fields[3] || '';
        break;

      case 'NM1': {
        const qualifier = fields[1];
        const entityType = fields[2]; // 1=person, 2=org
        const lastName = fields[3] || '';
        const firstName = fields[4] || '';
        const idQualifier = fields[8] || '';
        const id = fields[9] || '';

        // X3 = UMO (payer), PR = Payer
        if (qualifier === 'X3' || qualifier === 'PR') {
          result.payer = { name: lastName, id };
        }
        // 71 = Attending/Rendering, reviewer
        if (qualifier === '71' && currentLoop === 'EV') {
          result.reviewer = {
            name: entityType === '1' ? `${firstName} ${lastName}`.trim() : lastName,
            npi: idQualifier === 'XX' ? id : undefined
          };
        }
        break;
      }

      case 'PER':
        // Contact info for reviewer
        if (fields[1] === 'IC' && result.reviewer) {
          const phoneIdx = fields.indexOf('TE');
          if (phoneIdx > 0 && fields[phoneIdx + 1]) {
            result.reviewer.phone = fields[phoneIdx + 1];
          }
        }
        break;

      case 'UM':
        // UM01 = certification type, UM02 = service type code
        result.certification_type = fields[1] || undefined;
        break;

      case 'HCR':
        // HCR01 = Action code (A1=approved, A6=denied, A4=pending, etc.)
        result.action_code = fields[1] || '';
        // HCR02 = Reference identification (auth number)
        if (fields[2]) {
          result.auth_number = fields[2];
        }
        // HCR03 = Reject reason code
        if (fields[3]) {
          result.follow_up_action_code = fields[3];
        }
        break;

      case 'REF':
        // REF*BB = Authorization number
        if (fields[1] === 'BB' && fields[2]) {
          result.auth_number = fields[2];
        }
        // REF*NT = Note/control number
        if (fields[1] === 'NT' && fields[2]) {
          result.control_number = fields[2];
        }
        break;

      case 'DTP':
        // DTP*472 = Service date
        // DTP*472*RD8 = Date range (from-to)
        if (fields[1] === '472') {
          if (fields[2] === 'RD8' && fields[3]) {
            const parts = fields[3].split('-');
            result.effective_date_from = formatDate(parts[0]);
            result.effective_date_to = parts[1] ? formatDate(parts[1]) : undefined;
          } else if (fields[2] === 'D8' && fields[3]) {
            if (!result.effective_date_from) {
              result.effective_date_from = formatDate(fields[3]);
            } else {
              result.effective_date_to = formatDate(fields[3]);
            }
          }
        }
        break;

      case 'SV1':
      case 'SV2':
        // Service quantity (approved)
        if (fields[4]) {
          result.approved_quantity = parseInt(fields[4], 10) || undefined;
        }
        if (fields[5]) {
          result.approved_unit_type = fields[5];
        }
        break;

      case 'AAA':
        // AAA = Request validation (rejection/error details)
        // AAA03 = Reject reason code
        if (fields[3]) {
          const code = fields[3];
          result.decision_reason_code = code;
          result.denial_reason = {
            code,
            description: DECISION_REASON_CODES[code] || `Reason code: ${code}`
          };
        }
        break;

      case 'MSG':
        // Free-text message (notes from reviewer)
        if (fields[1]) {
          result.notes = (result.notes ? result.notes + ' ' : '') + fields[1];
        }
        break;
    }
  }

  return result;
}

/**
 * Validate a 278 message structure.
 * Checks required segments specific to 278 transactions.
 */
export function validate278(x12Content: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  segmentCount: number;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const segments = x12Content.split('~').filter(s => s.trim());
  const segmentCount = segments.length;

  if (segmentCount === 0) {
    return { valid: false, errors: ['Empty X12 content'], warnings, segmentCount: 0 };
  }

  const segmentNames = segments.map(s => s.split('*')[0]);

  // Check envelope segments
  const requiredEnvelope = ['ISA', 'GS', 'ST', 'BHT', 'SE', 'GE', 'IEA'];
  for (const req of requiredEnvelope) {
    if (!segmentNames.includes(req)) {
      errors.push(`Missing required envelope segment: ${req}`);
    }
  }

  // Validate ISA first, IEA last
  if (segmentNames[0] !== 'ISA') {
    errors.push('First segment must be ISA');
  }
  if (segmentNames[segmentNames.length - 1] !== 'IEA') {
    errors.push('Last segment must be IEA');
  }

  // Check ST segment declares 278 transaction set
  const stSegment = segments.find(s => s.startsWith('ST*'));
  if (stSegment) {
    const stFields = stSegment.split('*');
    if (stFields[1] !== '278') {
      errors.push(`Expected transaction set 278, found ${stFields[1]}`);
    }
  }

  // BHT must be present with correct hierarchical structure
  const bhtSegment = segments.find(s => s.startsWith('BHT*'));
  if (bhtSegment) {
    const bhtFields = bhtSegment.split('*');
    if (bhtFields[1] !== '0007') {
      warnings.push(`BHT01 should be 0007 for 278, found ${bhtFields[1]}`);
    }
  }

  // Must have at least one HL segment
  if (!segmentNames.includes('HL')) {
    errors.push('Missing HL (Hierarchical Level) segments');
  }

  // Must have UM (Health Care Services Review) or HCR (action code)
  if (!segmentNames.includes('UM') && !segmentNames.includes('HCR')) {
    warnings.push('No UM or HCR segment found — may be incomplete 278');
  }

  // Must have at least one NM1 segment
  if (!segmentNames.includes('NM1')) {
    errors.push('Missing NM1 (entity name) segments');
  }

  // Validate SE segment count
  const seSegment = segments.find(s => s.startsWith('SE*'));
  if (seSegment) {
    const seFields = seSegment.split('*');
    const declaredCount = parseInt(seFields[1] || '0', 10);
    const stIndex = segmentNames.indexOf('ST');
    const seIndex = segmentNames.indexOf('SE');
    const actualCount = seIndex - stIndex + 1;
    if (declaredCount !== actualCount) {
      warnings.push(
        `SE segment count mismatch: declared ${declaredCount}, actual ${actualCount}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    segmentCount
  };
}
