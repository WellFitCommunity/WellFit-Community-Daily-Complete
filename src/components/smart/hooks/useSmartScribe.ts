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
import { useScribePreferences, getAssistanceSettings, computeAutoCalibration } from './useScribePreferences';
import { initializeRecording, saveScribeSession, savePhysicianEdits } from './scribeRecordingService';
import { analyzeSOAPEdits } from '../../../services/soapNoteEditObserver';
import { loadStyleProfile, updateStyleProfile } from '../../../services/physicianStyleProfiler';
import type { PhysicianStyleProfile } from '../../../services/physicianStyleProfiler';
import { useScribeDemoMode } from './useScribeDemoMode';
import { useSessionPatternLearning } from './useSessionPatternLearning';

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

  // Session 3: Auto-calibration hint (derived from style profile, shown once after 10+ sessions)
  const [autoCalibrationHint, setAutoCalibrationHint] = useState<{ suggestedLevel: number; reason: string } | null>(null);
  // Session 3 (3.2): Proactive correction suggestions (phrases Riley may have consistently mishear)
  const [proactiveSuggestions, setProactiveSuggestions] = useState<string[]>([]);
  // Session 3 (3.4): Dictation cadence from the current recording
  const [sessionCadence, setSessionCadence] = useState<{ wpm: number; pattern: 'fast' | 'normal' | 'deliberate' } | null>(null);

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

  // Demo mode sub-hook (decomposed in Ambient Learning Session 3)
  const { isDemoMode, startDemoRecording, stopDemoRecording } = useScribeDemoMode({
    forceDemoMode,
    scribeMode,
    setters: {
      setTranscript, setSuggestedCodes, setSoapNote, setConversationalMessages,
      setScribeSuggestions, setCorrectionsAppliedCount, setGroundingFlags, setEncounterState,
      setEvidenceCitations, setGuidelineReferences, setTreatmentPathways,
      setConsultationResponse, setConsultPrepSummary,
      setIsRecording, setRecordingStartTime, setStatus,
      setLastSessionDuration, setShowFeedbackPrompt, setFeedbackSubmitted,
    },
  });

  // Session 3 (3.3): Session pattern stats for adaptive cadence awareness
  const [currentProviderId, setCurrentProviderId] = useState<string | null>(null);
  const sessionPatternStats = useSessionPatternLearning(currentProviderId);

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

        // Session 3 (3.3): Resolve provider ID for session pattern learning
        setCurrentProviderId(user.id);

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

  /** Session 3 (3.1): Compute auto-calibration hint when style profile updates */
  useEffect(() => {
    if (!styleProfile) return;
    const hint = computeAutoCalibration(
      styleProfile.preferredVerbosity,
      styleProfile.sessionsAnalyzed,
      preferences.assistanceLevel
    );
    setAutoCalibrationHint(hint);
  }, [styleProfile, preferences.assistanceLevel]);

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
        // Session 3 (3.2): Proactive correction suggestion callback
        onProactiveSuggestion: (terms: string[]) => setProactiveSuggestions(terms),
        // Session 3 (3.4): Dictation cadence awareness callback
        onCadenceUpdate: (wpm: number, pattern: 'fast' | 'normal' | 'deliberate') =>
          setSessionCadence({ wpm, pattern }),
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
    // Session 3: Intuitive Adaptation Engine
    autoCalibrationHint,
    proactiveSuggestions,
    sessionCadence,
    sessionPatternStats,

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
