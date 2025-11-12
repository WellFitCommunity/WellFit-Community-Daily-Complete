/**
 * Senior Emergency Info Form Tests
 * Tests for emergency response information collection form
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SeniorEmergencyInfoForm } from '../SeniorEmergencyInfoForm';
import { LawEnforcementService } from '../../../services/lawEnforcementService';

// Mock the service
jest.mock('../../../services/lawEnforcementService', () => ({
  LawEnforcementService: {
    getEmergencyResponseInfo: jest.fn(),
    upsertEmergencyResponseInfo: jest.fn()
  }
}));

describe('SeniorEmergencyInfoForm', () => {
  const mockPatientId = 'patient-123';
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (LawEnforcementService.getEmergencyResponseInfo as jest.Mock).mockResolvedValue(null);
  });

  describe('Rendering', () => {
    it('should render all major form sections', () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      expect(screen.getByText(/Emergency Response Information/i)).toBeInTheDocument();
      expect(screen.getByText(/Mobility Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Medical Equipment/i)).toBeInTheDocument();
      expect(screen.getByText(/Communication Needs/i)).toBeInTheDocument();
      expect(screen.getByText(/Emergency Access Information/i)).toBeInTheDocument();
      expect(screen.getByText(/Response Priority/i)).toBeInTheDocument();
      expect(screen.getByText(/Consent & Authorization/i)).toBeInTheDocument();
    });

    it('should render all mobility checkboxes', () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      expect(screen.getByLabelText(/Bed-bound or bedridden/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Wheelchair user/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Requires walker/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Requires cane/i)).toBeInTheDocument();
    });

    it('should render medical equipment checkboxes', () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      expect(screen.getByLabelText(/Requires oxygen/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Requires dialysis/i)).toBeInTheDocument();
    });

    it('should render communication checkboxes', () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      expect(screen.getByLabelText(/Hearing impaired/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Cognitive impairment/i)).toBeInTheDocument();
    });

    it('should render consent checkboxes', () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      expect(screen.getByText(/I consent/i)).toBeInTheDocument();
      expect(screen.getByText(/HIPAA authorization/i)).toBeInTheDocument();
    });

    it('should show save button when not in read-only mode', () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);
      expect(screen.getByText(/Save Emergency Information/i)).toBeInTheDocument();
    });

    it('should hide save button in read-only mode', () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} readOnly={true} />);
      expect(screen.queryByText(/Save Emergency Information/i)).not.toBeInTheDocument();
    });
  });

  describe('Conditional Fields', () => {
    it('should show oxygen location field when oxygen dependent is checked', async () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      const oxygenCheckbox = screen.getByLabelText(/Requires oxygen/i);
      fireEvent.click(oxygenCheckbox);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/bedroom nightstand/i)).toBeInTheDocument();
      });
    });

    it('should hide oxygen location field when oxygen dependent is unchecked', () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      const oxygenCheckbox = screen.getByLabelText(/Requires oxygen/i);
      expect(screen.queryByPlaceholderText(/bedroom nightstand/i)).not.toBeInTheDocument();
    });

    it('should show dialysis schedule field when dialysis is checked', async () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      const dialysisCheckbox = screen.getByLabelText(/Requires dialysis/i);
      fireEvent.click(dialysisCheckbox);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Monday\/Wednesday\/Friday/i)).toBeInTheDocument();
      });
    });

    it('should show hearing notes field when hearing impaired is checked', async () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      const hearingCheckbox = screen.getByLabelText(/Hearing impaired/i);
      fireEvent.click(hearingCheckbox);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Knock loudly/i)).toBeInTheDocument();
      });
    });

    it('should show cognitive impairment fields when checked', async () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      const cognitiveCheckbox = screen.getByLabelText(/Cognitive impairment/i);
      fireEvent.click(cognitiveCheckbox);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Alzheimer's, Dementia/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should show error when submitting without consent', async () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      const saveButton = screen.getByText(/Save Emergency Information/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Consent is required/i)).toBeInTheDocument();
      });
    });

    it('should allow submission when consent is obtained', async () => {
      (LawEnforcementService.upsertEmergencyResponseInfo as jest.Mock).mockResolvedValue({
        id: 'test-id',
        patientId: mockPatientId
      });

      render(<SeniorEmergencyInfoForm patientId={mockPatientId} onSave={mockOnSave} />);

      const consentCheckbox = screen.getByText(/I consent/i).previousElementSibling as HTMLInputElement;
      fireEvent.click(consentCheckbox);

      const saveButton = screen.getByText(/Save Emergency Information/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(LawEnforcementService.upsertEmergencyResponseInfo).toHaveBeenCalledWith(
          mockPatientId,
          expect.objectContaining({
            consentObtained: true
          })
        );
        expect(mockOnSave).toHaveBeenCalled();
      });
    });
  });

  describe('Data Loading', () => {
    it('should load existing emergency info on mount', async () => {
      const mockData = {
        id: 'test-id',
        patientId: mockPatientId,
        tenantId: 'tenant-123',
        bedBound: true,
        oxygenDependent: true,
        oxygenTankLocation: 'bedroom',
        responsePriority: 'high' as const,
        escalationDelayHours: 4,
        consentObtained: true,
        hipaaAuthorization: true
      };

      (LawEnforcementService.getEmergencyResponseInfo as jest.Mock).mockResolvedValue(mockData);

      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      await waitFor(() => {
        const bedBoundCheckbox = screen.getByLabelText(/Bed-bound/i) as HTMLInputElement;
        expect(bedBoundCheckbox.checked).toBe(true);
      });
    });
  });

  describe('Form Interaction', () => {
    it('should update checkbox state when clicked', () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      const wheelchairCheckbox = screen.getByLabelText(/Wheelchair user/i) as HTMLInputElement;
      expect(wheelchairCheckbox.checked).toBe(false);

      fireEvent.click(wheelchairCheckbox);
      expect(wheelchairCheckbox.checked).toBe(true);
    });

    it('should update text input when typed', () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      const petsInput = screen.getByPlaceholderText(/2 dogs - friendly/i) as HTMLInputElement;
      fireEvent.change(petsInput, { target: { value: '1 cat - hides under bed' } });

      expect(petsInput.value).toBe('1 cat - hides under bed');
    });

    it('should update priority select when changed', () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      const prioritySelect = screen.getByDisplayValue(/Standard/i) as HTMLSelectElement;
      fireEvent.change(prioritySelect, { target: { value: 'critical' } });

      expect(prioritySelect.value).toBe('critical');
    });

    it('should disable all inputs in read-only mode', () => {
      render(<SeniorEmergencyInfoForm patientId={mockPatientId} readOnly={true} />);

      const bedBoundCheckbox = screen.getByLabelText(/Bed-bound/i) as HTMLInputElement;
      const wheelchairCheckbox = screen.getByLabelText(/Wheelchair/i) as HTMLInputElement;

      expect(bedBoundCheckbox.disabled).toBe(true);
      expect(wheelchairCheckbox.disabled).toBe(true);
    });
  });

  describe('Save Functionality', () => {
    it('should call upsertEmergencyResponseInfo with form data', async () => {
      (LawEnforcementService.upsertEmergencyResponseInfo as jest.Mock).mockResolvedValue({
        id: 'test-id',
        patientId: mockPatientId
      });

      render(<SeniorEmergencyInfoForm patientId={mockPatientId} onSave={mockOnSave} />);

      // Fill out form
      const bedBoundCheckbox = screen.getByLabelText(/Bed-bound/i);
      const consentCheckbox = screen.getByText(/I consent/i).previousElementSibling as HTMLInputElement;

      fireEvent.click(bedBoundCheckbox);
      fireEvent.click(consentCheckbox);

      // Submit
      const saveButton = screen.getByText(/Save Emergency Information/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(LawEnforcementService.upsertEmergencyResponseInfo).toHaveBeenCalledWith(
          mockPatientId,
          expect.objectContaining({
            bedBound: true,
            consentObtained: true
          })
        );
      });
    });

    it('should show error message when save fails', async () => {
      (LawEnforcementService.upsertEmergencyResponseInfo as jest.Mock).mockRejectedValue(
        new Error('Save failed')
      );

      render(<SeniorEmergencyInfoForm patientId={mockPatientId} />);

      const consentCheckbox = screen.getByText(/I consent/i).previousElementSibling as HTMLInputElement;
      fireEvent.click(consentCheckbox);

      const saveButton = screen.getByText(/Save Emergency Information/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to save/i)).toBeInTheDocument();
      });
    });

    it('should call onSave callback after successful save', async () => {
      (LawEnforcementService.upsertEmergencyResponseInfo as jest.Mock).mockResolvedValue({
        id: 'test-id',
        patientId: mockPatientId
      });

      render(<SeniorEmergencyInfoForm patientId={mockPatientId} onSave={mockOnSave} />);

      const consentCheckbox = screen.getByText(/I consent/i).previousElementSibling as HTMLInputElement;
      fireEvent.click(consentCheckbox);

      const saveButton = screen.getByText(/Save Emergency Information/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });
    });
  });
});
