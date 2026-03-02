/**
 * Physician Style Profiler
 *
 * Builds and maintains a documentation style fingerprint for each physician
 * based on how they edit AI-generated SOAP notes over time.
 *
 * Uses Exponential Moving Average (EMA) so recent edits carry more weight
 * while older patterns decay naturally.
 *
 * Part of Compass Riley Ambient Learning Session 2.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { SOAPEditAnalysis, SOAPSectionDiff } from './soapNoteEditObserver';

// ============================================================================
// Types
// ============================================================================

export type VerbosityPreference = 'terse' | 'moderate' | 'verbose';

export interface SectionEmphasis {
  subjective: number;
  objective: number;
  assessment: number;
  plan: number;
  hpi: number;
  ros: number;
}

export interface TerminologyOverride {
  aiTerm: string;
  physicianPreferred: string;
  frequency: number;
  lastSeen: string;
  medicalDomain?: string;
}

export interface PhysicianStyleProfile {
  providerId: string;
  preferredVerbosity: VerbosityPreference;
  verbosityScore: number;
  sectionEmphasis: SectionEmphasis;
  terminologyOverrides: TerminologyOverride[];
  avgNoteWordCount: number;
  avgEditTimeSeconds: number;
  specialtyDetected: string | null;
  sessionsAnalyzed: number;
  lastAnalyzedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

/** EMA smoothing factor — 0.2 means 20% weight on new data */
const EMA_ALPHA = 0.2;

/** Maximum terminology overrides to store per provider */
const MAX_TERMINOLOGY_OVERRIDES = 200;

/** Minimum sessions before surfacing the style profile to the physician */
export const MIN_SESSIONS_FOR_DISPLAY = 3;

const DEFAULT_SECTION_EMPHASIS: SectionEmphasis = {
  subjective: 0,
  objective: 0,
  assessment: 0,
  plan: 0,
  hpi: 0,
  ros: 0,
};

// ============================================================================
// Core Methods
// ============================================================================

/**
 * Load the physician's current style profile from Supabase.
 */
