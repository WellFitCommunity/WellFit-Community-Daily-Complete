/**
 * useSmartScribe Custom Hook
 * Business logic for SmartScribe medical transcription system
 * Handles state management, recording session, and database operations
 *
 * DEMO MODE: Set VITE_COMPASS_DEMO=true in .env to enable demo simulation
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { auditLogger } from '../../../services/auditLogger';
import { VoiceLearningService, ProviderVoiceProfile } from '../../../services/voiceLearningService';
import { PendingConfirmation } from '../ProactiveCorrection';
import { TranscriptResult } from '../utils/audioProcessor';

// Check if demo mode is enabled
const DEMO_MODE = import.meta.env.VITE_COMPASS_DEMO === 'true';

// ============================================================================
// DEMO DATA
// ============================================================================

const DEMO_TRANSCRIPT = `Good morning Mrs. Johnson. I see you're here for your diabetes follow-up. How have you been feeling since our last visit?

Patient reports feeling generally well but mentions occasional dizziness in the mornings. She's been checking her blood sugar regularly, fasting glucose around 140 to 150. She admits she hasn't been as consistent with her diet over the holidays.

Let me check your vitals. Blood pressure is 138 over 85, pulse 78, temperature 98.6. Weight is 185 pounds, which is up 3 pounds from last visit.

Looking at your labs from last week, your A1C is 7.8, up from 7.2 three months ago. Kidney function looks stable, eGFR 72. Lipid panel shows LDL at 118.

Based on today's visit, I think we need to adjust your Metformin. I'd like to increase it from 500 twice daily to 850 twice daily. Let's also add a morning blood pressure check routine. I want you to keep a log and bring it to your next visit.

We'll schedule a follow-up in 6 weeks. In the meantime, I'd like you to meet with our nutritionist to review your diet plan. Any questions?`;

const DEMO_CODES: Array<{
  code: string;
  type: 'CPT' | 'ICD10' | 'HCPCS';
  description: string;
  reimbursement: number;
  confidence: number;
  reasoning?: string;
  missingDocumentation?: string;
}> = [
  {
    code: '99214',
    type: 'CPT',
    description: 'Office visit, established patient, moderate complexity (30-39 min)',
    reimbursement: 164.00,
    confidence: 0.94,
    reasoning: 'Moderate complexity MDM with chronic condition management, medication adjustment, and coordination of care',
    missingDocumentation: 'Consider documenting time spent if >50% on counseling'
  },
  {
    code: 'E11.65',
    type: 'ICD10',
    description: 'Type 2 diabetes mellitus with hyperglycemia',
    reimbursement: 0,
    confidence: 0.96,
    reasoning: 'A1C 7.8% indicates poor glycemic control, fasting glucose 140-150 mg/dL'
  },
  {
    code: 'I10',
    type: 'ICD10',
    description: 'Essential (primary) hypertension',
    reimbursement: 0,
    confidence: 0.88,
    reasoning: 'BP 138/85 indicates elevated blood pressure requiring monitoring'
  },
  {
    code: 'R42',
    type: 'ICD10',
    description: 'Dizziness and giddiness',
    reimbursement: 0,
    confidence: 0.82,
    reasoning: 'Patient reports morning dizziness, possibly related to BP or glucose'
  },
  {
    code: 'Z71.3',
    type: 'ICD10',
    description: 'Dietary counseling and surveillance',
    reimbursement: 0,
    confidence: 0.90,
    reasoning: 'Nutritionist referral for diet plan review'
  }
];

const DEMO_SOAP = {
  subjective: 'Patient presents for diabetes follow-up. Reports feeling generally well with occasional morning dizziness. Self-monitoring blood glucose shows fasting levels 140-150 mg/dL. Admits to dietary non-compliance over holidays. No polyuria, polydipsia, or vision changes.',
  objective: 'Vitals: BP 138/85, HR 78, Temp 98.6°F, Weight 185 lbs (+3 lbs from last visit). Labs: A1C 7.8% (up from 7.2%), eGFR 72 (stable), LDL 118 mg/dL. Patient appears well-nourished, no acute distress.',
  assessment: '1. Type 2 diabetes mellitus with hyperglycemia (E11.65) - suboptimally controlled, A1C worsening\n2. Essential hypertension (I10) - borderline elevated today\n3. Dizziness (R42) - likely related to glycemic variability',
  plan: '1. Increase Metformin from 500mg BID to 850mg BID\n2. Home BP monitoring - log readings for next visit\n3. Refer to nutritionist for dietary counseling\n4. Follow-up in 6 weeks with A1C recheck\n5. Continue current statin therapy',
  hpi: 'Mrs. Johnson is a 62-year-old female with established type 2 diabetes presenting for routine follow-up. She reports generally feeling well but describes intermittent morning dizziness over the past month. Home glucose monitoring shows fasting readings consistently between 140-150 mg/dL. She acknowledges dietary indiscretion during the holiday season. Denies hypoglycemic episodes, chest pain, shortness of breath, or changes in vision. Currently taking Metformin 500mg twice daily and Lisinopril 10mg daily.',
  ros: 'Constitutional: Denies fever, chills, fatigue, unintentional weight loss. Cardiovascular: Denies chest pain, palpitations, leg swelling. Respiratory: Denies cough, shortness of breath. Neurological: Positive for morning dizziness, denies headache, numbness, tingling. Endocrine: Denies polyuria, polydipsia, heat/cold intolerance.'
};

const DEMO_SUGGESTIONS = [
  'Consider documenting patient\'s medication adherence rate',
  'PHQ-2 screening may capture depression comorbidity for Z-code billing',
  'Document diabetic foot exam if performed for quality measure'
];

const DEMO_MESSAGES = [
  "Hey! I'm Riley, your AI scribe. I'll be documenting this visit for you.",
  "I'm picking up on diabetes management discussion. Capturing A1C values and medication changes.",
  "Nice catch on the dizziness - I've added R42 to the assessment.",
  "Looks like a solid 99214 visit. I've captured the medication adjustment and referral."
];

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
  /** Force demo mode regardless of env var. When true, simulates a patient visit. */
  forceDemoMode?: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSmartScribe(props: UseSmartScribeProps) {
  const { selectedPatientId, onSessionComplete, forceDemoMode } = props;

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
  const [assistanceLevelSaved, setAssistanceLevelSaved] = useState(false);

  // Voice learning state
  const [voiceProfile, setVoiceProfile] = useState<ProviderVoiceProfile | null>(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionHeard, setCorrectionHeard] = useState('');
  const [correctionCorrect, setCorrectionCorrect] = useState('');
  const [selectedTextForCorrection, setSelectedTextForCorrection] = useState('');
  const [correctionsAppliedCount, setCorrectionsAppliedCount] = useState(0);

  // Proactive confirmation state - "Did I understand you to say XYZ?"
  const [pendingConfirmations, setPendingConfirmations] = useState<PendingConfirmation[]>([]);
  const confirmationIdCounter = useRef(0);

  // Queue of uncertain words from transcription that need verification
  const uncertainWordsQueue = useRef<Array<{ word: string; confidence: number }>>([]);

  // Refs for audio resources (will be set by audioProcessor)
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Demo mode state - can be forced via props or enabled via env var
  // Use a ref to track the actual demo mode state that updates with props
  const isDemoMode = forceDemoMode ?? DEMO_MODE;
  const demoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const demoTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

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
  // PROACTIVE CONFIRMATION HELPERS
  // ============================================================================

  /**
   * Medical terms and patterns that often get misheard and should trigger confirmation.
   * These are terms where transcription errors can have clinical impact.
   */
  const UNCERTAIN_PATTERNS = [
    // Common transcription confusions with clinical significance
    /\bhyper\s*glycemia\b/i,
    /\bhypo\s*glycemia\b/i,
    /\bhyper\s*tension\b/i,
    /\bhypo\s*tension\b/i,
    /\bbrady\s*cardia\b/i,
    /\btachy\s*cardia\b/i,
    /\bdys\s*pnea\b/i,
    /\bapnea\b/i,
    // Drug names that sound similar
    /\bmetformin\b/i,
    /\bmetoprolol\b/i,
    /\blomustine\b/i,
    /\bcarmustine\b/i,
    /\bprednisone\b/i,
    /\bprednisolone\b/i,
    // Numbers that matter (dosages, vitals)
    /\b\d{2,3}\s*(over|\/)\s*\d{2,3}\b/, // Blood pressure
    /\b\d+\s*(mg|mcg|ml|units?)\b/i, // Dosages
    // Unusual words that might be misheard
    /\b[a-z]{10,}\b/i, // Long words are often misheard
  ];

  /**
   * Check if a transcript segment contains patterns that warrant confirmation
   */
  const shouldTriggerConfirmation = useCallback((text: string): string | null => {
    // Skip if text is too short
    if (text.length < 5) return null;

    // Check for uncertain patterns
    for (const pattern of UNCERTAIN_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    // Check for words we've corrected before (known problem areas)
    if (voiceProfile?.corrections) {
      for (const correction of voiceProfile.corrections) {
        if (text.toLowerCase().includes(correction.heard.toLowerCase())) {
          // We've seen this error before - proactively ask
          return correction.heard;
        }
      }
    }

    return null;
  }, [voiceProfile]);

  /**
   * Add a pending confirmation for user review
   */
  const addPendingConfirmation = useCallback((heardText: string, context?: string) => {
    const id = `confirm-${Date.now()}-${confirmationIdCounter.current++}`;
    const newConfirmation: PendingConfirmation = {
      id,
      heardText,
      timestamp: new Date(),
      confidence: 0.7, // Could be enhanced with actual confidence from transcription service
      context,
    };

    setPendingConfirmations(prev => [...prev, newConfirmation]);

    auditLogger.info('PROACTIVE_CONFIRMATION_TRIGGERED', {
      id,
      heardText,
      context,
    });
  }, []);

  /**
   * Handle user confirming the transcription is correct
   */
  const handleConfirmCorrect = useCallback(async (id: string) => {
    const confirmation = pendingConfirmations.find(c => c.id === id);
    if (!confirmation) return;

    // Remove from pending list
    setPendingConfirmations(prev => prev.filter(c => c.id !== id));

    // If we had a previous correction for this that the user is now saying is correct,
    // we might want to reduce confidence of that correction
    if (voiceProfile) {
      const existingCorrection = voiceProfile.corrections.find(
        c => c.correct.toLowerCase() === confirmation.heardText.toLowerCase()
      );
      if (existingCorrection) {
        // Reinforce that this transcription is correct
        await VoiceLearningService.reinforceCorrection(voiceProfile.providerId, confirmation.heardText);
      }
    }

    auditLogger.info('PROACTIVE_CONFIRMATION_ACCEPTED', {
      id,
      heardText: confirmation.heardText,
    });
  }, [pendingConfirmations, voiceProfile]);

  /**
   * Handle user providing a correction
   */
  const handleProactiveCorrection = useCallback(async (id: string, heardText: string, correctText: string) => {
    const confirmation = pendingConfirmations.find(c => c.id === id);
    if (!confirmation) return;

    // Remove from pending list
    setPendingConfirmations(prev => prev.filter(c => c.id !== id));

    // Get current user to save correction
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Add to voice learning service
      await VoiceLearningService.addCorrection(user.id, heardText, correctText);

      // Reload voice profile to get updated corrections
      const updated = await VoiceLearningService.loadVoiceProfile(user.id);
      setVoiceProfile(updated);

      auditLogger.clinical('PROACTIVE_CORRECTION_LEARNED', true, {
        id,
        heardText,
        correctText,
        providerId: user.id,
      });

      // Update transcript with the correction
      setTranscript(prev => {
        const regex = new RegExp(`\\b${heardText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        return prev.replace(regex, correctText);
      });

      setCorrectionsAppliedCount(prev => prev + 1);
    } catch (err) {
      auditLogger.error('PROACTIVE_CORRECTION_FAILED', err instanceof Error ? err : new Error('Correction failed'), {
        id,
        heardText,
        correctText,
      });
    }
  }, [pendingConfirmations, setVoiceProfile, setTranscript, setCorrectionsAppliedCount]);

  /**
   * Handle dismissing a confirmation (timeout or user action)
   */
  const handleDismissConfirmation = useCallback((id: string) => {
    setPendingConfirmations(prev => prev.filter(c => c.id !== id));

    auditLogger.info('PROACTIVE_CONFIRMATION_DISMISSED', { id });
  }, []);

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
          .maybeSingle();

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
   * Proactive confirmation trigger - process uncertain words from transcription
   * Only triggers when the transcription service reports low confidence,
   * making it genuinely useful rather than spammy.
   */
  useEffect(() => {
    // Only process while recording
    if (!isRecording) {
      uncertainWordsQueue.current = [];
      return;
    }

    // Process uncertain words queue
    const processQueue = () => {
      if (uncertainWordsQueue.current.length === 0) return;

      // Don't spam confirmations - limit to one every 8 seconds
      const recentConfirmation = pendingConfirmations.find(
        c => Date.now() - c.timestamp.getTime() < 8000
      );
      if (recentConfirmation) return;

      // Get the most uncertain word (lowest confidence)
      const sortedByConfidence = [...uncertainWordsQueue.current].sort(
        (a, b) => a.confidence - b.confidence
      );

      // Only show confirmation for words with very low confidence (< 0.6)
      // or words we've seen errors with before
      const mostUncertain = sortedByConfidence[0];
      if (!mostUncertain) return;

      const isKnownProblem = voiceProfile?.corrections.some(
        c => c.heard.toLowerCase().includes(mostUncertain.word.toLowerCase())
      );

      // Trigger if confidence is very low OR it's a known problem area
      if (mostUncertain.confidence < 0.6 || isKnownProblem) {
        // Find context in current transcript
        const transcriptLower = transcript.toLowerCase();
        const wordLower = mostUncertain.word.toLowerCase();
        const wordIndex = transcriptLower.lastIndexOf(wordLower);

        let context: string | undefined;
        if (wordIndex !== -1) {
          const start = Math.max(0, wordIndex - 20);
          const end = Math.min(transcript.length, wordIndex + wordLower.length + 20);
          context = transcript.slice(start, end).trim();
          if (start > 0) context = '...' + context;
          if (end < transcript.length) context = context + '...';
        }

        addPendingConfirmation(mostUncertain.word, context);

        // Remove processed word from queue
        uncertainWordsQueue.current = uncertainWordsQueue.current.filter(
          w => w.word !== mostUncertain.word
        );
      } else {
        // Clear queue if nothing is uncertain enough
        uncertainWordsQueue.current = [];
      }
    };

    // Check queue periodically (every 2 seconds)
    const interval = setInterval(processQueue, 2000);
    return () => clearInterval(interval);
  }, [isRecording, pendingConfirmations, voiceProfile, transcript, addPendingConfirmation]);

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
  // DEMO MODE SIMULATION
  // ============================================================================

  /**
   * Clean up demo mode intervals and timeouts
   */
  const cleanupDemo = useCallback(() => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    demoTimeoutsRef.current.forEach(t => clearTimeout(t));
    demoTimeoutsRef.current = [];
  }, []);

  /**
   * Run demo simulation with realistic typing and progressive updates
   */
  const runDemoSimulation = useCallback(() => {
    const words = DEMO_TRANSCRIPT.split(' ');
    let wordIndex = 0;

    // Set initial greeting
    setConversationalMessages([{
      type: 'scribe',
      message: DEMO_MESSAGES[0],
      timestamp: new Date(),
      context: 'greeting',
    }]);
    setStatus('Demo Mode - Simulating transcription...');

    // Simulate typing transcript word by word (faster for demo)
    demoIntervalRef.current = setInterval(() => {
      if (wordIndex < words.length) {
        const wordsToAdd = words.slice(wordIndex, wordIndex + 3).join(' '); // Add 3 words at a time
        setTranscript(prev => prev ? `${prev} ${wordsToAdd}` : wordsToAdd);
        wordIndex += 3;
      } else {
        // Done with transcript
        if (demoIntervalRef.current) {
          clearInterval(demoIntervalRef.current);
          demoIntervalRef.current = null;
        }
      }
    }, 150); // Every 150ms add 3 words

    // Add Riley messages progressively
    const messageDelays = [3000, 8000, 15000, 22000];
    messageDelays.forEach((delay, idx) => {
      if (idx > 0 && idx < DEMO_MESSAGES.length) {
        const timeout = setTimeout(() => {
          setConversationalMessages(prev => [...prev, {
            type: 'scribe',
            message: DEMO_MESSAGES[idx],
            timestamp: new Date(),
            context: 'suggestion',
          }]);
        }, delay);
        demoTimeoutsRef.current.push(timeout);
      }
    });

    // Add codes progressively
    const codeDelays = [5000, 10000, 14000, 18000, 21000];
    codeDelays.forEach((delay, idx) => {
      if (idx < DEMO_CODES.length) {
        const timeout = setTimeout(() => {
          setSuggestedCodes(prev => [...prev, DEMO_CODES[idx]]);
        }, delay);
        demoTimeoutsRef.current.push(timeout);
      }
    });

    // Demo proactive confirmation at 7 seconds - show "Did I hear correctly?"
    const proactiveConfirmationTimeout = setTimeout(() => {
      addPendingConfirmation('140 to 150', 'fasting glucose around 140 to 150');
    }, 7000);
    demoTimeoutsRef.current.push(proactiveConfirmationTimeout);

    // Add suggestions at 12 seconds
    const suggestionsTimeout = setTimeout(() => {
      setScribeSuggestions(DEMO_SUGGESTIONS);
    }, 12000);
    demoTimeoutsRef.current.push(suggestionsTimeout);

    // Generate SOAP note at 25 seconds
    const soapTimeout = setTimeout(() => {
      setSoapNote(DEMO_SOAP);
      setStatus('Demo Mode - Documentation complete');
    }, 25000);
    demoTimeoutsRef.current.push(soapTimeout);
  }, [addPendingConfirmation]);

  /**
   * Start demo mode simulation
   */
  const startDemoRecording = useCallback(() => {
    // Reset state
    setTranscript('');
    setSuggestedCodes([]);
    setSoapNote(null);
    setConversationalMessages([]);
    setScribeSuggestions([]);
    setCorrectionsAppliedCount(0);

    // Start recording state
    setIsRecording(true);
    setRecordingStartTime(Date.now());
    setStatus('Demo Mode - Recording...');

    // Run simulation
    runDemoSimulation();
  }, [runDemoSimulation]);

  /**
   * Stop demo mode simulation
   */
  const stopDemoRecording = useCallback(() => {
    cleanupDemo();
    setIsRecording(false);
    setRecordingStartTime(null);
    setStatus('Demo Mode - Session ended');

    // Ensure all demo data is shown when stopping early
    if (suggestedCodes.length < DEMO_CODES.length) {
      setSuggestedCodes(DEMO_CODES);
    }
    if (!soapNote) {
      setSoapNote(DEMO_SOAP);
    }
    if (scribeSuggestions.length === 0) {
      setScribeSuggestions(DEMO_SUGGESTIONS);
    }
  }, [cleanupDemo, suggestedCodes.length, soapNote, scribeSuggestions.length]);

  // Cleanup demo on unmount
  useEffect(() => {
    return () => cleanupDemo();
  }, [cleanupDemo]);

  // ============================================================================
  // RECORDING HANDLERS
  // ============================================================================

  /**
   * Start audio recording and transcription
   * Note: Audio processor is lazy-loaded only when this function is called
   * In demo mode, runs simulation instead of real recording
   */
  const startRecording = async () => {
    // Use demo mode if enabled
    if (isDemoMode) {
      startDemoRecording();
      return;
    }

    try {
      // Lazy-load audio processor module
      const { initializeAudioRecording } = await import('../utils/audioProcessor');

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      // Build WebSocket URL - use underscore to match edge function folder name
      const base = (import.meta.env.VITE_SUPABASE_URL ?? '').replace('https://', 'wss://');
      const wsUrl = `${base}/functions/v1/realtime_medical_transcription?access_token=${encodeURIComponent(
        session.access_token
      )}`;

      // Initialize audio recording with config
      const result = await initializeAudioRecording({
        wsUrl,
        voiceProfile,
        onTranscript: (transcriptResult: TranscriptResult) => {
          setTranscript(prev => (prev ? `${prev} ${transcriptResult.text}` : transcriptResult.text));
          if (transcriptResult.appliedCorrections > 0) {
            setCorrectionsAppliedCount(prev => prev + transcriptResult.appliedCorrections);
          }

          // Queue uncertain words for proactive confirmation
          if (transcriptResult.uncertainWords.length > 0) {
            uncertainWordsQueue.current.push(...transcriptResult.uncertainWords);
          }
        },
        onCodeSuggestion: (data: unknown) => {
          const suggestion = data as Record<string, unknown>;
          const codes = suggestion.codes;
          setSuggestedCodes(Array.isArray(codes) ? codes as CodeSuggestion[] : []);
          setRevenueImpact(Number(suggestion.revenueIncrease || 0));

          const soapNote = suggestion.soapNote as Record<string, string> | undefined;
          if (soapNote) {
            setSoapNote({
              subjective: soapNote.subjective || '',
              objective: soapNote.objective || '',
              assessment: soapNote.assessment || '',
              plan: soapNote.plan || '',
              hpi: soapNote.hpi || '',
              ros: soapNote.ros || '',
            });
          }

          if (suggestion.conversational_note) {
            setConversationalMessages(prev => [
              ...prev,
              {
                type: 'scribe',
                message: suggestion.conversational_note as string,
                timestamp: new Date(),
                context: 'code',
              },
            ]);
          }

          const suggestions = suggestion.suggestions;
          if (suggestions && Array.isArray(suggestions)) {
            setScribeSuggestions(suggestions as string[]);
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
    // Use demo mode if enabled
    if (isDemoMode) {
      stopDemoRecording();
      return;
    }

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
    setAssistanceLevelSaved(false); // Clear saved state while saving

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
        setAssistanceLevelSaved(true); // Mark as saved on success
        auditLogger.info('SCRIBE_ASSISTANCE_LEVEL_UPDATED', {
          providerId: user.id,
          newLevel,
          verbosityText,
          label: getAssistanceSettings(newLevel).label,
        });
        // Auto-hide saved indicator after 3 seconds
        setTimeout(() => setAssistanceLevelSaved(false), 3000);
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
    assistanceLevelSaved,
    voiceProfile,
    showCorrectionModal,
    correctionHeard,
    correctionCorrect,
    selectedTextForCorrection,
    correctionsAppliedCount,
    assistanceSettings,
    isDemoMode,

    // Proactive confirmation state - "Did I understand you to say XYZ?"
    pendingConfirmations,

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

    // Proactive confirmation actions
    addPendingConfirmation,
    handleConfirmCorrect,
    handleProactiveCorrection,
    handleDismissConfirmation,

    // Helpers
    getAssistanceSettings,
    shouldTriggerConfirmation,
  };
}
