/**
 * SAFER GUIDES SERVICE
 *
 * ONC Requirement: CMS Promoting Interoperability Program
 * Purpose: EHR safety self-assessment using the 9 SAFER Guides
 *
 * The SAFER (Safety Assurance Factors for EHR Resilience) guides are
 * self-assessment tools developed by ONC to help organizations optimize
 * the safety of electronic health record use.
 *
 * @module SaferGuidesService
 * @see https://www.healthit.gov/topic/safety/safer-guides
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// Types re-exported from extracted file
export type {
  AssessmentStatus,
  ResponseValue,
  GuideCategory,
  SaferGuideDefinition,
  SaferGuideQuestion,
  SaferGuideResponse,
  SaferGuideAssessment,
  GuideProgress,
  AssessmentSummary,
  QuestionWithResponse,
} from './saferGuidesService.types';

import type {
  AssessmentStatus,
  ResponseValue,
  GuideCategory,
  SaferGuideDefinition,
  SaferGuideQuestion,
  SaferGuideResponse,
  SaferGuideAssessment,
  GuideProgress,
  AssessmentSummary,
  QuestionWithResponse,
} from './saferGuidesService.types';

// =====================================================
// SERVICE FUNCTIONS
// =====================================================

/**
 * Get all SAFER Guide definitions
 */
export async function getGuideDefinitions(): Promise<ServiceResult<SaferGuideDefinition[]>> {
  try {
    const { data, error } = await supabase
      .from('safer_guide_definitions')
      .select('id, guide_number, guide_name, description, category, source_url, is_active')
      .eq('is_active', true)
      .order('guide_number');

    if (error) {
      await auditLogger.error('SAFER_GUIDES_FETCH_FAILED', error, {});
      return failure('DATABASE_ERROR', error.message);
    }

    return success(data || []);
  } catch (err: unknown) {
    await auditLogger.error(
      'SAFER_GUIDES_FETCH_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      {}
    );
    return failure('UNKNOWN_ERROR', 'Failed to fetch guide definitions');
  }
}

/**
 * Get questions for a specific guide
 */
export async function getGuideQuestions(
  guideId: string
): Promise<ServiceResult<SaferGuideQuestion[]>> {
  try {
    const { data, error } = await supabase
      .from('safer_guide_questions')
      .select('id, guide_id, question_number, question_text, help_text, recommended_practice, response_type, is_required, display_order')
      .eq('guide_id', guideId)
      .order('display_order');

    if (error) {
      await auditLogger.error('SAFER_QUESTIONS_FETCH_FAILED', error, { guideId });
      return failure('DATABASE_ERROR', error.message);
    }

    return success(data || []);
  } catch (err: unknown) {
    await auditLogger.error(
      'SAFER_QUESTIONS_FETCH_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { guideId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to fetch guide questions');
  }
}

/**
 * Get or create assessment for a tenant and year
 */
