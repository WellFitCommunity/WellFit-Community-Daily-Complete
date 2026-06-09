/**
 * Syndromic Surveillance — Helper functions
 *
 * HL7 date/time formatting, message control IDs, and surveillance-category mapping.
 * Extracted from syndromicSurveillanceService.ts (god-file decomposition).
 */

import { SURVEILLANCE_CATEGORIES } from './constants';

export function generateMessageControlId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `WF${timestamp}${random}`.toUpperCase();
}

export function formatHL7DateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function formatHL7Date(dateStr: string): string {
  const date = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/**
 * Determine surveillance category based on diagnosis codes
 */
export function determineSurveillanceCategory(diagnosisCodes: string[]): string | null {
  for (const [category, codePatterns] of Object.entries(SURVEILLANCE_CATEGORIES)) {
    for (const code of diagnosisCodes) {
      const codePrefix = code.substring(0, 3);
      if (codePatterns.some(pattern => code.startsWith(pattern) || codePrefix === pattern)) {
        return category;
      }
    }
  }
  return null;
}
