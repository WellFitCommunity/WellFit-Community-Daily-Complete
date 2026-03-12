/**
 * Self Reporting — Type Definitions & Constants
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

export type SourceType = 'self' | 'staff';

export interface SelfReportData {
  id: string;
  created_at: string;
  mood: string;
  symptoms?: string | null;
  activity_description?: string | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  blood_sugar?: number | null;
  blood_oxygen?: number | null;
  weight?: number | null;
  physical_activity?: string | null;
  social_engagement?: string | null;
  user_id: string;
  heart_rate?: number | null;
  spo2?: number | null;
}

export interface SelfReportLog extends SelfReportData {
  source_type: SourceType;
  blood_pressure_systolic?: number | null;
  blood_pressure_diastolic?: number | null;
}

export interface SelfReportDbRow {
  id: string;
  created_at: string;
  user_id: string;
  mood?: string;
  symptoms?: string | null;
  activity_description?: string | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  heart_rate?: number | null;
  blood_sugar?: number | null;
  blood_oxygen?: number | null;
  weight?: number | null;
  physical_activity?: string | null;
  social_engagement?: string | null;
  spo2?: number | null;
}

export const MOOD_OPTIONS = ['Great', 'Good', 'Okay', 'Not Great', 'Sad', 'Anxious', 'Tired', 'Stressed'] as const;

export const PHYSICAL_ACTIVITY_OPTIONS = [
  'Walking',
  'Gym/Fitness Center',
  'YMCA',
  'Swimming',
  'Yoga/Stretching',
  'Dancing',
  'Gardening',
  'Housework',
  'Resting/No Activity'
] as const;

export const SOCIAL_ENGAGEMENT_OPTIONS = [
  'Spent time with family',
  'Called/texted friends',
  'Attended social event',
  'Volunteered',
  'Went to religious service',
  'Participated in group activity',
  'Had visitors',
  'Went out with others',
  'Stayed home alone',
  'Connected online/video call'
] as const;

export const SELF_REPORTS_SELECT = 'id, created_at, user_id, mood, symptoms, activity_description, bp_systolic, bp_diastolic, heart_rate, blood_sugar, blood_oxygen, weight, physical_activity, social_engagement, spo2';

export function normalizeReportRow(r: SelfReportDbRow): SelfReportLog {
  return {
    id: r.id,
    created_at: r.created_at,
    user_id: r.user_id,
    mood: String(r.mood ?? ''),
    symptoms: r.symptoms ?? null,
    activity_description: r.activity_description ?? null,
    bp_systolic: r.bp_systolic ?? null,
    bp_diastolic: r.bp_diastolic ?? null,
    blood_pressure_systolic: r.bp_systolic ?? null,
    blood_pressure_diastolic: r.bp_diastolic ?? null,
    blood_sugar: r.blood_sugar ?? null,
    blood_oxygen: r.blood_oxygen ?? null,
    weight: r.weight ?? null,
    physical_activity: r.physical_activity ?? null,
    social_engagement: r.social_engagement ?? null,
    spo2: r.spo2 ?? null,
    heart_rate: r.heart_rate ?? null,
    source_type: 'self',
  };
}

export function colorForSource(type: SourceType | string): string {
  if (type === 'self') return '#8cc63f';
  if (type === 'staff') return '#ff9800';
  return '#bdbdbd';
}
