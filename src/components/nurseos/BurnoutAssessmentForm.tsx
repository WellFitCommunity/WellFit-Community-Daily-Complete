// ============================================================================
// Burnout Assessment Form - Maslach Burnout Inventory (MBI)
// ============================================================================
// Purpose: Comprehensive burnout assessment using MBI framework
// Dimensions: Emotional Exhaustion, Depersonalization, Personal Accomplishment
// Scoring: Auto-calculates risk level (Low, Moderate, High, Critical)
// ============================================================================

import React, { useState } from 'react';
import { submitBurnoutAssessment } from '../../services/resilienceHubService';

interface BurnoutAssessmentFormProps {
  onSuccess: () => void;
  onClose: () => void;
}

// Question structure matching MBI framework
interface Question {
  id: string;
  text: string;
  dimension: 'emotional_exhaustion' | 'depersonalization' | 'personal_accomplishment';
  reverse_scored?: boolean; // For personal accomplishment (higher = better)
}

const questions: Question[] = [
  // EMOTIONAL EXHAUSTION (9 questions)
  {
    id: 'ee1',
    text: 'I feel emotionally drained from my work',
    dimension: 'emotional_exhaustion',
  },
  {
    id: 'ee2',
    text: 'I feel used up at the end of a workday',
    dimension: 'emotional_exhaustion',
  },
  {
    id: 'ee3',
    text: 'I feel tired when I get up in the morning and have to face another day on the job',
    dimension: 'emotional_exhaustion',
  },
  {
    id: 'ee4',
    text: 'Working with patients all day is really a strain for me',
    dimension: 'emotional_exhaustion',
  },
  {
    id: 'ee5',
    text: 'I feel burned out from my work',
    dimension: 'emotional_exhaustion',
  },
  {
    id: 'ee6',
    text: 'I feel frustrated by my job',
    dimension: 'emotional_exhaustion',
  },
  {
    id: 'ee7',
    text: 'I feel I\'m working too hard on my job',
    dimension: 'emotional_exhaustion',
  },
  {
    id: 'ee8',
    text: 'Working directly with patients puts too much stress on me',
    dimension: 'emotional_exhaustion',
  },
  {
    id: 'ee9',
    text: 'I feel like I\'m at the end of my rope',
    dimension: 'emotional_exhaustion',
  },

  // DEPERSONALIZATION (5 questions)
  {
    id: 'dp1',
    text: 'I feel I treat some patients as if they were impersonal objects',
    dimension: 'depersonalization',
  },
  {
    id: 'dp2',
    text: 'I\'ve become more callous toward people since I took this job',
    dimension: 'depersonalization',
  },
  {
    id: 'dp3',
    text: 'I worry that this job is hardening me emotionally',
    dimension: 'depersonalization',
  },
  {
    id: 'dp4',
    text: 'I don\'t really care what happens to some patients',
    dimension: 'depersonalization',
  },
  {
    id: 'dp5',
    text: 'I feel patients blame me for some of their problems',
    dimension: 'depersonalization',
  },

  // PERSONAL ACCOMPLISHMENT (8 questions - REVERSE SCORED)
  {
    id: 'pa1',
    text: 'I can easily understand how my patients feel about things',
    dimension: 'personal_accomplishment',
    reverse_scored: true,
  },
  {
    id: 'pa2',
    text: 'I deal very effectively with the problems of my patients',
    dimension: 'personal_accomplishment',
    reverse_scored: true,
  },
  {
    id: 'pa3',
    text: 'I feel I\'m positively influencing other people\'s lives through my work',
    dimension: 'personal_accomplishment',
    reverse_scored: true,
  },
  {
    id: 'pa4',
    text: 'I feel very energetic',
    dimension: 'personal_accomplishment',
    reverse_scored: true,
  },
  {
    id: 'pa5',
    text: 'I can easily create a relaxed atmosphere with my patients',
    dimension: 'personal_accomplishment',
    reverse_scored: true,
  },
  {
    id: 'pa6',
    text: 'I feel exhilarated after working closely with my patients',
    dimension: 'personal_accomplishment',
    reverse_scored: true,
  },
  {
    id: 'pa7',
    text: 'I have accomplished many worthwhile things in this job',
    dimension: 'personal_accomplishment',
    reverse_scored: true,
  },
  {
    id: 'pa8',
    text: 'In my work, I deal with emotional problems very calmly',
    dimension: 'personal_accomplishment',
    reverse_scored: true,
  },
];

// Frequency scale (0-6)
const frequencyOptions = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'A few times a year or less' },
  { value: 2, label: 'Once a month or less' },
  { value: 3, label: 'A few times a month' },
  { value: 4, label: 'Once a week' },
  { value: 5, label: 'A few times a week' },
  { value: 6, label: 'Every day' },
];

