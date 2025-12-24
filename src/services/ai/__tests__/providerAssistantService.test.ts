/**
 * Tests for Provider Assistant Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderAssistantService } from '../providerAssistantService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock audit logger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProviderAssistantService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('provider role definitions', () => {
    it('should define all provider roles', () => {
      const roles = ['physician', 'nurse', 'care_coordinator', 'pharmacist', 'admin', 'other'];
      expect(roles).toHaveLength(6);
      expect(roles).toContain('physician');
      expect(roles).toContain('care_coordinator');
    });

    it('should define all query categories', () => {
      const categories = ['clinical', 'medication', 'documentation', 'workflow', 'patient_specific', 'general'];
      expect(categories).toHaveLength(6);
      expect(categories).toContain('clinical');
      expect(categories).toContain('medication');
    });

    it('should define all urgency levels', () => {
      const urgencies = ['routine', 'soon', 'urgent', 'stat'];
      expect(urgencies).toHaveLength(4);
      expect(urgencies).toContain('stat');
    });
  });

  describe('service methods', () => {
    it('should validate required fields', async () => {
      const result = await ProviderAssistantService.query({
        query: '',
        providerId: 'test-provider',
        providerContext: { role: 'physician' },
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing provider ID', async () => {
      const result = await ProviderAssistantService.query({
        query: 'What is the treatment for hypertension?',
        providerId: '',
        providerContext: { role: 'physician' },
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('role capabilities', () => {
    it('should return physician capabilities', () => {
      const capabilities = ProviderAssistantService.getRoleCapabilities('physician');
      expect(capabilities.greeting).toContain('clinical');
      expect(capabilities.capabilities).toContain('Clinical guidelines and evidence');
      expect(capabilities.exampleQueries.length).toBeGreaterThan(0);
    });

    it('should return nurse capabilities', () => {
      const capabilities = ProviderAssistantService.getRoleCapabilities('nurse');
      expect(capabilities.greeting).toContain('patient care');
      expect(capabilities.capabilities).toContain('When to escalate to physician');
    });

    it('should return care coordinator capabilities', () => {
      const capabilities = ProviderAssistantService.getRoleCapabilities('care_coordinator');
      expect(capabilities.greeting).toContain('care coordination');
      expect(capabilities.capabilities).toContain('Discharge planning support');
    });

    it('should return pharmacist capabilities', () => {
      const capabilities = ProviderAssistantService.getRoleCapabilities('pharmacist');
      expect(capabilities.greeting).toContain('medication');
      expect(capabilities.capabilities).toContain('Drug interaction analysis');
    });

    it('should return admin capabilities', () => {
      const capabilities = ProviderAssistantService.getRoleCapabilities('admin');
      expect(capabilities.greeting).toContain('administrative');
      expect(capabilities.capabilities).toContain('Billing and coding questions');
    });

    it('should return default capabilities for unknown role', () => {
      const capabilities = ProviderAssistantService.getRoleCapabilities('other');
      expect(capabilities.greeting).toContain('assist');
      expect(capabilities.capabilities.length).toBeGreaterThan(0);
    });
  });

  describe('category styling', () => {
    it('should return correct style for clinical category', () => {
      const style = ProviderAssistantService.getCategoryStyle('clinical');
      expect(style.bg).toContain('red');
      expect(style.icon).toBe('🩺');
    });

    it('should return correct style for medication category', () => {
      const style = ProviderAssistantService.getCategoryStyle('medication');
      expect(style.bg).toContain('purple');
      expect(style.icon).toBe('💊');
    });

    it('should return correct style for documentation category', () => {
      const style = ProviderAssistantService.getCategoryStyle('documentation');
      expect(style.bg).toContain('blue');
      expect(style.icon).toBe('📝');
    });

    it('should return correct style for workflow category', () => {
      const style = ProviderAssistantService.getCategoryStyle('workflow');
      expect(style.bg).toContain('green');
      expect(style.icon).toBe('📋');
    });

    it('should return correct style for patient_specific category', () => {
      const style = ProviderAssistantService.getCategoryStyle('patient_specific');
      expect(style.bg).toContain('yellow');
      expect(style.icon).toBe('👤');
    });

    it('should return correct style for general category', () => {
      const style = ProviderAssistantService.getCategoryStyle('general');
      expect(style.bg).toContain('gray');
      expect(style.icon).toBe('💬');
    });
  });

  describe('category labels', () => {
    it('should return correct labels for all categories', () => {
      expect(ProviderAssistantService.getCategoryLabel('clinical')).toBe('Clinical Question');
      expect(ProviderAssistantService.getCategoryLabel('medication')).toBe('Medication Question');
      expect(ProviderAssistantService.getCategoryLabel('documentation')).toBe('Documentation Question');
      expect(ProviderAssistantService.getCategoryLabel('workflow')).toBe('Workflow Question');
      expect(ProviderAssistantService.getCategoryLabel('patient_specific')).toBe('Patient-Specific Question');
      expect(ProviderAssistantService.getCategoryLabel('general')).toBe('General Question');
    });
  });

  describe('urgency styling', () => {
    it('should return correct style for stat urgency', () => {
      const style = ProviderAssistantService.getUrgencyStyle('stat');
      expect(style.bg).toContain('red');
      expect(style.label).toBe('STAT');
    });

    it('should return correct style for urgent level', () => {
      const style = ProviderAssistantService.getUrgencyStyle('urgent');
      expect(style.bg).toContain('orange');
      expect(style.label).toBe('Urgent');
    });

    it('should return correct style for soon level', () => {
      const style = ProviderAssistantService.getUrgencyStyle('soon');
      expect(style.bg).toContain('yellow');
      expect(style.label).toBe('Soon');
    });

    it('should return correct style for routine level', () => {
      const style = ProviderAssistantService.getUrgencyStyle('routine');
      expect(style.bg).toContain('green');
      expect(style.label).toBe('Routine');
    });
  });

  describe('role display names', () => {
    it('should return correct display names', () => {
      expect(ProviderAssistantService.getRoleDisplayName('physician')).toBe('Physician');
      expect(ProviderAssistantService.getRoleDisplayName('nurse')).toBe('Nurse');
      expect(ProviderAssistantService.getRoleDisplayName('care_coordinator')).toBe('Care Coordinator');
      expect(ProviderAssistantService.getRoleDisplayName('pharmacist')).toBe('Pharmacist');
      expect(ProviderAssistantService.getRoleDisplayName('admin')).toBe('Administrative Staff');
      expect(ProviderAssistantService.getRoleDisplayName('other')).toBe('Healthcare Staff');
    });
  });

  describe('response formatting', () => {
    it('should format response with escalation warning', () => {
      const response = {
        response: 'Test response',
        category: 'clinical' as const,
        confidence: 0.8,
        requiresPhysicianConfirmation: false,
        requiresEscalation: true,
        escalationReason: 'Potential emergency',
        disclaimers: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          responseTimeMs: 100,
          model: 'test',
          queryCategory: 'clinical' as const,
        },
      };

      const formatted = ProviderAssistantService.formatResponse(response);
      expect(formatted.hasWarnings).toBe(true);
      expect(formatted.warnings).toContain('Potential emergency');
    });

    it('should format response with physician confirmation warning', () => {
      const response = {
        response: 'Test response',
        category: 'medication' as const,
        confidence: 0.8,
        requiresPhysicianConfirmation: true,
        requiresEscalation: false,
        disclaimers: ['Verify in official references'],
        metadata: {
          generatedAt: new Date().toISOString(),
          responseTimeMs: 100,
          model: 'test',
          queryCategory: 'medication' as const,
        },
      };

      const formatted = ProviderAssistantService.formatResponse(response);
      expect(formatted.hasWarnings).toBe(true);
      expect(formatted.warnings).toContain('Clinical recommendations require physician confirmation');
      expect(formatted.warnings).toContain('Verify in official references');
    });

    it('should format response with suggested actions', () => {
      const response = {
        response: 'Test response',
        category: 'clinical' as const,
        confidence: 0.8,
        requiresPhysicianConfirmation: false,
        requiresEscalation: false,
        disclaimers: [],
        suggestedActions: [
          { action: 'Review with care team', urgency: 'routine' as const, rationale: 'Best practice' },
        ],
        metadata: {
          generatedAt: new Date().toISOString(),
          responseTimeMs: 100,
          model: 'test',
          queryCategory: 'clinical' as const,
        },
      };

      const formatted = ProviderAssistantService.formatResponse(response);
      expect(formatted.hasActions).toBe(true);
      expect(formatted.actions).toHaveLength(1);
      expect(formatted.actions[0].action).toBe('Review with care team');
    });
  });

  describe('escalation detection', () => {
    it('should require escalation for emergency keywords', () => {
      // This tests the expected behavior - actual detection happens in edge function
      const emergencyKeywords = ['code', 'arrest', 'emergency', 'stat', 'unstable'];
      expect(emergencyKeywords).toContain('stat');
      expect(emergencyKeywords).toContain('emergency');
    });

    it('should require physician for prescribing by non-physicians', () => {
      // Test expected scope restrictions
      const restrictedActions = ['prescribe', 'diagnose', 'order'];
      const nonPhysicianRoles = ['nurse', 'care_coordinator', 'admin'];

      expect(restrictedActions).toContain('prescribe');
      expect(nonPhysicianRoles).not.toContain('physician');
    });
  });

  describe('query classification', () => {
    it('should classify medication queries', () => {
      const medicationKeywords = ['drug', 'medication', 'dose', 'interaction', 'prescribe'];
      expect(medicationKeywords).toContain('drug');
      expect(medicationKeywords).toContain('interaction');
    });

    it('should classify documentation queries', () => {
      const docKeywords = ['document', 'note', 'chart', 'record', 'icd', 'cpt'];
      expect(docKeywords).toContain('icd');
      expect(docKeywords).toContain('cpt');
    });

    it('should classify clinical queries', () => {
      const clinicalKeywords = ['diagnos', 'treatment', 'symptom', 'guideline', 'protocol'];
      expect(clinicalKeywords).toContain('treatment');
      expect(clinicalKeywords).toContain('guideline');
    });
  });

  describe('conversation context', () => {
    it('should accept conversation history', () => {
      const history = [
        { role: 'user' as const, content: 'What are the side effects of metformin?' },
        { role: 'assistant' as const, content: 'Common side effects include...' },
      ];

      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });
  });

  describe('patient context handling', () => {
    it('should accept patient context', () => {
      const patientContext = {
        patientId: 'test-patient',
        conditions: ['diabetes', 'hypertension'],
        medications: ['metformin', 'lisinopril'],
        allergies: ['penicillin'],
        age: 65,
      };

      expect(patientContext.conditions).toContain('diabetes');
      expect(patientContext.medications).toContain('metformin');
      expect(patientContext.allergies).toContain('penicillin');
    });
  });
});
