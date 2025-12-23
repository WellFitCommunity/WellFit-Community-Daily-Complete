/**
 * Smart Mood Suggestions Edge Function
 *
 * Skill #12: AI-Powered Mood Suggestions
 *
 * Uses Claude Haiku to GENERATE personalized wellness suggestions
 * based on user's mood, symptoms, context, and recent history.
 *
 * Two modes:
 * 1. GENERATE (default): AI creates personalized suggestions
 * 2. SELECT (fallback): AI picks from predefined pool if generation fails
 *
 * Cost: ~$0.0003-0.0005 per call (Haiku is very cheap)
 *
 * @module smart-mood-suggestions
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { SUPABASE_URL, SB_SECRET_KEY } from '../_shared/env.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const HAIKU_MODEL = 'claude-3-5-haiku-20241022';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface MoodSuggestionRequest {
  userId?: string;
  mood: string;
  moodScore?: number; // 1-5 scale
  symptoms?: string[];
  notes?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  /** Use selection mode instead of generation */
  useSelectionMode?: boolean;
  /** Include recent check-in context */
  includeHistory?: boolean;
}

interface GeneratedSuggestion {
  id: string;
  text: string;
  type: 'breathing' | 'physical' | 'social' | 'practical' | 'mindfulness' | 'comfort' | 'gratitude';
  reasoning?: string;
  personalized: boolean;
}

interface MoodSuggestionResponse {
  mood: string;
  category: string;
  suggestions: GeneratedSuggestion[];
  source: 'generated' | 'selected' | 'fallback';
  personalizationContext?: string;
}

