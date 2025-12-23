// ============================================================================
// Voice Command Service - "Hey Riley" Voice-First Navigation
// ============================================================================
// Purpose: Let doctors/nurses speak commands instead of clicking
// Commands: "Find patient Smith", "Open my schedule", "Start recording", etc.
// Design: Always listening for wake word, then processes command
// ============================================================================

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';

// Command types
export interface VoiceCommand {
  intent: CommandIntent;
  entities: Record<string, string>;
  confidence: number;
  rawText: string;
}

export type CommandIntent =
  | 'navigate'           // Go to a page
  | 'find_patient'       // Search for patient
  | 'start_scribe'       // Start Riley recording
  | 'stop_scribe'        // Stop recording
  | 'open_schedule'      // View schedule
  | 'show_tasks'         // View task list
  | 'check_messages'     // View messages
  | 'help'               // Show help
  | 'unknown';           // Couldn't understand

// Navigation routes
const NAVIGATION_MAP: Record<string, string> = {
  'dashboard': '/',
  'home': '/',
  'schedule': '/schedule',
  'calendar': '/schedule',
  'appointments': '/schedule',
  'patients': '/patients',
  'patient list': '/patients',
  'messages': '/messages',
  'inbox': '/messages',
  'tasks': '/tasks',
  'to do': '/tasks',
  'scribe': '/smart-scribe',
  'riley': '/smart-scribe',
  'recording': '/smart-scribe',
  'settings': '/settings',
  'profile': '/profile',
  'wellness': '/resilience',
  'resilience': '/resilience',
  'check in': '/resilience/checkin',
  'training': '/resilience/modules',
  'peer support': '/resilience/circles',
  'help': '/help',
};

