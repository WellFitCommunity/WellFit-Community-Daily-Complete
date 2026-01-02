// ============================================================================
// Claude Care Assistant - Type Definitions
// ============================================================================
// Purpose: Unified AI assistant for translation, cultural context, and administrative automation
// Zero tech debt: Works with existing role system
// ============================================================================

import { ClaudeModel } from './claude';

// ============================================================================
// TRANSLATION TYPES
// ============================================================================

/**
 * Supported languages for translation
 * 50+ languages covering 95% of global patient populations
 */
export type SupportedLanguage =
  // Top 10 (Most common in US healthcare)
  | 'en' // English
  | 'es' // Spanish
  | 'zh' // Chinese (Mandarin)
  | 'ar' // Arabic
  | 'vi' // Vietnamese
  | 'ko' // Korean
  | 'ru' // Russian
  | 'tl' // Tagalog (Filipino)
  | 'fr' // French
  | 'ht' // Haitian Creole
  // European
  | 'de' // German
  | 'it' // Italian
  | 'pl' // Polish
  | 'pt' // Portuguese
  | 'ro' // Romanian
  | 'uk' // Ukrainian
  | 'nl' // Dutch
  | 'sv' // Swedish
  | 'cs' // Czech
  | 'el' // Greek
  // Asian & Pacific
  | 'hi' // Hindi
  | 'ja' // Japanese
  | 'th' // Thai
  | 'id' // Indonesian
  | 'ur' // Urdu
  | 'bn' // Bengali
  | 'pa' // Punjabi
  | 'ta' // Tamil
  | 'te' // Telugu
  | 'mr' // Marathi
  | 'gu' // Gujarati
  | 'kn' // Kannada
  | 'ml' // Malayalam
  | 'si' // Sinhala
  | 'ne' // Nepali
  | 'my' // Burmese
  | 'km' // Khmer (Cambodian)
  | 'lo' // Lao
  // Middle East & Africa
  | 'fa' // Persian/Farsi
  | 'tr' // Turkish
  | 'he' // Hebrew
  | 'am' // Amharic
  | 'so' // Somali
  | 'sw' // Swahili
  | 'yo' // Yoruba
  | 'ig' // Igbo
  | 'ha' // Hausa
  // Other
  | 'hu' // Hungarian
  | 'fi' // Finnish
  | 'da' // Danish
  | 'no' // Norwegian;

/**
 * Context type for translation to determine tone and terminology
 */
export type TranslationContextType =
  | 'medical' // Clinical/medical terminology
  | 'administrative' // Forms, billing, insurance
  | 'general'; // General communication

/**
 * Patient cultural context for translation personalization
 */
export interface PatientCulturalContext {
  primaryLanguage: SupportedLanguage;
  culturalBackground?: string;
  preferredCommunicationStyle?: 'direct' | 'indirect' | 'formal' | 'casual';
  healthLiteracyLevel?: 'low' | 'medium' | 'high';
  religiousCulturalConsiderations?: string[];
}

/**
 * Translation request
 */
export interface TranslationRequest {
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  sourceText: string;
  contextType?: TranslationContextType;
  patientContext?: PatientCulturalContext;
}

/**
 * Translation response with cultural notes
 */
export interface TranslationResponse {
  translatedText: string;
  culturalNotes?: string[];
  confidence: number; // 0-1
  cached: boolean;
}

// ============================================================================
// ADMINISTRATIVE TASK TYPES
// ============================================================================

/**
 * Physician-specific administrative tasks
 */
export type PhysicianTaskType =
  | 'prior_authorization'
  | 'insurance_appeal'
  | 'peer_review_prep'
  | 'referral_letter'
  | 'medical_necessity_letter';

/**
 * Nurse-specific administrative tasks
 */
export type NurseTaskType =
  | 'supply_justification'
  | 'incident_report'
  | 'handoff_notes'
  | 'patient_education_material'
  | 'wound_care_documentation';

/**
 * Case Manager-specific administrative tasks
 */
export type CaseManagerTaskType =
  | 'insurance_verification'
  | 'discharge_planning'
  | 'resource_coordination'
  | 'length_of_stay_justification'
  | 'skilled_nursing_recommendation';

/**
 * Social Worker-specific administrative tasks
 */
export type SocialWorkerTaskType =
  | 'psychosocial_assessment'
  | 'crisis_intervention'
  | 'safety_plan'
  | 'benefits_application'
  | 'housing_assistance_referral';

/**
 * All administrative task types
 */
export type AdminTaskType =
  | PhysicianTaskType
  | NurseTaskType
  | CaseManagerTaskType
  | SocialWorkerTaskType
  | 'meeting_notes'; // Universal task type

/**
 * Administrative task template structure
 */
