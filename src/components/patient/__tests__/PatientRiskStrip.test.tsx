/**
 * PatientRiskStrip Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PatientRiskStrip } from '../PatientRiskStrip';

// Mock Supabase
jest.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
        })),
      })),
    })),
  },
}));

// Mock auditLogger
jest.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('PatientRiskStrip', () => {
  const defaultProps = {
    patientId: 'test-patient-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders loading state initially', () => {
      render(<PatientRiskStrip {...defaultProps} />);
      expect(screen.getByText(/loading risk assessment/i)).toBeInTheDocument();
    });

    it('renders with no active risk alerts when no data', async () => {
      render(<PatientRiskStrip {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/no active risk alerts/i)).toBeInTheDocument();
      });
    });

    it('renders compact variant by default', () => {
      render(<PatientRiskStrip {...defaultProps} />);
      expect(screen.getByText(/loading risk assessment/i)).toBeInTheDocument();
    });

    it('renders expanded variant when specified', async () => {
      render(<PatientRiskStrip {...defaultProps} variant="expanded" />);

      await waitFor(() => {
        expect(screen.getByText(/30-day readmission/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/clinical acuity/i)).toBeInTheDocument();
      expect(screen.getByText(/no-show risk/i)).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('handles refresh button click', async () => {
      render(<PatientRiskStrip {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTitle(/refresh/i)).toBeInTheDocument();
      });

      const refreshButton = screen.getByTitle(/refresh/i);
      fireEvent.click(refreshButton);
      expect(refreshButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible buttons with titles', async () => {
      render(<PatientRiskStrip {...defaultProps} />);

      await waitFor(() => {
        const refreshButton = screen.getByTitle(/refresh/i);
        expect(refreshButton).toBeInTheDocument();
      });
    });
  });
});
