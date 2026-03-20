// NurseOS Training Types — Modules & Completions

export interface ResilienceTrainingModule {
  id: string;
  title: string;
  description?: string | null;
  category: ResilienceCategory;
  content_type: ContentType;
  content_url?: string | null;
  estimated_duration_minutes?: number | null;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  evidence_based: boolean;
  citation?: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

export type ResilienceCategory =
  | 'mindfulness'
  | 'stress_management'
  | 'communication'
  | 'self_care'
  | 'boundary_setting'
  | 'compassion_fatigue'
  | 'moral_injury'
  | 'trauma_support';

export type ContentType =
  | 'video'
  | 'article'
  | 'interactive'
  | 'audio'
  | 'worksheet'
  | 'guided_meditation';

export interface ProviderTrainingCompletion {
  id: string;
  practitioner_id: string;
  user_id: string;
  module_id: string;
  started_at: string;
  completed_at?: string | null;
  completion_percentage: number;
  time_spent_minutes?: number | null;
  found_helpful?: boolean | null;
  notes?: string | null;
  will_practice?: boolean | null;
}
