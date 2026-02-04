/**
 * SeniorEmergencyInfoForm Test Suite
 *
 * Tests for the senior emergency information collection form.
 * Law Enforcement Vertical - The SHIELD Program welfare check system.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SeniorEmergencyInfoForm } from '../SeniorEmergencyInfoForm';
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
  oxygenDependent: true,
  oxygenTankLocation: 'Bedroom nightstand',
  dialysisRequired: false,
  dialysisSchedule: '',
  medicalEquipment: ['CPAP', 'Blood pressure monitor'],
  hearingImpaired: true,
  hearingImpairedNotes: 'Wears hearing aids',
  visionImpaired: false,
  visionImpairedNotes: '',
  cognitiveImpairment: false,
  cognitiveImpairmentType: '',
  cognitiveImpairmentNotes: '',
  nonVerbal: false,
  languageBarrier: '',
  floorNumber: '2',
  buildingQuadrant: 'Northeast wing',
  elevatorRequired: true,
  elevatorAccessCode: '4567',
  buildingType: 'Apartment',
  stairsToUnit: 0,
  doorCode: '1234',
  keyLocation: 'Under mat',
  accessInstructions: 'Ring buzzer 3 times',
  doorOpensInward: true,
  securitySystem: true,
  securitySystemCode: '9876',
  petsInHome: '1 cat - friendly',
  parkingInstructions: 'Visitor lot B',
  gatedCommunityCode: '#5678',
  lobbyAccessInstructions: 'Ask front desk',
  bestEntrance: 'Front',
  intercomInstructions: 'Press #302',
  fallRiskHigh: true,
  fallHistory: '2 falls in past year',
  homeHazards: 'Loose rug in hallway',
  neighborName: 'John Smith',
  neighborAddress: 'Apt 4B',
  neighborPhone: '555-1234',
  buildingManagerName: 'Jane Doe',
  buildingManagerPhone: '555-5678',
  responsePriority: 'high',
  escalationDelayHours: 4,
  specialInstructions: 'Senior may be slow to answer door',
  criticalMedications: ['Insulin', 'Blood thinners'],
  medicationLocation: 'Kitchen cabinet',
  medicalConditionsSummary: 'Diabetes, heart condition',
  consentObtained: true,
  consentDate: '2025-01-15',
  consentGivenBy: 'Self',
  hipaaAuthorization: true,
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-01-15T10:00:00Z',
};

describe('SeniorEmergencyInfoForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEmergencyResponseInfo.mockResolvedValue(null);
    mockUpsertEmergencyResponseInfo.mockResolvedValue(mockEmergencyInfo);
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      expect(screen.getByText('Emergency Response Information')).toBeInTheDocument();
    });

    it('should render all form sections', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      expect(screen.getByText('Mobility Status')).toBeInTheDocument();
      expect(screen.getByText('Medical Equipment')).toBeInTheDocument();
      expect(screen.getByText('Communication Needs')).toBeInTheDocument();
      expect(screen.getByText('Building Location')).toBeInTheDocument();
      expect(screen.getByText('Emergency Access Information')).toBeInTheDocument();
      expect(screen.getByText('Response Priority')).toBeInTheDocument();
      expect(screen.getByText('Consent & Authorization')).toBeInTheDocument();
    });

    it('should render mobility checkboxes', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      expect(screen.getByText('Bed-bound or bedridden')).toBeInTheDocument();
      expect(screen.getByText('Wheelchair user')).toBeInTheDocument();
      expect(screen.getByText('Requires walker')).toBeInTheDocument();
      expect(screen.getByText('Requires cane')).toBeInTheDocument();
    });

    it('should render medical equipment checkboxes', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      expect(screen.getByText('Requires oxygen')).toBeInTheDocument();
      expect(screen.getByText('Requires dialysis')).toBeInTheDocument();
    });

    it('should render communication needs checkboxes', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      expect(screen.getByText('Hearing impaired')).toBeInTheDocument();
      expect(screen.getByText(/Cognitive impairment/)).toBeInTheDocument();
    });

    it('should render submit button in edit mode', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      expect(screen.getByRole('button', { name: /Save Emergency Information/i })).toBeInTheDocument();
    });

    it('should not render submit button in read-only mode', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" readOnly />);

      expect(screen.queryByRole('button', { name: /Save Emergency Information/i })).not.toBeInTheDocument();
    });
  });

  describe('Loading Existing Data', () => {
    it('should load existing emergency info on mount', async () => {
      mockGetEmergencyResponseInfo.mockResolvedValue(mockEmergencyInfo);

      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      await waitFor(() => {
        expect(mockGetEmergencyResponseInfo).toHaveBeenCalledWith('patient-123');
      });
    });

    it('should populate form with existing data', async () => {
      mockGetEmergencyResponseInfo.mockResolvedValue(mockEmergencyInfo);

      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // First wait for the async service call to complete
      await waitFor(() => {
        expect(mockGetEmergencyResponseInfo).toHaveBeenCalledWith('patient-123');
      });

      // Then wait for React to flush the state update from the async effect
      await waitFor(
        () => {
          const wheelchairCheckbox = screen.getByRole('checkbox', { name: /Wheelchair user/i });
          expect(wheelchairCheckbox).toBeChecked();
        },
        { timeout: 3000 }
      );
    });

    it('should handle no existing data gracefully', async () => {
      mockGetEmergencyResponseInfo.mockResolvedValue(null);

      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      await waitFor(() => {
        expect(mockGetEmergencyResponseInfo).toHaveBeenCalled();
      });

      // Form should render with default values
      const bedBoundCheckbox = screen.getByRole('checkbox', { name: /Bed-bound or bedridden/i });
      expect(bedBoundCheckbox).not.toBeChecked();
    });
  });

  describe('Form Interaction', () => {
    it('should update checkbox state when clicked', async () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      const bedBoundCheckbox = screen.getByRole('checkbox', { name: /Bed-bound or bedridden/i });
      expect(bedBoundCheckbox).not.toBeChecked();

      await userEvent.click(bedBoundCheckbox);

      expect(bedBoundCheckbox).toBeChecked();
    });

    it('should disable inputs in read-only mode', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" readOnly />);

      const bedBoundCheckbox = screen.getByRole('checkbox', { name: /Bed-bound or bedridden/i });
      expect(bedBoundCheckbox).toBeDisabled();
    });

    it('should show oxygen tank location field when oxygen dependent is checked', async () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // Initially not visible
      expect(screen.queryByPlaceholderText(/Bedroom nightstand/i)).not.toBeInTheDocument();

      // Check oxygen dependent
      const oxygenCheckbox = screen.getByRole('checkbox', { name: /Requires oxygen/i });
      await userEvent.click(oxygenCheckbox);

      // Now visible
      expect(screen.getByPlaceholderText(/Bedroom nightstand/i)).toBeInTheDocument();
    });

    it('should show dialysis schedule field when dialysis required is checked', async () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // Initially not visible
      expect(screen.queryByPlaceholderText(/Monday\/Wednesday\/Friday/i)).not.toBeInTheDocument();

      // Check dialysis required
      const dialysisCheckbox = screen.getByRole('checkbox', { name: /Requires dialysis/i });
      await userEvent.click(dialysisCheckbox);

      // Now visible
      expect(screen.getByPlaceholderText(/Monday\/Wednesday\/Friday/i)).toBeInTheDocument();
    });

    it('should show hearing impaired notes when hearing impaired is checked', async () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // Check hearing impaired
      const hearingCheckbox = screen.getByRole('checkbox', { name: /Hearing impaired/i });
      await userEvent.click(hearingCheckbox);

      // Notes field should appear
      expect(screen.getByPlaceholderText(/Knock loudly/i)).toBeInTheDocument();
    });

    it('should show cognitive impairment fields when checked', async () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // Check cognitive impairment
      const cognitiveCheckbox = screen.getByRole('checkbox', { name: /Cognitive impairment/i });
      await userEvent.click(cognitiveCheckbox);

      // Type and notes fields should appear
      expect(screen.getByPlaceholderText(/Alzheimer's, Dementia, TBI/i)).toBeInTheDocument();
    });

    it('should show elevator access code field when elevator required is checked', async () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // Check elevator required
      const elevatorCheckbox = screen.getByRole('checkbox', { name: /Elevator required/i });
      await userEvent.click(elevatorCheckbox);

      // Access code field should appear
      expect(screen.getByPlaceholderText(/Code 4567/i)).toBeInTheDocument();
    });
  });

  describe('Priority Selection', () => {
    it('should render priority dropdown', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // Multiple comboboxes exist - just verify we have selects
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });

    it('should have standard, high, and critical options', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // Check that priority options exist in the form
      expect(screen.getByRole('option', { name: /Standard \(6\+ hours\)/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /High \(4 hours\)/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Critical \(2 hours\)/i })).toBeInTheDocument();
    });
  });

  describe('Consent Validation', () => {
    it('should not call service when consent is not obtained', async () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // Form has required attribute on consent checkbox for browser validation
      // Additionally, the handleSubmit validates consent
      const submitButton = screen.getByRole('button', { name: /Save Emergency Information/i });

      // Attempt to submit without consent
      await userEvent.click(submitButton);

      // Service should NOT be called since consent is required
      await waitFor(() => {
        expect(mockUpsertEmergencyResponseInfo).not.toHaveBeenCalled();
      });
    });

    it('should not show error when consent is obtained', async () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // Check consent
      const consentCheckbox = screen.getByRole('checkbox', { name: /I consent/i });
      await userEvent.click(consentCheckbox);

      const submitButton = screen.getByRole('button', { name: /Save Emergency Information/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText(/Consent is required/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call upsert service on valid submission', async () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // Check consent (required)
      const consentCheckbox = screen.getByRole('checkbox', { name: /I consent/i });
      await userEvent.click(consentCheckbox);

      const submitButton = screen.getByRole('button', { name: /Save Emergency Information/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockUpsertEmergencyResponseInfo).toHaveBeenCalledWith(
          'patient-123',
          expect.objectContaining({ consentObtained: true })
        );
      });
    });

    it('should call onSave callback after successful submission', async () => {
      const mockOnSave = vi.fn();
      render(<SeniorEmergencyInfoForm patientId="patient-123" onSave={mockOnSave} />);

      // Check consent
      const consentCheckbox = screen.getByRole('checkbox', { name: /I consent/i });
      await userEvent.click(consentCheckbox);

      const submitButton = screen.getByRole('button', { name: /Save Emergency Information/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });
    });

    it('should show saving state during submission', async () => {
      mockUpsertEmergencyResponseInfo.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockEmergencyInfo), 100))
      );

      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // Check consent
      const consentCheckbox = screen.getByRole('checkbox', { name: /I consent/i });
      await userEvent.click(consentCheckbox);

      const submitButton = screen.getByRole('button', { name: /Save Emergency Information/i });
      await userEvent.click(submitButton);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should show error message on submission failure', async () => {
      mockUpsertEmergencyResponseInfo.mockRejectedValue(new Error('Network error'));

      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // Check consent
      const consentCheckbox = screen.getByRole('checkbox', { name: /I consent/i });
      await userEvent.click(consentCheckbox);

      const submitButton = screen.getByRole('button', { name: /Save Emergency Information/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to save emergency information/i)).toBeInTheDocument();
      });
    });

    it('should not submit in read-only mode', async () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" readOnly />);

      // Attempt to submit via form (though button is hidden)
      const form = document.querySelector('form');
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(mockUpsertEmergencyResponseInfo).not.toHaveBeenCalled();
      });
    });
  });

  describe('Building Type Selection', () => {
    it('should render building type dropdown', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // Find the label text and verify comboboxes exist
      expect(screen.getByText('Building type')).toBeInTheDocument();
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });

    it('should have expected building type options', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      expect(screen.getByRole('option', { name: 'Single Family Home' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Apartment' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Assisted Living' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Senior Housing' })).toBeInTheDocument();
    });
  });

  describe('Best Entrance Selection', () => {
    it('should render best entrance dropdown', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // Find the label text and verify select elements exist
      expect(screen.getByText(/Best entrance/i)).toBeInTheDocument();
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(1); // Multiple selects in form
    });

    it('should have expected entrance options', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      expect(screen.getByRole('option', { name: 'Front entrance' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Side entrance' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Rear entrance' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Garage' })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have visible form section labels', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      // Check section headings are present
      expect(screen.getByText('Building type')).toBeInTheDocument();
      expect(screen.getByText(/Floor number/i)).toBeInTheDocument();
      expect(screen.getByText(/Key location/i)).toBeInTheDocument();
      expect(screen.getByText(/Priority level/i)).toBeInTheDocument();
    });

    it('should have descriptive help text', () => {
      render(<SeniorEmergencyInfoForm patientId="patient-123" />);

      expect(screen.getByText(/helps first responders/i)).toBeInTheDocument();
      expect(screen.getByText(/How quickly constables should respond/i)).toBeInTheDocument();
    });
  });
});
