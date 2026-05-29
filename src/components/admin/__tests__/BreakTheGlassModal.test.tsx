/**
 * Tests for BreakTheGlassModal — ONC 170.315(d)(6) emergency access.
 *
 * Behavioral — each test would fail if the component rendered an empty <div />.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BreakTheGlassModal } from '../BreakTheGlassModal';
import { emergencyAccessService } from '../../../services/emergencyAccessService';

vi.mock('../../../services/emergencyAccessService', () => ({
  emergencyAccessService: {
    grantAccess: vi.fn(),
    revokeAccess: vi.fn(),
    hasActiveAccess: vi.fn(),
  },
}));

const mockedGrant = vi.mocked(emergencyAccessService.grantAccess);
const mockedRevoke = vi.mocked(emergencyAccessService.revokeAccess);

const PATIENT_ID = '00000000-0000-0000-0000-000000000001';

function grantOk() {
  return {
    success: true as const,
    data: {
      accessId: 'acc-123',
      accessingUserName: 'Dr. Test',
      patientName: 'Test Patient',
      tenantId: 'tenant-x',
      grantedAt: '2026-05-29T10:00:00.000Z',
      expiresAt: '2026-05-29T11:00:00.000Z',
      durationMinutes: 60,
      shouldNotifySupervisor: true,
    },
    error: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGrant.mockReset();
  mockedRevoke.mockReset();
  mockedGrant.mockResolvedValue(grantOk());
  mockedRevoke.mockResolvedValue({ success: true as const, data: { accessId: 'acc-123' }, error: null });
});

describe('BreakTheGlassModal — ONC (d)(6) capture behavior', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <BreakTheGlassModal patientId={PATIENT_ID} isOpen={false} onClose={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the justification form when open', () => {
    render(<BreakTheGlassModal patientId={PATIENT_ID} isOpen onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/reason for emergency access/i)).toBeInTheDocument();
  });

  it('blocks the grant when no reason is selected', async () => {
    render(<BreakTheGlassModal patientId={PATIENT_ID} isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /break the glass/i }));
    expect(await screen.findByText(/select a reason/i)).toBeInTheDocument();
    expect(mockedGrant).not.toHaveBeenCalled();
  });

  it('requires an explanation when reason is "Other"', async () => {
    render(<BreakTheGlassModal patientId={PATIENT_ID} isOpen onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/reason for emergency access/i), {
      target: { value: 'other' },
    });
    fireEvent.click(screen.getByRole('button', { name: /break the glass/i }));
    expect(await screen.findByText(/describe the reason/i)).toBeInTheDocument();
    expect(mockedGrant).not.toHaveBeenCalled();
  });

  it('records the grant with the reason label + duration and shows the expiry', async () => {
    const onGranted = vi.fn();
    render(<BreakTheGlassModal patientId={PATIENT_ID} isOpen onClose={() => {}} onGranted={onGranted} />);

    fireEvent.change(screen.getByLabelText(/reason for emergency access/i), {
      target: { value: 'life_threatening' },
    });
    fireEvent.change(screen.getByLabelText(/access duration/i), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: /break the glass/i }));

    await waitFor(() => expect(mockedGrant).toHaveBeenCalledTimes(1));
    const arg = mockedGrant.mock.calls[0][0];
    expect(arg.patientId).toBe(PATIENT_ID);
    expect(arg.reason).toBe('Life-threatening emergency');
    expect(arg.durationMinutes).toBe(120);

    expect(await screen.findByText(/emergency access recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/a supervisor will be notified/i)).toBeInTheDocument();
    expect(onGranted).toHaveBeenCalledWith(grantOk().data);
  });

  it('surfaces a server error and does not show the confirmation', async () => {
    mockedGrant.mockResolvedValueOnce({
      success: false as const,
      data: null,
      error: { code: 'OPERATION_FAILED', message: 'CROSS_TENANT_DENIED' },
    });
    render(<BreakTheGlassModal patientId={PATIENT_ID} isOpen onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/reason for emergency access/i), {
      target: { value: 'life_threatening' },
    });
    fireEvent.click(screen.getByRole('button', { name: /break the glass/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/cross_tenant_denied/i);
    expect(screen.queryByText(/emergency access recorded/i)).not.toBeInTheDocument();
  });

  it('lets the accessor end the grant early (revoke)', async () => {
    render(<BreakTheGlassModal patientId={PATIENT_ID} isOpen onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/reason for emergency access/i), {
      target: { value: 'life_threatening' },
    });
    fireEvent.click(screen.getByRole('button', { name: /break the glass/i }));

    const endBtn = await screen.findByRole('button', { name: /end access now/i });
    fireEvent.click(endBtn);

    await waitFor(() => expect(mockedRevoke).toHaveBeenCalledWith('acc-123'));
    expect(await screen.findByText(/emergency access has been ended/i)).toBeInTheDocument();
  });

  it('calls onClose from the Cancel button', () => {
    const onClose = vi.fn();
    render(<BreakTheGlassModal patientId={PATIENT_ID} isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