interface RecentCheckIn {
  mood: string;
  moodScore: number;
  checkedInAt: string;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════
// MOOD CATEGORIES & FALLBACK POOL
// ═══════════════════════════════════════════════════════════════

const MOOD_TO_CATEGORY: Record<string, string> = {
  'Great': 'positive',
  'Good': 'positive',
  'Okay': 'neutral',
  'Not Great': 'sad',
  'Sad': 'sad',
  'Anxious': 'anxious',
  'Tired': 'tired',
  'Stressed': 'stressed',
  'Overwhelmed': 'stressed',
  'Lonely': 'sad',
  'Frustrated': 'stressed',
  'Happy': 'positive',
  'Calm': 'positive',
  'Worried': 'anxious',
};

interface FallbackSuggestion {
  id: string;
  text: string;
  category: string;
  type: GeneratedSuggestion['type'];
}

const FALLBACK_SUGGESTIONS: FallbackSuggestion[] = [
  // ANXIOUS
  { id: 'anx-1', text: 'Try the 4-7-8 breathing technique: breathe in for 4 seconds, hold for 7, exhale for 8. Repeat 3 times.', category: 'anxious', type: 'breathing' },
  { id: 'anx-2', text: 'Ground yourself: Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste.', category: 'anxious', type: 'mindfulness' },
  { id: 'anx-3', text: 'Write down what\'s worrying you. Sometimes getting thoughts on paper helps reduce their power.', category: 'anxious', type: 'practical' },
  { id: 'anx-4', text: 'Take a slow 10-minute walk outside. Fresh air and gentle movement can help calm anxious feelings.', category: 'anxious', type: 'physical' },
  { id: 'anx-5', text: 'Call or text someone you trust to share how you\'re feeling. You don\'t have to go through this alone.', category: 'anxious', type: 'social' },

  // SAD
  { id: 'sad-1', text: 'It\'s okay to feel sad. Be gentle with yourself today. Consider doing one small thing that usually brings you comfort.', category: 'sad', type: 'comfort' },
  { id: 'sad-2', text: 'Reach out to a friend or family member, even just to say hello. Connection can help lift our spirits.', category: 'sad', type: 'social' },
  { id: 'sad-3', text: 'Put on some music that you love. Music has a powerful effect on our emotions.', category: 'sad', type: 'comfort' },
  { id: 'sad-4', text: 'Step outside for a few minutes, even if just to sit on your porch. Sunlight can naturally boost your mood.', category: 'sad', type: 'physical' },
  { id: 'sad-5', text: 'Write down three things, no matter how small, that you\'re grateful for today.', category: 'sad', type: 'gratitude' },

  // STRESSED
  { id: 'str-1', text: 'Take 5 deep breaths right now. Breathe in through your nose, out through your mouth. Feel your shoulders drop.', category: 'stressed', type: 'breathing' },
  { id: 'str-2', text: 'Make a list of what\'s stressing you, then circle the ONE thing you can actually control right now.', category: 'stressed', type: 'practical' },
  { id: 'str-3', text: 'Do some gentle stretching for 5 minutes. Roll your neck, stretch your arms, touch your toes if you can.', category: 'stressed', type: 'physical' },
  { id: 'str-4', text: 'Take a break from screens for 15 minutes. Your eyes and mind will thank you.', category: 'stressed', type: 'practical' },
  { id: 'str-5', text: 'Splash cold water on your face or hold a cold cloth on your wrists. This activates your body\'s calming response.', category: 'stressed', type: 'practical' },

  // TIRED
  { id: 'tir-1', text: 'Listen to your body. If you can, take a short 20-minute rest. Even closing your eyes helps.', category: 'tired', type: 'comfort' },
  { id: 'tir-2', text: 'Drink a full glass of water. Dehydration is a common cause of fatigue.', category: 'tired', type: 'practical' },
  { id: 'tir-3', text: 'Try a 5-minute energizing stretch or walk to get your blood flowing.', category: 'tired', type: 'physical' },
  { id: 'tir-4', text: 'Open a window or step outside for fresh air. Oxygen can naturally boost your energy.', category: 'tired', type: 'practical' },
  { id: 'tir-5', text: 'Consider going to bed 30 minutes earlier tonight. Quality sleep is the best energy booster.', category: 'tired', type: 'practical' },

  // POSITIVE
  { id: 'pos-1', text: 'Wonderful! Consider calling a friend or family member to share your positive energy.', category: 'positive', type: 'social' },
  { id: 'pos-2', text: 'This is a great day to try something new or tackle a task you\'ve been putting off.', category: 'positive', type: 'practical' },
  { id: 'pos-3', text: 'Write down what\'s making today good. You can look back on this note on harder days.', category: 'positive', type: 'gratitude' },
  { id: 'pos-4', text: 'Use this energy for some physical activity you enjoy - a walk, stretching, or gentle exercise.', category: 'positive', type: 'physical' },
  { id: 'pos-5', text: 'Consider doing something kind for someone else today. It can multiply your good feelings.', category: 'positive', type: 'social' },

  // NEUTRAL
  { id: 'neu-1', text: 'Take a moment to check in with yourself. How is your body feeling? Any areas of tension?', category: 'neutral', type: 'mindfulness' },
  { id: 'neu-2', text: 'Set a small, achievable goal for today. Accomplishing it can boost your mood.', category: 'neutral', type: 'practical' },
  { id: 'neu-3', text: 'Drink a glass of water and eat a healthy snack. Taking care of basics helps us feel our best.', category: 'neutral', type: 'practical' },
  { id: 'neu-4', text: 'Go for a short walk if you can. Movement is good for both body and mind.', category: 'neutral', type: 'physical' },
  { id: 'neu-5', text: 'Call or text someone to say hello. Social connection is important for wellbeing.', category: 'neutral', type: 'social' },
];

// ═══════════════════════════════════════════════════════════════
// HAIKU API
// ═══════════════════════════════════════════════════════════════

async function callHaiku(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Haiku API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ═══════════════════════════════════════════════════════════════
// CONTEXT GATHERING
// ═══════════════════════════════════════════════════════════════

async function getRecentCheckIns(userId: string): Promise<RecentCheckIn[]> {
  try {
    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    const { data, error } = await supabase
      .from('daily_check_ins')
      .select('mood, mood_score, checked_in_at, notes')
      .eq('user_id', userId)
      .order('checked_in_at', { ascending: false })
      .limit(7);

    if (error || !data) return [];

    return data.map((row: Record<string, unknown>) => ({
      mood: row.mood as string,
      moodScore: row.mood_score as number,
      checkedInAt: row.checked_in_at as string,
      notes: row.notes as string | undefined,
    }));
  } catch {
    return [];
  }
}

function getTimeContext(timeOfDay?: string): string {
  if (timeOfDay) return timeOfDay;

  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

// ═══════════════════════════════════════════════════════════════
// AI-POWERED GENERATION
// ═══════════════════════════════════════════════════════════════

async function generatePersonalizedSuggestions(
  mood: string,
  category: string,
  symptoms: string[],
  notes: string | undefined,
  timeOfDay: string,
  recentHistory: RecentCheckIn[]
): Promise<GeneratedSuggestion[]> {
  const systemPrompt = `You are a compassionate wellness assistant helping seniors maintain their mental and physical wellbeing. Generate personalized, actionable wellness suggestions.

GUIDELINES:
- Be warm, supportive, and encouraging
- Use simple, clear language appropriate for seniors
- Suggestions should be achievable and practical
- Consider physical limitations common in seniors
- Never give medical advice - only general wellness tips
- Each suggestion should be 1-2 sentences max
- Vary the types: breathing, physical, social, practical, mindfulness, comfort, gratitude

OUTPUT FORMAT: Return exactly 3 suggestions as a JSON array:
[
  {"text": "suggestion text", "type": "breathing|physical|social|practical|mindfulness|comfort|gratitude", "reasoning": "why this helps"}
]`;

  // Build context
  const contextParts = [
    `Current mood: ${mood} (category: ${category})`,
    `Time of day: ${timeOfDay}`,
  ];

  if (symptoms.length > 0) {
    contextParts.push(`Symptoms mentioned: ${symptoms.join(', ')}`);
  }

  if (notes) {
    contextParts.push(`User notes: "${notes}"`);
  }

  if (recentHistory.length > 0) {
    const historyText = recentHistory
      .slice(0, 5)
      .map((h) => `- ${new Date(h.checkedInAt).toLocaleDateString()}: ${h.mood} (${h.moodScore}/5)`)
      .join('\n');
    contextParts.push(`Recent mood history:\n${historyText}`);

    // Detect patterns
    const avgScore = recentHistory.reduce((sum, h) => sum + h.moodScore, 0) / recentHistory.length;
    if (avgScore < 2.5) {
      contextParts.push('Pattern: User has been feeling low recently - be especially supportive');
    } else if (avgScore > 3.5) {
      contextParts.push('Pattern: User has been feeling good recently - help maintain momentum');
    }
  }

  const userPrompt = `Generate 3 personalized wellness suggestions for this user:

${contextParts.join('\n')}

Remember:
- Make suggestions specific to their current mood and time of day
- If they mentioned symptoms, address those
- If they've been feeling low, be extra gentle and encouraging
- Vary the types of suggestions (don't give 3 breathing exercises)

Return ONLY the JSON array, no other text.`;

  const response = await callHaiku(systemPrompt, userPrompt);

  // Parse JSON response
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Invalid AI response format');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return parsed.map((s: { text: string; type: string; reasoning?: string }, i: number) => ({
    id: `gen-${Date.now()}-${i}`,
    text: s.text,
    type: s.type as GeneratedSuggestion['type'],
    reasoning: s.reasoning,
    personalized: true,
  }));
}

