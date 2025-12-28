/**
 * AI SOAP Note Generation Service
 *
 * Skill #18: Generates comprehensive SOAP notes from encounter data using Claude Sonnet.
 * Integrates with the ai-soap-note-generator edge function.
 *
 * @module soapNoteAIService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

export interface SOAPNoteSection {
  content: string;
  confidence: number;
  sources: string[];
}

export interface CodeSuggestion {
  code: string;
  display: string;
  confidence: number;
}

export interface GeneratedSOAPNote {
  subjective: SOAPNoteSection;
  objective: SOAPNoteSection;
  assessment: SOAPNoteSection;
  plan: SOAPNoteSection;
  hpi?: SOAPNoteSection;
  ros?: SOAPNoteSection;
  icd10Suggestions: CodeSuggestion[];
  cptSuggestions: CodeSuggestion[];
  requiresReview: boolean;
  reviewReasons: string[];
}

export interface SOAPNoteGenerationRequest {
  encounterId: string;
  patientId?: string;
  tenantId?: string;
  includeTranscript?: boolean;
  providerNotes?: string;
  templateStyle?: 'standard' | 'comprehensive' | 'brief';
}

export interface SOAPNoteGenerationResponse {
  soapNote: GeneratedSOAPNote;
  metadata: {
    generated_at: string;
    model: string;
    response_time_ms: number;
    template_style: string;
    context_sources: {
      vitals_count: number;
      diagnoses_count: number;
      medications_count: number;
      lab_results_count: number;
      has_transcript: boolean;
    };
  };
}

/**
 * AI SOAP Note Generation Service
 *
 * Provides methods for generating AI-powered SOAP notes from clinical encounters.
 */
export class SOAPNoteAIService {
  /**
   * Generate a SOAP note for an encounter using AI
   *
   * @param request - The generation request parameters
   * @returns ServiceResult containing the generated SOAP note
   */
  static async generateSOAPNote(
    request: SOAPNoteGenerationRequest
  ): Promise<ServiceResult<SOAPNoteGenerationResponse>> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-soap-note-generator', {
        body: {
          encounterId: request.encounterId,
          patientId: request.patientId,
          tenantId: request.tenantId,
          includeTranscript: request.includeTranscript ?? true,
          providerNotes: request.providerNotes,
          templateStyle: request.templateStyle || 'standard',
        },
      });

      if (error) throw error;

      return success(data as SOAPNoteGenerationResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('SOAP_NOTE_GENERATION_FAILED', error.message, error);
    }
  }

  /**
   * Generate a brief SOAP note (shorter, focused on key points)
   */
  static async generateBriefSOAPNote(
    encounterId: string,
    patientId?: string
  ): Promise<ServiceResult<SOAPNoteGenerationResponse>> {
    return this.generateSOAPNote({
      encounterId,
      patientId,
      templateStyle: 'brief',
      includeTranscript: false,
    });
  }

  /**
   * Generate a comprehensive SOAP note (detailed with full clinical reasoning)
   */
  static async generateComprehensiveSOAPNote(
    encounterId: string,
    patientId?: string,
    providerNotes?: string
  ): Promise<ServiceResult<SOAPNoteGenerationResponse>> {
    return this.generateSOAPNote({
      encounterId,
      patientId,
      templateStyle: 'comprehensive',
      includeTranscript: true,
      providerNotes,
    });
  }

  /**
   * Save a generated SOAP note to the clinical_notes table
   *
   * @param encounterId - The encounter ID
   * @param authorId - The provider who is saving/approving the note
   * @param soapNote - The generated SOAP note to save
   * @returns ServiceResult with the saved note IDs
   */
  static async saveGeneratedNote(
    encounterId: string,
    authorId: string,
    soapNote: GeneratedSOAPNote
  ): Promise<ServiceResult<{ noteIds: string[] }>> {
    try {
      const notesToInsert = [];

      // HPI
      if (soapNote.hpi?.content) {
        notesToInsert.push({
          encounter_id: encounterId,
          type: 'hpi',
          content: soapNote.hpi.content,
          author_id: authorId,
          ai_generated: true,
          ai_confidence: soapNote.hpi.confidence,
        });
      }

      // ROS
      if (soapNote.ros?.content) {
        notesToInsert.push({
          encounter_id: encounterId,
          type: 'ros',
          content: soapNote.ros.content,
          author_id: authorId,
          ai_generated: true,
          ai_confidence: soapNote.ros.confidence,
        });
      }

      // Subjective
      notesToInsert.push({
        encounter_id: encounterId,
        type: 'subjective',
        content: soapNote.subjective.content,
        author_id: authorId,
        ai_generated: true,
        ai_confidence: soapNote.subjective.confidence,
      });

      // Objective
      notesToInsert.push({
        encounter_id: encounterId,
        type: 'objective',
        content: soapNote.objective.content,
        author_id: authorId,
        ai_generated: true,
        ai_confidence: soapNote.objective.confidence,
      });

      // Assessment
      notesToInsert.push({
        encounter_id: encounterId,
        type: 'assessment',
        content: soapNote.assessment.content,
        author_id: authorId,
        ai_generated: true,
        ai_confidence: soapNote.assessment.confidence,
      });

      // Plan
      notesToInsert.push({
        encounter_id: encounterId,
        type: 'plan',
        content: soapNote.plan.content,
        author_id: authorId,
        ai_generated: true,
        ai_confidence: soapNote.plan.confidence,
      });

      const { data, error } = await supabase
        .from('clinical_notes')
        .insert(notesToInsert)
        .select('id');

      if (error) throw error;

      const noteIds = data?.map((n: { id: string }) => n.id) || [];

      // Log PHI access
      await supabase.from('audit_phi_access').insert({
        user_id: authorId,
        resource_type: 'clinical_note',
        resource_id: encounterId,
        action: 'CREATE',
        details: { ai_generated: true, note_count: noteIds.length },
      });

      return success({ noteIds });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('SOAP_NOTE_SAVE_FAILED', error.message, error);
    }
  }

  /**
   * Get AI generation history for an encounter
   */
  static async getGenerationHistory(
    encounterId: string
  ): Promise<ServiceResult<Array<{ generated_at: string; model: string; template_style: string }>>> {
    try {
      const { data, error } = await supabase
        .from('claude_usage_logs')
        .select('created_at, model, request_type')
        .eq('request_type', 'soap_note_generation')
        .ilike('user_id', `%${encounterId}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      interface SOAPLogRow {
        created_at: string;
        model: string;
      }
      const history = ((data || []) as SOAPLogRow[]).map((log) => ({
        generated_at: log.created_at,
        model: log.model,
        template_style: 'standard',
      }));

      return success(history);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('HISTORY_FETCH_FAILED', error.message, error);
    }
  }
}

export default SOAPNoteAIService;
