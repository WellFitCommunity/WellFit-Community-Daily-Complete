/**
 * SmartScribe Avatar Integration Service
 *
 * Processes SmartScribe transcription output to automatically create
 * pending markers on the patient avatar.
 */

import { auditLogger } from './auditLogger';
import { PatientAvatarService } from './patientAvatarService';
import { supabase } from '../lib/supabaseClient';
import {
  SmartScribeOutputWithEntities,
  SmartScribeAvatarEntity,
  CreateMarkerRequest,
  Laterality,
} from '../types/patientAvatar';
import {
  MARKER_TYPE_LIBRARY as _MARKER_TYPE_LIBRARY,
  findMarkerTypeByKeywords,
  calculateMarkerPosition,
} from '../components/patient-avatar/constants/markerTypeLibrary';

/**
 * Minimum confidence threshold for creating markers
 */
const MIN_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Device insertion keywords for entity detection
 */
const INSERTION_PATTERNS = [
  /placed?\s+(?:a\s+)?(.+?)\s+(?:in|into|at|on)\s+(?:the\s+)?(.+)/i,
  /inserted?\s+(?:a\s+)?(.+?)\s+(?:in|into|at|on)\s+(?:the\s+)?(.+)/i,
  /start(?:ed|ing)?\s+(.+?)\s+(?:access|line)\s+(?:via|in|at)\s+(.+)/i,
  /establish(?:ed)?\s+(.+?)\s+(?:in|at)\s+(?:the\s+)?(.+)/i,
  /put\s+in\s+(?:a\s+)?(.+)/i,
];

/**
 * Device removal keywords
 */
const REMOVAL_PATTERNS = [
  /remov(?:ed|ing)?\s+(?:the\s+)?(.+)/i,
  /discontinu(?:ed|ing)?\s+(?:the\s+)?(.+)/i,
  /pull(?:ed|ing)?\s+(?:the\s+)?(.+)/i,
  /took?\s+out\s+(?:the\s+)?(.+)/i,
  /(.+?)\s+was\s+removed/i,
];

/**
 * Condition mention keywords
 */
const CONDITION_PATTERNS = [
  /(?:patient\s+)?has\s+(?:a\s+)?(?:history\s+of\s+)?(.+)/i,
  /diagnos(?:ed|is)\s+(?:with\s+)?(.+)/i,
  /assessment:\s*(.+)/i,
  /problem\s+list\s+includes?\s+(.+)/i,
  /known\s+(.+)/i,
  /suffers?\s+from\s+(.+)/i,
  /presents?\s+with\s+(.+)/i,
];

/**
 * Laterality detection patterns
 */
const LATERALITY_PATTERNS: { pattern: RegExp; laterality: Laterality }[] = [
  { pattern: /\bleft\b/i, laterality: 'left' },
  { pattern: /\bright\b/i, laterality: 'right' },
  { pattern: /\bbilateral\b/i, laterality: 'bilateral' },
];

/**
 * Detect laterality from text
 */
function detectLaterality(text: string): Laterality | undefined {
  for (const { pattern, laterality } of LATERALITY_PATTERNS) {
    if (pattern.test(text)) {
      return laterality;
    }
  }
  return undefined;
}

/**
 * Extract entities from transcription text
 * This is a simplified version - in production, this would use NLP/AI
 */
