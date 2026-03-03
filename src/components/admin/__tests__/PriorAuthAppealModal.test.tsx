/**
 * PriorAuthAppealModal — Behavioral tests
 *
 * Tests: form rendering, appeal type selection, required field validation,
 * form submission with correct data, cancel behavior.
 *
 * Uses synthetic test data only (no real patient/provider information).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PriorAuthAppealModal } from '../prior-auth/PriorAuthAppealModal';

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
    <PriorAuthAppealModal
      priorAuthId="PA-TEST-002"
      onSubmit={mockOnSubmit}
      onClose={mockOnClose}
      submitting={submitting}
    />
  );

// =====================================================
// Tests
// =====================================================

describe('PriorAuthAppealModal', () => {
  describe('Form rendering', () => {
    it('renders appeal type selector with all options', () => {
      renderModal();
      const select = screen.getByLabelText(/Appeal Level/i);
      expect(select).toBeInTheDocument();
      expect(screen.getByText('First Level')).toBeInTheDocument();
      expect(screen.getByText('Second Level')).toBeInTheDocument();
      expect(screen.getByText('External Review')).toBeInTheDocument();
    });

    it('renders reason and clinical rationale fields', () => {
      renderModal();
      expect(screen.getByLabelText(/Reason for Appeal/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Clinical Rationale/i)).toBeInTheDocument();
    });

    it('renders Submit Appeal button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Submit Appeal/i })).toBeInTheDocument();
    });

    it('renders File Appeal header', () => {
      renderModal();
      expect(screen.getByText('File Appeal')).toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('submits appeal with correct data', async () => {
      renderModal();

      fireEvent.change(screen.getByLabelText(/Appeal Level/i), { target: { value: 'second_level' } });
      fireEvent.change(screen.getByLabelText(/Reason for Appeal/i), {
        target: { value: 'Service is medically necessary per clinical guidelines' },
      });
      fireEvent.change(screen.getByLabelText(/Clinical Rationale/i), {
        target: { value: 'Patient has documented history of condition requiring this service' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Submit Appeal/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          prior_auth_id: 'PA-TEST-002',
          appeal_type: 'second_level',
          reason: 'Service is medically necessary per clinical guidelines',
          clinical_rationale: 'Patient has documented history of condition requiring this service',
        });
      });
    });

    it('disables submit when reason is empty', () => {
      renderModal();
      // Leave reason empty, fill rationale
      fireEvent.change(screen.getByLabelText(/Clinical Rationale/i), {
        target: { value: 'Some rationale' },
      });
      expect(screen.getByRole('button', { name: /Submit Appeal/i })).toBeDisabled();
    });

    it('disables submit when clinical rationale is empty', () => {
      renderModal();
      // Fill reason, leave rationale empty
      fireEvent.change(screen.getByLabelText(/Reason for Appeal/i), {
        target: { value: 'Some reason' },
      });
      expect(screen.getByRole('button', { name: /Submit Appeal/i })).toBeDisabled();
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
      // Fill required fields so disabled is only due to submitting
      fireEvent.change(screen.getByLabelText(/Reason for Appeal/i), {
        target: { value: 'Test reason' },
      });
      fireEvent.change(screen.getByLabelText(/Clinical Rationale/i), {
        target: { value: 'Test rationale' },
      });
      expect(screen.getByRole('button', { name: /Submit Appeal/i })).toBeDisabled();
    });
  });
});
