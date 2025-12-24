/**
 * Envision VirtualEdge Group - Migration Feedback & Survey System
 *
 * Captures:
 * - Staff satisfaction ratings
 * - Data quality assessments
 * - Field-specific feedback
 * - Improvement suggestions
 * - NPS score for migrations
 *
 * Feeds back into the learning system to improve future migrations
 */

import React, { useState, useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export interface MigrationFeedback {
  feedbackId: string;
  batchId: string;
  organizationId: string;
  respondentId?: string;
  respondentRole?: string;
  respondentDepartment?: string;

  // Overall ratings (1-5)
  overallSatisfaction: number;
  dataAccuracy: number;
  mappingQuality: number;
  easeOfUse: number;
  timeEfficiency: number;

  // NPS Score (-100 to 100)
  npsScore: number;
  wouldRecommend: 'yes' | 'no' | 'maybe';

  // Specific feedback
  fieldFeedback: FieldFeedback[];

  // Open responses
  whatWorkedWell?: string;
  whatNeedsImprovement?: string;
  suggestedFeatures?: string;
  additionalComments?: string;

  // Metadata
  completedAt: Date;
  timeToComplete: number; // seconds
}

export interface FieldFeedback {
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  wasAccurate: boolean;
  issueType?: 'wrong_mapping' | 'data_corruption' | 'missing_data' | 'formatting' | 'other';
  issueDescription?: string;
  suggestedFix?: string;
}

export interface SurveyQuestion {
  id: string;
  type: 'rating' | 'nps' | 'yesno' | 'text' | 'multiselect' | 'field_review';
  question: string;
  description?: string;
  required: boolean;
  options?: string[];
}

// =============================================================================
// SURVEY CONFIGURATION
// =============================================================================

const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'overall_satisfaction',
    type: 'rating',
    question: 'How satisfied are you with this data migration?',
    description: 'Rate your overall experience',
    required: true
  },
  {
    id: 'data_accuracy',
    type: 'rating',
    question: 'How accurate was the imported data?',
    description: 'Did the data match your source files?',
    required: true
  },
  {
    id: 'mapping_quality',
    type: 'rating',
    question: 'How well did the system map fields correctly?',
    description: 'Were the automatic field suggestions accurate?',
    required: true
  },
  {
    id: 'ease_of_use',
    type: 'rating',
    question: 'How easy was the migration process?',
    description: 'Was the interface intuitive?',
    required: true
  },
  {
    id: 'time_efficiency',
    type: 'rating',
    question: 'Did this save you time compared to manual entry?',
    description: 'Rate the time savings',
    required: true
  },
  {
    id: 'field_review',
    type: 'field_review',
    question: 'Were there any specific fields with issues?',
    description: 'Select fields that had problems',
    required: false
  },
  {
    id: 'nps',
    type: 'nps',
    question: 'How likely are you to recommend this migration tool to a colleague?',
    description: '0 = Not at all likely, 10 = Extremely likely',
    required: true
  },
  {
    id: 'would_recommend',
    type: 'yesno',
    question: 'Would you use this tool for future migrations?',
    required: true,
    options: ['Yes, definitely', 'Maybe', 'No']
  },
  {
    id: 'worked_well',
    type: 'text',
    question: 'What worked well?',
    description: 'Tell us what you liked about the migration',
    required: false
  },
  {
    id: 'needs_improvement',
    type: 'text',
    question: 'What needs improvement?',
    description: 'Help us make this better',
    required: false
  },
  {
    id: 'suggested_features',
    type: 'multiselect',
    question: 'What features would help you most?',
    required: false,
    options: [
      'Better duplicate detection',
      'More field transformation options',
      'Validation preview before import',
      'Undo/rollback capability',
      'Email notifications on completion',
      'Scheduled/automated imports',
      'Better error messages',
      'Import templates',
      'Side-by-side comparison view',
      'Integration with more source systems'
    ]
  },
  {
    id: 'additional_comments',
    type: 'text',
    question: 'Any additional comments?',
    required: false
  }
];

