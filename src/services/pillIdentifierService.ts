/**
 * Pill Identifier Service
 *
 * AI-powered visual pill identification using Claude Vision
 * Helps seniors verify medications match their labels for safety
 *
 * Features:
 * - Visual pill identification using Claude Vision
 * - Integration with NIH Pillbox API for validation
 * - Mismatch detection between pill appearance and label
 * - Safety alerts for potential medication errors
 *
 * @module pillIdentifierService
 * @version 1.0.0
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PillCharacteristics {
  // Physical appearance
  shape?: string; // round, oval, oblong, capsule, etc.
  color?: string | string[]; // single or multiple colors
  size?: string; // approximate size in mm
  imprint?: string; // text/numbers on pill
  score?: boolean; // has a score line for splitting

  // Pill type
  formulation?: string; // tablet, capsule, gel-cap, etc.
  coating?: string; // film-coated, sugar-coated, uncoated

  // Visual details
  texture?: string; // smooth, rough, scored
  surfaceFeatures?: string[]; // embossed, debossed, logo, etc.

  // Confidence
  imageQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  visualConfidence?: number; // 0.0 to 1.0
}

export interface PillIdentification {
  // Primary identification
  medicationName?: string;
  genericName?: string;
  brandName?: string;

  // Dosage
  strength?: string;
  dosageForm?: string;

  // Matching characteristics
  characteristics: PillCharacteristics;

  // Drug codes
  ndcCode?: string; // National Drug Code
  rxcui?: string; // RxNorm Concept Unique Identifier

  // Multiple possible matches
  alternativeMatches?: Array<{
    medicationName: string;
    strength?: string;
    confidence: number;
    ndcCode?: string;
  }>;

  // Metadata
  confidence: number; // Overall confidence 0.0 to 1.0
  identificationMethod: 'visual_ai' | 'pillbox_api' | 'hybrid';
  identificationNotes?: string;
  warnings?: string[];
}

export interface PillIdentificationResult {
  success: boolean;
  identification?: PillIdentification;
  error?: string;
  processingTimeMs: number;
  modelUsed?: string;
  apiSources?: string[]; // Which APIs were consulted
}

export interface PillLabelComparison {
  pillIdentification: PillIdentification;
  labelInformation: {
    medicationName: string;
    strength?: string;
    ndcCode?: string;
  };
  match: boolean;
  matchConfidence: number; // 0.0 to 1.0
  discrepancies: Array<{
    field: string;
    pillValue: string;
    labelValue: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
  safetyRecommendation: string;
  requiresPharmacistReview: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Claude API Configuration
  MODEL: process.env.REACT_APP_CLAUDE_DEFAULT_MODEL || 'claude-haiku-4-5-20250919', // Haiku 4.5 for fast pill identification
  MAX_TOKENS: 4000,

  // Image constraints
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],

  // NIH Pillbox API (optional - requires signup at http://pillbox.nlm.nih.gov/signup.html)
  PILLBOX_API_ENDPOINT: 'https://rximage.nlm.nih.gov/api/rximage/1/rxnav',
  PILLBOX_API_KEY: process.env.REACT_APP_PILLBOX_API_KEY,

  // Match thresholds
  HIGH_CONFIDENCE_THRESHOLD: 0.85,
  MODERATE_CONFIDENCE_THRESHOLD: 0.70,
  MISMATCH_ALERT_THRESHOLD: 0.60,

  // Retry configuration
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
};

// ============================================================================
// PILL IDENTIFIER SERVICE
// ============================================================================

export class PillIdentifierService {
  private anthropic: Anthropic | null = null;
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.REACT_APP_ANTHROPIC_API_KEY || null;

    if (this.apiKey) {
      this.anthropic = new Anthropic({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true
      });
    }
  }

  /**
   * Validate image before processing
   */
  private validateImage(file: File): { isValid: boolean; error?: string } {
    if (file.size > CONFIG.MAX_IMAGE_SIZE) {
      return {
        isValid: false,
        error: `Image size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size`
      };
    }

    if (!CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
      return {
        isValid: false,
        error: `Invalid file type: ${file.type}`
      };
    }

    return { isValid: true };
  }

  /**
   * Convert image file to base64
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Identify pill from image using AI visual analysis
   */
  async identifyPillFromImage(imageFile: File): Promise<PillIdentificationResult> {
    const startTime = Date.now();

    try {
      // Validate API key
      if (!this.anthropic || !this.apiKey) {
        return {
          success: false,
          error: 'Anthropic API key not configured',
          processingTimeMs: Date.now() - startTime
        };
      }

      // Validate image
      const validation = this.validateImage(imageFile);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
          processingTimeMs: Date.now() - startTime
        };
      }

      // Convert image to base64
      const base64Image = await this.fileToBase64(imageFile);

      // Build prompt for pill identification
      const prompt = this.buildPillIdentificationPrompt();

      // Call Claude Vision API
      const response = await this.anthropic.messages.create({
        model: CONFIG.MODEL,
        max_tokens: CONFIG.MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageFile.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      });

      // Parse response
      const content = response.content[0];
      if (content.type === 'text') {
        const identification = this.parseAIResponse(content.text);

        // Optionally enhance with Pillbox API if available
        let enhancedIdentification = identification;
        const apiSources = ['claude_vision'];

        if (identification.characteristics.imprint && CONFIG.PILLBOX_API_KEY) {
          try {
            const pillboxData = await this.queryPillboxAPI(identification.characteristics);
            if (pillboxData) {
              enhancedIdentification = this.mergeIdentifications(identification, pillboxData);
              apiSources.push('nih_pillbox');
            }
          } catch (error) {
            console.warn('Pillbox API query failed, using AI-only results:', error);
          }
        }

        return {
          success: true,
          identification: enhancedIdentification,
          processingTimeMs: Date.now() - startTime,
          modelUsed: CONFIG.MODEL,
          apiSources
        };
      } else {
        throw new Error('Unexpected response format from Claude API');
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Build the AI prompt for pill identification
   */
  private buildPillIdentificationPrompt(): string {
    return `You are an expert pharmacist specializing in pill identification for medication safety. Analyze this pill image and provide comprehensive identification details.

CRITICAL CONTEXT:
This is for a senior medication safety feature. Many seniors accidentally mix pills between bottles, so accurate identification is essential to prevent dangerous medication errors.

INSTRUCTIONS:
1. Carefully examine the pill's physical characteristics
2. Look for ANY text, numbers, or markings (imprints) on the pill
3. Note the shape, color, size, and any distinctive features
4. If you can identify the medication, provide the name and strength
5. If uncertain, list the most likely candidates
6. NEVER guess - if unclear, indicate low confidence

REQUIRED JSON FORMAT (return ONLY valid JSON, no markdown):
{
  "medicationName": "name if identifiable, or null",
  "genericName": "generic name if known",
  "brandName": "brand name if known",
  "strength": "e.g., 10mg, 500mg",
  "dosageForm": "tablet, capsule, etc.",
  "characteristics": {
    "shape": "round, oval, oblong, capsule, etc.",
    "color": "white" or ["blue", "white"] for multi-colored,
    "size": "approximate size in mm or relative (small/medium/large)",
    "imprint": "EXACT text/numbers visible on pill - CRITICAL FOR IDENTIFICATION",
    "score": true/false (has score line for splitting),
    "formulation": "immediate release, extended release, etc.",
    "coating": "film-coated, uncoated, etc.",
    "texture": "smooth, rough, etc.",
    "surfaceFeatures": ["embossed text", "logo", etc.],
    "imageQuality": "excellent/good/fair/poor",
    "visualConfidence": 0.95
  },
  "ndcCode": "if identifiable from imprint",
  "alternativeMatches": [
    {
      "medicationName": "possible alternative",
      "strength": "10mg",
      "confidence": 0.75,
      "ndcCode": "if known"
    }
  ],
  "confidence": 0.85,
  "identificationMethod": "visual_ai",
  "identificationNotes": "Clear imprint visible, high confidence match",
  "warnings": ["Safety warnings or concerns if any"]
}

CRITICAL SAFETY GUIDELINES:
- Imprint codes are THE MOST IMPORTANT identifier - examine carefully
- If the pill has no visible imprint, note this explicitly
- For capsules, check for imprints on both halves
- If image quality is poor, set imageQuality to "poor" and lower confidence
- Include warnings about look-alike medications
- If multiple pills match, list them in alternativeMatches

CONFIDENCE SCORING:
- 0.9-1.0: Imprint clearly visible and matches known database
- 0.7-0.9: Strong visual match but imprint partially obscured
- 0.5-0.7: Characteristics match but no imprint visible
- 0.0-0.5: Poor image quality or ambiguous identification

Now analyze the pill image and return the JSON:`;
  }

  /**
   * Parse AI response into PillIdentification
   */
  private parseAIResponse(responseText: string): PillIdentification {
    try {
      // Remove markdown code blocks if present
      let jsonText = responseText.trim();
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      // Parse JSON
      const parsed = JSON.parse(jsonText);

      // Build PillIdentification object
      const identification: PillIdentification = {
        medicationName: parsed.medicationName || undefined,
        genericName: parsed.genericName || undefined,
        brandName: parsed.brandName || undefined,
        strength: parsed.strength || undefined,
        dosageForm: parsed.dosageForm || undefined,
        characteristics: parsed.characteristics || {},
        ndcCode: parsed.ndcCode || undefined,
        rxcui: parsed.rxcui || undefined,
        alternativeMatches: parsed.alternativeMatches || [],
        confidence: typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
        identificationMethod: parsed.identificationMethod || 'visual_ai',
        identificationNotes: parsed.identificationNotes || undefined,
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : []
      };

      return identification;

    } catch (error) {
      // Return minimal identification on parse error
      return {
        characteristics: {
          imageQuality: 'poor',
          visualConfidence: 0.0
        },
        confidence: 0.0,
        identificationMethod: 'visual_ai',
        identificationNotes: `Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        warnings: ['Unable to analyze pill image properly']
      };
    }
  }

  /**
   * Query NIH Pillbox API for additional validation
   * (Requires API key from http://pillbox.nlm.nih.gov/signup.html)
   */
  private async queryPillboxAPI(characteristics: PillCharacteristics): Promise<Partial<PillIdentification> | null> {
    if (!CONFIG.PILLBOX_API_KEY) {
      return null;
    }

    try {
      // Build query parameters based on characteristics
      const params = new URLSearchParams();

      if (characteristics.imprint) {
        params.append('name', characteristics.imprint);
      }

      if (characteristics.shape) {
        params.append('shape', characteristics.shape);
      }

      if (typeof characteristics.color === 'string') {
        params.append('color', characteristics.color);
      } else if (Array.isArray(characteristics.color) && characteristics.color.length > 0) {
        params.append('color', characteristics.color[0]);
      }

      // Note: Actual Pillbox API endpoint and parameters may vary
      // This is a placeholder implementation
      const response = await fetch(
        `${CONFIG.PILLBOX_API_ENDPOINT}?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${CONFIG.PILLBOX_API_KEY}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Pillbox API error: ${response.status}`);
      }

      const data = await response.json();

      // Parse Pillbox response and return standardized format
      // Note: Actual response structure depends on Pillbox API documentation
      if (data && data.results && data.results.length > 0) {
        const topResult = data.results[0];
        return {
          medicationName: topResult.name,
          genericName: topResult.generic_name,
          ndcCode: topResult.ndc,
          rxcui: topResult.rxcui,
          strength: topResult.strength
        };
      }

      return null;

    } catch (error) {
      console.error('Pillbox API query failed:', error);
      return null;
    }
  }

  /**
   * Merge AI and Pillbox API results
   */
  private mergeIdentifications(
    aiResult: PillIdentification,
    pillboxResult: Partial<PillIdentification>
  ): PillIdentification {
    return {
      ...aiResult,
      medicationName: pillboxResult.medicationName || aiResult.medicationName,
      genericName: pillboxResult.genericName || aiResult.genericName,
      ndcCode: pillboxResult.ndcCode || aiResult.ndcCode,
      rxcui: pillboxResult.rxcui || aiResult.rxcui,
      strength: pillboxResult.strength || aiResult.strength,
      identificationMethod: 'hybrid',
      confidence: Math.min(1.0, aiResult.confidence + 0.1), // Boost confidence when validated by API
      identificationNotes: `${aiResult.identificationNotes || ''}\nValidated against NIH Pillbox database.`
    };
  }

  /**
   * Compare pill identification with medication label
   */
  async comparePillWithLabel(
    pillImage: File,
    labelInformation: {
      medicationName: string;
      strength?: string;
      ndcCode?: string;
    }
  ): Promise<PillLabelComparison> {
    // Identify the pill
    const pillResult = await this.identifyPillFromImage(pillImage);

    if (!pillResult.success || !pillResult.identification) {
      return {
        pillIdentification: {
          characteristics: {},
          confidence: 0.0,
          identificationMethod: 'visual_ai',
          warnings: ['Failed to identify pill from image']
        },
        labelInformation,
        match: false,
        matchConfidence: 0.0,
        discrepancies: [{
          field: 'identification',
          pillValue: 'Unable to identify',
          labelValue: labelInformation.medicationName,
          severity: 'critical'
        }],
        safetyRecommendation: 'CRITICAL: Cannot verify medication. Do not take this medication. Contact your pharmacist immediately.',
        requiresPharmacistReview: true
      };
    }

    const identification = pillResult.identification;
    const discrepancies: PillLabelComparison['discrepancies'] = [];
    let matchScore = 0;
    let totalChecks = 0;

    // Compare medication name
    if (identification.medicationName && labelInformation.medicationName) {
      totalChecks++;
      const nameMatch = this.fuzzyMatch(
        identification.medicationName,
        labelInformation.medicationName
      );

      if (nameMatch > 0.8) {
        matchScore++;
      } else {
        discrepancies.push({
          field: 'medicationName',
          pillValue: identification.medicationName,
          labelValue: labelInformation.medicationName,
          severity: nameMatch < 0.5 ? 'critical' : 'warning'
        });
      }
    }

    // Compare strength
    if (identification.strength && labelInformation.strength) {
      totalChecks++;
      const strengthMatch = this.fuzzyMatch(
        identification.strength,
        labelInformation.strength
      );

      if (strengthMatch > 0.8) {
        matchScore++;
      } else {
        discrepancies.push({
          field: 'strength',
          pillValue: identification.strength,
          labelValue: labelInformation.strength,
          severity: 'critical'
        });
      }
    }

    // Compare NDC code if available
    if (identification.ndcCode && labelInformation.ndcCode) {
      totalChecks++;
      if (identification.ndcCode === labelInformation.ndcCode) {
        matchScore++;
      } else {
        discrepancies.push({
          field: 'ndcCode',
          pillValue: identification.ndcCode,
          labelValue: labelInformation.ndcCode,
          severity: 'critical'
        });
      }
    }

    // Calculate match confidence
    const matchConfidence = totalChecks > 0
      ? (matchScore / totalChecks) * identification.confidence
      : 0.0;

    const match = matchConfidence >= CONFIG.MISMATCH_ALERT_THRESHOLD && discrepancies.length === 0;

    // Generate safety recommendation
    let safetyRecommendation: string;
    let requiresPharmacistReview = false;

    if (match && matchConfidence >= CONFIG.HIGH_CONFIDENCE_THRESHOLD) {
      safetyRecommendation = 'VERIFIED: Pill matches label information. Safe to take as prescribed.';
    } else if (matchConfidence >= CONFIG.MODERATE_CONFIDENCE_THRESHOLD) {
      safetyRecommendation = 'CAUTION: Pill appears to match label but verification confidence is moderate. Consider consulting your pharmacist for confirmation.';
      requiresPharmacistReview = true;
    } else {
      safetyRecommendation = 'ALERT: Pill may not match label information. DO NOT TAKE until verified by a pharmacist. This could be a different medication.';
      requiresPharmacistReview = true;
    }

    return {
      pillIdentification: identification,
      labelInformation,
      match,
      matchConfidence,
      discrepancies,
      safetyRecommendation,
      requiresPharmacistReview
    };
  }

  /**
   * Fuzzy string matching for medication names
   */
  private fuzzyMatch(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.85;

    // Simple Levenshtein-based similarity
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;

    const distance = this.levenshteinDistance(s1, s2);
    return 1.0 - (distance / maxLen);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Batch identify multiple pills
   */
  async identifyMultiplePills(images: File[]): Promise<PillIdentificationResult[]> {
    const results: PillIdentificationResult[] = [];

    for (const image of images) {
      const result = await this.identifyPillFromImage(image);
      results.push(result);

      // Add delay to avoid rate limits
      if (images.length > 1) {
        await this.delay(500);
      }
    }

    return results;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const pillIdentifier = new PillIdentifierService();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format pill characteristics for display
 */
export function formatPillDescription(characteristics: PillCharacteristics): string {
  const parts: string[] = [];

  if (characteristics.color) {
    const color = Array.isArray(characteristics.color)
      ? characteristics.color.join(' and ')
      : characteristics.color;
    parts.push(color);
  }

  if (characteristics.shape) {
    parts.push(characteristics.shape);
  }

  if (characteristics.formulation) {
    parts.push(characteristics.formulation);
  }

  if (characteristics.imprint) {
    parts.push(`with imprint "${characteristics.imprint}"`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No characteristics identified';
}

/**
 * Get severity color for UI
 */
export function getSeverityColor(severity: 'critical' | 'warning' | 'info'): string {
  switch (severity) {
    case 'critical':
      return 'red';
    case 'warning':
      return 'orange';
    case 'info':
      return 'blue';
  }
}

export default pillIdentifier;
