// AI-Powered EHR Adapter Configuration Assistant
// Uses Claude Haiku 4.5 for fast, intelligent adapter setup guidance

import { getErrorMessage } from '../lib/getErrorMessage';
import { loadAnthropicSDK } from './anthropicLoader';

// Vite uses VITE_ prefix for environment variables
// Access via import.meta.env
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

interface AdapterAssistantResponse {
  message: string;
  suggestedConfig?: {
    adapterId?: string;
    authType?: string;
    endpoint?: string;
    additionalSteps?: string[];
  };
  confidence: 'high' | 'medium' | 'low';
  needsMoreInfo: boolean;
  questions?: string[];
}

export class AIAdapterAssistant {
  private client: any = null;
  private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  async initialize() {
    if (!ANTHROPIC_API_KEY) {
      return;
    }

    // ⚠️ DO NOT expose AI keys in browser for production
    if (import.meta.env.MODE === 'production') {
      return;
    }

    const Anthropic = await loadAnthropicSDK();
    this.client = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
      dangerouslyAllowBrowser: true // dev/demo only
    });
  }

  /**
   * Analyze hospital information and suggest adapter configuration
   */
  async analyzeHospitalSystem(hospitalInfo: {
    name?: string;
    ehrSystem?: string;
    url?: string;
    additionalInfo?: string;
  }): Promise<AdapterAssistantResponse> {
    if (!this.client) await this.initialize();

    const prompt = `You are an expert EHR/EMR integration specialist helping a hospital configure their electronic health record system connection.

Hospital Information:
- Name: ${hospitalInfo.name || 'Not provided'}
- EHR System: ${hospitalInfo.ehrSystem || 'Unknown'}
- URL/Endpoint: ${hospitalInfo.url || 'Not provided'}
- Additional Info: ${hospitalInfo.additionalInfo || 'None'}

Your task:
1. Identify which EHR/EMR system they're using
2. Suggest the correct adapter configuration
3. Determine the likely authentication method
4. Provide step-by-step guidance`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4.5-20250514',
        max_tokens: 1024,
        messages: [
          ...this.conversationHistory,
          { role: 'user', content: prompt }
        ]
      });

      const assistantMessage =
        response.content[0].type === 'text'
          ? response.content[0].text
          : '';

      this.conversationHistory.push(
        { role: 'user', content: prompt },
        { role: 'assistant', content: assistantMessage }
      );

      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as AdapterAssistantResponse;
      }

      return {
        message: assistantMessage,
        confidence: 'low',
        needsMoreInfo: true,
        questions: ['Could you provide more details about your EHR system?']
      };
    } catch (err: unknown) {
      return {
        message: `I encountered an error analyzing your hospital system. Error: ${getErrorMessage(err)}`,
        confidence: 'low',
        needsMoreInfo: true
      };
    }
  }

  /**
   * Answer follow-up questions about adapter configuration
   */
  async askQuestion(question: string): Promise<string> {
    const prompt = `Continue helping the hospital configure their EHR adapter.

Question: ${question}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4.5-20250514',
        max_tokens: 512,
        messages: [
          ...this.conversationHistory,
          { role: 'user', content: prompt }
        ]
      });

      const assistantMessage =
        response.content[0].type === 'text'
          ? response.content[0].text
          : 'I could not generate a response.';

      this.conversationHistory.push(
        { role: 'user', content: prompt },
        { role: 'assistant', content: assistantMessage }
      );

      return assistantMessage;
    } catch (err: unknown) {
      return `I encountered an error: ${getErrorMessage(err)}`;
    }
  }

  /**
   * Validate and improve FHIR endpoint URL
   */
  async validateEndpoint(url: string): Promise<{
    isValid: boolean;
    correctedUrl?: string;
    warnings?: string[];
    suggestions?: string[];
  }> {
    const prompt = `Validate this FHIR endpoint URL: ${url}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4.5-20250514',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }]
      });

      const assistantMessage =
        response.content[0].type === 'text'
          ? response.content[0].text
          : '';

      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { isValid: false };
    } catch (err: unknown) {
      return {
        isValid: false,
        warnings: [`Validation error: ${getErrorMessage(err)}`]
      };
    }
  }

  /**
   * Troubleshoot connection errors
   */
  async troubleshootError(error: string, config: any): Promise<{
    diagnosis: string;
    possibleCauses: string[];
    solutions: string[];
    nextSteps: string[];
  }> {
    const prompt = `Troubleshoot this connection error: ${error}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4.5-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });

      const assistantMessage =
        response.content[0].type === 'text'
          ? response.content[0].text
          : '';

      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        diagnosis: 'Unable to diagnose automatically',
        possibleCauses: ['Unknown'],
        solutions: ['Configure manually'],
        nextSteps: ['Review logs']
      };
    } catch (err: unknown) {
      return {
        diagnosis: `Troubleshooting failed: ${getErrorMessage(err)}`,
        possibleCauses: ['AI assistant unavailable'],
        solutions: ['Configure manually'],
        nextSteps: ['Check API key', 'Review logs']
      };
    }
  }

  /**
   * Generate step-by-step setup guide
   */
  async generateSetupGuide(adapterId: string, authType: string): Promise<{
    title: string;
    steps: Array<{ step: number; title: string; description: string; tips?: string[] }>;
    estimatedTime: string;
    prerequisites: string[];
  }> {
    const prompt = `Generate a setup guide for adapter ${adapterId}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4.5-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      });

      const assistantMessage =
        response.content[0].type === 'text'
          ? response.content[0].text
          : '';

      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        title: 'Manual Setup Required',
        steps: [],
        estimatedTime: 'Unknown',
        prerequisites: ['Contact support']
      };
    } catch (err: unknown) {
      return {
        title: 'Setup Guide Unavailable',
        steps: [],
        estimatedTime: 'Unknown',
        prerequisites: [`Error: ${getErrorMessage(err)}`]
      };
    }
  }

  resetConversation(): void {
    this.conversationHistory = [];
  }

  isAvailable(): boolean {
    return !!ANTHROPIC_API_KEY;
  }
}

// Singleton
let instance: AIAdapterAssistant | null = null;

export const getAIAdapterAssistant = (): AIAdapterAssistant => {
  if (!instance) {
    instance = new AIAdapterAssistant();
  }
  return instance;
};

export default AIAdapterAssistant;
