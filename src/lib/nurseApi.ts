/**
 * Nurse API — Thin wrapper around NurseQuestionService
 *
 * Maintains backward compatibility with NurseQuestionManager.tsx imports.
 * Maps new service types to the old field names the component expects.
 * Will be replaced by direct service calls in Session 2 (UI wiring).
 */

import { NurseQuestionService } from '../services/nurseQuestionService';

// Legacy return types matching what NurseQuestionManager.tsx expects
interface LegacyQueueItem {
  question_id: string;
  asked_at: string;
  preview: string;
}

interface LegacyMyQuestion {
  question_id: string;
  asked_at: string;
  status: string;
  question: string;
}

// 1) Queue (unassigned questions)
export async function fetchNurseQueue(): Promise<LegacyQueueItem[]> {
  const result = await NurseQuestionService.fetchOpenQueue();
  if (!result.success) throw new Error(result.error.message);
  return result.data.map(q => ({
    question_id: q.question_id,
    asked_at: q.created_at,
    preview: q.question_text,
  }));
}

// 2) Claim a question
export async function claimQuestion(questionId: string): Promise<void> {
  const result = await NurseQuestionService.claimQuestion(questionId);
  if (!result.success) throw new Error(result.error.message);
}

// 3) My assigned list
export async function fetchMyQuestions(): Promise<LegacyMyQuestion[]> {
  const result = await NurseQuestionService.fetchMyQuestions();
  if (!result.success) throw new Error(result.error.message);
  return result.data.map(q => ({
    question_id: q.question_id,
    asked_at: q.created_at,
    status: q.status,
    question: q.question_text,
  }));
}

// 4) Submit patient-facing answer
export async function submitAnswer(questionId: string, answer: string): Promise<string> {
  const result = await NurseQuestionService.submitAnswer({
    questionId,
    answerText: answer,
  });
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}

// 5) Add private nurse note
export async function addNurseNote(questionId: string, note: string): Promise<string> {
  const result = await NurseQuestionService.addNote(questionId, note);
  if (!result.success) throw new Error(result.error.message);
  return result.data;
}
