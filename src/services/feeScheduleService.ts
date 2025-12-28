// Fee Schedule Service - Database-driven billing rates
// Replaces hardcoded rates with annually-updatable fee schedules

import { supabase } from '../lib/supabaseClient';

export interface FeeSchedule {
  id: string;
  name: string;
  payerType: 'medicare' | 'medicaid' | 'commercial' | 'self_pay';
  effectiveDate: string;
  endDate?: string;
  isActive: boolean;
  locality?: string;
  notes?: string;
}

export interface FeeScheduleRate {
  id: string;
  feeScheduleId: string;
  codeType: 'cpt' | 'hcpcs' | 'icd10';
  code: string;
  description?: string;
  rate: number;
  timeRequiredMinutes?: number;
  modifierAdjustments?: Record<string, number>;
  requiresAuthorization?: boolean;
  notes?: string;
}

export interface CodeRate {
  code: string;
  rate: number;
  description?: string;
  timeRequired?: number;
  feeScheduleName?: string;
}

type FeeScheduleDbRow = {
  id: string;
  name: string;
  payer_type: FeeSchedule['payerType'];
  effective_date: string;
  end_date?: string | null;
  is_active: boolean;
  locality?: string | null;
  notes?: string | null;
};

/**
 * Service for managing and retrieving fee schedule data
 */
export class FeeScheduleService {
  /**
   * Get active fee schedule for a payer type
   */
  static async getActiveFeeSchedule(
    payerType: 'medicare' | 'medicaid' | 'commercial' | 'self_pay',
    asOfDate: Date = new Date()
  ): Promise<FeeSchedule | null> {
    const { data, error } = await supabase
      .from('fee_schedules')
      .select('*')
      .eq('payer_type', payerType)
      .eq('is_active', true)
      .lte('effective_date', asOfDate.toISOString().split('T')[0])
      .order('effective_date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return null;
    }

    return data ? this.mapFeeScheduleFromDb(data as unknown as FeeScheduleDbRow) : null;
  }

  /**
   * Get rate for a specific code from active fee schedule
   */
  static async getCodeRate(
    code: string,
    codeType: 'cpt' | 'hcpcs' | 'icd10' = 'cpt',
    payerType: 'medicare' | 'medicaid' | 'commercial' | 'self_pay' = 'medicare'
  ): Promise<CodeRate | null> {
    // Get active fee schedule
    const feeSchedule = await this.getActiveFeeSchedule(payerType);
    if (!feeSchedule) {
      return null;
    }

    // Get rate for code
    const { data, error } = await supabase
      .from('fee_schedule_rates')
      .select('*')
      .eq('fee_schedule_id', feeSchedule.id)
      .eq('code_type', codeType)
      .eq('code', code)
      .single();

    if (error) {
      return null;
    }

    const row = data as unknown as Record<string, unknown>;

    return {
      code: String(row.code ?? ''),
      rate: parseFloat(String(row.rate ?? '0')),
      description: typeof row.description === 'string' ? row.description : undefined,
      timeRequired:
        typeof row.time_required_minutes === 'number'
          ? row.time_required_minutes
          : typeof row.time_required_minutes === 'string'
            ? parseFloat(row.time_required_minutes)
            : undefined,
      feeScheduleName: feeSchedule.name
    };
  }

  /**
   * Get rates for multiple codes (bulk lookup)
   */
  static async getCodeRates(
    codes: string[],
    codeType: 'cpt' | 'hcpcs' | 'icd10' = 'cpt',
    payerType: 'medicare' | 'medicaid' | 'commercial' | 'self_pay' = 'medicare'
  ): Promise<Map<string, CodeRate>> {
    const ratesMap = new Map<string, CodeRate>();

    // Get active fee schedule
    const feeSchedule = await this.getActiveFeeSchedule(payerType);
    if (!feeSchedule) {
      return ratesMap;
    }

    // Bulk fetch rates
    const { data, error } = await supabase
      .from('fee_schedule_rates')
      .select('*')
      .eq('fee_schedule_id', feeSchedule.id)
      .eq('code_type', codeType)
      .in('code', codes);

    if (error) {
      return ratesMap;
    }

    data?.forEach((rateRow) => {
      const rate = rateRow as unknown as Record<string, unknown>;
      const codeValue = String(rate.code ?? '');
      ratesMap.set(codeValue, {
        code: codeValue,
        rate: parseFloat(String(rate.rate ?? '0')),
        description: typeof rate.description === 'string' ? rate.description : undefined,
        timeRequired:
          typeof rate.time_required_minutes === 'number'
            ? rate.time_required_minutes
            : typeof rate.time_required_minutes === 'string'
              ? parseFloat(rate.time_required_minutes)
              : undefined,
        feeScheduleName: feeSchedule.name
      });
    });

    return ratesMap;
  }

  /**
   * Get CCM billing codes with rates
   */
  static async getCCMRates(
    payerType: 'medicare' | 'medicaid' | 'commercial' | 'self_pay' = 'medicare'
  ): Promise<Map<string, CodeRate>> {
    const ccmCodes = ['99490', '99491', '99487', '99489', '99439'];
    return this.getCodeRates(ccmCodes, 'cpt', payerType);
  }

