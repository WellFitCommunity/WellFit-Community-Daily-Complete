import { supabase } from './supabaseClient';

// 1) Queue (unassigned, redacted)
export async function fetchNurseQueue() {
  const { data, error } = await supabase.rpc("nurse_open_queue");
  if (error) throw error;
  return data as { question_id: string; asked_at: string; preview: string }[];
}

// 2) Claim a question
export async function claimQuestion(questionId: string) {
  const { data, error } = await supabase.rpc("nurse_claim_question", {
    p_question_id: questionId,
  });
  if (error) throw error;
  return data;
}

// 3) My assigned list
export async function fetchMyQuestions() {
  const { data, error } = await supabase.rpc("nurse_my_questions");
  if (error) throw error;
  return data as {
    question_id: string;
    asked_at: string;
    status: string;
    question: string;
  }[];
}

// 4) Submit patient-facing answer
export async function submitAnswer(questionId: string, answer: string) {
  const { data, error } = await supabase.rpc("nurse_submit_answer", {
    p_question_id: questionId,
    p_answer: answer,
  });
  if (error) throw error;
  return data;
}

// 5) Add private nurse note
export async function addNurseNote(questionId: string, note: string) {
  const { data, error } = await supabase.rpc("nurse_add_note", {
    p_question_id: questionId,
    p_note: note,
  });
  if (error) throw error;
  return data;
}
