/**
 * Enterprise Migration Engine — Conditional Mapping Service
 *
 * Value-based routing rules for conditional data mapping.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { ConditionalMapping } from './types';

export class ConditionalMappingService {
  private supabase: SupabaseClient;
  private mappingsCache: Map<string, ConditionalMapping[]> = new Map();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /** Load conditional mappings for a column */
  async loadMappings(sourceColumn: string): Promise<ConditionalMapping[]> {
    const cached = this.mappingsCache.get(sourceColumn);
    if (cached) {
      return cached;
    }

    const { data } = await this.supabase
      .from('migration_conditional_mappings')
      .select('mapping_id, source_column, condition, action_type, action_config, priority')
      .eq('source_column', sourceColumn)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    const mappings = (data || []).map(row => ({
      mappingId: row.mapping_id,
      sourceColumn: row.source_column,
      condition: row.condition,
      actionType: row.action_type,
      actionConfig: row.action_config,
      priority: row.priority
    }));

    this.mappingsCache.set(sourceColumn, mappings);
    return mappings;
  }

  /** Evaluate conditional mappings for a record */
  async evaluate(
    sourceColumn: string,
    record: Record<string, unknown>
  ): Promise<{
    matched: boolean;
    actionType?: string;
    actionConfig?: Record<string, unknown>;
  }> {
    const mappings = await this.loadMappings(sourceColumn);

    for (const mapping of mappings) {
      if (this.evaluateCondition(mapping.condition, record)) {
        return {
          matched: true,
          actionType: mapping.actionType,
          actionConfig: mapping.actionConfig
        };
      }
    }

    return { matched: false };
  }

  /** Evaluate a single condition */
  private evaluateCondition(
    condition: ConditionalMapping['condition'],
    record: Record<string, unknown>
  ): boolean {
    const fieldValue = String(record[condition.field] ?? '');

    switch (condition.type) {
      case 'value_equals':
        return fieldValue === condition.value;

      case 'value_in':
        return (condition.values || []).includes(fieldValue);

      case 'value_matches':
        return condition.pattern ? new RegExp(condition.pattern).test(fieldValue) : false;

      case 'value_range': {
        const numValue = parseFloat(fieldValue);
        if (isNaN(numValue)) return false;
        const minOk = condition.min === undefined || numValue >= condition.min;
        const maxOk = condition.max === undefined || numValue <= condition.max;
        return minOk && maxOk;
      }

      case 'value_null':
        return !fieldValue || fieldValue === 'null' || fieldValue === 'undefined';

      case 'value_not_null':
        return !!fieldValue && fieldValue !== 'null' && fieldValue !== 'undefined';

      default:
        return false;
    }
  }
}
