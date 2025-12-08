/**
 * Provider Affirmations Service
 *
 * ATLUS Enhancement: Service - Positive reinforcement for healthcare workers
 *
 * The audit identified that affirmations were only for seniors, not providers.
 * Healthcare workers deserve recognition for their work too!
 *
 * Features:
 * - Role-specific affirmations (nurse, physician, admin, etc.)
 * - Context-aware messages (shift handoff, documentation, patient care)
 * - Metrics-based congratulations ("You've saved 2 hours this week!")
 * - Burnout detection hints ("Time for a break?")
 *
 * Usage:
 * ```typescript
 * import { getProviderAffirmation, showAffirmationToast } from '../services/providerAffirmations';
 *
 * // Get random affirmation
 * const message = getProviderAffirmation('handoff_complete');
 *
 * // Or use the toast helper
 * showAffirmationToast('documentation_saved');
 * ```
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

/**
 * Affirmation categories for different provider actions
 */
export type AffirmationCategory =
  | 'handoff_complete'
  | 'documentation_saved'
  | 'patient_assessed'
  | 'care_plan_updated'
  | 'discharge_complete'
  | 'admission_complete'
  | 'medication_administered'
  | 'vital_signs_recorded'
  | 'order_completed'
  | 'referral_sent'
  | 'task_completed'
  | 'shift_started'
  | 'shift_ended'
  | 'milestone_reached'
  | 'time_saved'
  | 'break_reminder';

/**
 * Affirmation messages by category
 * Each category has multiple messages for variety
 */
const PROVIDER_AFFIRMATIONS: Record<AffirmationCategory, string[]> = {
  handoff_complete: [
    "Handoff complete! The next team is set up for success.",
    "Great handoff! Your thorough documentation makes a difference.",
    "Handoff done. You've ensured continuity of care.",
    "Smooth handoff! Your patients are in good hands.",
    "Excellent work! That handoff will save the next shift time.",
  ],
  documentation_saved: [
    "Documentation saved! Your records matter.",
    "Great work documenting! Every detail counts.",
    "Notes saved. You're keeping the care team informed.",
    "Documentation complete. Clear communication achieved!",
    "Saved! Your thorough records support better outcomes.",
  ],
  patient_assessed: [
    "Assessment complete! Early detection saves lives.",
    "Great assessment! You're keeping patients safe.",
    "Assessment documented. Your vigilance matters.",
    "Nice work! Thorough assessments lead to better care.",
    "Assessment complete. You're making a difference.",
  ],
  care_plan_updated: [
    "Care plan updated! Personalized care at its best.",
    "Plan saved. The whole team can see your insights now.",
    "Care plan complete. Great interdisciplinary coordination!",
    "Updated! Your care planning improves outcomes.",
    "Plan saved. Patient-centered care in action!",
  ],
  discharge_complete: [
    "Discharge complete! Smooth transition home.",
    "Great discharge! You've set them up for success.",
    "Discharge done. Your follow-up instructions will help them heal.",
    "Complete! Another successful care journey.",
    "Discharge complete. Your attention to detail prevents readmissions.",
  ],
  admission_complete: [
    "Admission complete! The patient is in good hands.",
    "Great admission work! Thorough intake leads to better care.",
    "Admission done. You've started their care journey right.",
    "Complete! Your assessment will guide the care team.",
    "Admission complete. Welcome mat rolled out!",
  ],
  medication_administered: [
    "Medication given. Safety check complete!",
    "Med admin done. You're keeping them on track.",
    "Medication administered. Great attention to timing!",
    "Done! Your med pass is keeping patients healthy.",
    "Med given. The five rights, every time!",
  ],
  vital_signs_recorded: [
    "Vitals recorded! Trends are tracking.",
    "Great work! Those vitals help spot changes early.",
    "Vitals done. You're monitoring like a pro.",
    "Recorded! Your vigilance keeps patients safe.",
    "Vitals complete. Early warning signs won't slip by you.",
  ],
  order_completed: [
    "Order completed! Teamwork in action.",
    "Done! Great follow-through on that order.",
    "Order complete. The care plan is moving forward.",
    "Completed! Your efficiency is impressive.",
    "Order done. Smooth coordination with the care team!",
  ],
  referral_sent: [
    "Referral sent! Connecting patients to the right care.",
    "Great referral! You're expanding their care network.",
    "Referral complete. Coordination is key!",
    "Sent! Your referral will get them the help they need.",
    "Referral done. Great advocacy for your patient!",
  ],
  task_completed: [
    "Task done! One less thing on your plate.",
    "Complete! You're crushing your task list.",
    "Task finished. Great productivity!",
    "Done! Steady progress all shift long.",
    "Task complete. You're on a roll!",
  ],
  shift_started: [
    "Shift started! Let's make a difference today.",
    "Welcome to your shift! Your patients are lucky to have you.",
    "Shift begun. Time to do what you do best!",
    "Clocked in! Ready to provide great care.",
    "Shift started. Let's have a great one!",
  ],
  shift_ended: [
    "Shift complete! Great work today.",
    "You made it! Time for some well-deserved rest.",
    "Shift done. Your patients are better off because of you.",
    "End of shift! You've earned a break.",
    "Shift complete. Tomorrow's team will thank you for your work.",
  ],
  milestone_reached: [
    "Milestone reached! You're making progress.",
    "Achievement unlocked! Keep up the great work.",
    "Milestone hit! Your dedication is paying off.",
    "Congratulations! You've reached a new milestone.",
    "Great achievement! You should be proud.",
  ],
  time_saved: [
    "Time saved! Efficiency is your superpower.",
    "That just saved you valuable time. Smart work!",
    "Time back in your day. Great efficiency!",
    "Saved! More time for what matters.",
    "Efficient! That's time you won't have to spend later.",
  ],
  break_reminder: [
    "You've been working hard. Consider taking a quick break.",
    "Reminder: Even superheroes need rest. Take a moment.",
    "You're doing great! Don't forget to hydrate and recharge.",
    "Time for a breather? Your wellbeing matters too.",
    "Pro tip: A short break improves focus. You've earned it!",
  ],
};

