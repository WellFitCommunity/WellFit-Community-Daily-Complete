/**
 * Tests for CCMTimeTracker Component
 *
 * Purpose: Verify CCM time tracking modal rendering and structure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CCMTimeTracker } from '../CCMTimeTracker';

describe('CCMTimeTracker', () => {
  const defaultProps = {
    encounterId: 'encounter-123',
    patientId: 'patient-456',
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render modal with header', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('CCM Time Tracking')).toBeInTheDocument();
      expect(screen.getByText(/Track billable activities/)).toBeInTheDocument();
    });

    it('should render activity type label', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText(/Activity Type/)).toBeInTheDocument();
    });

    it('should render provider field', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByPlaceholderText('Provider name')).toBeInTheDocument();
    });

    it('should render description field', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByPlaceholderText(/Detailed description/)).toBeInTheDocument();
    });

    it('should render timer controls', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Start/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument();
    });

    it('should render Cancel button', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    it('should render Save Time Tracking button', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Save Time Tracking/i })).toBeInTheDocument();
    });

    it('should show empty activities message initially', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('No activities logged yet')).toBeInTheDocument();
    });

    it('should show Add Activity button', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Add Activity/i })).toBeInTheDocument();
    });
  });

  describe('Timer Display', () => {
    it('should show 00:00 initially', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('00:00')).toBeInTheDocument();
    });
  });

  describe('Activity Types', () => {
    it('should have activity type dropdown with options', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText('Assessment & Care Planning')).toBeInTheDocument();
      expect(screen.getByText('Care Coordination')).toBeInTheDocument();
    });
  });

  describe('Summary Section', () => {
    it('should show time summary section', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText('Time Summary')).toBeInTheDocument();
      expect(screen.getByText('Total Time')).toBeInTheDocument();
      expect(screen.getByText('Billable Time')).toBeInTheDocument();
    });
  });

  describe('Cancel Action', () => {
    it('should call onCancel when Cancel clicked', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should disable save button with no activities', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      // Button should be disabled when no activities are logged
      const saveButton = screen.getByRole('button', { name: /Save Time Tracking/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Compliance Messages', () => {
    it('should show minimum time message initially', () => {
      render(<CCMTimeTracker {...defaultProps} />);

      expect(screen.getByText(/Minimum 20 minutes required/)).toBeInTheDocument();
    });
  });
});
