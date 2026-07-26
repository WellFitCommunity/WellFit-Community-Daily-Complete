/**
 * HandoffPacketViewPage tests — packet detail view at /handoff/view/:id (tracker H-1b).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

const mockGetPacket = vi.fn();
const mockDecryptPHI = vi.fn();
const mockGetAttachments = vi.fn();
const mockGetLogs = vi.fn();

vi.mock('../../services/handoffService', () => ({
  default: {
    getPacket: (...args: unknown[]) => mockGetPacket(...args),
    decryptPHI: (...args: unknown[]) => mockDecryptPHI(...args),
    getAttachments: (...args: unknown[]) => mockGetAttachments(...args),
    getLogs: (...args: unknown[]) => mockGetLogs(...args),
  },
}));

vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    phi: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

import HandoffPacketViewPage from '../HandoffPacketViewPage';

const TEST_PACKET = {
  id: 'packet-test-id',
  packet_number: 'HT-TEST-0001',
  patient_id: 'patient-test-id',
  patient_name_encrypted: 'enc-name',
  patient_dob_encrypted: 'enc-dob',
  patient_mrn: 'TEST-MRN-0001',
  sending_facility: 'Test Sending Hospital',
  receiving_facility: 'Test Receiving Hospital',
  urgency_level: 'critical',
  reason_for_transfer: 'Higher level of care',
  sender_provider_name: 'Test Provider Alpha',
  sender_callback_number: '555-0100',
  sender_notes: 'Synthetic packet for tests',
  status: 'sent',
  clinical_data: {
    vitals: { blood_pressure_systolic: 150, blood_pressure_diastolic: 90, heart_rate: 110 },
  },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/handoff/view/packet-test-id']}>
      <Routes>
        <Route path="/handoff/view/:id" element={<HandoffPacketViewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('HandoffPacketViewPage', () => {
  beforeEach(() => {
    mockGetPacket.mockReset().mockResolvedValue(TEST_PACKET);
    mockDecryptPHI
      .mockReset()
      .mockResolvedValueOnce('Test Patient Alpha')
      .mockResolvedValueOnce('2000-01-01');
    mockGetAttachments.mockReset().mockResolvedValue([
      {
        id: 'att-1',
        handoff_packet_id: 'packet-test-id',
        file_name: 'test-lab-results.pdf',
        file_type: 'lab_results',
        storage_bucket: 'handoff-attachments',
        storage_path: 'x',
        is_encrypted: true,
        created_at: new Date().toISOString(),
      },
    ]);
    mockGetLogs.mockReset().mockResolvedValue([
      {
        id: 1,
        handoff_packet_id: 'packet-test-id',
        event_type: 'sent',
        event_description: 'Packet sent to receiving facility',
        timestamp: new Date().toISOString(),
      },
    ]);
  });

  it('renders decrypted patient identity, transfer details, vitals, attachments, and audit trail', async () => {
    renderPage();

    expect(await screen.findByText('Transfer Packet HT-TEST-0001')).toBeInTheDocument();
    expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
    expect(screen.getByText('2000-01-01')).toBeInTheDocument();
    expect(screen.getByText('TEST-MRN-0001')).toBeInTheDocument();
    expect(screen.getByText('Higher level of care')).toBeInTheDocument();
    expect(screen.getByText('150/90 mmHg')).toBeInTheDocument();
    expect(screen.getByText('test-lab-results.pdf')).toBeInTheDocument();
    expect(screen.getByText('Packet sent to receiving facility')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('shows an error state when the packet cannot be loaded', async () => {
    mockGetPacket.mockRejectedValue(new Error('not found'));
    renderPage();

    expect(
      await screen.findByText(/Unable to load transfer packet/i)
    ).toBeInTheDocument();
  });
});
