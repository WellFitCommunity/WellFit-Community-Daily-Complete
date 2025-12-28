/**
 * Voice Action Context
 *
 * Global state management for intelligent voice commands.
 * Enables natural language voice commands to navigate and populate data
 * across the entire application automatically.
 *
 * ATLUS: Intuitive Technology - Voice commands that anticipate needs
 *
 * Comprehensive voice patterns:
 * - Patients: "patient Maria LeBlanc", "CHF patients", "ICU patients"
 * - Beds/Rooms: "bed 205A", "room 302", "available ICU beds"
 * - Alerts: "critical alerts", "alerts for room 302"
 * - Tasks: "my pending tasks", "tasks for today"
 * - Referrals: "pending referrals", "referral from Houston Hospital"
 * - Shifts: "patients on my shift", "handoff for nurse Smith"
 * - Medications: "patients on metformin", "insulin patients"
 * - Time-based: "admissions today", "discharges this shift"
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auditLogger } from '../services/auditLogger';

// ============================================================================
// TYPES
// ============================================================================

export type EntityType =
  | 'patient'
  | 'bed'
  | 'room'
  | 'provider'
  | 'caregiver'
  | 'referral'
  | 'alert'
  | 'task'
  | 'shift'
  | 'handoff'
  | 'medication'
  | 'diagnosis'
  | 'admission'
  | 'discharge';

export interface ParsedEntity {
  type: EntityType;
  query: string;           // The search query (e.g., "Maria LeBlanc")
  filters: {
    // Identity filters
    name?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;  // ISO format
    mrn?: string;

    // Location filters
    roomNumber?: string;
    bedId?: string;
    unit?: string;
    unitType?: string;     // ICU, ER, med-surg, etc.

    // Clinical filters
    riskLevel?: 'critical' | 'high' | 'medium' | 'low';
    diagnosis?: string;    // CHF, diabetes, stroke, etc.
    medication?: string;   // metformin, insulin, etc.
    acuity?: 'critical' | 'high' | 'medium' | 'low';

    // Status filters
    status?: string;       // pending, active, completed, etc.
    priority?: string;     // urgent, routine, stat

    // Time filters
    timeframe?: 'today' | 'this_shift' | 'yesterday' | 'this_week' | 'this_month';
    shiftType?: 'day' | 'night' | 'current';

    // Source filters
    source?: string;       // For referrals - hospital name
    assignedTo?: string;   // For tasks - nurse/provider name
  };
  rawTranscript: string;   // Original voice input
  confidence: number;
}

export interface VoiceAction {
  id: string;
  entity: ParsedEntity;
  targetRoute: string;
  status: 'pending' | 'navigating' | 'searching' | 'completed' | 'failed';
  results?: SearchResult[];
  error?: string;
  timestamp: Date;
}

export interface SearchResult {
  id: string;
  type: EntityType;
  primaryText: string;     // e.g., "Maria LeBlanc"
  secondaryText?: string;  // e.g., "DOB: 06/10/1976 | MRN: 12345"
  matchScore: number;      // 0-100, how well it matches the query
  metadata: Record<string, unknown>;
}

interface VoiceActionContextType {
  // Current action state
  currentAction: VoiceAction | null;
  searchResults: SearchResult[];
  isSearching: boolean;

  // Actions
  processVoiceInput: (transcript: string, confidence: number) => Promise<void>;
  selectResult: (result: SearchResult) => void;
  clearAction: () => void;

  // For dashboards to register their search handlers
  registerSearchHandler: (entityType: EntityType, handler: SearchHandler) => void;
  unregisterSearchHandler: (entityType: EntityType) => void;
}

export type SearchHandler = (entity: ParsedEntity) => Promise<SearchResult[]>;

const VoiceActionContext = createContext<VoiceActionContextType | null>(null);

// ============================================================================
// COMMON MEDICAL TERMS & ABBREVIATIONS
// ============================================================================

const DIAGNOSIS_ALIASES: Record<string, string> = {
  // Heart conditions
  'chf': 'congestive heart failure',
  'heart failure': 'congestive heart failure',
  'mi': 'myocardial infarction',
  'heart attack': 'myocardial infarction',
  'afib': 'atrial fibrillation',
  'a-fib': 'atrial fibrillation',

  // Respiratory
  'copd': 'chronic obstructive pulmonary disease',
  'pneumonia': 'pneumonia',
  'covid': 'covid-19',

  // Metabolic
  'diabetes': 'diabetes mellitus',
  'dm': 'diabetes mellitus',
  'dm2': 'diabetes mellitus type 2',
  'type 2': 'diabetes mellitus type 2',

  // Neurological
  'stroke': 'cerebrovascular accident',
  'cva': 'cerebrovascular accident',
  'tia': 'transient ischemic attack',
  'seizure': 'seizure disorder',
  'epilepsy': 'seizure disorder',
  'parkinsons': 'parkinson disease',
  'parkinson': 'parkinson disease',
  'dementia': 'dementia',
  'alzheimers': 'alzheimer disease',

  // Renal
  'ckd': 'chronic kidney disease',
  'kidney disease': 'chronic kidney disease',
  'esrd': 'end stage renal disease',
  'dialysis': 'end stage renal disease',

  // Other
  'sepsis': 'sepsis',
  'fall': 'fall risk',
  'falls': 'fall risk',
  'pressure ulcer': 'pressure injury',
  'bed sore': 'pressure injury',
};

const MEDICATION_ALIASES: Record<string, string> = {
  'insulin': 'insulin',
  'metformin': 'metformin',
  'glucophage': 'metformin',
  'lisinopril': 'lisinopril',
  'ace inhibitor': 'lisinopril',
  'lasix': 'furosemide',
  'furosemide': 'furosemide',
  'diuretic': 'furosemide',
  'water pill': 'furosemide',
  'coumadin': 'warfarin',
  'warfarin': 'warfarin',
  'blood thinner': 'anticoagulant',
  'heparin': 'heparin',
  'lovenox': 'enoxaparin',
  'plavix': 'clopidogrel',
  'aspirin': 'aspirin',
  'statin': 'statin',
  'lipitor': 'atorvastatin',
  'metoprolol': 'metoprolol',
  'beta blocker': 'metoprolol',
  'morphine': 'morphine',
  'dilaudid': 'hydromorphone',
  'pain med': 'analgesic',
  'antibiotic': 'antibiotic',
  'vancomycin': 'vancomycin',
  'vanco': 'vancomycin',
  'zosyn': 'piperacillin-tazobactam',
};

const UNIT_ALIASES: Record<string, string> = {
  'icu': 'icu',
  'intensive care': 'icu',
  'critical care': 'icu',
  'ccu': 'cardiac_icu',
  'cardiac icu': 'cardiac_icu',
  'micu': 'medical_icu',
  'sicu': 'surgical_icu',
  'nicu': 'nicu',
  'picu': 'picu',
  'er': 'ed',
  'emergency': 'ed',
  'emergency room': 'ed',
  'emergency department': 'ed',
  'ed': 'ed',
  'med surg': 'med_surg',
  'med-surg': 'med_surg',
  'medical surgical': 'med_surg',
  'telemetry': 'telemetry',
  'tele': 'telemetry',
  'step down': 'step_down',
  'stepdown': 'step_down',
  'pcu': 'step_down',
  'progressive care': 'step_down',
  'labor and delivery': 'labor_delivery',
  'l&d': 'labor_delivery',
  'labor': 'labor_delivery',
  'ob': 'labor_delivery',
  'postpartum': 'postpartum',
  'mother baby': 'postpartum',
  'nursery': 'nursery',
  'peds': 'peds',
  'pediatrics': 'peds',
  'ortho': 'ortho',
  'orthopedic': 'ortho',
  'neuro': 'neuro',
  'neurology': 'neuro',
  'oncology': 'oncology',
  'cancer': 'oncology',
  'psych': 'psych',
  'psychiatry': 'psych',
  'behavioral health': 'psych',
  'rehab': 'rehab',
  'rehabilitation': 'rehab',
  'or': 'or',
  'operating room': 'or',
  'surgery': 'or',
  'pacu': 'pacu',
  'recovery': 'pacu',
};

// ============================================================================
// ENTITY PARSER - Natural Language Understanding
// ============================================================================

/**
 * Parse natural language into structured entity query
 * Comprehensive support for healthcare voice commands
 */
