// NurseOS Support Types — Circles, Reflections, Resources

export interface ProviderSupportCircle {
  id: string;
  name: string;
  description?: string | null;
  meeting_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  max_members: number;
  is_active: boolean;
  facilitator_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderSupportCircleMember {
  id: string;
  circle_id: string;
  practitioner_id: string;
  user_id: string;
  joined_at: string;
  role: 'member' | 'facilitator';
  is_active: boolean;
}

export interface ProviderSupportReflection {
  id: string;
  circle_id: string;
  author_id?: string | null;
  reflection_text: string;
  is_anonymous: boolean;
  tags?: string[] | null;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

export interface ResilienceResource {
  id: string;
  title: string;
  description?: string | null;
  resource_type: ResourceType;
  url?: string | null;
  thumbnail_url?: string | null;
  categories: string[];
  tags?: string[] | null;
  target_audience?: string[] | null;
  is_evidence_based: boolean;
  citation?: string | null;
  reviewed_by?: string | null;
  is_active: boolean;
  featured: boolean;
  view_count: number;
  average_rating?: number | null;
  created_at: string;
  updated_at: string;
}

export type ResourceType =
  | 'article'
  | 'video'
  | 'podcast'
  | 'app'
  | 'book'
  | 'worksheet'
  | 'hotline'
  | 'website';
