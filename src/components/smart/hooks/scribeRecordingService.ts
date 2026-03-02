/**
 * scribeRecordingService.ts — Recording initialization & session persistence
 *
 * Handles WebSocket/audio setup for real (non-demo) recording sessions
 * and session save to the scribe_sessions database table.
 *
 * Extracted from useSmartScribe.ts for modularity.
 */

import { supabase } from '../../../lib/supabaseClient';
import { auditLogger } from '../../../services/auditLogger';
import type { ProviderVoiceProfile } from '../../../services/voiceLearningService';
import type {
  CodeSuggestion,
  CodeSuggestionResponse,
  ConversationalMessage,
  EncounterStateSummary,
  EvidenceSearchResultSummary,
  GuidelineMatchSummary,
  TreatmentPathwaySummary,
  ConsultationResponseSummary,
  ConsultPrepSummary,
  SOAPNote,
  GroundingFlags,
  ReasoningResultSummary,
} from './useSmartScribe.types';
import type { SOAPEditAnalysis } from '../../../services/soapNoteEditObserver';

// ============================================================================
// Types for callback interface
// ============================================================================

export interface SavePhysicianEditsParams {
  sessionId: string;
  editedNote: SOAPNote;
  editAnalysis: SOAPEditAnalysis;
}

export interface ScribeStateSetters {
  setTranscript: (fn: (prev: string) => string) => void;
  setCorrectionsAppliedCount: (fn: (prev: number) => number) => void;
  setSuggestedCodes: (codes: CodeSuggestion[]) => void;
  setRevenueImpact: (value: number) => void;
  setSoapNote: (note: SOAPNote) => void;
  setConversationalMessages: (fn: (prev: ConversationalMessage[]) => ConversationalMessage[]) => void;
  setScribeSuggestions: (suggestions: string[]) => void;
  setGroundingFlags: (flags: GroundingFlags) => void;
  setEncounterState: (state: EncounterStateSummary) => void;
  setEvidenceCitations: (fn: (prev: EvidenceSearchResultSummary[]) => EvidenceSearchResultSummary[]) => void;
  setGuidelineReferences: (fn: (prev: GuidelineMatchSummary[]) => GuidelineMatchSummary[]) => void;
  setTreatmentPathways: (fn: (prev: TreatmentPathwaySummary[]) => TreatmentPathwaySummary[]) => void;
  setConsultationResponse: (response: ConsultationResponseSummary) => void;
  setConsultPrepSummary: (summary: ConsultPrepSummary) => void;
  setConsultPrepLoading: (loading: boolean) => void;
  setReasoningResult: (result: ReasoningResultSummary) => void;
  setIsRecording: (recording: boolean) => void;
  setRecordingStartTime: (time: number) => void;
  setStatus: (status: string) => void;
}

export interface RecordingResources {
  webSocket: WebSocket;
  mediaRecorder: MediaRecorder;
  stream: MediaStream;
}

// ============================================================================
// Recording Initialization
// ============================================================================

/**
 * Initialize audio recording with WebSocket connection.
 * Returns resources for cleanup.
 */
