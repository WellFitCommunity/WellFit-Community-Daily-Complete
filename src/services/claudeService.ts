// Claude AI Service for WellFit Community
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '../lib/env';

class ClaudeService {
  private client: Anthropic | null = null;

  constructor() {
    if (ANTHROPIC_API_KEY) {
      this.client = new Anthropic({
        apiKey: ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true // Only for client-side usage
      });
    }
  }

  private isAvailable(): boolean {
    return this.client !== null;
  }

  // General health assistant chat
  async chatWithHealthAssistant(message: string, userContext?: any): Promise<string> {
    if (!this.isAvailable()) {
      return "I'm sorry, the AI assistant is currently unavailable. Please try again later.";
    }

    try {
      const systemPrompt = `You are a helpful, caring health assistant for seniors using the WellFit Community app.
      You should:
      - Speak in simple, friendly language
      - Provide helpful health guidance
      - Encourage users to consult their healthcare providers for medical decisions
      - Focus on wellness, daily activities, and healthy aging
      - Be supportive and encouraging

      Keep responses concise and easy to understand.`;

      const response = await this.client!.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: message
        }]
      });

      return response.content[0]?.type === 'text' ? response.content[0].text :
        "I'm having trouble understanding. Could you please rephrase your question?";

    } catch (error) {
      console.error('Claude API error:', error);
      return "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
    }
  }

  // Interpret health data in simple language
  async interpretHealthData(healthData: any): Promise<string> {
    if (!this.isAvailable()) {
      return "Health data interpretation is currently unavailable.";
    }

    try {
      const systemPrompt = `You are a health data interpreter for seniors. Take complex health metrics and explain them in simple, encouraging language. Focus on:
      - What the numbers mean in everyday terms
      - Whether they're in healthy ranges
      - Simple suggestions for improvement
      - When to talk to a doctor

      Always be positive and supportive. Never diagnose or give medical advice.`;

      const healthSummary = this.formatHealthDataForClaude(healthData);

      const response = await this.client!.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Please explain this health data in simple terms: ${healthSummary}`
        }]
      });

      return response.content[0]?.type === 'text' ? response.content[0].text :
        "I couldn't interpret your health data right now. Please try again.";

    } catch (error) {
      console.error('Claude health interpretation error:', error);
      return "I'm having trouble reading your health data right now. Please try again later.";
    }
  }

  // Generate personalized health suggestions
  async generateHealthSuggestions(userProfile: any, recentActivity: any): Promise<string[]> {
    if (!this.isAvailable()) {
      return ["Keep up your daily check-ins!", "Stay hydrated throughout the day.", "Take a short walk if you feel up to it."];
    }

    try {
      const systemPrompt = `You are a wellness coach for seniors. Based on their profile and recent activity, suggest 3-5 simple, actionable health tips. Make them:
      - Easy to understand and follow
      - Age-appropriate
      - Encouraging and positive
      - Safe for seniors

      Return each suggestion on a new line.`;

      const contextInfo = this.formatUserContextForClaude(userProfile, recentActivity);

      const response = await this.client!.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Based on this user information, provide health suggestions: ${contextInfo}`
        }]
      });

      const suggestions = response.content[0]?.type === 'text' ?
        response.content[0].text.split('\n').filter(line => line.trim()) :
        ["Keep up your daily check-ins!", "Stay hydrated throughout the day."];

      return suggestions.slice(0, 5); // Limit to 5 suggestions

    } catch (error) {
      console.error('Claude suggestions error:', error);
      return ["Keep up your daily check-ins!", "Stay hydrated throughout the day.", "Take a short walk if you feel up to it."];
    }
  }

  private formatHealthDataForClaude(healthData: any): string {
    const parts = [];

    if (healthData.bp_systolic && healthData.bp_diastolic) {
      parts.push(`Blood pressure: ${healthData.bp_systolic}/${healthData.bp_diastolic}`);
    }

    if (healthData.heart_rate) {
      parts.push(`Heart rate: ${healthData.heart_rate} bpm`);
    }

    if (healthData.blood_sugar || healthData.glucose_mg_dl) {
      const glucose = healthData.blood_sugar || healthData.glucose_mg_dl;
      parts.push(`Blood sugar: ${glucose} mg/dL`);
    }

    if (healthData.blood_oxygen || healthData.pulse_oximeter) {
      const oxygen = healthData.blood_oxygen || healthData.pulse_oximeter;
      parts.push(`Blood oxygen: ${oxygen}%`);
    }

    if (healthData.weight) {
      parts.push(`Weight: ${healthData.weight} lbs`);
    }

    if (healthData.mood) {
      parts.push(`Mood: ${healthData.mood}`);
    }

    return parts.length > 0 ? parts.join(', ') : 'No specific health metrics available';
  }

  private formatUserContextForClaude(userProfile: any, recentActivity: any): string {
    const parts = [];

    if (userProfile?.age || userProfile?.dob) {
      const age = userProfile.age || (userProfile.dob ? new Date().getFullYear() - new Date(userProfile.dob).getFullYear() : null);
      if (age) parts.push(`Age: ${age}`);
    }

    if (recentActivity?.checkInCount) {
      parts.push(`Recent check-ins: ${recentActivity.checkInCount}`);
    }

    if (recentActivity?.lastActivity) {
      parts.push(`Last activity: ${recentActivity.lastActivity}`);
    }

    if (recentActivity?.mood) {
      parts.push(`Recent mood: ${recentActivity.mood}`);
    }

    return parts.length > 0 ? parts.join(', ') : 'Limited user information available';
  }
}

// Export singleton instance
export const claudeService = new ClaudeService();
export default claudeService;