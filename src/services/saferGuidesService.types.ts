/**
 * SAFER Guides Service — Type Definitions
 *
 * Extracted from saferGuidesService.ts to stay under 600-line limit.
 * ONC Requirement: CMS Promoting Interoperability Program
 */

export type AssessmentStatus = 'in_progress' | 'complete' | 'attested';
export type ResponseValue = 'yes' | 'no' | 'na' | 'partial';
export type GuideCategory = 'Foundation' | 'Governance' | 'Operations' | 'Technical' | 'Clinical';

export interface SaferGuideDefinition {
  id: string;
  guide_number: number;
  guide_name: string;
  description: string | null;
  category: GuideCategory;
  source_url: string | null;
  is_active: boolean;
}

export interface SaferGuideQuestion {
  id: string;
  guide_id: string;
  question_number: number;
  question_text: string;
  help_text: string | null;
  recommended_practice: string | null;
  response_type: string;
  is_required: boolean;
  display_order: number;
}

export interface SaferGuideResponse {
  id: string;
  assessment_id: string;
  question_id: string;
  response: ResponseValue | null;
  notes: string | null;
  action_plan: string | null;
  responded_at: string;
  responded_by: string | null;
}

export interface SaferGuideAssessment {
  id: string;
  tenant_id: string;
  assessment_year: number;
  status: AssessmentStatus;
  started_at: string;
  completed_at: string | null;
  attested_at: string | null;
  attested_by: string | null;
  guide_scores: Record<string, number>;
  overall_score: number | null;
  attestation_pdf_path: string | null;
}

export interface GuideProgress {
  guideNumber: number;
  guideName: string;
  category: GuideCategory;
  totalQuestions: number;
  answeredQuestions: number;
  yesCount: number;
  noCount: number;
  naCount: number;
  partialCount: number;
  score: number | null;
  status: 'not_started' | 'in_progress' | 'complete';
}

export interface AssessmentSummary {
  assessmentId: string;
  year: number;
  status: AssessmentStatus;
  startedAt: string;
  completedAt: string | null;
  attestedAt: string | null;
  overallScore: number | null;
  guides: GuideProgress[];
  totalQuestions: number;
  totalAnswered: number;
}

export interface QuestionWithResponse {
  question: SaferGuideQuestion;
  response: SaferGuideResponse | null;
}
