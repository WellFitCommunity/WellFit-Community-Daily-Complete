/**
 * Voice Command Hook
 *
 * Provides speech recognition capabilities for voice-controlled navigation.
 * Uses the Web Speech API (SpeechRecognition) available in modern browsers.
 *
 * Features:
 * - Start/stop voice listening
 * - Real-time transcript display
 * - Command matching and execution
 * - Accessibility support
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { findVoiceCommandMatch, VoiceCommandMapping } from '../services/workflowPreferences';
import { auditLogger } from '../services/auditLogger';
import { parseVoiceEntity, useVoiceActionSafe } from '../contexts/VoiceActionContext';

// TypeScript types for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

// Get SpeechRecognition from window (with vendor prefixes)
const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;

  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    mozSpeechRecognition?: SpeechRecognitionConstructor;
    msSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return (
    win.SpeechRecognition ||
    win.webkitSpeechRecognition ||
    win.mozSpeechRecognition ||
    win.msSpeechRecognition ||
    null
  );
};

export interface VoiceCommandState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  matchedCommand: VoiceCommandMapping | null;
  confidence: number;
}

export interface VoiceCommandActions {
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  clearTranscript: () => void;
  executeCommand: (command: VoiceCommandMapping) => void;
}

export interface UseVoiceCommandOptions {
  onCommandMatched?: (command: VoiceCommandMapping) => void;
  onNavigate?: (route: string) => void;
  onScrollToSection?: (sectionId: string) => void;
  onOpenCategory?: (categoryId: string) => void;
  autoExecute?: boolean; // Auto-execute matched commands
  language?: string; // e.g., 'en-US'
}

export function useVoiceCommand(options: UseVoiceCommandOptions = {}): [VoiceCommandState, VoiceCommandActions] {
  const {
    onCommandMatched,
    onNavigate,
    onScrollToSection,
    onOpenCategory,
    autoExecute = true,
    language = 'en-US',
  } = options;

  const navigate = useNavigate();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Smart entity parsing via VoiceActionContext (ATLUS: Intuitive Technology)
  const voiceAction = useVoiceActionSafe();

  const [state, setState] = useState<VoiceCommandState>({
    isListening: false,
    isSupported: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    matchedCommand: null,
    confidence: 0,
  });

  // Check for browser support on mount
  useEffect(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    setState(prev => ({
      ...prev,
      isSupported: !!SpeechRecognitionClass,
    }));
  }, []);

  // Initialize speech recognition
  const initRecognition = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) return null;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      setState(prev => ({
        ...prev,
        isListening: true,
        error: null,
      }));

      auditLogger.debug('VOICE_COMMAND_STARTED', { language });
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptText = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          finalTranscript += transcriptText;

          // ATLUS: Intuitive Technology - Try smart entity parsing FIRST
          // This enables natural language like "patient Maria LeBlanc birthdate June 10 1976"
          const smartEntity = parseVoiceEntity(transcriptText);

          if (smartEntity && voiceAction) {
            // Smart entity detected - process through VoiceActionContext
            auditLogger.debug('VOICE_SMART_ENTITY_DETECTED', {
              transcript: transcriptText,
              entityType: smartEntity.type,
              query: smartEntity.query,
              confidence: smartEntity.confidence,
            });

            setState(prev => ({
              ...prev,
              transcript: prev.transcript + transcriptText,
              interimTranscript: '',
              matchedCommand: {
                phrases: [transcriptText],
                targetType: 'action',
                targetId: `smart:${smartEntity.type}:${smartEntity.query}`,
                displayName: `Search ${smartEntity.type}: "${smartEntity.query}"`,
              },
              confidence: smartEntity.confidence,
            }));

            // Process through VoiceActionContext (auto-navigate + search)
            voiceAction.processVoiceInput(transcriptText, confidence);

            // Stop listening after smart command
            stopListening();
            return;
          }

          // Fallback: Try to match regular voice command
          const matchedCommand = findVoiceCommandMatch(transcriptText);

          setState(prev => ({
            ...prev,
            transcript: prev.transcript + transcriptText,
            interimTranscript: '',
            matchedCommand,
            confidence: confidence * 100,
          }));

          if (matchedCommand) {
            auditLogger.debug('VOICE_COMMAND_MATCHED', {
              transcript: transcriptText,
              command: matchedCommand.displayName,
              confidence,
            });

            onCommandMatched?.(matchedCommand);

            if (autoExecute) {
              executeCommandInternal(matchedCommand);
            }
          }
        } else {
          interimTranscript += transcriptText;
          setState(prev => ({
            ...prev,
            interimTranscript,
          }));
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = 'Voice recognition error';

      switch (event.error) {
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings.';
          break;
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found. Please connect a microphone.';
          break;
        default:
          errorMessage = `Voice recognition error: ${event.error}`;
      }

      setState(prev => ({
        ...prev,
        isListening: false,
        error: errorMessage,
      }));

      auditLogger.error('VOICE_COMMAND_ERROR', new Error(errorMessage), { error: event.error });
    };

    recognition.onend = () => {
      setState(prev => ({
        ...prev,
        isListening: false,
      }));
    };

    return recognition;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, autoExecute, onCommandMatched, voiceAction]);

  // Execute a matched command
  const executeCommandInternal = useCallback((command: VoiceCommandMapping) => {
    switch (command.targetType) {
      case 'route':
        if (onNavigate) {
          onNavigate(command.targetId);
        } else {
          navigate(command.targetId);
        }
        break;

      case 'section':
        if (onScrollToSection) {
          onScrollToSection(command.targetId);
        } else {
          // Default: scroll to section element
          const element = document.getElementById(command.targetId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Try to expand if it's a collapsible section
            const button = element.querySelector('button');
            if (button) {
              button.click();
            }
          }
        }
        break;

      case 'category':
        if (onOpenCategory) {
          onOpenCategory(command.targetId);
        } else {
          // Default: find category and expand it
          const categoryElement = document.querySelector(`[data-category-id="${command.targetId}"]`);
          if (categoryElement) {
            categoryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const expandButton = categoryElement.querySelector('button');
            if (expandButton) {
              expandButton.click();
            }
          }
        }
        break;

      case 'action':
        // Custom actions handled by callback
        auditLogger.debug('VOICE_COMMAND_ACTION', { action: command.targetId });
        break;
    }

    // Stop listening after command execution
    stopListening();
  }, [navigate, onNavigate, onScrollToSection, onOpenCategory]);

  // Start listening
  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = initRecognition();
    if (!recognition) {
      setState(prev => ({
        ...prev,
        error: 'Voice recognition is not supported in this browser. Try Chrome or Edge.',
      }));
      return;
    }

    recognitionRef.current = recognition;
    recognition.start();

    // Auto-stop after 30 seconds of inactivity
    autoStopTimerRef.current = setTimeout(() => {
      stopListening();
    }, 30000);
  }, [initRecognition]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isListening: false,
    }));
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setState(prev => ({
      ...prev,
      transcript: '',
      interimTranscript: '',
      matchedCommand: null,
      error: null,
    }));
  }, []);

  // Public execute command (for manual execution)
  const executeCommand = useCallback((command: VoiceCommandMapping) => {
    executeCommandInternal(command);
  }, [executeCommandInternal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
      }
    };
  }, []);

  const actions: VoiceCommandActions = {
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    executeCommand,
  };

  return [state, actions];
}

export default useVoiceCommand;