export async function getOrCreateAssessment(
  tenantId: string,
  year: number = new Date().getFullYear()
): Promise<ServiceResult<AssessmentSummary>> {
  try {
    // Check for existing assessment
    // eslint-disable-next-line prefer-const -- assessment is reassigned if not found
    let { data: assessment, error: fetchError } = await supabase
      .from('safer_guide_assessments')
      .select('id, tenant_id, assessment_year, status, started_at, completed_at, attested_at, attested_by, guide_scores, overall_score, attestation_pdf_path')
      .eq('tenant_id', tenantId)
      .eq('assessment_year', year)
      .maybeSingle();

    if (fetchError) {
      await auditLogger.error('SAFER_ASSESSMENT_FETCH_FAILED', fetchError, { tenantId, year });
      return failure('DATABASE_ERROR', fetchError.message);
    }

    // Create if doesn't exist
    if (!assessment) {
      const { data: newAssessment, error: createError } = await supabase
        .from('safer_guide_assessments')
        .insert({
          tenant_id: tenantId,
          assessment_year: year,
          status: 'in_progress',
          guide_scores: {}
        })
        .select()
        .single();

      if (createError) {
        await auditLogger.error('SAFER_ASSESSMENT_CREATE_FAILED', createError, { tenantId, year });
        return failure('DATABASE_ERROR', createError.message);
      }

      assessment = newAssessment;

      if (!assessment) {
        return failure('DATABASE_ERROR', 'Failed to create assessment record');
      }

      await auditLogger.info('SAFER_ASSESSMENT_CREATED', {
        tenantId,
        year,
        assessmentId: assessment.id
      });
    }

    if (!assessment) {
      return failure('NOT_FOUND', 'Assessment not found');
    }

    // Get guide definitions with question counts
    const { data: guides, error: guidesError } = await supabase
      .from('safer_guide_definitions')
      .select(`
        *,
        safer_guide_questions(id)
      `)
      .eq('is_active', true)
      .order('guide_number');

    if (guidesError) {
      return failure('DATABASE_ERROR', guidesError.message);
    }

    // Get all responses for this assessment
    const { data: responses, error: responsesError } = await supabase
      .from('safer_guide_responses')
      .select(`
        *,
        safer_guide_questions!inner(guide_id)
      `)
      .eq('assessment_id', assessment.id);

    if (responsesError) {
      return failure('DATABASE_ERROR', responsesError.message);
    }

    // Calculate progress per guide
    const guideProgress: GuideProgress[] = (guides || []).map(guide => {
      const questionIds = (guide.safer_guide_questions || []).map(
        (q: { id: string }) => q.id
      );
      const guideResponses = (responses || []).filter(r =>
        questionIds.includes(r.question_id)
      );

      const yesCount = guideResponses.filter(r => r.response === 'yes').length;
      const noCount = guideResponses.filter(r => r.response === 'no').length;
      const naCount = guideResponses.filter(r => r.response === 'na').length;
      const partialCount = guideResponses.filter(r => r.response === 'partial').length;
      const totalQuestions = questionIds.length;
      const answeredQuestions = guideResponses.filter(r => r.response !== null).length;

      // Calculate score: (yes + 0.5*partial) / (total - na) * 100
      const applicableCount = totalQuestions - naCount;
      let score: number | null = null;
      if (applicableCount > 0 && answeredQuestions === totalQuestions) {
        score = Math.round(((yesCount + (partialCount * 0.5)) / applicableCount) * 100);
      }

      let status: 'not_started' | 'in_progress' | 'complete' = 'not_started';
      if (answeredQuestions === totalQuestions && totalQuestions > 0) {
        status = 'complete';
      } else if (answeredQuestions > 0) {
        status = 'in_progress';
      }

      return {
        guideNumber: guide.guide_number,
        guideName: guide.guide_name,
        category: guide.category as GuideCategory,
        totalQuestions,
        answeredQuestions,
        yesCount,
        noCount,
        naCount,
        partialCount,
        score,
        status
      };
    });

    // Calculate overall score
    const completedGuides = guideProgress.filter(g => g.score !== null);
    const overallScore = completedGuides.length > 0
      ? Math.round(completedGuides.reduce((sum, g) => sum + (g.score || 0), 0) / completedGuides.length)
      : null;

    const totalQuestions = guideProgress.reduce((sum, g) => sum + g.totalQuestions, 0);
    const totalAnswered = guideProgress.reduce((sum, g) => sum + g.answeredQuestions, 0);

    return success({
      assessmentId: assessment.id,
      year: assessment.assessment_year,
      status: assessment.status as AssessmentStatus,
      startedAt: assessment.started_at,
      completedAt: assessment.completed_at,
      attestedAt: assessment.attested_at,
      overallScore,
      guides: guideProgress,
      totalQuestions,
      totalAnswered
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'SAFER_ASSESSMENT_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, year }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get or create assessment');
  }
}

/**
 * Get questions with responses for a specific guide in an assessment
 */
export async function getGuideQuestionsWithResponses(
  assessmentId: string,
  guideId: string
): Promise<ServiceResult<QuestionWithResponse[]>> {
  try {
    // Get all questions for this guide
    const { data: questions, error: questionsError } = await supabase
      .from('safer_guide_questions')
      .select('id, guide_id, question_number, question_text, help_text, recommended_practice, response_type, is_required, display_order')
      .eq('guide_id', guideId)
      .order('display_order');

    if (questionsError) {
      return failure('DATABASE_ERROR', questionsError.message);
    }

    // Get responses for this assessment and these questions
    const questionIds = (questions || []).map(q => q.id);
    const { data: responses, error: responsesError } = await supabase
      .from('safer_guide_responses')
      .select('id, assessment_id, question_id, response, notes, action_plan, responded_at, responded_by')
      .eq('assessment_id', assessmentId)
      .in('question_id', questionIds);

    if (responsesError) {
      return failure('DATABASE_ERROR', responsesError.message);
    }

    // Combine questions with their responses
    const questionsWithResponses: QuestionWithResponse[] = (questions || []).map(question => {
      const response = (responses || []).find(r => r.question_id === question.id) || null;
      return { question, response };
    });

    return success(questionsWithResponses);
  } catch (err: unknown) {
    await auditLogger.error(
      'SAFER_QUESTIONS_RESPONSES_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { assessmentId, guideId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to get questions with responses');
  }
}

/**
 * Save a response to a question
 */
export async function saveResponse(
  assessmentId: string,
  questionId: string,
  response: ResponseValue,
  notes: string | null,
  actionPlan: string | null,
  userId: string
): Promise<ServiceResult<SaferGuideResponse>> {
  try {
    const { data, error } = await supabase
      .from('safer_guide_responses')
      .upsert(
        {
          assessment_id: assessmentId,
          question_id: questionId,
          response,
          notes,
          action_plan: actionPlan,
          responded_by: userId,
          responded_at: new Date().toISOString()
        },
        {
          onConflict: 'assessment_id,question_id'
        }
      )
      .select()
      .single();

    if (error) {
      await auditLogger.error('SAFER_RESPONSE_SAVE_FAILED', error, {
        assessmentId,
        questionId
      });
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('SAFER_RESPONSE_SAVED', {
      assessmentId,
      questionId,
      response,
      userId
    });

    return success(data);
  } catch (err: unknown) {
    await auditLogger.error(
      'SAFER_RESPONSE_SAVE_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { assessmentId, questionId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to save response');
  }
}

/**
 * Update assessment status and scores
 */
export async function updateAssessmentStatus(
  assessmentId: string,
  status: AssessmentStatus,
  guideScores: Record<string, number>,
  overallScore: number | null
): Promise<ServiceResult<SaferGuideAssessment>> {
  try {
    const updateData: Record<string, unknown> = {
      status,
      guide_scores: guideScores,
      overall_score: overallScore,
      updated_at: new Date().toISOString()
    };

    if (status === 'complete') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('safer_guide_assessments')
      .update(updateData)
      .eq('id', assessmentId)
      .select()
      .single();

    if (error) {
      await auditLogger.error('SAFER_ASSESSMENT_UPDATE_FAILED', error, { assessmentId });
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('SAFER_ASSESSMENT_UPDATED', {
      assessmentId,
      status,
      overallScore
    });

    return success(data);
  } catch (err: unknown) {
    await auditLogger.error(
      'SAFER_ASSESSMENT_UPDATE_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { assessmentId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to update assessment');
  }
}

/**
 * Attest (finalize) an assessment
 */
export async function attestAssessment(
  assessmentId: string,
  userId: string,
  tenantId: string
): Promise<ServiceResult<{ pdfPath: string | null }>> {
  try {
    // Get assessment summary to verify completion
    const summaryResult = await getOrCreateAssessment(tenantId);
    if (!summaryResult.success) {
      return failure('OPERATION_FAILED', summaryResult.error?.message || 'Could not verify assessment');
    }

    const summary = summaryResult.data;
    if (!summary || summary.assessmentId !== assessmentId) {
      return failure('NOT_FOUND', 'Assessment not found');
    }

    // Check all guides are complete
    const incompleteGuides = summary.guides.filter(g => g.status !== 'complete');
    if (incompleteGuides.length > 0) {
      const guideNames = incompleteGuides.map(g => `Guide ${g.guideNumber}: ${g.guideName}`);
      return failure(
        'VALIDATION_ERROR',
        `The following guides are incomplete: ${guideNames.join(', ')}`
      );
    }

    // Calculate final scores
    const guideScores: Record<string, number> = {};
    summary.guides.forEach(g => {
      if (g.score !== null) {
        guideScores[g.guideNumber.toString()] = g.score;
      }
    });

    // Update assessment as attested
    const { data: _data, error } = await supabase
      .from('safer_guide_assessments')
      .update({
        status: 'attested',
        attested_at: new Date().toISOString(),
        attested_by: userId,
        guide_scores: guideScores,
        overall_score: summary.overallScore,
        completed_at: summary.completedAt || new Date().toISOString()
      })
      .eq('id', assessmentId)
      .select()
      .single();

    if (error) {
      await auditLogger.error('SAFER_ATTESTATION_FAILED', error, { assessmentId, userId });
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('SAFER_ASSESSMENT_ATTESTED', {
      tenantId,
      assessmentId,
      year: summary.year,
      overallScore: summary.overallScore,
      guideScores,
      attestedBy: userId
    });

    // Generate attestation PDF via edge function
    const pdfResult = await generateAttestationPdf(assessmentId, tenantId);
    const pdfPath = pdfResult.success ? 'generated' : null;

    return success({ pdfPath });
  } catch (err: unknown) {
    await auditLogger.error(
      'SAFER_ATTESTATION_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { assessmentId, userId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to attest assessment');
  }
}

/**
 * Get assessment history for a tenant
 */
export async function getAssessmentHistory(
  tenantId: string
): Promise<ServiceResult<SaferGuideAssessment[]>> {
  try {
    const { data, error } = await supabase
      .from('safer_guide_assessments')
      .select('id, tenant_id, assessment_year, status, started_at, completed_at, attested_at, attested_by, guide_scores, overall_score, attestation_pdf_path')
      .eq('tenant_id', tenantId)
      .order('assessment_year', { ascending: false });

    if (error) {
      await auditLogger.error('SAFER_HISTORY_FETCH_FAILED', error, { tenantId });
      return failure('DATABASE_ERROR', error.message);
    }

    return success(data || []);
  } catch (err: unknown) {
    await auditLogger.error(
      'SAFER_HISTORY_FETCH_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to fetch assessment history');
  }
}

/**
 * Generate attestation PDF HTML via edge function
 */
export async function generateAttestationPdf(
  assessmentId: string,
  tenantId: string
): Promise<ServiceResult<{ html: string }>> {
  try {
    const { data, error } = await supabase.functions.invoke('safer-guides-pdf', {
      body: { assessmentId, tenantId },
    });

    if (error) {
      await auditLogger.error('SAFER_PDF_GENERATE_FAILED', error, { assessmentId });
      return failure('OPERATION_FAILED', 'Failed to generate attestation PDF');
    }

    const response = data as { html?: string } | null;
    if (!response?.html) {
      return failure('OPERATION_FAILED', 'No PDF content returned');
    }

    return success({ html: response.html });
  } catch (err: unknown) {
    await auditLogger.error(
      'SAFER_PDF_GENERATE_ERROR',
      err instanceof Error ? err : new Error(String(err)),
      { assessmentId }
    );
    return failure('UNKNOWN_ERROR', 'Failed to generate attestation PDF');
  }
}

/**
 * Export default service object
 */
export const SaferGuidesService = {
  getGuideDefinitions,
  getGuideQuestions,
  getOrCreateAssessment,
  getGuideQuestionsWithResponses,
  saveResponse,
  updateAssessmentStatus,
  attestAssessment,
  getAssessmentHistory,
  generateAttestationPdf
};

export default SaferGuidesService;