export function extractAvatarEntities(
  transcriptText: string
): SmartScribeAvatarEntity[] {
  const entities: SmartScribeAvatarEntity[] = [];
  const sentences = transcriptText.split(/[.!?]+/).filter((s) => s.trim());

  for (const sentence of sentences) {
    const trimmed = sentence.trim();

    // Check for device insertions
    for (const pattern of INSERTION_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        const deviceText = match[1]?.trim();
        const locationText = match[2]?.trim();

        if (deviceText) {
          const markerType = findMarkerTypeByKeywords(deviceText);
          if (markerType) {
            entities.push({
              entity_type: 'device_insertion',
              raw_text: trimmed,
              normalized_type: markerType.type,
              confidence: 0.85, // Base confidence for pattern match
              body_region: locationText || markerType.default_body_region,
              laterality: detectLaterality(trimmed),
              icd10_suggestion: markerType.icd10,
            });
          }
        }
        break;
      }
    }

    // Check for device removals
    for (const pattern of REMOVAL_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        const deviceText = match[1]?.trim();

        if (deviceText) {
          const markerType = findMarkerTypeByKeywords(deviceText);
          if (markerType) {
            entities.push({
              entity_type: 'device_removal',
              raw_text: trimmed,
              normalized_type: markerType.type,
              confidence: 0.85,
              body_region: markerType.default_body_region,
              laterality: detectLaterality(trimmed),
            });
          }
        }
        break;
      }
    }

    // Check for condition mentions
    for (const pattern of CONDITION_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        const conditionText = match[1]?.trim();

        if (conditionText) {
          const markerType = findMarkerTypeByKeywords(conditionText);
          if (markerType && (markerType.category === 'chronic' || markerType.category === 'neurological')) {
            entities.push({
              entity_type: 'condition_mention',
              raw_text: trimmed,
              normalized_type: markerType.type,
              confidence: 0.80,
              body_region: markerType.default_body_region,
              laterality: detectLaterality(trimmed),
              icd10_suggestion: markerType.icd10,
            });
          }
        }
        break;
      }
    }
  }

  return entities;
}

/**
 * Process SmartScribe output and create pending markers
 */