export interface AdminTaskTemplate {
  id: string;
  role: string; // Role name (physician, nurse, case_manager, social_worker, admin)
  taskType: string;
  templateName: string;
  description?: string;
  promptTemplate: string;
  requiredFields: Record<string, string>; // field name -> type
  optionalFields?: Record<string, string>;
  outputFormat: 'narrative' | 'form' | 'letter' | 'structured';
  estimatedTokens?: number;
  preferredModel?: string;
  isActive?: boolean;
}

/**
 * Administrative task execution request
 */
export interface AdminTaskRequest {
  templateId: string;
  role: string;
  taskType: string;
  inputData: Record<string, any>;
  preferredModel?: ClaudeModel;
  userId?: string;
}

/**
 * Administrative task execution response
 */
export interface AdminTaskResponse {
  taskId: string;
  generatedContent: string;
  tokensUsed: number;
  executionTimeMs: number;
  suggestedEdits?: string[];
}

/**
 * Task execution history entry
 */
export interface AdminTaskHistory {
  id: string;
  userId: string;
  role: string;
  taskType: string;
  templateId?: string;
  inputData: Record<string, any>;
  outputData: Record<string, any>;
  tokensUsed?: number;
  executionTimeMs?: number;
  aiCorrectionsCount?: number;
  userSatisfaction?: number; // 1-5
  userFeedback?: string;
  createdAt: string;
}

// ============================================================================
// VOICE INPUT TYPES
// ============================================================================

/**
 * Voice input session
 */
export interface VoiceInputSession {
  id?: string;
  userId: string;
  role: string;
  taskType?: string;
  audioDurationSeconds?: number;
  audioFormat?: string;
  transcription?: string;
  transcriptionConfidence?: number;
  correctionsApplied?: number;
  finalOutput?: Record<string, any>;
  suggestedTemplateId?: string;
  voiceProfileUsed?: boolean;
  processingTimeMs?: number;
  createdAt?: string;
}

/**
 * Voice input processing result
 */
export interface VoiceInputResult {
  transcription: string;
  suggestedTemplate?: string;
  confidence?: number;
}

// ============================================================================
// CARE CONTEXT TYPES (Cross-role collaboration)
// ============================================================================

/**
 * Context type for cross-role sharing
 */
export type CareContextType =
  | 'clinical' // Clinical notes, assessments
  | 'social' // Social work assessments
  | 'administrative' // Insurance, discharge planning
  | 'cultural'; // Cultural/language considerations

/**
 * Care context entry for patient
 */
export interface CareContextEntry {
  id?: string;
  patientId: string;
  contextType: CareContextType;
  contributedByRole: string;
  contributedByUser: string;
  contextData: Record<string, any>;
  contextSummary?: string;
  validUntil?: string;
  isActive?: boolean;
  createdAt?: string;
}

// ============================================================================
// MODULE CONFIGURATION
// ============================================================================

/**
 * Role-specific module configuration
 */
export interface ClaudeCareModuleConfig {
  role: string;
  enabledFeatures: {
    translation: boolean;
    adminTaskAutomation: boolean;
    voiceInput: boolean;
    crossRoleContext: boolean;
  };
  availableTaskTypes: string[];
  preferredModel: ClaudeModel;
  culturalContextRequired: boolean;
}

/**
 * Default module configurations by role
 */
