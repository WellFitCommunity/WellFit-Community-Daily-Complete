/**
 * PubMedEvidencePanel — Reusable "Supporting Literature" card
 *
 * Collapsible panel that searches PubMed for clinical evidence.
 * Props: condition (search term), guidelineOrg (optional), collapsed (optional).
 *
 * Used by: PriorAuthCreateForm (clinical justification), DrugInteractionsTab
 * Data source: usePubMedEvidence hook → mcpPubMedClient
 */

import React, { useState } from 'react';
import { usePubMedEvidence } from '../../hooks/usePubMedEvidence';
import type { PubMedArticle, ArticleAbstract } from '../../services/mcp/mcpPubMedClient';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Search,
  ExternalLink,
  Loader2,
  AlertCircle,
  FileText,
  X,
} from 'lucide-react';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';

// =====================================================
// Props
// =====================================================

interface PubMedEvidencePanelProps {
  /** Search term (condition, procedure, drug, etc.) */
  condition: string;
  /** Optional guideline organization (e.g. "AHA", "ACC") */
  guidelineOrg?: string;
  /** Start collapsed (default: true) */
  collapsed?: boolean;
  /** Max articles to fetch (default: 5) */
  maxResults?: number;
}

// =====================================================
// Article Card
// =====================================================

const ArticleCard: React.FC<{
  article: PubMedArticle;
  onViewAbstract: (pmid: string) => void;
  loadingAbstract: boolean;
}> = ({ article, onViewAbstract, loadingAbstract }) => (
  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
    <h4 className="text-sm font-semibold text-gray-900 leading-snug">
      {article.title}
    </h4>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
      {article.journal && <span>{article.journal}</span>}
      {article.publication_date && <span>{article.publication_date}</span>}
      <span className="font-mono">PMID: {article.pmid}</span>
    </div>
    {article.authors && article.authors.length > 0 && (
      <p className="text-xs text-gray-600">
        {article.authors.slice(0, 3).join(', ')}
        {article.authors.length > 3 && ` et al.`}
      </p>
    )}
    <div className="flex items-center gap-2 pt-1">
      <button
        onClick={() => onViewAbstract(article.pmid)}
        disabled={loadingAbstract}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/5 rounded hover:bg-[var(--ea-primary,#00857a)]/10 transition min-h-[32px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
      >
        {loadingAbstract ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <FileText className="w-3 h-3" />
        )}
        View Abstract
      </button>
      {article.doi && (
        <a
          href={`https://doi.org/${article.doi}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/5 rounded hover:bg-[var(--ea-primary,#00857a)]/10 transition min-h-[32px]"
        >
          <ExternalLink className="w-3 h-3" />
          DOI
        </a>
      )}
    </div>
  </div>
);

// =====================================================
// Abstract Display
// =====================================================

const AbstractDisplay: React.FC<{
  abstract: ArticleAbstract;
  onClose: () => void;
}> = ({ abstract, onClose }) => (
  <div className="bg-white border border-[var(--ea-primary,#00857a)]/20 rounded-lg p-4 space-y-2">
    <div className="flex items-start justify-between">
      <h4 className="text-sm font-bold text-[var(--ea-primary,#00857a)]">{abstract.title}</h4>
      <button
        onClick={onClose}
        className="p-1 text-gray-400 hover:text-gray-700 transition min-h-[32px] min-w-[32px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
      {abstract.abstract_text || 'Abstract not available.'}
    </p>
    {abstract.mesh_terms && abstract.mesh_terms.length > 0 && (
      <div className="flex flex-wrap gap-1 pt-1">
        {abstract.mesh_terms.slice(0, 8).map((term, i) => (
          <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
            {term}
          </span>
        ))}
      </div>
    )}
  </div>
);

// =====================================================
// Main Component
// =====================================================

export const PubMedEvidencePanel: React.FC<PubMedEvidencePanelProps> = ({
  condition,
  guidelineOrg,
  collapsed = true,
  maxResults = 5,
}) => {
  useDashboardTheme();
  const [isOpen, setIsOpen] = useState(!collapsed);
  const [hasSearched, setHasSearched] = useState(false);

  const {
    status,
    result,
    error,
    selectedAbstract,
    loadingAbstract,
    searchGuidelineEvidence,
    fetchAbstract,
    reset,
  } = usePubMedEvidence();

  const handleSearch = async () => {
    if (!condition.trim()) return;
    setHasSearched(true);
    await searchGuidelineEvidence(condition, guidelineOrg, maxResults);
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClearAbstract = () => {
    // Reset just clears the abstract selection; use reset() for full clear
    reset();
    setHasSearched(false);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden" aria-label="PubMed Evidence Panel">
      {/* Header (always visible) */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
        )}
        <BookOpen className="w-4 h-4 text-[var(--ea-primary,#00857a)] shrink-0" />
        <span className="text-sm font-semibold text-gray-900">Supporting Literature</span>
        {result && (
          <span className="text-xs text-gray-500 ml-auto">
            {result.articles.length} of {result.totalResults} results
          </span>
        )}
      </button>

      {/* Content (collapsible) */}
      {isOpen && (
        <div className="p-4 space-y-4">
          {/* Search Controls */}
          <div className="flex items-center gap-2">
            <div className="flex-1 text-sm text-gray-600">
              Search for: <span className="font-medium text-gray-900">{condition}</span>
              {guidelineOrg && (
                <span className="text-gray-500"> ({guidelineOrg})</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSearch}
              disabled={status === 'searching' || !condition.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[var(--ea-primary,#00857a)] rounded-lg hover:bg-[var(--ea-primary-hover,#006d64)] disabled:bg-[var(--ea-primary,#00857a)]/30 disabled:cursor-not-allowed transition min-h-[44px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            >
              {status === 'searching' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {hasSearched ? 'Search Again' : 'Find Literature'}
            </button>
            {hasSearched && (
              <button
                type="button"
                onClick={handleClearAbstract}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition min-h-[44px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
              >
                Clear
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Abstract Detail View */}
          {selectedAbstract && (
            <AbstractDisplay
              abstract={selectedAbstract}
              onClose={() => reset()}
            />
          )}

          {/* Article List */}
          {result && result.articles.length > 0 && !selectedAbstract && (
            <div className="space-y-3">
              {result.articles.map(article => (
                <ArticleCard
                  key={article.pmid}
                  article={article}
                  onViewAbstract={fetchAbstract}
                  loadingAbstract={loadingAbstract}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {result && result.articles.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No articles found for this search.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PubMedEvidencePanel;