export function parseVoiceEntity(transcript: string): ParsedEntity | null {
  const normalized = transcript.toLowerCase().trim();

  // Try each parser in order of specificity
  return (
    parseAlertCommand(normalized, transcript) ||
    parseTaskCommand(normalized, transcript) ||
    parseReferralCommand(normalized, transcript) ||
    parseShiftHandoffCommand(normalized, transcript) ||
    parseAdmissionDischargeCommand(normalized, transcript) ||
    parseMedicationPatientCommand(normalized, transcript) ||
    parseDiagnosisPatientCommand(normalized, transcript) ||
    parseUnitPatientCommand(normalized, transcript) ||
    parseRiskLevelCommand(normalized, transcript) ||
    parseBedCommand(normalized, transcript) ||
    parseRoomCommand(normalized, transcript) ||
    parseProviderCommand(normalized, transcript) ||
    parseCaregiverCommand(normalized, transcript) ||
    parsePatientCommand(normalized, transcript)
  );
}

// ============================================================================
// INDIVIDUAL PARSERS
// ============================================================================

/**
 * Parse alert commands
 * "critical alerts", "alerts for room 302", "show alerts", "patient alerts"
 */
function parseAlertCommand(normalized: string, transcript: string): ParsedEntity | null {
  const patterns = [
    /(?:show\s+)?(?:all\s+)?(critical|high|urgent)\s+alerts?/i,
    /alerts?\s+(?:for\s+)?(?:room\s+)?(\d+[a-z]?)/i,
    /(?:show\s+)?(?:all\s+)?(?:patient\s+)?alerts?/i,
    /(?:clinical\s+)?alerts?\s+(?:dashboard)?/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const filters: ParsedEntity['filters'] = {};

      // Check for priority/severity
      if (/critical|urgent/.test(normalized)) {
        filters.priority = 'critical';
      } else if (/high/.test(normalized)) {
        filters.priority = 'high';
      }

      // Check for room number
      const roomMatch = normalized.match(/room\s+(\d+[a-z]?)/i);
      if (roomMatch) {
        filters.roomNumber = roomMatch[1];
      }

      return {
        type: 'alert',
        query: filters.priority ? `${filters.priority} alerts` : 'all alerts',
        filters,
        rawTranscript: transcript,
        confidence: 85,
      };
    }
  }
  return null;
}

