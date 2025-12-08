/**
 * Voice Command Bar
 *
 * A compact, non-intrusive floating command bar for voice navigation.
 * Starts as a small icon, expands when activated.
 *
 * Features:
 * - Small mic icon in minimized state
 * - Expands when listening to show transcript
 * - Real-time command matching and execution
 * - Keyboard shortcut (Ctrl+Shift+V)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, X, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVoiceCommand, VoiceCommandState, VoiceCommandActions } from '../../hooks/useVoiceCommand';
import { getAllVoiceCommands } from '../../services/workflowPreferences';

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
  const [showHelp, setShowHelp] = useState(false);
  const navigate = useNavigate();

  // Use navigate if onNavigate not provided
  const handleNavigate = useCallback((route: string) => {
    if (onNavigate) {
      onNavigate(route);
    } else {
      navigate(route);
    }
  }, [onNavigate, navigate]);

  const [state, actions]: [VoiceCommandState, VoiceCommandActions] = useVoiceCommand({
    onScrollToSection,
    onOpenCategory,
    onNavigate: handleNavigate,
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

  const handleMicClick = useCallback(() => {
    actions.toggleListening();
    if (!state.isListening) {
      actions.clearTranscript();
    }
  }, [actions, state.isListening]);

  if (!state.isSupported) {
    return null; // Don't render if voice is not supported
  }

  return (
    <div className={`fixed bottom-4 right-4 z-40 ${className}`}>
      {/* Help Panel - Only show when actively listening */}
      {showHelp && state.isListening && (
        <div className="absolute bottom-full right-0 mb-2 w-72 max-h-80 overflow-y-auto bg-slate-800 rounded-lg shadow-xl border border-slate-600 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-teal-400" />
              Voice Commands
            </h3>
            <button
              onClick={() => setShowHelp(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            {getAllVoiceCommands().slice(0, 10).map((cmd, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs py-1 border-b border-slate-700 last:border-0"
              >
                <span className="text-teal-300">"{cmd.phrase}"</span>
                <span className="text-slate-400 text-xs">{cmd.displayName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Command Interface - Compact when not listening */}
      <div className={`bg-slate-800 rounded-full shadow-lg border transition-all duration-300 ${
        state.isListening
          ? 'border-teal-500 ring-2 ring-teal-500/30 rounded-xl p-3'
          : 'border-slate-600 p-1'
      }`}>
        {/* Expanded Content - Only when listening */}
        {state.isListening && (
          <div className="mb-3">
            {/* Transcript Display */}
            <div className="min-h-[2.5rem] bg-slate-900 rounded-lg p-2 mb-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-slate-400 text-xs">Listening...</span>
              </div>
              {state.transcript || state.interimTranscript ? (
                <div className="text-sm">
                  <span className="text-white">{state.transcript}</span>
                  <span className="text-slate-400 italic">{state.interimTranscript}</span>
                </div>
              ) : (
                <span className="text-slate-500 text-xs italic">Speak a command...</span>
              )}
            </div>

            {/* Matched Command Feedback */}
            {state.matchedCommand && (
              <div className="bg-teal-500/20 border border-teal-500 rounded-lg p-2 mb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-teal-300 text-xs">Executing:</p>
                    <p className="text-white text-sm font-medium">{state.matchedCommand.displayName}</p>
                  </div>
                  <div className="text-teal-400 text-xs">{state.confidence.toFixed(0)}%</div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {state.error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-2 mb-2">
                <p className="text-red-300 text-xs">{state.error}</p>
              </div>
            )}

            {/* Quick Tips - Healthcare focused (ATLUS: Intuitive Technology) */}
            <div className="flex flex-wrap gap-1">
              {[
                'Shift Handoff',
                'Available Beds',
                'High Risk Patients',
                'NeuroSuite',
                'Care Coordination',
              ].map((tip) => (
                <span key={tip} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">
                  "{tip}"
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center gap-2">
          {/* Microphone Button */}
          <button
            onClick={handleMicClick}
            className={`rounded-full transition-all ${
              state.isListening
                ? 'p-3 bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50'
                : 'p-2 bg-teal-600 text-white hover:bg-teal-500 shadow-md'
            }`}
            title={state.isListening ? 'Stop listening (Esc)' : 'Voice command (Ctrl+Shift+V)'}
          >
            {state.isListening ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Help button - only when listening */}
          {state.isListening && (
            <button
              onClick={() => setShowHelp(!showHelp)}
              className={`p-2 rounded-full transition-colors ${
                showHelp ? 'text-teal-400 bg-teal-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title="Show voice commands"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          )}

          {/* Close button when listening */}
          {state.isListening && (
            <button
              onClick={() => {
                actions.stopListening();
                actions.clearTranscript();
              }}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Compact Voice Button (for embedding in headers/toolbars)
 */
export const VoiceCommandButton: React.FC<{
  onScrollToSection?: (sectionId: string) => void;
  onOpenCategory?: (categoryId: string) => void;
  onNavigate?: (route: string) => void;
  className?: string;
}> = ({ onScrollToSection, onOpenCategory, onNavigate, className = '' }) => {
  const navigate = useNavigate();
  const handleNavigate = useCallback((route: string) => {
    if (onNavigate) {
      onNavigate(route);
    } else {
      navigate(route);
    }
  }, [onNavigate, navigate]);

  const [state, actions] = useVoiceCommand({
    onScrollToSection,
    onOpenCategory,
    onNavigate: handleNavigate,
    autoExecute: true,
  });

  if (!state.isSupported) {
    return null;
  }

  return (
    <button
      onClick={() => actions.toggleListening()}
      className={`p-2 rounded-lg transition-all ${
        state.isListening
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
      } ${className}`}
      title="Voice command (Ctrl+Shift+V)"
    >
      <Mic className="w-5 h-5" />
    </button>
  );
};

export default VoiceCommandBar;
