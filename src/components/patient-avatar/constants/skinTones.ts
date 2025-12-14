/**
 * Skin Tone Constants for Patient Avatar
 *
 * Respectful, realistic representation of human skin diversity.
 * These hex values are carefully chosen to represent real skin tones.
 */

import { SkinTone } from '../../../types/patientAvatar';

/**
 * Skin tone hex color values
 */
export const SKIN_TONE_COLORS: Record<SkinTone, string> = {
  light: '#FFE0BD',
  mediumLight: '#E5C298',
  medium: '#C68642',
  mediumDark: '#8D5524',
  dark: '#5C3A21',
} as const;

/**
 * Display labels for skin tone selector
 */
export const SKIN_TONE_LABELS: Record<SkinTone, string> = {
  light: 'Light',
  mediumLight: 'Medium Light',
  medium: 'Medium',
  mediumDark: 'Medium Dark',
  dark: 'Dark',
} as const;

/**
 * All available skin tones in order
 */
export const SKIN_TONES: readonly SkinTone[] = [
  'light',
  'mediumLight',
  'medium',
  'mediumDark',
  'dark',
];

/**
 * Default skin tone if not specified
 */
export const DEFAULT_SKIN_TONE: SkinTone = 'medium';
