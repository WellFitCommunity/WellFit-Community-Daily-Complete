/**
 * Tests for HospitalTransferPortal Component
 *
 * ENTERPRISE-GRADE TESTS:
 * - Rendering states (loading, error, empty, populated)
 * - Service integration (HandoffService mock)
 * - User interactions (tab switching, selection, acknowledgement)
 * - Audit logging verification
 * - Error handling
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import HospitalTransferPortal from '../HospitalTransferPortal';
import type { HandoffPacket, HandoffPacketStats } from '../../types/handoff';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockPackets: HandoffPacket[] = [
  {
    id: 'packet-001',
    packet_number: 'HO-20251229-000001',
    patient_mrn: 'MRN-12345',
    patient_name_encrypted: 'encrypted_john_doe',
    patient_dob_encrypted: 'encrypted_1960-01-15',
    patient_gender: 'M',
    sending_facility: 'Methodist Hospital - Texas Medical Center',
    receiving_facility: 'Methodist Hospital - Sugar Land',
    urgency_level: 'urgent',
    reason_for_transfer: 'Step-down care after cardiac catheterization',
    clinical_data: {
      medications_given: [{ name: 'Aspirin', dosage: '81mg' }],
      medications_prescribed: [{ name: 'Metoprolol', dosage: '25mg' }],
      allergies: [{ allergen: 'Penicillin', reaction: 'Rash', severity: 'moderate' }],
      labs: [{ test_name: 'Troponin', value: '0.05', unit: 'ng/mL' }],
    },
    sender_provider_name: 'Dr. Smith',
    sender_callback_number: '(713) 555-1234',
    sender_notes: 'Patient stable, ready for transfer',
    status: 'sent',
    access_token: 'abc123',
    access_expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    created_by: 'user-001',
  },
  {
    id: 'packet-002',
    packet_number: 'HO-20251229-000002',
    patient_mrn: 'MRN-67890',
    patient_name_encrypted: 'encrypted_jane_smith',
    patient_dob_encrypted: 'encrypted_1975-05-20',
    patient_gender: 'F',
    sending_facility: 'Methodist Hospital Clear Lake',
    receiving_facility: 'Methodist Hospital - Texas Medical Center',
    urgency_level: 'critical',
    reason_for_transfer: 'STEMI requiring PCI',
    clinical_data: {
      medications_given: [{ name: 'Heparin', dosage: '5000 units' }],
      allergies: [],
      labs: [{ test_name: 'Troponin', value: '2.5', unit: 'ng/mL', abnormal: true }],
    },
    sender_provider_name: 'Dr. Johnson',
    sender_callback_number: '(281) 555-9876',
    status: 'sent',
    access_token: 'def456',
    access_expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    created_by: 'user-002',
  },
  {
    id: 'packet-003',
    packet_number: 'HO-20251229-000003',
    patient_mrn: 'MRN-11111',
    patient_name_encrypted: 'encrypted_bob_wilson',
    patient_dob_encrypted: 'encrypted_1950-12-01',
    patient_gender: 'M',
    sending_facility: 'Methodist Hospital - Texas Medical Center',
    receiving_facility: 'Methodist Willowbrook',
    urgency_level: 'routine',
    reason_for_transfer: 'SNF placement for rehab',
    clinical_data: {},
    sender_provider_name: 'Dr. Lee',
    sender_callback_number: '(713) 555-5555',
    status: 'acknowledged',
    access_token: 'ghi789',
    access_expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    sent_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    acknowledged_at: new Date().toISOString(),
    created_by: 'user-001',
  },
];

const mockStats: HandoffPacketStats = {
  total_packets: 3,
  sent_packets: 2,
  acknowledged_packets: 1,
  pending_acknowledgement: 2,
  average_acknowledgement_time_minutes: 45,
  packets_by_status: {
    draft: 0,
    sent: 2,
    acknowledged: 1,
    cancelled: 0,
  },
  packets_by_urgency: {
    routine: 1,
    urgent: 1,
    emergent: 0,
    critical: 1,
  },
};

// ============================================================================
// MOCKS
// ============================================================================

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../services/handoffService', () => ({
  default: {
    listPackets: vi.fn(),
    getStats: vi.fn(),
    decryptPHI: vi.fn(),
    acknowledgePacket: vi.fn(),
  },
}));

vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
    clinical: vi.fn(),
  },
}));

import HandoffService from '../../services/handoffService';
import { auditLogger } from '../../services/auditLogger';

// Cast to mock types for proper mock function usage
const mockListPackets = HandoffService.listPackets as ReturnType<typeof vi.fn>;
const mockGetStats = HandoffService.getStats as ReturnType<typeof vi.fn>;
const mockDecryptPHI = HandoffService.decryptPHI as ReturnType<typeof vi.fn>;
const mockAcknowledgePacket = HandoffService.acknowledgePacket as ReturnType<typeof vi.fn>;
const mockAuditClinical = auditLogger.clinical as ReturnType<typeof vi.fn>;
const mockAuditError = auditLogger.error as ReturnType<typeof vi.fn>;

// ============================================================================
// TEST UTILITIES
// ============================================================================

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {ui}
      <ToastContainer />
    </BrowserRouter>
  );
};

// ============================================================================
// TESTS
// ============================================================================

describe('HospitalTransferPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful mocks
    mockListPackets.mockResolvedValue(mockPackets);
    mockGetStats.mockResolvedValue(mockStats);
    mockDecryptPHI.mockImplementation(async (encrypted: string) => {
      // Return mock decrypted names based on input
      if (encrypted.includes('john')) return 'John Doe';
      if (encrypted.includes('jane')) return 'Jane Smith';
      if (encrypted.includes('bob')) return 'Bob Wilson';
      return 'Unknown Patient';
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', async () => {
      // Delay the mock to see loading state
      mockListPackets.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );
      mockGetStats.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockStats), 100))
      );

      renderWithRouter(<HospitalTransferPortal />);

      expect(screen.getByText('Loading Transfer Portal...')).toBeInTheDocument();
    });

    it('should hide loading spinner after data loads', async () => {
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.queryByText('Loading Transfer Portal...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('should show error message when data fails to load', async () => {
      mockListPackets.mockRejectedValue(new Error('Network error'));
      mockGetStats.mockRejectedValue(new Error('Network error'));

      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Transfers')).toBeInTheDocument();
      });
    });

    it('should show Try Again button on error', async () => {
      mockListPackets.mockRejectedValue(new Error('Network error'));
      mockGetStats.mockRejectedValue(new Error('Network error'));

      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('should log error via auditLogger', async () => {
      mockListPackets.mockRejectedValue(new Error('Network error'));
      mockGetStats.mockRejectedValue(new Error('Network error'));

      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(mockAuditError).toHaveBeenCalledWith(
          'TRANSFER_PORTAL_LOAD_FAILED',
          expect.any(String),
          expect.any(Object)
        );
      });
    });
  });

  describe('Rendering with Data', () => {
    it('should render header with title', async () => {
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('Hospital Transfer Portal')).toBeInTheDocument();
        expect(screen.getByText('Secure Inter-Facility Patient Transfers')).toBeInTheDocument();
      });
    });

    it('should render metrics cards', async () => {
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('Pending Out')).toBeInTheDocument();
        expect(screen.getByText('Pending In')).toBeInTheDocument();
        expect(screen.getByText('In Transit')).toBeInTheDocument();
        expect(screen.getByText('Completed')).toBeInTheDocument();
        expect(screen.getByText('Avg Time')).toBeInTheDocument();
        expect(screen.getByText('Compliance')).toBeInTheDocument();
      });
    });

    it('should render outgoing and incoming tabs', async () => {
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText(/Outgoing Transfers/)).toBeInTheDocument();
        expect(screen.getByText(/Incoming Transfers/)).toBeInTheDocument();
      });
    });

    it('should display decrypted patient names', async () => {
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('should log successful data load', async () => {
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(mockAuditClinical).toHaveBeenCalledWith(
          'TRANSFER_PORTAL_LOAD',
          true,
          expect.objectContaining({
            packet_count: 3,
          })
        );
      });
    });
  });

  describe('Critical Transfer Alert', () => {
    it('should show alert banner for critical in-transit transfers', async () => {
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('CRITICAL TRANSFER IN PROGRESS:')).toBeInTheDocument();
        expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should default to outgoing tab', async () => {
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        const outgoingTab = screen.getByText(/Outgoing Transfers/);
        expect(outgoingTab.closest('button')).toHaveClass('text-blue-400');
      });
    });

    it('should switch to incoming tab when clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText(/Outgoing Transfers/)).toBeInTheDocument();
      });

      const incomingTab = screen.getByText(/Incoming Transfers/);
      await user.click(incomingTab);

      expect(incomingTab.closest('button')).toHaveClass('text-blue-400');
    });
  });

  describe('Transfer List', () => {
    it('should show outgoing transfers for current facility', async () => {
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        // John Doe and Bob Wilson are outgoing from Methodist TMC
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
      });
    });

    it('should show incoming transfers when tab is switched', async () => {
      const user = userEvent.setup();
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText(/Incoming Transfers/)).toBeInTheDocument();
      });

      const incomingTab = screen.getByText(/Incoming Transfers/);
      await user.click(incomingTab);

      await waitFor(() => {
        // Jane Smith is incoming to Methodist TMC
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should display urgency badges', async () => {
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('URGENT')).toBeInTheDocument();
        expect(screen.getByText('ROUTINE')).toBeInTheDocument();
      });
    });

    it('should display status badges', async () => {
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('IN TRANSIT')).toBeInTheDocument();
        expect(screen.getByText('RECEIVED')).toBeInTheDocument();
      });
    });

    it('should show medication and allergy counts', async () => {
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('2 Medications')).toBeInTheDocument();
        expect(screen.getByText('1 Allergies')).toBeInTheDocument();
      });
    });
  });

  describe('Transfer Selection', () => {
    it('should show transfer details when clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on the patient name text directly
      await user.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(screen.getByText(/Transfer Details:/)).toBeInTheDocument();
        expect(screen.getByText(/Provider:/)).toBeInTheDocument();
      });
    });

    it('should show View Full Packet button', async () => {
      const user = userEvent.setup();
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on the patient name text
      await user.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(screen.getByText('View Full Packet')).toBeInTheDocument();
      });
    });
  });

  describe('Actions', () => {
    it('should navigate to transfer logs when button clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('Transfer Logs')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Transfer Logs'));
      expect(mockNavigate).toHaveBeenCalledWith('/transfer-logs');
    });

    it('should navigate to new transfer when button clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('New Transfer')).toBeInTheDocument();
      });

      await user.click(screen.getByText('New Transfer'));
      expect(mockNavigate).toHaveBeenCalledWith('/handoff/send');
    });

    it('should refresh data when refresh button clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Refresh'));

      // Should call listPackets again
      await waitFor(() => {
        expect(mockListPackets).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Acknowledge Transfer', () => {
    it('should show acknowledge button for incoming sent transfers', async () => {
      const user = userEvent.setup();
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText(/Incoming Transfers/)).toBeInTheDocument();
      });

      // Switch to incoming tab
      await user.click(screen.getByText(/Incoming Transfers/));

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Select the incoming transfer
      const transferCard = screen.getByText('Jane Smith').closest('div[class*="cursor-pointer"]');
      if (transferCard) {
        await user.click(transferCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Acknowledge Receipt')).toBeInTheDocument();
      });
    });

    it('should call acknowledgePacket when acknowledge button clicked', async () => {
      const user = userEvent.setup();
      mockAcknowledgePacket.mockResolvedValue(mockPackets[1]);

      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText(/Incoming Transfers/)).toBeInTheDocument();
      });

      // Switch to incoming tab
      await user.click(screen.getByText(/Incoming Transfers/));

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Select the incoming transfer
      const transferCard = screen.getByText('Jane Smith').closest('div[class*="cursor-pointer"]');
      if (transferCard) {
        await user.click(transferCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Acknowledge Receipt')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Acknowledge Receipt'));

      await waitFor(() => {
        expect(mockAcknowledgePacket).toHaveBeenCalledWith({
          packet_id: 'packet-002',
          acknowledgement_notes: 'Acknowledged via Hospital Transfer Portal',
        });
      });
    });

    it('should log successful acknowledgement', async () => {
      const user = userEvent.setup();
      mockAcknowledgePacket.mockResolvedValue(mockPackets[1]);

      renderWithRouter(<HospitalTransferPortal />);

      // Switch to incoming and select transfer
      await waitFor(() => screen.getByText(/Incoming Transfers/));
      await user.click(screen.getByText(/Incoming Transfers/));
      await waitFor(() => screen.getByText('Jane Smith'));

      const transferCard = screen.getByText('Jane Smith').closest('div[class*="cursor-pointer"]');
      if (transferCard) await user.click(transferCard);

      await waitFor(() => screen.getByText('Acknowledge Receipt'));
      await user.click(screen.getByText('Acknowledge Receipt'));

      await waitFor(() => {
        expect(mockAuditClinical).toHaveBeenCalledWith(
          'TRANSFER_ACKNOWLEDGE',
          true,
          expect.objectContaining({
            packet_id: 'packet-002',
          })
        );
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no outgoing transfers', async () => {
      mockListPackets.mockResolvedValue([mockPackets[1]]); // Only incoming

      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('No outgoing transfers')).toBeInTheDocument();
        expect(screen.getByText('Create Transfer')).toBeInTheDocument();
      });
    });

    it('should show empty state when no incoming transfers', async () => {
      const user = userEvent.setup();
      mockListPackets.mockResolvedValue([mockPackets[0], mockPackets[2]]); // Only outgoing

      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText(/Incoming Transfers/)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/Incoming Transfers/));

      await waitFor(() => {
        expect(screen.getByText('No incoming transfers')).toBeInTheDocument();
      });
    });
  });

  describe('Footer', () => {
    it('should render compliance badges', async () => {
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('HIPAA Compliant')).toBeInTheDocument();
        expect(screen.getByText('HL7 FHIR Ready')).toBeInTheDocument();
        expect(screen.getByText('Joint Commission')).toBeInTheDocument();
      });
    });

    it('should show total transfer count', async () => {
      renderWithRouter(<HospitalTransferPortal />);

      await waitFor(() => {
        expect(screen.getByText('3 total transfers')).toBeInTheDocument();
      });
    });
  });
});