/**
 * Parse task commands
 * "my pending tasks", "tasks for today", "show tasks", "urgent tasks"
 */
function parseTaskCommand(normalized: string, transcript: string): ParsedEntity | null {
  const patterns = [
    /(?:show\s+)?(?:my\s+)?(pending|open|incomplete)\s+tasks?/i,
    /tasks?\s+(?:for\s+)?(today|this\s+shift|tomorrow)/i,
    /(?:show\s+)?(?:all\s+)?(?:my\s+)?tasks?/i,
    /(urgent|stat|priority)\s+tasks?/i,
    /tasks?\s+(?:assigned\s+)?(?:to\s+)?(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const filters: ParsedEntity['filters'] = {};

      // Check status
      if (/pending|open|incomplete/.test(normalized)) {
        filters.status = 'pending';
      }

      // Check timeframe
      if (/today/.test(normalized)) {
        filters.timeframe = 'today';
      } else if (/this\s+shift/.test(normalized)) {
        filters.timeframe = 'this_shift';
      }

      // Check priority
      if (/urgent|stat|priority/.test(normalized)) {
        filters.priority = 'urgent';
      }

      // Check assigned to
      const assignedMatch = normalized.match(/(?:assigned\s+)?to\s+(?:nurse\s+|dr\.?\s+)?(\w+)/i);
      if (assignedMatch) {
        filters.assignedTo = assignedMatch[1];
      }

      return {
        type: 'task',
        query: filters.status || filters.timeframe ? `${filters.status || ''} tasks ${filters.timeframe || ''}`.trim() : 'all tasks',
        filters,
        rawTranscript: transcript,
        confidence: 85,
      };
    }
  }
  return null;
}

