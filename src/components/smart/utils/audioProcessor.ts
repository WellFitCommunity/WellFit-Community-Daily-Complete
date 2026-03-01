/**
 * Audio Processing Utilities for SmartScribe
 * Handles MediaRecorder setup, WebSocket connections, and audio streaming
 * This module is lazy-loaded only when recording starts to reduce initial bundle size
 */

import { ProviderVoiceProfile, VoiceLearningService } from '../../../services/voiceLearningService';
import { auditLogger } from '../../../services/auditLogger';

// WebSocket response data for code suggestions - matches useSmartScribe.CodeSuggestionResponse
export interface CodeSuggestionResponse {
  type: 'code_suggestion';
  codes?: Array<{
    code: string;
    type: 'CPT' | 'ICD10' | 'HCPCS';
    description: string;
    reimbursement: number;
    confidence: number;
    reasoning?: string;
    missingDocumentation?: string;
  }>;
  revenueIncrease?: number;
  soapNote?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    hpi?: string;
    ros?: string;
  };
  conversational_note?: string;
  suggestions?: string[];
}

/** Evidence citation from PubMed (Session 4: Evidence-Based Reasoning) */
export interface EvidenceCitationDisplay {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year: string;
  doi: string;
  relevanceNote: string;
}

/** Evidence search result sent from edge function */
export interface EvidenceCitationsResponse {
  type: 'evidence_citations';
  results: Array<{
    query: string;
    trigger: string;
    triggerDetail: string;
    citations: EvidenceCitationDisplay[];
    searchTimeMs: number;
  }>;
  display: string[];
}

/** Guideline reference match sent from edge function (Session 5) */
export interface GuidelineReferenceResponse {
  type: 'guideline_references';
  matches: Array<{
    condition: string;
    icd10: string;
    guidelines: Array<{
      organization: string;
      guidelineName: string;
      year: number;
      keyRecommendations: string[];
      monitoringTargets: Array<{ metric: string; target: string; frequency: string }>;
      adherenceChecklist: string[];
    }>;
    adherenceFlags: string[];
    preventiveCareReminders: string[];
  }>;
}

/** Treatment pathway reference sent from edge function (Session 6) */
export interface TreatmentPathwayResponse {
  type: 'treatment_pathways';
  pathways: Array<{
    condition: string;
    icd10: string;
    pathway: {
      condition: string;
      treatmentGoal: string;
      steps: Array<{
        phase: string;
        intervention: string;
        medicationClass?: string;
        examples?: string[];
        evidenceLevel: string;
        guidelineSource: string;
        contraindications: string[];
        sdohNote?: string;
      }>;
      redFlags: string[];
      lifestyleRecommendations: string[];
    };
  }>;
}

/** Consultation response sent from edge function (Session 7) */
export interface ConsultationResponseMessage {
  type: 'consultation_response';
  consultation: Record<string, unknown>;
}

/** Session 8: Peer consult prep response */
export interface ConsultPrepMessage {
  type: 'consult_prep';
  summary: {
    targetSpecialty: string;
    situation: string;
    background: string;
    assessment: string;
    recommendation: string;
    criticalData: string[];
    consultQuestion: string;
    urgency: 'stat' | 'urgent' | 'routine';
  };
}

/** Session 8: Consult prep error */
export interface ConsultPrepErrorMessage {
  type: 'consult_prep_error';
  message: string;
}

/** Session 2 (V2): Reasoning pipeline result (CoT/ToT) */
export interface ReasoningResultMessage {
  type: 'reasoning_result';
  reasoning: {
    modeUsed: string;
    outputZone: string;
    confidenceScore: number;
    reasonCodes: string[];
    explainText: string | null;
    overrideWarning: string | null;
    sensitivity: string;
    branches: Array<{
      hypothesis: string;
      supporting: string[];
      against: string[];
      score: number;
      selected: boolean;
    }> | null;
    convergence: { hypothesis: string; score: number } | null;
    requiresProviderReview: boolean;
  };
}

export interface AudioProcessorConfig {
  wsUrl: string;
  voiceProfile: ProviderVoiceProfile | null;
  /** Provider ID for reinforcing corrections on successful application */
  providerId?: string;
  onTranscript: (text: string, appliedCorrections: number) => void;
  onCodeSuggestion: (data: CodeSuggestionResponse) => void;
  onEvidenceCitations?: (data: EvidenceCitationsResponse) => void;
  onGuidelineReferences?: (data: GuidelineReferenceResponse) => void;
  onTreatmentPathways?: (data: TreatmentPathwayResponse) => void;
  onConsultationResponse?: (data: ConsultationResponseMessage) => void;
  onConsultPrep?: (data: ConsultPrepMessage) => void;
  onConsultPrepError?: (data: ConsultPrepErrorMessage) => void;
  onReasoningResult?: (data: ReasoningResultMessage) => void;
  onReady: () => void;
  onStatusChange: (status: string) => void;
  onRecordingStateChange: (isRecording: boolean) => void;
  onError: (error: Error) => void;
}

