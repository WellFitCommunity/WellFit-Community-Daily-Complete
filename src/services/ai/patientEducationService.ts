/**
 * Patient Education AI Service
 *
 * Generates patient-friendly health education content using Claude Haiku.
 * Content is written at 6th-grade reading level for accessibility.
 *
 * @module PatientEducationService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

export interface EducationRequest {
  topic: string;
  condition?: string;
  patientId?: string;
  language?: string;
  format?: 'article' | 'bullet_points' | 'qa' | 'instructions';
  includeWarnings?: boolean;
  maxLength?: number;
}

export interface EducationContent {
  title: string;
  content: string;
  format: string;
  reading_level: string;
  key_points: string[];
  action_items: string[];
  warnings?: string[];
  sources?: string[];
  language: string;
}

export interface EducationResponse {
  education: EducationContent;
  metadata: {
    generated_at: string;
    model: string;
    response_time_ms: number;
    tokens_used: number;
  };
}

// Pre-defined education templates for common topics
const EDUCATION_TEMPLATES: Record<string, Partial<EducationContent>> = {
  medication_adherence: {
    title: 'Taking Your Medications Correctly',
    key_points: [
      'Take medications at the same time each day',
      'Use a pill organizer to stay on track',
      'Never stop taking medications without talking to your doctor',
    ],
    action_items: [
      'Set daily reminders on your phone',
      'Keep a medication list in your wallet',
      'Refill prescriptions before running out',
    ],
    warnings: [
      'Call your doctor if you miss several doses',
      'Report any side effects immediately',
    ],
  },
  fall_prevention: {
    title: 'Staying Safe and Preventing Falls',
    key_points: [
      'Remove tripping hazards from your home',
      'Use handrails on stairs',
      'Wear shoes with good grip',
    ],
    action_items: [
      'Install night lights in hallways',
      'Keep frequently used items within reach',
      'Exercise regularly to improve balance',
    ],
    warnings: [
      'Tell your doctor if you feel dizzy',
      'Seek help immediately if you fall',
    ],
  },
  diabetes_basics: {
    title: 'Understanding Diabetes',
    key_points: [
      'Diabetes affects how your body uses sugar',
      'Healthy eating helps control blood sugar',
      'Regular exercise is important',
    ],
    action_items: [
      'Check your blood sugar as directed',
      'Eat meals at regular times',
      'Take your medications as prescribed',
    ],
    warnings: [
      'Call 911 if you have chest pain or trouble breathing',
      'Contact your doctor if blood sugar stays high or low',
    ],
  },
  heart_health: {
    title: 'Keeping Your Heart Healthy',
    key_points: [
      'Your heart pumps blood throughout your body',
      'High blood pressure can damage your heart',
      'Healthy habits protect your heart',
    ],
    action_items: [
      'Take blood pressure medications as prescribed',
      'Limit salt in your diet',
      'Stay active with light exercise',
    ],
    warnings: [
      'Call 911 for chest pain, arm pain, or shortness of breath',
      'Report swelling in legs or feet to your doctor',
    ],
  },
};

export class PatientEducationService {
  /**
   * Generate personalized patient education content
   */
  static async generateEducation(
    request: EducationRequest
  ): Promise<ServiceResult<EducationResponse>> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-patient-education', {
        body: {
          topic: request.topic,
          condition: request.condition,
          patientId: request.patientId,
          language: request.language || 'English',
          format: request.format || 'article',
          includeWarnings: request.includeWarnings ?? true,
          maxLength: request.maxLength || 500,
        },
      });

      if (error) throw error;

      return success(data as EducationResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Try to use cached template if available
      const templateKey = request.topic.toLowerCase().replace(/\s+/g, '_');
      const template = EDUCATION_TEMPLATES[templateKey];

      if (template) {
        return success({
          education: {
            title: template.title || `About ${request.topic}`,
            content: '',
            format: request.format || 'bullet_points',
            reading_level: '6th grade',
            key_points: template.key_points || [],
            action_items: template.action_items || [],
            warnings: template.warnings,
            language: request.language || 'English',
          },
          metadata: {
            generated_at: new Date().toISOString(),
            model: 'template',
            response_time_ms: 0,
            tokens_used: 0,
          },
        });
      }

      return failure('EDUCATION_GENERATION_FAILED', error.message, error);
    }
  }

  /**
   * Get education for common conditions
   */
  static async getConditionEducation(
    condition: string,
    language?: string
  ): Promise<ServiceResult<EducationResponse>> {
    return this.generateEducation({
      topic: condition,
      condition,
      language,
      format: 'bullet_points',
      includeWarnings: true,
    });
  }

  /**
   * Get medication instructions
   */
  static async getMedicationEducation(
    medicationName: string,
    patientId?: string,
    language?: string
  ): Promise<ServiceResult<EducationResponse>> {
    return this.generateEducation({
      topic: `How to take ${medicationName}`,
      patientId,
      language,
      format: 'instructions',
      includeWarnings: true,
    });
  }

  /**
   * Get post-procedure instructions
   */
  static async getPostProcedureEducation(
    procedureName: string,
    patientId?: string,
    language?: string
  ): Promise<ServiceResult<EducationResponse>> {
    return this.generateEducation({
      topic: `Care after ${procedureName}`,
      patientId,
      language,
      format: 'instructions',
      includeWarnings: true,
    });
  }

  /**
   * Get available template topics
   */
  static getAvailableTemplates(): string[] {
    return Object.keys(EDUCATION_TEMPLATES);
  }

  /**
   * Get template content directly (no AI call)
   */
  static getTemplate(topic: string): Partial<EducationContent> | null {
    const key = topic.toLowerCase().replace(/\s+/g, '_');
    return EDUCATION_TEMPLATES[key] || null;
  }
}

export default PatientEducationService;
