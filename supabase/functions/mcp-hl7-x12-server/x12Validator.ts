// =====================================================
// X12 837P Validator
// Purpose: Validate X12 837P claim structure and content
// =====================================================

import type { ValidationResult } from './types.ts';

/**
 * Validate an X12 837P claim for structural correctness.
 * Checks required segments, ISA/IEA envelope, segment counts,
 * service lines, and diagnosis codes.
 */
export function validateX12(x12Content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const segments = x12Content.split('~').filter(s => s.trim());
  const segmentCount = segments.length;

  if (segmentCount === 0) {
    return { valid: false, errors: ['Empty X12 content'], warnings, segmentCount: 0 };
  }

  // Check for required segments
  const segmentNames = segments.map(s => s.split('*')[0]);

  const requiredSegments = ['ISA', 'GS', 'ST', 'BHT', 'NM1', 'CLM', 'SE', 'GE', 'IEA'];
  for (const req of requiredSegments) {
    if (!segmentNames.includes(req)) {
      errors.push(`Missing required segment: ${req}`);
    }
  }

  // Validate ISA segment (must be first)
  if (segmentNames[0] !== 'ISA') {
    errors.push('First segment must be ISA');
  } else {
    const isaFields = segments[0].split('*');
    if (isaFields.length < 16) {
      errors.push('ISA segment has insufficient fields');
    }
  }

  // Validate IEA segment (must be last)
  if (segmentNames[segmentNames.length - 1] !== 'IEA') {
    errors.push('Last segment must be IEA');
  }

  // Validate segment count in SE matches actual
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

  // Check for at least one service line
  if (!segmentNames.includes('LX') || !segmentNames.includes('SV1')) {
    warnings.push('No service line segments (LX/SV1) found');
  }

  // Check diagnosis codes
  const hiSegment = segments.find(s => s.startsWith('HI*'));
  if (!hiSegment) {
    errors.push('Missing HI segment (diagnosis codes)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    segmentCount
  };
}
