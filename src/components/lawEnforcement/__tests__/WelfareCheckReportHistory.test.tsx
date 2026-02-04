/**
 * WelfareCheckReportHistory Test Suite
 *
 * Tests for the welfare check report history timeline.
 * Law Enforcement Vertical - The SHIELD Program Phase 3.
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { WelfareCheckReport } from '../../../types/lawEnforcement';

const mockGetWelfareCheckReports = vi.fn();

// Mock the service
vi.mock('../../../services/lawEnforcementService', () => ({
  LawEnforcementService: {
    getWelfareCheckReports: (...args: unknown[]) => mockGetWelfareCheckReports(...args),
  },
}));

// Import after mocks
import { WelfareCheckReportHistory } from '../WelfareCheckReportHistory';

const mockReports: WelfareCheckReport[] = [
  {
    id: 'report-001',
    tenantId: 'tenant-001',
    patientId: 'patient-001',
    officerId: 'officer-001',
    officerName: 'Officer Jane Smith',
    checkInitiatedAt: '2026-02-04T08:00:00Z',
    checkCompletedAt: '2026-02-04T08:30:00Z',
    responseTimeMinutes: 30,
    outcome: 'senior_ok',
    outcomeNotes: 'Senior was in good spirits. Had just finished breakfast.',
    emsCalled: false,
    familyNotified: false,
    actionsTaken: [],
    followupRequired: false,
    createdAt: '2026-02-04T08:30:00Z',
    updatedAt: '2026-02-04T08:30:00Z',
  },
  {
    id: 'report-002',
    tenantId: 'tenant-001',
    patientId: 'patient-001',
    officerId: 'officer-002',
    officerName: 'Officer Bob Johnson',
    checkInitiatedAt: '2026-02-03T10:00:00Z',
    checkCompletedAt: '2026-02-03T10:15:00Z',
    responseTimeMinutes: 15,
    outcome: 'medical_emergency',
    outcomeNotes: 'Found senior on the floor. Called EMS immediately.',
    emsCalled: true,
    familyNotified: true,
    actionsTaken: ['Stayed with senior until EMS arrived', 'Secured home after transport'],
    transportedTo: 'Memorial Hospital',
    transportReason: 'Fall with possible hip fracture',
    followupRequired: true,
    followupDate: '2026-02-05',
    followupNotes: 'Check on return from hospital',
    createdAt: '2026-02-03T10:15:00Z',
    updatedAt: '2026-02-03T10:15:00Z',
  },
  {
    id: 'report-003',
    tenantId: 'tenant-001',
    patientId: 'patient-001',
    officerId: 'officer-001',
    officerName: 'Officer Jane Smith',
    checkInitiatedAt: '2026-02-02T14:00:00Z',
    checkCompletedAt: '2026-02-02T14:05:00Z',
    responseTimeMinutes: 5,
    outcome: 'senior_not_home',
    emsCalled: false,
    familyNotified: false,
    actionsTaken: ['Left notice on door'],
    followupRequired: false,
    createdAt: '2026-02-02T14:05:00Z',
    updatedAt: '2026-02-02T14:05:00Z',
  },
];

const defaultProps = {
  patientId: 'patient-001',
  tenantId: 'tenant-001',
};

describe('WelfareCheckReportHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWelfareCheckReports.mockResolvedValue(mockReports);
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      mockGetWelfareCheckReports.mockReturnValue(new Promise(() => {})); // never resolves
      render(<WelfareCheckReportHistory {...defaultProps} />);
      expect(screen.getByTestId('report-history-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading reports...')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no reports exist', async () => {
      mockGetWelfareCheckReports.mockResolvedValueOnce([]);
      render(<WelfareCheckReportHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('report-history-empty')).toBeInTheDocument();
        expect(screen.getByText('No reports filed yet')).toBeInTheDocument();
      });
    });
  });

  describe('Report List', () => {
    it('should render report list after loading', async () => {
      render(<WelfareCheckReportHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('report-history')).toBeInTheDocument();
      });
    });

    it('should display report count', async () => {
      render(<WelfareCheckReportHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Past Reports (3)')).toBeInTheDocument();
      });
    });

    it('should display outcome badges with correct text', async () => {
      render(<WelfareCheckReportHistory {...defaultProps} />);

      await waitFor(() => {
        const badges = screen.getAllByTestId('outcome-badge');
        expect(badges).toHaveLength(3);
        expect(badges[0]).toHaveTextContent('Senior OK');
        expect(badges[1]).toHaveTextContent('Medical Emergency');
        expect(badges[2]).toHaveTextContent('Not Home');
      });
    });

    it('should display response times', async () => {
      render(<WelfareCheckReportHistory {...defaultProps} />);

      await waitFor(() => {
        const times = screen.getAllByTestId('response-time');
        expect(times).toHaveLength(3);
        expect(times[0]).toHaveTextContent('30 min');
        expect(times[1]).toHaveTextContent('15 min');
        expect(times[2]).toHaveTextContent('5 min');
      });
    });

    it('should call service with patientId and limit', async () => {
      render(<WelfareCheckReportHistory {...defaultProps} limit={5} />);

      await waitFor(() => {
        expect(mockGetWelfareCheckReports).toHaveBeenCalledWith('patient-001', 5);
      });
    });
  });

  describe('Expandable Details', () => {
    it('should expand report details on click', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('report-history')).toBeInTheDocument();
      });

      // Click the first report row
      const buttons = screen.getAllByRole('button', { expanded: false });
      await user.click(buttons[0]);

      await waitFor(() => {
        const details = screen.getByTestId('report-details');
        expect(details).toBeInTheDocument();
        expect(screen.getByText('Officer Jane Smith')).toBeInTheDocument();
      });
    });

    it('should show outcome notes in expanded view', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('report-history')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button', { expanded: false });
      await user.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByText('Senior was in good spirits. Had just finished breakfast.')).toBeInTheDocument();
      });
    });

    it('should show EMS Called and Family Notified badges', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('report-history')).toBeInTheDocument();
      });

      // Expand the medical emergency report (index 1)
      const buttons = screen.getAllByRole('button', { expanded: false });
      await user.click(buttons[1]);

      await waitFor(() => {
        expect(screen.getByText('EMS Called')).toBeInTheDocument();
        expect(screen.getByText('Family Notified')).toBeInTheDocument();
      });
    });

    it('should show transport info in expanded view', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('report-history')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button', { expanded: false });
      await user.click(buttons[1]);

      await waitFor(() => {
        expect(screen.getByText(/Memorial Hospital/)).toBeInTheDocument();
        expect(screen.getByText(/Fall with possible hip fracture/)).toBeInTheDocument();
      });
    });

    it('should collapse when clicked again', async () => {
      const user = userEvent.setup();
      render(<WelfareCheckReportHistory {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('report-history')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button', { expanded: false });
      await user.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('report-details')).toBeInTheDocument();
      });

      // Click again to collapse
      const expandedButton = screen.getByRole('button', { expanded: true });
      await user.click(expandedButton);

      await waitFor(() => {
        expect(screen.queryByTestId('report-details')).not.toBeInTheDocument();
      });
    });
  });
});
