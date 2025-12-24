/**
 * Global Search Bar
 *
 * Universal search across all entity types - patients, beds, alerts, tasks, etc.
 * Keyboard-accessible alternative to voice search for users who prefer typing.
 *
 * ATLUS: Intuitive Technology - Search anything, find instantly
 *
 * Keyboard Shortcuts:
 * - Ctrl+/ or / (when not in input): Open search
 * - Escape: Close search
 * - Arrow Up/Down: Navigate results
 * - Enter: Select result
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  User,
  BedDouble,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pill,
  Stethoscope,
  ArrowRightLeft,
  LogIn,
  LogOut,
  Command,
  Loader2,
} from 'lucide-react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { parseVoiceEntity, EntityType, ParsedEntity, SearchResult, ENTITY_ROUTES } from '../../contexts/VoiceActionContext';
import { voiceSearch, searchPatients, searchBeds, searchProviders } from '../../services/voiceSearchService';
import { usePatientContext, SelectedPatient } from '../../contexts/PatientContext';
import { auditLogger } from '../../services/auditLogger';

// ============================================================================
// ICONS & COLORS
// ============================================================================

const ENTITY_ICONS: Record<EntityType, React.ReactNode> = {
  patient: <User className="w-4 h-4" />,
  bed: <BedDouble className="w-4 h-4" />,
  room: <BedDouble className="w-4 h-4" />,
  provider: <User className="w-4 h-4" />,
  caregiver: <User className="w-4 h-4" />,
  referral: <User className="w-4 h-4" />,
  alert: <AlertTriangle className="w-4 h-4" />,
  task: <CheckCircle2 className="w-4 h-4" />,
  shift: <Clock className="w-4 h-4" />,
  handoff: <ArrowRightLeft className="w-4 h-4" />,
  medication: <Pill className="w-4 h-4" />,
  diagnosis: <Stethoscope className="w-4 h-4" />,
  admission: <LogIn className="w-4 h-4" />,
  discharge: <LogOut className="w-4 h-4" />,
};

const ENTITY_COLORS: Record<EntityType, string> = {
  patient: 'text-teal-400 bg-teal-400/10',
  bed: 'text-blue-400 bg-blue-400/10',
  room: 'text-blue-400 bg-blue-400/10',
  provider: 'text-purple-400 bg-purple-400/10',
  caregiver: 'text-green-400 bg-green-400/10',
  referral: 'text-amber-400 bg-amber-400/10',
  alert: 'text-red-400 bg-red-400/10',
  task: 'text-cyan-400 bg-cyan-400/10',
  shift: 'text-indigo-400 bg-indigo-400/10',
  handoff: 'text-violet-400 bg-violet-400/10',
  medication: 'text-pink-400 bg-pink-400/10',
  diagnosis: 'text-orange-400 bg-orange-400/10',
  admission: 'text-emerald-400 bg-emerald-400/10',
  discharge: 'text-rose-400 bg-rose-400/10',
};

const ENTITY_LABELS: Record<EntityType, string> = {
  patient: 'Patient',
  bed: 'Bed',
  room: 'Room',
  provider: 'Provider',
  caregiver: 'Caregiver',
  referral: 'Referral',
  alert: 'Alert',
  task: 'Task',
  shift: 'Shift',
  handoff: 'Handoff',
  medication: 'Medication',
  diagnosis: 'Diagnosis',
  admission: 'Admission',
  discharge: 'Discharge',
};

// ============================================================================
// SEARCH EXAMPLES (shown as placeholder hints)
// ============================================================================

const SEARCH_EXAMPLES = [
  'patient John Smith',
  'patients on insulin',
  'CHF patients in ICU',
  'bed 205A',
  'high risk patients',
  'pending alerts',
  'admissions today',
];

// ============================================================================
// COMPONENT
// ============================================================================

export const GlobalSearchBar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [parsedEntity, setParsedEntity] = useState<ParsedEntity | null>(null);
  const [exampleIndex, setExampleIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const supabaseClient = useSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (supabaseClient as any)?.supabase || supabaseClient;
  const { selectPatient } = usePatientContext();

  // Rotate example placeholder
  useEffect(() => {
    const interval = setInterval(() => {
      setExampleIndex((prev) => (prev + 1) % SEARCH_EXAMPLES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open search: Ctrl+/ or / (when not in an input)
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement)?.tagName || ''
      );

      if ((e.ctrlKey && e.key === '/') || (e.key === '/' && !isInputFocused && !isOpen)) {
        e.preventDefault();
        setIsOpen(true);
        return;
      }

      // Only handle these when search is open
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          handleClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleResultSelect(results[selectedIndex]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Scroll selected result into view
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selectedEl = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, results]);

  // ============================================================================
  // SEARCH LOGIC
  // ============================================================================

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || !supabase) {
        setResults([]);
        setParsedEntity(null);
        return;
      }

      setIsSearching(true);

      try {
        // Parse the query to detect entity type
        const entity = parseVoiceEntity(searchQuery);
        setParsedEntity(entity);

        if (!entity) {
          // Default to patient search if no entity detected
          const defaultEntity: ParsedEntity = {
            type: 'patient',
            query: searchQuery,
            filters: { name: searchQuery },
            rawTranscript: searchQuery,
            confidence: 50,
          };
          const patientResults = await searchPatients(supabase, defaultEntity);
          setResults(patientResults);
        } else {
          // Use appropriate search based on entity type
          let searchResults: SearchResult[] = [];

          switch (entity.type) {
            case 'patient':
            case 'medication':
            case 'diagnosis':
            case 'admission':
            case 'discharge':
              searchResults = await searchPatients(supabase, entity);
              break;
            case 'bed':
            case 'room':
              searchResults = await searchBeds(supabase, entity);
              break;
            case 'provider':
              searchResults = await searchProviders(supabase, entity);
              break;
            default:
              searchResults = await voiceSearch(supabase, entity);
          }

          setResults(searchResults);
        }

        auditLogger.debug('GLOBAL_SEARCH_PERFORMED', {
          query: searchQuery,
          entityType: entity?.type || 'patient',
          resultCount: results.length,
        });
      } catch (error) {
        auditLogger.error('GLOBAL_SEARCH_ERROR', error instanceof Error ? error : new Error('Search failed'));
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [supabase]
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // ============================================================================
  // RESULT SELECTION
  // ============================================================================

  const handleResultSelect = useCallback(
    (result: SearchResult) => {
      auditLogger.info('GLOBAL_SEARCH_RESULT_SELECTED', {
        type: result.type,
        id: result.id,
        primaryText: result.primaryText,
      });

      // Update PatientContext for patient-related results
      if (
        ['patient', 'medication', 'diagnosis', 'admission', 'discharge'].includes(result.type) &&
        result.metadata
      ) {
        const patient: SelectedPatient = {
          id: result.id,
          firstName: result.metadata.firstName as string,
          lastName: result.metadata.lastName as string,
          mrn: result.metadata.mrn as string | undefined,
          roomNumber: result.metadata.roomNumber as string | undefined,
          riskLevel: getRiskLevelFromScore(result.metadata.riskScore as number | undefined),
          snapshot: {
            unit: result.metadata.unit as string | undefined,
            primaryDiagnosis: result.metadata.diagnosis as string | undefined,
          },
        };
        selectPatient(patient);
      }

      // Navigate to appropriate dashboard
      const route = ENTITY_ROUTES[result.type];
      if (route) {
        navigate(route);
      }

      // Dispatch event for dashboards to handle
      window.dispatchEvent(
        new CustomEvent('globalSearchResultSelected', { detail: { result } })
      );

      handleClose();
    },
    [navigate, selectPatient]
  );

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    setParsedEntity(null);
    setSelectedIndex(0);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* Search Trigger Button (always visible in header) */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
        title="Search (Ctrl+/)"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden md:flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-slate-700 rounded-sm">
          <Command className="w-3 h-3" />
          <span>/</span>
        </kbd>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={handleClose}
          />

          {/* Search Panel */}
          <div className="relative w-full max-w-2xl mx-4 bg-slate-800 rounded-xl shadow-2xl border border-slate-600 overflow-hidden">
            {/* Search Input */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-700">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Try: "${SEARCH_EXAMPLES[exampleIndex]}"`}
                className="flex-1 bg-transparent text-white placeholder-slate-500 outline-hidden text-lg"
                autoComplete="off"
                spellCheck={false}
              />
              {isSearching && <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />}
              {query && !isSearching && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Parsed Entity Indicator */}
            {parsedEntity && (
              <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-700 flex items-center gap-2 text-sm">
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-sm ${ENTITY_COLORS[parsedEntity.type]}`}>
                  {ENTITY_ICONS[parsedEntity.type]}
                  <span>{ENTITY_LABELS[parsedEntity.type]}</span>
                </span>
                {parsedEntity.filters.name && (
                  <span className="text-slate-400">
                    Name: <span className="text-white">{parsedEntity.filters.name}</span>
                  </span>
                )}
                {parsedEntity.filters.medication && (
                  <span className="text-slate-400">
                    Medication: <span className="text-white">{parsedEntity.filters.medication}</span>
                  </span>
                )}
                {parsedEntity.filters.diagnosis && (
                  <span className="text-slate-400">
                    Diagnosis: <span className="text-white">{parsedEntity.filters.diagnosis}</span>
                  </span>
                )}
                {parsedEntity.filters.unit && (
                  <span className="text-slate-400">
                    Unit: <span className="text-white">{parsedEntity.filters.unit}</span>
                  </span>
                )}
                {parsedEntity.filters.riskLevel && (
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    parsedEntity.filters.riskLevel === 'critical'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {parsedEntity.filters.riskLevel.toUpperCase()} RISK
                  </span>
                )}
              </div>
            )}

            {/* Results */}
            <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto">
              {/* Loading State */}
              {isSearching && query && (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                    <span>Searching...</span>
                  </div>
                </div>
              )}

              {/* Results List */}
              {!isSearching && results.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-1.5 text-xs text-slate-500 uppercase tracking-wider">
                    {results.length} result{results.length !== 1 ? 's' : ''}
                  </div>
                  {results.map((result, index) => (
                    <button
                      key={result.id}
                      data-index={index}
                      onClick={() => handleResultSelect(result)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        selectedIndex === index
                          ? 'bg-teal-500/20 border-l-2 border-teal-500'
                          : 'hover:bg-slate-700/50 border-l-2 border-transparent'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${ENTITY_COLORS[result.type]}`}>
                        {ENTITY_ICONS[result.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium truncate">
                            {result.primaryText}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-sm ${ENTITY_COLORS[result.type]}`}>
                            {ENTITY_LABELS[result.type]}
                          </span>
                          {result.matchScore >= 90 && (
                            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded-sm text-xs">
                              Best
                            </span>
                          )}
                        </div>
                        {result.secondaryText && (
                          <p className="text-sm text-slate-400 truncate">
                            {result.secondaryText}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{result.matchScore}%</div>
                    </button>
                  ))}
                </div>
              )}

              {/* No Results */}
              {!isSearching && query && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="w-12 h-12 text-slate-600 mb-3" />
                  <p className="text-slate-400">No results found for "{query}"</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Try different keywords or check spelling
                  </p>
                </div>
              )}

              {/* Empty State - Search Hints */}
              {!query && (
                <div className="px-4 py-6">
                  <p className="text-sm text-slate-500 mb-4">Try searching for:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: <User className="w-4 h-4" />, text: 'patient John Smith', color: 'text-teal-400' },
                      { icon: <Pill className="w-4 h-4" />, text: 'patients on insulin', color: 'text-pink-400' },
                      { icon: <Stethoscope className="w-4 h-4" />, text: 'CHF patients', color: 'text-orange-400' },
                      { icon: <BedDouble className="w-4 h-4" />, text: 'bed 205A', color: 'text-blue-400' },
                      { icon: <AlertTriangle className="w-4 h-4" />, text: 'pending alerts', color: 'text-red-400' },
                      { icon: <LogIn className="w-4 h-4" />, text: 'admissions today', color: 'text-emerald-400' },
                    ].map((hint, i) => (
                      <button
                        key={i}
                        onClick={() => setQuery(hint.text)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-left"
                      >
                        <span className={hint.color}>{hint.icon}</span>
                        <span>{hint.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-slate-900/50 border-t border-slate-700 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-700 rounded-sm">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-700 rounded-sm">Enter</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-700 rounded-sm">Esc</kbd>
                  Close
                </span>
              </div>
              <span className="text-teal-400">Global Search</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ============================================================================
// HELPERS
// ============================================================================

function getRiskLevelFromScore(score?: number): 'critical' | 'high' | 'medium' | 'low' {
  if (!score) return 'low';
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export default GlobalSearchBar;