export interface AudioProcessorResult {
  mediaRecorder: MediaRecorder;
  webSocket: WebSocket;
  stream: MediaStream;
}

/**
 * Initialize audio recording with real-time transcription
 * @param config Configuration object with callbacks
 * @returns Audio processing resources (MediaRecorder, WebSocket, stream)
 */
export async function initializeAudioRecording(
  config: AudioProcessorConfig
): Promise<AudioProcessorResult> {
  try {
    config.onStatusChange('Requesting microphone access…');

    // Get audio stream from user's microphone
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    config.onStatusChange('Connecting to server…');

    // Create WebSocket connection for real-time transcription
    const ws = new WebSocket(config.wsUrl);

    ws.onopen = () => {
      config.onStatusChange('🔴 Recording in progress…');
      config.onRecordingStateChange(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'transcript' && data.isFinal) {
          let text = data.text;
          let appliedCount = 0;

          // Apply learned voice corrections if voice profile exists
          if (config.voiceProfile) {
            const result = VoiceLearningService.applyCorrections(text, config.voiceProfile);
            text = result.corrected;
            appliedCount = result.appliedCount;

            // Reinforce successfully-applied corrections (fire-and-forget)
            if (config.providerId && result.appliedCorrections.length > 0) {
              for (const correctedText of result.appliedCorrections) {
                VoiceLearningService.reinforceCorrection(config.providerId, correctedText).catch(() => {
                  // Silent fail — reinforcement is enhancement, not critical
                });
              }
            }
          }

          config.onTranscript(text, appliedCount);
        } else if (data.type === 'code_suggestion') {
          config.onCodeSuggestion(data);
        } else if (data.type === 'evidence_citations') {
          config.onEvidenceCitations?.(data);
        } else if (data.type === 'guideline_references') {
          config.onGuidelineReferences?.(data);
        } else if (data.type === 'treatment_pathways') {
          config.onTreatmentPathways?.(data);
        } else if (data.type === 'consultation_response') {
          config.onConsultationResponse?.(data);
        } else if (data.type === 'consult_prep') {
          config.onConsultPrep?.(data);
        } else if (data.type === 'consult_prep_error') {
          config.onConsultPrepError?.(data);
        } else if (data.type === 'reasoning_result') {
          config.onReasoningResult?.(data);
        } else if (data.type === 'ready') {
          config.onReady();
        }
      } catch {
        // Ignore non-JSON frames
      }
    };

    ws.onerror = (err) => {
      // HIPAA Audit: Log transcription connection failures
      auditLogger.error(
        'SCRIBE_WEBSOCKET_ERROR',
        err instanceof Error ? err : new Error('WebSocket connection failed'),
        {
          component: 'audioProcessor',
          wsUrl: config.wsUrl,
        }
      );
      config.onStatusChange('Connection error');
      config.onError(new Error('WebSocket connection error'));
    };

    ws.onclose = () => {
      config.onRecordingStateChange(false);
      config.onStatusChange('Recording stopped');
    };

    // Create MediaRecorder for audio capture
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    mediaRecorder.ondataavailable = async (e) => {
      if (ws.readyState === WebSocket.OPEN && e.data && e.data.size > 0) {
        // Convert Blob to ArrayBuffer for consistent server handling
        const buf = await e.data.arrayBuffer();
        ws.send(buf);
      }
    };

    // Start recording in 250ms chunks
    mediaRecorder.start(250);

    return {
      mediaRecorder,
      webSocket: ws,
      stream,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Failed to start audio recording');

    // HIPAA Audit: Log medical transcription recording failures
    auditLogger.error('SCRIBE_RECORDING_FAILED', err, {
      component: 'audioProcessor',
      operation: 'initializeAudioRecording',
    });

    config.onStatusChange('Error: ' + err.message);
    config.onError(err);

    throw err;
  }
}

/**
 * Stop audio recording and clean up resources
 * @param mediaRecorder MediaRecorder instance to stop
 * @param webSocket WebSocket connection to close
 * @param stream MediaStream to stop
 */
export function stopAudioRecording(
  mediaRecorder: MediaRecorder | null,
  webSocket: WebSocket | null,
  stream?: MediaStream
): void {
  try {
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.stop();
    }

    webSocket?.close();

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  } catch (error: unknown) {
    auditLogger.error(
      'SCRIBE_STOP_RECORDING_ERROR',
      error instanceof Error ? error : new Error('Failed to stop recording'),
      {
        component: 'audioProcessor',
        operation: 'stopAudioRecording',
      }
    );
  }
}
