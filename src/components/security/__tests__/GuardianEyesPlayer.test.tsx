import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock rrweb-player with proper class structure - must be before import
jest.mock('rrweb-player', () => {
  return class MockRRWebPlayer {
    pause = jest.fn();
    play = jest.fn();
    goto = jest.fn();
    constructor() {
      // Mock constructor
    }
  };
});

// Mock the CSS import
jest.mock('rrweb-player/dist/style.css', () => ({}));

import { GuardianEyesPlayer } from '../GuardianEyesPlayer';

// Mock the guardianEyesRecorder
const mockLoadRecording = jest.fn();
const mockSaveFor30Days = jest.fn();
const mockMarkReviewed = jest.fn();

jest.mock('../../../services/guardian-agent/GuardianEyesRecorder', () => ({
  guardianEyesRecorder: {
    loadRecording: (...args: unknown[]) => mockLoadRecording(...args),
    saveFor30Days: (...args: unknown[]) => mockSaveFor30Days(...args),
    markReviewed: (...args: unknown[]) => mockMarkReviewed(...args),
  },
}));

// Mock EA components
jest.mock('../../envision-atlus/EACard', () => ({
  EACard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card" className={className}>{children}</div>
  ),
  EACardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card-header" className={className}>{children}</div>
  ),
  EACardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ea-card-content">{children}</div>
  ),
}));

jest.mock('../../envision-atlus/EAButton', () => ({
  EAButton: ({ children, onClick, disabled, variant }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-testid={`ea-button-${variant || 'default'}`}
    >
      {children}
    </button>
  ),
}));

jest.mock('../../envision-atlus/EABadge', () => ({
  EABadge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid="ea-badge" data-variant={variant}>{children}</span>
  ),
}));

