/**
 * Medication Label Reader Service
 *
 * Enterprise-grade service for extracting medication information from images
 * using Claude Vision API with comprehensive error handling and validation
 *
 * @module medicationLabelReader
 * @version 1.0.0
 */

import { loadAnthropicSDK } from './anthropicLoader';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface MedicationInfo {
  // Primary medication information
  medicationName: string;
  genericName?: string;
  brandName?: string;

  // Dosage information
  dosage?: string;
  dosageForm?: string; // tablet, capsule, liquid, cream, etc.
  strength?: string;

  // Instructions
  instructions?: string;
  frequency?: string;
  route?: string; // oral, topical, injection, etc.

  // Prescription information
  prescribedBy?: string;
  prescribedDate?: string;
  prescriptionNumber?: string;

  // Pharmacy information
  pharmacyName?: string;
  pharmacyPhone?: string;

  // Refill information
  quantity?: number;
  refillsRemaining?: number;
  lastRefillDate?: string;
  nextRefillDate?: string;

  // Drug codes
  ndcCode?: string; // National Drug Code

  // Additional information
  purpose?: string;
  sideEffects?: string[];
  warnings?: string[];
  interactions?: string[];

  // Extraction metadata
  confidence: number; // 0.0 to 1.0
  extractionNotes?: string;
  needsReview: boolean;
}

export interface LabelExtractionResult {
  success: boolean;
  medication?: MedicationInfo;
  error?: string;
  processingTimeMs: number;
  modelUsed: string;
  rawResponse?: any;
}

export interface ImageValidation {
  isValid: boolean;
  error?: string;
  fileSize?: number;
  fileType?: string;
  dimensions?: { width: number; height: number };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Claude API Configuration
  MODEL: process.env.REACT_APP_CLAUDE_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
  MAX_TOKENS: 4000,
  TIMEOUT: 60000, // 60 seconds

  // Image constraints
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  MIN_CONFIDENCE_THRESHOLD: 0.7,

  // Retry configuration
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
};

// ============================================================================
// MEDICATION LABEL READER SERVICE
// ============================================================================

export class MedicationLabelReaderService {
  private anthropic: any = null;
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.REACT_APP_ANTHROPIC_API_KEY || null;