export const BurnoutAssessmentForm: React.FC<BurnoutAssessmentFormProps> = ({
  onSuccess,
  onClose,
}) => {
  const [responses, setResponses] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  const questionsPerPage = 5;
  const totalPages = Math.ceil(questions.length / questionsPerPage);
  const currentQuestions = questions.slice(
    currentPage * questionsPerPage,
    (currentPage + 1) * questionsPerPage
  );

  // Calculate dimension scores (0-100 scale)
  const calculateScores = () => {
    // Emotional Exhaustion (9 questions, max score 54)
    const eeQuestions = questions.filter((q) => q.dimension === 'emotional_exhaustion');
    const eeSum = eeQuestions.reduce((sum, q) => sum + (responses[q.id] || 0), 0);
    const eeScore = (eeSum / 54) * 100; // Normalize to 0-100

    // Depersonalization (5 questions, max score 30)
    const dpQuestions = questions.filter((q) => q.dimension === 'depersonalization');
    const dpSum = dpQuestions.reduce((sum, q) => sum + (responses[q.id] || 0), 0);
    const dpScore = (dpSum / 30) * 100; // Normalize to 0-100

    // Personal Accomplishment (8 questions, max score 48, REVERSE SCORED)
    const paQuestions = questions.filter((q) => q.dimension === 'personal_accomplishment');
    const paSum = paQuestions.reduce((sum, q) => sum + (responses[q.id] || 0), 0);
    const paScore = 100 - (paSum / 48) * 100; // Reverse: lower accomplishment = higher burnout

    return {
      emotional_exhaustion_score: parseFloat(eeScore.toFixed(2)),
      depersonalization_score: parseFloat(dpScore.toFixed(2)),
      personal_accomplishment_score: parseFloat(paScore.toFixed(2)),
    };
  };

  // Handle response change
  const handleResponseChange = (questionId: string, value: number) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  // Check if current page is complete
  const isCurrentPageComplete = () => {
    return currentQuestions.every((q) => responses[q.id] !== undefined);
  };

  // Check if all questions are answered
  const isFormComplete = () => {
    return questions.every((q) => responses[q.id] !== undefined);
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!isFormComplete()) {
      setError('Please answer all questions before submitting');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const scores = calculateScores();
      await submitBurnoutAssessment({
        ...scores,
        questionnaire_responses: questions.map((q) => ({
          question: q.text,
          score: responses[q.id],
          dimension: q.dimension,
        })),
        assessment_type: 'MBI-HSS',
      });

      onSuccess();
    } catch (err) {

      setError(err instanceof Error ? err.message : 'Failed to submit assessment');
      setLoading(false);
    }
  };

  // Instructions screen
  if (showInstructions) {
    return (
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          Burnout Assessment (MBI)
        </h2>

        <div className="space-y-4 text-gray-700">
          <p className="text-lg">
            This assessment uses the <strong>Maslach Burnout Inventory (MBI)</strong>,
            the most widely used tool for measuring burnout in healthcare professionals.
          </p>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
            <p className="text-sm text-blue-800">
              <strong>What it measures:</strong> Three dimensions of burnout - Emotional Exhaustion,
              Depersonalization (cynicism), and reduced Personal Accomplishment.
            </p>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <p className="text-sm text-yellow-800">
              <strong>Time required:</strong> 5-7 minutes (22 questions)
            </p>
          </div>

          <div className="bg-green-50 border-l-4 border-green-500 p-4">
            <p className="text-sm text-green-800">
              <strong>Privacy:</strong> Your responses are confidential. Only you and administrators
              (for intervention purposes) can see your individual results.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Instructions:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Read each statement carefully</li>
              <li>Select how often you feel this way about your work</li>
              <li>Answer honestly - there are no right or wrong answers</li>
              <li>Think about the past 6 months, not just today</li>
              <li>You can go back and change answers before submitting</li>
            </ul>
          </div>

          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <p className="text-sm text-red-800">
              <strong>Crisis Support:</strong> If you are experiencing thoughts of self-harm,
              please call 988 (Suicide & Crisis Lifeline) immediately. This assessment is for
              burnout screening only, not crisis intervention.
            </p>
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <button
            onClick={() => setShowInstructions(false)}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Start Assessment
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Assessment form
  return (
    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-800">Burnout Assessment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>
              Page {currentPage + 1} of {totalPages}
            </span>
            <span>
              {Object.keys(responses).length} / {questions.length} questions answered
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(Object.keys(responses).length / questions.length) * 100}%`,
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="px-6 py-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {currentQuestions.map((question, index) => {
            const questionNumber = currentPage * questionsPerPage + index + 1;
            const selectedValue = responses[question.id];

            return (
              <div
                key={question.id}
                className="bg-gray-50 rounded-lg p-5 border border-gray-200"
              >
                <h3 className="font-semibold text-gray-800 mb-4">
                  {questionNumber}. {question.text}
                </h3>

                <div className="space-y-2">
                  {frequencyOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedValue === option.value
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={option.value}
                        checked={selectedValue === option.value}
                        onChange={() => handleResponseChange(question.id, option.value)}
                        className="w-5 h-5 text-blue-600"
                      />
                      <span className="ml-3 text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className={`px-6 py-3 rounded-lg font-medium ${
              currentPage === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
          >
            ← Previous
          </button>

          <div className="text-sm text-gray-600">
            {!isCurrentPageComplete() && (
              <span className="text-orange-600">
                Please answer all questions on this page
              </span>
            )}
          </div>

          {currentPage < totalPages - 1 ? (
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={!isCurrentPageComplete()}
              className={`px-6 py-3 rounded-lg font-medium ${
                !isCurrentPageComplete()
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!isFormComplete() || loading}
              className={`px-8 py-3 rounded-lg font-medium ${
                !isFormComplete() || loading
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {loading ? 'Submitting...' : 'Submit Assessment'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BurnoutAssessmentForm;
