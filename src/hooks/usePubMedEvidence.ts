/**
 * usePubMedEvidence — React hook for PubMed MCP integration
 *
 * Purpose: Fetches supporting literature for drug interactions,
 *          clinical guidelines, and treatment recommendations.
 * Used by: DrugInteractionsTab, clinical-decision-support
 *
 * MCP Integration: PubMed (Tier 1) via mcpPubMedClient
 */

import { useState, useCallback } from 'react';
import {
  searchPubMed,
  getArticleAbstract,
  type PubMedArticle,
  type ArticleAbstract,
} from '../services/mcp/mcpPubMedClient';
import { auditLogger } from '../services/auditLogger';

export type EvidenceStatus = 'idle' | 'searching' | 'loaded' | 'error';

export interface EvidenceResult {
  articles: PubMedArticle[];
  totalResults: number;
  query: string;
}

export interface EvidenceState {
  status: EvidenceStatus;
  result: EvidenceResult | null;
  error: string | null;
}

const initialState: EvidenceState = {
  status: 'idle',
  result: null,
  error: null,
};

export function usePubMedEvidence() {
  const [state, setState] = useState<EvidenceState>(initialState);
  const [selectedAbstract, setSelectedAbstract] = useState<ArticleAbstract | null>(null);
  const [loadingAbstract, setLoadingAbstract] = useState(false);

  /**
   * Generic PubMed search with state management.
   */
  const searchEvidence = useCallback(async (
    query: string,
    maxResults = 5
  ): Promise<EvidenceResult | null> => {
    if (!query.trim()) return null;

    setState(prev => ({ ...prev, status: 'searching', error: null }));

    try {
      const result = await searchPubMed(query, {
        maxResults,
        sort: 'relevance',
      });

      if (!result.success || !result.data) {
        const errorState: EvidenceState = {
          status: 'error',
          result: null,
          error: result.error || 'PubMed search failed',
        };
        setState(errorState);
        return null;
      }

      const evidence: EvidenceResult = {
        articles: result.data.articles,
        totalResults: result.data.total_results,
        query: result.data.query,
      };

      await auditLogger.info('PUBMED_EVIDENCE_SEARCH', {
        query,
        articlesFound: evidence.articles.length,
        totalResults: evidence.totalResults,
      });

      setState({
        status: 'loaded',
        result: evidence,
        error: null,
      });

      return evidence;
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      await auditLogger.error(
        'PUBMED_EVIDENCE_SEARCH_FAILED',
        err instanceof Error ? err : new Error(error),
        { query }
      );
      setState({
        status: 'error',
        result: null,
        error: `Evidence search failed: ${error}`,
      });
      return null;
    }
  }, []);

  /**
   * Search PubMed for evidence supporting a drug interaction.
   * Builds a targeted query from drug names and interaction type.
   */
  const searchDrugInteractionEvidence = useCallback(async (
    drug1: string,
    drug2: string,
    maxResults = 5
  ): Promise<EvidenceResult | null> => {
    const query = `"${drug1}" AND "${drug2}" AND (drug interaction OR adverse effect)`;
    return searchEvidence(query, maxResults);
  }, [searchEvidence]);

  /**
   * Search PubMed for evidence supporting a clinical guideline.
   */
  const searchGuidelineEvidence = useCallback(async (
    condition: string,
    guidelineOrg?: string,
    maxResults = 5
  ): Promise<EvidenceResult | null> => {
    const parts = [condition, 'clinical guideline'];
    if (guidelineOrg) parts.push(guidelineOrg);
    const query = parts.join(' AND ');
    return searchEvidence(query, maxResults);
  }, [searchEvidence]);

  /**
   * Fetch full abstract for a specific article.
   */
  const fetchAbstract = useCallback(async (pmid: string): Promise<ArticleAbstract | null> => {
    setLoadingAbstract(true);
    try {
      const result = await getArticleAbstract(pmid);
      if (result.success && result.data) {
        setSelectedAbstract(result.data);
        return result.data;
      }
      return null;
    } catch (err: unknown) {
      await auditLogger.error(
        'PUBMED_ABSTRACT_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { pmid }
      );
      return null;
    } finally {
      setLoadingAbstract(false);
    }
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
    setSelectedAbstract(null);
  }, []);

  return {
    ...state,
    selectedAbstract,
    loadingAbstract,
    searchDrugInteractionEvidence,
    searchGuidelineEvidence,
    searchEvidence,
    fetchAbstract,
    reset,
  };
}