export async function initializeRecording(
  scribeMode: string,
  voiceProfile: ProviderVoiceProfile | null,
  reasoningMode: string = 'auto',
  setters: ScribeStateSetters,
): Promise<RecordingResources> {
  const { initializeAudioRecording } = await import('../utils/audioProcessor');

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  // Get user ID for voice learning reinforcement
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const base = (import.meta.env.VITE_SUPABASE_URL ?? '').replace('https://', 'wss://');
  const wsUrl = `${base}/functions/v1/realtime_medical_transcription?access_token=${encodeURIComponent(
    session.access_token
  )}&mode=${encodeURIComponent(scribeMode)}&reasoning_mode=${encodeURIComponent(reasoningMode)}`;

  const result = await initializeAudioRecording({
    wsUrl,
    voiceProfile,
    providerId: user?.id,
    onTranscript: (text: string, appliedCorrections: number) => {
      setters.setTranscript(prev => (prev ? `${prev} ${text}` : text));
      if (appliedCorrections > 0) {
        setters.setCorrectionsAppliedCount(prev => prev + appliedCorrections);
      }
    },
    onCodeSuggestion: (data: CodeSuggestionResponse) => {
      setters.setSuggestedCodes(Array.isArray(data.codes) ? data.codes : []);
      setters.setRevenueImpact(Number(data.revenueIncrease || 0));

      if (data.soapNote) {
        setters.setSoapNote({
          subjective: data.soapNote.subjective || '',
          objective: data.soapNote.objective || '',
          assessment: data.soapNote.assessment || '',
          plan: data.soapNote.plan || '',
          hpi: data.soapNote.hpi || '',
          ros: data.soapNote.ros || '',
        });
      }

      if (data.conversational_note) {
        const note = data.conversational_note;
        setters.setConversationalMessages(prev => [
          ...prev,
          {
            type: 'scribe' as const,
            message: note,
            timestamp: new Date(),
            context: 'code' as const,
          },
        ]);
      }

      if (data.suggestions && Array.isArray(data.suggestions)) {
        setters.setScribeSuggestions(data.suggestions);
      }

      if (data.groundingFlags) {
        setters.setGroundingFlags(data.groundingFlags);
      }

      if (data.encounterState) {
        setters.setEncounterState(data.encounterState as EncounterStateSummary);
      }
    },
    onEvidenceCitations: (data: { results: EvidenceSearchResultSummary[] }) => {
      if (data.results && Array.isArray(data.results)) {
        setters.setEvidenceCitations(prev => [...prev, ...data.results]);
      }
    },
    onGuidelineReferences: (data: { matches: GuidelineMatchSummary[] }) => {
      if (data.matches && Array.isArray(data.matches)) {
        setters.setGuidelineReferences(prev => [...prev, ...data.matches]);
      }
    },
    onTreatmentPathways: (data: { pathways: TreatmentPathwaySummary[] }) => {
      if (data.pathways && Array.isArray(data.pathways)) {
        setters.setTreatmentPathways(prev => [...prev, ...data.pathways]);
      }
    },
    onConsultationResponse: (data: { consultation: unknown }) => {
      if (data.consultation) {
        setters.setConsultationResponse(data.consultation as unknown as ConsultationResponseSummary);
      }
    },
    onConsultPrep: (data: { summary: unknown }) => {
      if (data.summary) {
        setters.setConsultPrepSummary(data.summary as unknown as ConsultPrepSummary);
        setters.setConsultPrepLoading(false);
      }
    },
    onConsultPrepError: (data: { message: string }) => {
      setters.setConsultPrepLoading(false);
      auditLogger.warn('SCRIBE_CONSULT_PREP_ERROR', { message: data.message });
    },
    onReasoningResult: (data: { reasoning: ReasoningResultSummary }) => {
      if (data.reasoning) {
        setters.setReasoningResult(data.reasoning);
      }
    },
    onReady: () => {
      setters.setConversationalMessages(() => [
        {
          type: 'scribe',
          message:
            "Hey! I'm Riley, your AI scribe. Listening and ready to help with documentation and billing. Just focus on the patient - I've got the charting.",
          timestamp: new Date(),
          context: 'greeting',
        },
      ]);
    },
    onStatusChange: (newStatus: string) => setters.setStatus(newStatus),
    onRecordingStateChange: (recording: boolean) => {
      setters.setIsRecording(recording);
      if (recording) {
        setters.setRecordingStartTime(Date.now());
      }
    },
    onError: (error: Error) => {
      setters.setStatus('Error: ' + error.message);
    },
  });

  return {
    webSocket: result.webSocket,
    mediaRecorder: result.mediaRecorder,
    stream: result.stream,
  };
}

// ============================================================================
// Session Save
// ============================================================================

