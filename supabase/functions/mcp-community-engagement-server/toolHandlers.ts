// =====================================================
// MCP Community Engagement Server — Tool Handlers
// Implements caching layer over existing community AI
// =====================================================

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface MCPLogger {
  info(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

// ---------------------------------------------------------------------------
// CACHE CONFIG
// ---------------------------------------------------------------------------

const SUGGESTION_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const QUESTION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;  // 24 hours
const ACTIVITY_CACHE_TTL_MS = 2 * 60 * 60 * 1000;    // 2 hours

// In-memory cache (persists across requests within same isolate)
const suggestionCache = new Map<string, { data: unknown; expiresAt: number }>();
const questionCache = new Map<string, { data: unknown; expiresAt: number }>();

// ---------------------------------------------------------------------------
// MOOD SUGGESTION POOL (fallback — no AI cost)
// ---------------------------------------------------------------------------

const SUGGESTION_POOL: Record<string, Array<{ text: string; type: string }>> = {
  anxious: [
    { text: "Try taking 5 slow, deep breaths — inhale for 4 counts, hold for 4, exhale for 6.", type: "breathing" },
    { text: "Put on some calming music or nature sounds and just listen for a few minutes.", type: "mindfulness" },
    { text: "Write down what is on your mind — sometimes getting it out of your head helps.", type: "practical" },
    { text: "Call a friend or family member. Hearing a familiar voice can be very grounding.", type: "social" },
    { text: "Step outside for a short walk. Fresh air and movement ease anxious feelings.", type: "physical" },
  ],
  sad: [
    { text: "Reach out to someone you trust — you do not have to feel this way alone.", type: "social" },
    { text: "Watch a funny movie or TV show. Laughter is real medicine.", type: "comfort" },
    { text: "Think of three things you are grateful for today, even small ones.", type: "gratitude" },
    { text: "Do something creative — draw, color, write, or listen to music.", type: "creative" },
    { text: "Get outside if you can, even for 10 minutes. Sunlight helps lift mood.", type: "physical" },
  ],
  stressed: [
    { text: "Take a 10-minute break and do nothing. Give your mind permission to rest.", type: "mindfulness" },
    { text: "Stretch your shoulders, neck, and back. Stress lives in your body.", type: "physical" },
    { text: "Make a simple to-do list with just 3 items. Small wins build momentum.", type: "practical" },
    { text: "Call a friend and talk about something fun — not the stressful thing.", type: "social" },
    { text: "Take a warm shower or bath. Warmth relaxes tense muscles.", type: "comfort" },
  ],
  tired: [
    { text: "Take a 20-minute power nap if you can. Set an alarm so you do not oversleep.", type: "practical" },
    { text: "Drink a glass of water. Dehydration makes tiredness worse.", type: "practical" },
    { text: "Go for a gentle 10-minute walk. Light movement actually gives energy.", type: "physical" },
    { text: "Have a healthy snack — fruit, nuts, or yogurt can boost your energy.", type: "practical" },
    { text: "Open the curtains and let natural light in. It signals your body to wake up.", type: "comfort" },
  ],
  positive: [
    { text: "Share your good mood with someone — send a kind text or call a friend.", type: "social" },
    { text: "Use this energy to take a walk or do some gentle exercise.", type: "physical" },
    { text: "Write down what made today good. You can read it on harder days.", type: "gratitude" },
    { text: "Try something new today — a new recipe, a new route for your walk, a new song.", type: "creative" },
    { text: "Plan something fun for this week. Having something to look forward to keeps the good feeling going.", type: "practical" },
  ],
  neutral: [
    { text: "Take a few minutes for deep breathing. It is good for you any day.", type: "breathing" },
    { text: "Reach out to a friend you have not talked to in a while.", type: "social" },
    { text: "Go for a short walk and notice the things around you — colors, sounds, smells.", type: "mindfulness" },
    { text: "Try a puzzle, crossword, or brain game to keep your mind sharp.", type: "practical" },
    { text: "Drink some water and have a healthy snack. Small care adds up.", type: "practical" },
  ],
};

function getMoodCategory(mood: string): string {
  const lower = mood.toLowerCase();
  if (["great", "good"].includes(lower)) return "positive";
  if (["sad", "not great"].includes(lower)) return "sad";
  if (["anxious"].includes(lower)) return "anxious";
  if (["stressed"].includes(lower)) return "stressed";
  if (["tired"].includes(lower)) return "tired";
  return "neutral";
}

function pickFromPool(category: string, count: number): Array<{ text: string; type: string }> {
  const pool = SUGGESTION_POOL[category] || SUGGESTION_POOL.neutral;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ---------------------------------------------------------------------------
// ACTIVITY RECOMMENDATIONS
// ---------------------------------------------------------------------------

const ACTIVITIES: Record<string, Array<{ activity: string; category: string; duration: string }>> = {
  morning: [
    { activity: "Take a morning walk around your neighborhood", category: "physical", duration: "15-20 min" },
    { activity: "Do the Daily Check-In and track your vitals", category: "health", duration: "5 min" },
    { activity: "Play a round of Memory Lane Trivia", category: "cognitive", duration: "10 min" },
    { activity: "Call a friend or family member to say good morning", category: "social", duration: "10 min" },
  ],
  afternoon: [
    { activity: "Share a meal photo with the community", category: "social", duration: "5 min" },
    { activity: "Try the Word Find puzzle", category: "cognitive", duration: "10 min" },
    { activity: "Take a gentle walk after lunch", category: "physical", duration: "15 min" },
    { activity: "Read a chapter of a good book", category: "relaxation", duration: "20 min" },
  ],
  evening: [
    { activity: "Write in your notes about how today went", category: "reflection", duration: "5 min" },
    { activity: "Call someone and ask about their day", category: "social", duration: "10 min" },
    { activity: "Do some gentle stretching before bed", category: "physical", duration: "10 min" },
    { activity: "Plan something to look forward to tomorrow", category: "planning", duration: "5 min" },
  ],
  night: [
    { activity: "Practice deep breathing — 4 counts in, 4 hold, 6 out", category: "relaxation", duration: "5 min" },
    { activity: "Listen to calming music or nature sounds", category: "relaxation", duration: "15 min" },
    { activity: "Think of 3 good things from today", category: "gratitude", duration: "5 min" },
  ],
};

function getTimeOfDay(): string {
  const hour = new Date().getUTCHours();
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

// ---------------------------------------------------------------------------
// DEFAULT CHECK-IN QUESTIONS
// ---------------------------------------------------------------------------

const DEFAULT_QUESTIONS = [
  { question: "How are you feeling overall today?", type: "scale", scale: { min: 1, max: 10, label_min: "Very Poor", label_max: "Excellent" }, required: true, category: "wellness" },
  { question: "Did you take all your medications today?", type: "yes_no", required: true, category: "medication" },
  { question: "Are you experiencing any pain right now?", type: "scale", scale: { min: 0, max: 10, label_min: "No Pain", label_max: "Worst Pain" }, required: true, category: "pain" },
  { question: "Have you felt safe at home today?", type: "yes_no", required: true, category: "safety" },
  { question: "Is there anything else you would like to share with your care team?", type: "text", required: false, category: "open" },
];

// ---------------------------------------------------------------------------
// TOOL HANDLER FACTORY
// ---------------------------------------------------------------------------

export function createToolHandlers(logger: MCPLogger, sb: SupabaseClient | null) {

  // ---- get_wellness_suggestions ----
  async function getWellnessSuggestions(params: {
    mood: string;
    mood_score?: number;
    time_of_day?: string;
    symptoms?: string[];
    user_id?: string;
    skip_cache?: boolean;
  }) {
    const category = getMoodCategory(params.mood);
    const timeOfDay = params.time_of_day || getTimeOfDay();
    const cacheKey = `${category}:${timeOfDay}`;

    // Check in-memory cache first (zero cost)
    if (!params.skip_cache) {
      const cached = suggestionCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        logger.info("SUGGESTIONS_CACHE_HIT", { mood: params.mood, category, cacheKey });
        return { ...cached.data as Record<string, unknown>, source: "cache", cache_key: cacheKey };
      }
    }

    // Try AI generation via existing edge function
    let suggestions: Array<{ text: string; type: string }>;
    let source: "ai" | "pool" = "pool";

    try {
      if (sb) {
        const { data, error } = await sb.functions.invoke("smart-mood-suggestions", {
          body: {
            mood: params.mood,
            moodScore: params.mood_score,
            timeOfDay,
            symptoms: params.symptoms,
            userId: params.user_id,
          },
        });

        if (!error && data?.suggestions) {
          suggestions = data.suggestions.map((s: { text: string; type?: string }) => ({
            text: s.text,
            type: s.type || "practical",
          }));
          source = "ai";
        } else {
          logger.info("SUGGESTIONS_AI_FALLBACK", { error: error?.message });
          suggestions = pickFromPool(category, 3);
        }
      } else {
        suggestions = pickFromPool(category, 3);
      }
    } catch (err: unknown) {
      logger.error("SUGGESTIONS_AI_ERROR", {
        error: err instanceof Error ? err.message : String(err),
      });
      suggestions = pickFromPool(category, 3);
    }

    const result = {
      mood: params.mood,
      category,
      time_of_day: timeOfDay,
      suggestions,
      source,
      generated_at: new Date().toISOString(),
    };

    // Cache the result
    suggestionCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + SUGGESTION_CACHE_TTL_MS,
    });

    logger.info("SUGGESTIONS_GENERATED", { mood: params.mood, source, count: suggestions.length });
    return result;
  }

  // ---- get_personalized_greeting ----
  async function getPersonalizedGreeting(params: {
    user_id: string;
    timezone?: string;
  }) {
    // Determine time of day
    let hour = new Date().getUTCHours();
    if (params.timezone) {
      try {
        const now = new Date();
        const localTime = new Date(now.toLocaleString("en-US", { timeZone: params.timezone }));
        hour = localTime.getHours();
      } catch {
        // Use UTC if timezone is invalid
      }
    }

    let timeOfDay: string;
    if (hour >= 6 && hour < 12) timeOfDay = "morning";
    else if (hour >= 12 && hour < 17) timeOfDay = "afternoon";
    else if (hour >= 17 && hour < 21) timeOfDay = "evening";
    else timeOfDay = "evening";

    const greetingPrefix = `Good ${timeOfDay}`;

    // Fetch user name
    let displayName = "there";
    if (sb) {
      try {
        const { data: profile } = await sb
          .from("profiles")
          .select("first_name")
          .eq("user_id", params.user_id)
          .single();
        if (profile?.first_name) {
          displayName = profile.first_name;
        }
      } catch {
        // Keep "there" as fallback
      }
    }

    // Fetch a motivational quote (no AI cost)
    let quote: { text: string; author: string } | null = null;
    if (sb) {
      try {
        const { data: quotes } = await sb
          .from("affirmations")
          .select("text, author")
          .limit(10);
        if (quotes && quotes.length > 0) {
          const randomIdx = Math.floor(Math.random() * quotes.length);
          quote = { text: quotes[randomIdx].text, author: quotes[randomIdx].author || "Unknown" };
        }
      } catch {
        // No quote is fine
      }
    }

    return {
      greeting: `${greetingPrefix}, ${displayName}!`,
      display_name: displayName,
      time_of_day: timeOfDay,
      quote,
      generated_at: new Date().toISOString(),
    };
  }

  // ---- generate_check_in_questions ----
  async function generateCheckInQuestions(params: {
    patient_id: string;
    question_count?: number;
    focus_areas?: string[];
  }) {
    const count = Math.min(params.question_count || 5, 10);
    const cacheKey = `questions:${params.patient_id}:${count}:${(params.focus_areas || []).sort().join(",")}`;

    // Check cache
    const cached = questionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      logger.info("QUESTIONS_CACHE_HIT", { patient_id: params.patient_id });
      return { ...cached.data as Record<string, unknown>, source: "cache" };
    }

    // Try AI generation via existing edge function
    let questions = DEFAULT_QUESTIONS.slice(0, count);
    let source: "ai" | "default" = "default";

    try {
      if (sb) {
        const { data, error } = await sb.functions.invoke("ai-check-in-questions", {
          body: {
            patientId: params.patient_id,
            questionCount: count,
            focusAreas: params.focus_areas,
          },
        });

        if (!error && data?.questions) {
          questions = data.questions;
          source = "ai";
        } else {
          logger.info("QUESTIONS_AI_FALLBACK", { error: error?.message });
        }
      }
    } catch (err: unknown) {
      logger.error("QUESTIONS_AI_ERROR", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const result = {
      patient_id: params.patient_id,
      questions,
      count: questions.length,
      source,
      generated_at: new Date().toISOString(),
    };

    // Cache for 24h
    questionCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + QUESTION_CACHE_TTL_MS,
    });

    logger.info("QUESTIONS_GENERATED", { patient_id: params.patient_id, source, count: questions.length });
    return result;
  }

  // ---- get_engagement_score ----
  async function getEngagementScore(params: {
    patient_id: string;
    days?: number;
  }) {
    const days = Math.min(params.days || 7, 90);

    if (!sb) {
      return { error: "Database not available", patient_id: params.patient_id };
    }

    // Use the DB function we just created
    const { data, error } = await sb.rpc("calculate_engagement_warning_score", {
      p_patient_id: params.patient_id,
      p_days: days,
    });

    if (error) {
      logger.error("ENGAGEMENT_SCORE_ERROR", { error: error.message });
      return {
        patient_id: params.patient_id,
        warning_score: 0,
        warning_level: "UNKNOWN",
        concerning_factors: [],
        recommended_action: "Unable to calculate — check database connection",
        error: error.message,
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      patient_id: params.patient_id,
      days_analyzed: days,
      warning_score: row?.warning_score ?? 0,
      warning_level: row?.warning_level ?? "LOW",
      concerning_factors: row?.concerning_factors ?? [],
      recommended_action: row?.recommended_action ?? "Continue normal monitoring",
      generated_at: new Date().toISOString(),
    };
  }

  // ---- recommend_next_activity ----
  async function recommendNextActivity(params: {
    patient_id: string;
    mood?: string;
    time_of_day?: string;
  }) {
    const timeOfDay = params.time_of_day || getTimeOfDay();
    const pool = ACTIVITIES[timeOfDay] || ACTIVITIES.afternoon;

    // Get engagement data to personalize
    let recentActivities: string[] = [];
    if (sb) {
      try {
        const { data: metrics } = await sb
          .from("patient_engagement_metrics")
          .select("trivia_played, word_find_played, meal_photo_shared, check_in_completed, community_interactions")
          .eq("patient_id", params.patient_id)
          .gte("date", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
          .order("date", { ascending: false })
          .limit(3);

        if (metrics) {
          for (const m of metrics) {
            if (m.trivia_played) recentActivities.push("trivia");
            if (m.word_find_played) recentActivities.push("word_find");
            if (m.meal_photo_shared) recentActivities.push("meal_photo");
          }
        }
      } catch {
        // Proceed without history
      }
    }

    // Prioritize activities they haven't done recently
    const scored = pool.map((a) => {
      let score = Math.random() * 10; // Base randomness
      // Boost social activities for sad/anxious moods
      if (params.mood && ["Sad", "Not Great", "Anxious"].includes(params.mood)) {
        if (a.category === "social") score += 5;
        if (a.category === "relaxation") score += 3;
      }
      // Boost cognitive if they haven't played games
      if (!recentActivities.includes("trivia") && a.category === "cognitive") score += 4;
      // Boost physical for tired mood
      if (params.mood === "Tired" && a.category === "physical") score += 3;
      return { ...a, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const recommendation = scored[0];
    const alternatives = scored.slice(1, 3);

    return {
      patient_id: params.patient_id,
      time_of_day: timeOfDay,
      recommendation: {
        activity: recommendation.activity,
        category: recommendation.category,
        duration: recommendation.duration,
      },
      alternatives: alternatives.map((a) => ({
        activity: a.activity,
        category: a.category,
        duration: a.duration,
      })),
      mood_context: params.mood || null,
      recent_activities: recentActivities,
      generated_at: new Date().toISOString(),
    };
  }

  // ---- DISPATCHER ----
  return {
    async handleToolCall(name: string, args: Record<string, unknown>) {
      switch (name) {
        case "get_wellness_suggestions":
          return await getWellnessSuggestions(args as Parameters<typeof getWellnessSuggestions>[0]);
        case "get_personalized_greeting":
          return await getPersonalizedGreeting(args as Parameters<typeof getPersonalizedGreeting>[0]);
        case "generate_check_in_questions":
          return await generateCheckInQuestions(args as Parameters<typeof generateCheckInQuestions>[0]);
        case "get_engagement_score":
          return await getEngagementScore(args as Parameters<typeof getEngagementScore>[0]);
        case "recommend_next_activity":
          return await recommendNextActivity(args as Parameters<typeof recommendNextActivity>[0]);
        default:
          return { error: `Unknown tool: ${name}` };
      }
    },
  };
}
