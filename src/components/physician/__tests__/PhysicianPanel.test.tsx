/**
 * Tests for PhysicianPanel Component
 *
 * Purpose: Main physician dashboard with clinical tools and patient management
 * Tests: Component exports and basic structure
 *
 * Note: Full rendering tests are deferred due to complex dependency chain.
 * The component requires PatientContext, react-router-dom, and many child components.
 */

import React from 'react';

// Need to mock before import
vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        or: vi.fn(() => Promise.resolve({ count: 10 })),
      })),
    })),
  })),
}));

vi.mock('../../../contexts/PatientContext', () => ({
  usePatientContext: vi.fn(() => ({
    selectPatient: vi.fn(),
    selectedPatient: null,
  })),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

import PhysicianPanel from '../PhysicianPanel';

describe('PhysicianPanel', () => {
  describe('Module Exports', () => {
    it('should export PhysicianPanel as default', () => {
      expect(PhysicianPanel).toBeDefined();
      expect(typeof PhysicianPanel).toBe('function');
    });

    it('should be a React functional component', () => {
      // Functional components have a name property
      expect(PhysicianPanel.name).toBe('PhysicianPanel');
    });
  });

  describe('Component Definition', () => {
    it('should be a valid React component', () => {
      expect(typeof PhysicianPanel).toBe('function');
    });
  });

  // Note: Full rendering tests require extensive mocking of:
  // - PatientContext (selectPatient, selectedPatient)
  // - AuthContext (useSupabaseClient)
  // - react-router-dom (useNavigate)
  // - FHIRService (Observation, Condition, MedicationRequest)
  // - SDOHBillingService
  // - Multiple child components:
  //   - AdminHeader
  //   - WorkflowModeSwitcher
  //   - CommandPalette
  //   - PatientSelector
  //   - PatientSummaryCard
  //   - SmartScribe (RealTimeSmartScribe)
  //   - TelehealthScheduler
  //   - TelehealthConsultation (lazy-loaded)
  //   - ClaudeCareAssistantPanel
  //   - PhysicianWellnessHub
  //   - UserQuestions
  //   - RiskAssessmentManager
  //   - CCMTimeline
  //   - ReportsSection
  //   - PhysicianClinicalResources
  //   - CHWAlertsWidget
  //   - PersonalizedGreeting, DashboardPersonalizationIndicator, VoiceProfileMaturity
  //
  // Full integration tests are better suited for E2E testing with Playwright/Cypress.
});
