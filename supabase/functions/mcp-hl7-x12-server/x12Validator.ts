// =====================================================
// X12 837P Validator
// Purpose: Validate X12 837P claim structure and field content
// per X12 005010X222A1 specification
// =====================================================

import type { ValidationResult } from './types.ts';

/** Valid 2-digit CMS Place of Service codes */
const VALID_POS_CODES = new Set([
  '01','02','03','04','05','06','07','08','09','10',
  '11','12','13','14','15','16','17','18','19','20',
  '21','22','23','24','25','26','31','32','33','34',
  '41','42','49','50','51','52','53','54','55','56',
  '57','58','60','61','62','65','71','72','81','99',
]);

/** Validate ISA field lengths per X12 005010 spec */
function validateISAFields(isaSegment: string, errors: string[], warnings: string[]): void {
  const fields = isaSegment.split('*');
  if (fields.length < 17) {
    errors.push(`ISA segment requires 16 elements, found ${fields.length - 1}`);
    return;
  }

  // ISA01: Authorization Information Qualifier (2 chars)
  if (fields[1]?.length !== 2) {
    errors.push(`ISA01 (Auth Info Qualifier) must be exactly 2 characters, got ${fields[1]?.length}`);
  }

  // ISA02: Authorization Information (10 chars, space-padded)
  if (fields[2]?.length !== 10) {
    errors.push(`ISA02 (Auth Information) must be exactly 10 characters, got ${fields[2]?.length}`);
  }

  // ISA03: Security Information Qualifier (2 chars)
  if (fields[3]?.length !== 2) {
    errors.push(`ISA03 (Security Info Qualifier) must be exactly 2 characters, got ${fields[3]?.length}`);
  }

  // ISA04: Security Information (10 chars)
  if (fields[4]?.length !== 10) {
    errors.push(`ISA04 (Security Information) must be exactly 10 characters, got ${fields[4]?.length}`);
  }

  // ISA05: Interchange ID Qualifier (2 chars)
  if (fields[5]?.length !== 2) {
    errors.push(`ISA05 (Sender ID Qualifier) must be exactly 2 characters, got ${fields[5]?.length}`);
  }

  // ISA06: Interchange Sender ID (15 chars)
  if (fields[6]?.length !== 15) {
    errors.push(`ISA06 (Sender ID) must be exactly 15 characters, got ${fields[6]?.length}`);
  }

  // ISA07: Interchange ID Qualifier (2 chars)
  if (fields[7]?.length !== 2) {
    errors.push(`ISA07 (Receiver ID Qualifier) must be exactly 2 characters, got ${fields[7]?.length}`);
  }

  // ISA08: Interchange Receiver ID (15 chars)
  if (fields[8]?.length !== 15) {
    errors.push(`ISA08 (Receiver ID) must be exactly 15 characters, got ${fields[8]?.length}`);
  }

  // ISA09: Interchange Date (6 chars, YYMMDD)
  if (fields[9]?.length !== 6) {
    errors.push(`ISA09 (Date) must be exactly 6 characters (YYMMDD), got ${fields[9]?.length}`);
  } else if (!/^\d{6}$/.test(fields[9])) {
    errors.push(`ISA09 (Date) must be numeric YYMMDD, got "${fields[9]}"`);
  }

  // ISA10: Interchange Time (4 chars, HHMM)
  if (fields[10]?.length !== 4) {
    errors.push(`ISA10 (Time) must be exactly 4 characters (HHMM), got ${fields[10]?.length}`);
  } else if (!/^\d{4}$/.test(fields[10])) {
    errors.push(`ISA10 (Time) must be numeric HHMM, got "${fields[10]}"`);
  }

  // ISA11: Repetition Separator (1 char)
  if (fields[11]?.length !== 1) {
    errors.push(`ISA11 (Repetition Separator) must be exactly 1 character`);
  }

  // ISA12: Interchange Control Version Number (5 chars)
  if (fields[12]?.length !== 5) {
    errors.push(`ISA12 (Version) must be exactly 5 characters, got ${fields[12]?.length}`);
  } else if (fields[12] !== '00501') {
    warnings.push(`ISA12 version "${fields[12]}" — expected "00501" for 5010`);
  }

  // ISA13: Interchange Control Number (9 chars, numeric)
  if (fields[13]?.length !== 9) {
    errors.push(`ISA13 (Control Number) must be exactly 9 characters, got ${fields[13]?.length}`);
  } else if (!/^\d{9}$/.test(fields[13])) {
    errors.push(`ISA13 (Control Number) must be numeric, got "${fields[13]}"`);
  }

  // ISA15: Usage Indicator (1 char: P=Production, T=Test)
  if (fields[15] && !['P', 'T'].includes(fields[15])) {
    warnings.push(`ISA15 (Usage Indicator) should be "P" or "T", got "${fields[15]}"`);
  }
}