// =============================================================================
// INPUT COMPONENTS
// =============================================================================

interface RatingInputProps {
  value: number;
  onChange: (value: number) => void;
}

const RatingInput: React.FC<RatingInputProps> = ({ value, onChange }) => {
  const labels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-4 mb-4">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            onClick={() => onChange(rating)}
            className={`
              w-16 h-16 rounded-full text-2xl font-bold transition-all
              ${value === rating
                ? 'bg-teal-600 text-white scale-110 shadow-lg'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:scale-105'
              }
            `}
          >
            {rating}
          </button>
        ))}
      </div>
      <div className="flex justify-between w-full max-w-md text-sm text-gray-500">
        <span>{labels[0]}</span>
        <span>{labels[4]}</span>
      </div>
      {value > 0 && (
        <p className="mt-4 text-lg font-medium text-teal-600">
          {labels[value - 1]}
        </p>
      )}
    </div>
  );
};

interface NPSInputProps {
  value: number;
  onChange: (value: number) => void;
}

const NPSInput: React.FC<NPSInputProps> = ({ value, onChange }) => {
  const getColor = (score: number) => {
    if (score <= 6) return 'bg-red-500';
    if (score <= 8) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div>
      <div className="flex justify-center gap-2 mb-4">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
          <button
            key={score}
            onClick={() => onChange(score)}
            className={`
              w-10 h-10 rounded-lg text-sm font-medium transition-all
              ${value === score
                ? `${getColor(score)} text-white scale-110 shadow-lg`
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }
            `}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-sm text-gray-500 max-w-lg mx-auto">
        <span>Not likely at all</span>
        <span>Extremely likely</span>
      </div>
      <div className="mt-4 text-center">
        {value <= 6 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">
            Detractor
          </span>
        )}
        {value >= 7 && value <= 8 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
            Passive
          </span>
        )}
        {value >= 9 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
            Promoter
          </span>
        )}
      </div>
    </div>
  );
};

interface YesNoInputProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

const YesNoInput: React.FC<YesNoInputProps> = ({ options, value, onChange }) => {
  return (
    <div className="flex flex-col gap-3">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option.toLowerCase().replace(/[^a-z]/g, '_'))}
          className={`
            p-4 rounded-xl border-2 text-left transition-all
            ${value === option.toLowerCase().replace(/[^a-z]/g, '_')
              ? 'border-teal-500 bg-teal-50 text-teal-900'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }
          `}
        >
          <span className="font-medium">{option}</span>
        </button>
      ))}
    </div>
  );
};

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const TextInput: React.FC<TextInputProps> = ({ value, onChange, placeholder }) => {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
    />
  );
};

interface MultiselectInputProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
}

const MultiselectInput: React.FC<MultiselectInputProps> = ({ options, value, onChange }) => {
  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter(v => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => toggleOption(option)}
          className={`
            p-3 rounded-xl border-2 text-left text-sm transition-all
            ${value.includes(option)
              ? 'border-teal-500 bg-teal-50 text-teal-900'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }
          `}
        >
          <div className="flex items-center gap-2">
            <div className={`
              w-5 h-5 rounded border-2 flex items-center justify-center
              ${value.includes(option) ? 'border-teal-500 bg-teal-500' : 'border-gray-300'}
            `}>
              {value.includes(option) && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span>{option}</span>
          </div>
        </button>
      ))}
    </div>
  );
};

interface FieldReviewInputProps {
  fields: Array<{
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
  }>;
  feedback: FieldFeedback[];
  onFeedback: (feedback: FieldFeedback) => void;
}

