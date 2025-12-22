/**
 * Smart Mood Suggestions Edge Function
 *
 * Uses Claude Haiku to select the most appropriate wellness suggestions
 * based on user's mood, symptoms, and context.
 *
 * Cost: ~$0.00025 per call (Haiku is very cheap)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

// ═══════════════════════════════════════════════════════════════
// SUGGESTION POOL (embedded for Edge Function)
// ═══════════════════════════════════════════════════════════════

interface MoodSuggestion {
  id: string;
  text: string;
  category: string;
  type: string;
}

const MOOD_TO_CATEGORY: Record<string, string> = {
  'Great': 'positive',
  'Good': 'positive',
  'Okay': 'neutral',
  'Not Great': 'sad',
  'Sad': 'sad',
  'Anxious': 'anxious',
  'Tired': 'tired',
  'Stressed': 'stressed',
};

const suggestions: MoodSuggestion[] = [
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

  // OVERWHELMED (maps to stressed)
  { id: 'ovr-1', text: 'When everything feels like too much, focus on just one thing. What\'s the smallest next step?', category: 'stressed', type: 'practical' },
  { id: 'ovr-2', text: 'It\'s okay to ask for help. Is there someone who could assist with what you\'re facing?', category: 'stressed', type: 'social' },
  { id: 'ovr-3', text: 'Take a 2-minute pause. Close your eyes, breathe, and remind yourself: you\'re doing your best.', category: 'stressed', type: 'breathing' },
];

// ═══════════════════════════════════════════════════════════════
// HAIKU API
// ═══════════════════════════════════════════════════════════════

interface HaikuRequest {
  mood: string;
  symptoms?: string;
  notes?: string;
  timeOfDay?: string;
}

async function callHaiku(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
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
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: HaikuRequest = await req.json();
    const { mood, symptoms, notes, timeOfDay } = body;

    if (!mood) {
      return new Response(
        JSON.stringify({ error: 'Mood is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get category for this mood
    const category = MOOD_TO_CATEGORY[mood] || 'neutral';

    // Get all suggestions for this category
    const categorySuggestions = suggestions.filter(s => s.category === category);

    // Build context for Haiku
    const userContext = [
      `Mood: ${mood}`,
      symptoms ? `Symptoms: ${symptoms}` : null,
      notes ? `Notes: ${notes}` : null,
      timeOfDay ? `Time of day: ${timeOfDay}` : null,
    ].filter(Boolean).join('\n');

    // Format suggestions for Haiku to choose from
    const suggestionList = categorySuggestions
      .map((s, i) => `${i + 1}. [${s.id}] ${s.text}`)
      .join('\n');

    const prompt = `You are a wellness assistant for seniors. Based on the user's context, select the 3 MOST appropriate and helpful suggestions from the list below.

USER CONTEXT:
${userContext}

AVAILABLE SUGGESTIONS:
${suggestionList}

Reply with ONLY the IDs of your top 3 picks, separated by commas (e.g., "anx-1, anx-3, anx-5"). Choose suggestions that:
1. Are most relevant to any specific symptoms or notes mentioned
2. Offer variety (different types: breathing, physical, social, practical)
3. Are appropriate for the time of day if specified

Your picks:`;

    let selectedIds: string[] = [];

    try {
      const haikuResponse = await callHaiku(prompt);

      // Parse the response to get IDs
      const idMatches = haikuResponse.match(/[a-z]{3}-\d/g);
      if (idMatches) {
        selectedIds = idMatches.slice(0, 3);
      }
    } catch (haikuError) {
      // If Haiku fails, fall back to random selection
      console.error('Haiku selection failed, using random:', haikuError);
    }

    // If we didn't get enough from Haiku, fill with random
    if (selectedIds.length < 3) {
      const shuffled = [...categorySuggestions].sort(() => Math.random() - 0.5);
      const randomIds = shuffled.slice(0, 3).map(s => s.id);

      // Merge, avoiding duplicates
      for (const id of randomIds) {
        if (selectedIds.length < 3 && !selectedIds.includes(id)) {
          selectedIds.push(id);
        }
      }
    }

    // Get the full suggestion objects
    const selectedSuggestions = selectedIds
      .map(id => suggestions.find(s => s.id === id))
      .filter(Boolean) as MoodSuggestion[];

    return new Response(
      JSON.stringify({
        mood,
        category,
        suggestions: selectedSuggestions.map(s => ({
          id: s.id,
          text: s.text,
          type: s.type,
        })),
        source: selectedIds.length === 3 ? 'haiku' : 'fallback',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Smart suggestions error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to generate suggestions',
        fallback: [
          { text: 'Take a few deep breaths and be gentle with yourself today.', type: 'breathing' },
          { text: 'Consider reaching out to someone you trust.', type: 'social' },
          { text: 'Stay hydrated and take care of your basic needs.', type: 'practical' },
        ],
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