/** Validate NPI format: exactly 10 digits */
function validateNPI(npi: string, context: string, errors: string[]): void {
  if (!/^\d{10}$/.test(npi)) {
    errors.push(`${context}: NPI must be exactly 10 digits, got "${npi}"`);
  }
}

/** Validate date format: CCYYMMDD (8 digits) */
function validateDate(dateStr: string, context: string, errors: string[]): void {
  if (!/^\d{8}$/.test(dateStr)) {
    errors.push(`${context}: Date must be CCYYMMDD (8 digits), got "${dateStr}"`);
    return;
  }
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10);
  const day = parseInt(dateStr.substring(6, 8), 10);

  if (year < 1900 || year > 2100) {
    errors.push(`${context}: Year ${year} out of range`);
  }
  if (month < 1 || month > 12) {
    errors.push(`${context}: Month ${month} out of range`);
  }
  if (day < 1 || day > 31) {
    errors.push(`${context}: Day ${day} out of range`);
  }
}

/** Validate charge amount: must be positive number */
function validateAmount(amountStr: string, context: string, errors: string[]): void {
  const amount = parseFloat(amountStr);
  if (isNaN(amount)) {
    errors.push(`${context}: Charge amount "${amountStr}" is not a valid number`);
  } else if (amount < 0) {
    errors.push(`${context}: Charge amount ${amount} must not be negative`);
  } else if (amount === 0) {
    // Zero charges are technically valid but suspicious
    // Don't flag — some legitimate scenarios have $0 lines
  }
}

/**
 * Validate an X12 837P claim for structural and field-level correctness.
 * Checks required segments, ISA field lengths, date formats, NPI format,
 * charge amounts, place of service codes, and envelope integrity.
 */
