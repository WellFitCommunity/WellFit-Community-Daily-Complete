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
import type {
  EquityAskResult,
  EquityCatalogResponse,
  EquityReport,
  EquitySpec,
  EquityTranslation,
} from './types';

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

  /**
   * Translate a plain-language question into a spec WITHOUT running it (Session 2 AI layer).
   * Returns either the interpreted spec (for the builder to show/edit) or a clarifying question.
   */
  async translate(question: string): Promise<ServiceResult<EquityTranslation>> {
    try {
      const { data, error } = await supabase.functions.invoke<{
        spec?: EquitySpec;
        interpretedFrom?: string;
        translatedBy?: string;
        clarification?: string;
        question?: string;
      }>(FUNCTION_NAME, { body: { action: 'translate', question } });

      if (error) {
        return failure('EXTERNAL_SERVICE_ERROR', error.message ?? 'Translation failed', error);
      }
      if (data?.clarification) {
        return success({ kind: 'clarification', message: data.clarification, question: data.question ?? question });
      }
      if (data?.spec) {
        return success({
          kind: 'spec',
          spec: data.spec,
          interpretedFrom: data.interpretedFrom ?? question,
          translatedBy: data.translatedBy ?? '',
        });
      }
      return failure('OPERATION_FAILED', 'Translation returned no result');
    } catch (err: unknown) {
      await auditLogger.error(
        'EQUITY_ANALYTICS_TRANSLATE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
      );
      return failure('UNKNOWN_ERROR', 'Translation failed');
    }
  },

  /**
   * Ask a plain-language question and get the report end-to-end (translate → validate → run).
   * Returns either a report or a clarifying question when the ask can't be mapped to the catalog.
   */
  async ask(question: string): Promise<ServiceResult<EquityAskResult>> {
    try {
      const { data, error } = await supabase.functions.invoke<
        (EquityReport & { clarification?: undefined }) | { clarification: string; question?: string }
      >(FUNCTION_NAME, { body: { action: 'ask', question } });

      if (error) {
        return failure('EXTERNAL_SERVICE_ERROR', error.message ?? 'Analytics question failed', error);
      }
      if (data && 'clarification' in data && data.clarification) {
        return success({ kind: 'clarification', message: data.clarification, question: data.question ?? question });
      }
      if (data && 'rows' in data && data.rows) {
        return success({ kind: 'report', report: data });
      }
      return failure('OPERATION_FAILED', 'Analytics question returned no result');
    } catch (err: unknown) {
      await auditLogger.error(
        'EQUITY_ANALYTICS_ASK_FAILED',
        err instanceof Error ? err : new Error(String(err)),
      );
      return failure('UNKNOWN_ERROR', 'Analytics question failed');
    }
  },
};