const FieldReviewInput: React.FC<FieldReviewInputProps> = ({ fields, feedback, onFeedback }) => {
  const [expandedField, setExpandedField] = useState<string | null>(null);

  const issueTypes = [
    { value: 'wrong_mapping', label: 'Wrong field mapping' },
    { value: 'data_corruption', label: 'Data was corrupted/changed' },
    { value: 'missing_data', label: 'Data was missing/lost' },
    { value: 'formatting', label: 'Formatting issues' },
    { value: 'other', label: 'Other issue' }
  ];

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      <p className="text-sm text-gray-500 mb-4">
        Click any field that had issues to provide details
      </p>
      {fields.map((field) => {
        const existingFeedback = feedback.find(f => f.sourceColumn === field.sourceColumn);
        const isExpanded = expandedField === field.sourceColumn;

        return (
          <div key={field.sourceColumn} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedField(isExpanded ? null : field.sourceColumn)}
              className={`
                w-full p-3 flex items-center justify-between text-left
                ${existingFeedback && !existingFeedback.wasAccurate
                  ? 'bg-red-50'
                  : existingFeedback?.wasAccurate
                    ? 'bg-green-50'
                    : 'bg-white hover:bg-gray-50'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs
                  ${existingFeedback && !existingFeedback.wasAccurate
                    ? 'bg-red-500 text-white'
                    : existingFeedback?.wasAccurate
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {existingFeedback && !existingFeedback.wasAccurate ? '✗' : existingFeedback?.wasAccurate ? '✓' : '?'}
                </div>
                <div>
                  <span className="font-medium text-gray-900">{field.sourceColumn}</span>
                  <span className="text-gray-400 mx-2">→</span>
                  <span className="text-gray-600">{field.targetTable}.{field.targetColumn}</span>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <div className="space-y-4">
                  {/* Was it accurate? */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Was this mapping accurate?
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => onFeedback({
                          ...field,
                          wasAccurate: true
                        })}
                        className={`
                          px-4 py-2 rounded-lg border-2 transition-all
                          ${existingFeedback?.wasAccurate === true
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 hover:border-gray-300'
                          }
                        `}
                      >
                        ✓ Yes, correct
                      </button>
                      <button
                        onClick={() => onFeedback({
                          ...field,
                          wasAccurate: false
                        })}
                        className={`
                          px-4 py-2 rounded-lg border-2 transition-all
                          ${existingFeedback?.wasAccurate === false
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-200 hover:border-gray-300'
                          }
                        `}
                      >
                        ✗ No, had issues
                      </button>
                    </div>
                  </div>

                  {/* Issue details (if not accurate) */}
                  {existingFeedback?.wasAccurate === false && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          What type of issue?
                        </label>
                        <select
                          value={existingFeedback.issueType || ''}
                          onChange={(e) => onFeedback({
                            ...existingFeedback,
                            issueType: e.target.value as FieldFeedback['issueType']
                          })}
                          className="w-full p-2 border border-gray-300 rounded-lg"
                        >
                          <option value="">Select issue type...</option>
                          {issueTypes.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Describe the issue (optional)
                        </label>
                        <textarea
                          value={existingFeedback.issueDescription || ''}
                          onChange={(e) => onFeedback({
                            ...existingFeedback,
                            issueDescription: e.target.value
                          })}
                          placeholder="What went wrong?"
                          rows={2}
                          className="w-full p-2 border border-gray-300 rounded-lg resize-none"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// =============================================================================
// SURVEY COMPONENT
// =============================================================================

interface MigrationSurveyProps {
  batchId: string;
  organizationId: string;
  mappedFields: Array<{
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
  }>;
  onComplete: (feedback: MigrationFeedback) => void;
  onSkip: () => void;
  supabase: SupabaseClient;
}

export const MigrationSurvey: React.FC<MigrationSurveyProps> = ({
  batchId,
  organizationId,
  mappedFields,
  onComplete,
  onSkip,
  supabase
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [startTime] = useState(Date.now());
  const [responses, setResponses] = useState<Record<string, unknown>>({
    overall_satisfaction: 0,
    data_accuracy: 0,
    mapping_quality: 0,
    ease_of_use: 0,
    time_efficiency: 0,
    nps: 5,
    would_recommend: '',
    worked_well: '',
    needs_improvement: '',
    suggested_features: [],
    additional_comments: '',
    field_feedback: []
  });
  const [fieldIssues, setFieldIssues] = useState<FieldFeedback[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleResponse = useCallback((questionId: string, value: unknown) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  }, []);

  const handleFieldFeedback = useCallback((feedback: FieldFeedback) => {
    setFieldIssues(prev => {
      const existing = prev.findIndex(f => f.sourceColumn === feedback.sourceColumn);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = feedback;
        return updated;
      }
      return [...prev, feedback];
    });
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < SURVEY_QUESTIONS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);

    const timeToComplete = Math.round((Date.now() - startTime) / 1000);

    const feedback: MigrationFeedback = {
      feedbackId: crypto.randomUUID(),
      batchId,
      organizationId,
      overallSatisfaction: responses.overall_satisfaction as number,
      dataAccuracy: responses.data_accuracy as number,
      mappingQuality: responses.mapping_quality as number,
      easeOfUse: responses.ease_of_use as number,
      timeEfficiency: responses.time_efficiency as number,
      npsScore: responses.nps as number,
      wouldRecommend: responses.would_recommend as 'yes' | 'no' | 'maybe',
      fieldFeedback: fieldIssues,
      whatWorkedWell: responses.worked_well as string,
      whatNeedsImprovement: responses.needs_improvement as string,
      suggestedFeatures: (responses.suggested_features as string[])?.join(', '),
      additionalComments: responses.additional_comments as string,
      completedAt: new Date(),
      timeToComplete
    };

    try {
      // Save to database
      await supabase
        .from('migration_feedback')
        .insert({
          feedback_id: feedback.feedbackId,
          batch_id: feedback.batchId,
          organization_id: feedback.organizationId,
          overall_satisfaction: feedback.overallSatisfaction,
          data_accuracy: feedback.dataAccuracy,
          mapping_quality: feedback.mappingQuality,
          ease_of_use: feedback.easeOfUse,
          time_efficiency: feedback.timeEfficiency,
          nps_score: feedback.npsScore,
          would_recommend: feedback.wouldRecommend,
          field_feedback: feedback.fieldFeedback,
          what_worked_well: feedback.whatWorkedWell,
          what_needs_improvement: feedback.whatNeedsImprovement,
          suggested_features: feedback.suggestedFeatures,
          additional_comments: feedback.additionalComments,
          time_to_complete: feedback.timeToComplete
        });

      // Process field feedback for learning
      for (const fieldFb of fieldIssues) {
        if (!fieldFb.wasAccurate && fieldFb.issueType === 'wrong_mapping') {
          // Feed back to the learning system
          await supabase.rpc('decrease_mapping_confidence', {
            p_source_column: fieldFb.sourceColumn.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            p_target_table: fieldFb.targetTable,
            p_target_column: fieldFb.targetColumn
          });
        }
      }

      onComplete(feedback);
    } catch (error) {
      // Error handling - feedback submission is non-critical
      onComplete(feedback);
    } finally {
      setIsSubmitting(false);
    }
  }, [responses, fieldIssues, batchId, organizationId, startTime, supabase, onComplete]);

  const currentQuestion = SURVEY_QUESTIONS[currentStep];
  const progress = ((currentStep + 1) / SURVEY_QUESTIONS.length) * 100;

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden">
        {/* Header - Envision Atlus branding */}
        <div className="bg-linear-to-r from-teal-600 to-teal-700 px-8 py-6 text-white">
          <h1 className="text-2xl font-bold">Help Us Improve</h1>
          <p className="text-teal-100 mt-1">Your feedback makes our migration tool smarter</p>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-teal-200 mb-1">
              <span>Question {currentStep + 1} of {SURVEY_QUESTIONS.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <div className="h-2 bg-teal-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question Content */}
        <div className="p-8">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {currentQuestion.question}
            </h2>
            {currentQuestion.description && (
              <p className="text-gray-500">{currentQuestion.description}</p>
            )}
          </div>

          {/* Question Types */}
          {currentQuestion.type === 'rating' && (
            <RatingInput
              value={(responses[currentQuestion.id] as number) || 0}
              onChange={(v) => handleResponse(currentQuestion.id, v)}
            />
          )}

          {currentQuestion.type === 'nps' && (
            <NPSInput
              value={responses.nps as number}
              onChange={(v) => handleResponse('nps', v)}
            />
          )}

          {currentQuestion.type === 'yesno' && (
            <YesNoInput
              options={currentQuestion.options || ['Yes', 'Maybe', 'No']}
              value={responses[currentQuestion.id] as string}
              onChange={(v) => handleResponse(currentQuestion.id, v)}
            />
          )}

          {currentQuestion.type === 'text' && (
            <TextInput
              value={(responses[currentQuestion.id] as string) || ''}
              onChange={(v) => handleResponse(currentQuestion.id, v)}
              placeholder="Type your response..."
            />
          )}

          {currentQuestion.type === 'multiselect' && (
            <MultiselectInput
              options={currentQuestion.options || []}
              value={(responses[currentQuestion.id] as string[]) || []}
              onChange={(v) => handleResponse(currentQuestion.id, v)}
            />
          )}

          {currentQuestion.type === 'field_review' && (
            <FieldReviewInput
              fields={mappedFields}
              feedback={fieldIssues}
              onFeedback={handleFieldFeedback}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
          <div>
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onSkip}
              className="px-4 py-2 text-gray-500 hover:text-gray-700"
            >
              Skip Survey
            </button>
            {currentStep < SURVEY_QUESTIONS.length - 1 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// QUICK FEEDBACK WIDGET (Post-Migration Toast)
// =============================================================================

interface QuickFeedbackProps {
  batchId: string;
  onRated: (rating: number) => void;
  onDetailedFeedback: () => void;
  onDismiss: () => void;
}

export const QuickFeedbackWidget: React.FC<QuickFeedbackProps> = ({
  batchId: _batchId,
  onRated,
  onDetailedFeedback,
  onDismiss
}) => {
  const [rated, setRated] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);

  const handleRate = (value: number) => {
    setRating(value);
    setRated(true);
    onRated(value);
  };

  return (
    <div className="fixed bottom-6 right-6 bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 max-w-sm animate-slide-up z-50">
      {!rated ? (
        <>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">How was your migration?</h3>
              <p className="text-sm text-gray-500">Quick rating helps us improve</p>
            </div>
            <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRate(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="text-3xl transition-transform hover:scale-125"
              >
                <span role="img" aria-label={`${star} star`}>
                  {star <= (hoveredRating || rating) ? '★' : '☆'}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={onDetailedFeedback}
            className="w-full text-sm text-teal-600 hover:text-teal-800"
          >
            Give detailed feedback →
          </button>
        </>
      ) : (
        <div className="text-center py-4">
          <div className="text-4xl mb-2" role="img" aria-label="celebration">🎉</div>
          <h3 className="font-semibold text-gray-900">Thanks for your feedback!</h3>
          <p className="text-sm text-gray-500 mt-1">
            {rating >= 4 ? "We're glad the migration went well!" : "We'll work on making it better."}
          </p>
          <button
            onClick={onDetailedFeedback}
            className="mt-4 text-sm text-teal-600 hover:text-teal-800"
          >
            Share more details →
          </button>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// EXPORTS
// =============================================================================

export { SURVEY_QUESTIONS };
export type { MigrationSurveyProps, QuickFeedbackProps };
