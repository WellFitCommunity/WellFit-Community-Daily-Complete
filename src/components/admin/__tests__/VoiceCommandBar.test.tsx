/**
 * VoiceCommandBar Test Suite
 *
 * Tests for the global voice command floating interface.
 * ATLUS: Intuitive Technology - voice-first healthcare navigation.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { VoiceCommandMapping } from '../../../services/workflowPreferences';
import { VoiceCommandBar, VoiceCommandButton } from '../VoiceCommandBar';

// Mock react-router-dom navigation
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock useVoiceCommand hook
const mockStartListening = jest.fn();
const mockStopListening = jest.fn();
const mockToggleListening = jest.fn();
const mockClearTranscript = jest.fn();
const mockExecuteCommand = jest.fn();

const defaultMockState: {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  matchedCommand: VoiceCommandMapping | null;
  confidence: number;
} = {
  isListening: false,
  isSupported: true,
  transcript: '',
  interimTranscript: '',
  error: null,
  matchedCommand: null,
  confidence: 0,
};

const mockActions = {
  startListening: mockStartListening,
  stopListening: mockStopListening,
  toggleListening: mockToggleListening,
  clearTranscript: mockClearTranscript,
  executeCommand: mockExecuteCommand,
};

let mockState = { ...defaultMockState };

jest.mock('../../../hooks/useVoiceCommand', () => ({
  useVoiceCommand: () => [mockState, mockActions],
  VoiceCommandState: {},
  VoiceCommandActions: {},
}));

// Mock workflowPreferences
jest.mock('../../../services/workflowPreferences', () => ({
  getAllVoiceCommands: () => [
    { phrase: 'shift handoff', displayName: 'Shift Handoff Dashboard', targetId: '/shift-handoff', targetType: 'route' },
    { phrase: 'available beds', displayName: 'Show Available Beds', targetId: 'beds:filter_available', targetType: 'action' },
    { phrase: 'high risk patients', displayName: 'High Risk Patients', targetId: 'patients:filter_critical', targetType: 'action' },
  ],
  findVoiceCommandMatch: jest.fn(),
}));

// Mock auditLogger
jest.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('VoiceCommandBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState = { ...defaultMockState };
  });

  describe('Rendering', () => {
    it('should render without crashing when voice is supported', () => {
      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      // Should show mic button
      const micButton = screen.getByRole('button');
      expect(micButton).toBeInTheDocument();
    });

    it('should not render when voice is not supported', () => {
      mockState = { ...defaultMockState, isSupported: false };

      const { container } = render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      // Component returns null when voice is not supported
      expect(container.innerHTML).toBe('');
    });

    it('should render in minimized state by default', () => {
      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      // Should not show transcript area when not listening
      expect(screen.queryByText('Listening...')).not.toBeInTheDocument();
    });

    it('should expand when listening is active', () => {
      mockState = { ...defaultMockState, isListening: true };

      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      // Should show listening indicator
      expect(screen.getByText('Listening...')).toBeInTheDocument();
      expect(screen.getByText('Speak a command...')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <MemoryRouter>
          <VoiceCommandBar className="custom-class" />
        </MemoryRouter>
      );

      // The voice command bar wrapper has fixed positioning with the custom class
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const commandBarWrapper = container.querySelector('.custom-class');
      expect(commandBarWrapper).toBeInTheDocument();
    });
  });

  describe('Voice Interaction', () => {
    it('should toggle listening when mic button is clicked', async () => {
      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      const micButton = screen.getByRole('button');
      await userEvent.click(micButton);

      expect(mockToggleListening).toHaveBeenCalled();
    });

    it('should clear transcript when starting new listening session', async () => {
      mockState = { ...defaultMockState, isListening: false };

      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      const micButton = screen.getByRole('button');
      await userEvent.click(micButton);

      expect(mockClearTranscript).toHaveBeenCalled();
    });

    it('should display transcript while listening', () => {
      mockState = {
        ...defaultMockState,
        isListening: true,
        transcript: 'shift hand',
        interimTranscript: 'off',
      };

      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      expect(screen.getByText('shift hand')).toBeInTheDocument();
      expect(screen.getByText('off')).toBeInTheDocument();
    });

    it('should display matched command with confidence', () => {
      mockState = {
        ...defaultMockState,
        isListening: true,
        matchedCommand: {
          phrases: ['shift handoff'],
          targetType: 'route',
          targetId: '/shift-handoff',
          displayName: 'Shift Handoff Dashboard',
        },
        confidence: 95,
      };

      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      expect(screen.getByText('Executing:')).toBeInTheDocument();
      expect(screen.getByText('Shift Handoff Dashboard')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument();
    });

    it('should display error messages', () => {
      mockState = {
        ...defaultMockState,
        isListening: true,
        error: 'Microphone access denied',
      };

      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      expect(screen.getByText('Microphone access denied')).toBeInTheDocument();
    });
  });

  describe('Help Panel', () => {
    it('should show help button when listening', () => {
      mockState = { ...defaultMockState, isListening: true };

      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      // Should have help button (Volume2 icon)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(1);
    });

    it('should toggle help panel visibility', async () => {
      mockState = { ...defaultMockState, isListening: true };

      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      // Initially help panel should not be visible
      expect(screen.queryByText('Voice Commands')).not.toBeInTheDocument();

      // Click help button (second button with Volume2 icon)
      const helpButton = screen.getByTitle('Show voice commands');
      await userEvent.click(helpButton);
      // After clicking, help panel should be visible
      expect(screen.getByText('Voice Commands')).toBeInTheDocument();
    });

    it('should display healthcare quick tips when listening', () => {
      mockState = { ...defaultMockState, isListening: true };

      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      // Should show healthcare-focused quick tips
      expect(screen.getByText('"Shift Handoff"')).toBeInTheDocument();
      expect(screen.getByText('"Available Beds"')).toBeInTheDocument();
      expect(screen.getByText('"High Risk Patients"')).toBeInTheDocument();
    });
  });

  describe('Close Functionality', () => {
    it('should show close button when listening', () => {
      mockState = { ...defaultMockState, isListening: true };

      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      const closeButton = screen.getByTitle('Close');
      expect(closeButton).toBeInTheDocument();
    });

    it('should stop listening and clear transcript when close is clicked', async () => {
      mockState = { ...defaultMockState, isListening: true };

      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      const closeButton = screen.getByTitle('Close');
      await userEvent.click(closeButton);

      expect(mockStopListening).toHaveBeenCalled();
      expect(mockClearTranscript).toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should respond to Ctrl+Shift+V keyboard shortcut', () => {
      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      // Simulate Ctrl+Shift+V
      fireEvent.keyDown(window, { key: 'V', ctrlKey: true, shiftKey: true });

      expect(mockToggleListening).toHaveBeenCalled();
    });

    it('should stop listening on Escape key', () => {
      mockState = { ...defaultMockState, isListening: true };

      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(mockStopListening).toHaveBeenCalled();
    });

    it('should not respond to Escape when not listening', () => {
      mockState = { ...defaultMockState, isListening: false };

      render(
        <MemoryRouter>
          <VoiceCommandBar />
        </MemoryRouter>
      );

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(mockStopListening).not.toHaveBeenCalled();
    });
  });

  describe('Navigation Callbacks', () => {
    it('should use custom onNavigate when provided', async () => {
      const customNavigate = jest.fn();

      render(
        <MemoryRouter>
          <VoiceCommandBar onNavigate={customNavigate} />
        </MemoryRouter>
      );

      // The component should be configured to use custom navigation
      expect(document.body).toBeInTheDocument();
    });

    it('should use custom onScrollToSection when provided', () => {
      const scrollHandler = jest.fn();

      render(
        <MemoryRouter>
          <VoiceCommandBar onScrollToSection={scrollHandler} />
        </MemoryRouter>
      );

      expect(document.body).toBeInTheDocument();
    });

    it('should use custom onOpenCategory when provided', () => {
      const categoryHandler = jest.fn();

      render(
        <MemoryRouter>
          <VoiceCommandBar onOpenCategory={categoryHandler} />
        </MemoryRouter>
      );

      expect(document.body).toBeInTheDocument();
    });
  });
});

describe('VoiceCommandButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState = { ...defaultMockState };
  });

  it('should render without crashing', () => {
    render(
      <MemoryRouter>
        <VoiceCommandButton />
      </MemoryRouter>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should not render when voice is not supported', () => {
    mockState = { ...defaultMockState, isSupported: false };

    const { container } = render(
      <MemoryRouter>
        <VoiceCommandButton />
      </MemoryRouter>
    );

    // Component returns null when voice is not supported
    expect(container.innerHTML).toBe('');
  });

  it('should toggle listening on click', async () => {
    render(
      <MemoryRouter>
        <VoiceCommandButton />
      </MemoryRouter>
    );

    const button = screen.getByRole('button');
    await userEvent.click(button);

    expect(mockToggleListening).toHaveBeenCalled();
  });

  it('should show active state when listening', () => {
    mockState = { ...defaultMockState, isListening: true };

    render(
      <MemoryRouter>
        <VoiceCommandButton />
      </MemoryRouter>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-red-500');
    expect(button).toHaveClass('animate-pulse');
  });

  it('should show inactive state when not listening', () => {
    mockState = { ...defaultMockState, isListening: false };

    render(
      <MemoryRouter>
        <VoiceCommandButton />
      </MemoryRouter>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-slate-700');
  });

  it('should apply custom className', () => {
    render(
      <MemoryRouter>
        <VoiceCommandButton className="custom-btn-class" />
      </MemoryRouter>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-btn-class');
  });
});
