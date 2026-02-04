/**
 * WelfareCheckReportModal Test Suite
 *
 * Tests for the welfare check report filing modal.
 * Law Enforcement Vertical - The SHIELD Program Phase 3.
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { MissedCheckInAlert } from '../../../types/lawEnforcement';

const mockSaveWelfareCheckReport = vi.fn();

// Mock the service
vi.mock('../../../services/lawEnforcementService', () => ({
  LawEnforcementService: {
    saveWelfareCheckReport: (...args: unknown[]) => mockSaveWelfareCheckReport(...args),
  },
}));

// Mock AuthContext useUser
const mockUser = {
  id: 'officer-001',
  email: 'officer@test.com',
  user_metadata: { full_name: 'Officer Jane Smith' },
};

vi.mock('../../../contexts/AuthContext', () => ({
  useUser: () => mockUser,
}));

// Mock Envision Atlus components
vi.mock('../../envision-atlus', () => ({
  EAButton: ({
    children,
    onClick,
    disabled,
    icon,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    icon?: React.ReactNode;
    type?: string;
    variant?: string;
    size?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} type={type as 'button' | 'submit'}>
      {icon}
      {children}
    </button>
  ),
}));

// Import after mocks
import { WelfareCheckReportModal } from '../WelfareCheckReportModal';

const mockAlert: MissedCheckInAlert = {
  patientId: 'patient-001',
  patientName: 'Margaret Johnson',
  patientAddress: '123 Oak St, Apt 2B',
  patientPhone: '555-1234',
  hoursSinceCheckIn: 8.5,
  responsePriority: 'critical',
  mobilityStatus: 'Wheelchair user',
  specialNeeds: 'Oxygen dependent',
  emergencyContactName: 'Sarah Johnson',
  emergencyContactPhone: '555-5678',
  urgencyScore: 150,
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSaved: vi.fn(),
  alert: mockAlert,
  tenantId: 'tenant-001',
};

describe('WelfareCheckReportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveWelfareCheckReport.mockResolvedValue({
      id: 'report-001',
      tenantId: 'tenant-001',
      patientId: 'patient-001',
      officerId: 'officer-001',
      officerName: 'Officer Jane Smith',
      outcome: 'senior_ok',
      createdAt: '2026-02-04T12:00:00Z',
      updatedAt: '2026-02-04T12:00:00Z',
    });
  });

  describe('Rendering', () => {
    it('should render when open', () => {
      render(<WelfareCheckReportModal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('File Welfare Check Report')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(<WelfareCheckReportModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display patient name in header', () => {
      render(<WelfareCheckReportModal {...defaultProps} />);
      expect(screen.getByText('Margaret Johnson')).toBeInTheDocument();
    });

    it('should render all 7 outcome radio buttons', () => {
      render(<WelfareCheckReportModal {...defaultProps} />);
      expect(screen.getByText('Senior OK')).toBeInTheDocument();
      expect(screen.getByText('OK - Needs Follow-up')).toBeInTheDocument();
      expect(screen.getByText('Not Home')).toBeInTheDocument();
      expect(screen.getByText('Medical Emergency')).toBeInTheDocument();
      expect(screen.getByText('Non-Medical Emergency')).toBeInTheDocument();
      expect(screen.getByText('Unable to Contact')).toBeInTheDocument();
      expect(screen.getByText('Refused Check')).toBeInTheDocument();
    });

    it('should render the completed at datetime input', () => {
      render(<WelfareCheckReportModal {...defaultProps} />);
      expect(screen.getByLabelText('Check completed at')).toBeInTheDocument();
    });

    it('should render notes textarea', () => {
      render(<WelfareCheckReportModal {...defaultProps} />);
      expect(screen.getByLabelText(/Notes/)).toBeInTheDocument();
    });

    it('should render EMS Called and Family Notified checkboxes', () => {
      render(<WelfareCheckReportModal {...defaultProps} />);
      expect(screen.getByText('EMS Called')).toBeInTheDocument();
      expect(screen.getByText('Family Notified')).toBeInTheDocument();
    });

    it('should render cancel and submit buttons', () => {
      render(<WelfareCheckReportModal {...defaultProps} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('File Report')).toBeInTheDocument();
    });
  });

  describe('Conditional Fields', () => {
    it('should show transport fields when medical_emergency is selected', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportModal {...defaultProps} />);

      const medicalEmergencyLabel = screen.getByText('Medical Emergency');
      await user.click(medicalEmergencyLabel);

      expect(screen.getByText('Transport Information')).toBeInTheDocument();
      expect(screen.getByLabelText('Transported To')).toBeInTheDocument();
      expect(screen.getByLabelText('Transport Reason')).toBeInTheDocument();
    });

    it('should show transport fields when non_medical_emergency is selected', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportModal {...defaultProps} />);

      const nonMedicalLabel = screen.getByText('Non-Medical Emergency');
      await user.click(nonMedicalLabel);

      expect(screen.getByText('Transport Information')).toBeInTheDocument();
    });

    it('should not show transport fields for non-emergency outcomes', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportModal {...defaultProps} />);

      const seniorOkLabel = screen.getByText('Senior OK');
      await user.click(seniorOkLabel);

      expect(screen.queryByText('Transport Information')).not.toBeInTheDocument();
    });

    it('should show follow-up fields when follow-up is checked', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportModal {...defaultProps} />);

      const followupCheckbox = screen.getByText('Follow-up Required');
      await user.click(followupCheckbox);

      expect(screen.getByLabelText('Follow-up Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Follow-up Notes')).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should disable submit button when no outcome is selected', () => {
      render(<WelfareCheckReportModal {...defaultProps} />);

      const submitButton = screen.getByText('File Report').closest('button');
      expect(submitButton).toBeDisabled();
    });

    it('should show error when emergency outcome has no notes', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportModal {...defaultProps} />);

      const medicalLabel = screen.getByText('Medical Emergency');
      await user.click(medicalLabel);

      const submitButton = screen.getByText('File Report');
      await user.click(submitButton);

      expect(screen.getByText('Notes are required for emergency outcomes')).toBeInTheDocument();
    });

    it('should not require notes for non-emergency outcomes', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportModal {...defaultProps} />);

      const seniorOkLabel = screen.getByText('Senior OK');
      await user.click(seniorOkLabel);

      const submitButton = screen.getByText('File Report');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSaveWelfareCheckReport).toHaveBeenCalled();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call service on valid submit', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportModal {...defaultProps} />);

      const seniorOkLabel = screen.getByText('Senior OK');
      await user.click(seniorOkLabel);

      const submitButton = screen.getByText('File Report');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSaveWelfareCheckReport).toHaveBeenCalledTimes(1);
        const call = mockSaveWelfareCheckReport.mock.calls[0][0];
        expect(call.patientId).toBe('patient-001');
        expect(call.officerId).toBe('officer-001');
        expect(call.officerName).toBe('Officer Jane Smith');
        expect(call.outcome).toBe('senior_ok');
        expect(call.tenantId).toBe('tenant-001');
      });
    });

    it('should call onSaved and onClose on success', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportModal {...defaultProps} />);

      await user.click(screen.getByText('Senior OK'));
      await user.click(screen.getByText('File Report'));

      await waitFor(() => {
        expect(defaultProps.onSaved).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('should show loading state during save', async () => {
      mockSaveWelfareCheckReport.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const user = userEvent.setup();
      render(<WelfareCheckReportModal {...defaultProps} />);

      await user.click(screen.getByText('Senior OK'));
      await user.click(screen.getByText('File Report'));

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should display error on save failure', async () => {
      mockSaveWelfareCheckReport.mockRejectedValueOnce(new Error('Network error'));

      const user = userEvent.setup();
      render(<WelfareCheckReportModal {...defaultProps} />);

      await user.click(screen.getByText('Senior OK'));
      await user.click(screen.getByText('File Report'));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Actions Taken', () => {
    it('should add custom action when add button clicked', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportModal {...defaultProps} />);

      const actionInput = screen.getByLabelText('Add action');
      await user.type(actionInput, 'Called neighbor');

      const addButton = screen.getByText('Add');
      await user.click(addButton);

      expect(screen.getByText('Called neighbor')).toBeInTheDocument();
    });

    it('should remove custom action when remove button clicked', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportModal {...defaultProps} />);

      const actionInput = screen.getByLabelText('Add action');
      await user.type(actionInput, 'Called neighbor');
      await user.click(screen.getByText('Add'));

      expect(screen.getByText('Called neighbor')).toBeInTheDocument();

      const removeButton = screen.getByLabelText('Remove action: Called neighbor');
      await user.click(removeButton);

      expect(screen.queryByText('Called neighbor')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-modal and role=dialog', () => {
      render(<WelfareCheckReportModal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'File welfare check report');
    });

    it('should close on escape key', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportModal {...defaultProps} />);

      await user.keyboard('{Escape}');

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should call onClose when cancel button clicked', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportModal {...defaultProps} />);

      await user.click(screen.getByText('Cancel'));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should call onClose when overlay is clicked', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportModal {...defaultProps} />);

      const overlay = screen.getByTestId('modal-overlay');
      await user.click(overlay);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should have close button with aria-label', () => {
      render(<WelfareCheckReportModal {...defaultProps} />);
      expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
    });
  });
});
