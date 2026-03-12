/**
 * Medical Synonym Service
 *
 * Expands search terms using the medical_synonyms table.
 * Maps lay terms to clinical terms (e.g., "heart attack" → "myocardial infarction").
 *
 * Tracker: docs/trackers/chatgpt-audit-gaps-tracker.md (S3-2)
 *
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

/** A single expanded term from synonym lookup */
export interface ExpandedTerm {
  term: string;
  is_canonical: boolean;
  code_system: string | null;
  code: string | null;
  category: string;
}

/** Result of expanding a search query */
export interface SynonymExpansion {
  original_query: string;
  expanded_terms: ExpandedTerm[];
  has_synonyms: boolean;
}

/**
 * Expand a search query using the medical_synonyms table.
 *
 * If "heart attack" is searched, returns:
 * - canonical: "myocardial infarction" (ICD-10: I21)
 * - synonyms: "MI", "heart attack" (already matched)
 *
 * @param query - The search term to expand
 * @returns SynonymExpansion with all related terms
 */
async function expandSearchTerm(
  query: string
): Promise<ServiceResult<SynonymExpansion>> {
  try {
    const trimmed = query.trim();
    if (!trimmed) {
      return success({
        original_query: query,
        expanded_terms: [],
        has_synonyms: false,
      });
    }

    const { data, error } = await supabase
      .rpc('expand_medical_synonyms', { p_query: trimmed });

    if (error) {
      await auditLogger.error('SYNONYM_EXPANSION_FAILED', error.message, {
        query: trimmed,
      });
      return failure('DATABASE_ERROR', error.message, error);
    }

    const terms = (data ?? []) as ExpandedTerm[];

    return success({
      original_query: query,
      expanded_terms: terms,
      has_synonyms: terms.length > 0,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('SYNONYM_EXPANSION_FAILED', error, {
      query,
    });
    return failure('OPERATION_FAILED', 'Failed to expand search term', err);
  }
}

/**
 * Get all unique search terms for a query (original + expanded synonyms).
 * Used to build expanded search queries for GlobalSearchBar.
 *
 * @param query - The search term
 * @returns Array of unique search terms (original always included)
 */
async function getSearchTerms(query: string): Promise<string[]> {
  const result = await expandSearchTerm(query);

  const terms = new Set<string>([query.trim().toLowerCase()]);

  if (result.success && result.data.has_synonyms) {
    for (const expanded of result.data.expanded_terms) {
      terms.add(expanded.term.toLowerCase());
    }
  }

  return Array.from(terms);
}

export const medicalSynonymService = {
  expandSearchTerm,
  getSearchTerms,
};

export default medicalSynonymService;
