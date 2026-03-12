/**
 * Community Moments — Type Definitions & Constants
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

export interface Affirmation {
  text: string;
  author: string;
}

export interface Profile {
  first_name?: string;
  last_name?: string;
}

export interface Moment {
  id: string;
  user_id: string;
  file_url?: string;
  file_path?: string;
  title: string;
  description: string;
  emoji: string;
  tags: string;
  is_gallery_high: boolean;
  approval_status?: string;
  created_at: string;
  profile?: Profile;
}

export const BUCKET = 'community-moments';
export const PAGE_SIZE = 12;
export const MAX_FILE_MB = 20;

export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

// Popular emojis for seniors - easy to see and relatable
export const QUICK_EMOJIS = ['😊', '❤️', '🎉', '👍', '🌸', '☀️', '🎂', '🏆', '📸', '🌈', '⭐', '🎵'];