// ═══════════════════════════════════════════════════════════════
// SELECTION MODE (FALLBACK)
// ═══════════════════════════════════════════════════════════════

async function selectFromPool(
  category: string,
  symptoms: string[],
  notes: string | undefined,
  timeOfDay: string
): Promise<GeneratedSuggestion[]> {
  const categorySuggestions = FALLBACK_SUGGESTIONS.filter((s) => s.category === category);

  if (categorySuggestions.length === 0) {
    // Use neutral if no matching category
    return FALLBACK_SUGGESTIONS
      .filter((s) => s.category === 'neutral')
      .slice(0, 3)
      .map((s) => ({ ...s, personalized: false, reasoning: undefined }));
  }

  // Build context for selection
  const contextParts = [
    `Category: ${category}`,
    `Time: ${timeOfDay}`,
  ];
  if (symptoms.length > 0) contextParts.push(`Symptoms: ${symptoms.join(', ')}`);
  if (notes) contextParts.push(`Notes: ${notes}`);

  const suggestionList = categorySuggestions
    .map((s, i) => `${i + 1}. [${s.id}] (${s.type}) ${s.text}`)
    .join('\n');

  try {
    const prompt = `Select the 3 MOST appropriate suggestions for this user from the list below.

USER CONTEXT:
${contextParts.join('\n')}

AVAILABLE SUGGESTIONS:
${suggestionList}

Reply with ONLY the IDs separated by commas (e.g., "anx-1, anx-3, anx-5").
Choose varied types (breathing, physical, social, etc.) when possible.`;

    const response = await callHaiku('You are a wellness assistant. Select the best suggestions.', prompt);

    const idMatches = response.match(/[a-z]{3}-\d/g);
    if (idMatches && idMatches.length >= 3) {
      const selectedIds = idMatches.slice(0, 3);
      return selectedIds
        .map((id) => FALLBACK_SUGGESTIONS.find((s) => s.id === id))
        .filter(Boolean)
        .map((s) => ({ ...s!, personalized: false, reasoning: undefined }));
    }
  } catch {
    // Fall through to random selection
  }

  // Random fallback
  const shuffled = [...categorySuggestions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map((s) => ({ ...s, personalized: false, reasoning: undefined }));
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: MoodSuggestionRequest = await req.json();
    const {
      userId,
      mood,
      moodScore,
      symptoms = [],
      notes,
      timeOfDay,
      useSelectionMode = false,
      includeHistory = true,
    } = body;

    if (!mood) {
      return new Response(
        JSON.stringify({ error: 'Mood is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get category and time context
    const category = MOOD_TO_CATEGORY[mood] || 'neutral';
    const timeContext = getTimeContext(timeOfDay);

    // Get recent history if available
    let recentHistory: RecentCheckIn[] = [];
    if (userId && includeHistory) {
      recentHistory = await getRecentCheckIns(userId);
    }

    let suggestions: GeneratedSuggestion[];
    let source: 'generated' | 'selected' | 'fallback';

    if (useSelectionMode) {
      // Use selection mode explicitly
      suggestions = await selectFromPool(category, symptoms, notes, timeContext);
      source = 'selected';
    } else {
      // Try generation first
      try {
        suggestions = await generatePersonalizedSuggestions(
          mood,
          category,
          symptoms,
          notes,
          timeContext,
          recentHistory
        );
        source = 'generated';
      } catch (genError) {
        // Fall back to selection
        console.error('Generation failed, falling back to selection:', genError);
        suggestions = await selectFromPool(category, symptoms, notes, timeContext);
        source = 'selected';
      }
    }

    // Build response
    const response: MoodSuggestionResponse = {
      mood,
      category,
      suggestions,
      source,
    };

    // Add personalization context summary if we used history
    if (recentHistory.length > 0 && source === 'generated') {
      const avgScore = recentHistory.reduce((sum, h) => sum + h.moodScore, 0) / recentHistory.length;
      response.personalizationContext = `Based on ${recentHistory.length} recent check-ins (avg mood: ${avgScore.toFixed(1)}/5)`;
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Smart suggestions error:', error);

    // Ultimate fallback
    return new Response(
      JSON.stringify({
        mood: 'unknown',
        category: 'neutral',
        suggestions: [
          { id: 'fb-1', text: 'Take a few deep breaths and be gentle with yourself today.', type: 'breathing', personalized: false },
          { id: 'fb-2', text: 'Consider reaching out to someone you trust.', type: 'social', personalized: false },
          { id: 'fb-3', text: 'Stay hydrated and take care of your basic needs.', type: 'practical', personalized: false },
        ],
        source: 'fallback',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