export async function loadStyleProfile(
  providerId: string
): Promise<PhysicianStyleProfile | null> {
  try {
    const { data, error } = await supabase
      .from('physician_style_profiles')
      .select('provider_id, preferred_verbosity, verbosity_score, section_emphasis, terminology_overrides, avg_note_word_count, avg_edit_time_seconds, specialty_detected, sessions_analyzed, last_analyzed_at, created_at, updated_at')
      .eq('provider_id', providerId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      providerId: data.provider_id,
      preferredVerbosity: data.preferred_verbosity as VerbosityPreference,
      verbosityScore: Number(data.verbosity_score),
      sectionEmphasis: (data.section_emphasis || DEFAULT_SECTION_EMPHASIS) as SectionEmphasis,
      terminologyOverrides: (data.terminology_overrides || []) as TerminologyOverride[],
      avgNoteWordCount: Number(data.avg_note_word_count),
      avgEditTimeSeconds: Number(data.avg_edit_time_seconds),
      specialtyDetected: data.specialty_detected,
      sessionsAnalyzed: data.sessions_analyzed,
      lastAnalyzedAt: data.last_analyzed_at || new Date().toISOString(),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err: unknown) {
    auditLogger.error(
      'STYLE_PROFILE_LOAD_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { providerId }
    );
    return null;
  }
}

/**
 * Update the physician's style profile with data from a new SOAP edit analysis.
 * Uses EMA to weight recent sessions more heavily.
 */
export async function updateStyleProfile(
  providerId: string,
  editAnalysis: SOAPEditAnalysis
): Promise<PhysicianStyleProfile | null> {
  try {
    const existing = await loadStyleProfile(providerId);

    const newSessionCount = (existing?.sessionsAnalyzed ?? 0) + 1;

    // EMA verbosity score
    const prevVerbosity = existing?.verbosityScore ?? 0;
    const newVerbosityScore = emaUpdate(prevVerbosity, editAnalysis.overallVerbosityDelta, EMA_ALPHA);
    const clampedVerbosity = Math.max(-100, Math.min(100, newVerbosityScore));

    // Section emphasis
    const prevEmphasis = existing?.sectionEmphasis ?? { ...DEFAULT_SECTION_EMPHASIS };
    const newEmphasis = updateSectionEmphasis(prevEmphasis, editAnalysis.sectionDiffs);

    // Terminology overrides
    const prevOverrides = existing?.terminologyOverrides ?? [];
    const newReplacements = editAnalysis.sectionDiffs.flatMap(d => d.terminologyReplacements);
    const mergedOverrides = mergeTerminologyOverrides(prevOverrides, newReplacements);

    // Specialty detection
    const detectedSpecialty = detectSpecialty(mergedOverrides);

    // Average note word count (EMA)
    const editedWordCount = editAnalysis.sectionDiffs.reduce((sum, d) => {
      const words = d.editedText.trim().split(/\s+/).length;
      return sum + (d.editedText.trim() ? words : 0);
    }, 0);
    const prevAvgWords = existing?.avgNoteWordCount ?? editedWordCount;
    const newAvgWords = emaUpdate(prevAvgWords, editedWordCount, EMA_ALPHA);

    const profile: PhysicianStyleProfile = {
      providerId,
      preferredVerbosity: classifyVerbosity(clampedVerbosity),
      verbosityScore: clampedVerbosity,
      sectionEmphasis: newEmphasis,
      terminologyOverrides: mergedOverrides,
      avgNoteWordCount: newAvgWords,
      avgEditTimeSeconds: existing?.avgEditTimeSeconds ?? 0,
      specialtyDetected: detectedSpecialty,
      sessionsAnalyzed: newSessionCount,
      lastAnalyzedAt: new Date().toISOString(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Upsert to database
    const { error } = await supabase
      .from('physician_style_profiles')
      .upsert({
        provider_id: providerId,
        preferred_verbosity: profile.preferredVerbosity,
        verbosity_score: profile.verbosityScore,
        section_emphasis: profile.sectionEmphasis,
        terminology_overrides: profile.terminologyOverrides,
        avg_note_word_count: profile.avgNoteWordCount,
        avg_edit_time_seconds: profile.avgEditTimeSeconds,
        specialty_detected: profile.specialtyDetected,
        sessions_analyzed: profile.sessionsAnalyzed,
        last_analyzed_at: profile.lastAnalyzedAt,
        updated_at: profile.updatedAt,
      }, { onConflict: 'provider_id' });

    if (error) {
      auditLogger.error('STYLE_PROFILE_SAVE_FAILED', error, { providerId });
      return null;
    }

    auditLogger.info('STYLE_PROFILE_UPDATED', {
      providerId,
      sessionsAnalyzed: profile.sessionsAnalyzed,
      verbosity: profile.preferredVerbosity,
      verbosityScore: Math.round(profile.verbosityScore),
      specialtyDetected: profile.specialtyDetected,
      terminologyCount: profile.terminologyOverrides.length,
    });

    return profile;
  } catch (err: unknown) {
    auditLogger.error(
      'STYLE_PROFILE_UPDATE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { providerId }
    );
    return null;
  }
}

// ============================================================================
// Verbosity Classification
// ============================================================================

/**
 * Classify verbosity preference based on accumulated verbosity score.
 * Score ranges: terse [-100, -15), moderate [-15, +15], verbose (+15, +100]
 */
function classifyVerbosity(score: number): VerbosityPreference {
  if (score < -15) return 'terse';
  if (score > 15) return 'verbose';
  return 'moderate';
}

// ============================================================================
// Section Emphasis
// ============================================================================

/**
 * Update section emphasis using EMA.
 * Each section's emphasis is a running average of normalized word count delta.
 */
function updateSectionEmphasis(
  current: SectionEmphasis,
  diffs: SOAPSectionDiff[]
): SectionEmphasis {
  const updated = { ...current };

  for (const diff of diffs) {
    if (!diff.wasModified) continue;

    const section = diff.section;
    if (!(section in updated)) continue;

    // Normalize delta by original length to get proportional change
    const originalWords = diff.originalText.trim().split(/\s+/).length;
    const normalizedDelta = originalWords > 0
      ? diff.wordCountDelta / originalWords
      : 0;

    // Clamp to [-1, 1] range
    const clampedDelta = Math.max(-1, Math.min(1, normalizedDelta));

    // EMA update
    const key = section as keyof SectionEmphasis;
    updated[key] = emaUpdate(updated[key], clampedDelta, EMA_ALPHA);
    updated[key] = Math.max(-1, Math.min(1, updated[key]));
  }

  return updated;
}

// ============================================================================
// Terminology Overrides
// ============================================================================

/**
 * Merge new terminology replacements into existing overrides.
 * Increments frequency for known replacements, adds new ones.
 * Caps at MAX_TERMINOLOGY_OVERRIDES by pruning oldest low-frequency entries.
 */
function mergeTerminologyOverrides(
  existing: TerminologyOverride[],
  newReplacements: Array<{ aiTerm: string; physicianTerm: string }>
): TerminologyOverride[] {
  const merged = [...existing];
  const now = new Date().toISOString();

  for (const { aiTerm, physicianTerm } of newReplacements) {
    const normalizedAi = aiTerm.toLowerCase();
    const normalizedPhysician = physicianTerm.toLowerCase();

    const idx = merged.findIndex(
      o => o.aiTerm.toLowerCase() === normalizedAi &&
        o.physicianPreferred.toLowerCase() === normalizedPhysician
    );

    if (idx >= 0) {
      merged[idx].frequency++;
      merged[idx].lastSeen = now;
    } else {
      merged.push({
        aiTerm,
        physicianPreferred: physicianTerm,
        frequency: 1,
        lastSeen: now,
      });
    }
  }

  // Prune if over limit — keep highest frequency, then most recent
  if (merged.length > MAX_TERMINOLOGY_OVERRIDES) {
    merged.sort((a, b) => {
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    });
    merged.length = MAX_TERMINOLOGY_OVERRIDES;
  }

  return merged;
}

// ============================================================================
// Specialty Detection
// ============================================================================

/** Keyword-based specialty detection (best-effort, not clinical-grade) */
const SPECIALTY_KEYWORDS: Record<string, string[]> = {
  cardiology: ['cardiac', 'ecg', 'ekg', 'htn', 'chf', 'afib', 'mi', 'cath', 'stent', 'murmur', 'ejection', 'troponin', 'bnp', 'pci'],
  neurology: ['neuro', 'seizure', 'stroke', 'tpa', 'ct head', 'mri brain', 'eeg', 'neuropathy', 'ms', 'parkinson', 'cranial nerve'],
  pulmonology: ['copd', 'asthma', 'pft', 'intubat', 'ventilat', 'pneumonia', 'pleural', 'bronch', 'spo2', 'abg', 'fev1'],
  endocrinology: ['a1c', 'insulin', 'thyroid', 'tsh', 'glucose', 'dka', 'diabetes', 'cortisol', 'pituitary', 'adrenal'],
  gastroenterology: ['gi', 'egd', 'colonoscopy', 'gerd', 'hepat', 'cirrhosis', 'pancreat', 'crohn', 'ibd', 'bilirubin'],
  orthopedics: ['fracture', 'joint', 'arthroplast', 'meniscus', 'ligament', 'rom', 'dexa', 'osteo', 'spine', 'msk'],
  psychiatry: ['phq', 'gad', 'ssri', 'snri', 'psychosis', 'bipolar', 'anxiety', 'depression', 'suicid', 'ideation'],
  pediatrics: ['pediatric', 'developmental', 'vaccination', 'well-child', 'growth chart', 'percentile', 'milestone'],
  emergency: ['trauma', 'triage', 'resuscitat', 'code blue', 'intubat', 'cpr', 'lac', 'suture', 'splint'],
};

/**
 * Detect medical specialty from accumulated terminology overrides.
 * Returns the specialty with the most keyword matches, or null if insufficient data.
 */
function detectSpecialty(overrides: TerminologyOverride[]): string | null {
  if (overrides.length < 5) return null;

  const allTerms = overrides
    .flatMap(o => [o.aiTerm, o.physicianPreferred])
    .map(t => t.toLowerCase())
    .join(' ');

  const scores: Record<string, number> = {};

  for (const [specialty, keywords] of Object.entries(SPECIALTY_KEYWORDS)) {
    let count = 0;
    for (const keyword of keywords) {
      if (allTerms.includes(keyword)) {
        count++;
      }
    }
    if (count > 0) {
      scores[specialty] = count;
    }
  }

  const entries = Object.entries(scores);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1] - a[1]);
  // Only detect if top specialty has at least 3 keyword matches
  return entries[0][1] >= 3 ? entries[0][0] : null;
}

// ============================================================================
// Helpers
// ============================================================================

/** Exponential Moving Average update */
function emaUpdate(current: number, newValue: number, alpha: number): number {
  return alpha * newValue + (1 - alpha) * current;
}
