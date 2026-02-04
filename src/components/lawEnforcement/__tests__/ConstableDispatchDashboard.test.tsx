/**
 * ConstableDispatchDashboard Test Suite
 *
 * Tests for the constable dispatch dashboard for welfare checks.
 * Law Enforcement Vertical - The SHIELD Program welfare check system.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { MissedCheckInAlert, WelfareCheckInfo } from '../../../types/lawEnforcement';

// Sample alerts for testing - used in mock below
const _mockAlerts: MissedCheckInAlert[] = [
  {
    patientId: 'patient-1',
    patientName: 'John Doe',
    patientAddress: '123 Main St, Apt 4B',
    patientPhone: '555-1234',
    hoursSinceCheckIn: 8.5,
    responsePriority: 'critical',
    mobilityStatus: 'Wheelchair user',
    specialNeeds: 'Oxygen dependent, cognitive impairment',
    emergencyContactName: 'Jane Doe',
    emergencyContactPhone: '555-5678',
    urgencyScore: 150,
  },
  {
    patientId: 'patient-2',
    patientName: 'Mary Smith',
    patientAddress: '456 Oak Ave',
    patientPhone: '555-2345',
    hoursSinceCheckIn: 6.2,
    responsePriority: 'high',
    mobilityStatus: 'Walker required',
    specialNeeds: 'Fall risk',
    emergencyContactName: 'Bob Smith',
    emergencyContactPhone: '555-6789',
    urgencyScore: 85,
  },
];

const _mockWelfareCheckInfo: WelfareCheckInfo = {
  patientId: 'patient-1',
  patientName: 'John Doe',
  patientAge: 78,
  patientPhone: '555-1234',
  patientAddress: '123 Main St, Apt 4B',
  buildingLocation: 'Apartment complex, Building A',
  floorNumber: '4',
  elevatorRequired: true,
  parkingInstructions: 'Visitor lot in back',
  mobilityStatus: 'Wheelchair user',
  medicalEquipment: ['Oxygen concentrator', 'CPAP machine'],
  communicationNeeds: 'Hearing impaired - knock loudly',
  accessInstructions: 'Key under mat, door code 1234',
  pets: '1 small dog - friendly',
  responsePriority: 'critical',
  specialInstructions: 'May be slow to answer door. Check bedroom first.',
  emergencyContacts: [
    { name: 'Jane Doe', relationship: 'Daughter', phone: '555-5678', isPrimary: true },
    { name: 'Bob Doe', relationship: 'Son', phone: '555-8901', isPrimary: false },
  ],
  neighborInfo: {
    name: 'Tom Wilson',
    address: 'Apt 4A',
    phone: '555-4321',
  },
  fallRisk: true,
  cognitiveImpairment: true,
  oxygenDependent: true,
  lastCheckInTime: '2025-01-20T08:00:00Z',
  hoursSinceCheckIn: 8.5,
};

// Mock AuthContext for WelfareCheckReportModal
vi.mock('../../../contexts/AuthContext', () => ({
  useUser: () => ({
    id: 'officer-001',
    email: 'officer@test.com',
    user_metadata: { full_name: 'Officer Test' },
  }),
}));

// Mock the service before importing the component
vi.mock('../../../services/lawEnforcementService', () => ({
  LawEnforcementService: {
    getWelfareCheckReports: vi.fn().mockResolvedValue([]),
    saveWelfareCheckReport: vi.fn().mockResolvedValue({ id: 'report-1' }),
    getMissedCheckInAlerts: vi.fn().mockResolvedValue([
      {
        patientId: 'patient-1',
        patientName: 'John Doe',
        patientAddress: '123 Main St, Apt 4B',
        patientPhone: '555-1234',
        hoursSinceCheckIn: 8.5,
        responsePriority: 'critical',
        mobilityStatus: 'Wheelchair user',
        specialNeeds: 'Oxygen dependent, cognitive impairment',
        emergencyContactName: 'Jane Doe',
        emergencyContactPhone: '555-5678',
        urgencyScore: 150,
      },
      {
        patientId: 'patient-2',
        patientName: 'Mary Smith',
        patientAddress: '456 Oak Ave',
        patientPhone: '555-2345',
        hoursSinceCheckIn: 6.2,
        responsePriority: 'high',
        mobilityStatus: 'Walker required',
        specialNeeds: 'Fall risk',
        emergencyContactName: 'Bob Smith',
        emergencyContactPhone: '555-6789',
        urgencyScore: 85,
      },
    ]),
    getWelfareCheckInfo: vi.fn().mockResolvedValue({
      patientId: 'patient-1',
      patientName: 'John Doe',
      patientAge: 78,
      patientPhone: '555-1234',
      patientAddress: '123 Main St, Apt 4B',
      buildingLocation: 'Apartment complex, Building A',
      floorNumber: '4',
      elevatorRequired: true,
      parkingInstructions: 'Visitor lot in back',
      mobilityStatus: 'Wheelchair user',
      medicalEquipment: ['Oxygen concentrator', 'CPAP machine'],
      communicationNeeds: 'Hearing impaired - knock loudly',
      accessInstructions: 'Key under mat, door code 1234',
      pets: '1 small dog - friendly',
      responsePriority: 'critical',
      specialInstructions: 'May be slow to answer door.',
      emergencyContacts: [
        { name: 'Jane Doe', relationship: 'Daughter', phone: '555-5678', isPrimary: true },
      ],
      neighborInfo: { name: 'Tom Wilson', address: 'Apt 4A', phone: '555-4321' },
      fallRisk: true,
      cognitiveImpairment: true,
      oxygenDependent: true,
      lastCheckInTime: '2025-01-20T08:00:00Z',
      hoursSinceCheckIn: 8.5,
    }),
  },
}));

// Mock the Envision Atlus components
vi.mock('../../envision-atlus', () => ({
  EACard: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <div data-testid="ea-card" data-variant={variant}>{children}</div>
  ),
  EACardHeader: ({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) => (
    <div data-testid="ea-card-header">{icon}{children}</div>
  ),
  EACardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card-content" className={className}>{children}</div>
  ),
  EAButton: ({ children, onClick, disabled, icon, className, ...props }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    icon?: React.ReactNode;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className} {...props}>
      {icon}{children}
    </button>
  ),
  EABadge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid="ea-badge" data-variant={variant}>{children}</span>
  ),
  EARiskIndicator: ({ level, label, variant, showIcon: _showIcon }: { level: string; label?: string; variant?: string; showIcon?: boolean }) => (
    <span data-testid="ea-risk-indicator" data-level={level} data-variant={variant}>{label}</span>
  ),
}));

// Import after mocks
import { ConstableDispatchDashboard } from '../ConstableDispatchDashboard';
import { LawEnforcementService } from '../../../services/lawEnforcementService';

describe('ConstableDispatchDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Welfare Check Queue')).toBeInTheDocument();
      });
    });

    it('should render queue header with count', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/2 seniors requiring attention/)).toBeInTheDocument();
      });
    });

    it('should render refresh button', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument();
      });
    });

    it('should show placeholder when no patient selected', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Select a senior from the list')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should load alerts on mount', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(LawEnforcementService.getMissedCheckInAlerts).toHaveBeenCalled();
      });
    });
  });

  describe('Alerts List', () => {
    it('should render all alerts in the queue', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Mary Smith')).toBeInTheDocument();
      });
    });

    it('should display patient addresses', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByText('123 Main St, Apt 4B')).toBeInTheDocument();
        expect(screen.getByText('456 Oak Ave')).toBeInTheDocument();
      });
    });

    it('should display urgency scores', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
        expect(screen.getByText('85')).toBeInTheDocument();
      });
    });

    it('should display priority badges', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByText('CRITICAL')).toBeInTheDocument();
        expect(screen.getByText('HIGH')).toBeInTheDocument();
      });
    });

    it('should display hours since check-in', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByText('8.5h ago')).toBeInTheDocument();
        expect(screen.getByText('6.2h ago')).toBeInTheDocument();
      });
    });

    it('should display special needs', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Oxygen dependent, cognitive impairment')).toBeInTheDocument();
        expect(screen.getByText('Fall risk')).toBeInTheDocument();
      });
    });

    it('should display emergency contact info', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
        expect(screen.getByText(/555-5678/)).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no alerts', async () => {
      vi.mocked(LawEnforcementService.getMissedCheckInAlerts).mockResolvedValueOnce([]);

      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByText('All Clear!')).toBeInTheDocument();
        expect(screen.getByText('No welfare checks needed at this time')).toBeInTheDocument();
      });
    });
  });

  describe('Patient Selection', () => {
    it('should load welfare check info when patient is clicked', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const patientCard = screen.getByText('John Doe').closest('div[class*="cursor-pointer"]');
      if (patientCard) {
        await userEvent.click(patientCard);
      }

      await waitFor(() => {
        expect(LawEnforcementService.getWelfareCheckInfo).toHaveBeenCalledWith('patient-1');
      });
    });

    it('should display patient details when selected', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const patientCard = screen.getByText('John Doe').closest('div[class*="cursor-pointer"]');
      if (patientCard) {
        await userEvent.click(patientCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Age 78')).toBeInTheDocument();
      });
    });

    it('should display emergency response info when patient selected', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const patientCard = screen.getByText('John Doe').closest('div[class*="cursor-pointer"]');
      if (patientCard) {
        await userEvent.click(patientCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Emergency Response Info')).toBeInTheDocument();
      });
    });
  });

  describe('Action Buttons', () => {
    it('should display action buttons when patient selected', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const patientCard = screen.getByText('John Doe').closest('div[class*="cursor-pointer"]');
      if (patientCard) {
        await userEvent.click(patientCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Call Contact')).toBeInTheDocument();
        expect(screen.getByText('Dispatch Now')).toBeInTheDocument();
        expect(screen.getByText('Complete Check')).toBeInTheDocument();
      });
    });
  });

  describe('Auto-Refresh', () => {
    it('should auto-refresh alerts every 2 minutes', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(LawEnforcementService.getMissedCheckInAlerts).toHaveBeenCalledTimes(1);
      });

      // Advance time by 2 minutes
      vi.advanceTimersByTime(2 * 60 * 1000);

      await waitFor(() => {
        expect(LawEnforcementService.getMissedCheckInAlerts).toHaveBeenCalledTimes(2);
      });

      vi.useRealTimers();
    });
  });

  describe('Manual Refresh', () => {
    it('should refresh alerts when refresh button is clicked', async () => {
      render(<ConstableDispatchDashboard />);

      await waitFor(() => {
        expect(LawEnforcementService.getMissedCheckInAlerts).toHaveBeenCalledTimes(1);
      });

      const refreshButton = screen.getByRole('button', { name: /Refresh/i });
      await userEvent.click(refreshButton);

      await waitFor(() => {
        expect(LawEnforcementService.getMissedCheckInAlerts).toHaveBeenCalledTimes(2);
      });
    });
  });
});