export function validateX12(x12Content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const segments = x12Content.split('~').filter(s => s.trim());
  const segmentCount = segments.length;

  if (segmentCount === 0) {
    return { valid: false, errors: ['Empty X12 content'], warnings, segmentCount: 0 };
  }

  const segmentNames = segments.map(s => s.split('*')[0]);

  // --- Structural validation ---

  const requiredSegments = ['ISA', 'GS', 'ST', 'BHT', 'NM1', 'CLM', 'SE', 'GE', 'IEA'];
  for (const req of requiredSegments) {
    if (!segmentNames.includes(req)) {
      errors.push(`Missing required segment: ${req}`);
    }
  }

  // ISA must be first, IEA must be last
  if (segmentNames[0] !== 'ISA') {
    errors.push('First segment must be ISA');
  }
  if (segmentNames[segmentNames.length - 1] !== 'IEA') {
    errors.push('Last segment must be IEA');
  }

  // --- ISA field-level validation ---
  if (segmentNames[0] === 'ISA') {
    validateISAFields(segments[0], errors, warnings);
  }

  // --- GS field validation ---
  const gsSegment = segments.find(s => s.startsWith('GS*'));
  if (gsSegment) {
    const gsFields = gsSegment.split('*');
    // GS01: Functional Identifier Code
    if (gsFields[1] !== 'HC') {
      warnings.push(`GS01 should be "HC" for health care claims, got "${gsFields[1]}"`);
    }
    // GS04: Date (CCYYMMDD)
    if (gsFields[4]) {
      validateDate(gsFields[4], 'GS04 (Group Date)', errors);
    }
    // GS08: Version/Release/Industry Identifier
    if (gsFields[8] && !gsFields[8].startsWith('005010')) {
      warnings.push(`GS08 version "${gsFields[8]}" — expected 005010 series`);
    }
  }

  // --- SE segment count match ---
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

  // --- IEA control number match with ISA ---
  if (segmentNames[0] === 'ISA') {
    const isaFields = segments[0].split('*');
    const ieaSegment = segments.find(s => s.startsWith('IEA*'));
    if (ieaSegment) {
      const ieaFields = ieaSegment.split('*');
      if (isaFields[13] && ieaFields[2] && isaFields[13] !== ieaFields[2]?.trim()) {
        errors.push(
          `ISA/IEA control number mismatch: ISA="${isaFields[13]}", IEA="${ieaFields[2]?.trim()}"`
        );
      }
    }
  }

  // --- NM1 segment NPI validation ---
  const nm1Segments = segments.filter(s => s.startsWith('NM1*'));
  for (const nm1 of nm1Segments) {
    const fields = nm1.split('*');
    const entityCode = fields[1];
    const idQualifier = fields[8];
    const id = fields[9];

    // XX qualifier means NPI
    if (idQualifier === 'XX' && id) {
      validateNPI(id, `NM1*${entityCode} NPI`, errors);
    }
  }

  // --- CLM segment validation ---
  const clmSegments = segments.filter(s => s.startsWith('CLM*'));
  for (const clm of clmSegments) {
    const fields = clm.split('*');

    // CLM01: Claim ID (required)
    if (!fields[1]?.trim()) {
      errors.push('CLM01 (Claim ID) is empty');
    }

    // CLM02: Total Charge Amount
    if (fields[2]) {
      validateAmount(fields[2], 'CLM02 (Total Charges)', errors);
    }

    // CLM05: Place of Service (format: POS:B:1)
    if (fields[5]) {
      const posComponents = fields[5].split(':');
      const posCode = posComponents[0];
      if (posCode && !VALID_POS_CODES.has(posCode)) {
        errors.push(`CLM05: Invalid Place of Service code "${posCode}"`);
      }
    }
  }

  // --- DTP date validation ---
  const dtpSegments = segments.filter(s => s.startsWith('DTP*'));
  for (const dtp of dtpSegments) {
    const fields = dtp.split('*');
    const qualifier = fields[1];
    const dateFormat = fields[2];
    const dateValue = fields[3];

    if (dateFormat === 'D8' && dateValue) {
      validateDate(dateValue, `DTP*${qualifier} (Service Date)`, errors);
    }
  }

  // --- SV1 service line validation ---
  const sv1Segments = segments.filter(s => s.startsWith('SV1*'));
  for (let i = 0; i < sv1Segments.length; i++) {
    const fields = sv1Segments[i].split('*');
    const lineNum = i + 1;

    // SV1-01: Composite (HC:code:modifiers)
    if (fields[1]) {
      const codeComponents = fields[1].split(':');
      if (codeComponents[0] !== 'HC') {
        warnings.push(`SV1 line ${lineNum}: Expected "HC" qualifier, got "${codeComponents[0]}"`);
      }
      if (!codeComponents[1]?.trim()) {
        errors.push(`SV1 line ${lineNum}: Missing procedure code`);
      }
    }

    // SV1-02: Charge amount
    if (fields[2]) {
      validateAmount(fields[2], `SV1 line ${lineNum} (Line Charges)`, errors);
    }

    // SV1-03: Unit of measure (should be UN for units)
    if (fields[3] && !['UN', 'MJ', 'DA'].includes(fields[3])) {
      warnings.push(`SV1 line ${lineNum}: Unit type "${fields[3]}" — expected UN, MJ, or DA`);
    }

    // SV1-04: Quantity (must be positive integer)
    if (fields[4]) {
      const qty = parseFloat(fields[4]);
      if (isNaN(qty) || qty <= 0) {
        errors.push(`SV1 line ${lineNum}: Quantity must be positive, got "${fields[4]}"`);
      }
    }
  }

  // --- HI diagnosis code validation ---
  const hiSegment = segments.find(s => s.startsWith('HI*'));
  if (!hiSegment) {
    errors.push('Missing HI segment (diagnosis codes)');
  } else {
    const hiFields = hiSegment.split('*').slice(1);
    for (let i = 0; i < hiFields.length; i++) {
      const parts = hiFields[i].split(':');
      const qualifier = parts[0];
      const code = parts[1];

      // Qualifier: ABK (principal) or ABF (other)
      if (i === 0 && qualifier !== 'ABK') {
        errors.push(`HI: First diagnosis must use ABK qualifier, got "${qualifier}"`);
      }
      if (i > 0 && qualifier !== 'ABF') {
        warnings.push(`HI: Diagnosis ${i + 1} uses "${qualifier}" — expected ABF for secondary`);
      }

      // ICD-10 format: letter followed by 2+ digits, optional more chars
      if (code && !/^[A-Z]\d{2,}/.test(code)) {
        warnings.push(`HI: Diagnosis code "${code}" may not be valid ICD-10 format`);
      }
    }
  }

  // --- Service line presence ---
  if (!segmentNames.includes('LX') || !segmentNames.includes('SV1')) {
    warnings.push('No service line segments (LX/SV1) found');
  }

  // --- DMG (demographics) date validation ---
  const dmgSegments = segments.filter(s => s.startsWith('DMG*'));
  for (const dmg of dmgSegments) {
    const fields = dmg.split('*');
    if (fields[1] === 'D8' && fields[2]) {
      validateDate(fields[2], 'DMG (Date of Birth)', errors);
    }
    // Gender validation
    if (fields[3] && !['M', 'F', 'U'].includes(fields[3])) {
      errors.push(`DMG: Gender must be M, F, or U — got "${fields[3]}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    segmentCount
  };
}
