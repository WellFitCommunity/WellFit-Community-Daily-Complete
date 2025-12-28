/**
 * Voice Search Overlay
 *
 * Displays search results from voice commands with smart entity detection.
 * Shows as a floating overlay when voice search is active.
 *
 * ATLUS: Intuitive Technology - Results at a glance
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useEffect, useCallback } from 'react';
import {
  Search,
  X,
  User,
  BedDouble,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Pill,
  Stethoscope,
  ArrowRightLeft,
  LogIn,
  LogOut,
} from 'lucide-react';
import { useVoiceActionSafe, EntityType } from '../../contexts/VoiceActionContext';

const ENTITY_ICONS: Record<EntityType, React.ReactNode> = {
  patient: <User className="w-5 h-5" />,
  bed: <BedDouble className="w-5 h-5" />,
  room: <BedDouble className="w-5 h-5" />,
  provider: <User className="w-5 h-5" />,
  caregiver: <User className="w-5 h-5" />,
  referral: <User className="w-5 h-5" />,
  alert: <AlertTriangle className="w-5 h-5" />,
  task: <CheckCircle2 className="w-5 h-5" />,
  shift: <Clock className="w-5 h-5" />,
  handoff: <ArrowRightLeft className="w-5 h-5" />,
  medication: <Pill className="w-5 h-5" />,
  diagnosis: <Stethoscope className="w-5 h-5" />,
  admission: <LogIn className="w-5 h-5" />,
  discharge: <LogOut className="w-5 h-5" />,
};

const ENTITY_COLORS: Record<EntityType, string> = {
  patient: 'text-teal-400',
  bed: 'text-blue-400',
  room: 'text-blue-400',
  provider: 'text-purple-400',
  caregiver: 'text-green-400',
  referral: 'text-amber-400',
  alert: 'text-red-400',
  task: 'text-cyan-400',
  shift: 'text-indigo-400',
  handoff: 'text-violet-400',
  medication: 'text-pink-400',
  diagnosis: 'text-orange-400',
  admission: 'text-emerald-400',
  discharge: 'text-rose-400',
};

export const VoiceSearchOverlay: React.FC = () => {
  const voiceAction = useVoiceActionSafe();

  // Keyboard navigation
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [voiceAction?.searchResults]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!voiceAction?.currentAction || !voiceAction.searchResults.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          Math.min(prev + 1, voiceAction.searchResults.length - 1)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (voiceAction.searchResults[selectedIndex]) {
          voiceAction.selectResult(voiceAction.searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        voiceAction.clearAction();
        break;
    }
  }, [voiceAction, selectedIndex]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Don't render if no context or no action
  if (!voiceAction?.currentAction) return null;

  const { currentAction, searchResults, isSearching, selectResult, clearAction } = voiceAction;
  const { entity, status } = currentAction;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={clearAction}
      />

      {/* Overlay Panel */}
      <div className="relative bg-slate-800 rounded-xl shadow-2xl border border-slate-600 w-full max-w-lg mx-4 pointer-events-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-slate-700 ${ENTITY_COLORS[entity.type]}`}>
              {ENTITY_ICONS[entity.type]}
            </div>
            <div>
              <h3 className="text-white font-semibold">
                Searching {entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}s
              </h3>
              <p className="text-slate-400 text-sm">"{entity.rawTranscript}"</p>
            </div>
          </div>
          <button
            onClick={clearAction}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Query Summary */}
        <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-700">
          <div className="flex items-center gap-2 text-sm">
            <Search className="w-4 h-4 text-slate-500" />
            <span className="text-slate-400">Query:</span>
            <span className="text-white font-medium">{entity.query}</span>
            {entity.filters.dateOfBirth && (
              <span className="px-2 py-0.5 bg-slate-700 rounded-sm text-xs text-slate-300">
                DOB: {new Date(entity.filters.dateOfBirth).toLocaleDateString()}
              </span>
            )}
            {entity.filters.mrn && (
              <span className="px-2 py-0.5 bg-slate-700 rounded-sm text-xs text-slate-300">
                MRN: {entity.filters.mrn}
              </span>
            )}
            {entity.filters.roomNumber && (
              <span className="px-2 py-0.5 bg-slate-700 rounded-sm text-xs text-slate-300">
                Room: {entity.filters.roomNumber}
              </span>
            )}
            {entity.filters.riskLevel && (
              <span className={`px-2 py-0.5 rounded text-xs ${
                entity.filters.riskLevel === 'critical'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}>
                {entity.filters.riskLevel.toUpperCase()} RISK
              </span>
            )}
          </div>
        </div>

        {/* Status / Results */}
        <div className="max-h-80 overflow-y-auto">
          {/* Loading State */}
          {(status === 'navigating' || status === 'searching' || isSearching) && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
                <span>
                  {status === 'navigating' ? 'Navigating to dashboard...' : 'Searching...'}
                </span>
              </div>
            </div>
          )}

          {/* Results */}
          {status === 'completed' && searchResults.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </div>
              {searchResults.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => selectResult(result)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    selectedIndex === index
                      ? 'bg-teal-500/20 border-l-2 border-teal-500'
                      : 'hover:bg-slate-700/50 border-l-2 border-transparent'
                  }`}
                >
                  <div className={`p-2 rounded-lg bg-slate-700 ${ENTITY_COLORS[result.type]}`}>
                    {ENTITY_ICONS[result.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium truncate">
                        {result.primaryText}
                      </span>
                      {result.matchScore >= 90 && (
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded-sm text-xs">
                          Best Match
                        </span>
                      )}
                    </div>
                    {result.secondaryText && (
                      <p className="text-sm text-slate-400 truncate">
                        {result.secondaryText}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {result.matchScore}%
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {status === 'completed' && searchResults.length === 0 && !isSearching && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <XCircle className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-slate-400">No matches found for "{entity.query}"</p>
              <p className="text-sm text-slate-500 mt-1">
                Try a different search or check the spelling
              </p>
            </div>
          )}

          {/* Error State */}
          {status === 'failed' && currentAction.error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
              <p className="text-red-400">Search failed</p>
              <p className="text-sm text-slate-500 mt-1">{currentAction.error}</p>
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        {searchResults.length > 0 && (
          <div className="px-4 py-2 bg-slate-900/50 border-t border-slate-700 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-slate-700 rounded-sm">Arrow</kbd>
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
            <span className="text-teal-400">Voice Search</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceSearchOverlay;
