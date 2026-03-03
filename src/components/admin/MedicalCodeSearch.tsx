/**
 * MedicalCodeSearch — Reusable medical code lookup widget
 *
 * Purpose: Search CPT, ICD-10, HCPCS codes via MCP; auto-check bundling
 *          when 2+ CPT codes are selected.
 * Used by: BillingQueueDashboard, ClaimResubmissionDashboard
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import {
  searchCPTCodes,
  searchICD10Codes,
  searchHCPCSCodes,
  checkCodeBundling,
  type CPTCode,
  type ICD10Code,
  type HCPCSCode,
  type BundlingIssue,
} from '../../services/mcp/mcpMedicalCodesClient';
import { auditLogger } from '../../services/auditLogger';

// =============================================================================
// TYPES
// =============================================================================

export type CodeType = 'cpt' | 'icd10' | 'hcpcs';

export interface MedicalCodeSearchProps {
  onCodeSelect: (code: string, codeType: CodeType, description: string) => void;
  initialCodeType?: CodeType;
  selectedCodes?: string[];
}

type SearchResult = CPTCode | ICD10Code | HCPCSCode;

function getCode(r: SearchResult): string {
  return r.code;
}

function getDescription(r: SearchResult, codeType: CodeType): string {
  if (codeType === 'icd10') return (r as ICD10Code).description;
  return (r as CPTCode | HCPCSCode).short_description;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const TABS: { id: CodeType; label: string }[] = [
  { id: 'cpt', label: 'CPT' },
  { id: 'icd10', label: 'ICD-10' },
  { id: 'hcpcs', label: 'HCPCS' },
];

const DEBOUNCE_MS = 300;

const MedicalCodeSearch: React.FC<MedicalCodeSearchProps> = ({
  onCodeSelect,
  initialCodeType = 'cpt',
  selectedCodes = [],
}) => {
  const [activeTab, setActiveTab] = useState<CodeType>(initialCodeType);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [bundlingIssues, setBundlingIssues] = useState<BundlingIssue[]>([]);
  const [bundlingLoading, setBundlingLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bundling check whenever selectedCodes changes and we have 2+ CPT codes
  const selectedCPT = selectedCodes.filter(c => /^\d{5}$/.test(c));
  const prevCPTRef = useRef<string[]>([]);

  useEffect(() => {
    const prev = prevCPTRef.current.join(',');
    const current = selectedCPT.join(',');
    if (current === prev) return;
    prevCPTRef.current = selectedCPT;

    if (selectedCPT.length < 2) {
      setBundlingIssues([]);
      return;
    }

    setBundlingLoading(true);
    checkCodeBundling(selectedCPT)
      .then(res => {
        setBundlingIssues(res.success && res.data ? res.data : []);
      })
      .catch(async (err: unknown) => {
        await auditLogger.error(
          'BUNDLING_CHECK_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { codes: selectedCPT }
        );
        setBundlingIssues([]);
      })
      .finally(() => setBundlingLoading(false));
  }, [selectedCPT.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = useCallback(async (q: string, tab: CodeType) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setSearchError(null);

    try {
      let res;
      if (tab === 'cpt') res = await searchCPTCodes(q, { limit: 10 });
      else if (tab === 'icd10') res = await searchICD10Codes(q, { limit: 10 });
      else res = await searchHCPCSCodes(q, { limit: 10 });

      if (res.success && res.data) {
        setResults(res.data as SearchResult[]);
      } else {
        setResults([]);
        setSearchError(res.error ?? 'Code search unavailable');
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'MEDICAL_CODE_SEARCH_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { query: q, codeType: tab }
      );
      setResults([]);
      setSearchError('Code search error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(value, activeTab);
    }, DEBOUNCE_MS);
  }, [activeTab, runSearch]);

  const handleTabChange = useCallback((tab: CodeType) => {
    setActiveTab(tab);
    setResults([]);
    setSearchError(null);
    if (query.length >= 2) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        runSearch(query, tab);
      }, DEBOUNCE_MS);
    }
  }, [query, runSearch]);

  const handleSelect = useCallback((r: SearchResult) => {
    onCodeSelect(getCode(r), activeTab, getDescription(r, activeTab));
  }, [activeTab, onCodeSelect]);

  return (
    <div className="border border-gray-200 rounded-lg bg-white" data-testid="medical-code-search">
      {/* Tab Row */}
      <div className="flex border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={`flex-1 py-2 text-sm font-medium transition-colors min-h-[44px] ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder={`Search ${activeTab.toUpperCase()} codes...`}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label={`Search ${activeTab.toUpperCase()} codes`}
            role="searchbox"
          />
          {loading && (
            <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" aria-label="Searching" />
          )}
        </div>

        {/* Error State */}
        {searchError && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600" role="alert">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {searchError}
          </div>
        )}

        {/* Results List */}
        {results.length > 0 && (
          <ul className="mt-2 divide-y divide-gray-100 max-h-48 overflow-y-auto border border-gray-200 rounded-md" role="listbox" aria-label="Code results">
            {results.map(r => {
              const code = getCode(r);
              const desc = getDescription(r, activeTab);
              const isSelected = selectedCodes.includes(code);
              return (
                <li key={code}>
                  <button
                    type="button"
                    onClick={() => handleSelect(r)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-start gap-2 ${isSelected ? 'bg-blue-50' : ''}`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {isSelected && <CheckCircle className="w-3.5 h-3.5 text-blue-600 mt-0.5 flex-shrink-0" />}
                    <span>
                      <span className="font-mono font-medium text-gray-900">{code}</span>
                      {' — '}
                      <span className="text-gray-600">{desc}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Empty results hint */}
        {!loading && query.length >= 2 && results.length === 0 && !searchError && (
          <p className="mt-2 text-xs text-gray-500 text-center py-2">No codes found for "{query}"</p>
        )}
      </div>

      {/* Bundling Warnings */}
      {(bundlingIssues.length > 0 || bundlingLoading) && (
        <div className="border-t border-amber-200 bg-amber-50 px-3 py-2" role="alert" aria-live="polite">
          {bundlingLoading ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-700">
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking bundling rules...
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5" />
                Bundling Warning{bundlingIssues.length !== 1 ? 's' : ''}
              </div>
              {bundlingIssues.map((issue, i) => (
                <div key={i} className="text-xs text-amber-700">
                  <span className="font-mono">{issue.codes.join(' + ')}</span>: {issue.issue}
                  {issue.suggestion && <span className="text-amber-600"> — {issue.suggestion}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MedicalCodeSearch;
