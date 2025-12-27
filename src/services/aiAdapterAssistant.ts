// AI-Powered EHR Adapter Configuration Assistant
// Uses Claude Haiku 4.5 for fast, intelligent adapter setup guidance

import { loadAnthropicSDK } from './anthropicLoader';

// Create React App uses VITE_ prefix for environment variables
// Access via process.env (available in CRA)
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
    const Anthropic = await loadAnthropicSDK();
    this.client = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
      dangerouslyAllowBrowser: true // Only for demo - move to backend in production
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
1. Identify which EHR/EMR system they're using (Epic, Cerner, Athenahealth, etc.)
2. Suggest the correct adapter configuration
3. Determine the likely authentication method
4. Provide step-by-step guidance

Available Adapters:
- epic-fhir-r4: Epic Systems FHIR R4 API
- cerner-fhir-r4: Cerner FHIR R4 API
- athenahealth-fhir: Athenahealth FHIR API
- allscripts-fhir: Allscripts FHIR API
- generic-fhir-r4: Generic FHIR R4 (for any compliant system)

Common Authentication Methods:
- OAuth2: Most common for Epic, Cerner (requires client ID + secret)
- API Key: Common for Athenahealth, smaller vendors
- Basic Auth: Older systems or internal APIs

Respond in JSON format:
{
  "message": "Human-friendly explanation of what you detected",
  "suggestedConfig": {
    "adapterId": "which adapter to use",
    "authType": "oauth2, api-key, or basic",
    "endpoint": "cleaned/corrected FHIR endpoint URL",
    "additionalSteps": ["step 1", "step 2", ...]
  },
  "confidence": "high, medium, or low",
  "needsMoreInfo": true/false,
  "questions": ["question 1", "question 2", ...] // if needsMoreInfo is true
}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4.5-20250514',
        max_tokens: 1024,
        messages: [
          ...this.conversationHistory,
          { role: 'user', content: prompt }
        ]
      });

      const assistantMessage = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      this.conversationHistory.push(
        { role: 'user', content: prompt },
        { role: 'assistant', content: assistantMessage }
      );

      // Parse JSON response
      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as AdapterAssistantResponse;
      }

      // Fallback if JSON parsing fails
      return {
        message: assistantMessage,
        confidence: 'low',
        needsMoreInfo: true,
        questions: ['Could you provide more details about your EHR system?']
      };
    } catch (error: unknown) {
      return {
        message: `I encountered an error analyzing your hospital system. Please try again or configure manually. Error: ${error.message}`,
        confidence: 'low',
        needsMoreInfo: true
      };
    }
  }

  /**
   * Answer follow-up questions about adapter configuration
   */
  async askQuestion(question: string): Promise<string> {
    const prompt = `Continue helping the hospital configure their EHR adapter. Answer this question concisely and practically:

Question: ${question}

Provide actionable advice in 2-3 sentences.`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4.5-20250514',
        max_tokens: 512,
        messages: [
          ...this.conversationHistory,
          { role: 'user', content: prompt }
        ]
      });

      const assistantMessage = response.content[0].type === 'text'
        ? response.content[0].text
        : 'I apologize, I could not generate a response.';

      this.conversationHistory.push(
        { role: 'user', content: prompt },
        { role: 'assistant', content: assistantMessage }
      );

      return assistantMessage;
    } catch (error: unknown) {
      return `I encountered an error: ${error.message}`;
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
    const prompt = `You are validating a FHIR endpoint URL for hospital EHR integration.

URL provided: ${url}

Check:
1. Is this a valid FHIR endpoint URL?
2. Does it follow standard FHIR URL patterns?
3. Should it end with /R4 or /FHIR/R4?
4. Any security concerns (http vs https)?
5. Common mistakes?

Respond in JSON:
{
  "isValid": true/false,
  "correctedUrl": "fixed version if needed",
  "warnings": ["warning 1", ...],
  "suggestions": ["suggestion 1", ...]
}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4.5-20250514',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }]
      });

      const assistantMessage = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        isValid: false,
        warnings: ['Could not validate URL format']
      };
    } catch (error: unknown) {
      return {
        isValid: false,
        warnings: [`Validation error: ${error.message}`]
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
    const prompt = `You are troubleshooting a failed EHR adapter connection.

Error Message: ${error}

Configuration:
- Adapter: ${config.adapterId || 'unknown'}
- Endpoint: ${config.endpoint || 'not provided'}
- Auth Type: ${config.authType || 'not specified'}

Diagnose the issue and provide solutions in JSON format:
{
  "diagnosis": "What likely went wrong",
  "possibleCauses": ["cause 1", "cause 2", ...],
  "solutions": ["solution 1", "solution 2", ...],
  "nextSteps": ["step 1", "step 2", ...]
}`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4.5-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });

      const assistantMessage = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        diagnosis: 'Unable to diagnose the error automatically',
        possibleCauses: ['Unknown error'],
        solutions: ['Try manual configuration or contact support'],
        nextSteps: ['Review logs', 'Check credentials', 'Contact hospital IT']
      };
    } catch (error: unknown) {
      return {
        diagnosis: `Troubleshooting failed: ${error.message}`,
        possibleCauses: ['AI assistant unavailable'],
        solutions: ['Configure manually or contact support'],
        nextSteps: ['Check API key', 'Review error logs']
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
    const prompt = `Generate a detailed setup guide for hospital IT staff to configure this EHR adapter:

Adapter: ${adapterId}
Authentication: ${authType}

Create a step-by-step guide in JSON format:
{
  "title": "Setup Guide Title",
  "steps": [
    {
      "step": 1,
      "title": "Step title",
      "description": "Detailed instructions",
      "tips": ["tip 1", "tip 2"]
    }
  ],
  "estimatedTime": "e.g., 15-30 minutes",
  "prerequisites": ["prereq 1", "prereq 2"]
}

Make it practical and hospital IT-friendly.`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4.5-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      });

      const assistantMessage = response.content[0].type === 'text'
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
        prerequisites: ['Contact support for detailed guide']
      };
    } catch (error: unknown) {
      return {
        title: 'Setup Guide Unavailable',
        steps: [],
        estimatedTime: 'Unknown',
        prerequisites: [`Error: ${error.message}`]
      };
    }
  }

  /**
   * Reset conversation history
   */
  resetConversation(): void {
    this.conversationHistory = [];
  }

  /**
   * Check if AI assistant is available
   */
  isAvailable(): boolean {
    return !!ANTHROPIC_API_KEY;
  }
}

// Singleton instance
let instance: AIAdapterAssistant | null = null;

export const getAIAdapterAssistant = (): AIAdapterAssistant => {
  if (!instance) {
    instance = new AIAdapterAssistant();
  }
  return instance;
};

export default AIAdapterAssistant;
