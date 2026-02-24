/**
 * AISuggestionPanel — AI-powered response suggestion for nurse questions
 *
 * Purpose: Generate and display Claude AI suggestions for patient questions
 * Used by: ResponsePanel
 */

import React, { useState } from 'react';
import { Brain } from 'lucide-react';
import { claudeEdgeService } from '../../../services/claudeEdgeService';
import { UserRole, RequestType } from '../../../types/claude';
import type { ClaudeRequestContext } from '../../../types/claude';
import { auditLogger } from '../../../services/auditLogger';
import { HAIKU_MODEL } from '../../../constants/aiModels';
import type { Question, AISuggestion } from './types';

interface AISuggestionPanelProps {
  question: Question;
  onUseSuggestion: (suggestion: AISuggestion) => void;
}

export const AISuggestionPanel: React.FC<AISuggestionPanelProps> = ({
  question,
  onUseSuggestion,
}) => {
  const [showAiHelp, setShowAiHelp] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);

  const generateAISuggestion = async () => {
    setLoadingAi(true);
    try {
      const healthContext = question.patient_profile
        ? {
            patientId: question.user_id,
            demographics: {
              age: question.patient_profile.age || 70,
              gender: 'unknown' as const,
            },
            currentConditions: (question.patient_profile.conditions || []).map(
              (condition) => ({
                condition,
                severity: 'moderate' as const,
                onsetDate: undefined,
              })
            ),
            medications: (question.patient_profile.medications || []).map(
              (med) => ({
                name: med,
                dosage: 'as prescribed',
                frequency: 'as prescribed',
                purpose: 'chronic condition management',
              })
            ),
            recentVitals: {
              lastUpdated: new Date().toISOString(),
            },
          }
        : undefined;

      const context: ClaudeRequestContext = {
        userId: 'nurse-panel',
        userRole: UserRole.HEALTHCARE_PROVIDER,
        requestId: `nurse-q-${question.id}-${Date.now()}`,
        timestamp: new Date(),
        requestType: RequestType.HEALTH_QUESTION,
        healthContext,
      };

      await auditLogger.info('NURSE_AI_SUGGESTION_REQUESTED', {
        requestId: context.requestId,
        userId: context.userId,
        questionId: question.id,
        category: question.category,
        urgency: question.urgency,
        hasPatientProfile: !!question.patient_profile,
      });

      const enhancedPrompt = `As a registered nurse reviewing a patient question, please provide a professional, evidence-based response.

PATIENT QUESTION:
${question.question_text}

CATEGORY: ${question.category}
URGENCY: ${question.urgency}

${
  question.patient_profile
    ? `PATIENT CONTEXT:
- Age: ${question.patient_profile.age || 'Unknown'}
${question.patient_profile.conditions?.length ? `- Known Conditions: ${question.patient_profile.conditions.join(', ')}` : ''}
${question.patient_profile.medications?.length ? `- Current Medications: ${question.patient_profile.medications.join(', ')}` : ''}`
    : ''
}

Please provide:
1. A clear, compassionate response suitable for sending directly to the patient
2. Your clinical reasoning for this recommendation
3. Any follow-up actions needed
4. Relevant patient education resources

Format your response as a clear, professional message that can be sent to the patient.`;

      const aiResponse = await claudeEdgeService.complete(enhancedPrompt, {
        model: HAIKU_MODEL,
        max_tokens: 1000,
        system:
          'You are a healthcare professional assistant providing guidance for patient questions. Be compassionate, clear, and evidence-based.',
      });

      const suggestion: AISuggestion = {
        response: aiResponse,
        confidence: 0.9,
        reasoning: `AI-generated response based on patient's ${question.category} question via secure Edge Function.`,
        resources: [
          'Evidence-Based Guidelines',
          'Patient Education Materials',
          'Clinical Protocols',
        ],
        followUp: [
          'Document response in patient record',
          'Schedule follow-up if needed',
          'Monitor patient response',
        ],
      };

      setAiSuggestion(suggestion);

      await auditLogger.info('NURSE_AI_SUGGESTION_GENERATED', {
        questionId: question.id,
        confidence: suggestion.confidence,
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSE_AI_SUGGESTION_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { questionId: question.id }
      );

      setAiSuggestion({
        response:
          'Unable to generate AI suggestion at this time. Please provide a manual response based on your clinical judgment.',
        confidence: 0,
        reasoning: 'AI service temporarily unavailable',
        resources: [],
        followUp: ['Provide manual clinical response'],
      });
    } finally {
      setLoadingAi(false);
    }
  };

  const handleToggle = () => {
    setShowAiHelp(!showAiHelp);
    if (!showAiHelp && !aiSuggestion) {
      generateAISuggestion();
    }
  };

  return (
    <div className="mb-4">
      <button
        onClick={handleToggle}
        className="flex items-center space-x-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition min-h-[44px]"
      >
        <Brain size={16} />
        <span>{showAiHelp ? 'Hide AI Assistant' : 'Get AI Response Suggestions'}</span>
      </button>

      {showAiHelp && (
        <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          {loadingAi ? (
            <div className="text-center py-4">
              <div
                className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-2"
                role="progressbar"
              />
              <p className="text-purple-700">
                AI analyzing patient data and question...
              </p>
            </div>
          ) : aiSuggestion ? (
            <div>
              <h4 className="font-medium text-purple-900 mb-2">
                AI Response Suggestion:
              </h4>
              <div className="bg-white p-3 rounded-sm border mb-3">
                <p className="text-gray-800 text-sm mb-2">
                  {aiSuggestion.response}
                </p>
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Confidence:</span>{' '}
                  {(aiSuggestion.confidence * 100).toFixed(0)}%
                </div>
              </div>

              <div className="text-xs text-purple-700 mb-2">
                <span className="font-medium">AI Reasoning:</span>{' '}
                {aiSuggestion.reasoning}
              </div>

              {aiSuggestion.resources.length > 0 && (
                <div className="text-xs text-purple-700 mb-2">
                  <span className="font-medium">Helpful Resources:</span>{' '}
                  {aiSuggestion.resources.join(', ')}
                </div>
              )}

              <button
                onClick={() => onUseSuggestion(aiSuggestion)}
                className="text-xs px-3 py-2 bg-purple-200 text-purple-800 rounded-sm hover:bg-purple-300 min-h-[44px]"
              >
                Use This Response
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default AISuggestionPanel;