export interface SaveSessionParams {
  selectedPatientId: string;
  recordingStartTime: number;
  endTime: number;
  transcript: string;
  soapNote: SOAPNote | null;
  suggestedCodes: CodeSuggestion[];
}

/**
 * Save scribe session to database.
 * Returns the session ID on success, null on failure.
 */
export async function saveScribeSession(params: SaveSessionParams): Promise<string | null> {
  const { selectedPatientId, recordingStartTime, endTime, transcript, soapNote, suggestedCodes } = params;
  const durationSeconds = Math.floor((endTime - recordingStartTime) / 1000);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    auditLogger.error('SCRIBE_SAVE_NO_USER', new Error('No authenticated user'));
    return null;
  }

  const { data: session, error } = await supabase
    .from('scribe_sessions')
    .insert({
      patient_id: selectedPatientId,
      created_by: user.id,
      provider_id: user.id,
      recording_started_at: new Date(recordingStartTime).toISOString(),
      recording_ended_at: new Date(endTime).toISOString(),
      recording_duration_seconds: durationSeconds,
      transcription_text: transcript || '',
      transcription_status: transcript ? 'completed' : 'empty',
      transcription_completed_at: new Date().toISOString(),
      ai_note_subjective: soapNote?.subjective || null,
      ai_note_objective: soapNote?.objective || null,
      ai_note_assessment: soapNote?.assessment || null,
      ai_note_plan: soapNote?.plan || null,
      ai_note_hpi: soapNote?.hpi || null,
      ai_note_ros: soapNote?.ros || null,
      suggested_cpt_codes: suggestedCodes
        .filter(c => c.type === 'CPT')
        .map(c => ({
          code: c.code,
          description: c.description,
          reimbursement: c.reimbursement,
          confidence: c.confidence,
        })),
      suggested_icd10_codes: suggestedCodes
        .filter(c => c.type === 'ICD10')
        .map(c => ({
          code: c.code,
          description: c.description,
          confidence: c.confidence,
        })),
      clinical_time_minutes: Math.floor(durationSeconds / 60),
      is_ccm_eligible: durationSeconds >= 1200,
      ccm_complexity:
        durationSeconds >= 2400 ? 'complex' : durationSeconds >= 1200 ? 'moderate' : null,
    })
    .select()
    .single();

  if (error) {
    auditLogger.error('SCRIBE_SESSION_SAVE_FAILED', error, {
      component: 'scribeRecordingService',
      selectedPatientId,
    });
    return null;
  }

  auditLogger.info('SCRIBE_SESSION_SAVED', {
    sessionId: session.id,
    patientId: selectedPatientId,
    duration: durationSeconds,
  });

  return session.id;
}

// ============================================================================
// Physician Edit Save
// ============================================================================

/**
 * Save physician edits to a scribe session's SOAP note.
 * Persists the edited note and the diff analysis for style profiling.
 */
export async function savePhysicianEdits(params: SavePhysicianEditsParams): Promise<boolean> {
  const { sessionId, editedNote, editAnalysis } = params;

  const { error } = await supabase
    .from('scribe_sessions')
    .update({
      physician_note_subjective: editedNote.subjective || null,
      physician_note_objective: editedNote.objective || null,
      physician_note_assessment: editedNote.assessment || null,
      physician_note_plan: editedNote.plan || null,
      physician_note_hpi: editedNote.hpi || null,
      physician_note_ros: editedNote.ros || null,
      soap_edit_analysis: editAnalysis,
    })
    .eq('id', sessionId);

  if (error) {
    auditLogger.error('SCRIBE_PHYSICIAN_EDITS_SAVE_FAILED', error, {
      component: 'scribeRecordingService',
      sessionId,
    });
    return false;
  }

  auditLogger.info('SCRIBE_PHYSICIAN_EDITS_SAVED', {
    sessionId,
    sectionsModified: editAnalysis.sectionsModified,
  });

  return true;
}
