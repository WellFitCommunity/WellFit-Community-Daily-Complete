/**
 * CheckIn.types.ts — Shared types, constants, and helpers for CheckInTracker sub-components.
 */

import type { RefObject } from 'react';

// ============================================================================
// WEB SPEECH API TYPES (browser API boundary)
// ============================================================================

export interface WebSpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

export interface WebSpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export interface WebSpeechRecognitionConstructor {
  new(): WebSpeechRecognitionInstance;
}

export type WindowWithSpeechRecognition = Window & {
  webkitSpeechRecognition?: WebSpeechRecognitionConstructor;
  SpeechRecognition?: WebSpeechRecognitionConstructor;
};

// ============================================================================
// DATA TYPES
// ============================================================================

export type CheckInEntry = {
  timestamp: string;
  label: string;
  is_emergency: boolean;
  emotional_state?: string;
  heart_rate?: number | null;
  pulse_oximeter?: number | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  glucose_mg_dl?: number | null;
  weight?: number | null;
  physical_activity?: string | null;
  social_engagement?: string | null;
  symptoms?: string | null;
  activity_notes?: string | null;
};

export type Toast = { type?: 'success' | 'error' | 'info'; text?: string } | null;

export type CrisisOption = 'speak_someone' | 'fallen_injured' | 'lost' | null;

// ============================================================================
// CONSTANTS
// ============================================================================

export const ENABLE_LOCAL_HISTORY = false; // HIPAA: keep PHI out of localStorage

export const STORAGE_KEY = 'wellfitCheckIns';

export const LOCAL_HISTORY_CAP = 200;

export const MOOD_OPTIONS = ['Great', 'Good', 'Okay', 'Not Great', 'Sad', 'Anxious', 'Tired', 'Stressed'] as const;

export const PHYSICAL_ACTIVITY_OPTIONS = [
  'Walking', 'Gym/Fitness Center', 'YMCA', 'Silver Sneakers',
  'Swimming', 'Yoga/Stretching', 'Dancing', 'Gardening',
  'Housework', 'Resting/No Activity',
] as const;

export const SOCIAL_ENGAGEMENT_OPTIONS = [
  'Spent time with family', 'Called/texted friends', 'Attended social event',
  'Volunteered', 'Went to religious service', 'Participated in group activity',
  'Had visitors', 'Went out with others', 'Stayed home alone',
  'Connected online/video call',
] as const;

export const CHECK_IN_BUTTONS = [
  '😊 Feeling Great Today',
  '📅 Feeling fine & have a Dr. Appt today',
  '🏥 In the hospital',
  '🤒 Not Feeling My Best',
  '🧭 Need Healthcare Navigation Assistance',
  '⭐ Attending the event today',
];

export const FEEDBACK_COPY: Record<string, string> = {
  '😊 Feeling Great Today': 'Awesome! Enjoy your day. 🌞',
  '📅 Feeling fine & have a Dr. Appt today': 'Do not forget to show your log to the doctor. 🩺',
  '🏥 In the hospital': 'We are thinking of you. Please call us if we can help. ❤️',
  '🤒 Not Feeling My Best': 'We understand. Please let us know how we can help.',
  '🧭 Need Healthcare Navigation Assistance': 'Hang tight—we will call you shortly. ☎️',
  '⭐ Attending the event today': 'Great! Have a wonderful time at the event. Enjoy yourself! ✨',
  DefaultSuccess: 'Check-in submitted successfully!',
};

// ============================================================================
// HELPERS
// ============================================================================

export function parseIntOrNull(v: string): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

export function parseFloatOrNull(v: string): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

export function clampVitals(
  hr: number | null,
  spo2: number | null,
  sys: number | null,
  dia: number | null,
  glu: number | null,
  wt: number | null,
) {
  function safe<T extends number | null>(val: T, lo: number, hi: number): T | null {
    return val != null && val >= lo && val <= hi ? val : null;
  }
  return {
    hr: safe(hr, 30, 220),
    spo2: safe(spo2, 50, 100),
    sys: safe(sys, 70, 250),
    dia: safe(dia, 40, 150),
    glu: safe(glu, 40, 600),
    weight: safe(wt, 50, 500),
  };
}

// ============================================================================
// BRANDING (shared shape)
// ============================================================================

export interface CheckInBranding {
  primaryColor?: string;
  secondaryColor?: string;
  gradient?: string;
}

// ============================================================================
// SUB-COMPONENT PROPS
// ============================================================================

export interface CheckInFormBodyProps {
  mood: string;
  heartRate: string;
  pulseOximeter: string;
  bpSystolic: string;
  bpDiastolic: string;
  glucose: string;
  weight: string;
  physicalActivity: string;
  socialEngagement: string;
  symptoms: string;
  activityNotes: string;
  isSubmitting: boolean;
  isListening: boolean;
  currentField: string | null;
  infoMessage: Toast;
  feedbackRef: RefObject<HTMLDivElement | null>;
  branding: CheckInBranding;
  onSetMood: (v: string) => void;
  onSetHeartRate: (v: string) => void;
  onSetPulseOximeter: (v: string) => void;
  onSetBpSystolic: (v: string) => void;
  onSetBpDiastolic: (v: string) => void;
  onSetGlucose: (v: string) => void;
  onSetWeight: (v: string) => void;
  onSetPhysicalActivity: (v: string) => void;
  onSetSocialEngagement: (v: string) => void;
  onSetSymptoms: (v: string) => void;
  onSetActivityNotes: (v: string) => void;
  onStartVoice: (field: string) => void;
  onStopVoice: () => void;
  onShowPulseOximeter: () => void;
  onCheckIn: (label: string, isQuick: boolean) => void;
}

export interface CheckInModalsProps {
  showPulseOximeter: boolean;
  showCrisisOptions: boolean;
  showCrisisMessage: boolean;
  selectedCrisisOption: CrisisOption;
  showEmergencyModal: boolean;
  emergencyContactPhone: string | null;
  onPulseOximeterComplete: (hr: number, spo2: number) => void;
  onClosePulseOximeter: () => void;
  onCrisisOption: (option: CrisisOption) => void;
  onCloseCrisis: () => void;
}

export interface CheckInHistoryProps {
  history: CheckInEntry[];
  branding: CheckInBranding;
}