/**
 * Metrics-based affirmation templates
 * Use these when you have specific numbers to share
 */
export const METRICS_TEMPLATES = {
  timeSaved: (minutes: number) =>
    `You've saved ${minutes} minutes of documentation time today!`,
  patientsHelped: (count: number) =>
    `You've helped ${count} patients today. Amazing work!`,
  handoffsCompleted: (count: number) =>
    `${count} handoffs completed today. Smooth transitions!`,
  tasksCompleted: (count: number) =>
    `${count} tasks knocked out! You're on fire.`,
  documentationRate: (percent: number) =>
    `Your documentation is ${percent}% faster than average!`,
  weeklyTimeSaved: (hours: number) =>
    `You've saved ${hours} hours of documentation time this week!`,
  streakDays: (days: number) =>
    `${days} day streak! Consistency is key to great care.`,
};

/**
 * Get a random affirmation for a category
 */
export const getProviderAffirmation = (category: AffirmationCategory): string => {
  const messages = PROVIDER_AFFIRMATIONS[category];
  if (!messages || messages.length === 0) {
    return "Great work!";
  }
  return messages[Math.floor(Math.random() * messages.length)];
};

/**
 * Affirmation toast state for components to consume
 */
export interface AffirmationToastState {
  message: string;
  type: 'success' | 'info' | 'achievement';
  category?: AffirmationCategory;
}

/**
 * Create affirmation toast data
 * Components can use this to show their own toast UI
 */
export const createAffirmationToast = (
  category: AffirmationCategory,
  customMessage?: string
): AffirmationToastState => {
  return {
    message: customMessage || getProviderAffirmation(category),
    type: category === 'milestone_reached' ? 'achievement' :
          category === 'break_reminder' ? 'info' : 'success',
    category,
  };
};

/**
 * Hook-friendly affirmation generator
 * Returns { showAffirmation, affirmation, clearAffirmation }
 */
export const useProviderAffirmation = () => {
  // Note: This is a factory function, not a hook
  // For actual React state management, use useState in your component
  let currentAffirmation: AffirmationToastState | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  const showAffirmation = (category: AffirmationCategory, duration = 4000) => {
    currentAffirmation = createAffirmationToast(category);

    // Auto-clear after duration
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      currentAffirmation = null;
    }, duration);

    return currentAffirmation;
  };

  const clearAffirmation = () => {
    if (timeoutId) clearTimeout(timeoutId);
    currentAffirmation = null;
  };

  return {
    showAffirmation,
    get affirmation() { return currentAffirmation; },
    clearAffirmation,
  };
};

/**
 * Check if user might need a break based on activity
 * Call this periodically to remind busy providers to rest
 */
export const shouldSuggestBreak = (
  minutesSinceLastBreak: number,
  tasksCompletedSinceBreak: number
): boolean => {
  // Suggest break after 2 hours or 20+ tasks without break
  return minutesSinceLastBreak >= 120 || tasksCompletedSinceBreak >= 20;
};

export default {
  getProviderAffirmation,
  createAffirmationToast,
  METRICS_TEMPLATES,
  shouldSuggestBreak,
};
