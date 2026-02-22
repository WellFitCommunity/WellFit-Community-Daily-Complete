// =====================================================
// HL7 v2.x Parser
// Purpose: Parse HL7 v2.x messages, strip MLLP framing,
//          extract structured data from segments
// =====================================================

import type { HL7Segment, HL7Message, ParseResult } from './types.ts';

/**
 * Strip MLLP (Minimal Lower Layer Protocol) framing from HL7 messages.
 * Removes 0x0B start byte and 0x1C 0x0D end bytes if present.
 */
export function stripMLLP(message: string): string {
  let cleaned = message;
  if (cleaned.charCodeAt(0) === 0x0B) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.endsWith('\x1C\r') || cleaned.endsWith('\x1C\n')) {
    cleaned = cleaned.slice(0, -2);
  } else if (cleaned.endsWith('\x1C')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned.trim();
}

/**
 * Parse a raw HL7 v2.x message into structured data.
 * Handles field/component separators and extracts MSH metadata.
 */
export function parseHL7Message(rawMessage: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const message = stripMLLP(rawMessage);
    const lines = message.split(/\r?\n/).filter(l => l.trim());

    if (lines.length === 0) {
      return { success: false, errors: ['Empty message'], warnings };
    }

    // Parse MSH segment first to get delimiters
    const mshLine = lines.find(l => l.startsWith('MSH'));
    if (!mshLine) {
      return { success: false, errors: ['Missing MSH segment'], warnings };
    }

    const fieldSeparator = mshLine[3] || '|';
    const encodingChars = mshLine.substring(4, 8);
    const componentSeparator = encodingChars[0] || '^';

    const segments: HL7Segment[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const segmentName = line.substring(0, 3);
      const fieldsRaw = line.split(fieldSeparator);

      // For MSH, the separator counts as field 1
      const fields = segmentName === 'MSH'
        ? [segmentName, fieldSeparator, ...fieldsRaw.slice(1)]
        : fieldsRaw;

      segments.push({ name: segmentName, fields });
    }

    // Extract key fields from MSH
    const msh = segments.find(s => s.name === 'MSH');
    if (!msh) {
      return { success: false, errors: ['Could not parse MSH segment'], warnings };
    }

    const messageTypeField = msh.fields[9] || '';
    const messageTypeParts = messageTypeField.split(componentSeparator);
    const messageType = messageTypeParts.length >= 2
      ? `${messageTypeParts[0]}_${messageTypeParts[1]}`
      : messageTypeParts[0] || 'UNKNOWN';

    const parsedMessage: HL7Message = {
      segments,
      messageType,
      messageControlId: msh.fields[10] || '',
      version: msh.fields[12] || '2.5',
      sendingApplication: msh.fields[3] || '',
      sendingFacility: msh.fields[4] || '',
      receivingApplication: msh.fields[5] || '',
      receivingFacility: msh.fields[6] || '',
      dateTime: msh.fields[7] || ''
    };

    // Validate required segments based on message type
    if (messageType.startsWith('ADT')) {
      if (!segments.find(s => s.name === 'PID')) {
        warnings.push('ADT message missing PID segment');
      }
      if (!segments.find(s => s.name === 'PV1')) {
        warnings.push('ADT message missing PV1 segment');
      }
    } else if (messageType.startsWith('ORU')) {
      if (!segments.find(s => s.name === 'OBR')) {
        warnings.push('ORU message missing OBR segment');
      }
    }

    return { success: true, message: parsedMessage, errors, warnings };

  } catch (error: unknown) {
    return {
      success: false,
      errors: [`Parse error: ${error instanceof Error ? error.message : 'Unknown'}`],
      warnings
    };
  }
}

/**
 * Format an HL7 date string (YYYYMMDD or YYYYMMDDHHmm) to ISO format.
 */
export function formatHL7Date(hl7Date?: string): string | undefined {
  if (!hl7Date || hl7Date.length < 8) return undefined;
  const year = hl7Date.substring(0, 4);
  const month = hl7Date.substring(4, 6);
  const day = hl7Date.substring(6, 8);
  if (hl7Date.length >= 12) {
    const hour = hl7Date.substring(8, 10);
    const minute = hl7Date.substring(10, 12);
    return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
  }
  return `${year}-${month}-${day}`;
}

/** Map PV1 discharge status to FHIR encounter status */
export function mapPV1Status(status?: string): string {
  const mapping: Record<string, string> = {
    'P': 'planned', 'A': 'arrived', 'I': 'in-progress',
    'F': 'finished', 'C': 'cancelled'
  };
  return mapping[status || ''] || 'unknown';
}

/** Map OBX observation status to FHIR observation status */
export function mapOBXStatus(status?: string): string {
  const mapping: Record<string, string> = {
    'F': 'final', 'P': 'preliminary', 'C': 'corrected',
    'X': 'cancelled', 'I': 'registered'
  };
  return mapping[status || ''] || 'unknown';
}

/** Map HL7 allergy severity to FHIR severity */
export function mapAllergySeverity(severity?: string): string {
  const mapping: Record<string, string> = {
    'SV': 'severe', 'MO': 'moderate', 'MI': 'mild', 'U': 'mild'
  };
  return mapping[severity || ''] || 'moderate';
}
