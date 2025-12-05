/**
 * useSmartScribe Custom Hook
 * Business logic for SmartScribe medical transcription system
 * Handles state management, recording session, and database operations
 */

import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { auditLogger } from '../../../services/auditLogger';
import { VoiceLearningService, ProviderVoiceProfile } from '../../../services/voiceLearningService';

// ============================================================================
// TYPES
// ============================================================================

export interface CodeSuggestion {
  code: string;
  type: 'CPT' | 'ICD10' | 'HCPCS';
  description: string;
  reimbursement: number;
  confidence: number;
  reasoning?: string;
  missingDocumentation?: string;
}

export interface ConversationalMessage {
  type: 'scribe' | 'system';
  message: string;
  timestamp: Date;
  context?: 'greeting' | 'suggestion' | 'code' | 'reminder';
}

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  hpi: string;
  ros: string;
}

export interface AssistanceSettings {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  showConversationalMessages: boolean;
  showSuggestions: boolean;
  showReasoningDetails: boolean;
}

export interface UseSmartScribeProps {
  selectedPatientId?: string;
  selectedPatientName?: string;
  onSessionComplete?: (sessionId: string) => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSmartScribe(props: UseSmartScribeProps) {
  const { selectedPatientId, selectedPatientName, onSessionComplete } = props;

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

  // Assistance level state
  const [assistanceLevel, setAssistanceLevel] = useState<number>(5);
  const [assistanceLevelLoaded, setAssistanceLevelLoaded] = useState(false);

  // Voice learning state
  const [voiceProfile, setVoiceProfile] = useState<ProviderVoiceProfile | null>(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionHeard, setCorrectionHeard] = useState('');
  const [correctionCorrect, setCorrectionCorrect] = useState('');
  const [selectedTextForCorrection, setSelectedTextForCorrection] = useState('');
  const [correctionsAppliedCount, setCorrectionsAppliedCount] = useState(0);

  // Refs for audio resources (will be set by audioProcessor)
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Get assistance level settings based on level
   * Simplified to 3 levels matching database schema: concise, balanced, detailed
   */
  const getAssistanceSettings = (level: number): AssistanceSettings => {
    // Concise (levels 1-4) - Maps to 'concise' in database
    if (level <= 4) {
      return {
        label: 'Concise',
        description: 'Codes only, minimal conversation',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-300',
        showConversationalMessages: false,
        showSuggestions: false,
        showReasoningDetails: false,
      };
    }
    // Balanced (levels 5-7) - Maps to 'balanced' in database
    if (level <= 7) {
      return {
        label: 'Balanced',
        description: 'Helpful suggestions and reminders',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-300',
        showConversationalMessages: true,
        showSuggestions: true,
        showReasoningDetails: false,
      };
    }
    // Detailed (levels 8-10) - Maps to 'detailed' in database
    return {
      label: 'Detailed',
      description: 'Full coaching with explanations',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-300',
      showConversationalMessages: true,
      showSuggestions: true,
      showReasoningDetails: true,
    };
  };

  /**
   * Map verbosity text from database to numeric level
   * Database stores: 'concise' | 'balanced' | 'detailed'
   * UI displays: 1-10 scale
   */
  const verbosityToLevel = (verbosity: string): number => {
    switch (verbosity) {
      case 'concise':
        return 3; // Maps to "Low" on UI (levels 3-4)
      case 'balanced':
        return 5; // Maps to "Moderate" on UI (levels 5-6)
      case 'detailed':
        return 8; // Maps to "High" on UI (levels 7-8)
      default:
        return 5; // Default to balanced
    }
  };

  /**
   * Map numeric level to verbosity text for database storage
   * UI levels 1-10 map to database values: 'concise' | 'balanced' | 'detailed'
   */
  const levelToVerbosity = (level: number): string => {
    if (level <= 4) return 'concise';    // Levels 1-4: Minimal/Low -> concise
    if (level <= 7) return 'balanced';   // Levels 5-7: Moderate -> balanced
    return 'detailed';                    // Levels 8-10: High/Maximum -> detailed
  };

  const assistanceSettings = getAssistanceSettings(assistanceLevel);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Track user's tenant_id for preferences storage
  const [userTenantId, setUserTenantId] = useState<string | null>(null);

  /**
   * Load assistance level from provider preferences on mount
   */
  useEffect(() => {
    const loadAssistanceLevel = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's tenant_id from their profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single();

        if (profile?.tenant_id) {
          setUserTenantId(profile.tenant_id);
        }

        const { data: prefs, error } = await supabase
          .from('provider_scribe_preferences')
          .select('verbosity')
          .eq('provider_id', user.id)
          .single();

        if (prefs && !error && prefs.verbosity !== null) {
          setAssistanceLevel(verbosityToLevel(prefs.verbosity));
          setAssistanceLevelLoaded(true);
        } else {
          setAssistanceLevelLoaded(true);
        }
      } catch (error) {
        setAssistanceLevelLoaded(true);
      }
    };

    loadAssistanceLevel();
  }, []);

  /**
   * Load voice profile on mount
   */
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
      } catch (error) {
        // Silent fail
      }
    };

    loadProfile();
  }, []);

  /**
   * Timer effect - updates every second during recording
   */
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
  // RECORDING HANDLERS
  // ============================================================================

  /**
   * Start audio recording and transcription
   * Note: Audio processor is lazy-loaded only when this function is called
   */
  const startRecording = async () => {
    try {
      // Lazy-load audio processor module
      const { initializeAudioRecording } = await import('../utils/audioProcessor');

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      // Build WebSocket URL - use underscore to match edge function folder name
      const base = (process.env.REACT_APP_SUPABASE_URL ?? '').replace('https://', 'wss://');
      const wsUrl = `${base}/functions/v1/realtime_medical_transcription?access_token=${encodeURIComponent(
        session.access_token
      )}`;

      // Initialize audio recording with config
      const result = await initializeAudioRecording({
        wsUrl,
        voiceProfile,
        onTranscript: (text: string, appliedCorrections: number) => {
          setTranscript(prev => (prev ? `${prev} ${text}` : text));
          if (appliedCorrections > 0) {
            setCorrectionsAppliedCount(prev => prev + appliedCorrections);
          }
        },
        onCodeSuggestion: (data: any) => {
          setSuggestedCodes(Array.isArray(data.codes) ? data.codes : []);
          setRevenueImpact(Number(data.revenueIncrease || 0));

          if (data.soapNote) {
            setSoapNote({
              subjective: data.soapNote.subjective || '',
              objective: data.soapNote.objective || '',
              assessment: data.soapNote.assessment || '',
              plan: data.soapNote.plan || '',
              hpi: data.soapNote.hpi || '',
              ros: data.soapNote.ros || '',
            });
          }

          if (data.conversational_note) {
            setConversationalMessages(prev => [
              ...prev,
              {
                type: 'scribe',
                message: data.conversational_note,
                timestamp: new Date(),
                context: 'code',
              },
            ]);
          }

          if (data.suggestions && Array.isArray(data.suggestions)) {
            setScribeSuggestions(data.suggestions);
          }
        },
        onReady: () => {
          setConversationalMessages([
            {
              type: 'scribe',
              message:
                "Hey! I'm Riley, your AI scribe. Listening and ready to help with documentation and billing. Just focus on the patient - I've got the charting.",
              timestamp: new Date(),
              context: 'greeting',
            },
          ]);
        },
        onStatusChange: (newStatus: string) => setStatus(newStatus),
        onRecordingStateChange: (recording: boolean) => {
          setIsRecording(recording);
          if (recording) {
            setRecordingStartTime(Date.now());
          }
        },
        onError: (error: Error) => {
          setStatus('Error: ' + error.message);
        },
      });

      // Store refs for cleanup
      wsRef.current = result.webSocket;
      mediaRecorderRef.current = result.mediaRecorder;
      streamRef.current = result.stream;
    } catch (error: any) {
      setStatus('Error: ' + (error?.message ?? 'Failed to start'));
      auditLogger.error('SCRIBE_START_RECORDING_FAILED', error, {
        component: 'useSmartScribe',
        operation: 'startRecording',
      });
    }
  };

  /**
   * Stop recording and save session to database
   */
  const stopRecording = async () => {
    try {
      const endTime = Date.now();
      const durationSeconds = recordingStartTime
        ? Math.floor((endTime - recordingStartTime) / 1000)
        : 0;

      // Lazy-load audio processor for cleanup
      const { stopAudioRecording } = await import('../utils/audioProcessor');
      stopAudioRecording(mediaRecorderRef.current, wsRef.current, streamRef.current || undefined);

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        auditLogger.error('SCRIBE_SAVE_NO_USER', new Error('No authenticated user'));
        setStatus('Recording stopped (not saved - no user)');
        setIsRecording(false);
        setRecordingStartTime(null);
        setElapsedSeconds(0);
        return;
      }

      // Validate patient context
      if (!selectedPatientId) {
        auditLogger.error('SCRIBE_SAVE_NO_PATIENT', new Error('No patient selected'));
        setStatus('Recording stopped (not saved - no patient selected)');
        setIsRecording(false);
        setRecordingStartTime(null);
        setElapsedSeconds(0);
        return;
      }

      // Save scribe session to database
      const { data: session, error } = await supabase
        .from('scribe_sessions')
        .insert({
          patient_id: selectedPatientId,
          created_by: user.id,
          provider_id: user.id,
          recording_started_at: new Date(recordingStartTime ?? endTime).toISOString(),
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
          component: 'useSmartScribe',
          selectedPatientId,
        });
        setStatus('Recording stopped (save failed)');
      } else {
        auditLogger.info('SCRIBE_SESSION_SAVED', {
          sessionId: session.id,
          patientId: selectedPatientId,
          duration: durationSeconds,
        });
        setStatus(`Recording saved! Duration: ${Math.floor(durationSeconds / 60)} min`);

        if (onSessionComplete && session?.id) {
          onSessionComplete(session.id);
        }
      }

      setIsRecording(false);
      setRecordingStartTime(null);
      setElapsedSeconds(0);
    } catch (error) {
      auditLogger.error(
        'SCRIBE_STOP_RECORDING_ERROR',
        error instanceof Error ? error : new Error('Stop recording error'),
        {
          component: 'useSmartScribe',
          operation: 'stopRecording',
        }
      );
      setStatus('Error stopping recording');
      setIsRecording(false);
    }
  };

  /**
   * Handle assistance level change and save to preferences
   */
  const handleAssistanceLevelChange = async (newLevel: number) => {
    setAssistanceLevel(newLevel);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Need tenant_id for RLS - if we don't have it yet, try to get it
      let tenantId = userTenantId;
      if (!tenantId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single();
        tenantId = profile?.tenant_id || null;
        if (tenantId) setUserTenantId(tenantId);
      }

      if (!tenantId) {
        auditLogger.warn('SCRIBE_ASSISTANCE_LEVEL_NO_TENANT', {
          providerId: user.id,
          newLevel,
        });
        return; // Can't save without tenant_id due to RLS
      }

      const verbosityText = levelToVerbosity(newLevel);

      const { error } = await supabase
        .from('provider_scribe_preferences')
        .upsert(
          {
            provider_id: user.id,
            tenant_id: tenantId,
            verbosity: verbosityText,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'provider_id',
          }
        );

      if (!error) {
        auditLogger.info('SCRIBE_ASSISTANCE_LEVEL_UPDATED', {
          providerId: user.id,
          newLevel,
          verbosityText,
          label: getAssistanceSettings(newLevel).label,
        });
      } else {
        auditLogger.error('SCRIBE_ASSISTANCE_LEVEL_SAVE_FAILED', error, {
          providerId: user.id,
          newLevel,
        });
      }
    } catch (error) {
      auditLogger.error('SCRIBE_ASSISTANCE_LEVEL_ERROR', error instanceof Error ? error : new Error('Unknown error'), {
        newLevel,
      });
    }
  };

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
    assistanceLevel,
    assistanceLevelLoaded,
    voiceProfile,
    showCorrectionModal,
    correctionHeard,
    correctionCorrect,
    selectedTextForCorrection,
    correctionsAppliedCount,
    assistanceSettings,

    // Setters
    setTranscript,
    setSuggestedCodes,
    setShowCorrectionModal,
    setCorrectionHeard,
    setCorrectionCorrect,
    setSelectedTextForCorrection,
    setVoiceProfile,

    // Actions
    startRecording,
    stopRecording,
    handleAssistanceLevelChange,

    // Helpers
    getAssistanceSettings,
  };
}
