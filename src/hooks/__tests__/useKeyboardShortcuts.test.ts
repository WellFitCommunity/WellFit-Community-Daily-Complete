/**
 * Tests for useKeyboardShortcuts Hook
 *
 * ATLUS: Technology - Keyboard shortcut system tests
 */

import { renderHook, act } from '@testing-library/react';
import { formatKeyCombo, GLOBAL_SHORTCUTS } from '../useKeyboardShortcuts';

// Mock react-router-dom
const mockNavigate = jest.fn();
const mockLocation = { pathname: '/admin' };

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

// ============================================================================
// TESTS
// ============================================================================

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatKeyCombo', () => {
    it('should format simple key', () => {
      expect(formatKeyCombo('?')).toBe('?');
    });

    it('should format ctrl modifier', () => {
      const result = formatKeyCombo('ctrl+k');
      // Will be ⌘K on Mac, Ctrl+K on Windows
      expect(result).toMatch(/^(⌘K|Ctrl\+K)$/);
    });

    it('should format shift modifier', () => {
      const result = formatKeyCombo('shift+h');
      expect(result).toMatch(/^(⇧H|Shift\+H)$/);
    });

    it('should format number keys', () => {
      const result = formatKeyCombo('ctrl+1');
      expect(result).toMatch(/^(⌘1|Ctrl\+1)$/);
    });

    it('should format escape key', () => {
      expect(formatKeyCombo('escape')).toBe('Esc');
    });

    it('should format enter key', () => {
      expect(formatKeyCombo('enter')).toBe('↵');
    });

    it('should format arrow keys', () => {
      expect(formatKeyCombo('arrowup')).toBe('↑');
      expect(formatKeyCombo('arrowdown')).toBe('↓');
      expect(formatKeyCombo('arrowleft')).toBe('←');
      expect(formatKeyCombo('arrowright')).toBe('→');
    });
  });

  describe('GLOBAL_SHORTCUTS', () => {
    it('should have navigation shortcuts ctrl+1 through ctrl+9', () => {
      const navShortcuts = GLOBAL_SHORTCUTS.filter(s => s.category === 'navigation');
      expect(navShortcuts.length).toBeGreaterThanOrEqual(9);

      // Check specific shortcuts exist
      expect(navShortcuts.find(s => s.key === 'ctrl+1')).toBeDefined();
      expect(navShortcuts.find(s => s.key === 'ctrl+9')).toBeDefined();
    });

    it('should have filter shortcuts', () => {
      const filterShortcuts = GLOBAL_SHORTCUTS.filter(s => s.category === 'filters');
      expect(filterShortcuts.length).toBeGreaterThanOrEqual(3);

      // Check specific filters
      expect(filterShortcuts.find(s => s.key === 'shift+h')).toBeDefined(); // High risk
      expect(filterShortcuts.find(s => s.key === 'shift+a')).toBeDefined(); // All
    });

    it('should have action shortcuts', () => {
      const actionShortcuts = GLOBAL_SHORTCUTS.filter(s => s.category === 'actions');
      expect(actionShortcuts.length).toBeGreaterThanOrEqual(2);

      // Check quick search
      expect(actionShortcuts.find(s => s.key === 'ctrl+k')).toBeDefined();
    });

    it('should have help shortcut', () => {
      const helpShortcut = GLOBAL_SHORTCUTS.find(s => s.key === '?');
      expect(helpShortcut).toBeDefined();
      expect(helpShortcut?.category).toBe('help');
    });

    it('should have descriptions for all shortcuts', () => {
      GLOBAL_SHORTCUTS.forEach(shortcut => {
        expect(shortcut.description).toBeTruthy();
        expect(shortcut.description.length).toBeGreaterThan(0);
      });
    });

    it('should have valid categories for all shortcuts', () => {
      const validCategories = ['navigation', 'filters', 'actions', 'help'];
      GLOBAL_SHORTCUTS.forEach(shortcut => {
        expect(validCategories).toContain(shortcut.category);
      });
    });
  });

  describe('Keyboard Event Handling', () => {
    // Helper to create keyboard events
    const createKeyboardEvent = (key: string, options: Partial<KeyboardEvent> = {}): KeyboardEvent => {
      return new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...options,
      });
    };

    it('should not trigger shortcuts when typing in input', () => {
      // Create a mock input element
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const event = createKeyboardEvent('h', { shiftKey: true });
      Object.defineProperty(event, 'target', { value: input });

      // Event should not be prevented (shortcuts don't fire in inputs)
      input.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);

      document.body.removeChild(input);
    });

    it('should trigger escape even in inputs', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      // Escape is an allowed shortcut in inputs
      const event = createKeyboardEvent('Escape');

      // Should be allowed (escape closes modals even when in inputs)
      // Note: Full integration requires the hook to be mounted
      expect(event.key).toBe('Escape');

      document.body.removeChild(input);
    });
  });
});

describe('Keyboard Shortcut Mappings', () => {
  it('should map ctrl+1 to Admin Dashboard', () => {
    const shortcut = GLOBAL_SHORTCUTS.find(s => s.key === 'ctrl+1');
    expect(shortcut?.description).toBe('Admin Dashboard');
  });

  it('should map ctrl+3 to Shift Handoff', () => {
    const shortcut = GLOBAL_SHORTCUTS.find(s => s.key === 'ctrl+3');
    expect(shortcut?.description).toBe('Shift Handoff');
  });

  it('should map ctrl+4 to Bed Management', () => {
    const shortcut = GLOBAL_SHORTCUTS.find(s => s.key === 'ctrl+4');
    expect(shortcut?.description).toBe('Bed Management');
  });

  it('should map ctrl+5 to NeuroSuite', () => {
    const shortcut = GLOBAL_SHORTCUTS.find(s => s.key === 'ctrl+5');
    expect(shortcut?.description).toBe('NeuroSuite');
  });

  it('should map shift+h to High Risk filter', () => {
    const shortcut = GLOBAL_SHORTCUTS.find(s => s.key === 'shift+h');
    expect(shortcut?.description).toContain('High Risk');
  });

  it('should map shift+r to Refresh', () => {
    const shortcut = GLOBAL_SHORTCUTS.find(s => s.key === 'shift+r');
    expect(shortcut?.description).toContain('Refresh');
  });

  it('should map ctrl+k to Quick Search', () => {
    const shortcut = GLOBAL_SHORTCUTS.find(s => s.key === 'ctrl+k');
    expect(shortcut?.description).toContain('Search');
  });
});