/**
 * Parse referral commands
 * "pending referrals", "referral from Houston Hospital", "new referrals"
 */
function parseReferralCommand(normalized: string, transcript: string): ParsedEntity | null {
  const patterns = [
    /(?:show\s+)?(?:all\s+)?(pending|new|active)\s+referrals?/i,
    /referrals?\s+(?:from\s+)(.+?)(?:\s+hospital)?$/i,
    /(?:show\s+)?(?:all\s+)?referrals?/i,
    /(?:hospital\s+)?referrals?\s+(?:dashboard)?/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const filters: ParsedEntity['filters'] = {};

      // Check status
      if (/pending|new/.test(normalized)) {
        filters.status = 'pending';
      } else if (/active/.test(normalized)) {
        filters.status = 'active';
      }

      // Check source hospital
      const sourceMatch = normalized.match(/from\s+(.+?)(?:\s+hospital)?$/i);
      if (sourceMatch) {
        filters.source = sourceMatch[1].trim();
      }

      return {
        type: 'referral',
        query: filters.source ? `referrals from ${filters.source}` : (filters.status ? `${filters.status} referrals` : 'all referrals'),
        filters,
        rawTranscript: transcript,
        confidence: 85,
      };
    }
  }
  return null;
}

/**
 * Parse shift/handoff commands
 * "patients on my shift", "handoff for nurse Smith", "shift handoff"
 */
function parseShiftHandoffCommand(normalized: string, transcript: string): ParsedEntity | null {
  const patterns = [
    /patients?\s+(?:on\s+)?(?:my\s+)?(current\s+)?shift/i,
    /(?:my\s+)?shift\s+patients?/i,
    /handoff\s+(?:for\s+)?(?:nurse\s+|dr\.?\s+)?(\w+)/i,
    /(?:show\s+)?(?:shift\s+)?handoffs?/i,
    /(?:nurse\s+)?handoff\s+(?:dashboard|report)?/i,
    /(day|night|current)\s+shift\s+(?:patients?|handoff)?/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const filters: ParsedEntity['filters'] = {};

      // Check shift type
      if (/day\s+shift/.test(normalized)) {
        filters.shiftType = 'day';
      } else if (/night\s+shift/.test(normalized)) {
        filters.shiftType = 'night';
      } else {
        filters.shiftType = 'current';
      }

      // Check assigned nurse
      const nurseMatch = normalized.match(/(?:for\s+)?(?:nurse\s+)(\w+)/i);
      if (nurseMatch) {
        filters.assignedTo = nurseMatch[1];
      }

      // Determine if it's a shift patient list or handoff
      const isHandoff = /handoff/.test(normalized);

      return {
        type: isHandoff ? 'handoff' : 'shift',
        query: filters.assignedTo ? `handoff for ${filters.assignedTo}` : `${filters.shiftType} shift`,
        filters,
        rawTranscript: transcript,
        confidence: 85,
      };
    }
  }
  return null;
}

/**
 * Parse admission/discharge commands
 * "admissions today", "discharges this shift", "pending discharges"
 */
function parseAdmissionDischargeCommand(normalized: string, transcript: string): ParsedEntity | null {
  const patterns = [
    /(?:show\s+)?(?:all\s+)?admissions?\s+(?:for\s+)?(today|this\s+shift|yesterday|this\s+week)/i,
    /(?:show\s+)?(?:all\s+)?discharges?\s+(?:for\s+)?(today|this\s+shift|yesterday|this\s+week)/i,
    /(pending|expected|planned)\s+(admissions?|discharges?)/i,
    /(?:new\s+)?admissions?\s+(?:dashboard)?/i,
    /(?:pending\s+)?discharges?\s+(?:dashboard)?/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const filters: ParsedEntity['filters'] = {};
      const isAdmission = /admission/.test(normalized);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _isDischarge = /discharge/.test(normalized);

      // Parse timeframe
      if (/today/.test(normalized)) {
        filters.timeframe = 'today';
      } else if (/this\s+shift/.test(normalized)) {
        filters.timeframe = 'this_shift';
      } else if (/yesterday/.test(normalized)) {
        filters.timeframe = 'yesterday';
      } else if (/this\s+week/.test(normalized)) {
        filters.timeframe = 'this_week';
      }

      // Parse status
      if (/pending|expected|planned/.test(normalized)) {
        filters.status = 'pending';
      }

      return {
        type: isAdmission ? 'admission' : 'discharge',
        query: `${filters.status || ''} ${isAdmission ? 'admissions' : 'discharges'} ${filters.timeframe || ''}`.trim(),
        filters,
        rawTranscript: transcript,
        confidence: 85,
      };
    }
  }
  return null;
}

