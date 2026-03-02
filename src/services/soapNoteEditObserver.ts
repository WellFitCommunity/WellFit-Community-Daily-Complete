/**
 * SOAP Note Edit Observer
 *
 * Detects and analyzes edits made by physicians to AI-generated SOAP notes.
 * Uses word-level diffing to extract style patterns for the physician style profiler.
 *
 * Part of Compass Riley Ambient Learning Session 2.
 */

import { diffWords } from 'diff';
import { auditLogger } from './auditLogger';

// ============================================================================
// Types
// ============================================================================

type SOAPSectionName = 'subjective' | 'objective' | 'assessment' | 'plan' | 'hpi' | 'ros';

/** Simple SOAP note shape (matches useSmartScribe SOAPNote type) */
export interface SOAPNoteContent {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  hpi?: string;
  ros?: string;
}

/** Diff analysis for a single SOAP section */
export interface SOAPSectionDiff {
  section: SOAPSectionName;
  originalText: string;
  editedText: string;
  wordCountDelta: number;
  addedPhrases: string[];
  removedPhrases: string[];
  terminologyReplacements: Array<{
    aiTerm: string;
    physicianTerm: string;
  }>;
  wasModified: boolean;
}

/** Complete edit analysis for one SOAP note editing session */
export interface SOAPEditAnalysis {
  sessionId: string;
  providerId: string;
  timestamp: string;
  sectionDiffs: SOAPSectionDiff[];
  overallVerbosityDelta: number;
  sectionsModified: SOAPSectionName[];
  sectionsExpanded: SOAPSectionName[];
  sectionsCondensed: SOAPSectionName[];
  totalTerminologyReplacements: number;
}

// ============================================================================
// Core Analysis
// ============================================================================

const SOAP_SECTIONS: SOAPSectionName[] = ['subjective', 'objective', 'assessment', 'plan', 'hpi', 'ros'];

/**
 * Compare AI-generated SOAP note with physician-edited version.
 * Returns structured diff analysis for style profiling.
 */
export function analyzeSOAPEdits(
  original: SOAPNoteContent,
  edited: SOAPNoteContent,
  sessionId: string,
  providerId: string
): SOAPEditAnalysis {
  const sectionDiffs: SOAPSectionDiff[] = [];
  const sectionsModified: SOAPSectionName[] = [];
  const sectionsExpanded: SOAPSectionName[] = [];
  const sectionsCondensed: SOAPSectionName[] = [];
  let overallVerbosityDelta = 0;
  let totalTerminologyReplacements = 0;

  for (const section of SOAP_SECTIONS) {
    const originalText = original[section] || '';
    const editedText = edited[section] || '';

    const diff = analyzeSectionDiff(section, originalText, editedText);
    sectionDiffs.push(diff);

    if (diff.wasModified) {
      sectionsModified.push(section);
      overallVerbosityDelta += diff.wordCountDelta;
      totalTerminologyReplacements += diff.terminologyReplacements.length;

      if (diff.wordCountDelta > 0) {
        sectionsExpanded.push(section);
      } else if (diff.wordCountDelta < 0) {
        sectionsCondensed.push(section);
      }
    }
  }

  const analysis: SOAPEditAnalysis = {
    sessionId,
    providerId,
    timestamp: new Date().toISOString(),
    sectionDiffs,
    overallVerbosityDelta,
    sectionsModified,
    sectionsExpanded,
    sectionsCondensed,
    totalTerminologyReplacements,
  };

  auditLogger.info('SOAP_EDIT_ANALYZED', {
    sessionId,
    providerId,
    sectionsModified: sectionsModified.length,
    verbosityDelta: overallVerbosityDelta,
    terminologyReplacements: totalTerminologyReplacements,
  });

  return analysis;
}

// ============================================================================
// Section Diff
// ============================================================================

/**
 * Compute diff for a single SOAP section.
 */
function analyzeSectionDiff(
  section: SOAPSectionName,
  originalText: string,
  editedText: string
): SOAPSectionDiff {
  // Check if modified (trim to ignore whitespace-only changes)
  const wasModified = originalText.trim() !== editedText.trim();

  if (!wasModified) {
    return {
      section,
      originalText,
      editedText,
      wordCountDelta: 0,
      addedPhrases: [],
      removedPhrases: [],
      terminologyReplacements: [],
      wasModified: false,
    };
  }

  const changes = diffWords(originalText, editedText);

  const addedPhrases: string[] = [];
  const removedPhrases: string[] = [];

  for (const change of changes) {
    const trimmed = change.value.trim();
    if (!trimmed) continue;

    if (change.added) {
      addedPhrases.push(trimmed);
    } else if (change.removed) {
      removedPhrases.push(trimmed);
    }
  }

  const originalWordCount = countWords(originalText);
  const editedWordCount = countWords(editedText);
  const wordCountDelta = editedWordCount - originalWordCount;

  const terminologyReplacements = extractTerminologyReplacements(changes);

  return {
    section,
    originalText,
    editedText,
    wordCountDelta,
    addedPhrases,
    removedPhrases,
    terminologyReplacements,
    wasModified: true,
  };
}

// ============================================================================
// Terminology Replacement Detection
// ============================================================================

/** Maximum words in a replacement pair (longer = likely a rewrite, not a term swap) */
const MAX_REPLACEMENT_WORDS = 4;

/**
 * Extract terminology replacements from word-level diffs.
 * Detects patterns where removed words are immediately followed by added words
 * (indicating the physician swapped one term for another).
 */
function extractTerminologyReplacements(
  changes: Array<{ added?: boolean; removed?: boolean; value: string }>
): Array<{ aiTerm: string; physicianTerm: string }> {
  const replacements: Array<{ aiTerm: string; physicianTerm: string }> = [];

  for (let i = 0; i < changes.length - 1; i++) {
    const current = changes[i];
    const next = changes[i + 1];

    // Look for removed→added pairs (term swap pattern)
    if (current.removed && next.added) {
      const aiTerm = current.value.trim();
      const physicianTerm = next.value.trim();

      // Only count as replacement if both sides are short (term swaps, not rewrites)
      if (
        aiTerm &&
        physicianTerm &&
        countWords(aiTerm) <= MAX_REPLACEMENT_WORDS &&
        countWords(physicianTerm) <= MAX_REPLACEMENT_WORDS
      ) {
        replacements.push({ aiTerm, physicianTerm });
      }
    }
  }

  return replacements;
}

// ============================================================================
// Helpers
// ============================================================================

/** Count words in a string */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
