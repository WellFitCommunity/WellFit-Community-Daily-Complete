/**
 * Smart Mood Suggestions Pool
 *
 * 30+ curated suggestions organized by mood category.
 * Haiku AI selects the most appropriate ones based on user context.
 *
 * Categories:
 * - anxious: Calming, grounding techniques
 * - sad: Comfort, connection, gentle activities
 * - stressed: Stress relief, relaxation
 * - tired: Energy, rest, self-care
 * - lonely: Social connection, community
 * - angry: Healthy expression, calming
 * - overwhelmed: Simplification, one-step-at-a-time
 * - positive: Maintain momentum, gratitude
 * - neutral: General wellness, engagement
 */

export interface MoodSuggestion {
  id: string;
  text: string;
  category: MoodCategory;
  type: SuggestionType;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'any';
  requiresOthers?: boolean;
  physicalActivity?: 'none' | 'light' | 'moderate';
}

export type MoodCategory =
  | 'anxious'
  | 'sad'
  | 'stressed'
  | 'tired'
  | 'lonely'
  | 'angry'
  | 'overwhelmed'
  | 'positive'
  | 'neutral';

export type SuggestionType =
  | 'breathing'
  | 'physical'
  | 'social'
  | 'mindfulness'
  | 'practical'
  | 'comfort'
  | 'gratitude'
  | 'creative';

export const MOOD_TO_CATEGORY: Record<string, MoodCategory> = {
  'Great': 'positive',
  'Good': 'positive',
  'Okay': 'neutral',
  'Not Great': 'sad',
  'Sad': 'sad',
  'Anxious': 'anxious',
  'Tired': 'tired',
  'Stressed': 'stressed',
};

