/**
 * Measure Definitions — CRUD operations
 *
 * ONC Criteria: 170.315(c)(1)
 */

import { supabase } from '../../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../../_base';
import { auditLogger } from '../../auditLogger';
import type { MeasureDefinition } from './types';

/**
 * Get all active measure definitions
 */
export async function getMeasureDefinitions(): Promise<ServiceResult<MeasureDefinition[]>> {
  try {
    const { data, error } = await supabase
      .from('ecqm_measure_definitions')
      .select('id, measure_id, cms_id, version, title, description, measure_type, measure_scoring, initial_population_description, denominator_description, numerator_description, reporting_year, applicable_settings, clinical_focus, is_active')
      .eq('is_active', true)
      .order('cms_id');

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    return success(data || []);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_DEFINITIONS_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err))
    );
    return failure('FETCH_FAILED', 'Failed to fetch measure definitions');
  }
}

/**
 * Get a specific measure definition
 */
export async function getMeasureDefinition(measureId: string): Promise<ServiceResult<MeasureDefinition | null>> {
  try {
    const { data, error } = await supabase
      .from('ecqm_measure_definitions')
      .select('id, measure_id, cms_id, version, title, description, measure_type, measure_scoring, initial_population_description, denominator_description, numerator_description, reporting_year, applicable_settings, clinical_focus, is_active')
      .eq('measure_id', measureId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', error.message);
    }

    return success(data);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_DEFINITION_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { measureId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch measure definition');
  }
}