/**
 * Parse medication-based patient search
 * "patients on metformin", "insulin patients", "blood thinner patients"
 */
function parseMedicationPatientCommand(normalized: string, transcript: string): ParsedEntity | null {
  // Check for medication keywords
  for (const [alias, medication] of Object.entries(MEDICATION_ALIASES)) {
    const patterns = [
      new RegExp(`patients?\\s+(?:on|taking|receiving)\\s+${alias}`, 'i'),
      new RegExp(`${alias}\\s+patients?`, 'i'),
      new RegExp(`(?:show\\s+)?(?:all\\s+)?patients?\\s+(?:on\\s+)?${alias}`, 'i'),
    ];

    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return {
          type: 'patient',
          query: `patients on ${medication}`,
          filters: { medication },
          rawTranscript: transcript,
          confidence: 85,
        };
      }
    }
  }
  return null;
}

/**
 * Parse diagnosis-based patient search
 * "CHF patients", "diabetes patients", "stroke patients"
 */
function parseDiagnosisPatientCommand(normalized: string, transcript: string): ParsedEntity | null {
  // Check for diagnosis keywords
  for (const [alias, diagnosis] of Object.entries(DIAGNOSIS_ALIASES)) {
    const patterns = [
      new RegExp(`${alias}\\s+patients?`, 'i'),
      new RegExp(`patients?\\s+(?:with|diagnosed\\s+with)\\s+${alias}`, 'i'),
      new RegExp(`(?:show\\s+)?(?:all\\s+)?${alias}\\s+patients?`, 'i'),
    ];

    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return {
          type: 'patient',
          query: `patients with ${diagnosis}`,
          filters: { diagnosis },
          rawTranscript: transcript,
          confidence: 85,
        };
      }
    }
  }
  return null;
}

/**
 * Parse unit-based patient/bed search
 * "ICU patients", "ER beds", "med-surg patients"
 */
function parseUnitPatientCommand(normalized: string, transcript: string): ParsedEntity | null {
  // Check for unit keywords
  for (const [alias, unitType] of Object.entries(UNIT_ALIASES)) {
    const patientPatterns = [
      new RegExp(`${alias}\\s+patients?`, 'i'),
      new RegExp(`patients?\\s+(?:in|on)\\s+(?:the\\s+)?${alias}`, 'i'),
      new RegExp(`(?:show\\s+)?(?:all\\s+)?${alias}\\s+patients?`, 'i'),
    ];

    const bedPatterns = [
      new RegExp(`${alias}\\s+beds?`, 'i'),
      new RegExp(`beds?\\s+(?:in|on)\\s+(?:the\\s+)?${alias}`, 'i'),
      new RegExp(`(?:available\\s+)?${alias}\\s+beds?`, 'i'),
    ];

    // Check patient patterns
    for (const pattern of patientPatterns) {
      if (pattern.test(normalized)) {
        return {
          type: 'patient',
          query: `${unitType} patients`,
          filters: { unitType },
          rawTranscript: transcript,
          confidence: 85,
        };
      }
    }

    // Check bed patterns
    for (const pattern of bedPatterns) {
      if (pattern.test(normalized)) {
        const isAvailable = /available/.test(normalized);
        return {
          type: 'bed',
          query: isAvailable ? `available ${unitType} beds` : `${unitType} beds`,
          filters: {
            unitType,
            status: isAvailable ? 'available' : undefined,
          },
          rawTranscript: transcript,
          confidence: 85,
        };
      }
    }
  }
  return null;
}

