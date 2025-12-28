// Billing utilities and helper functions for WellFit Community
// Production-grade validation, formatting, and business logic

import type {
  BillingProvider,
  BillingPayer,
  ClaimStatus,
  EncounterProcedure,
  EncounterDiagnosis,
  CodingSuggestion,
} from '../types/billing';

export class BillingUtils {
  // Validation
  static validateNPI(npi: string): boolean {
    if (!npi || typeof npi !== 'string') return false;

    // Remove any non-digits
    const cleaned = npi.replace(/\D/g, '');

    // Must be exactly 10 digits
    if (cleaned.length !== 10) return false;

    // Luhn algorithm check for NPI
    const digits = cleaned.split('').map(Number);
    let sum = 0;

    for (let i = 0; i < 9; i++) {
      let digit = digits[i];
      if (i % 2 === 1) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === digits[9];
  }

  static validateEIN(ein: string): boolean {
    if (!ein || typeof ein !== 'string') return false;

    // Remove any non-digits and hyphens
    const cleaned = ein.replace(/[^\d-]/g, '');

    // Check format: XX-XXXXXXX or XXXXXXXXX
    return /^\d{2}-?\d{7}$/.test(cleaned);
  }

  static validateTaxonomy(taxonomy: string): boolean {
    if (!taxonomy || typeof taxonomy !== 'string') return false;

    // Basic taxonomy code format: XXXXXXXXXX
    return /^\d{10}[X]?$/.test(taxonomy);
  }

  static validateCPTCode(code: string): boolean {
    if (!code || typeof code !== 'string') return false;

    // CPT codes: 5 digits, may start with 0
    return /^\d{5}$/.test(code);
  }

  static validateHCPCSCode(code: string): boolean {
    if (!code || typeof code !== 'string') return false;

    // HCPCS codes: 1 letter + 4 digits
    return /^[A-Z]\d{4}$/.test(code.toUpperCase());
  }

  static validateICD10Code(code: string): boolean {
    if (!code || typeof code !== 'string') return false;

    // ICD-10: Letter + 2 digits + optional dot + up to 4 more characters
    return /^[A-Z]\d{2}\.?[A-Z0-9]{0,4}$/i.test(code);
  }

  static validateModifier(modifier: string): boolean {
    if (!modifier || typeof modifier !== 'string') return false;

    // Modifiers: 2 characters (letters or digits)
    return /^[A-Z0-9]{2}$/i.test(modifier);
  }

  // Formatting
  static formatNPI(npi: string): string {
    const cleaned = npi.replace(/\D/g, '');
    return cleaned.length === 10 ? cleaned : '';
  }

  static formatEIN(ein: string): string {
    const cleaned = ein.replace(/[^\d]/g, '');
    if (cleaned.length === 9) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    }
    return ein;
  }

  static formatCurrency(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  }

