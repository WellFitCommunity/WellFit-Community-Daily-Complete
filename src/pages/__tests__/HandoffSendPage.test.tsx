/**
 * HandoffSendPage tests — the sender entry point at /handoff/send (tracker H-1a).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { HandoffPacket } from '../../types/handoff';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

interface MockSenderProps {
  onPacketCreated?: (packet: HandoffPacket, accessUrl: string) => void;
}
let capturedSenderProps: MockSenderProps = {};
vi.mock('../../components/handoff/LiteSenderPortal', () => ({
  default: (props: MockSenderProps) => {
    capturedSenderProps = props;
    return <div data-testid="lite-sender-portal">Sender form</div>;
  },
}));

import { toast } from 'react-toastify';
import HandoffSendPage from '../HandoffSendPage';

describe('HandoffSendPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.mocked(toast.success).mockClear();
    capturedSenderProps = {};
  });

  it('renders the sender form with the page heading', () => {
    render(
      <MemoryRouter>
        <HandoffSendPage />
      </MemoryRouter>
    );
    expect(screen.getByText('New Patient Transfer')).toBeInTheDocument();
    expect(screen.getByTestId('lite-sender-portal')).toBeInTheDocument();
  });

  it('navigates back to the transfer portal', () => {
    render(
      <MemoryRouter>
        <HandoffSendPage />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Back to Transfer Portal'));
    expect(mockNavigate).toHaveBeenCalledWith('/hospital-transfer');
  });

  it('toasts and returns to the portal after a packet is created', () => {
    render(
      <MemoryRouter>
        <HandoffSendPage />
      </MemoryRouter>
    );
    capturedSenderProps.onPacketCreated?.(
      {
        packet_number: 'HT-TEST-0002',
        receiving_facility: 'Test Receiving Hospital',
      } as unknown as HandoffPacket,
      'https://example.test/handoff/receiving'
    );
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('HT-TEST-0002'),
      expect.anything()
    );
    expect(mockNavigate).toHaveBeenCalledWith('/hospital-transfer');
  });
});
