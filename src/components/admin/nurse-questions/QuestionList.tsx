/**
 * QuestionList — Left panel showing patient questions with filters
 *
 * Purpose: Display filterable/searchable list of patient questions
 * Used by: NurseQuestionManager orchestrator
 */

import React from 'react';
import { Search, Filter, Clock, AlertTriangle } from 'lucide-react';
import { NurseQuestionService } from '../../../services/nurseQuestionService';
import type { QueueQuestion, MyQuestion } from '../../../services/nurseQuestionService';
import { auditLogger } from '../../../services/auditLogger';
import type {
  Question,
  FilterStatus,
  FilterUrgency,
  QuestionCategory,
  QuestionStatus,
  QuestionUrgency,
} from './types';
import { getUrgencyColor, getStatusColor } from './types';

interface QuestionListProps {
  questions: Question[];
  selectedQuestionId: string | null;
  filterStatus: FilterStatus;
  filterUrgency: FilterUrgency;
  searchTerm: string;
  onQuestionsLoaded: (questions: Question[]) => void;
  onSelectQuestion: (question: Question) => void;
  onFilterStatusChange: (status: FilterStatus) => void;
  onFilterUrgencyChange: (urgency: FilterUrgency) => void;
  onSearchChange: (term: string) => void;
}

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

/** Map service MyQuestion to component Question */
function mapMyQuestion(q: MyQuestion): Question {
  return {
    ...mapQueueQuestion(q),
    claimed_at: q.claimed_at ?? undefined,
  };
}

export const QuestionList: React.FC<QuestionListProps> = ({
  questions,
  selectedQuestionId,
  filterStatus,
  filterUrgency,
  searchTerm,
  onQuestionsLoaded,
  onSelectQuestion,
  onFilterStatusChange,
  onFilterUrgencyChange,
  onSearchChange,
}) => {
  const loadQueue = async () => {
    const result = await NurseQuestionService.fetchOpenQueue();
    if (result.success) {
      onQuestionsLoaded(result.data.map(mapQueueQuestion));
    } else {
      await auditLogger.error('NURSE_QUEUE_LOAD_FAILED', new Error(result.error.message), {
        context: 'QuestionList.loadQueue',
      });
    }
  };

  const loadMyQuestions = async () => {
    const result = await NurseQuestionService.fetchMyQuestions();
    if (result.success) {
      onQuestionsLoaded(result.data.map(mapMyQuestion));
    } else {
      await auditLogger.error('NURSE_MY_QUESTIONS_LOAD_FAILED', new Error(result.error.message), {
        context: 'QuestionList.loadMyQuestions',
      });
    }
  };

  const handleSelectQuestion = async (question: Question) => {
    if (question.status === 'pending') {
      const result = await NurseQuestionService.claimQuestion(question.id);
      if (!result.success) {
        await auditLogger.error('NURSE_CLAIM_FAILED', new Error(result.error.message), {
          questionId: question.id,
          context: 'QuestionList.handleSelectQuestion',
        });
      }
    }
    onSelectQuestion(question);
  };

  const filteredQuestions = questions.filter(q => {
    const matchesStatus = filterStatus === 'all' || q.status === filterStatus;
    const matchesUrgency = filterUrgency === 'all' || q.urgency === filterUrgency;
    const matchesSearch =
      searchTerm === '' ||
      q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${q.patient_profile?.first_name} ${q.patient_profile?.last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    return matchesStatus && matchesUrgency && matchesSearch;
  });

  return (
    <>
      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-xs border p-4 mb-6" aria-label="Question Filters">
        <div className="flex flex-wrap gap-4 items-center">
          <button
            onClick={loadQueue}
            className="px-4 py-2 bg-[var(--ea-primary)] text-white rounded-lg hover:bg-[var(--ea-primary-hover)] min-h-[44px]"
          >
            Queue
          </button>

          <button
            onClick={loadMyQuestions}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 min-h-[44px]"
          >
            My Questions
          </button>

          <div className="flex items-center space-x-2">
            <Search size={20} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search questions or patient names..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)]"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter size={20} className="text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => onFilterStatusChange(e.target.value as FilterStatus)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)]"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="claimed">Claimed</option>
              <option value="answered">Answered</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <AlertTriangle size={20} className="text-gray-400" />
            <select
              value={filterUrgency}
              onChange={(e) => onFilterUrgencyChange(e.target.value as FilterUrgency)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)]"
            >
              <option value="all">All Priority</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          <div className="ml-auto text-sm text-gray-600">
            {filteredQuestions.length} questions
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="bg-white rounded-lg shadow-xs border" aria-label="Patient Questions List">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Patient Questions</h2>
        </div>

        <div className="divide-y max-h-96 overflow-y-auto">
          {filteredQuestions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No questions match your filters</p>
            </div>
          ) : (
            filteredQuestions.map((question) => (
              <div
                key={question.id}
                className={`p-4 cursor-pointer hover:bg-gray-50 ${
                  selectedQuestionId === question.id
                    ? 'bg-[var(--ea-primary)]/10 border-r-4 border-[var(--ea-primary)]'
                    : ''
                }`}
                onClick={() => handleSelectQuestion(question)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-3 h-3 rounded-full ${getUrgencyColor(question.urgency)}`}
                    />
                    <span className="font-medium">
                      {question.patient_profile?.first_name}{' '}
                      {question.patient_profile?.last_name}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${getStatusColor(question.status)}`}
                    >
                      {question.status}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(question.created_at).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                  {question.question_text}
                </p>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="capitalize">{question.category}</span>
                  <div className="flex items-center space-x-2">
                    <Clock size={12} />
                    <span>
                      {new Date(question.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default QuestionList;
