// supabase/functions/process-vital-image/parsers.ts
// Deterministic vital-sign parsers + physiological-range validation.
// These are the trust boundary for the vision OCR pipeline: whatever the
// vision model transcribes, only values passing these range checks ever
// reach the client as a "reading". Extracted from index.ts (600-line rule).

import { createLogger } from "../_shared/auditLogger.ts";

const parserLogger = createLogger("process-vital-image:parsers");

export interface VitalReading {
  type: 'blood_pressure' | 'glucose' | 'weight' | 'heart_rate' | 'temperature' | 'pulse_oximeter';
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  value?: number;
  unit?: string;
  confidence: number;
}

/**
 * Parse OCR text to extract vital readings
 * Handles common display formats from medical devices
 */
export function parseVitalText(text: string, vitalType: string): VitalReading | null {
  // Whitespace normalization only. Input is a clean labeled transcription from
  // Claude vision ("SYS 142 DIA 86") — char-substitution "OCR fixes" (S→5, l→1)
  // would mangle the labels themselves (SpO2 → 5p02) and break parsing.
  const normalized = text
    .replace(/\s+/g, ' ')
    .trim();

  parserLogger.debug("Parsing OCR text", { vitalType, normalizedLength: normalized.length });

  switch (vitalType) {
    case 'blood_pressure':
      return parseBloodPressure(normalized);
    case 'glucose':
      return parseGlucose(normalized);
    case 'weight':
      return parseWeight(normalized);
    case 'heart_rate':
      return parseHeartRate(normalized);
    case 'pulse_oximeter':
      return parsePulseOximeter(normalized);
    case 'temperature':
      return parseTemperature(normalized);
    default:
      return parseBloodPressure(normalized); // Default to BP
  }
}

/**
 * Parse blood pressure reading (e.g., "142/86" or "SYS 142 DIA 86 PUL 78")
 */
function parseBloodPressure(text: string): VitalReading | null {
  // Pattern 1: Simple format "142/86" or "142 / 86"
  const simplePattern = /(\d{2,3})\s*[\/\-]\s*(\d{2,3})/;
  const simpleMatch = text.match(simplePattern);

  if (simpleMatch) {
    const sys = parseInt(simpleMatch[1], 10);
    const dia = parseInt(simpleMatch[2], 10);

    // Validate ranges
    if (sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150) {
      // Look for pulse nearby
      const pulsePattern = /(?:pulse|pul|hr|bpm)[:\s]*(\d{2,3})/i;
      const pulseMatch = text.match(pulsePattern);
      const pulse = pulseMatch ? parseInt(pulseMatch[1], 10) : undefined;

      return {
        type: 'blood_pressure',
        systolic: sys,
        diastolic: dia,
        pulse: pulse && pulse >= 30 && pulse <= 220 ? pulse : undefined,
        unit: 'mmHg',
        confidence: 0.8
      };
    }
  }

  // Pattern 2: Labeled format "SYS 142 DIA 86"
  const labeledSysPattern = /(?:sys|systolic)[:\s]*(\d{2,3})/i;
  const labeledDiaPattern = /(?:dia|diastolic)[:\s]*(\d{2,3})/i;
  const sysMatch = text.match(labeledSysPattern);
  const diaMatch = text.match(labeledDiaPattern);

  if (sysMatch && diaMatch) {
    const sys = parseInt(sysMatch[1], 10);
    const dia = parseInt(diaMatch[1], 10);

    if (sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150) {
      const pulsePattern = /(?:pulse|pul|hr|bpm)[:\s]*(\d{2,3})/i;
      const pulseMatch = text.match(pulsePattern);
      const pulse = pulseMatch ? parseInt(pulseMatch[1], 10) : undefined;

      return {
        type: 'blood_pressure',
        systolic: sys,
        diastolic: dia,
        pulse: pulse && pulse >= 30 && pulse <= 220 ? pulse : undefined,
        unit: 'mmHg',
        confidence: 0.9
      };
    }
  }

  // Pattern 3: Just three numbers in a row (common on digital displays)
  const threeNumbers = text.match(/(\d{2,3})\D+(\d{2,3})\D+(\d{2,3})/);
  if (threeNumbers) {
    const nums = [
      parseInt(threeNumbers[1], 10),
      parseInt(threeNumbers[2], 10),
      parseInt(threeNumbers[3], 10)
    ].sort((a, b) => b - a); // Sort descending

    // Largest is systolic, middle is diastolic, smallest is pulse
    const [sys, dia, pulse] = nums;

    if (sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150 && pulse >= 30 && pulse <= 220) {
      return {
        type: 'blood_pressure',
        systolic: sys,
        diastolic: dia,
        pulse: pulse,
        unit: 'mmHg',
        confidence: 0.6 // Lower confidence for inferred order
      };
    }
  }

  return null;
}

/**
 * Parse glucose reading (e.g., "126 mg/dL" or "126")
 */
function parseGlucose(text: string): VitalReading | null {
  const pattern = /(\d{2,3})\s*(?:mg\/?dl)?/i;
  const match = text.match(pattern);

  if (match) {
    const value = parseInt(match[1], 10);
    if (value >= 40 && value <= 600) {
      return {
        type: 'glucose',
        value: value,
        unit: 'mg/dL',
        confidence: 0.85
      };
    }
  }

  return null;
}

/**
 * Parse weight reading (e.g., "185.4 lbs" or "185")
 */
function parseWeight(text: string): VitalReading | null {
  const pattern = /(\d{2,3}(?:\.\d)?)\s*(?:lbs?|pounds?|kg)?/i;
  const match = text.match(pattern);

  if (match) {
    const value = parseFloat(match[1]);
    if (value >= 50 && value <= 500) {
      return {
        type: 'weight',
        value: value,
        unit: 'lbs',
        confidence: 0.85
      };
    }
  }

  return null;
}

/**
 * Parse heart rate reading (e.g., "78 bpm" or "78")
 */
function parseHeartRate(text: string): VitalReading | null {
  const pattern = /(\d{2,3})\s*(?:bpm|beats?)?/i;
  const match = text.match(pattern);

  if (match) {
    const value = parseInt(match[1], 10);
    if (value >= 30 && value <= 220) {
      return {
        type: 'heart_rate',
        value: value,
        unit: 'bpm',
        confidence: 0.85
      };
    }
  }

  return null;
}

/**
 * Parse pulse oximeter reading (e.g., "98%" or "SpO2 98")
 */
function parsePulseOximeter(text: string): VitalReading | null {
  const pattern = /(?:spo2|o2|sat)?[:\s]*(\d{2,3})\s*%?/i;
  const match = text.match(pattern);

  if (match) {
    const value = parseInt(match[1], 10);
    if (value >= 50 && value <= 100) {
      return {
        type: 'pulse_oximeter',
        value: value,
        unit: '%',
        confidence: 0.85
      };
    }
  }

  return null;
}

/**
 * Parse temperature reading (e.g., "98.6 F" or "98.6")
 */
function parseTemperature(text: string): VitalReading | null {
  const pattern = /(\d{2,3}(?:\.\d)?)\s*(?:°?[fF])?/;
  const match = text.match(pattern);

  if (match) {
    const value = parseFloat(match[1]);
    if (value >= 90 && value <= 110) {
      return {
        type: 'temperature',
        value: value,
        unit: '°F',
        confidence: 0.85
      };
    }
  }

  return null;
}