  /**
   * Calculate expected reimbursement for a list of codes
   */
  static async calculateExpectedReimbursement(
    codes: Array<{ code: string; units?: number; modifiers?: string[] }>,
    codeType: 'cpt' | 'hcpcs' | 'icd10' = 'cpt',
    payerType: 'medicare' | 'medicaid' | 'commercial' | 'self_pay' = 'medicare'
  ): Promise<{ total: number; breakdown: Array<{ code: string; rate: number; units: number; subtotal: number }> }> {
    const codesToLookup = codes.map(c => c.code);
    const ratesMap = await this.getCodeRates(codesToLookup, codeType, payerType);

    const breakdown = codes.map(item => {
      const rate = ratesMap.get(item.code);
      const baseRate = rate?.rate || 0;
      const units = item.units || 1;

      // Apply modifier adjustments based on Medicare/payer rules
      let adjustedRate = baseRate;
      if (item.modifiers && item.modifiers.length > 0) {
        for (const modifier of item.modifiers) {
          const mod = modifier.toUpperCase();
          switch (mod) {
            case '26': // Professional component only
              adjustedRate *= 0.26;
              break;
            case 'TC': // Technical component only
              adjustedRate *= 0.74;
              break;
            case '52': // Reduced services
              adjustedRate *= 0.50;
              break;
            case '53': // Discontinued procedure
              adjustedRate *= 0.50;
              break;
            case '22': // Increased procedural services (add 20-30%)
              adjustedRate *= 1.25;
              break;
            case '50': // Bilateral procedure (150% of base)
              adjustedRate *= 1.50;
              break;
            case '51': // Multiple procedures (50% reduction on 2nd+)
              adjustedRate *= 0.50;
              break;
            case '80': // Assistant surgeon (16% of primary)
              adjustedRate *= 0.16;
              break;
            case '81': // Minimum assistant surgeon
              adjustedRate *= 0.10;
              break;
            case '82': // Assistant surgeon when qualified resident not available
              adjustedRate *= 0.16;
              break;
            // Modifiers with no rate adjustment (informational only)
            case '25': // Significant, separately identifiable E/M
            case '59': // Distinct procedural service
            case 'XE': // Separate encounter
            case 'XP': // Separate practitioner
            case 'XS': // Separate structure
            case 'XU': // Unusual non-overlapping service
            case 'GT': // Via interactive audio/video telecom
            case '95': // Synchronous telemedicine
            case 'GQ': // Store and forward telemedicine
            case 'G0': // Telehealth for diagnosis/evaluation
              // No rate adjustment for these modifiers
              break;
            default:
              // Unknown modifier - no adjustment
              break;
          }
        }
      }

      const subtotal = adjustedRate * units;

      return {
        code: item.code,
        rate: adjustedRate,
        units,
        subtotal
      };
    });

    const total = breakdown.reduce((sum, item) => sum + item.subtotal, 0);

    return { total, breakdown };
  }

  /**
   * Get fallback rates (for when database is unavailable)
   * These are 2025 Medicare national averages
   */
  static getFallbackRates(): Map<string, number> {
    return new Map([
      // CCM codes
      ['99490', 64.72],
      ['99491', 58.34],
      ['99487', 145.60],
      ['99489', 69.72],
      ['99439', 31.00],
      // Common E/M codes
      ['99211', 26.00],
      ['99212', 57.00],
      ['99213', 93.00],
      ['99214', 135.00],
      ['99215', 185.00],
      // Telehealth
      ['99441', 14.00],
      ['99442', 27.00],
      ['99443', 50.00]
    ]);
  }

  /**
   * Get rate with automatic fallback
   */
  static async getCodeRateWithFallback(
    code: string,
    codeType: 'cpt' | 'hcpcs' | 'icd10' = 'cpt',
    payerType: 'medicare' | 'medicaid' | 'commercial' | 'self_pay' = 'medicare'
  ): Promise<number> {
    try {
      const rate = await this.getCodeRate(code, codeType, payerType);
      if (rate) {
        return rate.rate;
      }
    } catch {
      // Ignore and fallback
    }

    // Fallback to hardcoded rates
    const fallbackRates = this.getFallbackRates();
    return fallbackRates.get(code) || 0;
  }

  /**
   * Admin: Create or update fee schedule
   */
  static async upsertFeeSchedule(schedule: Partial<FeeSchedule>): Promise<FeeSchedule | null> {
    const { data, error } = await supabase
      .from('fee_schedules')
      .upsert({
        name: schedule.name,
        payer_type: schedule.payerType,
        effective_date: schedule.effectiveDate,
        end_date: schedule.endDate,
        is_active: schedule.isActive ?? true,
        locality: schedule.locality,
        notes: schedule.notes
      })
      .select()
      .single();

    if (error) {
      return null;
    }

    return this.mapFeeScheduleFromDb(data as unknown as FeeScheduleDbRow);
  }

  /**
   * Admin: Bulk upsert code rates
   */
  static async bulkUpsertRates(
    feeScheduleId: string,
    rates: Array<Omit<FeeScheduleRate, 'id' | 'feeScheduleId'>>
  ): Promise<boolean> {
    const ratesToInsert = rates.map(rate => ({
      fee_schedule_id: feeScheduleId,
      code_type: rate.codeType,
      code: rate.code,
      description: rate.description,
      rate: rate.rate,
      time_required_minutes: rate.timeRequiredMinutes,
      modifier_adjustments: rate.modifierAdjustments,
      requires_authorization: rate.requiresAuthorization,
      notes: rate.notes
    }));

    const { error } = await supabase
      .from('fee_schedule_rates')
      .upsert(ratesToInsert, { onConflict: 'fee_schedule_id,code_type,code' });

    if (error) {
      return false;
    }

    return true;
  }

  /**
   * Map database row to FeeSchedule type
   */
  private static mapFeeScheduleFromDb(data: FeeScheduleDbRow): FeeSchedule {
    return {
      id: data.id,
      name: data.name,
      payerType: data.payer_type,
      effectiveDate: data.effective_date,
      endDate: data.end_date ?? undefined,
      isActive: data.is_active,
      locality: data.locality ?? undefined,
      notes: data.notes ?? undefined
    };
  }
}

export default FeeScheduleService;