export const ROLE_MODULE_CONFIGS: Record<string, ClaudeCareModuleConfig> = {
  physician: {
    role: 'physician',
    enabledFeatures: {
      translation: true,
      adminTaskAutomation: true,
      voiceInput: true,
      crossRoleContext: true,
    },
    availableTaskTypes: [
      'prior_authorization',
      'insurance_appeal',
      'peer_review_prep',
      'referral_letter',
      'medical_necessity_letter',
    ],
    preferredModel: ClaudeModel.SONNET_3_5, // Revenue-critical accuracy
    culturalContextRequired: true,
  },
  nurse: {
    role: 'nurse',
    enabledFeatures: {
      translation: true,
      adminTaskAutomation: true,
      voiceInput: true,
      crossRoleContext: true,
    },
    availableTaskTypes: [
      'supply_justification',
      'incident_report',
      'handoff_notes',
      'patient_education_material',
      'wound_care_documentation',
    ],
    preferredModel: ClaudeModel.HAIKU_3_5, // Fast, cost-effective
    culturalContextRequired: true,
  },
  nurse_practitioner: {
    role: 'nurse_practitioner',
    enabledFeatures: {
      translation: true,
      adminTaskAutomation: true,
      voiceInput: true,
      crossRoleContext: true,
    },
    availableTaskTypes: [
      'prior_authorization',
      'referral_letter',
      'patient_education_material',
    ],
    preferredModel: ClaudeModel.SONNET_3_5,
    culturalContextRequired: true,
  },
  physician_assistant: {
    role: 'physician_assistant',
    enabledFeatures: {
      translation: true,
      adminTaskAutomation: true,
      voiceInput: true,
      crossRoleContext: true,
    },
    availableTaskTypes: [
      'prior_authorization',
      'referral_letter',
      'patient_education_material',
    ],
    preferredModel: ClaudeModel.SONNET_3_5,
    culturalContextRequired: true,
  },
  case_manager: {
    role: 'case_manager',
    enabledFeatures: {
      translation: true,
      adminTaskAutomation: true,
      voiceInput: true,
      crossRoleContext: true,
    },
    availableTaskTypes: [
      'insurance_verification',
      'discharge_planning',
      'resource_coordination',
      'length_of_stay_justification',
      'skilled_nursing_recommendation',
    ],
    preferredModel: ClaudeModel.SONNET_3_5, // Accuracy for insurance/discharge
    culturalContextRequired: true,
  },
  social_worker: {
    role: 'social_worker',
    enabledFeatures: {
      translation: true,
      adminTaskAutomation: true,
      voiceInput: true,
      crossRoleContext: true,
    },
    availableTaskTypes: [
      'psychosocial_assessment',
      'crisis_intervention',
      'safety_plan',
      'benefits_application',
      'housing_assistance_referral',
    ],
    preferredModel: ClaudeModel.SONNET_3_5, // Nuanced understanding needed
    culturalContextRequired: true,
  },
  admin: {
    role: 'admin',
    enabledFeatures: {
      translation: false,
      adminTaskAutomation: true,
      voiceInput: true,
      crossRoleContext: false,
    },
    availableTaskTypes: ['meeting_notes'],
    preferredModel: ClaudeModel.HAIKU_3_5,
    culturalContextRequired: false,
  },
};

// ============================================================================
// SERVICE RESPONSE TYPES
// ============================================================================

/**
 * Generic service response wrapper
 */
export interface ClaudeCareServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Translation cache entry (database model)
 */
export interface TranslationCacheEntry {
  id: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  sourceText: string;
  translatedText: string;
  contextType?: TranslationContextType;
  culturalNotes?: string[];
  translationConfidence?: number;
  usageCount: number;
  lastUsedAt: string;
  createdAt: string;
}

// ============================================================================
// LANGUAGE NAMES FOR UI
// ============================================================================

/**
 * Human-readable language names for UI display
 */
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Spanish (Español)',
  zh: 'Chinese (中文)',
  ar: 'Arabic (العربية)',
  vi: 'Vietnamese (Tiếng Việt)',
  ko: 'Korean (한국어)',
  ru: 'Russian (Русский)',
  tl: 'Tagalog',
  fr: 'French (Français)',
  ht: 'Haitian Creole',
  de: 'German (Deutsch)',
  it: 'Italian (Italiano)',
  pl: 'Polish (Polski)',
  pt: 'Portuguese (Português)',
  ro: 'Romanian (Română)',
  uk: 'Ukrainian (Українська)',
  nl: 'Dutch (Nederlands)',
  sv: 'Swedish (Svenska)',
  cs: 'Czech (Čeština)',
  el: 'Greek (Ελληνικά)',
  hi: 'Hindi (हिन्दी)',
  ja: 'Japanese (日本語)',
  th: 'Thai (ไทย)',
  id: 'Indonesian (Bahasa Indonesia)',
  ur: 'Urdu (اردو)',
  bn: 'Bengali (বাংলা)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)',
  ta: 'Tamil (தமிழ்)',
  te: 'Telugu (తెలుగు)',
  mr: 'Marathi (मराठी)',
  gu: 'Gujarati (ગુજરાતી)',
  kn: 'Kannada (ಕನ್ನಡ)',
  ml: 'Malayalam (മലയാളം)',
  si: 'Sinhala (සිංහල)',
  ne: 'Nepali (नेपाली)',
  my: 'Burmese (မြန်မာ)',
  km: 'Khmer (ខ្មែរ)',
  lo: 'Lao (ລາວ)',
  fa: 'Persian/Farsi (فارسی)',
  tr: 'Turkish (Türkçe)',
  he: 'Hebrew (עברית)',
  am: 'Amharic (አማርኛ)',
  so: 'Somali',
  sw: 'Swahili (Kiswahili)',
  yo: 'Yoruba',
  ig: 'Igbo',
  ha: 'Hausa',
  hu: 'Hungarian (Magyar)',
  fi: 'Finnish (Suomi)',
  da: 'Danish (Dansk)',
  no: 'Norwegian (Norsk)',
};
