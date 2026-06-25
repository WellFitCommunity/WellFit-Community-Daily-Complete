/**
 * equityAnalyticsService — typed client wrapper for the equity-analytics engine.
 *
 * Calls the `equity-analytics` edge function, which enforces auth/role/tenant/rate-limit/audit and
 * runs the deterministic, aggregate-only SQL engine. This service never sees or returns raw rows —
 * only report-generated aggregates.
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { ServiceResult, success, failure } from '../_base';
import type { EquityCatalogResponse, EquityReport, EquitySpec } from './types';

const FUNCTION_NAME = 'equity-analytics';

export const equityAnalyticsService = {
  /**
   * Fetch the dimension/measure catalog (drives the query builder UI; never hardcode fields).
   */
  async getCatalog(): Promise<ServiceResult<EquityCatalogResponse>> {
    try {
      const { data, error } = await supabase.functions.invoke<EquityCatalogResponse>(FUNCTION_NAME, {
        body: { action: 'catalog' },
      });
      if (error) {
        return failure('EXTERNAL_SERVICE_ERROR', error.message ?? 'Failed to load analytics catalog', error);
      }
      if (!data?.catalog) {
        return failure('NOT_FOUND', 'Analytics catalog unavailable');
      }
      return success(data);
    } catch (err: unknown) {
      await auditLogger.error(
        'EQUITY_ANALYTICS_CATALOG_FAILED',
        err instanceof Error ? err : new Error(String(err)),
      );
      return failure('UNKNOWN_ERROR', 'Failed to load analytics catalog');
    }
  },

  /**
   * Run an aggregate query and return report rows.
   * Small cells are returned and flagged `low_n` (not hidden) unless `spec.minCellSize` is set or the
   * caller is on the researcher tier.
   */
  async runQuery(spec: EquitySpec): Promise<ServiceResult<EquityReport>> {
    try {
      const { data, error } = await supabase.functions.invoke<EquityReport>(FUNCTION_NAME, {
        body: { action: 'query', spec },
      });
      if (error) {
        return failure('EXTERNAL_SERVICE_ERROR', error.message ?? 'Analytics query failed', error);
      }
      if (!data?.rows) {
        return failure('OPERATION_FAILED', 'Analytics query returned no result');
      }
      return success(data);
    } catch (err: unknown) {
      await auditLogger.error(
        'EQUITY_ANALYTICS_QUERY_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { source: spec.source, measure: spec.measure, dimensions: spec.dimensions },
      );
      return failure('UNKNOWN_ERROR', 'Analytics query failed');
    }
  },
};