describe('GuardianEyesPlayer', () => {
  const mockSessionId = 'ge-1234567890-abc123def';
  const mockMetadata = {
    sessionId: mockSessionId,
    storagePath: 'recordings/healing_operation/ge-1234567890-abc123def.json',
    durationSeconds: 45,
    eventCount: 150,
    triggerType: 'healing_operation',
    triggerAlertId: 'alert-123',
    triggerDescription: 'Executing fix for memory_leak: Component cleanup issue',
  };

  const mockEvents = [
    { type: 0, data: {}, timestamp: 1000 },
    { type: 3, data: { x: 100, y: 200 }, timestamp: 1500 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadRecording.mockResolvedValue({
      events: mockEvents,
      metadata: mockMetadata,
    });
    mockSaveFor30Days.mockResolvedValue(true);
    mockMarkReviewed.mockResolvedValue(true);
  });

  it('should render loading state initially', () => {
    render(<GuardianEyesPlayer sessionId={mockSessionId} />);

    // Should show loading spinner
    expect(screen.getByTestId('ea-card')).toBeInTheDocument();
  });

  it('should load and display recording metadata', async () => {
    render(<GuardianEyesPlayer sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(mockLoadRecording).toHaveBeenCalledWith(mockSessionId);
    });

    await waitFor(() => {
      expect(screen.getByText(/Duration: 0:45/)).toBeInTheDocument();
      expect(screen.getByText(/Events: 150/)).toBeInTheDocument();
    });
  });

  it('should display trigger type badge', async () => {
    render(<GuardianEyesPlayer sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByTestId('ea-badge')).toBeInTheDocument();
      expect(screen.getByText('healing operation')).toBeInTheDocument();
    });
  });

  it('should display trigger description', async () => {
    render(<GuardianEyesPlayer sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText(/Executing fix for memory_leak/)).toBeInTheDocument();
    });
  });

  it('should show error when recording not found', async () => {
    mockLoadRecording.mockResolvedValue(null);

    render(<GuardianEyesPlayer sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText('Recording not found or has expired')).toBeInTheDocument();
    });
  });

  it('should show error when loading fails', async () => {
    mockLoadRecording.mockRejectedValue(new Error('Network error'));

    render(<GuardianEyesPlayer sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should render Save for 30 Days and Mark Reviewed buttons', async () => {
    render(<GuardianEyesPlayer sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText('Save for 30 Days')).toBeInTheDocument();
      expect(screen.getByText('Mark as Reviewed')).toBeInTheDocument();
    });
  });

  it('should open Save for 30 Days dialog when button clicked', async () => {
    const user = userEvent.setup();
    render(<GuardianEyesPlayer sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText('Save for 30 Days')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Save for 30 Days'));

    expect(screen.getByText('Extend Recording Retention')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Reason for extending/)).toBeInTheDocument();
  });

  it('should call saveFor30Days with reason when confirmed', async () => {
    const user = userEvent.setup();
    const onSaveFor30Days = jest.fn();

    render(
      <GuardianEyesPlayer
        sessionId={mockSessionId}
        onSaveFor30Days={onSaveFor30Days}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Save for 30 Days')).toBeInTheDocument();
    });

    // Open dialog
    await user.click(screen.getByText('Save for 30 Days'));

    // Type reason
    const textarea = screen.getByPlaceholderText(/Reason for extending/);
    await user.type(textarea, 'Needs further review');

    // Click save - find the button in the dialog
    const saveButtons = screen.getAllByText('Save for 30 Days');
    await user.click(saveButtons[saveButtons.length - 1]); // Click the dialog button

    await waitFor(() => {
      expect(mockSaveFor30Days).toHaveBeenCalledWith(mockSessionId, 'Needs further review');
      expect(onSaveFor30Days).toHaveBeenCalledWith(mockSessionId, 'Needs further review');
    });
  });

  it('should open Mark Reviewed dialog when button clicked', async () => {
    const user = userEvent.setup();
    render(<GuardianEyesPlayer sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText('Mark as Reviewed')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Mark as Reviewed'));

    expect(screen.getByText('Mark Recording as Reviewed')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Review notes/)).toBeInTheDocument();
  });

  it('should call markReviewed when confirmed', async () => {
    const user = userEvent.setup();
    const onMarkReviewed = jest.fn();

    render(
      <GuardianEyesPlayer
        sessionId={mockSessionId}
        onMarkReviewed={onMarkReviewed}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Mark as Reviewed')).toBeInTheDocument();
    });

    // Open dialog
    await user.click(screen.getByText('Mark as Reviewed'));

    // Type notes
    const textarea = screen.getByPlaceholderText(/Review notes/);
    await user.type(textarea, 'Fix looks good');

    // Click confirm
    await user.click(screen.getByText('Mark Reviewed'));

    await waitFor(() => {
      expect(mockMarkReviewed).toHaveBeenCalledWith(mockSessionId, 'Fix looks good');
      expect(onMarkReviewed).toHaveBeenCalledWith(mockSessionId, 'Fix looks good');
    });
  });

  it('should call onClose when close button clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    render(
      <GuardianEyesPlayer
        sessionId={mockSessionId}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Close'));

    expect(onClose).toHaveBeenCalled();
  });

  it('should disable save button when reason is empty', async () => {
    const user = userEvent.setup();
    render(<GuardianEyesPlayer sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText('Save for 30 Days')).toBeInTheDocument();
    });

    // Open dialog
    await user.click(screen.getByText('Save for 30 Days'));

    // Save button should be disabled without reason
    const saveButtons = screen.getAllByText('Save for 30 Days');
    const dialogSaveButton = saveButtons[saveButtons.length - 1];
    expect(dialogSaveButton).toBeDisabled();
  });

  it('should format duration correctly', async () => {
    mockLoadRecording.mockResolvedValue({
      events: mockEvents,
      metadata: { ...mockMetadata, durationSeconds: 125 }, // 2:05
    });

    render(<GuardianEyesPlayer sessionId={mockSessionId} />);

    await waitFor(() => {
      expect(screen.getByText(/Duration: 2:05/)).toBeInTheDocument();
    });
  });

  it('should use correct badge variant for security vulnerability', async () => {
    mockLoadRecording.mockResolvedValue({
      events: mockEvents,
      metadata: { ...mockMetadata, triggerType: 'security_vulnerability' },
    });

    render(<GuardianEyesPlayer sessionId={mockSessionId} />);

    await waitFor(() => {
      const badge = screen.getByTestId('ea-badge');
      expect(badge).toHaveAttribute('data-variant', 'critical');
    });
  });

  it('should use correct badge variant for memory leak', async () => {
    mockLoadRecording.mockResolvedValue({
      events: mockEvents,
      metadata: { ...mockMetadata, triggerType: 'memory_leak' },
    });

    render(<GuardianEyesPlayer sessionId={mockSessionId} />);

    await waitFor(() => {
      const badge = screen.getByTestId('ea-badge');
      expect(badge).toHaveAttribute('data-variant', 'high');
    });
  });
});
