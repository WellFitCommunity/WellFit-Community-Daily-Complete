/**
 * Voice Command Bar
 *
 * A floating command bar that allows users to navigate the dashboard using voice.
 * Shows real-time transcript and matched commands.
 *
 * Features:
 * - Microphone button to start/stop listening
 * - Real-time transcript display
 * - Command suggestions
 * - Visual feedback for matched commands
 * - Keyboard shortcut support (Ctrl+Shift+V)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, X, ChevronUp, ChevronDown, Volume2, HelpCircle } from 'lucide-react';
import { useVoiceCommand, VoiceCommandState, VoiceCommandActions } from '../../hooks/useVoiceCommand';
import { getAllVoiceCommands, VoiceCommandMapping } from '../../services/workflowPreferences';

interface VoiceCommandBarProps {
  onScrollToSection?: (sectionId: string) => void;
  onOpenCategory?: (categoryId: string) => void;
  onNavigate?: (route: string) => void;
  className?: string;
}

export const VoiceCommandBar: React.FC<VoiceCommandBarProps> = ({
  onScrollToSection,
  onOpenCategory,
  onNavigate,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);

  const [state, actions]: [VoiceCommandState, VoiceCommandActions] = useVoiceCommand({
    onScrollToSection,
    onOpenCategory,
    onNavigate,
    autoExecute: true,
  });

  // Keyboard shortcut: Ctrl+Shift+V to toggle voice
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        actions.toggleListening();
      }
      // Escape to stop listening
      if (e.key === 'Escape' && state.isListening) {
        actions.stopListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions, state.isListening]);

  // Track recent successful commands
  useEffect(() => {
    if (state.matchedCommand) {
      setRecentCommands(prev => {
        const updated = [state.matchedCommand!.displayName, ...prev.filter(c => c !== state.matchedCommand!.displayName)];
        return updated.slice(0, 5);
      });
    }
  }, [state.matchedCommand]);

  // Auto-expand when listening starts
  useEffect(() => {
    if (state.isListening) {
      setIsExpanded(true);
    }
  }, [state.isListening]);

  const handleMicClick = useCallback(() => {
    actions.toggleListening();
    if (!state.isListening) {
      actions.clearTranscript();
    }
  }, [actions, state.isListening]);

  const allCommands = getAllVoiceCommands();

  if (!state.isSupported) {
    return null; // Don't render if voice is not supported
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {/* Help Panel */}
      {showHelp && (
        <div className="absolute bottom-full right-0 mb-2 w-80 max-h-96 overflow-y-auto bg-slate-800 rounded-xl shadow-2xl border border-slate-600 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-teal-400" />
              Voice Commands
            </h3>
            <button
              onClick={() => setShowHelp(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-slate-400 text-sm mb-3">
            Say any of these commands to navigate:
          </p>

          <div className="space-y-2">
            {allCommands.slice(0, 15).map((cmd, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm py-1 border-b border-slate-700 last:border-0"
              >
                <span className="text-teal-300">"{cmd.phrase}"</span>
                <span className="text-slate-400 text-xs">{cmd.displayName}</span>
              </div>
            ))}
            {allCommands.length > 15 && (
              <p className="text-slate-500 text-xs text-center pt-2">
                +{allCommands.length - 15} more commands...
              </p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-600">
            <p className="text-slate-400 text-xs">
              <strong className="text-white">Keyboard shortcut:</strong> Ctrl+Shift+V
            </p>
          </div>
        </div>
      )}

      {/* Main Command Bar */}
      <div className={`bg-slate-800 rounded-xl shadow-2xl border transition-all duration-300 ${
        state.isListening ? 'border-teal-500 ring-2 ring-teal-500/50' : 'border-slate-600'
      }`}>
        {/* Expanded Content */}
        {isExpanded && (
          <div className="p-4 border-b border-slate-700">
            {/* Transcript Display */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${state.isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-slate-400 text-xs uppercase tracking-wider">
                  {state.isListening ? 'Listening...' : 'Say a command'}
                </span>
              </div>

              <div className="min-h-[3rem] bg-slate-900 rounded-lg p-3">
                {state.transcript || state.interimTranscript ? (
                  <div>
                    <span className="text-white">{state.transcript}</span>
                    <span className="text-slate-400 italic">{state.interimTranscript}</span>
                  </div>
                ) : (
                  <span className="text-slate-500 italic">
                    {state.isListening ? 'Speak now...' : 'Click the mic to start'}
                  </span>
                )}
              </div>
            </div>

            {/* Matched Command Feedback */}
            {state.matchedCommand && (
              <div className="bg-teal-500/20 border border-teal-500 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-teal-300 text-sm font-medium">Command recognized!</p>
                    <p className="text-white font-bold">{state.matchedCommand.displayName}</p>
                  </div>
                  <div className="text-teal-400 text-sm">
                    {state.confidence.toFixed(0)}% match
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {state.error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 mb-3">
                <p className="text-red-300 text-sm">{state.error}</p>
              </div>
            )}

            {/* Quick Suggestions */}
            <div className="mb-2">
              <p className="text-slate-400 text-xs mb-2">Try saying:</p>
              <div className="flex flex-wrap gap-2">
                {['Patient List', 'Billing', 'ER Dashboard', 'Bed Board'].map((suggestion) => (
                  <span
                    key={suggestion}
                    className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300"
                  >
                    "{suggestion}"
                  </span>
                ))}
              </div>
            </div>

            {/* Recent Commands */}
            {recentCommands.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs mb-2">Recent:</p>
                <div className="flex flex-wrap gap-2">
                  {recentCommands.map((cmd, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-slate-700/50 rounded text-xs text-slate-400"
                    >
                      {cmd}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center gap-2 p-3">
          {/* Expand/Collapse Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>

          {/* Help Button */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`p-2 rounded-lg transition-colors ${
              showHelp ? 'text-teal-400 bg-teal-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="Show voice commands"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* Microphone Button */}
          <button
            onClick={handleMicClick}
            className={`p-3 rounded-xl transition-all ${
              state.isListening
                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50'
                : 'bg-teal-600 text-white hover:bg-teal-500 shadow-lg shadow-teal-600/50'
            }`}
            title={state.isListening ? 'Stop listening (Esc)' : 'Start voice command (Ctrl+Shift+V)'}
          >
            {state.isListening ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>

          {/* Clear Button (when expanded and has transcript) */}
          {isExpanded && (state.transcript || state.error) && (
            <button
              onClick={actions.clearTranscript}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Clear"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Status Text */}
          {!isExpanded && (
            <span className="text-slate-400 text-sm ml-1">
              {state.isListening ? 'Listening...' : 'Voice'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Compact Voice Button (for headers/toolbars)
 */
export const VoiceCommandButton: React.FC<{
  onScrollToSection?: (sectionId: string) => void;
  onOpenCategory?: (categoryId: string) => void;
  onNavigate?: (route: string) => void;
  className?: string;
}> = ({ onScrollToSection, onOpenCategory, onNavigate, className = '' }) => {
  const [showBar, setShowBar] = useState(false);
  const [state, actions] = useVoiceCommand({
    onScrollToSection,
    onOpenCategory,
    onNavigate,
    autoExecute: true,
  });

  if (!state.isSupported) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => {
          setShowBar(true);
          actions.toggleListening();
        }}
        className={`p-2 rounded-lg transition-all ${
          state.isListening
            ? 'bg-red-500 text-white animate-pulse'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
        } ${className}`}
        title="Voice command (Ctrl+Shift+V)"
      >
        <Mic className="w-5 h-5" />
      </button>

      {showBar && (
        <VoiceCommandBar
          onScrollToSection={onScrollToSection}
          onOpenCategory={onOpenCategory}
          onNavigate={onNavigate}
        />
      )}
    </>
  );
};

export default VoiceCommandBar;