export const moodSuggestions: MoodSuggestion[] = [
  // ═══════════════════════════════════════════════════════════════
  // ANXIOUS - Calming, grounding techniques
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'anx-1',
    text: 'Try the 4-7-8 breathing technique: breathe in for 4 seconds, hold for 7, exhale for 8. Repeat 3 times.',
    category: 'anxious',
    type: 'breathing',
    physicalActivity: 'none',
  },
  {
    id: 'anx-2',
    text: 'Ground yourself: Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste.',
    category: 'anxious',
    type: 'mindfulness',
    physicalActivity: 'none',
  },
  {
    id: 'anx-3',
    text: 'Write down what\'s worrying you. Sometimes getting thoughts on paper helps reduce their power.',
    category: 'anxious',
    type: 'practical',
    physicalActivity: 'none',
  },
  {
    id: 'anx-4',
    text: 'Take a slow 10-minute walk outside. Fresh air and gentle movement can help calm anxious feelings.',
    category: 'anxious',
    type: 'physical',
    physicalActivity: 'light',
  },
  {
    id: 'anx-5',
    text: 'Call or text someone you trust to share how you\'re feeling. You don\'t have to go through this alone.',
    category: 'anxious',
    type: 'social',
    requiresOthers: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // SAD - Comfort, connection, gentle activities
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'sad-1',
    text: 'It\'s okay to feel sad. Be gentle with yourself today. Consider doing one small thing that usually brings you comfort.',
    category: 'sad',
    type: 'comfort',
    physicalActivity: 'none',
  },
  {
    id: 'sad-2',
    text: 'Reach out to a friend or family member, even just to say hello. Connection can help lift our spirits.',
    category: 'sad',
    type: 'social',
    requiresOthers: true,
  },
  {
    id: 'sad-3',
    text: 'Put on some music that you love. Music has a powerful effect on our emotions.',
    category: 'sad',
    type: 'comfort',
    physicalActivity: 'none',
  },
  {
    id: 'sad-4',
    text: 'Step outside for a few minutes, even if just to sit on your porch. Sunlight can naturally boost your mood.',
    category: 'sad',
    type: 'physical',
    timeOfDay: 'morning',
    physicalActivity: 'none',
  },
  {
    id: 'sad-5',
    text: 'Write down three things, no matter how small, that you\'re grateful for today.',
    category: 'sad',
    type: 'gratitude',
    physicalActivity: 'none',
  },

  // ═══════════════════════════════════════════════════════════════
  // STRESSED - Stress relief, relaxation
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'str-1',
    text: 'Take 5 deep breaths right now. Breathe in through your nose, out through your mouth. Feel your shoulders drop.',
    category: 'stressed',
    type: 'breathing',
    physicalActivity: 'none',
  },
  {
    id: 'str-2',
    text: 'Make a list of what\'s stressing you, then circle the ONE thing you can actually control right now.',
    category: 'stressed',
    type: 'practical',
    physicalActivity: 'none',
  },
  {
    id: 'str-3',
    text: 'Do some gentle stretching for 5 minutes. Roll your neck, stretch your arms, touch your toes if you can.',
    category: 'stressed',
    type: 'physical',
    physicalActivity: 'light',
  },
  {
    id: 'str-4',
    text: 'Take a break from screens for 15 minutes. Your eyes and mind will thank you.',
    category: 'stressed',
    type: 'practical',
    physicalActivity: 'none',
  },
  {
    id: 'str-5',
    text: 'Splash cold water on your face or hold a cold cloth on your wrists. This activates your body\'s calming response.',
    category: 'stressed',
    type: 'practical',
    physicalActivity: 'none',
  },

  // ═══════════════════════════════════════════════════════════════
  // TIRED - Energy, rest, self-care
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'tir-1',
    text: 'Listen to your body. If you can, take a short 20-minute rest. Even closing your eyes helps.',
    category: 'tired',
    type: 'comfort',
    physicalActivity: 'none',
  },
  {
    id: 'tir-2',
    text: 'Drink a full glass of water. Dehydration is a common cause of fatigue.',
    category: 'tired',
    type: 'practical',
    physicalActivity: 'none',
  },
  {
    id: 'tir-3',
    text: 'Try a 5-minute energizing stretch or walk to get your blood flowing.',
    category: 'tired',
    type: 'physical',
    physicalActivity: 'light',
  },
  {
    id: 'tir-4',
    text: 'Open a window or step outside for fresh air. Oxygen can naturally boost your energy.',
    category: 'tired',
    type: 'practical',
    physicalActivity: 'none',
  },
  {
    id: 'tir-5',
    text: 'Consider going to bed 30 minutes earlier tonight. Quality sleep is the best energy booster.',
    category: 'tired',
    type: 'practical',
    timeOfDay: 'evening',
    physicalActivity: 'none',
  },

  // ═══════════════════════════════════════════════════════════════
  // LONELY - Social connection, community
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'lon-1',
    text: 'Call or video chat with a friend or family member. Hearing a familiar voice can make a big difference.',
    category: 'lonely',
    type: 'social',
    requiresOthers: true,
  },
  {
    id: 'lon-2',
    text: 'Check if there\'s a community event, class, or group you could join this week.',
    category: 'lonely',
    type: 'social',
    requiresOthers: true,
  },
  {
    id: 'lon-3',
    text: 'Write a letter or card to someone you haven\'t talked to in a while.',
    category: 'lonely',
    type: 'social',
    physicalActivity: 'none',
  },
  {
    id: 'lon-4',
    text: 'Visit a local coffee shop, library, or park. Sometimes just being around others helps.',
    category: 'lonely',
    type: 'social',
    physicalActivity: 'light',
  },

  // ═══════════════════════════════════════════════════════════════
  // POSITIVE - Maintain momentum, gratitude
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'pos-1',
    text: 'Wonderful! Consider calling a friend or family member to share your positive energy.',
    category: 'positive',
    type: 'social',
    requiresOthers: true,
  },
  {
    id: 'pos-2',
    text: 'This is a great day to try something new or tackle a task you\'ve been putting off.',
    category: 'positive',
    type: 'practical',
    physicalActivity: 'none',
  },
  {
    id: 'pos-3',
    text: 'Write down what\'s making today good. You can look back on this note on harder days.',
    category: 'positive',
    type: 'gratitude',
    physicalActivity: 'none',
  },
  {
    id: 'pos-4',
    text: 'Use this energy for some physical activity you enjoy - a walk, stretching, or gentle exercise.',
    category: 'positive',
    type: 'physical',
    physicalActivity: 'moderate',
  },
  {
    id: 'pos-5',
    text: 'Consider doing something kind for someone else today. It can multiply your good feelings.',
    category: 'positive',
    type: 'social',
    requiresOthers: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // NEUTRAL - General wellness, engagement
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'neu-1',
    text: 'Take a moment to check in with yourself. How is your body feeling? Any areas of tension?',
    category: 'neutral',
    type: 'mindfulness',
    physicalActivity: 'none',
  },
  {
    id: 'neu-2',
    text: 'Set a small, achievable goal for today. Accomplishing it can boost your mood.',
    category: 'neutral',
    type: 'practical',
    physicalActivity: 'none',
  },
  {
    id: 'neu-3',
    text: 'Drink a glass of water and eat a healthy snack. Taking care of basics helps us feel our best.',
    category: 'neutral',
    type: 'practical',
    physicalActivity: 'none',
  },
  {
    id: 'neu-4',
    text: 'Go for a short walk if you can. Movement is good for both body and mind.',
    category: 'neutral',
    type: 'physical',
    physicalActivity: 'light',
  },
  {
    id: 'neu-5',
    text: 'Call or text someone to say hello. Social connection is important for wellbeing.',
    category: 'neutral',
    type: 'social',
    requiresOthers: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // OVERWHELMED - Simplification, one-step-at-a-time
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'ovr-1',
    text: 'When everything feels like too much, focus on just one thing. What\'s the smallest next step?',
    category: 'overwhelmed',
    type: 'practical',
    physicalActivity: 'none',
  },
  {
    id: 'ovr-2',
    text: 'It\'s okay to ask for help. Is there someone who could assist with what you\'re facing?',
    category: 'overwhelmed',
    type: 'social',
    requiresOthers: true,
  },
  {
    id: 'ovr-3',
    text: 'Take a 2-minute pause. Close your eyes, breathe, and remind yourself: you\'re doing your best.',
    category: 'overwhelmed',
    type: 'breathing',
    physicalActivity: 'none',
  },
  {
    id: 'ovr-4',
    text: 'Write down everything on your mind, then pick just ONE item to focus on. The rest can wait.',
    category: 'overwhelmed',
    type: 'practical',
    physicalActivity: 'none',
  },
];

/**
 * Get suggestions for a specific mood
 */
export function getSuggestionsForMood(mood: string): MoodSuggestion[] {
  const category = MOOD_TO_CATEGORY[mood] || 'neutral';
  return moodSuggestions.filter(s => s.category === category);
}

/**
 * Get a random subset of suggestions for a mood
 */
export function getRandomSuggestions(mood: string, count: number = 3): MoodSuggestion[] {
  const suggestions = getSuggestionsForMood(mood);
  const shuffled = [...suggestions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default moodSuggestions;
