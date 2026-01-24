// Bed Optimizer - Input Validation
// Security: XSS prevention, SQL injection protection, input sanitization

/**
 * Input validation for bed optimizer operations
 */
export class BedOptimizerValidator {
  static validateUUID(value: string, fieldName: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error(`Invalid ${fieldName}: must be valid UUID`);
    }
  }

  static validateDate(value: string, fieldName: string): void {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid ${fieldName}: must be valid date`);
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
}
