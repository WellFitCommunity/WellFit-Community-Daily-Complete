/**
 * PriorAuthDecisionModal — Behavioral tests
 *
 * Tests: form rendering, decision type switching, field visibility,
 * form submission with correct data, cancel behavior.
 *
 * Uses synthetic test data only (no real patient/provider information).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PriorAuthDecisionModal } from '../prior-auth/PriorAuthDecisionModal';

// =====================================================
// Setup
// =====================================================

const mockOnSubmit = vi.fn();
const mockOnClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockOnSubmit.mockResolvedValue(undefined);
});

const renderModal = (submitting = false) =>
  render(
    <PriorAuthDecisionModal
      priorAuthId="PA-TEST-001"
      onSubmit={mockOnSubmit}
      onClose={mockOnClose}
      submitting={submitting}
    />
  );

// =====================================================
// Tests
// =====================================================

describe('PriorAuthDecisionModal', () => {
  describe('Form rendering', () => {
    it('renders decision type selector with all options', () => {
      renderModal();
      const select = screen.getByLabelText(/Decision/i);
      expect(select).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('Denied')).toBeInTheDocument();
      expect(screen.getByText('Partial Approval')).toBeInTheDocument();
      expect(screen.getByText('Pending Additional Info')).toBeInTheDocument();
    });

    it('renders Record Decision button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Record Decision/i })).toBeInTheDocument();
    });

    it('renders close button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Close modal/i })).toBeInTheDocument();
    });
  });

  describe('Decision type field visibility', () => {
    it('shows auth number and date fields for Approved decision', () => {
      renderModal();
      // Default is approved
      expect(screen.getByLabelText(/Authorization Number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Effective Date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Expiration Date/i)).toBeInTheDocument();
    });

    it('shows denial fields when Denied is selected', () => {
      renderModal();
      fireEvent.change(screen.getByLabelText(/Decision/i), { target: { value: 'denied' } });
      expect(screen.getByLabelText(/Denial Reason/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Denial Codes/i)).toBeInTheDocument();
    });

    it('shows both approval and denial fields for Partial Approval', () => {
      renderModal();
      fireEvent.change(screen.getByLabelText(/Decision/i), { target: { value: 'partial_approval' } });
      expect(screen.getByLabelText(/Authorization Number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Denial Reason/i)).toBeInTheDocument();
    });

    it('hides approval and denial fields for Pending Additional Info', () => {
      renderModal();
      fireEvent.change(screen.getByLabelText(/Decision/i), { target: { value: 'pending_additional_info' } });
      expect(screen.queryByLabelText(/Authorization Number/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Denial Reason/i)).not.toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('submits approved decision with auth number and dates', async () => {
      renderModal();
      fireEvent.change(screen.getByLabelText(/Authorization Number/i), { target: { value: 'AUTH-TEST-123' } });
      fireEvent.change(screen.getByLabelText(/Effective Date/i), { target: { value: '2026-01-01' } });
      fireEvent.change(screen.getByLabelText(/Expiration Date/i), { target: { value: '2026-06-30' } });
      fireEvent.change(screen.getByLabelText(/^Notes$/i), { target: { value: 'Test notes' } });

      fireEvent.click(screen.getByRole('button', { name: /Record Decision/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
          prior_auth_id: 'PA-TEST-001',
          decision_type: 'approved',
          auth_number: 'AUTH-TEST-123',
          effective_date: '2026-01-01',
          expiration_date: '2026-06-30',
          notes: 'Test notes',
        }));
      });
    });

    it('submits denied decision with denial reason and codes', async () => {
      renderModal();
      fireEvent.change(screen.getByLabelText(/Decision/i), { target: { value: 'denied' } });
      fireEvent.change(screen.getByLabelText(/Denial Reason/i), { target: { value: 'Not medically necessary' } });
      fireEvent.change(screen.getByLabelText(/Denial Codes/i), { target: { value: 'CO-16, CO-50' } });

      fireEvent.click(screen.getByRole('button', { name: /Record Decision/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
          prior_auth_id: 'PA-TEST-001',
          decision_type: 'denied',
          denial_reason: 'Not medically necessary',
          denial_codes: ['CO-16', 'CO-50'],
        }));
      });
    });
  });

  describe('Cancel behavior', () => {
    it('calls onClose when Cancel button is clicked', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when X button is clicked', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Close modal/i }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loading state', () => {
    it('disables submit button when submitting', () => {
      renderModal(true);
      expect(screen.getByRole('button', { name: /Record Decision/i })).toBeDisabled();
    });
  });
});
