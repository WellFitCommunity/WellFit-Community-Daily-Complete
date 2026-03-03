/**
 * X12Generate837PPanel — Behavioral tests
 *
 * Tests: form field rendering, service line management, diagnosis management,
 * generate button behavior, result display, error display.
 *
 * Uses synthetic test data only (no real patient/provider information).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { X12Generate837PPanel } from '../hl7-message-test/X12Generate837PPanel';

// =====================================================
// Mock useHL7X12 hook
// =====================================================

const mockGenerate837P = vi.fn();

vi.mock('../../../hooks/useHL7X12', () => ({
  useHL7X12: () => ({
    generate837P: mockGenerate837P,
    result: null,
    operation: null,
    loading: false,
    error: null,
    parseHL7: vi.fn(),
    validateHL7: vi.fn(),
    convertHL7ToFHIR: vi.fn(),
    parseX12: vi.fn(),
    validateX12: vi.fn(),
    convertX12ToFHIR: vi.fn(),
    getMessageTypes: vi.fn(),
    generateHL7Ack: vi.fn(),
    reset: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerate837P.mockResolvedValue({
    success: true,
    data: {
      x12_content: 'ISA*00*          *00*          *ZZ*SENDER*ZZ*RECEIVER...',
      control_number: 'CTL-TEST-001',
      claim_id: 'CLM-TEST-001',
      total_charge: 250.00,
      service_line_count: 1,
    },
  });
});

// =====================================================
// Tests
// =====================================================

describe('X12Generate837PPanel', () => {
  describe('Form fields rendering', () => {
    it('renders subscriber fields with labels', () => {
      render(<X12Generate837PPanel />);
      expect(screen.getByLabelText(/Subscriber ID/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Payer ID/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Payer Name/i)).toBeInTheDocument();
    });

    it('renders provider fields with labels', () => {
      render(<X12Generate837PPanel />);
      expect(screen.getByLabelText(/^NPI/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Provider Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Tax ID/i)).toBeInTheDocument();
    });

    it('renders claim type selector with professional/institutional options', () => {
      render(<X12Generate837PPanel />);
      const claimTypeSelect = screen.getByLabelText(/Claim Type/i);
      expect(claimTypeSelect).toBeInTheDocument();
      expect(screen.getByText('Professional')).toBeInTheDocument();
      expect(screen.getByText('Institutional')).toBeInTheDocument();
    });

    it('renders generate button', () => {
      render(<X12Generate837PPanel />);
      expect(screen.getByRole('button', { name: /Generate 837P/i })).toBeInTheDocument();
    });
  });

  describe('Service line management', () => {
    it('renders one service line by default', () => {
      render(<X12Generate837PPanel />);
      expect(screen.getByLabelText(/CPT Code/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Charge/i)).toBeInTheDocument();
    });

    it('adds a service line when Add Line is clicked', () => {
      render(<X12Generate837PPanel />);
      const addBtn = screen.getByRole('button', { name: /Add Line/i });
      fireEvent.click(addBtn);
      // Should now have two CPT fields
      const cptFields = screen.getAllByLabelText(/CPT Code/i);
      expect(cptFields).toHaveLength(2);
    });

    it('removes a service line when remove is clicked', () => {
      render(<X12Generate837PPanel />);
      // Add a second line
      fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));
      expect(screen.getAllByLabelText(/CPT Code/i)).toHaveLength(2);
      // Remove line 2
      const removeBtns = screen.getAllByRole('button', { name: /Remove service line/i });
      fireEvent.click(removeBtns[1]);
      expect(screen.getAllByLabelText(/CPT Code/i)).toHaveLength(1);
    });
  });

  describe('Diagnosis management', () => {
    it('renders one diagnosis by default', () => {
      render(<X12Generate837PPanel />);
      expect(screen.getByLabelText(/Dx #1 Code/i)).toBeInTheDocument();
    });

    it('adds a diagnosis when Add is clicked', () => {
      render(<X12Generate837PPanel />);
      const addBtn = screen.getByRole('button', { name: /^Add$/i });
      fireEvent.click(addBtn);
      expect(screen.getByLabelText(/Dx #2 Code/i)).toBeInTheDocument();
    });

    it('removes a diagnosis when remove is clicked', () => {
      render(<X12Generate837PPanel />);
      fireEvent.click(screen.getByRole('button', { name: /^Add$/i }));
      expect(screen.getByLabelText(/Dx #2 Code/i)).toBeInTheDocument();
      const removeBtns = screen.getAllByRole('button', { name: /Remove diagnosis/i });
      fireEvent.click(removeBtns[0]);
      expect(screen.queryByLabelText(/Dx #2 Code/i)).not.toBeInTheDocument();
    });
  });

  describe('Generate behavior', () => {
    it('calls generate837P with form data on generate click', async () => {
      render(<X12Generate837PPanel />);

      // Fill required subscriber fields
      fireEvent.change(screen.getByLabelText(/Subscriber ID/i), { target: { value: 'SUB-TEST-001' } });
      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Patient' } });
      fireEvent.change(screen.getByLabelText(/Payer ID/i), { target: { value: 'PAYER-TEST' } });
      fireEvent.change(screen.getByLabelText(/Payer Name/i), { target: { value: 'Test Insurance' } });

      // Fill provider
      fireEvent.change(screen.getByLabelText(/^NPI/i), { target: { value: '1234567890' } });
      fireEvent.change(screen.getByLabelText(/Provider Name/i), { target: { value: 'Test Provider' } });
      fireEvent.change(screen.getByLabelText(/Tax ID/i), { target: { value: '12-3456789' } });

      // Fill diagnosis
      fireEvent.change(screen.getByLabelText(/Dx #1 Code/i), { target: { value: 'E11.9' } });

      // Fill service line
      fireEvent.change(screen.getByLabelText(/CPT Code/i), { target: { value: '99213' } });
      fireEvent.change(screen.getByLabelText(/Charge/i), { target: { value: '150.00' } });

      // Generate
      fireEvent.click(screen.getByRole('button', { name: /Generate 837P/i }));

      await waitFor(() => {
        expect(mockGenerate837P).toHaveBeenCalledTimes(1);
      });

      const call = mockGenerate837P.mock.calls[0][0];
      expect(call.subscriber.id).toBe('SUB-TEST-001');
      expect(call.subscriber.first_name).toBe('Test');
      expect(call.provider.npi).toBe('1234567890');
      expect(call.diagnoses[0].code).toBe('E11.9');
      expect(call.services[0].cpt_code).toBe('99213');
    });

    it('displays generated X12 content on success', async () => {
      render(<X12Generate837PPanel />);
      fireEvent.click(screen.getByRole('button', { name: /Generate 837P/i }));

      await waitFor(() => {
        expect(screen.getByText(/837P Generated/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/CTL-TEST-001/)).toBeInTheDocument();
      expect(screen.getByText(/ISA\*00/)).toBeInTheDocument();
    });

    it('displays error message on failure', async () => {
      mockGenerate837P.mockResolvedValue({
        success: false,
        error: 'Invalid claim data: missing required fields',
      });

      render(<X12Generate837PPanel />);
      fireEvent.click(screen.getByRole('button', { name: /Generate 837P/i }));

      await waitFor(() => {
        expect(screen.getByText(/Invalid claim data/i)).toBeInTheDocument();
      });
    });
  });
});
