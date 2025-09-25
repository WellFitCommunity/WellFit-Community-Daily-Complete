// Claude AI Service for WellFit Community
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '../lib/env';

class ClaudeService {
  private client: Anthropic | null = null;

  constructor() {
    if (ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
      try {
        this.client = new Anthropic({
          apiKey: ANTHROPIC_API_KEY,
          dangerouslyAllowBrowser: true // Only for client-side usage
        });
      } catch (error) {
        console.error('Failed to initialize Claude client:', error);
        this.client = null;
      }
    } else {
      console.warn('Claude AI: Invalid or missing API key');
    }
  }

  private isAvailable(): boolean {
    return this.client !== null;
  }

  // Test method to verify Claude service is working
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        message: "Claude AI client not initialized. Check API key configuration."
      };
    }

    try {
      const response = await this.client!.messages.create({
        model: 'claude-4-sonnet-20250109',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: 'Hello, please respond with "Claude AI is working properly"'
        }]
      });

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

      return {
        success: true,
        message: `✅ Claude AI connected successfully. Response: ${content}`
      };

    } catch (error: any) {
      console.error('Claude connection test failed:', error);
      return {
        success: false,
        message: `❌ Claude AI connection failed: ${error.message || 'Unknown error'}`
      };
    }
  }

  // General health assistant chat (Senior-facing - uses faster model)
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
        model: 'claude-3-5-haiku-20241022', // Fast model for seniors
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
        model: 'claude-4-sonnet-20250109',
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

  // Admin: AI-powered risk assessment scoring
  async analyzeRiskAssessment(assessmentData: any): Promise<{
    suggestedRiskLevel: string;
    riskFactors: string[];
    recommendations: string[];
    clinicalNotes: string;
  }> {
    if (!this.isAvailable()) {
      return {
        suggestedRiskLevel: 'MODERATE',
        riskFactors: ['Assessment needs manual review'],
        recommendations: ['Manual clinical evaluation required'],
        clinicalNotes: 'AI analysis unavailable - please conduct manual assessment'
      };
    }

    try {
      const systemPrompt = `You are a healthcare AI assistant helping clinicians assess senior patient risk. Analyze functional assessment data and provide:
      1. Risk level (LOW/MODERATE/HIGH/CRITICAL)
      2. Key risk factors identified
      3. Clinical recommendations
      4. Brief assessment notes

      Base your analysis on mobility, ADLs, fall risk, and functional independence. Be conservative in risk assessment.`;

      const assessmentSummary = this.formatAssessmentForClaude(assessmentData);

      const response = await this.client!.messages.create({
        model: 'claude-4-sonnet-20250109',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Analyze this functional assessment: ${assessmentSummary}`
        }]
      });

      const analysis = response.content[0]?.type === 'text' ? response.content[0].text : '';
      return this.parseRiskAnalysis(analysis);

    } catch (error) {
      console.error('Claude risk analysis error:', error);
      return {
        suggestedRiskLevel: 'MODERATE',
        riskFactors: ['AI analysis failed'],
        recommendations: ['Manual clinical review required'],
        clinicalNotes: 'Automated analysis unavailable - please review manually'
      };
    }
  }

  // Admin: Generate clinical notes from assessment data
  async generateClinicalNotes(patientData: any, assessmentData: any): Promise<string> {
    if (!this.isAvailable()) {
      return "Clinical notes generation unavailable. Please document findings manually.";
    }

    try {
      const systemPrompt = `You are a clinical documentation assistant. Generate professional, concise clinical notes for a senior patient assessment. Include:
      - Functional status summary
      - Risk factors observed
      - Clinical impressions
      - Follow-up recommendations

      Use medical terminology appropriate for healthcare records.`;

      const contextData = this.formatClinicalContextForClaude(patientData, assessmentData);

      const response = await this.client!.messages.create({
        model: 'claude-4-sonnet-20250109',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Generate clinical notes for: ${contextData}`
        }]
      });

      return response.content[0]?.type === 'text' ? response.content[0].text :
        "Unable to generate clinical notes. Please document assessment findings manually.";

    } catch (error) {
      console.error('Claude clinical notes error:', error);
      return "Clinical notes generation failed. Please document assessment manually.";
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
        model: 'claude-4-sonnet-20250109',
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

  private formatAssessmentForClaude(assessmentData: any): string {
    const parts = [];

    // Functional assessment data
    if (assessmentData.walking_ability) parts.push(`Walking: ${assessmentData.walking_ability}`);
    if (assessmentData.stair_climbing) parts.push(`Stairs: ${assessmentData.stair_climbing}`);
    if (assessmentData.sitting_ability) parts.push(`Sitting: ${assessmentData.sitting_ability}`);
    if (assessmentData.standing_ability) parts.push(`Standing: ${assessmentData.standing_ability}`);
    if (assessmentData.toilet_transfer) parts.push(`Toilet transfer: ${assessmentData.toilet_transfer}`);
    if (assessmentData.bathing_ability) parts.push(`Bathing: ${assessmentData.bathing_ability}`);
    if (assessmentData.meal_preparation) parts.push(`Meals: ${assessmentData.meal_preparation}`);
    if (assessmentData.medication_management) parts.push(`Medications: ${assessmentData.medication_management}`);

    // Fall risk factors
    if (assessmentData.fall_risk_factors?.length > 0) {
      parts.push(`Fall risks: ${assessmentData.fall_risk_factors.join(', ')}`);
    }

    // Risk scores
    if (assessmentData.medical_risk_score) parts.push(`Medical risk: ${assessmentData.medical_risk_score}/10`);
    if (assessmentData.mobility_risk_score) parts.push(`Mobility risk: ${assessmentData.mobility_risk_score}/10`);
    if (assessmentData.cognitive_risk_score) parts.push(`Cognitive risk: ${assessmentData.cognitive_risk_score}/10`);
    if (assessmentData.social_risk_score) parts.push(`Social risk: ${assessmentData.social_risk_score}/10`);

    return parts.length > 0 ? parts.join('; ') : 'Limited assessment data available';
  }

  private formatClinicalContextForClaude(patientData: any, assessmentData: any): string {
    const parts = [];

    if (patientData?.first_name && patientData?.last_name) {
      parts.push(`Patient: ${patientData.first_name} ${patientData.last_name}`);
    }

    if (patientData?.age || patientData?.dob) {
      const age = patientData.age || (patientData.dob ? new Date().getFullYear() - new Date(patientData.dob).getFullYear() : null);
      if (age) parts.push(`Age: ${age}`);
    }

    // Include assessment summary
    const assessmentSummary = this.formatAssessmentForClaude(assessmentData);
    if (assessmentSummary) parts.push(`Assessment: ${assessmentSummary}`);

    return parts.length > 0 ? parts.join('. ') : 'Limited patient context available';
  }

  private parseRiskAnalysis(analysis: string): {
    suggestedRiskLevel: string;
    riskFactors: string[];
    recommendations: string[];
    clinicalNotes: string;
  } {
    // Simple parsing of Claude's response
    const lines = analysis.split('\n').filter(line => line.trim());

    let suggestedRiskLevel = 'MODERATE';
    const riskFactors: string[] = [];
    const recommendations: string[] = [];
    let clinicalNotes = analysis;

    // Extract risk level
    const riskMatch = analysis.match(/(LOW|MODERATE|HIGH|CRITICAL)/i);
    if (riskMatch) {
      suggestedRiskLevel = riskMatch[1].toUpperCase();
    }

    // Extract bullet points as risk factors and recommendations
    lines.forEach(line => {
      const cleanLine = line.trim();
      if (cleanLine.match(/^[-*•]\s*.{5,}/)) {
        const content = cleanLine.replace(/^[-*•]\s*/, '');
        if (content.toLowerCase().includes('risk') || content.toLowerCase().includes('concern')) {
          riskFactors.push(content);
        } else if (content.toLowerCase().includes('recommend') || content.toLowerCase().includes('suggest')) {
          recommendations.push(content);
        }
      }
    });

    // Fallbacks
    if (riskFactors.length === 0) {
      riskFactors.push('Assessment requires clinical review');
    }
    if (recommendations.length === 0) {
      recommendations.push('Continue regular monitoring and follow-up');
    }

    return {
      suggestedRiskLevel,
      riskFactors: riskFactors.slice(0, 5),
      recommendations: recommendations.slice(0, 5),
      clinicalNotes: clinicalNotes.substring(0, 500)
    };
  }
}

// Export singleton instance
export const claudeService = new ClaudeService();
export default claudeService;