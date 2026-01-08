/**
 * Tests for HandoffBypassModal Component
 *
 * Purpose: Emergency bypass modal for when nurses need to override handoff validation
 * Tests: Form rendering, validation, submission, bypass warnings, manager notifications
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HandoffBypassModal } from '../HandoffBypassModal';

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useUser: vi.fn(() => ({ id: 'user-123', email: 'nurse@hospital.com' })),
}));

describe('HandoffBypassModal', () => {
  const mockOnClose = vi.fn();
  const mockOnBypass = vi.fn();
  const defaultProps = {
    onClose: mockOnClose,
    onBypass: mockOnBypass,
    pendingCount: 3,
    pendingPatients: [
      { patient_id: 'p1', patient_name: 'John Doe', room_number: '301' },
      { patient_id: 'p2', patient_name: 'Jane Smith', room_number: '302' },
      { patient_id: 'p3', patient_name: 'Bob Wilson', room_number: null },
    ],
    currentBypassCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the bypass modal', () => {
      render(<HandoffBypassModal {...defaultProps} />);

      expect(screen.getByText('Emergency Handoff Override')).toBeInTheDocument();
    });

    it('should display warning header', () => {
      render(<HandoffBypassModal {...defaultProps} />);

      // ⚠️ appears in multiple places, use getAllByText
      const warningEmojis = screen.getAllByText('⚠️');
      expect(warningEmojis.length).toBeGreaterThan(0);
      expect(screen.getByText(/You are bypassing system validation/)).toBeInTheDocument();
    });

    it('should display pending patients count', () => {
      render(<HandoffBypassModal {...defaultProps} />);

      expect(screen.getByText(/System shows 3 patients unreviewed/)).toBeInTheDocument();
    });

    it('should list pending patients with room numbers', () => {
      render(<HandoffBypassModal {...defaultProps} />);

      expect(screen.getByText(/Room 301 - John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Room 302 - Jane Smith/)).toBeInTheDocument();
      expect(screen.getByText(/No Room - Bob Wilson/)).toBeInTheDocument();
    });

    it('should show bypass count warning', () => {
      render(<HandoffBypassModal {...defaultProps} currentBypassCount={1} />);

      expect(screen.getByText(/Bypass #2 of 3 this week/)).toBeInTheDocument();
    });
  });

  describe('Manager Notification Warning', () => {
    it('should not show manager notification warning for bypasses 1-2', () => {
      render(<HandoffBypassModal {...defaultProps} currentBypassCount={0} />);

      expect(screen.queryByText(/MANAGER WILL BE NOTIFIED/)).not.toBeInTheDocument();
    });

    it('should show manager notification warning for bypass 3+', () => {
      render(<HandoffBypassModal {...defaultProps} currentBypassCount={2} />);

      expect(screen.getByText(/MANAGER WILL BE NOTIFIED/)).toBeInTheDocument();
    });

    it('should show red styling for critical bypasses', () => {
      render(<HandoffBypassModal {...defaultProps} currentBypassCount={2} />);

      expect(screen.getByText('🚨')).toBeInTheDocument();
    });

    it('should mention manager will be automatically notified', () => {
      render(<HandoffBypassModal {...defaultProps} currentBypassCount={2} />);

      expect(screen.getByText(/Your nurse manager will be automatically notified/)).toBeInTheDocument();
    });
  });

  describe('Form Fields', () => {
    it('should render reason dropdown', () => {
      render(<HandoffBypassModal {...defaultProps} />);

      expect(screen.getByText(/Reason for Override/)).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should have all reason options', () => {
      render(<HandoffBypassModal {...defaultProps} />);

      // Verify combobox exists (used to query options)
      expect(screen.getByRole('combobox')).toBeInTheDocument();

      expect(screen.getByText('System Glitch / Bug')).toBeInTheDocument();
      expect(screen.getByText('Network / Connection Issue')).toBeInTheDocument();
      expect(screen.getByText('Patient Emergency (Coding / Urgent)')).toBeInTheDocument();
      expect(screen.getByText('Time-Critical Situation')).toBeInTheDocument();
      expect(screen.getByText('Other (explain below)')).toBeInTheDocument();
    });

    it('should render explanation textarea', () => {
      render(<HandoffBypassModal {...defaultProps} />);

      expect(screen.getByText(/Detailed Explanation/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Example:/)).toBeInTheDocument();
    });

    it('should render signature input', () => {
      render(<HandoffBypassModal {...defaultProps} />);

      expect(screen.getByText(/Confirm Your Identity/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Type your full name')).toBeInTheDocument();
    });

    it('should show character count for explanation', async () => {
      render(<HandoffBypassModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/Example:/);
      await userEvent.type(textarea, 'This is my explanation');

      expect(screen.getByText('22 characters (minimum 10 required)')).toBeInTheDocument();
    });
  });

  describe('Audit Notice', () => {
    it('should display what will be logged', () => {
      render(<HandoffBypassModal {...defaultProps} />);

      expect(screen.getByText('What will be logged:')).toBeInTheDocument();
      expect(screen.getByText(/Your name and ID/)).toBeInTheDocument();
      expect(screen.getByText(/Date and time/)).toBeInTheDocument();
      expect(screen.getByText(/Shift type and patients affected/)).toBeInTheDocument();
      expect(screen.getByText(/Your reason and explanation/)).toBeInTheDocument();
      expect(screen.getByText(/IP address and device information/)).toBeInTheDocument();
    });

    it('should show current bypass count in audit notice', () => {
      render(<HandoffBypassModal {...defaultProps} currentBypassCount={1} />);

      expect(screen.getByText(/Bypass count this week: 2/)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error when explanation is empty', async () => {
      render(<HandoffBypassModal {...defaultProps} />);

      const signatureInput = screen.getByPlaceholderText('Type your full name');
      await userEvent.type(signatureInput, 'John Nurse');

      // Submit form directly to bypass HTML5 validation
      const form = document.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Explanation is required')).toBeInTheDocument();
      });
    });

    it('should show error when signature is empty', async () => {
      render(<HandoffBypassModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/Example:/);
      await userEvent.type(textarea, 'This is a valid explanation text');

      // Submit form directly to bypass HTML5 validation
      const form = document.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Signature is required')).toBeInTheDocument();
      });
    });

    it('should show error when explanation is less than 10 characters', async () => {
      render(<HandoffBypassModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/Example:/);
      await userEvent.type(textarea, 'Short');

      const signatureInput = screen.getByPlaceholderText('Type your full name');
      await userEvent.type(signatureInput, 'John Nurse');

      const submitButton = screen.getByRole('button', { name: /Override and Accept Handoff/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please provide a detailed explanation (at least 10 characters)')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call onBypass with form data on valid submission', async () => {
      mockOnBypass.mockResolvedValue(undefined);

      render(<HandoffBypassModal {...defaultProps} />);

      const reasonSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(reasonSelect, 'patient_emergency');

      const textarea = screen.getByPlaceholderText(/Example:/);
      await userEvent.type(textarea, 'Patient in Room 301 required urgent attention');

      const signatureInput = screen.getByPlaceholderText('Type your full name');
      await userEvent.type(signatureInput, 'Sarah Nurse');

      const submitButton = screen.getByRole('button', { name: /Override and Accept Handoff/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnBypass).toHaveBeenCalledWith({
          override_reason: 'patient_emergency',
          override_explanation: 'Patient in Room 301 required urgent attention',
          nurse_signature: 'Sarah Nurse',
        });
      });
    });

    it('should show loading state during submission', async () => {
      mockOnBypass.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<HandoffBypassModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/Example:/);
      await userEvent.type(textarea, 'This is a valid explanation text');

      const signatureInput = screen.getByPlaceholderText('Type your full name');
      await userEvent.type(signatureInput, 'Sarah Nurse');

      const submitButton = screen.getByRole('button', { name: /Override and Accept Handoff/i });
      await userEvent.click(submitButton);

      expect(screen.getByText('Logging Override...')).toBeInTheDocument();
    });

    it('should disable buttons during submission', async () => {
      mockOnBypass.mockImplementation(() => new Promise(() => {}));

      render(<HandoffBypassModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/Example:/);
      await userEvent.type(textarea, 'This is a valid explanation text');

      const signatureInput = screen.getByPlaceholderText('Type your full name');
      await userEvent.type(signatureInput, 'Sarah Nurse');

      const submitButton = screen.getByRole('button', { name: /Override and Accept Handoff/i });
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });

      await userEvent.click(submitButton);

      expect(submitButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display error when bypass fails', async () => {
      mockOnBypass.mockRejectedValue(new Error('Bypass logging failed'));

      render(<HandoffBypassModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText(/Example:/);
      await userEvent.type(textarea, 'This is a valid explanation text');

      const signatureInput = screen.getByPlaceholderText('Type your full name');
      await userEvent.type(signatureInput, 'Sarah Nurse');

      const submitButton = screen.getByRole('button', { name: /Override and Accept Handoff/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Bypass logging failed')).toBeInTheDocument();
      });
    });
  });

  describe('Cancel Action', () => {
    it('should call onClose when Cancel button is clicked', async () => {
      render(<HandoffBypassModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await userEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Reason Selection', () => {
    it('should update reason when selected', async () => {
      render(<HandoffBypassModal {...defaultProps} />);

      const reasonSelect = screen.getByRole('combobox');
      await userEvent.selectOptions(reasonSelect, 'network_issue');

      expect(reasonSelect).toHaveValue('network_issue');
    });
  });

  describe('Modal Styling', () => {
    it('should render with backdrop', () => {
      const { container } = render(<HandoffBypassModal {...defaultProps} />);

      const backdrop = container.firstChild;
      expect(backdrop).toHaveClass('fixed', 'inset-0', 'z-50');
    });

    it('should have orange warning header', () => {
      const { container } = render(<HandoffBypassModal {...defaultProps} />);

      const warningHeader = container.querySelector('.bg-orange-100');
      expect(warningHeader).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have required field indicators', () => {
      render(<HandoffBypassModal {...defaultProps} />);

      const requiredIndicators = screen.getAllByText('*');
      expect(requiredIndicators.length).toBe(3); // Reason, Explanation, Signature
    });

    it('should have proper form structure', () => {
      render(<HandoffBypassModal {...defaultProps} />);

      // Forms don't have implicit role, use document query
      expect(document.querySelector('form')).toBeInTheDocument();
    });
  });
});
