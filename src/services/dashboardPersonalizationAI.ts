/**
 * AI-Powered Dashboard Personalization Service
 *
 * Uses Claude Haiku 4.5 to analyze user behavior and intelligently
 * personalize the admin dashboard layout and content
 */

import { UserBehaviorTracker, UserPreferences } from './userBehaviorTracking';
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

      return this.getDefaultLayout(role);
    }
  }

  /**
   * Get AI insights using Claude Haiku 4.5
   * HIPAA COMPLIANCE: All calls logged to claude_usage_logs
   */
  private static async getAIInsights(
    preferences: UserPreferences,
    currentHour: number
  ): Promise<PersonalizationInsight[]> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      const model = getOptimalModel(RequestType.DASHBOARD_PREDICTION);

      // Build prompt for Claude
      const prompt = this.buildAnalysisPrompt(preferences, currentHour);

      // Call Claude via Supabase Edge Function (PHI scrubbing done in Edge Function)
      const { data, error } = await supabase.functions.invoke('claude-personalization', {
        body: {
          model,
          prompt,
          userId: preferences.userId,
          requestType: RequestType.DASHBOARD_PREDICTION
        }
      });

      if (error) throw error;

      const responseTime = Date.now() - startTime;

      // HIPAA AUDIT LOGGING: Log successful AI call
      await this.logAIUsage({
        userId: preferences.userId,
        requestId,
        requestType: RequestType.DASHBOARD_PREDICTION,
        model,
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        cost: this.calculateCost(data.usage),
        responseTime,
        success: true
      });

      return this.parseAIResponse(data.content);
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // HIPAA AUDIT LOGGING: Log failed AI call
      await this.logAIUsage({
        userId: preferences.userId,
        requestId,
        requestType: RequestType.DASHBOARD_PREDICTION,
        model: getOptimalModel(RequestType.DASHBOARD_PREDICTION),
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        responseTime,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });


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
      // Extract JSON from response - Claude often wraps it in markdown code blocks
      let jsonStr = aiResponse;

      // Try to extract JSON from markdown code block
      const jsonBlockMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonBlockMatch) {
        jsonStr = jsonBlockMatch[1].trim();
      } else {
        // Try to find JSON object in the response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }

      const parsed = JSON.parse(jsonStr);
      const insights: PersonalizationInsight[] = [];

      // Extract predictions
      interface AIPrediction {
        section: string;
        reason?: string;
        confidence?: number;
      }
      (parsed.predictions as AIPrediction[] | undefined)?.forEach((pred) => {
        insights.push({
          type: 'pattern',
          message: pred.reason || `You usually start with: ${pred.section}`,
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
    } catch {
      // If JSON parsing fails completely, return empty - will use fallback pattern-based insights
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
   * HIPAA COMPLIANCE: Section names must be generic feature names only, no PHI
   */
  static async trackSectionOpen(
    userId: string,
    sectionId: string,
    sectionName: string,
    role: string
  ): Promise<void> {
    // HIPAA COMPLIANCE: Validate section name contains no PHI
    const sanitizedSectionName = this.sanitizeSectionName(sectionName);

    await UserBehaviorTracker.trackInteraction({
      userId,
      sectionId,
      sectionName: sanitizedSectionName,
      action: 'open',
      timestamp: new Date(),
      role
    });
  }

  /**
   * HIPAA COMPLIANCE: Ensure section names are de-identified
   * Rejects names that look like PHI (patient names, emails, etc.)
   */
  private static sanitizeSectionName(name: string): string {
    // Block common PHI patterns in section names
    const phiPatterns = [
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, // Email
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, // Phone
      /Patient:\s+[A-Z][a-z]+/i, // "Patient: John"
      /Mr\.|Mrs\.|Ms\.|Dr\.\s+[A-Z][a-z]+/i, // "Dr. Smith"
    ];

    for (const pattern of phiPatterns) {
      if (pattern.test(name)) {

        return 'generic-section'; // Fallback to generic name
      }
    }

    return name;
  }

  /**
   * HIPAA COMPLIANCE: Log AI usage to audit table
   */
  private static async logAIUsage(params: {
    userId: string;
    requestId: string;
    requestType: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    responseTime: number;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      const { error: insertError } = await supabase.from('claude_usage_logs').insert({
        user_id: params.userId,
        request_id: params.requestId,
        request_type: params.requestType,
        model: params.model,
        input_tokens: params.inputTokens,
        output_tokens: params.outputTokens,
        cost: params.cost,
        response_time_ms: params.responseTime,
        success: params.success,
        error_code: params.success ? null : 'PERSONALIZATION_ERROR',
        error_message: params.errorMessage || null,
        // Don't set created_at - let the database default handle it
      });

      if (insertError) {
        // Removed console statement:', insertError);
      }
    } catch (error) {
      // Removed console statement:', error);
      // Don't throw - audit logging failure should not break functionality
    }
  }

  /**
   * Calculate cost based on token usage
   * Haiku 4.5: $0.0001/request (~$0.25 per 1M input tokens, $1.25 per 1M output)
   */
  private static calculateCost(usage?: { input_tokens?: number; output_tokens?: number }): number {
    if (!usage) return 0;

    const inputCost = (usage.input_tokens || 0) * 0.00000025; // $0.25 per 1M
    const outputCost = (usage.output_tokens || 0) * 0.00000125; // $1.25 per 1M

    return parseFloat((inputCost + outputCost).toFixed(4));
  }
}