  static formatDate(date: string | Date): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US');
  }

  static formatDateForX12(date: string | Date): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}${month}${day}`;
  }

  // Business Logic
  static calculateClaimTotal(procedures: EncounterProcedure[]): number {
    return procedures.reduce((total, proc) => {
      const amount = Number(proc.charge_amount) || 0;
      const units = Number(proc.units) || 1;
      return total + (amount * units);
    }, 0);
  }

  static getClaimStatusDisplayName(status: ClaimStatus): string {
    const statusMap: Record<ClaimStatus, string> = {
      generated: 'Generated',
      submitted: 'Submitted',
      accepted: 'Accepted',
      rejected: 'Rejected',
      paid: 'Paid',
      void: 'Void',
    };
    return statusMap[status] || status;
  }

  static getClaimStatusColor(status: ClaimStatus): string {
    const colorMap: Record<ClaimStatus, string> = {
      generated: 'text-blue-600',
      submitted: 'text-yellow-600',
      accepted: 'text-green-600',
      rejected: 'text-red-600',
      paid: 'text-green-800',
      void: 'text-gray-500',
    };
    return colorMap[status] || 'text-gray-600';
  }

  static getPrimaryDiagnosis(diagnoses: EncounterDiagnosis[]): EncounterDiagnosis | null {
    if (!diagnoses || diagnoses.length === 0) return null;

    // Find diagnosis with sequence 1 or the first one
    return diagnoses.find(d => d.sequence === 1) || diagnoses[0];
  }

  static generateControlNumber(): string {
    // Generate a unique control number for X12 transactions
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return (timestamp + random).toUpperCase().substr(0, 9);
  }

  // Provider/Payer Utilities
  static getProviderDisplayName(provider: BillingProvider): string {
    return provider.organization_name || `Provider ${provider.npi}` || 'Unknown Provider';
  }

  static getPayerDisplayName(payer: BillingPayer): string {
    return payer.name || `Payer ${payer.receiver_id}` || 'Unknown Payer';
  }

  static validateProviderForBilling(provider: BillingProvider): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!provider.npi) {
      errors.push('NPI is required');
    } else if (!this.validateNPI(provider.npi)) {
      errors.push('Invalid NPI format');
    }

    if (!provider.organization_name) {
      errors.push('Organization name is required');
    }

    if (!provider.address_line1) {
      errors.push('Address is required');
    }

    if (!provider.city) {
      errors.push('City is required');
    }

    if (!provider.state) {
      errors.push('State is required');
    }

    if (!provider.zip) {
      errors.push('ZIP code is required');
    }

    if (provider.ein && !this.validateEIN(provider.ein)) {
      errors.push('Invalid EIN format');
    }

    if (provider.taxonomy_code && !this.validateTaxonomy(provider.taxonomy_code)) {
      errors.push('Invalid taxonomy code format');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static validatePayerForBilling(payer: BillingPayer): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!payer.name) {
      errors.push('Payer name is required');
    }

    if (!payer.receiver_id && !payer.clearinghouse_id) {
      errors.push('Either receiver ID or clearinghouse ID is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Coding Suggestions
  static formatCodingSuggestion(suggestion: CodingSuggestion): {
    summary: string;
    details: string[];
  } {
    const details: string[] = [];
    let procedureCount = 0;
    let diagnosisCount = 0;

    if (suggestion.cpt && suggestion.cpt.length > 0) {
      procedureCount += suggestion.cpt.length;
      details.push(`${suggestion.cpt.length} CPT codes suggested`);
    }

    if (suggestion.hcpcs && suggestion.hcpcs.length > 0) {
      procedureCount += suggestion.hcpcs.length;
      details.push(`${suggestion.hcpcs.length} HCPCS codes suggested`);
    }

    if (suggestion.icd10 && suggestion.icd10.length > 0) {
      diagnosisCount = suggestion.icd10.length;
      details.push(`${suggestion.icd10.length} ICD-10 codes suggested`);
    }

    if (suggestion.confidence !== undefined) {
      details.push(`${suggestion.confidence}% confidence`);
    }

    const summary = `${procedureCount} procedures, ${diagnosisCount} diagnoses`;

    return { summary, details };
  }

  static getSuggestionConfidenceColor(confidence?: number): string {
    if (confidence === undefined) return 'text-gray-500';
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  }

  // X12 Utilities
  static cleanX12String(input: string): string {
    // Remove characters that are not allowed in X12
    return input.replace(/[~*^|\\]/g, '').trim();
  }

  static padX12Field(value: string, length: number, padChar: string = ' '): string {
    const cleaned = this.cleanX12String(value);
    return cleaned.length >= length
      ? cleaned.substring(0, length)
      : cleaned.padEnd(length, padChar);
  }

  static formatX12Amount(amount: number): string {
    // X12 amounts are formatted without decimal point
    const cents = Math.round(amount * 100);
    return cents.toString();
  }

  // Date Utilities
  static isValidServiceDate(date: string): boolean {
    const d = new Date(date);
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    // Service date should be within the last year and not in the future
    return d >= oneYearAgo && d <= now;
  }

  static getDateRangeForBilling(months: number = 12): {
    start: string;
    end: string;
  } {
    const end = new Date();
    const start = new Date();
    start.setMonth(end.getMonth() - months);

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }

  // Error Handling
  static formatBillingError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'An unknown billing error occurred';
  }

  static isBillingError(error: unknown): boolean {
    if (error instanceof Error) {
      const billingKeywords = ['billing', 'claim', 'x12', 'encounter', 'provider', 'payer'];
      return billingKeywords.some(keyword =>
        error.message.toLowerCase().includes(keyword)
      );
    }
    return false;
  }

  // Performance Utilities
  static batchOperations<T>(items: T[], batchSize: number = 50): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cache Utilities
  static createCacheKey(prefix: string, ...parts: string[]): string {
    return `billing:${prefix}:${parts.join(':')}`;
  }

  static shouldRefreshCache(timestamp: number, maxAgeMs: number = 300000): boolean {
    // Default 5 minutes cache
    return Date.now() - timestamp > maxAgeMs;
  }
}

export default BillingUtils;
