/**
 * AI-Powered Dashboard Personalization Service
 *
 * Uses Claude Haiku 4.5 to analyze user behavior and intelligently
 * personalize the admin dashboard layout and content
 */

import { UserBehaviorTracker, UsagePattern, UserPreferences } from './userBehaviorTracking';
import { getOptimalModel } from './intelligentModelRouter';
import { RequestType } from '../types/claude';
import { supabase } from '../lib/supabaseClient';

export interface DashboardLayout {
  topSections: string[]; // Section IDs to show at top
  collapsedSections: string[]; // Section IDs to keep collapsed
  quickActions: string[]; // Quick action buttons to highlight
  welcomeMessage?: string; // Personalized greeting
  suggestions?: string[]; // AI suggestions like "You might want to check..."
}

export interface PersonalizationInsight {
  type: 'pattern' | 'suggestion' | 'workflow' | 'time-based';
  message: string;
  action?: string;
  confidence: number;
}

export class DashboardPersonalizationAI {
  /**
   * Generate personalized dashboard layout using AI
   */
  static async generatePersonalizedLayout(
    userId: string,
    role: string,
    currentHour: number = new Date().getHours()
  ): Promise<DashboardLayout> {
    try {
      // Get user's behavior patterns
      const preferences = await UserBehaviorTracker.getUserPreferences(userId, role);

      // Use Claude Haiku 4.5 to analyze patterns and generate layout
      const aiInsights = await this.getAIInsights(preferences, currentHour);

      // Build layout based on patterns and AI insights
      return this.buildLayout(preferences, aiInsights);
    } catch (error) {
      console.error('Failed to generate personalized layout:', error);
      return this.getDefaultLayout(role);
    }
  }

  /**
   * Get AI insights using Claude Haiku 4.5
   */
  private static async getAIInsights(
    preferences: UserPreferences,
    currentHour: number
  ): Promise<PersonalizationInsight[]> {
    try {
      const model = getOptimalModel(RequestType.DASHBOARD_PREDICTION);

      // Build prompt for Claude
      const prompt = this.buildAnalysisPrompt(preferences, currentHour);

      // Call Claude via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('claude-personalization', {
        body: {
          model,
          prompt,
          userId: preferences.userId,
          requestType: RequestType.DASHBOARD_PREDICTION
        }
      });

      if (error) throw error;

