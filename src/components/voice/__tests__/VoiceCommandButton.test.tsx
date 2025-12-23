/**
 * VoiceCommandButton Tests
 *
 * Tests for the "Hey Vision" voice command button including:
 * - Rendering and state changes
 * - Pause timer functionality
 * - Resume functionality
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Define mock before vi.mock call (will be hoisted)
const mockStart = vi.fn(() => true);
const mockStop = vi.fn();
const mockPauseFor = vi.fn();
const mockResumeFromPause = vi.fn();
const mockIsSupported = vi.fn(() => true);
const mockGetIsPaused = vi.fn(() => false);
const mockGetPauseRemaining = vi.fn(() => 0);
const mockOnCommand = vi.fn();
const mockOnStateChange = vi.fn();
const mockOnTranscript = vi.fn();
const mockOnPauseChange = vi.fn();
const mockGetNavigationRoute = vi.fn();
const mockSearchPatient = vi.fn();
const mockParseCommand = vi.fn();
const mockGetAvailableCommands = vi.fn(() => [
  { category: 'Test', examples: ['"Test command"'] },
]);

vi.mock('../../../services/voiceCommandService', () => ({
  voiceCommandService: {
    isSupported: () => mockIsSupported(),
    start: () => mockStart(),
    stop: () => mockStop(),
    pauseFor: (mins: number) => mockPauseFor(mins),
    resumeFromPause: () => mockResumeFromPause(),
    getIsPaused: () => mockGetIsPaused(),
    getPauseRemaining: () => mockGetPauseRemaining(),
    onCommand: (cb: unknown) => mockOnCommand(cb),
    onStateChange: (cb: unknown) => mockOnStateChange(cb),
    onTranscript: (cb: unknown) => mockOnTranscript(cb),
    onPauseChange: (cb: unknown) => mockOnPauseChange(cb),
    getNavigationRoute: (dest: string) => mockGetNavigationRoute(dest),
    searchPatient: (query: string) => mockSearchPatient(query),
    parseCommand: (text: string, conf: number) => mockParseCommand(text, conf),
    getAvailableCommands: () => mockGetAvailableCommands(),
  },
}));

// Import component after mocking
import { VoiceCommandButton } from '../VoiceCommandButton';

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('VoiceCommandButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSupported.mockReturnValue(true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render when voice is supported', () => {
      mockIsSupported.mockReturnValue(true);
      renderWithRouter(<VoiceCommandButton />);

      // Button should be present (using title since emoji is the accessible name)
      expect(screen.getByTitle('Start voice commands')).toBeInTheDocument();
    });

    it('should not render when voice is not supported', () => {
      mockIsSupported.mockReturnValue(false);
      const { container } = renderWithRouter(<VoiceCommandButton />);

      // Should return null
      expect(container.firstChild).toBeNull();
    });

    it('should display microphone icon', () => {
      renderWithRouter(<VoiceCommandButton />);

      // Main button should exist (using title)
      expect(screen.getByTitle('Start voice commands')).toBeInTheDocument();
    });
  });

  describe('Toggle Listening', () => {
    it('should start listening when button clicked in idle state', () => {
      renderWithRouter(<VoiceCommandButton />);

      const button = screen.getByTitle('Start voice commands');
      fireEvent.click(button);

      expect(mockStart).toHaveBeenCalled();
    });

    it('should stop listening when button clicked while listening', () => {
      // Capture the state change callback
      let stateCallback: ((state: string) => void) | null = null;
      mockOnStateChange.mockImplementation((cb) => {
        stateCallback = cb;
      });

      renderWithRouter(<VoiceCommandButton />);

      // Simulate state change to listening
      act(() => {
        stateCallback?.('listening');
      });

      // Click to stop
      const buttons = screen.getAllByRole('button');
      const mainButton = buttons.find(b => b.title === 'Stop listening');
      if (mainButton) {
        fireEvent.click(mainButton);
        expect(mockStop).toHaveBeenCalled();
      }
    });
  });

  describe('Pause Timer Feature', () => {
    it('should show pause button when listening', () => {
      let stateCallback: ((state: string) => void) | null = null;
      mockOnStateChange.mockImplementation((cb) => {
        stateCallback = cb;
      });

      renderWithRouter(<VoiceCommandButton />);

      // Simulate state change to listening
      act(() => {
        stateCallback?.('listening');
      });

      // Pause button should appear
      expect(screen.getByTitle('Pause listening')).toBeInTheDocument();
    });

    it('should show pause duration menu when pause button clicked', () => {
      let stateCallback: ((state: string) => void) | null = null;
      mockOnStateChange.mockImplementation((cb) => {
        stateCallback = cb;
      });

      renderWithRouter(<VoiceCommandButton />);

      // Simulate state change to listening
      act(() => {
        stateCallback?.('listening');
      });

      // Click pause button
      const pauseButton = screen.getByTitle('Pause listening');
      fireEvent.click(pauseButton);

      // Should show duration options
      expect(screen.getByText('Pause Vision for:')).toBeInTheDocument();
      expect(screen.getByText('5 minutes')).toBeInTheDocument();
      expect(screen.getByText('10 minutes')).toBeInTheDocument();
      expect(screen.getByText('20 minutes')).toBeInTheDocument();
      expect(screen.getByText('30 minutes')).toBeInTheDocument();
    });

    it('should call pauseFor when duration selected', () => {
      let stateCallback: ((state: string) => void) | null = null;
      mockOnStateChange.mockImplementation((cb) => {
        stateCallback = cb;
      });

      renderWithRouter(<VoiceCommandButton />);

      // Simulate state change to listening
      act(() => {
        stateCallback?.('listening');
      });

      // Click pause button
      const pauseButton = screen.getByTitle('Pause listening');
      fireEvent.click(pauseButton);

      // Select 10 minutes
      fireEvent.click(screen.getByText('10 minutes'));

      expect(mockPauseFor).toHaveBeenCalledWith(10);
    });

    it('should show resume button when paused', () => {
      let stateCallback: ((state: string) => void) | null = null;
      mockOnStateChange.mockImplementation((cb) => {
        stateCallback = cb;
      });

      renderWithRouter(<VoiceCommandButton />);

      // Simulate state change to paused
      act(() => {
        stateCallback?.('paused');
      });

      // Resume button(s) should appear (there are two - small and main)
      const resumeButtons = screen.getAllByTitle('Resume listening');
      expect(resumeButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('should call resumeFromPause when resume button clicked', () => {
      let stateCallback: ((state: string) => void) | null = null;
      mockOnStateChange.mockImplementation((cb) => {
        stateCallback = cb;
      });

      renderWithRouter(<VoiceCommandButton />);

      // Simulate state change to paused
      act(() => {
        stateCallback?.('paused');
      });

      // Click the small resume button (first one with green color)
      const resumeButtons = screen.getAllByTitle('Resume listening');
      const smallResumeButton = resumeButtons.find(b => b.className.includes('bg-green'));
      expect(smallResumeButton).toBeDefined();
      if (smallResumeButton) {
        fireEvent.click(smallResumeButton);
        expect(mockResumeFromPause).toHaveBeenCalled();
      }
    });

    it('should display countdown when paused', () => {
      let stateCallback: ((state: string) => void) | null = null;
      let pauseCallback: ((isPaused: boolean, remaining: number) => void) | null = null;

      mockOnStateChange.mockImplementation((cb) => {
        stateCallback = cb;
      });
      mockOnPauseChange.mockImplementation((cb) => {
        pauseCallback = cb;
      });

      renderWithRouter(<VoiceCommandButton />);

      // First trigger the pause callback to set the remaining time
      act(() => {
        pauseCallback?.(true, 300); // 5 minutes = 300 seconds
      });

      // Then simulate state change to paused
      act(() => {
        stateCallback?.('paused');
      });

      // Should show countdown in format M:SS
      expect(screen.getByText(/Paused \(5:00\)/)).toBeInTheDocument();
    });

    it('should format countdown correctly for various times', () => {
      let stateCallback: ((state: string) => void) | null = null;
      let pauseCallback: ((isPaused: boolean, remaining: number) => void) | null = null;

      mockOnStateChange.mockImplementation((cb) => {
        stateCallback = cb;
      });
      mockOnPauseChange.mockImplementation((cb) => {
        pauseCallback = cb;
      });

      renderWithRouter(<VoiceCommandButton />);

      // First trigger the pause callback to set the remaining time
      act(() => {
        pauseCallback?.(true, 585); // 9 minutes 45 seconds
      });

      // Then simulate state change to paused
      act(() => {
        stateCallback?.('paused');
      });

      // Should show countdown in format M:SS
      expect(screen.getByText(/Paused \(9:45\)/)).toBeInTheDocument();
    });
  });

  describe('Help Modal', () => {
    it('should show help modal when help command is triggered', () => {
      let commandCallback: ((cmd: { intent: string; entities: Record<string, string>; confidence: number; rawText: string }) => void) | null = null;
      mockOnCommand.mockImplementation((cb) => {
        commandCallback = cb;
      });

      renderWithRouter(<VoiceCommandButton />);

      // Trigger help command
      act(() => {
        commandCallback?.({
          intent: 'help',
          entities: {},
          confidence: 1,
          rawText: 'help',
        });
      });

      // Help modal should appear
      expect(screen.getByText('Voice Commands')).toBeInTheDocument();
      expect(screen.getByText(/Say "Hey Vision" followed by a command/)).toBeInTheDocument();
    });

    it('should close help modal when Got it button clicked', () => {
      let commandCallback: ((cmd: { intent: string; entities: Record<string, string>; confidence: number; rawText: string }) => void) | null = null;
      mockOnCommand.mockImplementation((cb) => {
        commandCallback = cb;
      });

      renderWithRouter(<VoiceCommandButton />);

      // Trigger help command
      act(() => {
        commandCallback?.({
          intent: 'help',
          entities: {},
          confidence: 1,
          rawText: 'help',
        });
      });

      // Click Got it button
      fireEvent.click(screen.getByText('Got it!'));

      // Help modal should close
      expect(screen.queryByText(/Say "Hey Vision" followed by a command/)).not.toBeInTheDocument();
    });
  });

  describe('Pause Voice Command', () => {
    it('should handle pause_listening command', () => {
      let commandCallback: ((cmd: { intent: string; entities: Record<string, string>; confidence: number; rawText: string }) => void) | null = null;
      mockOnCommand.mockImplementation((cb) => {
        commandCallback = cb;
      });

      renderWithRouter(<VoiceCommandButton />);

      // Trigger pause command
      act(() => {
        commandCallback?.({
          intent: 'pause_listening',
          entities: { pauseMinutes: '10' },
          confidence: 1,
          rawText: 'pause for 10 minutes',
        });
      });

      expect(mockPauseFor).toHaveBeenCalledWith(10);
    });

    it('should handle resume_listening command', () => {
      let commandCallback: ((cmd: { intent: string; entities: Record<string, string>; confidence: number; rawText: string }) => void) | null = null;
      mockOnCommand.mockImplementation((cb) => {
        commandCallback = cb;
      });

      renderWithRouter(<VoiceCommandButton />);

      // Trigger resume command
      act(() => {
        commandCallback?.({
          intent: 'resume_listening',
          entities: {},
          confidence: 1,
          rawText: 'resume',
        });
      });

      expect(mockResumeFromPause).toHaveBeenCalled();
    });
  });
});