/**
 * Parse risk level commands
 * "high risk patients", "critical patients"
 */
function parseRiskLevelCommand(normalized: string, transcript: string): ParsedEntity | null {
  const patterns = [
    /(critical|high\s*risk|high)\s+patients?/i,
    /patients?\s+(critical|high\s*risk|high)/i,
    /(?:show\s+)?(?:all\s+)?(critical|high)\s+(?:risk\s+)?patients?/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const riskText = match[1].toLowerCase();
      const riskLevel = riskText.includes('critical') ? 'critical' : 'high';
      return {
        type: 'patient',
        query: `${riskLevel} risk patients`,
        filters: { riskLevel },
        rawTranscript: transcript,
        confidence: 90,
      };
    }
  }
  return null;
}

/**
 * Parse bed commands
 * "bed 205A", "show bed ICU-3"
 */
function parseBedCommand(normalized: string, transcript: string): ParsedEntity | null {
  const patterns = [
    /bed\s+([a-z0-9\-]+)/i,
    /show\s+bed\s+([a-z0-9\-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) {
      return {
        type: 'bed',
        query: match[1].toUpperCase(),
        filters: { bedId: match[1].toUpperCase() },
        rawTranscript: transcript,
        confidence: 90,
      };
    }
  }
  return null;
}

/**
 * Parse room commands
 * "room 302", "show room 205"
 */
function parseRoomCommand(normalized: string, transcript: string): ParsedEntity | null {
  const patterns = [
    /room\s+(\d+[a-z]?)/i,
    /show\s+room\s+(\d+[a-z]?)/i,
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) {
      return {
        type: 'room',
        query: match[1],
        filters: { roomNumber: match[1] },
        rawTranscript: transcript,
        confidence: 90,
      };
    }
  }
  return null;
}

/**
 * Parse provider commands
 * "doctor Smith", "nurse Williams"
 */
function parseProviderCommand(normalized: string, transcript: string): ParsedEntity | null {
  const patterns = [
    /(?:doctor|dr\.?|physician)\s+(.+)/i,
    /(?:nurse)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) {
      return {
        type: 'provider',
        query: match[1].trim(),
        filters: { name: match[1].trim() },
        rawTranscript: transcript,
        confidence: 80,
      };
    }
  }
  return null;
}

/**
 * Parse caregiver commands
 * "caregiver Maria", "family access for patient Smith"
 */
function parseCaregiverCommand(normalized: string, transcript: string): ParsedEntity | null {
  const patterns = [
    /caregiver\s+(.+)/i,
    /family\s+(?:member\s+)?(.+)/i,
    /family\s+access\s+(?:for\s+)?(?:patient\s+)?(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) {
      return {
        type: 'caregiver',
        query: match[1].trim(),
        filters: { name: match[1].trim() },
        rawTranscript: transcript,
        confidence: 80,
      };
    }
  }
  return null;
}

/**
 * Parse patient commands (most general - checked last)
 * "patient Maria LeBlanc", "find patient with MRN 12345"
 */
function parsePatientCommand(normalized: string, transcript: string): ParsedEntity | null {
  const patterns = [
    /patient\s+(.+)/i,
    /(.+)\s+patient$/i,
    /find\s+patient\s+(.+)/i,
    /show\s+patient\s+(.+)/i,
    /look\s*up\s+(.+)/i,
    /search\s+(?:for\s+)?(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) {
      const rawQuery = match[1].trim();
      const filters = parsePatientFilters(rawQuery);
      return {
        type: 'patient',
        query: filters.name || rawQuery,
        filters,
        rawTranscript: transcript,
        confidence: 85,
      };
    }
  }
  return null;
}

/**
 * Parse patient-specific filters from query
 * Handles: name, birthdate, MRN, room
 */
