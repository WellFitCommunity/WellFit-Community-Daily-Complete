/**
 * PubMed MCP Client — Browser-Safe Version
 *
 * Purpose: Search PubMed for biomedical literature, retrieve article
 *          abstracts/summaries, find citing articles, and look up
 *          MeSH terms for clinical decision support.
 *
 * HIPAA Compliance:
 * - No PHI transmitted — queries use condition/drug names only
 * - Audit logging for all operations
 *
 * MCP Server: mcp-pubmed-server (Tier 1 — external API, no PHI)
 */

import { SB_URL } from '../../settings/settings';
import { getSupabaseAuthToken } from './mcpHelpers';

// =====================================================
// Types
// =====================================================

export interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  publication_date: string;
  doi?: string;
  abstract?: string;
  mesh_terms?: string[];
  article_type?: string;
}

export interface PubMedSearchResult {
  articles: PubMedArticle[];
  total_results: number;
  query: string;
}

export interface ArticleSummary {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  publication_date: string;
  doi?: string;
}

export interface ArticleAbstract {
  pmid: string;
  title: string;
  abstract_text: string;
  mesh_terms: string[];
}

export interface MeSHTerm {
  term: string;
  tree_numbers: string[];
  scope_note?: string;
  entry_terms?: string[];
}

export interface PubMedResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// =====================================================
// PubMed MCP Client
// =====================================================

class PubMedMCPClient {
  private static instance: PubMedMCPClient;
  private edgeFunctionUrl: string;

  private constructor() {
    this.edgeFunctionUrl = `${SB_URL}/functions/v1/mcp-pubmed-server`;
  }

  static getInstance(): PubMedMCPClient {
    if (!PubMedMCPClient.instance) {
      PubMedMCPClient.instance = new PubMedMCPClient();
    }
    return PubMedMCPClient.instance;
  }

  private getAuthToken(): string {
    return getSupabaseAuthToken();
  }

  private async callTool<T>(toolName: string, args: Record<string, unknown>): Promise<PubMedResult<T>> {
    try {
      const token = this.getAuthToken();

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          method: 'tools/call',
          params: { name: toolName, arguments: args },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const result = await response.json();

      // MCP servers return JSON-RPC: { jsonrpc, result: { content: [{ type: "text", text }] }, id }
      const textContent = result.result?.content?.[0]?.text ?? result.content?.[0]?.text;
      if (textContent) {
        return { success: true, data: JSON.parse(textContent) as T };
      }

      return { success: false, error: 'Invalid response format' };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }

  // ─────────────────────────────────────────────────────
  // Search Operations
  // ─────────────────────────────────────────────────────

  async searchArticles(params: {
    query: string;
    max_results?: number;
    sort?: 'relevance' | 'date';
    article_types?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<PubMedResult<PubMedSearchResult>> {
    return this.callTool('search_pubmed', params);
  }

  async searchClinicalTrials(params: {
    query: string;
    max_results?: number;
    phase?: string;
  }): Promise<PubMedResult<PubMedSearchResult>> {
    return this.callTool('search_clinical_trials', params);
  }

  // ─────────────────────────────────────────────────────
  // Article Details
  // ─────────────────────────────────────────────────────

  async getArticleSummary(pmids: string[]): Promise<PubMedResult<ArticleSummary[]>> {
    return this.callTool('get_article_summary', { pmids: pmids.join(',') });
  }

  async getArticleAbstract(pmid: string): Promise<PubMedResult<ArticleAbstract>> {
    return this.callTool('get_article_abstract', { pmid });
  }

  async getArticleCitations(pmid: string, maxResults?: number): Promise<PubMedResult<PubMedSearchResult>> {
    return this.callTool('get_article_citations', { pmid, max_results: maxResults });
  }

  // ─────────────────────────────────────────────────────
  // Vocabulary
  // ─────────────────────────────────────────────────────

  async getMeSHTerms(term: string): Promise<PubMedResult<MeSHTerm[]>> {
    return this.callTool('get_mesh_terms', { term });
  }
}

// =====================================================
// Singleton & Convenience Functions
// =====================================================

const pubmedClient = PubMedMCPClient.getInstance();

/**
 * Search PubMed for articles matching a clinical query
 */
export async function searchPubMed(
  query: string,
  options?: {
    maxResults?: number;
    sort?: 'relevance' | 'date';
    articleType?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<PubMedResult<PubMedSearchResult>> {
  return pubmedClient.searchArticles({
    query,
    max_results: options?.maxResults,
    sort: options?.sort,
    article_types: options?.articleType,
    date_from: options?.dateFrom,
    date_to: options?.dateTo,
  });
}

/**
 * Search for clinical trials related to a condition/intervention
 */
export async function searchClinicalTrials(
  query: string,
  phase?: string,
  maxResults?: number
): Promise<PubMedResult<PubMedSearchResult>> {
  return pubmedClient.searchClinicalTrials({ query, phase, max_results: maxResults });
}

/**
 * Get structured summaries for one or more articles by PMID
 */
export async function getArticleSummaries(
  pmids: string[]
): Promise<PubMedResult<ArticleSummary[]>> {
  return pubmedClient.getArticleSummary(pmids);
}

/**
 * Get full abstract and MeSH terms for a single article
 */
export async function getArticleAbstract(
  pmid: string
): Promise<PubMedResult<ArticleAbstract>> {
  return pubmedClient.getArticleAbstract(pmid);
}

/**
 * Find articles that cite a given article (cited-by lookup)
 */
export async function getArticleCitations(
  pmid: string,
  maxResults?: number
): Promise<PubMedResult<PubMedSearchResult>> {
  return pubmedClient.getArticleCitations(pmid, maxResults);
}

/**
 * Look up MeSH vocabulary terms for precise searches
 */
export async function getMeSHTerms(
  term: string
): Promise<PubMedResult<MeSHTerm[]>> {
  return pubmedClient.getMeSHTerms(term);
}

export { PubMedMCPClient };
export default pubmedClient;
