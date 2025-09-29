import { SupabaseClient } from '@supabase/supabase-js';

export interface FHIRQuestion {
  linkId: string;
  text: string;
  type: 'string' | 'integer' | 'decimal' | 'boolean' | 'choice' | 'date';
  required?: boolean;
  options?: Array<{ value: string; display: string; code?: string }>;
  enableWhen?: Array<{ question: string; operator: string; answerString: string }>;
}

export interface FHIRQuestionnaire {
  resourceType: 'Questionnaire';
  id: string;
  title: string;
  status: 'draft' | 'active' | 'retired';
  description: string;
  item: FHIRQuestion[];
  scoring?: {
    algorithm: string;
    rules: Array<{ condition: string; score: number; interpretation: string }>;
  };
}

export interface FHIRQuestionnaireRecord {
  id: number;
  questionnaire_id: string;
  title: string;
  description: string;
  status: 'draft' | 'active' | 'retired';
  version: string;
  fhir_version: string;
  questionnaire_json: FHIRQuestionnaire;
  created_by?: string;
  created_from_template?: string;
  natural_language_prompt?: string;
  has_scoring: boolean;
  scoring_algorithm?: string;
  scoring_rules?: any;
  total_responses: number;
  is_template: boolean;
  tags: string[];
  deployed_to_wellfit: boolean;
  deployed_to_ehr: boolean;
  deployment_config?: any;
  created_at: string;
  updated_at: string;
  published_at?: string;
  retired_at?: string;
}

export interface QuestionnaireTemplate {
  id: number;
  name: string;
  description: string;
  category: 'MENTAL_HEALTH' | 'PHYSICAL_HEALTH' | 'FUNCTIONAL_ASSESSMENT' | 'PAIN_ASSESSMENT' | 'MEDICATION_ADHERENCE' | 'QUALITY_OF_LIFE' | 'SCREENING' | 'CUSTOM';
  ai_prompt: string;
  estimated_questions: number;
  estimated_time_minutes: number;
  has_conditional_logic: boolean;
  has_scoring: boolean;
  clinical_codes?: string[];
  target_population?: string;
  evidence_base?: string;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class FHIRQuestionnaireService {
  constructor(private supabase: SupabaseClient) {}

  async generateQuestionnaire(prompt: string, templateName?: string): Promise<FHIRQuestionnaire> {
    const response = await fetch('/api/anthropic-chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `You are a FHIR SDC expert specializing in creating clinical questionnaires.

INSTRUCTIONS:
- Convert natural language form descriptions into valid FHIR R4 Questionnaire resources
- Use proper LOINC codes when available
- Include conditional logic with enableWhen where appropriate
- Add scoring rules for standardized assessments
- Ensure all linkIds are unique and meaningful
- Response must be ONLY valid JSON - no markdown, no explanations, no backticks

FHIR Questionnaire Structure:
- resourceType: "Questionnaire"
- id: descriptive-kebab-case-id
- title: Human readable title
- status: "draft"
- description: Brief description of purpose
- item: Array of questions with proper types
- scoring: Optional scoring algorithm for assessments

Question Types:
- string: Text input
- integer/decimal: Numeric values
- boolean: Yes/No
- choice: Multiple choice with answerOption array
- date: Date picker

For scoring, include algorithm name and rules array with conditions.

RESPOND WITH ONLY JSON - NO OTHER TEXT:`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.content?.[0]) {
      throw new Error('No response from AI service');
    }

    let jsonText = data.content[0].text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    try {
      const questionnaire = JSON.parse(jsonText);

      if (questionnaire.resourceType !== 'Questionnaire') {
        throw new Error('Generated resource is not a FHIR Questionnaire');
      }

      return questionnaire;
    } catch (parseError) {
      throw new Error('Failed to generate valid FHIR questionnaire. Please try rephrasing your request.');
    }
  }

  async saveQuestionnaire(
    questionnaire: FHIRQuestionnaire,
    options: {
      naturalLanguagePrompt?: string;
      templateName?: string;
      tags?: string[];
    } = {}
  ): Promise<FHIRQuestionnaireRecord> {
    const { data: user } = await this.supabase.auth.getUser();

    const questionnaireData = {
      questionnaire_id: questionnaire.id,
      title: questionnaire.title,
      description: questionnaire.description,
      status: questionnaire.status,
      questionnaire_json: questionnaire,
      created_by: user.user?.id,
      created_from_template: options.templateName,
      natural_language_prompt: options.naturalLanguagePrompt,
      has_scoring: !!questionnaire.scoring,
      scoring_algorithm: questionnaire.scoring?.algorithm,
      scoring_rules: questionnaire.scoring?.rules,
      tags: options.tags || [],
      version: '1.0',
      fhir_version: 'R4'
    };

    const { data, error } = await this.supabase
      .from('fhir_questionnaires')
      .insert(questionnaireData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save questionnaire: ${error.message}`);
    }

    return data;
  }

  async getQuestionnaires(): Promise<FHIRQuestionnaireRecord[]> {
    const { data, error } = await this.supabase
      .from('fhir_questionnaires')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch questionnaires: ${error.message}`);
    }

    return data || [];
  }

  async getTemplates(): Promise<QuestionnaireTemplate[]> {
    const { data, error } = await this.supabase
      .from('questionnaire_templates')
      .select('*')
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch templates: ${error.message}`);
    }

    return data || [];
  }

  async incrementTemplateUsage(templateId: number): Promise<void> {
    const { error } = await this.supabase.rpc('increment_template_usage', {
      template_id: templateId
    });

    if (error) {
      console.error('Failed to increment template usage:', error);
    }
  }

  async deployToWellFit(questionnaireId: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .rpc('deploy_questionnaire_to_wellfit', { questionnaire_uuid: questionnaireId });

    if (error) {
      throw new Error(`Failed to deploy questionnaire: ${error.message}`);
    }

    return data;
  }

  async updateQuestionnaireStatus(
    questionnaireId: number,
    status: 'draft' | 'active' | 'retired'
  ): Promise<void> {
    const updates: any = { status };

    if (status === 'active') {
      updates.published_at = new Date().toISOString();
    } else if (status === 'retired') {
      updates.retired_at = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('fhir_questionnaires')
      .update(updates)
      .eq('id', questionnaireId);

    if (error) {
      throw new Error(`Failed to update questionnaire status: ${error.message}`);
    }
  }

  async deleteQuestionnaire(questionnaireId: number): Promise<void> {
    const { error } = await this.supabase
      .from('fhir_questionnaires')
      .delete()
      .eq('id', questionnaireId);

    if (error) {
      throw new Error(`Failed to delete questionnaire: ${error.message}`);
    }
  }

  async getQuestionnaireStats(questionnaireId: number): Promise<any> {
    const { data, error } = await this.supabase
      .rpc('get_questionnaire_stats', { questionnaire_uuid: questionnaireId });

    if (error) {
      throw new Error(`Failed to get questionnaire stats: ${error.message}`);
    }

    return data;
  }
}