// NurseOS Constants — MBI questions, thresholds, labels, type guards, utilities

import type { BurnoutRiskLevel } from './assessment.types';
import type { ProductLine, ProviderDailyCheckin } from './checkin.types';

// MBI Question Constants
export const MBI_QUESTIONS = {
  emotional_exhaustion: [
    "I feel emotionally drained from my work.",
    "I feel used up at the end of the workday.",
    "I feel fatigued when I get up in the morning and have to face another day on the job.",
    "Working with people all day is really a strain for me.",
    "I feel burned out from my work.",
    "I feel frustrated by my job.",
    "I feel I'm working too hard on my job.",
    "Working with people directly puts too much stress on me.",
    "I feel like I'm at the end of my rope.",
  ],
  depersonalization: [
    "I feel I treat some patients as if they were impersonal objects.",
    "I've become more callous toward people since I took this job.",
    "I worry that this job is hardening me emotionally.",
    "I don't really care what happens to some patients.",
    "I feel patients blame me for some of their problems.",
  ],
  personal_accomplishment: [
    "I can easily understand how my patients feel about things.",
    "I deal very effectively with the problems of my patients.",
    "I feel I'm positively influencing other people's lives through my work.",
    "I feel very energetic.",
    "I can easily create a relaxed atmosphere with my patients.",
    "I feel exhilarated after working closely with my patients.",
    "I have accomplished many worthwhile things in this job.",
    "In my work, I deal with emotional problems very calmly.",
  ],
} as const;

// Burnout Risk Thresholds
export const BURNOUT_THRESHOLDS = {
  low: { min: 0, max: 29 },
  moderate: { min: 30, max: 49 },
  high: { min: 50, max: 69 },
  critical: { min: 70, max: 100 },
} as const;

// Stress Level Labels
export const STRESS_LEVEL_LABELS = {
  1: "😌 Completely calm",
  2: "😊 Very relaxed",
  3: "🙂 Relaxed",
  4: "😐 Slightly stressed",
  5: "😕 Moderately stressed",
  6: "😟 Stressed",
  7: "😰 Very stressed",
  8: "😨 Extremely stressed",
  9: "😫 Overwhelmed",
  10: "🆘 In crisis",
} as const;

// Type Guards
export function isValidProductLine(value: string): value is ProductLine {
  return ['clarity', 'shield', 'both'].includes(value);
}

export function isCriticalBurnoutRisk(risk: BurnoutRiskLevel): boolean {
  return risk === 'critical';
}

export function isRecentCheckin(checkin: ProviderDailyCheckin): boolean {
  const checkinDate = new Date(checkin.checkin_date);
  const now = new Date();
  const diffHours = (now.getTime() - checkinDate.getTime()) / (1000 * 60 * 60);
  return diffHours <= 24;
}

// Utility Functions
export function calculateCompositeBurnoutScore(
  emotional_exhaustion: number,
  depersonalization: number,
  personal_accomplishment: number
): number {
  return (
    emotional_exhaustion * 0.4 +
    depersonalization * 0.3 +
    (100 - personal_accomplishment) * 0.3
  );
}

export function getBurnoutRiskLevel(compositeScore: number): BurnoutRiskLevel {
  if (compositeScore >= 70) return 'critical';
  if (compositeScore >= 50) return 'high';
  if (compositeScore >= 30) return 'moderate';
  return 'low';
}

export function calculateMBIDimensionScore(
  responses: number[],
  maxQuestions: number
): number {
  const sum = responses.reduce((acc, val) => acc + val, 0);
  const maxScore = maxQuestions * 6;
  return (sum / maxScore) * 100;
}

export function formatProviderName(
  family_name: string,
  given_names: string[],
  prefix?: string | null,
  suffix?: string | null
): string {
  const name = `${prefix ? prefix + ' ' : ''}${given_names.join(' ')} ${family_name}${suffix ? ', ' + suffix : ''}`;
  return name.trim();
}
