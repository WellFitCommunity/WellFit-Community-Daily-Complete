/**
 * NurseQuestionManager — AI-Powered Nurse Response System
 *
 * Purpose: Orchestrator for patient question queue, response composition, and AI suggestions.
 * Thin wrapper composing QuestionList + ResponsePanel subcomponents.
 *
 * Used by: Admin dashboard (patient-care section)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';
import { NurseQuestionService } from '../../services/nurseQuestionService';
import { auditLogger } from '../../services/auditLogger';
import { QuestionList } from './nurse-questions/QuestionList';
import { ResponsePanel } from './nurse-questions/ResponsePanel';
import { AnalyticsPanel } from './nurse-questions/AnalyticsPanel';
import type { Question, FilterStatus, FilterUrgency, QuestionCategory, QuestionStatus, QuestionUrgency } from './nurse-questions/types';
import type { QueueQuestion } from '../../services/nurseQuestionService';

/** Map service QueueQuestion to component Question */
function mapQueueQuestion(q: QueueQuestion): Question {
  return {
    id: q.question_id,
    user_id: q.user_id,
    question_text: q.question_text,
    category: (q.category || 'general') as QuestionCategory,
    status: (q.status || 'pending') as QuestionStatus,
    urgency: (q.urgency || 'medium') as QuestionUrgency,
    created_at: q.created_at,
    patient_profile: {
      first_name: q.patient_name?.split(' ')[0] || 'Patient',
      last_name: q.patient_name?.split(' ').slice(1).join(' ') || '',
      phone: q.patient_phone || '',
    },
  };
}

const NurseQuestionManager: React.FC = () => {
  useDashboardTheme();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [filterUrgency, setFilterUrgency] = useState<FilterUrgency>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [newQuestionAlert, setNewQuestionAlert] = useState(false);
  const [metricsRefresh, setMetricsRefresh] = useState(0);
  const newQuestionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadInitialQueue = useCallback(async () => {
    const result = await NurseQuestionService.fetchOpenQueue();
    if (result.success) {
      setQuestions(result.data.map(mapQueueQuestion));
    } else {
      await auditLogger.error(
        'NURSE_QUEUE_INITIAL_LOAD_FAILED',
        new Error(result.error.message),
        { context: 'NurseQuestionManager.mount' }
      );
    }
  }, []);

  useEffect(() => {
    loadInitialQueue();

    auditLogger.info('NURSE_QUESTION_MANAGER_VIEW', {
      context: 'dashboard_mount',
    });

    // Subscribe to new questions in realtime
    const unsubInsert = NurseQuestionService.subscribeToNewQuestions(() => {
      // Flash "new question" indicator and reload queue
      setNewQuestionAlert(true);
      if (newQuestionTimerRef.current) clearTimeout(newQuestionTimerRef.current);
      newQuestionTimerRef.current = setTimeout(() => setNewQuestionAlert(false), 5000);
      loadInitialQueue();

      auditLogger.info('NURSE_REALTIME_NEW_QUESTION', {
        context: 'realtime_insert',
      });
    });

    // Subscribe to question updates (escalations, answers)
    const unsubUpdate = NurseQuestionService.subscribeToQuestionUpdates(() => {
      loadInitialQueue();
    });

    return () => {
      unsubInsert();
      unsubUpdate();
      if (newQuestionTimerRef.current) clearTimeout(newQuestionTimerRef.current);
    };
  }, [loadInitialQueue]);

  const handleQuestionsLoaded = (loadedQuestions: Question[]) => {
    setQuestions(loadedQuestions);
    setSelectedQuestion(null);
  };

  const handleSelectQuestion = (question: Question) => {
    setSelectedQuestion(question);
  };

  const handleQuestionAnswered = (questionId: string, responseText: string) => {
    // Find the question being answered for notification
    const answered = questions.find((q) => q.id === questionId);

    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? {
              ...q,
              status: responseText.startsWith('[Escalated')
                ? ('escalated' as const)
                : ('answered' as const),
              response_text: responseText,
              responded_at: new Date().toISOString(),
            }
          : q
      )
    );
    setSelectedQuestion(null);
    setMetricsRefresh((prev) => prev + 1);

    // Notify patient via SMS (fire-and-forget — non-blocking)
    if (answered && !responseText.startsWith('[Escalated') && answered.patient_profile?.phone) {
      NurseQuestionService.notifyPatientAnswered(
        questionId,
        answered.patient_profile.phone,
        answered.patient_profile.first_name || 'there'
      ).catch(() => {
        // SMS failure is non-critical — already logged inside service
      });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Patient Questions - Nurse Dashboard
        </h1>
        <p className="text-gray-600">
          Manage patient questions with AI-powered response assistance
        </p>
      </div>

      {/* Analytics Metrics Panel */}
      <AnalyticsPanel refreshTrigger={metricsRefresh} />

      {/* New question realtime alert */}
      {newQuestionAlert && (
        <div
          className="mb-4 p-3 bg-[var(--ea-primary,#00857a)]/5 border border-[var(--ea-primary,#00857a)]/20 rounded-lg flex items-center justify-between"
          role="alert"
        >
          <span className="text-[var(--ea-primary,#00857a)] font-medium">
            New patient question received — queue refreshed
          </span>
          <button
            onClick={() => setNewQuestionAlert(false)}
            className="text-[var(--ea-primary,#00857a)] hover:text-[var(--ea-primary-hover,#006d64)] text-sm min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <QuestionList
            questions={questions}
            selectedQuestionId={selectedQuestion?.id ?? null}
            filterStatus={filterStatus}
            filterUrgency={filterUrgency}
            searchTerm={searchTerm}
            onQuestionsLoaded={handleQuestionsLoaded}
            onSelectQuestion={handleSelectQuestion}
            onFilterStatusChange={setFilterStatus}
            onFilterUrgencyChange={setFilterUrgency}
            onSearchChange={setSearchTerm}
          />
        </div>

        <div>
          <ResponsePanel
            selectedQuestion={selectedQuestion}
            onQuestionAnswered={handleQuestionAnswered}
          />
        </div>
      </div>
    </div>
  );
};

export default NurseQuestionManager;
