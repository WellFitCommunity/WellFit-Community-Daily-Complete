/**
 * Provider Assistant Service
 *
 * Frontend service for AI-powered provider assistance.
 * Role-adaptive conversational AI for clinical staff:
 * - Physicians: Clinical decision support, drug info, guidelines
 * - Nurses: Care coordination, patient education, assessments
 * - Care Coordinators: Discharge planning, referrals, resources
 * - Pharmacists: Drug interactions, dosing, counseling
 * - Admin Staff: Scheduling, billing, workflows
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy.
 *
 * @module providerAssistantService
 * @skill #57 - Provider Assistant
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base/ServiceResult';
import { auditLogger } from '../auditLogger';

// ============================================================================
// Types
// ============================================================================

export type ProviderRole = 'physician' | 'nurse' | 'care_coordinator' | 'pharmacist' | 'admin' | 'other';
export type QueryCategory = 'clinical' | 'medication' | 'documentation' | 'workflow' | 'patient_specific' | 'general';
export type UrgencyLevel = 'routine' | 'soon' | 'urgent' | 'stat';

export interface ProviderContext {
  role: ProviderRole;
  department?: string;
  specialization?: string;
}

export interface PatientContext {
  patientId?: string;
  conditions?: string[];
  medications?: string[];
  allergies?: string[];
  recentVitals?: Record<string, number>;
  age?: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface SuggestedAction {
  action: string;
  urgency: UrgencyLevel;
  rationale: string;
}

export interface AssistantRequest {
  query: string;
  providerId: string;
  providerContext: ProviderContext;
  patientContext?: PatientContext;
  conversationHistory?: ConversationMessage[];
  tenantId?: string;
}

export interface AssistantResponse {
  response: string;
  category: QueryCategory;
  confidence: number;
  sources?: string[];
  suggestedActions?: SuggestedAction[];
  relatedQueries?: string[];
  requiresPhysicianConfirmation: boolean;
  requiresEscalation: boolean;
  escalationReason?: string;
  disclaimers: string[];
  metadata: {
    generatedAt: string;
    responseTimeMs: number;
    model: string;
    queryCategory: QueryCategory;
  };
}

// ============================================================================
// Service
// ============================================================================

export const ProviderAssistantService = {
  /**
   * Send a query to the provider assistant
   */
  async query(
    request: AssistantRequest
  ): Promise<ServiceResult<AssistantResponse>> {
    try {
      const { query, providerId, providerContext, patientContext, conversationHistory, tenantId } = request;

      if (!query || !providerId || !providerContext) {
        return failure('VALIDATION_ERROR', 'Query, Provider ID, and Provider Context are required');
      }

      await auditLogger.info('PROVIDER_ASSISTANT_QUERY_STARTED', {
        providerId: providerId.substring(0, 8) + '...',
        role: providerContext.role,
        hasPatientContext: !!patientContext,
        category: 'CLINICAL',
      });

      const { data, error } = await supabase.functions.invoke('ai-provider-assistant', {
        body: {
          query,
          providerId,
          providerContext,
          patientContext,
          conversationHistory,
          tenantId,
        },
      });

      if (error) {
        await auditLogger.error('PROVIDER_ASSISTANT_QUERY_FAILED', error as Error, {
          providerId: providerId.substring(0, 8) + '...',
          category: 'CLINICAL',
        });
        return failure('AI_SERVICE_ERROR', error.message || 'Provider assistant query failed');
      }

      await auditLogger.info('PROVIDER_ASSISTANT_QUERY_COMPLETED', {
        providerId: providerId.substring(0, 8) + '...',
        queryCategory: data.category,
        requiresEscalation: data.requiresEscalation,
        category: 'CLINICAL',
      });

      return success(data as AssistantResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('PROVIDER_ASSISTANT_QUERY_ERROR', error, {
        category: 'CLINICAL',
      });
      return failure('UNKNOWN_ERROR', error.message);
    }
  },

  /**
   * Quick query without patient context
   */
  async quickQuery(
    query: string,
    providerId: string,
    role: ProviderRole
  ): Promise<ServiceResult<AssistantResponse>> {
    return this.query({
      query,
      providerId,
      providerContext: { role },
    });
  },

  /**
   * Query with patient context
   */
  async patientQuery(
    query: string,
    providerId: string,
    role: ProviderRole,
    patientContext: PatientContext
  ): Promise<ServiceResult<AssistantResponse>> {
    return this.query({
      query,
      providerId,
      providerContext: { role },
      patientContext,
    });
  },

  /**
   * Continue a conversation
   */
  async continueConversation(
    query: string,
    providerId: string,
    providerContext: ProviderContext,
    conversationHistory: ConversationMessage[]
  ): Promise<ServiceResult<AssistantResponse>> {
    return this.query({
      query,
      providerId,
      providerContext,
      conversationHistory,
    });
  },

  /**
   * Get role-specific greeting/capabilities
   */
  getRoleCapabilities(role: ProviderRole): {
    greeting: string;
    capabilities: string[];
    exampleQueries: string[];
  } {
    switch (role) {
      case 'physician':
        return {
          greeting: 'How can I assist with your clinical decision-making today?',
          capabilities: [
            'Clinical guidelines and evidence',
            'Differential diagnosis support',
            'Drug information and interactions',
            'Treatment options and protocols',
            'ICD-10/CPT coding assistance',
          ],
          exampleQueries: [
            'What are the current guidelines for hypertension management?',
            'Drug interactions between warfarin and NSAIDs?',
            'Differential for chest pain in a 45-year-old?',
          ],
        };

      case 'nurse':
        return {
          greeting: 'How can I help with patient care today?',
          capabilities: [
            'Assessment findings interpretation',
            'Care coordination tasks',
            'Patient education resources',
            'Medication administration guidance',
            'When to escalate to physician',
          ],
          exampleQueries: [
            'What are signs of deterioration in a post-op patient?',
            'Patient education for new diabetes diagnosis?',
            'When should I call the physician for abnormal vitals?',
          ],
        };

      case 'care_coordinator':
        return {
          greeting: 'How can I help with care coordination today?',
          capabilities: [
            'Discharge planning support',
            'Resource identification',
            'Insurance and authorization guidance',
            'Care transition planning',
            'Community resource referrals',
          ],
          exampleQueries: [
            'What DME is typically needed for hip replacement discharge?',
            'Home health referral criteria?',
            'SNF vs. home health - when to recommend each?',
          ],
        };

      case 'pharmacist':
        return {
          greeting: 'How can I assist with medication management?',
          capabilities: [
            'Drug interaction analysis',
            'Dosing adjustments',
            'Therapeutic alternatives',
            'Medication reconciliation support',
            'Patient counseling points',
          ],
          exampleQueries: [
            'Dosing for vancomycin in renal impairment?',
            'Therapeutic alternatives to ACE inhibitors?',
            'Key counseling points for anticoagulants?',
          ],
        };

      case 'admin':
        return {
          greeting: 'How can I help with your administrative tasks?',
          capabilities: [
            'Scheduling guidance',
            'Billing and coding questions',
            'Policy information',
            'Documentation requirements',
            'Workflow optimization',
          ],
          exampleQueries: [
            'What documentation is required for prior authorization?',
            'Scheduling guidelines for follow-up visits?',
            'How to handle appointment cancellations?',
          ],
        };

      default:
        return {
          greeting: 'How can I assist you today?',
          capabilities: [
            'General healthcare information',
            'Resource identification',
            'Workflow guidance',
          ],
          exampleQueries: [
            'What resources are available?',
            'Who should I contact for this issue?',
          ],
        };
    }
  },

  /**
   * Get color styling for query category
   */
  getCategoryStyle(category: QueryCategory): {
    bg: string;
    text: string;
    icon: string;
  } {
    switch (category) {
      case 'clinical':
        return { bg: 'bg-red-100', text: 'text-red-800', icon: '🩺' };
      case 'medication':
        return { bg: 'bg-purple-100', text: 'text-purple-800', icon: '💊' };
      case 'documentation':
        return { bg: 'bg-blue-100', text: 'text-blue-800', icon: '📝' };
      case 'workflow':
        return { bg: 'bg-green-100', text: 'text-green-800', icon: '📋' };
      case 'patient_specific':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '👤' };
      case 'general':
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', icon: '💬' };
    }
  },

  /**
   * Get category label
   */
  getCategoryLabel(category: QueryCategory): string {
    switch (category) {
      case 'clinical':
        return 'Clinical Question';
      case 'medication':
        return 'Medication Question';
      case 'documentation':
        return 'Documentation Question';
      case 'workflow':
        return 'Workflow Question';
      case 'patient_specific':
        return 'Patient-Specific Question';
      case 'general':
      default:
        return 'General Question';
    }
  },

  /**
   * Get urgency styling
   */
  getUrgencyStyle(urgency: UrgencyLevel): {
    bg: string;
    text: string;
    label: string;
  } {
    switch (urgency) {
      case 'stat':
        return { bg: 'bg-red-600', text: 'text-white', label: 'STAT' };
      case 'urgent':
        return { bg: 'bg-orange-500', text: 'text-white', label: 'Urgent' };
      case 'soon':
        return { bg: 'bg-yellow-500', text: 'text-black', label: 'Soon' };
      case 'routine':
      default:
        return { bg: 'bg-green-500', text: 'text-white', label: 'Routine' };
    }
  },

  /**
   * Get role display name
   */
  getRoleDisplayName(role: ProviderRole): string {
    switch (role) {
      case 'physician':
        return 'Physician';
      case 'nurse':
        return 'Nurse';
      case 'care_coordinator':
        return 'Care Coordinator';
      case 'pharmacist':
        return 'Pharmacist';
      case 'admin':
        return 'Administrative Staff';
      case 'other':
      default:
        return 'Healthcare Staff';
    }
  },

  /**
   * Format response with highlighting
   */
  formatResponse(response: AssistantResponse): {
    mainResponse: string;
    hasWarnings: boolean;
    warnings: string[];
    hasActions: boolean;
    actions: SuggestedAction[];
  } {
    const warnings: string[] = [];

    if (response.requiresEscalation) {
      warnings.push(response.escalationReason || 'This query requires escalation');
    }

    if (response.requiresPhysicianConfirmation) {
      warnings.push('Clinical recommendations require physician confirmation');
    }

    warnings.push(...response.disclaimers);

    return {
      mainResponse: response.response,
      hasWarnings: warnings.length > 0,
      warnings,
      hasActions: (response.suggestedActions?.length || 0) > 0,
      actions: response.suggestedActions || [],
    };
  },
};

export default ProviderAssistantService;