    if (this.apiKey) {
      loadAnthropicSDK().then((Anthropic: any) => {
        this.anthropic = new Anthropic({
          apiKey: this.apiKey,
          dangerouslyAllowBrowser: true // For client-side usage
        });
      });
    }
  }

  /**
   * Validate image before processing
   */
  validateImage(file: File): ImageValidation {
    // Check file size
    if (file.size > CONFIG.MAX_IMAGE_SIZE) {
      return {
        isValid: false,
        error: `Image size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${CONFIG.MAX_IMAGE_SIZE / 1024 / 1024}MB`,
        fileSize: file.size
      };
    }

    // Check file type
    if (!CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
      return {
        isValid: false,
        error: `Invalid file type: ${file.type}. Allowed types: ${CONFIG.ALLOWED_MIME_TYPES.join(', ')}`,
        fileType: file.type
      };
    }

    return {
      isValid: true,
      fileSize: file.size,
      fileType: file.type
    };
  }

  /**
   * Convert image file to base64 for Claude API
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };

      reader.onerror = () => {
        reject(new Error('Failed to read image file'));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Extract medication information from label image
   */
  async extractFromImage(imageFile: File): Promise<LabelExtractionResult> {
    const startTime = Date.now();

    try {
      // Validate API key
      if (!this.anthropic || !this.apiKey) {
        return {
          success: false,
          error: 'Anthropic API key not configured. Please set REACT_APP_ANTHROPIC_API_KEY in your environment.',
          processingTimeMs: Date.now() - startTime,
          modelUsed: CONFIG.MODEL
        };
      }

      // Validate image
      const validation = this.validateImage(imageFile);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
          processingTimeMs: Date.now() - startTime,
          modelUsed: CONFIG.MODEL
        };
      }

      // Convert image to base64
      const base64Image = await this.fileToBase64(imageFile);

      // Prepare the prompt
      const prompt = this.buildExtractionPrompt();

      // Call Claude Vision API with retry logic
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= CONFIG.MAX_RETRY_ATTEMPTS; attempt++) {
        try {
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

          // Parse the response
          const content = response.content[0];
          if (content.type === 'text') {
            const medicationInfo = this.parseClaudeResponse(content.text);

            return {
              success: true,
              medication: medicationInfo,
              processingTimeMs: Date.now() - startTime,
              modelUsed: CONFIG.MODEL,
              rawResponse: response
            };
          } else {
            throw new Error('Unexpected response format from Claude API');
          }

        } catch (error) {
          lastError = error as Error;

          // If it's a rate limit error, wait and retry
          if (error instanceof Error && error.message.includes('rate_limit')) {
            await this.delay(CONFIG.RETRY_DELAY_MS * attempt);
            continue;
          }

          // For other errors, don't retry
          break;
        }
      }

      // All retries failed
      return {
        success: false,
        error: `Failed after ${CONFIG.MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message || 'Unknown error'}`,
        processingTimeMs: Date.now() - startTime,
        modelUsed: CONFIG.MODEL
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTimeMs: Date.now() - startTime,
        modelUsed: CONFIG.MODEL
      };
    }
  }

  /**
   * Build the extraction prompt for Claude
   */
  private buildExtractionPrompt(): string {
    return `You are an expert pharmacist and medical information extraction specialist. Analyze this medication label image and extract ALL relevant information.

IMPORTANT INSTRUCTIONS:
1. Extract EXACTLY what you see on the label - do not make assumptions
2. If information is not visible or unclear, set the field to null
3. Be especially careful with dosage, strength, and instructions
4. Return ONLY valid JSON - no markdown, no explanations, no additional text
5. Assign a confidence score (0.0 to 1.0) based on label clarity

REQUIRED JSON FORMAT:
{
  "medicationName": "exact name from label",
  "genericName": "generic name if shown",
  "brandName": "brand name if different from medication name",
  "dosage": "e.g., 500mg, 10ml",
  "dosageForm": "e.g., tablet, capsule, liquid, cream",
  "strength": "e.g., 500mg",
  "instructions": "exact instructions from label",
  "frequency": "e.g., twice daily, every 8 hours",
  "route": "e.g., oral, topical, injection",
  "prescribedBy": "prescribing doctor name",
  "prescribedDate": "YYYY-MM-DD format if visible",
  "prescriptionNumber": "Rx number",
  "pharmacyName": "pharmacy name",
  "pharmacyPhone": "pharmacy phone",
  "quantity": number of pills/doses,
  "refillsRemaining": number,
  "lastRefillDate": "YYYY-MM-DD",
  "nextRefillDate": "YYYY-MM-DD (calculate if last refill + 30 days)",
  "ndcCode": "National Drug Code if visible",
  "purpose": "what the medication is for",
  "sideEffects": ["array", "of", "side effects if listed"],
  "warnings": ["array", "of", "warnings if listed"],
  "interactions": ["array", "of", "interactions if listed"],
  "confidence": 0.95,
  "extractionNotes": "any notes about extraction quality, unclear areas, or assumptions made",
  "needsReview": false (set to true if confidence < 0.7 or critical info is unclear)
}

CONFIDENCE SCORING GUIDELINES:
- 0.9-1.0: Label is crystal clear, all key information visible
- 0.7-0.9: Most information clear, minor blur or obscured text
- 0.5-0.7: Significant portions unclear, many assumptions needed
- 0.0-0.5: Label severely damaged, obscured, or illegible

CRITICAL SAFETY NOTES:
- If dosage or strength is unclear, flag needsReview as true
- If instructions are ambiguous, note this in extractionNotes
- Never guess on numerical values - use null if uncertain

Now analyze the medication label image and return the JSON:`;
  }

  /**
   * Parse Claude's response into MedicationInfo
   */
  private parseClaudeResponse(responseText: string): MedicationInfo {
    try {
      // Remove markdown code blocks if present
      let jsonText = responseText.trim();
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      // Parse JSON
      const parsed = JSON.parse(jsonText);

      // Validate required fields
      if (!parsed.medicationName) {
        throw new Error('Medication name is required but was not extracted');
      }

      // Ensure confidence is a number between 0 and 1
      const confidence = typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5;

      // Build MedicationInfo object with defaults
      const medicationInfo: MedicationInfo = {
        medicationName: parsed.medicationName,
        genericName: parsed.genericName || undefined,
        brandName: parsed.brandName || undefined,
        dosage: parsed.dosage || undefined,
        dosageForm: parsed.dosageForm || undefined,
        strength: parsed.strength || undefined,
        instructions: parsed.instructions || undefined,
        frequency: parsed.frequency || undefined,
        route: parsed.route || undefined,
        prescribedBy: parsed.prescribedBy || undefined,
        prescribedDate: parsed.prescribedDate || undefined,
        prescriptionNumber: parsed.prescriptionNumber || undefined,
        pharmacyName: parsed.pharmacyName || undefined,
        pharmacyPhone: parsed.pharmacyPhone || undefined,
        quantity: parsed.quantity || undefined,
        refillsRemaining: parsed.refillsRemaining || undefined,
        lastRefillDate: parsed.lastRefillDate || undefined,
        nextRefillDate: parsed.nextRefillDate || undefined,
        ndcCode: parsed.ndcCode || undefined,
        purpose: parsed.purpose || undefined,
        sideEffects: Array.isArray(parsed.sideEffects) ? parsed.sideEffects : undefined,
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : undefined,
        interactions: Array.isArray(parsed.interactions) ? parsed.interactions : undefined,
        confidence,
        extractionNotes: parsed.extractionNotes || undefined,
        needsReview: parsed.needsReview || confidence < CONFIG.MIN_CONFIDENCE_THRESHOLD
      };

      return medicationInfo;

    } catch (error) {
      // If parsing fails, return a low-confidence result
      return {
        medicationName: 'Unable to extract medication name',
        confidence: 0.0,
        extractionNotes: `Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        needsReview: true
      };
    }
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Batch process multiple medication images
   */
  async extractFromMultipleImages(images: File[]): Promise<LabelExtractionResult[]> {
    const results: LabelExtractionResult[] = [];

    for (const image of images) {
      const result = await this.extractFromImage(image);
      results.push(result);

      // Add a small delay between requests to avoid rate limits
      if (images.length > 1) {
        await this.delay(500);
      }
    }

    return results;
  }

  /**
   * Re-process a medication with user corrections
   */
  async refineExtraction(
    originalImage: File,
    userCorrections: Partial<MedicationInfo>
  ): Promise<LabelExtractionResult> {
    const result = await this.extractFromImage(originalImage);

    if (result.success && result.medication) {
      // Merge user corrections with AI extraction
      result.medication = {
        ...result.medication,
        ...userCorrections,
        extractionNotes: `${result.medication.extractionNotes || ''}\nUser corrections applied: ${Object.keys(userCorrections).join(', ')}`,
        needsReview: false // User has reviewed it
      };
    }

    return result;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const medicationLabelReader = new MedicationLabelReaderService();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format medication info for display
 */
export function formatMedicationDisplay(med: MedicationInfo): string {
  const parts: string[] = [];

  parts.push(med.medicationName);

  if (med.strength) {
    parts.push(`${med.strength}`);
  }

  if (med.dosageForm) {
    parts.push(`(${med.dosageForm})`);
  }

  if (med.instructions) {
    parts.push(`- ${med.instructions}`);
  }

  return parts.join(' ');
}

/**
 * Check if medication needs refill soon
 */
export function needsRefillSoon(med: MedicationInfo, daysThreshold: number = 7): boolean {
  if (!med.nextRefillDate) return false;

  const nextRefill = new Date(med.nextRefillDate);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + daysThreshold);

  return nextRefill <= threshold;
}

/**
 * Validate medication information completeness
 */
export function validateMedicationInfo(med: MedicationInfo): {
  isComplete: boolean;
  missingFields: string[];
  criticalMissing: boolean;
} {
  const requiredFields = ['medicationName', 'dosage', 'instructions'];
  const criticalFields = ['medicationName', 'dosage'];

  const missingFields: string[] = [];
  let criticalMissing = false;

  for (const field of requiredFields) {
    if (!med[field as keyof MedicationInfo]) {
      missingFields.push(field);
      if (criticalFields.includes(field)) {
        criticalMissing = true;
      }
    }
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    criticalMissing
  };
}

export default medicationLabelReader;
