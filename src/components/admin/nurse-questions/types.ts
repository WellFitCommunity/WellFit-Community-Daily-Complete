/**
 * Nurse Question Manager — Shared Types
 *
 * Type definitions for the nurse question management system.
 * Used by QuestionList, ResponsePanel, AISuggestionPanel, and orchestrator.
 */

export interface Question {
  id: string;
  user_id: string;
  question_text: string;
  category: QuestionCategory;
  status: QuestionStatus;
  urgency: QuestionUrgency;
  response_text?: string;
  nurse_notes?: string;
  ai_suggestions?: string[];
  ai_context?: string;
  created_at: string;
  responded_at?: string;
  claimed_at?: string;
  escalation_level?: string;
  patient_profile?: PatientProfile;
}

export type QuestionCategory = 'general' | 'health' | 'medication' | 'emergency' | 'technical';
export type QuestionStatus = 'pending' | 'claimed' | 'answered' | 'escalated' | 'closed';
export type QuestionUrgency = 'low' | 'medium' | 'high';

export interface PatientProfile {
  first_name: string;
  last_name: string;
  phone: string;
  age?: number;
  conditions?: string[];
  medications?: string[];
}

export interface AISuggestion {
  response: string;
  confidence: number;
  reasoning: string;
  resources: string[];
  followUp: string[];
}

export type FilterStatus = 'all' | 'pending' | 'claimed' | 'answered';
export type FilterUrgency = 'all' | 'low' | 'medium' | 'high';

export function getUrgencyColor(urgency: QuestionUrgency): string {
  switch (urgency) {
    case 'high': return 'bg-red-500';
    case 'medium': return 'bg-yellow-500';
    default: return 'bg-green-500';
  }
}

export function getStatusColor(status: QuestionStatus): string {
  switch (status) {
    case 'pending': return 'text-yellow-600 bg-yellow-100';
    case 'claimed': return 'text-blue-600 bg-blue-100';
    case 'answered': return 'text-green-600 bg-green-100';
    case 'escalated': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
}