function parsePatientFilters(query: string): ParsedEntity['filters'] {
  const filters: ParsedEntity['filters'] = {};
  let remainingQuery = query;

  // Extract birthdate patterns
  const birthdatePatterns = [
    /(?:birthdate|birth\s*date|born|dob)\s+([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})/i,
    /(?:birthdate|birth\s*date|born|dob)\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
  ];

  for (const pattern of birthdatePatterns) {
    const match = query.match(pattern);
    if (match) {
      const dateStr = parseDateFromMatch(match);
      if (dateStr) {
        filters.dateOfBirth = dateStr;
        remainingQuery = query.replace(match[0], '').trim();
      }
      break;
    }
  }

  // Extract MRN pattern
  const mrnMatch = query.match(/(?:mrn|medical\s*record)\s*#?\s*(\d+)/i);
  if (mrnMatch) {
    filters.mrn = mrnMatch[1];
    remainingQuery = remainingQuery.replace(mrnMatch[0], '').trim();
  }

  // Extract room pattern
  const roomMatch = query.match(/room\s+(\d+[a-z]?)/i);
  if (roomMatch) {
    filters.roomNumber = roomMatch[1];
    remainingQuery = remainingQuery.replace(roomMatch[0], '').trim();
  }

  // Remaining is the name
  const nameParts = remainingQuery.trim().split(/\s+/).filter(p => p.length > 0);
  if (nameParts.length > 0) {
    filters.name = nameParts.join(' ');
    if (nameParts.length >= 2) {
      filters.firstName = nameParts[0];
      filters.lastName = nameParts.slice(1).join(' ');
    } else {
      filters.firstName = nameParts[0];
    }
  }

  return filters;
}

/**
 * Parse date from regex match groups
 */
function parseDateFromMatch(match: RegExpMatchArray): string | null {
  try {
    const monthNames: Record<string, number> = {
      january: 0, jan: 0,
      february: 1, feb: 1,
      march: 2, mar: 2,
      april: 3, apr: 3,
      may: 4,
      june: 5, jun: 5,
      july: 6, jul: 6,
      august: 7, aug: 7,
      september: 8, sep: 8, sept: 8,
      october: 9, oct: 9,
      november: 10, nov: 10,
      december: 11, dec: 11,
    };

    if (isNaN(parseInt(match[1]))) {
      const monthName = match[1].toLowerCase();
      const month = monthNames[monthName];
      if (month !== undefined) {
        const day = parseInt(match[2]);
        let year = parseInt(match[3]);
        if (year < 100) year += year > 50 ? 1900 : 2000;
        const date = new Date(year, month, day);
        return date.toISOString().split('T')[0];
      }
    } else {
      const month = parseInt(match[1]) - 1;
      const day = parseInt(match[2]);
      let year = parseInt(match[3]);
      if (year < 100) year += year > 50 ? 1900 : 2000;
      const date = new Date(year, month, day);
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

// ============================================================================
// ROUTE MAPPING - Entity type to dashboard route
// ============================================================================

export const ENTITY_ROUTES: Record<EntityType, string> = {
  patient: '/admin',
  bed: '/bed-management',
  room: '/bed-management',
  provider: '/admin',
  caregiver: '/admin',
  referral: '/referrals',
  alert: '/clinical-alerts',
  task: '/admin',
  shift: '/shift-handoff',
  handoff: '/shift-handoff',
  medication: '/admin',
  diagnosis: '/admin',
  admission: '/admin',
  discharge: '/admin',
};

// ============================================================================
// PROVIDER
// ============================================================================

export const VoiceActionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentAction, setCurrentAction] = useState<VoiceAction | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHandlers] = useState<Map<EntityType, SearchHandler>>(new Map());

  const generateActionId = () => `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const registerSearchHandler = useCallback((entityType: EntityType, handler: SearchHandler) => {
    searchHandlers.set(entityType, handler);
    auditLogger.debug('VOICE_SEARCH_HANDLER_REGISTERED', { entityType });
  }, [searchHandlers]);

  const unregisterSearchHandler = useCallback((entityType: EntityType) => {
    searchHandlers.delete(entityType);
  }, [searchHandlers]);

  useEffect(() => {
    if (!currentAction || currentAction.status !== 'navigating') return;

    const targetRoute = currentAction.targetRoute;
    const currentPath = location.pathname;

    if (currentPath === targetRoute || currentPath.startsWith(targetRoute)) {
      executeSearch(currentAction);
    }
  }, [location.pathname, currentAction]);

  const executeSearch = async (action: VoiceAction) => {
    setCurrentAction(prev => prev ? { ...prev, status: 'searching' } : null);
    setIsSearching(true);

    try {
      const handler = searchHandlers.get(action.entity.type);

      if (handler) {
        const results = await handler(action.entity);
        setSearchResults(results);
        setCurrentAction(prev => prev ? {
          ...prev,
          status: 'completed',
          results,
        } : null);

        auditLogger.info('VOICE_SEARCH_COMPLETED', {
          entityType: action.entity.type,
          query: action.entity.query,
          resultCount: results.length,
        });

        if (results.length === 1 && results[0].matchScore >= 90) {
          setTimeout(() => {
            selectResult(results[0]);
          }, 500);
        }
      } else {
        const event = new CustomEvent('voiceSearch', {
          detail: {
            entity: action.entity,
            actionId: action.id,
          },
        });
        window.dispatchEvent(event);
        setCurrentAction(prev => prev ? { ...prev, status: 'completed' } : null);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Search failed';
      setCurrentAction(prev => prev ? {
        ...prev,
        status: 'failed',
        error: errorMessage,
      } : null);

      auditLogger.error('VOICE_SEARCH_FAILED', error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsSearching(false);
    }
  };

  const processVoiceInput = useCallback(async (transcript: string, confidence: number) => {
    auditLogger.debug('VOICE_INPUT_PROCESSING', { transcript, confidence });

    const entity = parseVoiceEntity(transcript);

    if (!entity) {
      auditLogger.debug('VOICE_INPUT_NO_ENTITY', { transcript });
      return;
    }

    entity.confidence = Math.min(entity.confidence, confidence * 100);

    const targetRoute = ENTITY_ROUTES[entity.type];

    const action: VoiceAction = {
      id: generateActionId(),
      entity,
      targetRoute,
      status: 'pending',
      timestamp: new Date(),
    };

    setCurrentAction(action);
    setSearchResults([]);

    auditLogger.info('VOICE_ACTION_CREATED', {
      actionId: action.id,
      entityType: entity.type,
      query: entity.query,
      targetRoute,
    });

    const currentPath = location.pathname;
    if (currentPath === targetRoute || currentPath.startsWith(targetRoute)) {
      await executeSearch(action);
    } else {
      setCurrentAction({ ...action, status: 'navigating' });
      navigate(targetRoute);
    }
  }, [location.pathname, navigate]);

  const selectResult = useCallback((result: SearchResult) => {
    auditLogger.info('VOICE_RESULT_SELECTED', {
      resultId: result.id,
      type: result.type,
      primaryText: result.primaryText,
    });

    const event = new CustomEvent('voiceResultSelected', {
      detail: {
        result,
        actionId: currentAction?.id,
      },
    });
    window.dispatchEvent(event);

    setTimeout(() => {
      clearAction();
    }, 300);
  }, [currentAction]);

  const clearAction = useCallback(() => {
    setCurrentAction(null);
    setSearchResults([]);
    setIsSearching(false);
  }, []);

  const value: VoiceActionContextType = {
    currentAction,
    searchResults,
    isSearching,
    processVoiceInput,
    selectResult,
    clearAction,
    registerSearchHandler,
    unregisterSearchHandler,
  };

  return (
    <VoiceActionContext.Provider value={value}>
      {children}
    </VoiceActionContext.Provider>
  );
};

// ============================================================================
// HOOKS
// ============================================================================

export function useVoiceAction(): VoiceActionContextType {
  const context = useContext(VoiceActionContext);
  if (!context) {
    throw new Error('useVoiceAction must be used within VoiceActionProvider');
  }
  return context;
}

export function useVoiceActionSafe(): VoiceActionContextType | null {
  return useContext(VoiceActionContext);
}

export function useVoiceSearchHandler(
  entityType: EntityType,
  handler: SearchHandler,
  deps: React.DependencyList = []
) {
  const context = useVoiceActionSafe();

  useEffect(() => {
    if (!context) return;

    context.registerSearchHandler(entityType, handler);

    return () => {
      context.unregisterSearchHandler(entityType);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, entityType, ...deps]);
}

export default VoiceActionContext;