// Command patterns with regex
const COMMAND_PATTERNS: { pattern: RegExp; intent: CommandIntent; entityExtractor?: (match: RegExpMatchArray) => Record<string, string> }[] = [
  // Patient search
  {
    pattern: /(?:find|search|look up|pull up|show me|get)\s+(?:patient\s+)?(.+)/i,
    intent: 'find_patient',
    entityExtractor: (match) => ({ patientQuery: match[1].trim() }),
  },
  // Start scribe
  {
    pattern: /(?:start|begin|activate)\s+(?:recording|scribe|riley|transcription)/i,
    intent: 'start_scribe',
  },
  // Stop scribe
  {
    pattern: /(?:stop|end|finish|pause)\s+(?:recording|scribe|riley|transcription)/i,
    intent: 'stop_scribe',
  },
  // Navigation - explicit
  {
    pattern: /(?:go to|open|show|navigate to|take me to)\s+(?:the\s+)?(.+)/i,
    intent: 'navigate',
    entityExtractor: (match) => ({ destination: match[1].trim().toLowerCase() }),
  },
  // Schedule
  {
    pattern: /(?:what's|show|check)\s+(?:my\s+)?(?:schedule|calendar|appointments)/i,
    intent: 'open_schedule',
  },
  // Tasks
  {
    pattern: /(?:what are|show|check)\s+(?:my\s+)?(?:tasks|to do|todos)/i,
    intent: 'show_tasks',
  },
  // Messages
  {
    pattern: /(?:check|show|any)\s+(?:my\s+)?(?:messages|inbox)/i,
    intent: 'check_messages',
  },
  // Help
  {
    pattern: /(?:help|what can you do|commands)/i,
    intent: 'help',
  },
];

export class VoiceCommandService {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private isAwake: boolean = false;
  private wakeWordTimeout: NodeJS.Timeout | null = null;
  private onCommandCallback: ((cmd: VoiceCommand) => void) | null = null;
  private onStateChangeCallback: ((state: VoiceState) => void) | null = null;
  private onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null = null;

  // Wake words - what activates command mode
  // Named "Vision" to align with Envision branding (Riley is the Smart Scribe)
  private wakeWords = ['hey vision', 'hi vision', 'okay vision', 'vision'];

  constructor() {
    this.initRecognition();
  }

  private initRecognition(): void {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      auditLogger.warn('VOICE_COMMAND_NOT_SUPPORTED', {
        reason: 'SpeechRecognition API not available'
      });
      return;
    }

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript.toLowerCase().trim();
      const isFinal = lastResult.isFinal;

      this.onTranscriptCallback?.(transcript, isFinal);

      if (isFinal) {
        this.processTranscript(transcript, lastResult[0].confidence);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech') {
        auditLogger.error('VOICE_COMMAND_ERROR', new Error(event.error), {
          message: event.message
        });
      }
      // Auto-restart on errors (except aborted)
      if (event.error !== 'aborted' && this.isListening) {
        setTimeout(() => this.recognition?.start(), 100);
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if should be listening
      if (this.isListening) {
        setTimeout(() => this.recognition?.start(), 100);
      }
    };
  }

  // Process spoken text
  private processTranscript(transcript: string, confidence: number): void {
    // Check for wake word if not already awake
    if (!this.isAwake) {
      const hasWakeWord = this.wakeWords.some(w => transcript.includes(w));
      if (hasWakeWord) {
        this.isAwake = true;
        this.onStateChangeCallback?.('awake');

        // Remove wake word from transcript
        let command = transcript;
        for (const wake of this.wakeWords) {
          command = command.replace(wake, '').trim();
        }

        // If there's a command after wake word, process it
        if (command.length > 2) {
          this.parseAndExecuteCommand(command, confidence);
        } else {
          // Wait for command with timeout
          this.wakeWordTimeout = setTimeout(() => {
            this.isAwake = false;
            this.onStateChangeCallback?.('listening');
          }, 10000); // 10 second timeout
        }
        return;
      }
    }

    // If awake, process as command
    if (this.isAwake) {
      if (this.wakeWordTimeout) {
        clearTimeout(this.wakeWordTimeout);
        this.wakeWordTimeout = null;
      }
      this.parseAndExecuteCommand(transcript, confidence);
      this.isAwake = false;
      this.onStateChangeCallback?.('listening');
    }
  }

  // Parse command and determine intent
  private parseAndExecuteCommand(text: string, confidence: number): void {
    const command = this.parseCommand(text, confidence);

    auditLogger.info('VOICE_COMMAND_RECOGNIZED', {
      intent: command.intent,
      entities: command.entities,
      confidence: command.confidence,
      rawText: command.rawText,
    });

    this.onCommandCallback?.(command);
  }

  // Parse text into structured command
  parseCommand(text: string, confidence: number = 1): VoiceCommand {
    const normalized = text.toLowerCase().trim();

    // Try each pattern
    for (const { pattern, intent, entityExtractor } of COMMAND_PATTERNS) {
      const match = normalized.match(pattern);
      if (match) {
        return {
          intent,
          entities: entityExtractor ? entityExtractor(match) : {},
          confidence,
          rawText: text,
        };
      }
    }

    // Check for direct navigation keywords
    for (const [keyword, route] of Object.entries(NAVIGATION_MAP)) {
      if (normalized.includes(keyword)) {
        return {
          intent: 'navigate',
          entities: { destination: keyword, route },
          confidence,
          rawText: text,
        };
      }
    }

    return {
      intent: 'unknown',
      entities: {},
      confidence,
      rawText: text,
    };
  }

  // Get route for navigation intent
  getNavigationRoute(destination: string): string | null {
    const normalized = destination.toLowerCase().trim();
    return NAVIGATION_MAP[normalized] || null;
  }

  // Search for patient by voice query
  async searchPatient(query: string): Promise<{ id: string; name: string; mrn?: string }[]> {
    try {
      // Search by name (first or last)
      const { data, error } = await supabase
        .from('fhir_patients')
        .select('id, name_given, name_family, identifier')
        .or(`name_given.ilike.%${query}%,name_family.ilike.%${query}%`)
        .limit(5);

      if (error) throw error;

      return (data || []).map(p => ({
        id: p.id,
        name: `${p.name_given?.[0] || ''} ${p.name_family || ''}`.trim(),
        mrn: p.identifier?.[0]?.value,
      }));
    } catch (error) {
      auditLogger.error('VOICE_PATIENT_SEARCH_FAILED', error instanceof Error ? error : new Error('Search failed'));
      return [];
    }
  }

  // Start listening
  start(): boolean {
    if (!this.recognition) {
      return false;
    }

    try {
      this.recognition.start();
      this.isListening = true;
      this.onStateChangeCallback?.('listening');
      auditLogger.info('VOICE_COMMAND_STARTED', {});
      return true;
    } catch (error) {
      auditLogger.error('VOICE_COMMAND_START_FAILED', error instanceof Error ? error : new Error('Start failed'));
      return false;
    }
  }

  // Stop listening
  stop(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.isListening = false;
      this.isAwake = false;
      this.onStateChangeCallback?.('idle');
      auditLogger.info('VOICE_COMMAND_STOPPED', {});
    }
  }

  // Check if supported
  isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  // Set callbacks
  onCommand(callback: (cmd: VoiceCommand) => void): void {
    this.onCommandCallback = callback;
  }

  onStateChange(callback: (state: VoiceState) => void): void {
    this.onStateChangeCallback = callback;
  }

  onTranscript(callback: (text: string, isFinal: boolean) => void): void {
    this.onTranscriptCallback = callback;
  }

  // Get available commands for help
  getAvailableCommands(): { category: string; examples: string[] }[] {
    return [
      {
        category: 'Patient Search',
        examples: [
          '"Find patient Smith"',
          '"Pull up Johnson"',
          '"Search for Maria Garcia"',
        ],
      },
      {
        category: 'Navigation',
        examples: [
          '"Go to dashboard"',
          '"Open my schedule"',
          '"Show messages"',
          '"Take me to settings"',
        ],
      },
      {
        category: 'Scribe Control',
        examples: [
          '"Start recording"',
          '"Stop scribe"',
          '"Begin transcription"',
        ],
      },
      {
        category: 'Quick Access',
        examples: [
          '"Check my tasks"',
          '"Show wellness"',
          '"Open peer support"',
        ],
      },
    ];
  }
}

export type VoiceState = 'idle' | 'listening' | 'awake' | 'processing';

// Singleton instance
export const voiceCommandService = new VoiceCommandService();
