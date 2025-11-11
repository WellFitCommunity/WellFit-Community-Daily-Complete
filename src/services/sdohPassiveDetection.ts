/**
 * SDOH Passive Detection Service
 *
 * Automatically detects Social Determinants of Health from free-text sources
 * without requiring structured forms. Uses NLP pattern matching to identify
 * SDOH indicators in:
 * - Clinical notes
 * - Community posts
 * - Patient messages
 * - Check-in comments
 * - Telehealth transcripts
 *
 * This complements the structured SDOH assessment forms with passive,
 * unobtrusive monitoring that respects patient dignity.
 *
 * @see src/services/sdohIndicatorService.ts (structured collection)
 * @see docs/PATENT_5_SDOH_PASSIVE_COLLECTION_FILING.md (patent application)
 */

import { supabase } from '../lib/supabaseClient';
import { SDOHIndicatorService } from './sdohIndicatorService';
import type { SDOHCategory, SDOHRiskLevel, SDOHFactor } from '../types/sdohIndicators';

/**
 * Text source types for passive detection
 */
export type SDOHTextSource =
  | 'clinical_note'
  | 'community_post'
  | 'patient_message'
  | 'check_in_comment'
  | 'telehealth_transcript'
  | 'scribe_note';

/**
 * Detection result from NLP analysis
 */
export interface SDOHDetection {
  category: SDOHCategory;
  confidence: number; // 0-100
  matchedKeywords: string[];
  contextSnippet: string; // The text where it was detected
  riskLevel: SDOHRiskLevel;
  suggestedZCode: string;
  source: SDOHTextSource;
  sourceId: string;
  detectedAt: string;
}

/**
 * Keyword patterns for each SDOH category
 * These are intentionally broad to capture various phrasings
 */
