/**
 * useSmartScribe Custom Hook
 * Business logic for SmartScribe medical transcription system
 * Handles state management, recording session, and database operations
 *
 * DEMO MODE: Set VITE_COMPASS_DEMO=true in .env to enable demo simulation
 *
 * Decomposed into focused modules:
 * - useSmartScribe.types.ts — Type definitions
 * - scribeDemoData.ts — Demo mode data fixtures
 * - useScribePreferences.ts — Assistance level sub-hook
 * - scribeRecordingService.ts — WebSocket init & session save
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { auditLogger } from '../../../services/auditLogger';
import { VoiceLearningService, ProviderVoiceProfile } from '../../../services/voiceLearningService';
import { updateVoiceProfile } from '../../../services/aiTransparencyService';
import { submitScribeFeedback, SessionFeedbackData } from '../../../services/scribeFeedbackService';

// Decomposed modules
import { useScribePreferences, getAssistanceSettings } from './useScribePreferences';
import { initializeRecording, saveScribeSession, savePhysicianEdits } from './scribeRecordingService';
import { analyzeSOAPEdits } from '../../../services/soapNoteEditObserver';
import { loadStyleProfile, updateStyleProfile } from '../../../services/physicianStyleProfiler';
import type { PhysicianStyleProfile } from '../../../services/physicianStyleProfiler';
import {
  DEMO_TRANSCRIPT, DEMO_CODES, DEMO_SOAP, DEMO_SUGGESTIONS, DEMO_MESSAGES,
  DEMO_GROUNDING_FLAGS, DEMO_ENCOUNTER_STATE, DEMO_EVIDENCE_CITATIONS,
  DEMO_GUIDELINE_REFERENCES, DEMO_TREATMENT_PATHWAYS,
  DEMO_CONSULTATION_RESPONSE, DEMO_CONSULT_PREP,
} from './scribeDemoData';

// Re-export all types for consumers (zero-breaking-change barrel)
export type { SessionFeedbackData } from '../../../services/scribeFeedbackService';
export type {
  CodeSuggestion,
  GroundingFlags,
  MDMComplexitySummary,
  CompletenessSummary,
  DiagnosisSummary,
  DriftStateSummary,
  PatientSafetySummary,
  EvidenceCitationSummary,
  EvidenceSearchResultSummary,
  GuidelineMatchSummary,
  TreatmentStepSummary,
  TreatmentPathwaySummary,
  CannotMissDiagnosisSummary,
  ConsultationResponseSummary,
  ConsultPrepSummary,
  EncounterStateSummary,
  ConversationalMessage,
  SOAPNote,
  CodeSuggestionResponse,
  AssistanceSettings,
  UseSmartScribeProps,
  ReasoningResultSummary,
} from './useSmartScribe.types';

import type {
  CodeSuggestion,
  GroundingFlags,
  EncounterStateSummary,
  EvidenceSearchResultSummary,
  GuidelineMatchSummary,
  TreatmentPathwaySummary,
  ConsultationResponseSummary,
  ConsultPrepSummary,
  ConversationalMessage,
  SOAPNote,
  UseSmartScribeProps,
  ReasoningResultSummary,
} from './useSmartScribe.types';

// Check if demo mode is enabled
const DEMO_MODE = import.meta.env.VITE_COMPASS_DEMO === 'true';

// ============================================================================
// HOOK
// ============================================================================

export function useSmartScribe(props: UseSmartScribeProps) {
  const { selectedPatientId, onSessionComplete, forceDemoMode, scribeMode = 'compass-riley', reasoningMode = 'auto' } = props;

  // Core state
  const [transcript, setTranscript] = useState('');
  const [suggestedCodes, setSuggestedCodes] = useState<CodeSuggestion[]>([]);
  const [revenueImpact, setRevenueImpact] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [conversationalMessages, setConversationalMessages] = useState<ConversationalMessage[]>([]);
  const [scribeSuggestions, setScribeSuggestions] = useState<string[]>([]);

  // Timer state
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // SOAP Note state
  const [soapNote, setSoapNote] = useState<SOAPNote | null>(null);

  // Grounding flags from anti-hallucination system
  const [groundingFlags, setGroundingFlags] = useState<GroundingFlags | null>(null);

  // Progressive clinical reasoning: encounter state summary
  const [encounterState, setEncounterState] = useState<EncounterStateSummary | null>(null);

  // Session 4: Evidence citations from PubMed
  const [evidenceCitations, setEvidenceCitations] = useState<EvidenceSearchResultSummary[]>([]);
  // Session 5: Guideline references for active diagnoses
  const [guidelineReferences, setGuidelineReferences] = useState<GuidelineMatchSummary[]>([]);
  // Session 6: Treatment pathway references for active diagnoses
  const [treatmentPathways, setTreatmentPathways] = useState<TreatmentPathwaySummary[]>([]);
  // Session 7: Consultation mode response
  const [consultationResponse, setConsultationResponse] = useState<ConsultationResponseSummary | null>(null);
  // Session 8: Peer consult prep
  const [consultPrepSummary, setConsultPrepSummary] = useState<ConsultPrepSummary | null>(null);
  const [consultPrepLoading, setConsultPrepLoading] = useState(false);
  // Session 2 (V2): Reasoning pipeline result
  const [reasoningResult, setReasoningResult] = useState<ReasoningResultSummary | null>(null);

  // Compose preferences sub-hook
  const preferences = useScribePreferences();

  // Voice learning state
  const [voiceProfile, setVoiceProfile] = useState<ProviderVoiceProfile | null>(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionHeard, setCorrectionHeard] = useState('');
  const [correctionCorrect, setCorrectionCorrect] = useState('');
  const [selectedTextForCorrection, setSelectedTextForCorrection] = useState('');
  const [correctionsAppliedCount, setCorrectionsAppliedCount] = useState(0);

  // Physician style profile (ambient learning Session 2)
  const [styleProfile, setStyleProfile] = useState<PhysicianStyleProfile | null>(null);

  // Session feedback state
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [lastSessionDuration, setLastSessionDuration] = useState<number>(0);

  // Milestone celebration state (from update-voice-profile edge function)
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);

  // Refs for audio resources (will be set by audioProcessor)
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Demo mode state
  const isDemoMode = forceDemoMode ?? DEMO_MODE;
  const demoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const demoTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /** Load voice profile on mount and decay stale corrections */
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const profile = await VoiceLearningService.loadVoiceProfile(user.id);
        setVoiceProfile(profile);

        if (profile && profile.corrections.length > 0) {
          setStatus(`Voice learning active (${profile.corrections.length} corrections learned)`);
        }

        // Load physician style profile (ambient learning Session 2)
        loadStyleProfile(user.id).then(sp => setStyleProfile(sp)).catch(() => {});

        // Decay old corrections on session start (fire-and-forget, idempotent)
        VoiceLearningService.decayOldCorrections(user.id, 60).catch(() => {
          // Silent fail — decay is enhancement, not critical
        });
      } catch (_error: unknown) {
        // Silent fail
      }
    };

    loadProfile();
  }, []);

  /** Timer effect - updates every second during recording */
  useEffect(() => {
    if (!isRecording || !recordingStartTime) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - recordingStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

  // ============================================================================
  // DEMO MODE SIMULATION
  // ============================================================================

  /** Clean up demo mode intervals and timeouts */
  const cleanupDemo = useCallback(() => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    demoTimeoutsRef.current.forEach(t => clearTimeout(t));
    demoTimeoutsRef.current = [];
  }, []);

  /** Run demo simulation with realistic typing and progressive updates */
  const runDemoSimulation = useCallback(() => {
    const words = DEMO_TRANSCRIPT.split(' ');
    let wordIndex = 0;

    setConversationalMessages([{
      type: 'scribe',
      message: DEMO_MESSAGES[0],
      timestamp: new Date(),
      context: 'greeting',
    }]);
    setStatus('Demo Mode - Simulating transcription...');

    // Simulate typing transcript word by word
    demoIntervalRef.current = setInterval(() => {
      if (wordIndex < words.length) {
        const wordsToAdd = words.slice(wordIndex, wordIndex + 3).join(' ');
        setTranscript(prev => prev ? `${prev} ${wordsToAdd}` : wordsToAdd);
        wordIndex += 3;
      } else {
        if (demoIntervalRef.current) {
          clearInterval(demoIntervalRef.current);
          demoIntervalRef.current = null;
        }
      }
    }, 150);

    // Helper to schedule a demo timeout
    const schedule = (delayMs: number, fn: () => void) => {
      const timeout = setTimeout(fn, delayMs);
      demoTimeoutsRef.current.push(timeout);
    };

    // Riley messages progressively
    [3000, 8000, 15000, 22000].forEach((delay, idx) => {
      if (idx > 0 && idx < DEMO_MESSAGES.length) {
        schedule(delay, () => {
          setConversationalMessages(prev => [...prev, {
            type: 'scribe',
            message: DEMO_MESSAGES[idx],
            timestamp: new Date(),
            context: 'suggestion',
          }]);
        });
      }
    });

    // Codes progressively
    [5000, 10000, 14000, 18000, 21000].forEach((delay, idx) => {
      if (idx < DEMO_CODES.length) {
        schedule(delay, () => setSuggestedCodes(prev => [...prev, DEMO_CODES[idx]]));
      }
    });

    // Suggestions, grounding, encounter state, evidence, SOAP, guidelines, pathways
    schedule(12000, () => setScribeSuggestions(DEMO_SUGGESTIONS));
    schedule(16000, () => setGroundingFlags(DEMO_GROUNDING_FLAGS));
    schedule(20000, () => setEncounterState(DEMO_ENCOUNTER_STATE));
    schedule(23000, () => setEvidenceCitations(DEMO_EVIDENCE_CITATIONS));
    schedule(25000, () => { setSoapNote(DEMO_SOAP); setStatus('Demo Mode - Documentation complete'); });
    schedule(27000, () => { setGuidelineReferences(DEMO_GUIDELINE_REFERENCES); setTreatmentPathways(DEMO_TREATMENT_PATHWAYS); });

    // Consultation mode data
    if (scribeMode === 'consultation') {
      schedule(29000, () => { setConsultationResponse(DEMO_CONSULTATION_RESPONSE); setStatus('Demo Mode - Consultation analysis complete'); });
      schedule(32000, () => setConsultPrepSummary(DEMO_CONSULT_PREP));
    }
  }, [scribeMode]);

  /** Start demo mode simulation */
  const startDemoRecording = useCallback(() => {
    setTranscript('');
    setSuggestedCodes([]);
    setSoapNote(null);
    setConversationalMessages([]);
    setScribeSuggestions([]);
    setCorrectionsAppliedCount(0);
    setGroundingFlags(null);
    setEncounterState(null);
    setEvidenceCitations([]);
    setGuidelineReferences([]);
    setTreatmentPathways([]);
    setConsultationResponse(null);
    setConsultPrepSummary(null);

    setIsRecording(true);
    setRecordingStartTime(Date.now());
    setStatus('Demo Mode - Recording...');
    runDemoSimulation();
  }, [runDemoSimulation]);

  /** Stop demo mode simulation */
  const stopDemoRecording = useCallback(() => {
    cleanupDemo();
    const duration = recordingStartTime ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;
    setIsRecording(false);
    setRecordingStartTime(null);
    setStatus('Demo Mode - Session ended');
    setLastSessionDuration(duration);

    // Ensure all demo data is shown when stopping early
    if (suggestedCodes.length < DEMO_CODES.length) setSuggestedCodes(DEMO_CODES);
    if (!soapNote) setSoapNote(DEMO_SOAP);
    if (scribeSuggestions.length === 0) setScribeSuggestions(DEMO_SUGGESTIONS);
    if (!groundingFlags) setGroundingFlags(DEMO_GROUNDING_FLAGS);
    if (!encounterState) setEncounterState(DEMO_ENCOUNTER_STATE);
    if (evidenceCitations.length === 0) setEvidenceCitations(DEMO_EVIDENCE_CITATIONS);
    if (guidelineReferences.length === 0) setGuidelineReferences(DEMO_GUIDELINE_REFERENCES);
    if (treatmentPathways.length === 0) setTreatmentPathways(DEMO_TREATMENT_PATHWAYS);
    if (scribeMode === 'consultation') {
      if (!consultationResponse) setConsultationResponse(DEMO_CONSULTATION_RESPONSE);
      if (!consultPrepSummary) setConsultPrepSummary(DEMO_CONSULT_PREP);
    }

    setShowFeedbackPrompt(true);
    setFeedbackSubmitted(false);
  }, [cleanupDemo, suggestedCodes.length, soapNote, scribeSuggestions.length,
    groundingFlags, encounterState, evidenceCitations.length, guidelineReferences.length,
    treatmentPathways.length, consultationResponse, consultPrepSummary, scribeMode, recordingStartTime]);

  // Cleanup demo on unmount
  useEffect(() => {
    return () => cleanupDemo();
  }, [cleanupDemo]);

  // ============================================================================
  // RECORDING HANDLERS
  // ============================================================================

  /** Start audio recording and transcription */
  const startRecording = async () => {
    if (isDemoMode) {
      startDemoRecording();
      return;
    }

    try {
      const result = await initializeRecording(scribeMode, voiceProfile, reasoningMode, {
        setTranscript,
        setCorrectionsAppliedCount,
        setSuggestedCodes,
        setRevenueImpact,
        setSoapNote,
        setConversationalMessages,
        setScribeSuggestions,
        setGroundingFlags,
        setEncounterState,
        setEvidenceCitations,
        setGuidelineReferences,
        setTreatmentPathways,
        setConsultationResponse,
        setConsultPrepSummary,
        setConsultPrepLoading,
        setReasoningResult,
        setIsRecording,
        setRecordingStartTime: (time: number) => setRecordingStartTime(time),
        setStatus,
      });

      wsRef.current = result.webSocket;
      mediaRecorderRef.current = result.mediaRecorder;
      streamRef.current = result.stream;
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : 'Failed to start';
      setStatus('Error: ' + errMessage);
      auditLogger.error('SCRIBE_START_RECORDING_FAILED', error instanceof Error ? error : new Error(errMessage), {
        component: 'useSmartScribe',
        operation: 'startRecording',
      });
    }
  };

  /** Stop recording and save session to database */
  const stopRecording = async () => {
    if (isDemoMode) {
      stopDemoRecording();
      return;
    }

    try {
      const endTime = Date.now();
      const durationSeconds = recordingStartTime
        ? Math.floor((endTime - recordingStartTime) / 1000)
        : 0;

      const { stopAudioRecording } = await import('../utils/audioProcessor');
      stopAudioRecording(mediaRecorderRef.current, wsRef.current, streamRef.current || undefined);

      if (!selectedPatientId) {
        auditLogger.error('SCRIBE_SAVE_NO_PATIENT', new Error('No patient selected'));
        setStatus('Recording stopped (not saved - no patient selected)');
        setIsRecording(false);
        setRecordingStartTime(null);
        setElapsedSeconds(0);
        return;
      }

      const sessionId = await saveScribeSession({
        selectedPatientId,
        recordingStartTime: recordingStartTime ?? endTime,
        endTime,
        transcript,
        soapNote,
        suggestedCodes,
      });

      if (sessionId) {
        setStatus(`Recording saved! Duration: ${Math.floor(durationSeconds / 60)} min`);
        setLastSessionId(sessionId);
        setLastSessionDuration(durationSeconds);
        if (onSessionComplete) onSessionComplete(sessionId);

        // --- Ambient learning: fire-and-forget post-session updates ---
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const userId = authUser?.id ?? '';

        // 1.2: Update running accuracy average
        const wordCount = transcript.trim().split(/\s+/).length;
        const sessionAccuracy = correctionsAppliedCount > 0 && wordCount > 0
          ? Math.max(0, 1 - (correctionsAppliedCount / wordCount))
          : 1.0;
        VoiceLearningService.updateAccuracy(userId, sessionAccuracy)
          .catch(() => { /* Silent fail */ });

        // 1.1: Update voice profile via edge function (maturity, milestones)
        const learnedTerms = voiceProfile?.corrections
          .map(c => c.correct)
          .slice(-20) ?? [];
        updateVoiceProfile({
          session_duration_seconds: durationSeconds,
          corrections_made: correctionsAppliedCount,
          medical_terms_learned: learnedTerms,
          workflow_interactions: {},
        }).then((result) => {
          // 1.6: Show milestone celebration if any milestones achieved
          if (result.milestones_achieved && result.milestones_achieved.length > 0) {
            const milestoneMessages: Record<string, string> = {
              voice_profile_10_sessions: '🎤 10 Sessions Complete! Riley is learning your voice.',
              voice_profile_50_sessions: '🏆 50 Sessions — Expert Level! Riley knows your voice incredibly well.',
              voice_profile_fully_adapted: '⭐ Fully Adapted! Riley is perfectly tuned to your voice.',
            };
            const firstMilestone = result.milestones_achieved[0];
            setMilestoneToast(milestoneMessages[firstMilestone] ?? `Achievement unlocked: ${firstMilestone}`);
          }
        }).catch(() => { /* Silent fail */ });
      } else {
        setStatus('Recording stopped (save failed)');
      }

      setIsRecording(false);
      setRecordingStartTime(null);
      setElapsedSeconds(0);
      setShowFeedbackPrompt(true);
      setFeedbackSubmitted(false);
    } catch (error: unknown) {
      auditLogger.error(
        'SCRIBE_STOP_RECORDING_ERROR',
        error instanceof Error ? error : new Error('Stop recording error'),
        { component: 'useSmartScribe', operation: 'stopRecording' }
      );
      setStatus('Error stopping recording');
      setIsRecording(false);
    }
  };

  // ============================================================================
  // PHYSICIAN STYLE LEARNING (SOAP EDIT SAVE)
  // ============================================================================

  /** Handle saving physician edits to SOAP note — runs observer, persists, updates style profile */
  const handleSaveEdits = useCallback(async (original: SOAPNote, edited: SOAPNote) => {
    if (!lastSessionId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const editAnalysis = analyzeSOAPEdits(original, edited, lastSessionId, user.id);

    // Persist edited note + diff to scribe_sessions
    await savePhysicianEdits({ sessionId: lastSessionId, editedNote: edited, editAnalysis });

    // Update style profile with EMA (fire-and-forget)
    updateStyleProfile(user.id, editAnalysis)
      .then(updated => { if (updated) setStyleProfile(updated); })
      .catch(() => {});

    auditLogger.info('SCRIBE_SOAP_EDITS_PROCESSED', {
      sessionId: lastSessionId,
      sectionsModified: editAnalysis.sectionsModified,
      verbosityDelta: editAnalysis.overallVerbosityDelta,
    });
  }, [lastSessionId]);

  // ============================================================================
  // FEEDBACK & CONSULT PREP
  // ============================================================================

  /** Handle session feedback submission */
  const handleFeedbackSubmit = useCallback(async (feedback: SessionFeedbackData) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await submitScribeFeedback({
        sessionId: lastSessionId || undefined,
        providerId: user.id,
        rating: feedback.rating as 'positive' | 'negative',
        issues: feedback.issues,
        comment: feedback.comment,
        scribeMode,
        sessionDurationSeconds: lastSessionDuration,
      });

      setFeedbackSubmitted(true);
      setShowFeedbackPrompt(false);
      auditLogger.info('SCRIBE_FEEDBACK_SUBMITTED', { rating: feedback.rating, scribeMode, sessionId: lastSessionId });
    } catch (err: unknown) {
      auditLogger.error('SCRIBE_FEEDBACK_SUBMIT_ERROR', err instanceof Error ? err : new Error(String(err)), { scribeMode });
    }
  }, [lastSessionId, lastSessionDuration, scribeMode]);

  /** Skip feedback prompt */
  const handleFeedbackSkip = useCallback(() => {
    setShowFeedbackPrompt(false);
    auditLogger.info('SCRIBE_FEEDBACK_SKIPPED', { scribeMode });
  }, [scribeMode]);

  /** Session 8: Request peer consult prep via WebSocket */
  const requestConsultPrep = useCallback((specialty: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      auditLogger.warn('SCRIBE_CONSULT_PREP_NO_WS', { specialty });
      return;
    }
    setConsultPrepLoading(true);
    setConsultPrepSummary(null);
    wsRef.current.send(JSON.stringify({ type: 'prepare_consult', specialty }));
    auditLogger.info('SCRIBE_CONSULT_PREP_REQUESTED', { specialty, scribeMode });
  }, [scribeMode]);

  // ============================================================================
  // RETURN VALUES
  // ============================================================================

  return {
    // State
    transcript,
    suggestedCodes,
    revenueImpact,
    isRecording,
    status,
    conversationalMessages,
    scribeSuggestions,
    recordingStartTime,
    elapsedSeconds,
    soapNote,
    assistanceLevel: preferences.assistanceLevel,
    assistanceLevelLoaded: preferences.assistanceLevelLoaded,
    assistanceLevelSaved: preferences.assistanceLevelSaved,
    voiceProfile,
    showCorrectionModal,
    correctionHeard,
    correctionCorrect,
    selectedTextForCorrection,
    correctionsAppliedCount,
    assistanceSettings: preferences.assistanceSettings,
    isDemoMode,
    showFeedbackPrompt,
    feedbackSubmitted,
    scribeMode,
    groundingFlags,
    encounterState,
    evidenceCitations,
    guidelineReferences,
    treatmentPathways,
    consultationResponse,
    consultPrepSummary,
    consultPrepLoading,
    reasoningResult,
    milestoneToast,
    styleProfile,
    lastSessionId,

    // Setters
    setTranscript,
    setSuggestedCodes,
    setShowCorrectionModal,
    setCorrectionHeard,
    setCorrectionCorrect,
    setSelectedTextForCorrection,
    setVoiceProfile,
    setMilestoneToast,

    // Actions
    startRecording,
    stopRecording,
    handleAssistanceLevelChange: preferences.handleAssistanceLevelChange,
    handleFeedbackSubmit,
    handleFeedbackSkip,
    requestConsultPrep,
    handleSaveEdits,

    // Helpers
    getAssistanceSettings,
  };
}
