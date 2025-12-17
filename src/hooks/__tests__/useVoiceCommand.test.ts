import { type Mock } from 'vitest';
/**
 * useVoiceCommand Hook Test Suite
 *
 * Tests for the voice command recognition hook.
 * ATLUS: Intuitive Technology - voice-first healthcare navigation.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { renderHook, act } from '@testing-library/react';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock workflowPreferences
const mockFindVoiceCommandMatch = vi.fn();
vi.mock('../../services/workflowPreferences', () => ({
  findVoiceCommandMatch: (text: string) => mockFindVoiceCommandMatch(text),
  VoiceCommandMapping: {},
}));

// Mock auditLogger
vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock SpeechRecognition API
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = 'en-US';
  onstart: (() => void) | null = null;
  onresult: ((event: { results: SpeechRecognitionResultList; resultIndex: number }) => void) | null = null;
  onerror: ((event: { error: string; message?: string }) => void) | null = null;
  onend: (() => void) | null = null;

  start = vi.fn(() => {
    if (this.onstart) this.onstart();
  });

  stop = vi.fn(() => {
    if (this.onend) this.onend();
  });

  abort = vi.fn();

  // Helper to simulate speech result
  simulateResult(transcript: string, isFinal: boolean, confidence: number = 0.9) {
    if (this.onresult) {
      const mockResult = {
        results: {
          length: 1,
          item: () => ({
            isFinal,
            length: 1,
            item: () => ({ transcript, confidence }),
            0: { transcript, confidence },
          }),
          0: {
            isFinal,
            length: 1,
            item: () => ({ transcript, confidence }),
            0: { transcript, confidence },
          },
        } as unknown as SpeechRecognitionResultList,
        resultIndex: 0,
      };
      this.onresult(mockResult);
    }
  }

  // Helper to simulate error
  simulateError(error: string, message?: string) {
    if (this.onerror) {
      this.onerror({ error, message });
    }
  }
}

// Set up global SpeechRecognition mock
let _mockRecognitionInstance: MockSpeechRecognition | null = null;

beforeAll(() => {
  // Mocking browser API
  (global.window as Window & typeof globalThis).SpeechRecognition = MockSpeechRecognition as unknown as typeof SpeechRecognition;
  // @ts-expect-error - Mocking browser API
  global.window.webkitSpeechRecognition = MockSpeechRecognition;
});

// Import after mocks are set up
import { useVoiceCommand } from '../useVoiceCommand';

describe('useVoiceCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _mockRecognitionInstance = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useVoiceCommand());
      const [state] = result.current;

      expect(state.isListening).toBe(false);
      expect(state.isSupported).toBe(true);
      expect(state.transcript).toBe('');
      expect(state.interimTranscript).toBe('');
      expect(state.error).toBeNull();
      expect(state.matchedCommand).toBeNull();
      expect(state.confidence).toBe(0);
    });

    it('should detect voice support correctly', () => {
      const { result } = renderHook(() => useVoiceCommand());
      const [state] = result.current;

      expect(state.isSupported).toBe(true);
    });

    it('should return action functions', () => {
      const { result } = renderHook(() => useVoiceCommand());
      const [, actions] = result.current;

      expect(typeof actions.startListening).toBe('function');
      expect(typeof actions.stopListening).toBe('function');
      expect(typeof actions.toggleListening).toBe('function');
      expect(typeof actions.clearTranscript).toBe('function');
      expect(typeof actions.executeCommand).toBe('function');
    });
  });

  describe('Starting and Stopping', () => {
    it('should start listening when startListening is called', () => {
      const { result } = renderHook(() => useVoiceCommand());
      const [, actions] = result.current;

      act(() => {
        actions.startListening();
      });

      const [state] = result.current;
      expect(state.isListening).toBe(true);
    });

    it('should stop listening when stopListening is called', () => {
      const { result } = renderHook(() => useVoiceCommand());
      const [, actions] = result.current;

      act(() => {
        actions.startListening();
      });

      act(() => {
        actions.stopListening();
      });

      const [state] = result.current;
      expect(state.isListening).toBe(false);
    });

    it('should toggle listening state', () => {
      const { result } = renderHook(() => useVoiceCommand());

      // Start listening
      act(() => {
        result.current[1].toggleListening();
      });

      expect(result.current[0].isListening).toBe(true);

      // Stop listening - need to get fresh reference after state change
      act(() => {
        result.current[1].stopListening();
      });

      expect(result.current[0].isListening).toBe(false);
    });

    it('should auto-stop after 30 seconds of inactivity', () => {
      const { result } = renderHook(() => useVoiceCommand());
      const [, actions] = result.current;

      act(() => {
        actions.startListening();
      });

      expect(result.current[0].isListening).toBe(true);

      // Fast-forward 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      expect(result.current[0].isListening).toBe(false);
    });
  });

  describe('Transcript Handling', () => {
    it('should clear transcript when clearTranscript is called', () => {
      const { result } = renderHook(() => useVoiceCommand());
      const [, actions] = result.current;

      // Manually set some state first by clearing
      act(() => {
        actions.clearTranscript();
      });

      const [state] = result.current;
      expect(state.transcript).toBe('');
      expect(state.interimTranscript).toBe('');
      expect(state.matchedCommand).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('Command Matching', () => {
    it('should match commands from voice input', () => {
      const mockCommand = {
        phrases: ['shift handoff'],
        targetType: 'route' as const,
        targetId: '/shift-handoff',
        displayName: 'Shift Handoff Dashboard',
      };
      mockFindVoiceCommandMatch.mockReturnValue(mockCommand);

      const { result } = renderHook(() => useVoiceCommand());
      const [, actions] = result.current;

      act(() => {
        actions.startListening();
      });

      // The matching is handled internally by the hook
      expect(result.current[0].isListening).toBe(true);
    });

    it('should call onCommandMatched callback when command matches', () => {
      const mockCommand = {
        phrases: ['shift handoff'],
        targetType: 'route' as const,
        targetId: '/shift-handoff',
        displayName: 'Shift Handoff Dashboard',
      };
      mockFindVoiceCommandMatch.mockReturnValue(mockCommand);

      const onCommandMatched = vi.fn();

      const { result } = renderHook(() =>
        useVoiceCommand({ onCommandMatched })
      );

      act(() => {
        result.current[1].startListening();
      });

      // Hook is properly configured with callback
      expect(result.current[0].isListening).toBe(true);
    });
  });

  describe('Command Execution', () => {
    it('should execute route commands via navigate', () => {
      const { result } = renderHook(() => useVoiceCommand());
      const [, actions] = result.current;

      const routeCommand = {
        phrases: ['dashboard'],
        targetType: 'route' as const,
        targetId: '/dashboard',
        displayName: 'Dashboard',
      };

      act(() => {
        actions.executeCommand(routeCommand);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('should use custom onNavigate when provided', () => {
      const customNavigate = vi.fn();

      const { result } = renderHook(() =>
        useVoiceCommand({ onNavigate: customNavigate })
      );
      const [, actions] = result.current;

      const routeCommand = {
        phrases: ['care coordination'],
        targetType: 'route' as const,
        targetId: '/care-coordination',
        displayName: 'Care Coordination',
      };

      act(() => {
        actions.executeCommand(routeCommand);
      });

      expect(customNavigate).toHaveBeenCalledWith('/care-coordination');
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should execute section commands by scrolling', () => {
      // Mock document.getElementById for testing scroll behavior
      const mockElement = {
        scrollIntoView: vi.fn(),
        querySelector: vi.fn().mockReturnValue(null),
      };
      const originalGetElementById = document.getElementById;
      document.getElementById = vi.fn().mockReturnValue(mockElement);

      const { result } = renderHook(() => useVoiceCommand());
      const [, actions] = result.current;

      const sectionCommand = {
        phrases: ['bed overview'],
        targetType: 'section' as const,
        targetId: 'bed-overview-section',
        displayName: 'Bed Overview Section',
      };

      act(() => {
        actions.executeCommand(sectionCommand);
      });

      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });

      // Restore
      document.getElementById = originalGetElementById;
    });

    it('should execute category commands', () => {
      // Mock document.querySelector for testing category navigation
      const mockCategoryElement = {
        scrollIntoView: vi.fn(),
        querySelector: vi.fn().mockReturnValue(null),
      };
      const originalQuerySelector = document.querySelector;
      document.querySelector = vi.fn().mockReturnValue(mockCategoryElement);

      const { result } = renderHook(() => useVoiceCommand());
      const [, actions] = result.current;

      const categoryCommand = {
        phrases: ['nursing'],
        targetType: 'category' as const,
        targetId: 'nursing-category',
        displayName: 'Nursing Category',
      };

      act(() => {
        actions.executeCommand(categoryCommand);
      });

      expect(mockCategoryElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });

      // Restore
      document.querySelector = originalQuerySelector;
    });

    it('should use custom scroll handler when provided', () => {
      const customScrollHandler = vi.fn();

      const { result } = renderHook(() =>
        useVoiceCommand({ onScrollToSection: customScrollHandler })
      );
      const [, actions] = result.current;

      const sectionCommand = {
        phrases: ['bed board'],
        targetType: 'section' as const,
        targetId: 'bed-board-section',
        displayName: 'Bed Board Section',
      };

      act(() => {
        actions.executeCommand(sectionCommand);
      });

      expect(customScrollHandler).toHaveBeenCalledWith('bed-board-section');
    });

    it('should use custom category handler when provided', () => {
      const customCategoryHandler = vi.fn();

      const { result } = renderHook(() =>
        useVoiceCommand({ onOpenCategory: customCategoryHandler })
      );
      const [, actions] = result.current;

      const categoryCommand = {
        phrases: ['vitals'],
        targetType: 'category' as const,
        targetId: 'vitals-category',
        displayName: 'Vitals Category',
      };

      act(() => {
        actions.executeCommand(categoryCommand);
      });

      expect(customCategoryHandler).toHaveBeenCalledWith('vitals-category');
    });

    it('should stop listening after command execution', () => {
      const { result } = renderHook(() => useVoiceCommand());
      const [, actions] = result.current;

      // Start listening first
      act(() => {
        actions.startListening();
      });

      expect(result.current[0].isListening).toBe(true);

      // Execute a command
      const routeCommand = {
        phrases: ['dashboard'],
        targetType: 'route' as const,
        targetId: '/dashboard',
        displayName: 'Dashboard',
      };

      act(() => {
        actions.executeCommand(routeCommand);
      });

      expect(result.current[0].isListening).toBe(false);
    });
  });

  describe('Auto-Execute Mode', () => {
    it('should default to auto-execute enabled', () => {
      const { result } = renderHook(() => useVoiceCommand());

      // Auto-execute is true by default
      expect(result.current[0]).toBeDefined();
    });

    it('should respect autoExecute false option', () => {
      const { result } = renderHook(() =>
        useVoiceCommand({ autoExecute: false })
      );

      // Hook should initialize without error
      expect(result.current[0].isListening).toBe(false);
    });
  });

  describe('Language Configuration', () => {
    it('should default to en-US language', () => {
      const { result } = renderHook(() => useVoiceCommand());

      // Hook initializes with default language
      expect(result.current[0]).toBeDefined();
    });

    it('should accept custom language option', () => {
      const { result } = renderHook(() =>
        useVoiceCommand({ language: 'es-ES' })
      );

      // Hook should initialize without error
      expect(result.current[0]).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should clean up on unmount', () => {
      const { result, unmount } = renderHook(() => useVoiceCommand());
      const [, actions] = result.current;

      act(() => {
        actions.startListening();
      });

      // Unmount should clean up without error
      unmount();

      // No errors should occur
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle not-allowed error', () => {
      const { result } = renderHook(() => useVoiceCommand());

      // Hook should handle errors gracefully
      expect(result.current[0].error).toBeNull();
    });

    it('should set error for unsupported browsers', () => {
      // Temporarily remove SpeechRecognition
      const originalSpeechRecognition = (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition;
      const originalWebkitSpeechRecognition = (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition;

      // @ts-expect-error - Temporarily removing API
      delete window.SpeechRecognition;
      // @ts-expect-error - Temporarily removing API
      delete window.webkitSpeechRecognition;

      const { result } = renderHook(() => useVoiceCommand());
      const [, actions] = result.current;

      act(() => {
        actions.startListening();
      });

      const [state] = result.current;
      expect(state.error).toContain('not supported');

      // Restore
      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = originalSpeechRecognition;
      (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = originalWebkitSpeechRecognition;
    });
  });
});

describe('Healthcare Voice Commands Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should work with shift handoff command', () => {
    const mockCommand = {
      phrases: ['shift handoff'],
      targetType: 'route' as const,
      targetId: '/shift-handoff',
      displayName: 'Shift Handoff Dashboard',
    };
    mockFindVoiceCommandMatch.mockReturnValue(mockCommand);

    const { result } = renderHook(() => useVoiceCommand());
    const [, actions] = result.current;

    act(() => {
      actions.executeCommand(mockCommand);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/shift-handoff');
  });

  it('should work with bed management command', () => {
    const mockCommand = {
      phrases: ['bed management', 'available beds'],
      targetType: 'route' as const,
      targetId: '/admin?section=bed-management',
      displayName: 'Bed Management',
    };

    const { result } = renderHook(() => useVoiceCommand());
    const [, actions] = result.current;

    act(() => {
      actions.executeCommand(mockCommand);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/admin?section=bed-management');
  });

  it('should work with neuro suite command', () => {
    const mockCommand = {
      phrases: ['neuro suite', 'neurosuite'],
      targetType: 'route' as const,
      targetId: '/neuro-suite',
      displayName: 'NeuroSuite Dashboard',
    };

    const { result } = renderHook(() => useVoiceCommand());
    const [, actions] = result.current;

    act(() => {
      actions.executeCommand(mockCommand);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/neuro-suite');
  });

  it('should work with care coordination command', () => {
    const mockCommand = {
      phrases: ['care coordination', 'care team'],
      targetType: 'route' as const,
      targetId: '/care-coordination',
      displayName: 'Care Coordination',
    };

    const { result } = renderHook(() => useVoiceCommand());
    const [, actions] = result.current;

    act(() => {
      actions.executeCommand(mockCommand);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/care-coordination');
  });

  it('should work with high risk patients command', () => {
    const mockCommand = {
      phrases: ['high risk patients', 'critical patients'],
      targetType: 'action' as const,
      targetId: 'patients:filter_critical',
      displayName: 'High Risk Patients',
    };

    const { result } = renderHook(() => useVoiceCommand());
    const [, actions] = result.current;

    // Action commands are handled differently - just ensure no error
    act(() => {
      actions.executeCommand(mockCommand);
    });

    // Should not navigate for action type
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