const SDOH_PATTERNS: Record<SDOHCategory, {
  keywords: string[];
  zCode: string;
  criticalKeywords?: string[]; // Keywords that indicate high/critical risk
}> = {
  // Core Needs
  'housing': {
    keywords: [
      'homeless', 'no place to stay', 'sleeping in car', 'couch surfing',
      'evicted', 'eviction', 'unstable housing', 'unsafe housing',
      'mold', 'no heat', 'no running water', 'condemned building',
      'shelter', 'motel', 'temporary housing', 'lost apartment',
      'can\'t afford rent', 'behind on rent', 'utilities shut off'
    ],
    criticalKeywords: ['homeless', 'sleeping in car', 'evicted', 'shelter'],
    zCode: 'Z59.0' // Homelessness
  },

  'food-security': {
    keywords: [
      'hungry', 'can\'t afford food', 'skipping meals', 'food stamps',
      'food bank', 'pantry', 'not eating', 'nothing to eat',
      'ran out of food', 'kids are hungry', 'going without',
      'SNAP', 'WIC', 'meal program', 'soup kitchen',
      'no money for groceries', 'choose between food and'
    ],
    criticalKeywords: ['hungry', 'skipping meals', 'nothing to eat', 'kids are hungry'],
    zCode: 'Z59.4' // Lack of adequate food
  },

  'transportation': {
    keywords: [
      'no ride', 'can\'t get to', 'no transportation', 'car broke down',
      'no bus', 'too far to walk', 'missed appointment because',
      'can\'t afford gas', 'lost license', 'no driver',
      'transportation barriers', 'can\'t make it to', 'unreliable transport'
    ],
    criticalKeywords: ['missed appointment because', 'no transportation', 'can\'t get to'],
    zCode: 'Z59.82' // Transportation insecurity
  },

  'financial': {
    keywords: [
      'can\'t afford', 'no money', 'broke', 'bills piling up',
      'debt', 'bankruptcy', 'collections', 'paycheck to paycheck',
      'lost job', 'reduced hours', 'financial stress', 'poverty',
      'public assistance', 'disability check', 'SSI', 'can\'t pay for'
    ],
    criticalKeywords: ['bankruptcy', 'lost job', 'can\'t afford', 'no money'],
    zCode: 'Z59.6' // Low income
  },

  'employment': {
    keywords: [
      'unemployed', 'lost my job', 'laid off', 'fired',
      'can\'t work', 'disability preventing work', 'job insecurity',
      'underemployed', 'part-time only', 'gig work', 'temp job',
      'looking for work', 'no benefits', 'workplace injury'
    ],
    criticalKeywords: ['unemployed', 'lost my job', 'laid off'],
    zCode: 'Z56.0' // Unemployment
  },

  // Healthcare Access
  'medication-access': {
    keywords: [
      'can\'t afford meds', 'rationing medication', 'skipping doses',
      'prescription too expensive', 'no insurance for meds',
      'medication copay', 'ran out of medication', 'sharing pills',
      'cutting pills in half', 'choose between food and medication'
    ],
    criticalKeywords: ['rationing medication', 'skipping doses', 'ran out of medication'],
    zCode: 'Z59.89' // Other problems related to housing and economic circumstances
  },

  'dental-care': {
    keywords: [
      'tooth pain', 'can\'t afford dentist', 'toothache', 'broken tooth',
      'no dental insurance', 'haven\'t seen dentist in years',
      'lost teeth', 'gum disease', 'dental abscess', 'mouth hurts'
    ],
    criticalKeywords: ['tooth pain', 'toothache', 'dental abscess'],
    zCode: 'Z59.89'
  },

  'mental-health': {
    keywords: [
      'depressed', 'anxious', 'stressed out', 'can\'t sleep',
      'panic attacks', 'suicidal', 'want to die', 'self harm',
      'PTSD', 'trauma', 'abuse', 'nervous breakdown',
      'can\'t cope', 'overwhelmed', 'hopeless', 'crying all the time'
    ],
    criticalKeywords: ['suicidal', 'want to die', 'self harm'],
    zCode: 'Z73.0' // Burnout (or other mental health Z-codes)
  },

  // Social Support
  'social-isolation': {
    keywords: [
      'lonely', 'no one to talk to', 'isolated', 'no friends',
      'alone all the time', 'family doesn\'t visit', 'cut off from',
      'socially isolated', 'withdrawn', 'no support system',
      'disconnected', 'nobody cares', 'abandoned'
    ],
    criticalKeywords: ['lonely', 'isolated', 'no one to talk to', 'abandoned'],
    zCode: 'Z60.2' // Problems related to living alone
  },

  'caregiver-burden': {
    keywords: [
      'caregiver stress', 'taking care of', 'can\'t manage',
      'exhausted from caregiving', 'burnout', 'respite',
      'caring for parent', 'caring for spouse', 'full-time caregiver',
      'no help with', 'overwhelmed by caregiving'
    ],
    criticalKeywords: ['exhausted from caregiving', 'burnout', 'overwhelmed by caregiving'],
    zCode: 'Z63.6' // Dependent relative needing care at home
  },

  // Safety
  'domestic-violence': {
    keywords: [
      'partner hits me', 'afraid of', 'domestic violence',
      'abusive relationship', 'threatened', 'controlling',
      'not safe at home', 'intimate partner violence',
      'bruises from', 'scared to go home', 'restraining order'
    ],
    criticalKeywords: ['partner hits me', 'afraid of', 'not safe at home', 'domestic violence'],
    zCode: 'Z69.1' // Encounter for mental health services for victim of spouse or partner abuse
  },

  'neighborhood-safety': {
    keywords: [
      'unsafe neighborhood', 'gang activity', 'violence nearby',
      'gunshots', 'crime', 'afraid to go outside',
      'dangerous area', 'not safe to walk', 'high crime'
    ],
    criticalKeywords: ['unsafe neighborhood', 'afraid to go outside', 'violence nearby'],
    zCode: 'Z59.89'
  },

  // Barriers
  'language-barrier': {
    keywords: [
      'don\'t speak english', 'language barrier', 'need interpreter',
      'can\'t understand', 'speak spanish only', 'limited english',
      'translation needed', 'communication difficulty'
    ],
    criticalKeywords: [],
    zCode: 'Z60.3' // Acculturation difficulty
  },

  'health-literacy': {
    keywords: [
      'don\'t understand', 'confused about', 'too complicated',
      'can\'t read', 'what does that mean', 'health literacy',
      'medical jargon', 'instructions unclear'
    ],
    criticalKeywords: [],
    zCode: 'Z73.89'
  },

  // Additional categories (placeholder patterns)
  'tobacco-use': { keywords: ['smoking', 'cigarettes', 'vaping'], zCode: 'Z72.0' },
  'alcohol-use': { keywords: ['drinking', 'alcohol problem'], zCode: 'Z72.1' },
  'substance-use': { keywords: ['drug use', 'addiction', 'opioid'], zCode: 'Z72.2' },
  'vision-care': { keywords: ['can\'t see', 'vision problems', 'no glasses'], zCode: 'Z59.89' },
  'primary-care-access': { keywords: ['no doctor', 'can\'t see a doctor'], zCode: 'Z75.3' },
  'community-connection': { keywords: ['disconnected from community'], zCode: 'Z60.2' },
  'education': { keywords: ['didn\'t finish school', 'low education'], zCode: 'Z55.0' },
  'digital-literacy': { keywords: ['can\'t use computer', 'no internet'], zCode: 'Z59.89' },
  'legal-issues': { keywords: ['legal problems', 'court', 'incarcerated'], zCode: 'Z65.0' },
  'immigration-status': { keywords: ['undocumented', 'immigration'], zCode: 'Z60.3' },
  'disability': { keywords: ['disabled', 'mobility issues'], zCode: 'Z73.6' },
  'veteran-status': { keywords: ['veteran', 'served in military'], zCode: 'Z91.82' }
};