      return this.parseAIResponse(data.content);
    } catch (error) {
      console.error('AI insights failed, using pattern-based fallback:', error);
      return this.getPatternBasedInsights(preferences);
    }
  }

  /**
   * Build prompt for Claude to analyze user behavior
   */
  private static buildAnalysisPrompt(
    preferences: UserPreferences,
    currentHour: number
  ): string {
    const topSectionsText = preferences.topSections
      .map((s, i) => `${i + 1}. ${s.sectionName} (opened ${s.openCount} times, ${s.frequencyScore.toFixed(0)}% frequency)`)
      .join('\n');

    const timeOfDay = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening';

    return `You are analyzing admin dashboard usage for a ${preferences.role} user. Based on their behavior, predict what they need RIGHT NOW.

Current time: ${timeOfDay} (${currentHour}:00)

Their top 5 most-used sections in last 30 days:
${topSectionsText}

Task: Provide 2-3 actionable predictions about what this user will likely need:
1. What section they'll probably open first today
2. What workflow they're likely doing (e.g., "checking billing then submitting claims")
3. Any time-based patterns (e.g., "morning users typically check patient engagement first")

Format your response as JSON:
{
  "predictions": [
    {
      "type": "primary_action",
      "section": "section-id",
      "reason": "one sentence explanation",
      "confidence": 0-100
    }
  ],
  "workflow_suggestion": "brief description",
  "time_based_tip": "brief tip based on time of day"
}

Be concise and actionable. This powers real-time UI reorganization.`;
  }

  /**
   * Parse Claude's AI response into insights
   */
  private static parseAIResponse(aiResponse: string): PersonalizationInsight[] {
    try {
      const parsed = JSON.parse(aiResponse);
      const insights: PersonalizationInsight[] = [];

      // Extract predictions
      parsed.predictions?.forEach((pred: any) => {
        insights.push({
          type: 'pattern',
          message: `You usually start with: ${pred.section}`,
          action: pred.section,
          confidence: pred.confidence || 75
        });
      });

      // Add workflow suggestion
      if (parsed.workflow_suggestion) {
        insights.push({
          type: 'workflow',
          message: parsed.workflow_suggestion,
          confidence: 80
        });
      }

      // Add time-based tip
      if (parsed.time_based_tip) {
        insights.push({
          type: 'time-based',
          message: parsed.time_based_tip,
          confidence: 70
        });
      }

      return insights;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return [];
    }
  }

  /**
   * Pattern-based insights (fallback when AI fails)
   */
  private static getPatternBasedInsights(preferences: UserPreferences): PersonalizationInsight[] {
    const insights: PersonalizationInsight[] = [];

    // Top section insight
    if (preferences.topSections.length > 0) {
      const top = preferences.topSections[0];
      insights.push({
        type: 'pattern',
        message: `You frequently use: ${top.sectionName}`,
        action: top.sectionId,
        confidence: 85
      });
    }

    // Workflow insight (if they use 2+ sections consistently)
    if (preferences.topSections.length >= 2) {
      const [first, second] = preferences.topSections;
      insights.push({
        type: 'workflow',
        message: `Common workflow: ${first.sectionName} → ${second.sectionName}`,
        confidence: 75
      });
    }

    return insights;
  }

  /**
   * Build dashboard layout from preferences and insights
   */
  private static buildLayout(
    preferences: UserPreferences,
    insights: PersonalizationInsight[]
  ): DashboardLayout {
    // Sections to show expanded at top
    const topSections = preferences.topSections
      .slice(0, 3)
      .map(s => s.sectionId);

    // Sections with low usage → keep collapsed
    const collapsedSections = preferences.topSections
      .filter(s => s.frequencyScore < 20)
      .map(s => s.sectionId);

    // Build personalized welcome message
    const welcomeMessage = this.generateWelcomeMessage(preferences, insights);

    // Extract suggestions from AI insights
    const suggestions = insights
      .filter(i => i.confidence > 70)
      .map(i => i.message);

    return {
      topSections,
      collapsedSections,
      quickActions: topSections.slice(0, 3),
      welcomeMessage,
      suggestions
    };
  }

  /**
   * Generate personalized welcome message
   */
  private static generateWelcomeMessage(
    preferences: UserPreferences,
    insights: PersonalizationInsight[]
  ): string {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const topSection = preferences.topSections[0];
    if (!topSection) {
      return `${greeting}! Welcome to your dashboard.`;
    }

    // Find highest confidence insight
    const topInsight = insights.sort((a, b) => b.confidence - a.confidence)[0];

    if (topInsight && topInsight.confidence > 80) {
      return `${greeting}! ${topInsight.message}`;
    }

    return `${greeting}! You often check ${topSection.sectionName} - it's ready for you.`;
  }

  /**
   * Get default layout for role (when no personalization data exists)
   */
  private static getDefaultLayout(role: string): DashboardLayout {
    // Role-based defaults
    const roleDefaults: Record<string, DashboardLayout> = {
      admin: {
        topSections: ['patient-engagement', 'user-management'],
        collapsedSections: ['api-keys', 'super-admin'],
        quickActions: ['enroll-senior', 'questions'],
        welcomeMessage: 'Welcome! Start by checking patient engagement.'
      },
      billing_staff: {
        topSections: ['revenue-dashboard', 'claims-submission', 'billing'],
        collapsedSections: ['security', 'fhir-tools'],
        quickActions: ['smart-scribe', 'ccm-autopilot'],
        welcomeMessage: 'Welcome! Your revenue tools are ready.'
      },
      nurse: {
        topSections: ['patient-engagement', 'patient-handoff'],
        collapsedSections: ['billing', 'security'],
        quickActions: ['questions', 'edit-profiles'],
        welcomeMessage: 'Welcome! Check patient engagement and messages.'
      }
    };

    return roleDefaults[role] || roleDefaults.admin;
  }

  /**
   * Track that user opened a section (for learning)
   */
  static async trackSectionOpen(
    userId: string,
    sectionId: string,
    sectionName: string,
    role: string
  ): Promise<void> {
    await UserBehaviorTracker.trackInteraction({
      userId,
      sectionId,
      sectionName,
      action: 'open',
      timestamp: new Date(),
      role
    });
  }
}
