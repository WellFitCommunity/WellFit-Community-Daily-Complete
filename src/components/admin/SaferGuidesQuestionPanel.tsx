/**
 * SAFER Guides Question Panel — displays questions for a selected guide
 *
 * Extracted from SaferGuidesAssessment.tsx to stay under 600-line limit.
 * ONC Requirement: CMS Promoting Interoperability Program
 */

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { type GuideProgress, type QuestionWithResponse, type ResponseValue } from '../../services/saferGuidesService';
import { getCategoryColor, getScoreColor } from './saferGuidesHelpers';

import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';

interface SaferGuidesQuestionPanelProps {
  guide: GuideProgress;
  questions: QuestionWithResponse[];
  isLoadingQuestions: boolean;
  isSaving: boolean;
  error: string | null;
  onBack: () => void;
  onResponseChange: (questionId: string, response: ResponseValue) => void;
}

const SaferGuidesQuestionPanel: React.FC<SaferGuidesQuestionPanelProps> = ({
  guide,
  questions,
  isLoadingQuestions,
  isSaving,
  error,
  onBack,
  onResponseChange,
}) => {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to All Guides
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Guide {guide.guideNumber}: {guide.guideName}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={getCategoryColor(guide.category)}>
                {guide.category}
              </Badge>
              <span className="text-sm text-slate-500">
                {guide.answeredQuestions} of {guide.totalQuestions} questions answered
              </span>
            </div>
          </div>

          {guide.score !== null && (
            <div className={`text-3xl font-bold ${getScoreColor(guide.score)}`}>
              {guide.score}%
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${(guide.answeredQuestions / guide.totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Questions */}
      {isLoadingQuestions ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse h-40 bg-slate-200 rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((item, index) => (
            <Card key={item.question.id} className="border-slate-200">
              <CardContent className="p-6">
                <div className="mb-4">
                  <span className="text-sm font-medium text-slate-500">
                    Question {index + 1} of {questions.length}
                  </span>
                  <p className="text-lg font-medium text-slate-900 mt-1">
                    {item.question.question_text}
                  </p>
                  {item.question.help_text && (
                    <p className="text-sm text-slate-500 mt-2">
                      {item.question.help_text}
                    </p>
                  )}
                </div>

                {/* Response options */}
                <div
                  className="flex flex-wrap gap-3"
                  role="radiogroup"
                  aria-label={`Response for question ${index + 1}`}
                >
                  {(['yes', 'partial', 'no', 'na'] as ResponseValue[]).map(value => {
                    const isSelected = item.response?.response === value;
                    const labels: Record<ResponseValue, string> = {
                      yes: 'Yes',
                      partial: 'Partial',
                      no: 'No',
                      na: 'N/A'
                    };
                    const colors: Record<ResponseValue, string> = {
                      yes: isSelected ? 'bg-green-600 text-white border-green-600' : 'border-green-300 text-green-700 hover:bg-green-50',
                      partial: isSelected ? 'bg-yellow-500 text-white border-yellow-500' : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50',
                      no: isSelected ? 'bg-red-600 text-white border-red-600' : 'border-red-300 text-red-700 hover:bg-red-50',
                      na: isSelected ? 'bg-slate-600 text-white border-slate-600' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    };

                    return (
                      <button
                        key={value}
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => onResponseChange(item.question.id, value)}
                        disabled={isSaving}
                        className={`
                          px-4 py-2 rounded-lg border-2 font-medium transition-all
                          min-w-[80px] text-center
                          ${colors[value]}
                          ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        {labels[value]}
                      </button>
                    );
                  })}
                </div>

                {/* Recommended practice for "No" responses */}
                {item.response?.response === 'no' && item.question.recommended_practice && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-800">Recommended Practice:</p>
                    <p className="text-sm text-amber-700 mt-1">
                      {item.question.recommended_practice}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SaferGuidesQuestionPanel;
