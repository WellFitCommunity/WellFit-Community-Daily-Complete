/**
 * Discharge Context Input Validation (Security)
 *
 * Extracted verbatim from readmissionRiskPredictor.ts during god-file
 * decomposition (CLAUDE.md Commandment #12). Behavior-preserving move only.
 */

import type { DischargeContext } from './types';

export class DischargeValidator {
  static validateUUID(value: string, fieldName: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error(`Invalid ${fieldName}: must be valid UUID`);
    }
  }

  static validateISODate(value: string, fieldName: string): void {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid ${fieldName}: must be valid ISO date`);
    }
  }

  static sanitizeText(text: string, maxLength: number = 500): string {
    if (!text) return '';
    return text
      .replace(/[<>'"]/g, '')
      .replace(/;/g, '')
      .replace(/--/g, '')
      .slice(0, maxLength)
      .trim();
  }

  static validateDischargeContext(context: DischargeContext): void {
    this.validateUUID(context.patientId, 'patientId');
    this.validateUUID(context.tenantId, 'tenantId');
    this.validateISODate(context.dischargeDate, 'dischargeDate');

    const validDispositions = ['home', 'home_health', 'snf', 'ltac', 'rehab', 'hospice'];
    if (!validDispositions.includes(context.dischargeDisposition)) {
      throw new Error(`Invalid dischargeDisposition: must be one of ${validDispositions.join(', ')}`);
    }

    if (context.dischargeFacility) {
      context.dischargeFacility = this.sanitizeText(context.dischargeFacility, 200);
    }

    if (context.primaryDiagnosisDescription) {
      context.primaryDiagnosisDescription = this.sanitizeText(context.primaryDiagnosisDescription, 300);
    }
  }
}
