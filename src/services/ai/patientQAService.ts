/**
 * Patient Q&A Bot Service
 *
 * Skill #56: Answers patient health questions using Claude Sonnet with safety guardrails.
 * Integrates with the ai-patient-qa-bot edge function.
 *
 * @module patientQAService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

export interface SafetyCheck {
  isEmergency: boolean;
  emergencyReason?: string;
  requiresProviderConsult: boolean;
  consultReason?: string;
  blockedTopics: string[];
}

export interface QAResponse {
  answer: string;
  readingLevel: string;
  confidence: number;
  safetyCheck: SafetyCheck;
  relatedTopics: string[];
  sources: string[];
  disclaimers: string[];
  suggestedFollowUp?: string;
  metadata?: {
    generated_at: string;
    model: string;
    response_time_ms: number;
    language: string;
    had_patient_context: boolean;
  };
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskQuestionRequest {
  question: string;
  patientId?: string;
  tenantId?: string;
  language?: string;
  conversationHistory?: ConversationMessage[];
  includePatientContext?: boolean;
}

/**
 * Patient Q&A Bot Service
 *
 * Provides methods for patients to ask health questions and receive
 * AI-powered answers with safety guardrails.
 */
export class PatientQAService {
  /**
   * Ask a health question and get an AI-powered answer
   *
   * @param request - The question request parameters
   * @returns ServiceResult containing the answer and safety information
   */
  static async askQuestion(
    request: AskQuestionRequest
  ): Promise<ServiceResult<QAResponse>> {
    try {
      // Validate question
      if (!request.question || request.question.trim().length === 0) {
        return failure('INVALID_QUESTION', 'Question cannot be empty');
      }

      if (request.question.length > 2000) {
        return failure('QUESTION_TOO_LONG', 'Question must be under 2000 characters');
      }

      const { data, error } = await supabase.functions.invoke('ai-patient-qa-bot', {
        body: {
          question: request.question,
          patientId: request.patientId,
          tenantId: request.tenantId,
          language: request.language || 'English',
          conversationHistory: request.conversationHistory || [],
          includePatientContext: request.includePatientContext ?? true,
        },
      });

      if (error) throw error;

      return success(data as QAResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('QA_REQUEST_FAILED', error.message, error);
    }
  }

  /**
   * Ask a simple question without patient context
   * (For anonymous/logged-out users)
   */
  static async askAnonymousQuestion(
    question: string,
    language?: string
  ): Promise<ServiceResult<QAResponse>> {
    return this.askQuestion({
      question,
      language,
      includePatientContext: false,
    });
  }

  /**
   * Continue a conversation with history
   */
  static async continueConversation(
    question: string,
    conversationHistory: ConversationMessage[],
    patientId?: string,
    language?: string
  ): Promise<ServiceResult<QAResponse>> {
    return this.askQuestion({
      question,
      patientId,
      language,
      conversationHistory,
      includePatientContext: !!patientId,
    });
  }

  /**
   * Get suggested topics for a patient based on their conditions
   */
  static async getSuggestedTopics(
    patientId: string
  ): Promise<ServiceResult<string[]>> {
    try {
      // Get patient's active conditions
      const { data: conditions } = await supabase
        .from('patient_diagnoses')
        .select('diagnosis_name')
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .limit(5);

      // Generate topic suggestions based on conditions
      const topics: string[] = [
        'How can I manage my medications?',
        'What are signs I should call my doctor?',
        'How can I improve my sleep?',
        'What foods are good for my health?',
      ];

      if (conditions && conditions.length > 0) {
        conditions.forEach((c) => {
          topics.unshift(`What should I know about ${c.diagnosis_name.toLowerCase()}?`);
        });
      }

      return success(topics.slice(0, 6));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('TOPICS_FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Report a problematic AI response for review
   */
  static async reportResponse(
    patientId: string,
    question: string,
    answer: string,
    reason: string
  ): Promise<ServiceResult<{ reportId: string }>> {
    try {
      const { data, error } = await supabase.from('ai_response_reports').insert({
        patient_id: patientId,
        skill_name: 'patient_qa_bot',
        question_summary: question.slice(0, 200),
        answer_summary: answer.slice(0, 500),
        report_reason: reason,
        status: 'pending_review',
      }).select('id').single();

      if (error) throw error;

      return success({ reportId: data.id });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('REPORT_FAILED', error.message, error);
    }
  }

  /**
   * Get common health FAQs (static, no AI call needed)
   */
  static getCommonFAQs(): Array<{ question: string; category: string }> {
    return [
      { question: 'How do I take my medications correctly?', category: 'Medication' },
      { question: 'When should I call my doctor?', category: 'Emergency' },
      { question: 'How can I manage my pain at home?', category: 'Pain Management' },
      { question: 'What exercises are safe for me?', category: 'Exercise' },
      { question: 'How can I improve my sleep?', category: 'Sleep' },
      { question: 'What foods should I eat or avoid?', category: 'Nutrition' },
      { question: 'How do I prevent falls at home?', category: 'Safety' },
      { question: 'What are the side effects of my medications?', category: 'Medication' },
      { question: 'How do I prepare for my next appointment?', category: 'Appointments' },
      { question: 'What should I do if I miss a dose?', category: 'Medication' },
    ];
  }

  /**
   * Check if a question might be an emergency
   * (Client-side pre-check before calling the API)
   */
  static isLikelyEmergency(question: string): boolean {
    const emergencyKeywords = [
      'chest pain',
      'heart attack',
      'can\'t breathe',
      'difficulty breathing',
      'stroke',
      'seizure',
      'unconscious',
      'severe bleeding',
      'suicidal',
      'overdose',
    ];

    const lowerQuestion = question.toLowerCase();
    return emergencyKeywords.some((keyword) => lowerQuestion.includes(keyword));
  }

  /**
   * Get emergency instructions (no AI call needed)
   */
  static getEmergencyInstructions(language: string = 'English'): string {
    const instructions: Record<string, string> = {
      English: `🚨 **If this is a medical emergency:**
1. Call 911 immediately
2. If you have prescribed emergency medication, use it as directed
3. Stay calm and stay on the line with the operator
4. Have someone meet the ambulance if possible

**National Suicide Prevention Lifeline:** 988
**Poison Control:** 1-800-222-1222`,

      Spanish: `🚨 **Si esto es una emergencia médica:**
1. Llame al 911 inmediatamente
2. Si tiene medicamento de emergencia recetado, úselo según las indicaciones
3. Mantenga la calma y permanezca en la línea con el operador
4. Haga que alguien reciba a la ambulancia si es posible

**Línea de Prevención del Suicidio:** 988
**Control de Envenenamiento:** 1-800-222-1222`,
    };

    return instructions[language] || instructions['English'];
  }
}

export default PatientQAService;
