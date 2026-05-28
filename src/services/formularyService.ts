/**
 * Formulary Service — ONC 170.315(a)(10) Drug Formulary Check.
 *
 * Looks up a medication's formulary status (tier, copay, prior auth,
 * step therapy, preferred alternatives) at the point of prescribing.
 * Wired into MedicationOrderForm so the provider sees coverage status
 * before submit.
 *
 * Live DB shape (per `information_schema.columns 2026-05-28`):
 *   formulary_cache is keyed by (bin_number, ndc_code). It is NOT
 *   tenant-scoped — entries are payer/plan-level and shared across
 *   tenants for the same BIN. Tier values follow the standard insurance
 *   convention: 1=preferred-generic, 2=preferred-brand, 3=non-preferred,
 *   4=specialty, NULL=non-formulary.
 *
 * @see https://www.cms.gov/regulations-and-guidance/legislation/ehrincentiveprograms
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { success, failure, type ServiceResult } from './_base';

export interface FormularyEntry {
  id: string;
  bin_number: string;
  ndc_code: string;
  drug_name: string | null;
  formulary_status: string | null;
  tier: number | null;
  copay_amount: number | null;
  coinsurance_percent: number | null;
  requires_prior_auth: boolean | null;
  requires_step_therapy: boolean | null;
  quantity_limit: number | null;
  quantity_limit_days: number | null;
  preferred_alternatives: string[] | null;
  expires_at: string;
  is_valid: boolean | null;
}

const SELECT_COLS =
  'id, bin_number, ndc_code, drug_name, formulary_status, tier, copay_amount, coinsurance_percent, requires_prior_auth, requires_step_therapy, quantity_limit, quantity_limit_days, preferred_alternatives, expires_at, is_valid';

export interface FormularyLookupOptions {
  /** Restrict to a specific payer BIN. Optional — when omitted, returns any matching NDC. */
  binNumber?: string;
}

export class FormularyService {
  /**
   * Look up the formulary entry for a given NDC code. Returns null when
   * the NDC is not in the cache (UI should surface "Formulary status: not
   * available — coverage cannot be confirmed at this time"). Returns the
   * entry when a row exists. Filters out expired or invalidated entries.
   */
  static async lookupByNdc(
    ndcCode: string,
    options: FormularyLookupOptions = {}
  ): Promise<ServiceResult<FormularyEntry | null>> {
    const ndc = ndcCode.trim();
    if (!ndc) {
      return success(null);
    }

    try {
      let query = supabase
        .from('formulary_cache')
        .select(SELECT_COLS)
        .eq('ndc_code', ndc)
        .eq('is_valid', true)
        .gt('expires_at', new Date().toISOString());

      if (options.binNumber) {
        query = query.eq('bin_number', options.binNumber);
      }

      const { data, error } = await query
        .order('tier', { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        await auditLogger.error(
          'FORMULARY_LOOKUP_FAILED',
          new Error(error.message),
          { ndcCode: ndc, binNumber: options.binNumber }
        );
        return failure('DATABASE_ERROR', 'Could not look up formulary status.');
      }

      return success((data as FormularyEntry | null) ?? null);
    } catch (err: unknown) {
      await auditLogger.error(
        'FORMULARY_LOOKUP_UNEXPECTED',
        err instanceof Error ? err : new Error(String(err)),
        { ndcCode: ndc, binNumber: options.binNumber }
      );
      return failure('UNKNOWN_ERROR', 'Unexpected error looking up formulary.');
    }
  }
}

/**
 * UI helper — turns a FormularyEntry into a human-readable status object
 * that the form can render directly. Keeps the rendering layer dumb.
 */
export interface FormularyStatusSummary {
  level: 'preferred' | 'covered' | 'non_formulary' | 'unknown';
  label: string;
  detail: string;
  /** True when the order should be flagged to the prescriber but NOT blocked. */
  warn: boolean;
  /** True when a hard gate should be raised (e.g., prior auth required) */
  block: boolean;
  preferredAlternatives: string[];
}

export function summarizeFormulary(entry: FormularyEntry | null): FormularyStatusSummary {
  if (!entry) {
    return {
      level: 'unknown',
      label: 'Formulary status not available',
      detail: 'No formulary record found for this NDC. Verify coverage with the patient\'s plan before dispensing.',
      warn: true,
      block: false,
      preferredAlternatives: [],
    };
  }

  const alternatives = entry.preferred_alternatives ?? [];
  const tier = entry.tier;
  const priorAuth = entry.requires_prior_auth === true;
  const stepTherapy = entry.requires_step_therapy === true;

  // Non-formulary: status is the explicit non-covered value OR tier is null.
  // Live DB CHECK constraint values: covered, not_covered, prior_auth,
  // step_therapy, quantity_limit.
  if (entry.formulary_status === 'not_covered' || tier === null) {
    return {
      level: 'non_formulary',
      label: 'Non-formulary',
      detail: 'Not on this plan\'s formulary. Patient may pay full retail or appeal for coverage.',
      warn: true,
      block: false,
      preferredAlternatives: alternatives,
    };
  }

  const guards: string[] = [];
  if (priorAuth) guards.push('Prior auth required');
  if (stepTherapy) guards.push('Step therapy required');

  const isPreferred = tier === 1 || tier === 2;
  return {
    level: isPreferred ? 'preferred' : 'covered',
    label: `Tier ${tier}${isPreferred ? ' (preferred)' : ''}`,
    detail: [
      entry.copay_amount != null ? `Copay: $${entry.copay_amount.toFixed(2)}` : null,
      entry.coinsurance_percent != null ? `Coinsurance: ${entry.coinsurance_percent}%` : null,
      ...guards,
    ].filter(Boolean).join(' · ') || 'Covered',
    warn: priorAuth || stepTherapy,
    block: false, // Prior auth is a workflow gate, not a hard block — clinician may still order.
    preferredAlternatives: alternatives,
  };
}
