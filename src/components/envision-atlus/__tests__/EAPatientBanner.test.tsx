/**
 * Tests for EAPatientBanner Component
 *
 * ATLUS: Unity - Ensures patient context persists across dashboards
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EAPatientBanner } from '../EAPatientBanner';
import { SelectedPatient } from '../../../contexts/PatientContext';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockPatient: SelectedPatient = {
  id: 'patient-123',
  firstName: 'John',
  lastName: 'Doe',
  mrn: 'MRN-001234',
  roomNumber: '305A',
  riskLevel: 'high',
  snapshot: {
    primaryDiagnosis: 'Congestive Heart Failure',
  },
};

const mockRecentPatients: SelectedPatient[] = [
  mockPatient,
  {
    id: 'patient-456',
    firstName: 'Jane',
    lastName: 'Smith',
    mrn: 'MRN-005678',
    roomNumber: '201B',
    riskLevel: 'medium',
  },
  {
    id: 'patient-789',
    firstName: 'Robert',
    lastName: 'Johnson',
    mrn: 'MRN-009012',
    riskLevel: 'low',
  },
];

// ============================================================================
// MOCK PATIENT CONTEXT
// ============================================================================

const mockSelectFromHistory = jest.fn();
const mockClearPatient = jest.fn();

const createMockContext = (options?: {
  hasPatient?: boolean;
  patient?: SelectedPatient | null;
  recentPatients?: SelectedPatient[];
}) => ({
  hasPatient: options?.hasPatient ?? true,
  selectedPatient: options?.patient ?? mockPatient,
  recentPatients: options?.recentPatients ?? mockRecentPatients,
  selectFromHistory: mockSelectFromHistory,
  clearPatient: mockClearPatient,
  selectPatient: jest.fn(),
  getPatientDisplayName: jest.fn().mockReturnValue('Doe, John'),
  clearHistory: jest.fn(),
});

jest.mock('../../../contexts/PatientContext', () => ({
  usePatientContextSafe: jest.fn(),
  // Re-export types
}));

import { usePatientContextSafe } from '../../../contexts/PatientContext';
const mockedUsePatientContextSafe = usePatientContextSafe as jest.MockedFunction<typeof usePatientContextSafe>;

// ============================================================================
// TESTS
// ============================================================================

describe('EAPatientBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUsePatientContextSafe.mockReturnValue(createMockContext());
  });

  describe('Rendering', () => {
    it('should render nothing when no patient context', () => {
      mockedUsePatientContextSafe.mockReturnValue(null as any);
      const { container } = render(<EAPatientBanner />);
      expect(container.firstChild).toBeNull();
    });

    it('should render nothing when hasPatient is false', () => {
      mockedUsePatientContextSafe.mockReturnValue(createMockContext({ hasPatient: false }));
      const { container } = render(<EAPatientBanner />);
      expect(container.firstChild).toBeNull();
    });

    it('should render nothing when selectedPatient is null', () => {
      mockedUsePatientContextSafe.mockReturnValue(createMockContext({ hasPatient: false, patient: null }));
      const { container } = render(<EAPatientBanner />);
      expect(container.firstChild).toBeNull();
    });

    it('should render patient name when patient is selected', () => {
      render(<EAPatientBanner />);
      expect(screen.getByText('Doe, John')).toBeInTheDocument();
    });

    it('should render MRN when available', () => {
      render(<EAPatientBanner />);
      expect(screen.getByText(/MRN: MRN-001234/i)).toBeInTheDocument();
    });

    it('should render room number when available', () => {
      render(<EAPatientBanner />);
      expect(screen.getByText(/Room 305A/i)).toBeInTheDocument();
    });

    it('should render primary diagnosis when available', () => {
      render(<EAPatientBanner />);
      expect(screen.getByText('Congestive Heart Failure')).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      render(<EAPatientBanner />);
      const banner = screen.getByRole('banner');
      expect(banner).toHaveAttribute('aria-label', 'Selected patient');
    });
  });

  describe('Risk Level Display', () => {
    it('should show HIGH risk badge', () => {
      render(<EAPatientBanner showRisk={true} />);
      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('should show alert icon for critical risk', () => {
      mockedUsePatientContextSafe.mockReturnValue(
        createMockContext({
          patient: { ...mockPatient, riskLevel: 'critical' },
        })
      );
      render(<EAPatientBanner showRisk={true} />);
      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    });

    it('should not show risk badge when showRisk is false', () => {
      render(<EAPatientBanner showRisk={false} />);
      expect(screen.queryByText('HIGH')).not.toBeInTheDocument();
    });

    it('should not show risk badge when riskLevel is undefined', () => {
      mockedUsePatientContextSafe.mockReturnValue(
        createMockContext({
          patient: { ...mockPatient, riskLevel: undefined },
        })
      );
      render(<EAPatientBanner showRisk={true} />);
      expect(screen.queryByText('HIGH')).not.toBeInTheDocument();
      expect(screen.queryByText('MEDIUM')).not.toBeInTheDocument();
      expect(screen.queryByText('LOW')).not.toBeInTheDocument();
    });
  });

  describe('Recent Patients Dropdown', () => {
    it('should show recent patients button when showRecent is true and multiple patients', () => {
      render(<EAPatientBanner showRecent={true} />);
      expect(screen.getByTitle('Recent patients')).toBeInTheDocument();
    });

    it('should not show recent patients button when showRecent is false', () => {
      render(<EAPatientBanner showRecent={false} />);
      expect(screen.queryByTitle('Recent patients')).not.toBeInTheDocument();
    });

    it('should not show recent patients button when only one patient in history', () => {
      mockedUsePatientContextSafe.mockReturnValue(
        createMockContext({ recentPatients: [mockPatient] })
      );
      render(<EAPatientBanner showRecent={true} />);
      expect(screen.queryByTitle('Recent patients')).not.toBeInTheDocument();
    });

    it('should open dropdown when Recent button is clicked', async () => {
      render(<EAPatientBanner showRecent={true} />);
      const recentButton = screen.getByTitle('Recent patients');
      await userEvent.click(recentButton);
      expect(screen.getByText('Recent Patients')).toBeInTheDocument();
    });

    it('should show all recent patients in dropdown', async () => {
      render(<EAPatientBanner showRecent={true} />);
      const recentButton = screen.getByTitle('Recent patients');
      await userEvent.click(recentButton);

      // Doe, John appears twice (banner + dropdown), others only in dropdown
      expect(screen.getAllByText('Doe, John')).toHaveLength(2);
      expect(screen.getByText('Smith, Jane')).toBeInTheDocument();
      expect(screen.getByText('Johnson, Robert')).toBeInTheDocument();
    });

    it('should call selectFromHistory when recent patient is clicked', async () => {
      render(<EAPatientBanner showRecent={true} />);
      const recentButton = screen.getByTitle('Recent patients');
      await userEvent.click(recentButton);

      const janeButton = screen.getByText('Smith, Jane');
      await userEvent.click(janeButton);

      expect(mockSelectFromHistory).toHaveBeenCalledWith('patient-456');
    });

    it('should close dropdown when patient is selected', async () => {
      render(<EAPatientBanner showRecent={true} />);
      const recentButton = screen.getByTitle('Recent patients');
      await userEvent.click(recentButton);

      const janeButton = screen.getByText('Smith, Jane');
      await userEvent.click(janeButton);

      await waitFor(() => {
        expect(screen.queryByText('Recent Patients')).not.toBeInTheDocument();
      });
    });

    it('should close dropdown when backdrop is clicked', async () => {
      render(<EAPatientBanner showRecent={true} />);
      const recentButton = screen.getByTitle('Recent patients');
      await userEvent.click(recentButton);

      // The backdrop is a fixed div with inset-0
      const backdrop = document.querySelector('.fixed.inset-0');
      expect(backdrop).toBeInTheDocument();
      await userEvent.click(backdrop!);

      await waitFor(() => {
        expect(screen.queryByText('Recent Patients')).not.toBeInTheDocument();
      });
    });
  });

  describe('Clear Patient', () => {
    it('should show clear button', () => {
      render(<EAPatientBanner />);
      expect(screen.getByTitle('Clear patient selection')).toBeInTheDocument();
    });

    it('should call clearPatient when clear button is clicked', async () => {
      render(<EAPatientBanner />);
      const clearButton = screen.getByTitle('Clear patient selection');
      await userEvent.click(clearButton);
      expect(mockClearPatient).toHaveBeenCalled();
    });

    it('should call onPatientChange callback with null when cleared', async () => {
      const onPatientChange = jest.fn();
      render(<EAPatientBanner onPatientChange={onPatientChange} />);
      const clearButton = screen.getByTitle('Clear patient selection');
      await userEvent.click(clearButton);
      expect(onPatientChange).toHaveBeenCalledWith(null);
    });
  });

  describe('Compact Mode', () => {
    it('should use smaller padding in compact mode', () => {
      const { container } = render(<EAPatientBanner compact={true} />);
      const banner = container.firstChild as HTMLElement;
      expect(banner.className).toContain('px-3');
      expect(banner.className).toContain('py-1.5');
    });

    it('should use larger padding in default mode', () => {
      const { container } = render(<EAPatientBanner compact={false} />);
      const banner = container.firstChild as HTMLElement;
      expect(banner.className).toContain('px-4');
      expect(banner.className).toContain('py-2');
    });
  });

  describe('Callbacks', () => {
    it('should call onPatientChange when selecting from recent', async () => {
      const onPatientChange = jest.fn();
      render(<EAPatientBanner showRecent={true} onPatientChange={onPatientChange} />);

      const recentButton = screen.getByTitle('Recent patients');
      await userEvent.click(recentButton);

      const janeButton = screen.getByText('Smith, Jane');
      await userEvent.click(janeButton);

      expect(onPatientChange).toHaveBeenCalledWith(mockRecentPatients[1]);
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(<EAPatientBanner className="my-custom-class" />);
      const banner = container.firstChild as HTMLElement;
      expect(banner.className).toContain('my-custom-class');
    });
  });
});
