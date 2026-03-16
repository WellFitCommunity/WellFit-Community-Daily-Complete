/**
 * SAFER Guides Assessment Component
 *
 * ONC Requirement: CMS Promoting Interoperability Program
 * Purpose: Annual self-assessment using the 9 SAFER Guides for EHR safety
 *
 * Decomposed:
 *   - SaferGuidesQuestionPanel: question view (extracted)
 *   - saferGuidesHelpers: shared helper functions (extracted)
 *
 * @see https://www.healthit.gov/topic/safety/safer-guides
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import {
  SaferGuidesService,
  type AssessmentSummary,
  type GuideProgress,
  type QuestionWithResponse,
  type ResponseValue
} from '../../services/saferGuidesService';
import { generateAttestationPdf } from '../../services/saferGuidesService';
import { auditLogger } from '../../services/auditLogger';
import SaferGuidesQuestionPanel from './SaferGuidesQuestionPanel';
import { getScoreColor, getCategoryColor } from './saferGuidesHelpers';

import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import Circle from 'lucide-react/dist/esm/icons/circle';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Download from 'lucide-react/dist/esm/icons/download';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import Shield from 'lucide-react/dist/esm/icons/shield';

// =====================================================
// TYPES
// =====================================================

interface SaferGuidesAssessmentProps {
  className?: string;
}

// =====================================================
// COMPONENT
// =====================================================

const SaferGuidesAssessment: React.FC<SaferGuidesAssessmentProps> = ({ className = '' }) => {
  const supabase = useSupabaseClient();
  const user = useUser();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<AssessmentSummary | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<GuideProgress | null>(null);
  const [questions, setQuestions] = useState<QuestionWithResponse[]>([]);
  const [guideDefinitions, setGuideDefinitions] = useState<{ id: string; guide_number: number }[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAttesting, setIsAttesting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =====================================================
  // DATA LOADING
  // =====================================================

  const loadAssessment = useCallback(async (tid: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const defsResult = await SaferGuidesService.getGuideDefinitions();
      if (defsResult.success && defsResult.data) {
        setGuideDefinitions(defsResult.data.map(d => ({ id: d.id, guide_number: d.guide_number })));
      }
      const result = await SaferGuidesService.getOrCreateAssessment(tid);
      if (result.success && result.data) {
        setAssessment(result.data);
      } else {
        setError(result.error?.message || 'Failed to load assessment');
      }
    } catch (err: unknown) {
      await auditLogger.error('SAFER_GUIDES_LOAD_FAILED', err instanceof Error ? err : new Error(String(err)));
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const initializeData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.tenant_id) {
        setError('Could not determine your organization');
        setIsLoading(false);
        return;
      }
      setTenantId(profile.tenant_id);
      await loadAssessment(profile.tenant_id);
    } catch (err: unknown) {
      await auditLogger.error('SAFER_GUIDES_INIT_FAILED', err instanceof Error ? err : new Error(String(err)));
      setError('Failed to initialize assessment');
      setIsLoading(false);
    }
  }, [user?.id, supabase, loadAssessment]);

  const loadGuideQuestions = useCallback(async (guide: GuideProgress) => {
    if (!assessment) return;
    setSelectedGuide(guide);
    setIsLoadingQuestions(true);
    try {
      const guideDef = guideDefinitions.find(d => d.guide_number === guide.guideNumber);
      if (!guideDef) { setError('Guide definition not found'); return; }
      const result = await SaferGuidesService.getGuideQuestionsWithResponses(assessment.assessmentId, guideDef.id);
      if (result.success && result.data) { setQuestions(result.data); }
      else { setError(result.error?.message || 'Failed to load questions'); }
    } catch (_err: unknown) {
      setError('Failed to load guide questions');
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [assessment, guideDefinitions]);

  useEffect(() => { initializeData(); }, [initializeData]);

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleResponseChange = async (questionId: string, response: ResponseValue) => {
    if (!assessment || !user?.id || !tenantId) return;
    setIsSaving(true);
    try {
      const result = await SaferGuidesService.saveResponse(
        assessment.assessmentId, questionId, response, null, null, user.id
      );
      if (result.success) {
        setQuestions(prev => prev.map(q =>
          q.question.id === questionId
            ? { ...q, response: { ...q.response, response } as QuestionWithResponse['response'] }
            : q
        ));
        await loadAssessment(tenantId);
      } else {
        setError(result.error?.message || 'Failed to save response');
      }
    } catch (_err: unknown) {
      setError('Failed to save response');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAttest = async () => {
    if (!assessment || !user?.id || !tenantId) return;
    setIsAttesting(true);
    setError(null);
    try {
      const result = await SaferGuidesService.attestAssessment(assessment.assessmentId, user.id, tenantId);
      if (result.success) {
        await loadAssessment(tenantId);
        setSelectedGuide(null);
      } else {
        setError(result.error?.message || 'Failed to attest assessment');
      }
    } catch (_err: unknown) {
      setError('Failed to attest assessment');
    } finally {
      setIsAttesting(false);
    }
  };

  const handleDownloadAttestation = async () => {
    if (!assessment || !tenantId) return;
    setIsDownloading(true);
    setError(null);
    try {
      const result = await generateAttestationPdf(assessment.assessmentId, tenantId);
      if (result.success && result.data?.html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(result.data.html);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
        }
      } else {
        setError(result.error?.message || 'Failed to generate attestation PDF');
      }
    } catch (_err: unknown) {
      setError('Failed to download attestation');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBackToGuides = () => { setSelectedGuide(null); setQuestions([]); };

  // =====================================================
  // HELPERS
  // =====================================================

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in_progress': return <Circle className="w-5 h-5 text-yellow-500 fill-yellow-100" />;
      default: return <Circle className="w-5 h-5 text-slate-300" />;
    }
  };

  const allGuidesComplete = assessment?.guides.every(g => g.status === 'complete') ?? false;

  // =====================================================
  // RENDER: LOADING
  // =====================================================

  if (isLoading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-200 rounded w-1/4" />
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
              <div key={i} className="h-32 bg-slate-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // RENDER: QUESTION VIEW (delegated to extracted panel)
  // =====================================================

  if (selectedGuide) {
    return (
      <div className={`p-6 ${className}`}>
        <SaferGuidesQuestionPanel
          guide={selectedGuide}
          questions={questions}
          isLoadingQuestions={isLoadingQuestions}
          isSaving={isSaving}
          error={error}
          onBack={handleBackToGuides}
          onResponseChange={handleResponseChange}
        />
      </div>
    );
  }

  // =====================================================
  // RENDER: MAIN VIEW (Guide List)
  // =====================================================

  return (
    <div className={`p-6 ${className}`} aria-label="SAFER Guides Self-Assessment">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-[var(--ea-primary)]" />
            <h1 className="text-2xl font-bold text-slate-900">SAFER Guides Self-Assessment</h1>
          </div>
          <p className="text-slate-500 mt-1">
            {assessment?.year} Annual Assessment - Required for CMS Promoting Interoperability
          </p>
        </div>

        <div className="flex items-center gap-3">
          {assessment?.status === 'attested' ? (
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={handleDownloadAttestation}
              disabled={isDownloading}
            >
              {isDownloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download Attestation
            </Button>
          ) : (
            <Button
              onClick={handleAttest}
              disabled={!allGuidesComplete || isAttesting}
              className="flex items-center gap-2"
            >
              {isAttesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Complete & Attest
            </Button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Overall Progress Card */}
      <Card className="mb-6 border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Overall Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--ea-primary)] transition-all duration-500"
                  style={{
                    width: `${((assessment?.guides.filter(g => g.status === 'complete').length || 0) / 9) * 100}%`
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-sm text-slate-500">
                <span>{assessment?.guides.filter(g => g.status === 'complete').length || 0} of 9 guides complete</span>
                <span>{assessment?.totalAnswered || 0} of {assessment?.totalQuestions || 0} questions answered</span>
              </div>
            </div>
            {assessment?.overallScore !== null && (
              <div className="text-center px-6 border-l border-slate-200">
                <div className={`text-4xl font-bold ${getScoreColor(assessment?.overallScore ?? null)}`}>
                  {assessment?.overallScore}%
                </div>
                <div className="text-sm text-slate-500 mt-1">Overall Score</div>
              </div>
            )}
            <div className="px-6 border-l border-slate-200">
              {assessment?.status === 'attested' ? (
                <Badge className="bg-green-100 text-green-800 px-3 py-1">
                  <CheckCircle className="w-4 h-4 mr-1" />Attested
                </Badge>
              ) : allGuidesComplete ? (
                <Badge className="bg-blue-100 text-blue-800 px-3 py-1">Ready to Attest</Badge>
              ) : (
                <Badge className="bg-yellow-100 text-yellow-800 px-3 py-1">In Progress</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guide Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assessment?.guides.map(guide => (
          <Card
            key={guide.guideNumber}
            className={`cursor-pointer transition-all hover:shadow-md hover:border-[var(--ea-primary-hover)] ${
              guide.status === 'complete' ? 'border-green-200 bg-green-50/30' : 'border-slate-200'
            }`}
            onClick={() => loadGuideQuestions(guide)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(guide.status)}
                  <span className="text-lg font-semibold text-slate-900">Guide {guide.guideNumber}</span>
                </div>
                <Badge className={`text-xs ${getCategoryColor(guide.category)}`}>{guide.category}</Badge>
              </div>
              <h3 className="font-medium text-slate-800 mb-3 line-clamp-2">{guide.guideName}</h3>
              <div className="mb-3">
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${guide.status === 'complete' ? 'bg-green-500' : 'bg-[var(--ea-primary)]'}`}
                    style={{ width: `${(guide.answeredQuestions / guide.totalQuestions) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-slate-500">
                  <span>{guide.answeredQuestions}/{guide.totalQuestions} questions</span>
                  {guide.score !== null && (
                    <span className={`font-medium ${getScoreColor(guide.score)}`}>{guide.score}%</span>
                  )}
                </div>
              </div>
              {guide.answeredQuestions > 0 && (
                <div className="flex gap-2 text-xs">
                  {guide.yesCount > 0 && <span className="text-green-600">{guide.yesCount} Yes</span>}
                  {guide.partialCount > 0 && <span className="text-yellow-600">{guide.partialCount} Partial</span>}
                  {guide.noCount > 0 && <span className="text-red-600">{guide.noCount} No</span>}
                  {guide.naCount > 0 && <span className="text-slate-500">{guide.naCount} N/A</span>}
                </div>
              )}
              <div className="flex items-center justify-end mt-3 text-[var(--ea-primary)]">
                <span className="text-sm font-medium">
                  {guide.status === 'not_started' ? 'Start' : guide.status === 'complete' ? 'Review' : 'Continue'}
                </span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info footer */}
      <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-start gap-3">
          <ExternalLink className="w-5 h-5 text-slate-400 mt-0.5" />
          <div className="text-sm text-slate-600">
            <p className="font-medium">About SAFER Guides</p>
            <p className="mt-1">
              The Safety Assurance Factors for EHR Resilience (SAFER) guides are self-assessment tools
              developed by ONC to help organizations optimize the safety of EHR use. Completing this
              assessment annually is required for CMS Promoting Interoperability program participation.
            </p>
            <a
              href="https://www.healthit.gov/topic/safety/safer-guides"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--ea-primary)] hover:underline mt-2 inline-block"
            >
              Learn more at HealthIT.gov
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaferGuidesAssessment;