export async function processSmartScribeForAvatar(
  transcriptionOutput: SmartScribeOutputWithEntities
): Promise<{ created: number; removed: number; errors: string[] }> {
  const {
    patient_id,
    provider_id,
    detected_avatar_entities,
    transcription_id,
  } = transcriptionOutput;

  const result = { created: 0, removed: 0, errors: [] as string[] };

  if (!patient_id || !detected_avatar_entities?.length) {
    return result;
  }

  for (const entity of detected_avatar_entities) {
    try {
      // Skip low confidence detections
      if (entity.confidence < MIN_CONFIDENCE_THRESHOLD) {
        continue;
      }

      // Find matching marker type
      const markerType = findMarkerTypeByKeywords(entity.normalized_type);
      if (!markerType) {
        continue;
      }

      // Handle removals
      if (entity.entity_type === 'device_removal') {
        const removeResult = await PatientAvatarService.deactivateMarkersByType(
          patient_id,
          markerType.type,
          entity.body_region,
          provider_id
        );

        if (removeResult.success) {
          result.removed += removeResult.data;
          auditLogger.info('SMARTSCRIBE_MARKER_REMOVED', {
            patient_id,
            marker_type: markerType.type,
            count: removeResult.data,
          });
        }
        continue;
      }

      // Calculate position
      const position = calculateMarkerPosition(markerType, entity.laterality);

      // Create pending marker
      const createRequest: CreateMarkerRequest = {
        patient_id,
        category: markerType.category,
        marker_type: markerType.type,
        display_name: markerType.display_name,
        body_region: entity.body_region || markerType.default_body_region,
        position_x: position.x,
        position_y: position.y,
        body_view: markerType.default_body_view,
        source: 'smartscribe',
        source_transcription_id: transcription_id,
        status: 'pending_confirmation',
        confidence_score: entity.confidence,
        details: {
          insertion_date: new Date().toISOString(),
          raw_smartscribe_text: entity.raw_text,
          icd10_code: entity.icd10_suggestion || markerType.icd10,
          severity_stage: entity.severity_stage,
        },
        requires_attention: true,
      };

      const createResult = await PatientAvatarService.createMarker(
        createRequest,
        provider_id
      );

      if (createResult.success) {
        result.created++;
        auditLogger.info('SMARTSCRIBE_MARKER_CREATED', {
          patient_id,
          marker_id: createResult.data.id,
          marker_type: markerType.type,
          confidence: entity.confidence,
        });
      } else {
        result.errors.push(createResult.error.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(errorMessage);
      auditLogger.error('SMARTSCRIBE_AVATAR_PROCESSING_ERROR', err as Error, {
        patient_id,
        entity,
      });
    }
  }

  return result;
}

/**
 * AI-powered entity extraction via edge function
 *
 * Calls the ai-avatar-entity-extractor edge function for context-aware
 * extraction with dynamic confidence. Falls back to regex on failure.
 */
interface AIExtractionResponse {
  entities: Array<{
    entity_type: string;
    raw_text: string;
    normalized_type: string;
    confidence: number;
    reasoning?: string;
    body_region?: string;
    laterality?: string;
    icd10_suggestion?: string;
  }>;
  fallback: boolean;
}

export async function extractAvatarEntitiesWithAI(
  transcriptText: string,
  patientId: string,
  tenantId?: string
): Promise<SmartScribeAvatarEntity[]> {
  try {
    const { data, error } = await supabase.functions.invoke<AIExtractionResponse>(
      'ai-avatar-entity-extractor',
      {
        body: { transcriptText, patientId, tenantId },
      }
    );

    if (error) {
      auditLogger.warn('AI_AVATAR_EXTRACTION_EDGE_ERROR', {
        error: error.message,
        patientId,
      });
      // Fall back to regex
      return extractAvatarEntities(transcriptText);
    }

    if (!data || data.fallback || !data.entities || data.entities.length === 0) {
      auditLogger.info('AI_AVATAR_EXTRACTION_FALLBACK', {
        reason: data?.fallback ? 'ai_failed' : 'no_entities',
        patientId,
      });
      // Fall back to regex
      return extractAvatarEntities(transcriptText);
    }

    // Map AI response to SmartScribeAvatarEntity
    const entities: SmartScribeAvatarEntity[] = data.entities.map((e) => ({
      entity_type: e.entity_type as SmartScribeAvatarEntity['entity_type'],
      raw_text: e.raw_text,
      normalized_type: e.normalized_type,
      confidence: e.confidence,
      body_region: e.body_region,
      laterality: e.laterality as Laterality | undefined,
      icd10_suggestion: e.icd10_suggestion,
    }));

    auditLogger.info('AI_AVATAR_EXTRACTION_SUCCESS', {
      patientId,
      entityCount: entities.length,
    });

    return entities;
  } catch (err: unknown) {
    auditLogger.error(
      'AI_AVATAR_EXTRACTION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { patientId }
    );
    // Fall back to regex
    return extractAvatarEntities(transcriptText);
  }
}

/**
 * Integration hook for SmartScribe
 *
 * Call this function when a SmartScribe transcription is completed
 * to automatically detect and create avatar markers.
 *
 * Uses AI extraction (Claude Haiku) with regex fallback.
 */
export async function onSmartScribeComplete(
  transcriptionId: string,
  patientId: string,
  providerId: string,
  transcriptText: string
): Promise<{ created: number; removed: number; errors: string[] }> {
  // Extract entities using AI (falls back to regex automatically)
  const entities = await extractAvatarEntitiesWithAI(transcriptText, patientId);

  if (entities.length === 0) {
    return { created: 0, removed: 0, errors: [] };
  }

  // Process entities
  return processSmartScribeForAvatar({
    transcription_id: transcriptionId,
    patient_id: patientId,
    provider_id: providerId,
    transcript_text: transcriptText,
    detected_avatar_entities: entities,
  });
}

/**
 * Export for use in SmartScribe hook
 */
export const SmartScribeAvatarIntegration = {
  extractAvatarEntities,
  extractAvatarEntitiesWithAI,
  processSmartScribeForAvatar,
  onSmartScribeComplete,
  MIN_CONFIDENCE_THRESHOLD,
};

export default SmartScribeAvatarIntegration;
