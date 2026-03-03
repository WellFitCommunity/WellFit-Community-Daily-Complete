/**
 * useScribeDemoMode — Demo simulation sub-hook for SmartScribe
 *
 * Extracted from useSmartScribe.ts to maintain the 600-line file limit.
 * Handles all demo mode simulation: transcript typing, progressive data reveals,
 * and demo recording start/stop.
 *
 * Compass Riley Ambient Learning Session 3 — pre-work decomposition.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import {
  useRef,
  useCallback,
  useEffect,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  DEMO_TRANSCRIPT,
  DEMO_CODES,
  DEMO_SOAP,
  DEMO_SUGGESTIONS,
  DEMO_MESSAGES,
  DEMO_GROUNDING_FLAGS,
  DEMO_ENCOUNTER_STATE,
  DEMO_EVIDENCE_CITATIONS,
  DEMO_GUIDELINE_REFERENCES,
  DEMO_TREATMENT_PATHWAYS,
  DEMO_CONSULTATION_RESPONSE,
  DEMO_CONSULT_PREP,
} from './scribeDemoData';
import type {
  CodeSuggestion,
  SOAPNote,
  ConversationalMessage,
  GroundingFlags,
  EncounterStateSummary,
  EvidenceSearchResultSummary,
  GuidelineMatchSummary,
  TreatmentPathwaySummary,
  ConsultationResponseSummary,
  ConsultPrepSummary,
} from './useSmartScribe.types';

const DEMO_MODE = import.meta.env.VITE_COMPASS_DEMO === 'true';

// ============================================================================
// Types
// ============================================================================

export interface ScribeDemoSetters {
  setTranscript: Dispatch<SetStateAction<string>>;
  setSuggestedCodes: Dispatch<SetStateAction<CodeSuggestion[]>>;
  setSoapNote: Dispatch<SetStateAction<SOAPNote | null>>;
  setConversationalMessages: Dispatch<SetStateAction<ConversationalMessage[]>>;
  setScribeSuggestions: Dispatch<SetStateAction<string[]>>;
  setGroundingFlags: Dispatch<SetStateAction<GroundingFlags | null>>;
  setEncounterState: Dispatch<SetStateAction<EncounterStateSummary | null>>;
  setEvidenceCitations: Dispatch<SetStateAction<EvidenceSearchResultSummary[]>>;
  setGuidelineReferences: Dispatch<SetStateAction<GuidelineMatchSummary[]>>;
  setTreatmentPathways: Dispatch<SetStateAction<TreatmentPathwaySummary[]>>;
  setConsultationResponse: Dispatch<SetStateAction<ConsultationResponseSummary | null>>;
  setConsultPrepSummary: Dispatch<SetStateAction<ConsultPrepSummary | null>>;
  setIsRecording: Dispatch<SetStateAction<boolean>>;
  setRecordingStartTime: Dispatch<SetStateAction<number | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setLastSessionDuration: Dispatch<SetStateAction<number>>;
  setShowFeedbackPrompt: Dispatch<SetStateAction<boolean>>;
  setFeedbackSubmitted: Dispatch<SetStateAction<boolean>>;
  setCorrectionsAppliedCount: Dispatch<SetStateAction<number>>;
}

export interface UseScribeDemoModeConfig {
  forceDemoMode?: boolean;
  scribeMode: string;
  setters: ScribeDemoSetters;
}

export interface UseScribeDemoModeResult {
  isDemoMode: boolean;
  startDemoRecording: () => void;
  stopDemoRecording: () => void;
  cleanupDemo: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useScribeDemoMode({
  forceDemoMode,
  scribeMode,
  setters,
}: UseScribeDemoModeConfig): UseScribeDemoModeResult {
  const isDemoMode = forceDemoMode ?? DEMO_MODE;
  const demoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const demoTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  /** Tracks demo start time internally to compute duration without reading React state. */
  const demoStartTimeRef = useRef<number | null>(null);

  const cleanupDemo = useCallback(() => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    demoTimeoutsRef.current.forEach(t => clearTimeout(t));
    demoTimeoutsRef.current = [];
  }, []);

  const runDemoSimulation = useCallback(() => {
    const words = DEMO_TRANSCRIPT.split(' ');
    let wordIndex = 0;

    setters.setConversationalMessages([{
      type: 'scribe',
      message: DEMO_MESSAGES[0],
      timestamp: new Date(),
      context: 'greeting',
    }]);
    setters.setStatus('Demo Mode - Simulating transcription...');

    demoIntervalRef.current = setInterval(() => {
      if (wordIndex < words.length) {
        const wordsToAdd = words.slice(wordIndex, wordIndex + 3).join(' ');
        setters.setTranscript(prev => prev ? `${prev} ${wordsToAdd}` : wordsToAdd);
        wordIndex += 3;
      } else {
        if (demoIntervalRef.current) {
          clearInterval(demoIntervalRef.current);
          demoIntervalRef.current = null;
        }
      }
    }, 150);

    const schedule = (delayMs: number, fn: () => void) => {
      const timeout = setTimeout(fn, delayMs);
      demoTimeoutsRef.current.push(timeout);
    };

    [3000, 8000, 15000, 22000].forEach((delay, idx) => {
      if (idx > 0 && idx < DEMO_MESSAGES.length) {
        schedule(delay, () => {
          setters.setConversationalMessages(prev => [...prev, {
            type: 'scribe',
            message: DEMO_MESSAGES[idx],
            timestamp: new Date(),
            context: 'suggestion',
          }]);
        });
      }
    });

    [5000, 10000, 14000, 18000, 21000].forEach((delay, idx) => {
      if (idx < DEMO_CODES.length) {
        schedule(delay, () => setters.setSuggestedCodes(prev => [...prev, DEMO_CODES[idx]]));
      }
    });

    schedule(12000, () => setters.setScribeSuggestions(DEMO_SUGGESTIONS));
    schedule(16000, () => setters.setGroundingFlags(DEMO_GROUNDING_FLAGS));
    schedule(20000, () => setters.setEncounterState(DEMO_ENCOUNTER_STATE));
    schedule(23000, () => setters.setEvidenceCitations(DEMO_EVIDENCE_CITATIONS));
    schedule(25000, () => {
      setters.setSoapNote(DEMO_SOAP);
      setters.setStatus('Demo Mode - Documentation complete');
    });
    schedule(27000, () => {
      setters.setGuidelineReferences(DEMO_GUIDELINE_REFERENCES);
      setters.setTreatmentPathways(DEMO_TREATMENT_PATHWAYS);
    });

    if (scribeMode === 'consultation') {
      schedule(29000, () => {
        setters.setConsultationResponse(DEMO_CONSULTATION_RESPONSE);
        setters.setStatus('Demo Mode - Consultation analysis complete');
      });
      schedule(32000, () => setters.setConsultPrepSummary(DEMO_CONSULT_PREP));
    }
  }, [scribeMode, setters]);

  const startDemoRecording = useCallback(() => {
    setters.setTranscript('');
    setters.setSuggestedCodes([]);
    setters.setSoapNote(null);
    setters.setConversationalMessages([]);
    setters.setScribeSuggestions([]);
    setters.setCorrectionsAppliedCount(0);
    setters.setGroundingFlags(null);
    setters.setEncounterState(null);
    setters.setEvidenceCitations([]);
    setters.setGuidelineReferences([]);
    setters.setTreatmentPathways([]);
    setters.setConsultationResponse(null);
    setters.setConsultPrepSummary(null);

    const now = Date.now();
    demoStartTimeRef.current = now;
    setters.setIsRecording(true);
    setters.setRecordingStartTime(now);
    setters.setStatus('Demo Mode - Recording...');
    runDemoSimulation();
  }, [runDemoSimulation, setters]);

  const stopDemoRecording = useCallback(() => {
    cleanupDemo();
    const duration = demoStartTimeRef.current
      ? Math.floor((Date.now() - demoStartTimeRef.current) / 1000)
      : 0;
    demoStartTimeRef.current = null;

    setters.setIsRecording(false);
    setters.setRecordingStartTime(null);
    setters.setStatus('Demo Mode - Session ended');
    setters.setLastSessionDuration(duration);

    // Functional setters — fill in demo data if early stop
    setters.setSuggestedCodes(c => c.length < DEMO_CODES.length ? DEMO_CODES : c);
    setters.setSoapNote(s => s ?? DEMO_SOAP);
    setters.setScribeSuggestions(s => s.length === 0 ? DEMO_SUGGESTIONS : s);
    setters.setGroundingFlags(f => f ?? DEMO_GROUNDING_FLAGS);
    setters.setEncounterState(e => e ?? DEMO_ENCOUNTER_STATE);
    setters.setEvidenceCitations(c => c.length === 0 ? DEMO_EVIDENCE_CITATIONS : c);
    setters.setGuidelineReferences(r => r.length === 0 ? DEMO_GUIDELINE_REFERENCES : r);
    setters.setTreatmentPathways(p => p.length === 0 ? DEMO_TREATMENT_PATHWAYS : p);

    if (scribeMode === 'consultation') {
      setters.setConsultationResponse(r => r ?? DEMO_CONSULTATION_RESPONSE);
      setters.setConsultPrepSummary(s => s ?? DEMO_CONSULT_PREP);
    }

    setters.setShowFeedbackPrompt(true);
    setters.setFeedbackSubmitted(false);
  }, [cleanupDemo, scribeMode, setters]);

  // Clean up demo timers on unmount
  useEffect(() => {
    return () => cleanupDemo();
  }, [cleanupDemo]);

  return { isDemoMode, startDemoRecording, stopDemoRecording, cleanupDemo };
}
