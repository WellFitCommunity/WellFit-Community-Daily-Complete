/**
 * Voice Action Context — General Entity Parsers
 *
 * Parsers for: risk level, bed, room, provider, caregiver, patient
 * Plus patient filter helpers (name, DOB, MRN parsing).
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import type { ParsedEntity } from './types';

/**
 * Parse risk level commands
 * "high risk patients", "critical patients"
 */
export function parseRiskLevelCommand(normalized: string, transcript: string): ParsedEntity | null {
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
 * Parse bed commands — "bed 205A", "show bed ICU-3"
 */
export function parseBedCommand(_normalized: string, transcript: string): ParsedEntity | null {
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
 * Parse room commands — "room 302", "show room 205"
 */
export function parseRoomCommand(_normalized: string, transcript: string): ParsedEntity | null {
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
 * Parse provider commands — "doctor Smith", "nurse Williams"
 */
export function parseProviderCommand(_normalized: string, transcript: string): ParsedEntity | null {
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
 * Parse caregiver commands — "caregiver Maria", "family access for patient Smith"
 */
export function parseCaregiverCommand(_normalized: string, transcript: string): ParsedEntity | null {
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
export function parsePatientCommand(_normalized: string, transcript: string): ParsedEntity | null {
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
