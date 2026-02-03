/**
 * FamilyEmergencyInfoPanel Test Suite
 *
 * Tests for the family portal emergency information panel.
 * Law Enforcement Vertical - The SHIELD Program welfare check system.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FamilyEmergencyInfoPanel } from '../FamilyEmergencyInfoPanel';
import type { EmergencyResponseInfo } from '../../../types/lawEnforcement';

// Mock the LawEnforcementService
const mockGetEmergencyResponseInfo = vi.fn();
const mockUpsertEmergencyResponseInfo = vi.fn();

vi.mock('../../../services/lawEnforcementService', () => ({
  LawEnforcementService: {
    getEmergencyResponseInfo: (...args: unknown[]) => mockGetEmergencyResponseInfo(...args),
    upsertEmergencyResponseInfo: (...args: unknown[]) => mockUpsertEmergencyResponseInfo(...args),
  },
}));

// Sample emergency response info for testing
const mockEmergencyInfo: EmergencyResponseInfo = {
  id: 'test-id-123',
  tenantId: 'tenant-123',
  patientId: 'patient-123',
  bedBound: false,
  wheelchairBound: true,
  walkerRequired: false,
  caneRequired: false,
  mobilityNotes: 'Uses electric wheelchair',
  oxygenDependent: false,
  oxygenTankLocation: '',
  dialysisRequired: false,
  dialysisSchedule: '',
  medicalEquipment: [],
  hearingImpaired: false,
  hearingImpairedNotes: '',
  visionImpaired: false,
  visionImpairedNotes: '',
  cognitiveImpairment: false,
  cognitiveImpairmentType: '',
  cognitiveImpairmentNotes: '',
  nonVerbal: false,
  languageBarrier: '',
  floorNumber: '1',
  buildingQuadrant: '',
  elevatorRequired: false,
  elevatorAccessCode: '',
  buildingType: 'Single Family Home',
  stairsToUnit: 0,
  doorCode: '',
  keyLocation: 'Under mat',
  accessInstructions: '',
  doorOpensInward: true,
  securitySystem: false,
  securitySystemCode: '',
  petsInHome: '1 friendly dog',
  parkingInstructions: 'Driveway',
  gatedCommunityCode: '',
  lobbyAccessInstructions: '',
  bestEntrance: 'Front',
  intercomInstructions: '',
  fallRiskHigh: false,
  fallHistory: '',
  homeHazards: '',
  neighborName: 'John Smith',
  neighborAddress: '124 Main St',
  neighborPhone: '555-1234',
  buildingManagerName: '',
  buildingManagerPhone: '',
  responsePriority: 'standard',
  escalationDelayHours: 6,
  specialInstructions: '',
  criticalMedications: [],
  medicationLocation: '',
  medicalConditionsSummary: '',
  consentObtained: true,
  consentDate: '2025-01-15',
  consentGivenBy: 'Self',
  hipaaAuthorization: true,
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-01-15T10:00:00Z',
};

describe('FamilyEmergencyInfoPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEmergencyResponseInfo.mockResolvedValue(mockEmergencyInfo);
    mockUpsertEmergencyResponseInfo.mockResolvedValue(mockEmergencyInfo);
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      expect(screen.getByRole('heading', { level: 2, name: 'Emergency Response Information' })).toBeInTheDocument();
    });

    it('should display patient name in description', () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      expect(screen.getByText(/For Grandma Ruth/)).toBeInTheDocument();
    });

    it('should render Update Information button initially', () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      expect(screen.getByRole('button', { name: /Update Information/i })).toBeInTheDocument();
    });

    it('should render educational info box', () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      expect(screen.getByText('Why is this important?')).toBeInTheDocument();
    });

    it('should display importance list items', () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      expect(screen.getByText(/Helps constables respond safely/i)).toBeInTheDocument();
      expect(screen.getByText(/Provides critical medical information/i)).toBeInTheDocument();
      expect(screen.getByText(/Enables faster entry/i)).toBeInTheDocument();
      expect(screen.getByText(/Keeps family contacts current/i)).toBeInTheDocument();
    });

    it('should render the emergency info form', () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      // The embedded form should be present
      expect(screen.getByText('Mobility Status')).toBeInTheDocument();
    });
  });

  describe('View Mode', () => {
    it('should start in view mode (read-only)', () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      // Checkboxes should be disabled
      const bedBoundCheckbox = screen.getByRole('checkbox', { name: /Bed-bound or bedridden/i });
      expect(bedBoundCheckbox).toBeDisabled();
    });

    it('should not show Cancel button in view mode', () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('should enter edit mode when Update Information is clicked', async () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      const updateButton = screen.getByRole('button', { name: /Update Information/i });
      await userEvent.click(updateButton);

      // Checkboxes should now be enabled
      const bedBoundCheckbox = screen.getByRole('checkbox', { name: /Bed-bound or bedridden/i });
      expect(bedBoundCheckbox).not.toBeDisabled();
    });

    it('should hide Update Information button in edit mode', async () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      const updateButton = screen.getByRole('button', { name: /Update Information/i });
      await userEvent.click(updateButton);

      expect(screen.queryByRole('button', { name: /Update Information/i })).not.toBeInTheDocument();
    });

    it('should show Cancel button in edit mode', async () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      const updateButton = screen.getByRole('button', { name: /Update Information/i });
      await userEvent.click(updateButton);

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('should show Save button in edit mode', async () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      const updateButton = screen.getByRole('button', { name: /Update Information/i });
      await userEvent.click(updateButton);

      expect(screen.getByRole('button', { name: /Save Emergency Information/i })).toBeInTheDocument();
    });

    it('should allow editing form fields in edit mode', async () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      const updateButton = screen.getByRole('button', { name: /Update Information/i });
      await userEvent.click(updateButton);

      const bedBoundCheckbox = screen.getByRole('checkbox', { name: /Bed-bound or bedridden/i });
      await userEvent.click(bedBoundCheckbox);

      expect(bedBoundCheckbox).toBeChecked();
    });
  });

  describe('Cancel Editing', () => {
    it('should return to view mode when Cancel is clicked', async () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      // Enter edit mode
      const updateButton = screen.getByRole('button', { name: /Update Information/i });
      await userEvent.click(updateButton);

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await userEvent.click(cancelButton);

      // Should be back in view mode
      const bedBoundCheckbox = screen.getByRole('checkbox', { name: /Bed-bound or bedridden/i });
      expect(bedBoundCheckbox).toBeDisabled();
    });

    it('should show Update Information button again after cancel', async () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      // Enter edit mode
      const updateButton = screen.getByRole('button', { name: /Update Information/i });
      await userEvent.click(updateButton);

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await userEvent.click(cancelButton);

      // Update button should be visible again
      expect(screen.getByRole('button', { name: /Update Information/i })).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('should return to view mode after successful save', async () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      // Wait for existing data to load (mock has consentObtained: true)
      await waitFor(() => {
        expect(mockGetEmergencyResponseInfo).toHaveBeenCalledWith('patient-123');
      });

      // Enter edit mode
      const updateButton = screen.getByRole('button', { name: /Update Information/i });
      await userEvent.click(updateButton);

      // Ensure consent is checked - after data load, consentObtained should be true
      // If not checked, click to check it
      const consentCheckbox = screen.getByRole('checkbox', { name: /I consent/i }) as HTMLInputElement;
      if (!consentCheckbox.checked) {
        await userEvent.click(consentCheckbox);
      }

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Emergency Information/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        // Should be back in view mode
        expect(screen.getByRole('button', { name: /Update Information/i })).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('should load emergency info for the patient', async () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      await waitFor(() => {
        expect(mockGetEmergencyResponseInfo).toHaveBeenCalledWith('patient-123');
      });
    });

    it('should display loaded data in the form', async () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      await waitFor(() => {
        const wheelchairCheckbox = screen.getByRole('checkbox', { name: /Wheelchair user/i });
        expect(wheelchairCheckbox).toBeChecked();
      });
    });
  });

  describe('Help Text', () => {
    it('should display helper text about keeping info current', () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      expect(screen.getByText(/Keep this information current/i)).toBeInTheDocument();
    });
  });

  describe('Panel Styling', () => {
    it('should have white background with shadow', () => {
      const { container } = render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      const panel = container.firstChild as HTMLElement;
      expect(panel).toHaveClass('bg-white');
      expect(panel).toHaveClass('rounded-lg');
      expect(panel).toHaveClass('shadow-sm');
    });
  });

  describe('Integration with SeniorEmergencyInfoForm', () => {
    it('should pass patientId to embedded form', async () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      await waitFor(() => {
        // The form should have loaded data for the correct patient
        expect(mockGetEmergencyResponseInfo).toHaveBeenCalledWith('patient-123');
      });
    });

    it('should pass readOnly prop based on editing state', async () => {
      render(
        <FamilyEmergencyInfoPanel
          patientId="patient-123"
          patientName="Grandma Ruth"
        />
      );

      // Initially read-only
      let checkbox = screen.getByRole('checkbox', { name: /Bed-bound or bedridden/i });
      expect(checkbox).toBeDisabled();

      // Enter edit mode
      const updateButton = screen.getByRole('button', { name: /Update Information/i });
      await userEvent.click(updateButton);

      // Now editable
      checkbox = screen.getByRole('checkbox', { name: /Bed-bound or bedridden/i });
      expect(checkbox).not.toBeDisabled();
    });
  });
});
