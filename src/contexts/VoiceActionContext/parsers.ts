/**
 * Voice Action Context — Entity Parsers
 *
 * Natural language understanding for healthcare voice commands.
 * Each parser handles a specific entity type (alerts, tasks, referrals, etc.)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import type { ParsedEntity } from './types';
import { DIAGNOSIS_ALIASES, MEDICATION_ALIASES, UNIT_ALIASES } from './medicalAliases';
import {
  parseRiskLevelCommand,
  parseBedCommand,
  parseRoomCommand,
  parseProviderCommand,
  parseCaregiverCommand,
  parsePatientCommand,
} from './parsersGeneral';

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

      if (/critical|urgent/.test(normalized)) {
        filters.priority = 'critical';
      } else if (/high/.test(normalized)) {
        filters.priority = 'high';
      }

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

      if (/pending|open|incomplete/.test(normalized)) {
        filters.status = 'pending';
      }

      if (/today/.test(normalized)) {
        filters.timeframe = 'today';
      } else if (/this\s+shift/.test(normalized)) {
        filters.timeframe = 'this_shift';
      }

      if (/urgent|stat|priority/.test(normalized)) {
        filters.priority = 'urgent';
      }

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

      if (/pending|new/.test(normalized)) {
        filters.status = 'pending';
      } else if (/active/.test(normalized)) {
        filters.status = 'active';
      }

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

      if (/day\s+shift/.test(normalized)) {
        filters.shiftType = 'day';
      } else if (/night\s+shift/.test(normalized)) {
        filters.shiftType = 'night';
      } else {
        filters.shiftType = 'current';
      }

      const nurseMatch = normalized.match(/(?:for\s+)?(?:nurse\s+)(\w+)/i);
      if (nurseMatch) {
        filters.assignedTo = nurseMatch[1];
      }

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

      if (/today/.test(normalized)) {
        filters.timeframe = 'today';
      } else if (/this\s+shift/.test(normalized)) {
        filters.timeframe = 'this_shift';
      } else if (/yesterday/.test(normalized)) {
        filters.timeframe = 'yesterday';
      } else if (/this\s+week/.test(normalized)) {
        filters.timeframe = 'this_week';
      }

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