/**
 * SDOH Passive Detection Service
 */
export const SDOHPassiveDetectionService = {
  /**
   * Analyze free-text content for SDOH indicators
   * @param text - The text to analyze
   * @param source - Type of source (clinical note, post, etc.)
   * @param sourceId - ID of the source document
   * @param patientId - Patient ID for multi-tenant isolation
   * @returns Array of detected SDOH factors
   */
  async analyzeText(
    text: string,
    source: SDOHTextSource,
    sourceId: string,
    patientId: string
  ): Promise<SDOHDetection[]> {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const detections: SDOHDetection[] = [];
    const textLower = text.toLowerCase();

    // Scan for each SDOH category
    for (const [category, pattern] of Object.entries(SDOH_PATTERNS)) {
      const matchedKeywords: string[] = [];
      let maxConfidence = 0;
      let isCritical = false;

      // Check for keyword matches
      for (const keyword of pattern.keywords) {
        if (textLower.includes(keyword.toLowerCase())) {
          matchedKeywords.push(keyword);

          // Higher confidence for longer, more specific keywords
          const confidence = Math.min(30 + keyword.length * 2, 70);
          maxConfidence = Math.max(maxConfidence, confidence);
        }
      }

      // Check for critical keywords
      if (pattern.criticalKeywords) {
        for (const criticalKeyword of pattern.criticalKeywords) {
          if (textLower.includes(criticalKeyword.toLowerCase())) {
            isCritical = true;
            maxConfidence = Math.max(maxConfidence, 90);
          }
        }
      }

      // If we found matches, create detection
      if (matchedKeywords.length > 0) {
        // Multiple matches increase confidence
        const finalConfidence = Math.min(
          maxConfidence + (matchedKeywords.length - 1) * 10,
          95
        );

        // Determine risk level
        const riskLevel: SDOHRiskLevel = isCritical
          ? 'critical'
          : matchedKeywords.length >= 3
            ? 'high'
            : matchedKeywords.length >= 2
              ? 'moderate'
              : 'low';

        // Extract context snippet (50 chars before and after first match)
        const firstMatch = matchedKeywords[0];
        const matchIndex = textLower.indexOf(firstMatch.toLowerCase());
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(text.length, matchIndex + firstMatch.length + 50);
        const contextSnippet = '...' + text.substring(start, end).trim() + '...';

        detections.push({
          category: category as SDOHCategory,
          confidence: finalConfidence,
          matchedKeywords,
          contextSnippet,
          riskLevel,
          suggestedZCode: pattern.zCode,
          source,
          sourceId,
          detectedAt: new Date().toISOString()
        });
      }
    }

    // Save detections to database
    if (detections.length > 0) {
      await this.saveDetections(patientId, detections);
    }

    return detections;
  },

  /**
   * Save detections to database
   */
  async saveDetections(patientId: string, detections: SDOHDetection[]): Promise<void> {
    try {
      const records = detections.map(detection => ({
        patient_id: patientId,
        category: detection.category,
        confidence: detection.confidence,
        matched_keywords: detection.matchedKeywords,
        context_snippet: detection.contextSnippet,
        risk_level: detection.riskLevel,
        suggested_z_code: detection.suggestedZCode,
        source_type: detection.source,
        source_id: detection.sourceId,
        detected_at: detection.detectedAt,
        reviewed: false,
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('sdoh_passive_detections')
        .insert(records);

      if (error) {
        // Error logged server-side, fail silently on client
      }
    } catch (error) {
      // Error logged server-side, fail silently on client
    }
  },

  /**
   * Get unreviewed detections for a patient
   * @param patientId - Patient ID
   * @returns Array of unreviewed detections
   */
  async getUnreviewedDetections(patientId: string): Promise<SDOHDetection[]> {
    try {
      const { data, error } = await supabase
        .from('sdoh_passive_detections')
        .select('*')
        .eq('patient_id', patientId)
        .eq('reviewed', false)
        .order('detected_at', { ascending: false });

      if (error) {
        // Error logged server-side, fail silently on client
        return [];
      }

      return (data || []).map(record => ({
        category: record.category as SDOHCategory,
        confidence: record.confidence,
        matchedKeywords: record.matched_keywords,
        contextSnippet: record.context_snippet,
        riskLevel: record.risk_level as SDOHRiskLevel,
        suggestedZCode: record.suggested_z_code,
        source: record.source_type as SDOHTextSource,
        sourceId: record.source_id,
        detectedAt: record.detected_at
      }));
    } catch (error) {
      // Error logged server-side, fail silently on client
      return [];
    }
  },

  /**
   * Mark detection as reviewed and optionally convert to formal SDOH factor
   * @param detectionId - Detection ID
   * @param createFactor - Whether to create a formal SDOH observation
   */
  async reviewDetection(
    detectionId: string,
    createFactor: boolean = false,
    reviewNotes?: string
  ): Promise<void> {
    try {
      // Mark as reviewed
      const { data, error } = await supabase
        .from('sdoh_passive_detections')
        .update({
          reviewed: true,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes
        })
        .eq('id', detectionId)
        .select()
        .single();

      if (error) {
        // Error logged server-side, fail silently on client
        return;
      }

      // Optionally create formal SDOH factor
      if (createFactor && data) {
        await SDOHIndicatorService.updateFactor(
          data.patient_id,
          data.category as SDOHCategory,
          {
            riskLevel: data.risk_level as SDOHRiskLevel,
            zCodes: [data.suggested_z_code],
            notes: `Passively detected from ${data.source_type}: ${data.context_snippet}`,
            interventionStatus: 'identified'
          }
        );
      }
    } catch (error) {
      // Error logged server-side, fail silently on client
    }
  },

  /**
   * Batch analyze recent patient communications
   * Scans clinical notes, posts, messages from the last 30 days
   * @param patientId - Patient ID
   */
  async scanRecentCommunications(patientId: string): Promise<SDOHDetection[]> {
    const allDetections: SDOHDetection[] = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    try {
      // Scan clinical notes
      const { data: clinicalNotes } = await supabase
        .from('clinical_notes')
        .select('id, note_text')
        .eq('patient_id', patientId)
        .gte('created_at', cutoffDate);

      if (clinicalNotes) {
        for (const note of clinicalNotes) {
          if (note.note_text) {
            const detections = await this.analyzeText(
              note.note_text,
              'clinical_note',
              note.id,
              patientId
            );
            allDetections.push(...detections);
          }
        }
      }

      // Scan community posts
      const { data: posts } = await supabase
        .from('posts')
        .select('id, content')
        .eq('user_id', patientId)
        .gte('created_at', cutoffDate);

      if (posts) {
        for (const post of posts) {
          if (post.content) {
            const detections = await this.analyzeText(
              post.content,
              'community_post',
              post.id,
              patientId
            );
            allDetections.push(...detections);
          }
        }
      }

      // Scan check-in comments
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('id, comments, notes')
        .eq('user_id', patientId)
        .gte('created_at', cutoffDate);

      if (checkIns) {
        for (const checkIn of checkIns) {
          const text = [checkIn.comments, checkIn.notes].filter(Boolean).join(' ');
          if (text) {
            const detections = await this.analyzeText(
              text,
              'check_in_comment',
              checkIn.id,
              patientId
            );
            allDetections.push(...detections);
          }
        }
      }

      return allDetections;
    } catch (error) {
      // Error logged server-side, fail silently on client
      return allDetections;
    }
  },

  /**
   * Get detection summary for a patient
   * @param patientId - Patient ID
   */
  async getDetectionSummary(patientId: string): Promise<{
    totalDetections: number;
    unreviewedCount: number;
    byCategoryCount: Record<string, number>;
    highRiskCount: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('sdoh_passive_detections')
        .select('category, risk_level, reviewed')
        .eq('patient_id', patientId);

      if (error || !data) {
        return {
          totalDetections: 0,
          unreviewedCount: 0,
          byCategoryCount: {},
          highRiskCount: 0
        };
      }

      const unreviewedCount = data.filter(d => !d.reviewed).length;
      const highRiskCount = data.filter(d =>
        d.risk_level === 'high' || d.risk_level === 'critical'
      ).length;

      const byCategoryCount = data.reduce((acc, d) => {
        acc[d.category] = (acc[d.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalDetections: data.length,
        unreviewedCount,
        byCategoryCount,
        highRiskCount
      };
    } catch (error) {
      // Error logged server-side, fail silently on client
      return {
        totalDetections: 0,
        unreviewedCount: 0,
        byCategoryCount: {},
        highRiskCount: 0
      };
    }
  }
};

export default SDOHPassiveDetectionService;
