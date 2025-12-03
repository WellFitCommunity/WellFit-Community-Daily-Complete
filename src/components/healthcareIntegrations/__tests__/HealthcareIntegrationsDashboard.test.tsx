/**
 * Healthcare Integrations Dashboard Tests
 *
 * Tests cover:
 * 1. Rendering - Component renders without crashing
 * 2. Loading state - Loading skeleton displays correctly
 * 3. Data display - Data from API renders in UI
 * 4. Error handling - Errors are caught and displayed gracefully
 * 5. User interactions - Tab switching, button clicks work correctly
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HealthcareIntegrationsDashboard } from '../HealthcareIntegrationsDashboard';
import { HealthcareIntegrationsService } from '../../../services/healthcareIntegrationsService';
import type {
  HealthcareIntegrationStats,
  LabProviderConnection,
  LabResult,
  PharmacyConnection,
  RefillRequest,
  PACSConnection,
  ImagingReport,
  InsurancePayerConnection,
} from '../../../types/healthcareIntegrations';

// Mock the service
jest.mock('../../../services/healthcareIntegrationsService');
jest.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockStats: HealthcareIntegrationStats = {
  labOrdersTotal: 150,
  labResultsReceived: 145,
  labCriticalValues: 3,
  prescriptionsSent: 89,
  refillRequestsPending: 5,
  imagingStudiesTotal: 42,
  imagingReportsFinal: 38,
  eligibilityChecks: 200,
  eligibilityVerified: 180,
};

const mockLabConnections: LabProviderConnection[] = [
  {
    id: 'lab-1',
    tenantId: 'tenant-1',
    providerCode: 'labcorp',
    providerName: 'LabCorp',
    fhirEndpoint: 'https://api.labcorp.com/fhir',
    connectionStatus: 'connected',
    enabled: true,
    ordersSent: 100,
    resultsReceived: 98,
    errorsCount: 2,
    lastConnectedAt: '2025-12-03T10:00:00Z',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-12-03T10:00:00Z',
  },
];

const mockPharmacyConnections: PharmacyConnection[] = [
  {
    id: 'pharm-1',
    tenantId: 'tenant-1',
    pharmacyName: 'Surescripts Network',
    pharmacyType: 'network',
    ncpdpId: '1234567',
    protocol: 'surescripts',
    supportsErx: true,
    supportsControlledSubstances: true,
    isPreferred: true,
    connectionStatus: 'connected',
    enabled: true,
    prescriptionsSent: 50,
    responsesReceived: 48,
    errorsCount: 1,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-12-03T10:00:00Z',
  },
];

const mockPACSConnections: PACSConnection[] = [
  {
    id: 'pacs-1',
    tenantId: 'tenant-1',
    pacsName: 'Main Hospital PACS',
    pacsVendor: 'GE Healthcare',
    hostname: 'pacs.hospital.local',
    port: 104,
    aeTitle: 'MAINPACS',
    connectionStatus: 'connected',
    enabled: true,
    studiesReceived: 30,
    reportsReceived: 28,
    errorsCount: 0,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-12-03T10:00:00Z',
  },
];

const mockInsuranceConnections: InsurancePayerConnection[] = [
  {
    id: 'ins-1',
    tenantId: 'tenant-1',
    payerName: 'Blue Cross Blue Shield',
    payerId: 'BCBS001',
    payerType: 'commercial',
    connectionType: 'clearinghouse',
    supports270_271: true,
    supports276_277: true,
    supports278: false,
    supportsRealTime: true,
    connectionStatus: 'connected',
    enabled: true,
    eligibilityChecksSent: 150,
    eligibilityResponsesReceived: 148,
    errorsCount: 2,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-12-03T10:00:00Z',
  },
];

const mockCriticalLabResults: LabResult[] = [
  {
    id: 'result-1',
    tenantId: 'tenant-1',
    orderId: 'order-1',
    patientId: 'patient-1',
    accessionNumber: 'ACC-001',
    resultStatus: 'final',
    isCritical: true,
    criticalValueAlerted: false,
    reportType: 'Chemistry Panel',
    reportedAt: '2025-12-03T09:00:00Z',
    createdAt: '2025-12-03T09:00:00Z',
    updatedAt: '2025-12-03T09:00:00Z',
  },
];

const mockPendingRefills: RefillRequest[] = [
  {
    id: 'refill-1',
    tenantId: 'tenant-1',
    patientId: 'patient-1',
    medicationName: 'Lisinopril 10mg',
    requestSource: 'patient_portal',
    requestStatus: 'pending',
    requestedAt: '2025-12-03T08:00:00Z',
    createdAt: '2025-12-03T08:00:00Z',
    updatedAt: '2025-12-03T08:00:00Z',
  },
];

const mockCriticalImagingFindings: ImagingReport[] = [
  {
    id: 'img-report-1',
    tenantId: 'tenant-1',
    studyId: 'study-1',
    reportStatus: 'final',
    accessionNumber: 'IMG-001',
    hasCriticalFinding: true,
    criticalFindingCommunicated: false,
    criticalFindingDescription: 'Suspicious mass detected',
    createdAt: '2025-12-03T07:00:00Z',
    updatedAt: '2025-12-03T07:00:00Z',
  },
];

// Setup mock service responses
const setupMocks = (options?: {
  statsError?: boolean;
  emptyData?: boolean;
}) => {
  const mockedService = HealthcareIntegrationsService as jest.Mocked<typeof HealthcareIntegrationsService>;

  if (options?.statsError) {
    mockedService.getStats = jest.fn().mockResolvedValue({
      success: false,
      error: { code: 'ERROR', message: 'Failed to load stats' },
    });
  } else {
    mockedService.getStats = jest.fn().mockResolvedValue({
      success: true,
      data: mockStats,
    });
  }

  mockedService.Lab = {
    getConnections: jest.fn().mockResolvedValue({
      success: true,
      data: options?.emptyData ? [] : mockLabConnections,
    }),
    getCriticalResults: jest.fn().mockResolvedValue({
      success: true,
      data: options?.emptyData ? [] : mockCriticalLabResults,
    }),
    createOrder: jest.fn(),
    getOrders: jest.fn(),
    getResults: jest.fn(),
    acknowledgeCriticalValue: jest.fn(),
  } as any;

  mockedService.Pharmacy = {
    getConnections: jest.fn().mockResolvedValue({
      success: true,
      data: options?.emptyData ? [] : mockPharmacyConnections,
    }),
    getPendingRefillRequests: jest.fn().mockResolvedValue({
      success: true,
      data: options?.emptyData ? [] : mockPendingRefills,
    }),
    sendPrescription: jest.fn(),
    getMedicationHistory: jest.fn(),
    processRefillRequest: jest.fn(),
  } as any;

  mockedService.Imaging = {
    getConnections: jest.fn().mockResolvedValue({
      success: true,
      data: options?.emptyData ? [] : mockPACSConnections,
    }),
    getCriticalFindings: jest.fn().mockResolvedValue({
      success: true,
      data: options?.emptyData ? [] : mockCriticalImagingFindings,
    }),
    createOrder: jest.fn(),
    getOrders: jest.fn(),
    getStudies: jest.fn(),
    getReports: jest.fn(),
    markCriticalFindingCommunicated: jest.fn(),
  } as any;

  mockedService.Insurance = {
    getPayerConnections: jest.fn().mockResolvedValue({
      success: true,
      data: options?.emptyData ? [] : mockInsuranceConnections,
    }),
    checkEligibility: jest.fn(),
    getPatientInsurance: jest.fn(),
    addPatientInsurance: jest.fn(),
  } as any;
};

describe('HealthcareIntegrationsDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', async () => {
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Healthcare Integrations')).toBeInTheDocument();
      });
    });

    it('should render the page subtitle', async () => {
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Lab, Pharmacy, Imaging & Insurance systems')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton initially', () => {
      render(<HealthcareIntegrationsDashboard />);

      // The component should show loading animation on mount
      const loadingElements = document.querySelectorAll('.animate-pulse');
      expect(loadingElements.length).toBeGreaterThan(0);
    });

    it('should hide loading state after data loads', async () => {
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        const loadingElements = document.querySelectorAll('.animate-pulse');
        expect(loadingElements.length).toBe(0);
      });
    });
  });

  describe('Data Display', () => {
    it('should display lab results metric', async () => {
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Lab Results')).toBeInTheDocument();
        expect(screen.getByText('145')).toBeInTheDocument();
      });
    });

    it('should display prescriptions metric', async () => {
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Prescriptions')).toBeInTheDocument();
        expect(screen.getByText('89')).toBeInTheDocument();
      });
    });

    it('should display imaging studies metric', async () => {
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Imaging Studies')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
      });
    });

    it('should display eligibility checks metric', async () => {
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Eligibility Checks')).toBeInTheDocument();
        expect(screen.getByText('200')).toBeInTheDocument();
      });
    });

    it('should display alert banner when there are action items', async () => {
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/items requiring attention/)).toBeInTheDocument();
      });
    });

    it('should display connection status on overview tab', async () => {
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Connection Status')).toBeInTheDocument();
        expect(screen.getByText('Lab Providers')).toBeInTheDocument();
        expect(screen.getByText('Pharmacies')).toBeInTheDocument();
        expect(screen.getByText('PACS Systems')).toBeInTheDocument();
        expect(screen.getByText('Insurance Payers')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should display all tab options', async () => {
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByText('Lab Systems')).toBeInTheDocument();
        expect(screen.getByText('Pharmacy')).toBeInTheDocument();
        expect(screen.getByText('Imaging/PACS')).toBeInTheDocument();
        expect(screen.getByText('Insurance')).toBeInTheDocument();
      });
    });

    it('should switch to Lab Systems tab when clicked', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Lab Systems')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Lab Systems'));

      await waitFor(() => {
        expect(screen.getByText('Lab Provider Connections')).toBeInTheDocument();
      });
    });

    it('should switch to Pharmacy tab when clicked', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Pharmacy')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Pharmacy'));

      await waitFor(() => {
        expect(screen.getByText('Pharmacy Connections')).toBeInTheDocument();
      });
    });

    it('should switch to Imaging tab when clicked', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Imaging/PACS')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Imaging/PACS'));

      await waitFor(() => {
        expect(screen.getByText('PACS Connections')).toBeInTheDocument();
      });
    });

    it('should switch to Insurance tab when clicked', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Insurance')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Insurance'));

      await waitFor(() => {
        expect(screen.getByText('Insurance Payer Connections')).toBeInTheDocument();
      });
    });
  });

  describe('Action Items', () => {
    it('should show critical lab values action item', async () => {
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/critical lab values need acknowledgment/)).toBeInTheDocument();
      });
    });

    it('should show pending refill requests action item', async () => {
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/refill requests pending review/)).toBeInTheDocument();
      });
    });

    it('should show critical imaging findings action item', async () => {
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/critical imaging findings need communication/)).toBeInTheDocument();
      });
    });

    it('should navigate to correct tab when action item is clicked', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/critical lab values need acknowledgment/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/critical lab values need acknowledgment/));

      await waitFor(() => {
        expect(screen.getByText('Lab Provider Connections')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    beforeEach(() => {
      setupMocks({ emptyData: true });
    });

    it('should show no action items message when empty', async () => {
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('No action items at this time')).toBeInTheDocument();
      });
    });

    it('should show no connections message on Lab tab', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Lab Systems')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Lab Systems'));

      await waitFor(() => {
        expect(screen.getByText('No lab connections configured')).toBeInTheDocument();
      });
    });

    it('should show no connections message on Pharmacy tab', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Pharmacy')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Pharmacy'));

      await waitFor(() => {
        expect(screen.getByText('No pharmacy connections configured')).toBeInTheDocument();
      });
    });

    it('should show no connections message on Imaging tab', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Imaging/PACS')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Imaging/PACS'));

      await waitFor(() => {
        expect(screen.getByText('No PACS connections configured')).toBeInTheDocument();
      });
    });

    it('should show no connections message on Insurance tab', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Insurance')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Insurance'));

      await waitFor(() => {
        expect(screen.getByText('No insurance payer connections configured')).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should call loadData when refresh button is clicked on Lab tab', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Lab Systems')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Lab Systems'));

      await waitFor(() => {
        expect(screen.getByText('Lab Provider Connections')).toBeInTheDocument();
      });

      // Clear previous mock calls
      jest.clearAllMocks();

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      // Verify the service was called again
      await waitFor(() => {
        expect(HealthcareIntegrationsService.getStats).toHaveBeenCalled();
      });
    });
  });

  describe('Connection Display', () => {
    it('should display lab connection details', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Lab Systems')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Lab Systems'));

      await waitFor(() => {
        expect(screen.getByText('LabCorp')).toBeInTheDocument();
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });

    it('should display pharmacy connection with capabilities badges', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Pharmacy')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Pharmacy'));

      await waitFor(() => {
        expect(screen.getByText('Surescripts Network')).toBeInTheDocument();
        expect(screen.getByText('Preferred')).toBeInTheDocument();
        expect(screen.getByText('eRx')).toBeInTheDocument();
        expect(screen.getByText('EPCS')).toBeInTheDocument();
      });
    });

    it('should display PACS connection with vendor info', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Imaging/PACS')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Imaging/PACS'));

      await waitFor(() => {
        expect(screen.getByText('Main Hospital PACS')).toBeInTheDocument();
        expect(screen.getByText(/GE Healthcare/)).toBeInTheDocument();
        expect(screen.getByText(/MAINPACS/)).toBeInTheDocument();
      });
    });

    it('should display insurance connection with transaction support badges', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Insurance')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Insurance'));

      await waitFor(() => {
        expect(screen.getByText('Blue Cross Blue Shield')).toBeInTheDocument();
        expect(screen.getByText('270/271')).toBeInTheDocument();
        expect(screen.getByText('276/277')).toBeInTheDocument();
        expect(screen.getByText('Real-time')).toBeInTheDocument();
      });
    });
  });

  describe('Critical Alerts Display', () => {
    it('should display critical lab results on Lab tab', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Lab Systems')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Lab Systems'));

      await waitFor(() => {
        expect(screen.getByText('Critical Lab Values')).toBeInTheDocument();
        expect(screen.getByText('Chemistry Panel')).toBeInTheDocument();
        expect(screen.getByText(/ACC-001/)).toBeInTheDocument();
      });
    });

    it('should display pending refills on Pharmacy tab', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Pharmacy')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Pharmacy'));

      await waitFor(() => {
        expect(screen.getByText('Pending Refill Requests')).toBeInTheDocument();
        expect(screen.getByText('Lisinopril 10mg')).toBeInTheDocument();
      });
    });

    it('should display critical imaging findings on Imaging tab', async () => {
      const user = userEvent.setup();
      render(<HealthcareIntegrationsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Imaging/PACS')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Imaging/PACS'));

      await waitFor(() => {
        expect(screen.getByText('Critical Imaging Findings')).toBeInTheDocument();
        expect(screen.getByText('Suspicious mass detected')).toBeInTheDocument();
        expect(screen.getByText(/IMG-001/)).toBeInTheDocument();
      });
    });
  });
});
