/**
 * ResponsePanel — Right panel for responding to patient questions
 *
 * Purpose: Response composition, nurse notes, autosave drafts, escalation, AI suggestion
 * Used by: NurseQuestionManager orchestrator
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageCircle, User, Phone, AlertTriangle } from 'lucide-react';
import { NurseQuestionService } from '../../../services/nurseQuestionService';
import type { EscalationLevel } from '../../../services/nurseQuestionService';
import { auditLogger } from '../../../services/auditLogger';
import type { Question, AISuggestion } from './types';
import { getUrgencyColor } from './types';
import { AISuggestionPanel } from './AISuggestionPanel';

interface ResponsePanelProps {
  selectedQuestion: Question | null;
  onQuestionAnswered: (questionId: string, responseText: string) => void;
}

export const ResponsePanel: React.FC<ResponsePanelProps> = ({
  selectedQuestion,
  onQuestionAnswered,
}) => {
  const [responseText, setResponseText] = useState('');
  const [nurseNotes, setNurseNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [usedAiSuggestion, setUsedAiSuggestion] = useState(false);
  const [aiSuggestionText, setAiSuggestionText] = useState<string | null>(null);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [showEscalation, setShowEscalation] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load draft when question changes
  useEffect(() => {
    if (!selectedQuestion) return;
    const hasDraft = loadDraft(selectedQuestion.id);
    if (!hasDraft) {
      setResponseText('');
      setNurseNotes('');
    }
    setUsedAiSuggestion(false);
    setAiSuggestionText(null);
    setAiConfidence(null);
    setShowEscalation(false);
  }, [selectedQuestion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave effect
  const performAutosave = useCallback(async () => {
    if (!selectedQuestion) return;
    setAutoSaving(true);
    try {
      const draftKey = `nurse-draft-${selectedQuestion.id}`;
      const draft = {
        questionId: selectedQuestion.id,
        responseText,
        nurseNotes,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setLastSaved(new Date());
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSE_DRAFT_SAVE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { questionId: selectedQuestion?.id, context: 'saveDraft' }
      );
    } finally {
      setAutoSaving(false);
    }
  }, [selectedQuestion, responseText, nurseNotes]);

  useEffect(() => {
    if (!selectedQuestion || (!responseText && !nurseNotes)) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      performAutosave();
    }, 3000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [responseText, nurseNotes, selectedQuestion, performAutosave]);

  const loadDraft = (questionId: string): boolean => {
    try {
      const draftKey = `nurse-draft-${questionId}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft) as {
          responseText?: string;
          nurseNotes?: string;
          timestamp?: string;
        };
        setResponseText(draft.responseText || '');
        setNurseNotes(draft.nurseNotes || '');
        setLastSaved(draft.timestamp ? new Date(draft.timestamp) : null);
        return true;
      }
    } catch {
      // localStorage may fail in private browsing
    }
    return false;
  };

  const clearDraft = (questionId: string) => {
    try {
      localStorage.removeItem(`nurse-draft-${questionId}`);
      setLastSaved(null);
    } catch {
      // localStorage may fail in private browsing
    }
  };

  const handleUseSuggestion = (suggestion: AISuggestion) => {
    setResponseText(suggestion.response);
    setUsedAiSuggestion(true);
    setAiSuggestionText(suggestion.response);
    setAiConfidence(suggestion.confidence);
  };

  const submitResponse = async () => {
    if (!selectedQuestion || !responseText.trim()) return;

    setSubmitting(true);
    try {
      const answerResult = await NurseQuestionService.submitAnswer({
        questionId: selectedQuestion.id,
        answerText: responseText,
        usedAiSuggestion,
        aiSuggestionText: aiSuggestionText ?? undefined,
        aiConfidence: aiConfidence ?? undefined,
      });

      if (!answerResult.success) {
        await auditLogger.error(
          'NURSE_SUBMIT_ANSWER_FAILED',
          new Error(answerResult.error.message),
          { questionId: selectedQuestion.id }
        );
        return;
      }

      if (nurseNotes.trim()) {
        const noteResult = await NurseQuestionService.addNote(
          selectedQuestion.id,
          nurseNotes
        );
        if (!noteResult.success) {
          await auditLogger.error(
            'NURSE_NOTE_SAVE_FAILED',
            new Error(noteResult.error.message),
            { questionId: selectedQuestion.id }
          );
        }
      }

      clearDraft(selectedQuestion.id);
      onQuestionAnswered(selectedQuestion.id, responseText);

      // Reset form
      setResponseText('');
      setNurseNotes('');
      setUsedAiSuggestion(false);
      setAiSuggestionText(null);
      setAiConfidence(null);
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSE_SUBMIT_RESPONSE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { questionId: selectedQuestion.id }
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEscalate = async (level: EscalationLevel) => {
    if (!selectedQuestion) return;
    setEscalating(true);
    try {
      const result = await NurseQuestionService.escalateQuestion(
        selectedQuestion.id,
        level,
        nurseNotes.trim() || undefined
      );

      if (!result.success) {
        await auditLogger.error(
          'NURSE_ESCALATION_UI_FAILED',
          new Error(result.error.message),
          { questionId: selectedQuestion.id, level }
        );
        return;
      }

      setShowEscalation(false);
      onQuestionAnswered(selectedQuestion.id, `[Escalated to ${level}]`);
    } catch (err: unknown) {
      await auditLogger.error(
        'NURSE_ESCALATION_UI_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { questionId: selectedQuestion.id, level }
      );
    } finally {
      setEscalating(false);
    }
  };

  if (!selectedQuestion) {
    return (
      <div className="bg-white rounded-lg shadow-xs border">
        <div className="p-8 text-center text-gray-500">
          <MessageCircle size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg">Select a question to respond</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-xs border">
      <div className="p-4">
        {/* Header */}
        <div className="border-b pb-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">
              Responding to {selectedQuestion.patient_profile?.first_name}{' '}
              {selectedQuestion.patient_profile?.last_name}
            </h2>
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${getUrgencyColor(selectedQuestion.urgency)}`}
              />
              <span className="text-sm font-medium capitalize">
                {selectedQuestion.urgency} Priority
              </span>
            </div>
          </div>

          {/* Patient Info */}
          <div className="bg-gray-50 p-3 rounded-lg mb-3">
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <User size={16} />
                <span>Age {selectedQuestion.patient_profile?.age ?? 'N/A'}</span>
              </div>
              {selectedQuestion.patient_profile?.phone && (
                <div className="flex items-center space-x-1">
                  <Phone size={16} />
                  <span>{selectedQuestion.patient_profile.phone}</span>
                </div>
              )}
            </div>

            {selectedQuestion.patient_profile?.conditions &&
              selectedQuestion.patient_profile.conditions.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs font-medium text-gray-600">
                    Conditions:{' '}
                  </span>
                  <span className="text-xs text-gray-700">
                    {selectedQuestion.patient_profile.conditions.join(', ')}
                  </span>
                </div>
              )}

            {selectedQuestion.patient_profile?.medications &&
              selectedQuestion.patient_profile.medications.length > 0 && (
                <div className="mt-1">
                  <span className="text-xs font-medium text-gray-600">
                    Medications:{' '}
                  </span>
                  <span className="text-xs text-gray-700">
                    {selectedQuestion.patient_profile.medications.join(', ')}
                  </span>
                </div>
              )}
          </div>

          {/* Question */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-1">
              Patient&apos;s Question:
            </h4>
            <p className="text-blue-800">{selectedQuestion.question_text}</p>
            <p className="text-xs text-blue-600 mt-2">
              Asked: {new Date(selectedQuestion.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* AI Assistance */}
        <AISuggestionPanel
          question={selectedQuestion}
          onUseSuggestion={handleUseSuggestion}
        />

        {/* Response Form */}
        <div className="space-y-4">
          {/* Autosave Indicator */}
          {(responseText || nurseNotes) && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                {autoSaving ? (
                  <>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-blue-600">Saving draft...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-green-600">
                      Draft saved {lastSaved.toLocaleTimeString()}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Response to Patient
            </label>
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={6}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Type your response to the patient here... (autosaves every 3 seconds)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Internal Notes (Not shared with patient)
            </label>
            <textarea
              value={nurseNotes}
              onChange={(e) => setNurseNotes(e.target.value)}
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Add notes for other care team members..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={submitResponse}
              disabled={submitting || !responseText.trim()}
              className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2 min-h-[44px]"
            >
              {submitting ? (
                'Sending Response...'
              ) : (
                <>
                  <Send size={16} />
                  <span>Send Response to Patient</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowEscalation(!showEscalation)}
              className="py-3 px-4 bg-orange-100 text-orange-700 font-medium rounded-lg hover:bg-orange-200 flex items-center space-x-2 min-h-[44px]"
            >
              <AlertTriangle size={16} />
              <span>Escalate</span>
            </button>
          </div>

          {/* Escalation Options */}
          {showEscalation && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm font-medium text-orange-900 mb-3">
                Escalate this question to:
              </p>
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    { level: 'charge_nurse' as EscalationLevel, label: 'Charge Nurse' },
                    { level: 'supervisor' as EscalationLevel, label: 'Supervisor' },
                    { level: 'physician' as EscalationLevel, label: 'Physician' },
                  ] as const
                ).map(({ level, label }) => (
                  <button
                    key={level}
                    onClick={() => handleEscalate(level)}
                    disabled={escalating}
                    className="px-4 py-2 bg-orange-200 text-orange-800 rounded-lg hover:bg-orange-300 disabled:opacity-50 min-h-[44px]"
                  >
                    {escalating ? 'Escalating...' : label}
                  </button>
                ))}
              </div>
              {nurseNotes.trim() && (
                <p className="text-xs text-orange-600 mt-2">
                  Your internal notes will be included as escalation context.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResponsePanel;
