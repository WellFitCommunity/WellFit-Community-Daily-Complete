// =====================================================
// MCP Community Engagement Server — Tool Definitions
// Tools for wellness suggestions, greetings, check-in
// questions, engagement scoring, and activity recommendations
// =====================================================

import { PING_TOOL } from "../_shared/mcpServerBase.ts";

export const TOOLS: Record<string, {
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}> = {
  get_wellness_suggestions: {
    description:
      "Get personalized wellness suggestions based on mood. Caches responses by mood+timeOfDay to reduce AI costs. Returns 3 actionable suggestions (e.g., 'Take a walk', 'Call a friend').",
    inputSchema: {
      type: "object",
      properties: {
        mood: {
          type: "string",
          description: "Current mood: Great, Good, Okay, Not Great, Sad, Anxious, Tired, Stressed",
        },
        mood_score: {
          type: "number",
          description: "Mood score 1-5 (optional, enriches AI context)",
        },
        time_of_day: {
          type: "string",
          description: "morning, afternoon, evening, night (defaults to current time)",
        },
        symptoms: {
          type: "array",
          description: "Optional array of symptom strings for context",
        },
        user_id: {
          type: "string",
          description: "User UUID for fetching check-in history (optional)",
        },
        skip_cache: {
          type: "boolean",
          description: "Force fresh AI generation, bypass cache (default false)",
        },
      },
      required: ["mood"],
    },
  },

  get_personalized_greeting: {
    description:
      "Get a time-appropriate greeting with motivational quote. No AI call — uses database quotes with rotation to avoid repeats.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "string",
          description: "User UUID to fetch display name and quote history",
        },
        timezone: {
          type: "string",
          description: "IANA timezone (e.g., America/New_York). Defaults to UTC.",
        },
      },
      required: ["user_id"],
    },
  },

  generate_check_in_questions: {
    description:
      "Generate personalized check-in questions based on patient clinical context (diagnoses, care plan, SDOH). Caches by patient context hash.",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: {
          type: "string",
          description: "Patient UUID",
        },
        question_count: {
          type: "number",
          description: "Number of questions (default 5, max 10)",
        },
        focus_areas: {
          type: "array",
          description: "Optional focus areas: wellness, medication, safety, social, nutrition",
        },
      },
      required: ["patient_id"],
    },
  },

  get_engagement_score: {
    description:
      "Get a patient's engagement score and warning level from the patient_engagement_metrics table. No AI call — pure database query.",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: {
          type: "string",
          description: "Patient UUID",
        },
        days: {
          type: "number",
          description: "Lookback period in days (default 7, max 90)",
        },
      },
      required: ["patient_id"],
    },
  },

  recommend_next_activity: {
    description:
      "Recommend the next activity for a patient based on engagement history and time of day. Uses cached suggestions when available, falls back to AI.",
    inputSchema: {
      type: "object",
      properties: {
        patient_id: {
          type: "string",
          description: "Patient UUID",
        },
        mood: {
          type: "string",
          description: "Current mood (optional, enriches recommendation)",
        },
        time_of_day: {
          type: "string",
          description: "morning, afternoon, evening, night",
        },
      },
      required: ["patient_id"],
    },
  },

  ping: PING_TOOL,
};
