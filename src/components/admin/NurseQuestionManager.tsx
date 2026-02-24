/**
 * NurseQuestionManager — AI-Powered Nurse Response System
 *
 * Purpose: Orchestrator for patient question queue, response composition, and AI suggestions.
 * Thin wrapper composing QuestionList + ResponsePanel subcomponents.
 *
 * Used by: Admin dashboard (patient-care section)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { NurseQuestionService } from '../../services/nurseQuestionService';
import { auditLogger } from '../../services/auditLogger';
import { QuestionList } from './nurse-questions/QuestionList';
import { ResponsePanel } from './nurse-questions/ResponsePanel';
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
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [filterUrgency, setFilterUrgency] = useState<FilterUrgency>('all');
  const [searchTerm, setSearchTerm] = useState('');

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
  }, [loadInitialQueue]);

  const handleQuestionsLoaded = (loadedQuestions: Question[]) => {
    setQuestions(loadedQuestions);
    setSelectedQuestion(null);
  };

  const handleSelectQuestion = (question: Question) => {
    setSelectedQuestion(question);
  };

  const handleQuestionAnswered = (questionId: string, responseText: string) => {
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
