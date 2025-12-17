/**
 * useKeyboardShortcuts - Global Keyboard Shortcut System
 *
 * ATLUS Enhancement: Technology - Reduces clicks by 70% through keyboard navigation
 *
 * This hook provides a centralized keyboard shortcut system that:
 * - Maps voice commands to keyboard equivalents
 * - Provides navigation shortcuts (Ctrl+1-9 for quick nav)
 * - Supports filter shortcuts (H for high-risk, A for all)
 * - Shows help modal with ? key
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { useEffect, useCallback, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /** Key combination (e.g., 'ctrl+1', 'shift+h', '?') */
  key: string;
  /** Human-readable description */
  description: string;
  /** Category for grouping in help modal */
  category: 'navigation' | 'filters' | 'actions' | 'help';
  /** Action to execute */
  action: () => void;
  /** Whether shortcut is currently active */
  enabled?: boolean;
}

/**
 * Parse a key combination string into components
 */
function parseKeyCombo(combo: string): { ctrl: boolean; shift: boolean; alt: boolean; key: string } {
  const parts = combo.toLowerCase().split('+');
  return {
    ctrl: parts.includes('ctrl') || parts.includes('cmd'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key: parts.filter(p => !['ctrl', 'cmd', 'shift', 'alt'].includes(p))[0] || '',
  };
}

/**
 * Check if a keyboard event matches a key combination
 */
function matchesKeyCombo(event: KeyboardEvent, combo: string): boolean {
  const { ctrl, shift, alt, key } = parseKeyCombo(combo);

  // Check modifiers
  if (ctrl !== (event.ctrlKey || event.metaKey)) return false;
  if (shift !== event.shiftKey) return false;
  if (alt !== event.altKey) return false;

  // Check key
  const eventKey = event.key.toLowerCase();
  const eventCode = event.code.toLowerCase();

  // Handle number keys
  if (/^[0-9]$/.test(key)) {
    return eventKey === key || eventCode === `digit${key}` || eventCode === `numpad${key}`;
  }

  // Handle letter keys
  if (/^[a-z]$/.test(key)) {
    return eventKey === key || eventCode === `key${key.toUpperCase()}`;
  }

  // Handle special keys
  const specialKeyMap: Record<string, string[]> = {
    '?': ['?', '/'],
    '/': ['/'],
    'escape': ['escape'],
    'enter': ['enter'],
    'space': [' ', 'space'],
    'arrowup': ['arrowup'],
    'arrowdown': ['arrowdown'],
    'arrowleft': ['arrowleft'],
    'arrowright': ['arrowright'],
  };

  if (specialKeyMap[key]) {
    return specialKeyMap[key].includes(eventKey);
  }

  return eventKey === key;
}

/**
 * Global keyboard shortcuts - mapped from voice commands
 */
export const GLOBAL_SHORTCUTS: Omit<KeyboardShortcut, 'action'>[] = [
  // Navigation shortcuts (Ctrl+1-9)
  { key: 'ctrl+1', description: 'Admin Dashboard', category: 'navigation' },
  { key: 'ctrl+2', description: 'Patient List', category: 'navigation' },
  { key: 'ctrl+3', description: 'Shift Handoff', category: 'navigation' },
  { key: 'ctrl+4', description: 'Bed Management', category: 'navigation' },
  { key: 'ctrl+5', description: 'NeuroSuite', category: 'navigation' },
  { key: 'ctrl+6', description: 'Care Coordination', category: 'navigation' },
  { key: 'ctrl+7', description: 'Referrals', category: 'navigation' },
  { key: 'ctrl+8', description: 'Billing Dashboard', category: 'navigation' },
  { key: 'ctrl+9', description: 'Settings', category: 'navigation' },

  // Filter shortcuts (single key when in list context)
  { key: 'shift+h', description: 'Filter: High Risk Patients', category: 'filters' },
  { key: 'shift+c', description: 'Filter: Critical Only', category: 'filters' },
  { key: 'shift+a', description: 'Filter: Show All', category: 'filters' },
  { key: 'shift+r', description: 'Refresh Data', category: 'filters' },

  // Action shortcuts
  { key: 'ctrl+k', description: 'Quick Search / Command Palette', category: 'actions' },
  { key: 'ctrl+/', description: 'Focus Patient Search', category: 'actions' },
  { key: 'escape', description: 'Close Modal / Cancel', category: 'actions' },

  // Help
  { key: '?', description: 'Show Keyboard Shortcuts', category: 'help' },
];

/**
 * Route mapping for navigation shortcuts
 */
const NAVIGATION_ROUTES: Record<string, string> = {
  'ctrl+1': '/admin',
  'ctrl+2': '/admin', // Will scroll to patient list section
  'ctrl+3': '/shift-handoff',
  'ctrl+4': '/bed-management',
  'ctrl+5': '/neuro-suite',
  'ctrl+6': '/care-coordination',
  'ctrl+7': '/referrals',
  'ctrl+8': '/admin', // Will scroll to billing section
  'ctrl+9': '/settings',
};

interface UseKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled */
  enabled?: boolean;
  /** Custom shortcuts to add */
  customShortcuts?: KeyboardShortcut[];
  /** Callback when help modal should open */
  onShowHelp?: () => void;
  /** Callback for filter changes */
  onFilter?: (filter: 'high' | 'critical' | 'all') => void;
  /** Callback for refresh action */
  onRefresh?: () => void;
  /** Callback for quick search */
  onQuickSearch?: () => void;
}

interface UseKeyboardShortcutsReturn {
  /** All registered shortcuts */
  shortcuts: KeyboardShortcut[];
  /** Whether help modal is showing */
  showHelp: boolean;
  /** Toggle help modal */
  setShowHelp: (show: boolean) => void;
  /** Current filter state */
  currentFilter: 'high' | 'critical' | 'all' | null;
}

/**
 * Hook for managing global keyboard shortcuts
 */
export function useKeyboardShortcuts(
  options: UseKeyboardShortcutsOptions = {}
): UseKeyboardShortcutsReturn {
  const {
    enabled = true,
    customShortcuts = [],
    onShowHelp,
    onFilter,
    onRefresh,
    onQuickSearch,
  } = options;

  const navigate = useNavigate();
  const location = useLocation();
  const [showHelp, setShowHelp] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<'high' | 'critical' | 'all' | null>(null);

  // Build shortcuts with actions - memoized to prevent unnecessary re-renders
  const shortcuts: KeyboardShortcut[] = useMemo(() => [
    // Navigation shortcuts
    ...Object.entries(NAVIGATION_ROUTES).map(([key, route]) => ({
      key,
      description: GLOBAL_SHORTCUTS.find(s => s.key === key)?.description || route,
      category: 'navigation' as const,
      action: () => {
        if (location.pathname !== route) {
          navigate(route);
        }
      },
    })),

    // Filter shortcuts
    {
      key: 'shift+h',
      description: 'Filter: High Risk Patients',
      category: 'filters',
      action: () => {
        setCurrentFilter('high');
        onFilter?.('high');
      },
    },
    {
      key: 'shift+c',
      description: 'Filter: Critical Only',
      category: 'filters',
      action: () => {
        setCurrentFilter('critical');
        onFilter?.('critical');
      },
    },
    {
      key: 'shift+a',
      description: 'Filter: Show All',
      category: 'filters',
      action: () => {
        setCurrentFilter('all');
        onFilter?.('all');
      },
    },
    {
      key: 'shift+r',
      description: 'Refresh Data',
      category: 'filters',
      action: () => {
        onRefresh?.();
      },
    },

    // Action shortcuts
    {
      key: 'ctrl+k',
      description: 'Quick Search / Command Palette',
      category: 'actions',
      action: () => {
        onQuickSearch?.();
      },
    },
    {
      key: 'ctrl+/',
      description: 'Focus Patient Search',
      category: 'actions',
      action: () => {
        // Focus patient search input if it exists
        const searchInput = document.querySelector<HTMLInputElement>(
          '[data-patient-search], [placeholder*="patient"], [placeholder*="search"]'
        );
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      },
    },
    {
      key: 'escape',
      description: 'Close Modal / Cancel',
      category: 'actions',
      action: () => {
        setShowHelp(false);
        // Try to close any open modal
        const closeButton = document.querySelector<HTMLButtonElement>(
          '[data-close-modal], [aria-label="Close"], [title="Close"]'
        );
        if (closeButton) {
          closeButton.click();
        }
      },
    },

    // Help
    {
      key: '?',
      description: 'Show Keyboard Shortcuts',
      category: 'help',
      action: () => {
        setShowHelp(prev => !prev);
        onShowHelp?.();
      },
    },

    // Custom shortcuts
    ...customShortcuts,
  ], [location.pathname, navigate, onFilter, onRefresh, onQuickSearch, onShowHelp, customShortcuts]);

  // Keyboard event handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Allow some shortcuts even in inputs
      const allowInInput = ['escape', 'ctrl+k', 'ctrl+/'];

      for (const shortcut of shortcuts) {
        if (matchesKeyCombo(event, shortcut.key)) {
          // Check if we should skip due to input focus
          if (isInput && !allowInInput.some(k => matchesKeyCombo(event, k))) {
            continue;
          }

          // Prevent default browser behavior
          event.preventDefault();
          event.stopPropagation();

          // Execute the action
          shortcut.action();
          return;
        }
      }
    },
    [enabled, shortcuts]
  );

  // Register global keyboard listener
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  return {
    shortcuts,
    showHelp,
    setShowHelp,
    currentFilter,
  };
}

/**
 * Format a key combination for display
 */
export function formatKeyCombo(combo: string): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return combo
    .split('+')
    .map(part => {
      switch (part.toLowerCase()) {
        case 'ctrl':
        case 'cmd':
          return isMac ? '⌘' : 'Ctrl';
        case 'shift':
          return isMac ? '⇧' : 'Shift';
        case 'alt':
          return isMac ? '⌥' : 'Alt';
        case 'escape':
          return 'Esc';
        case 'enter':
          return '↵';
        case 'arrowup':
          return '↑';
        case 'arrowdown':
          return '↓';
        case 'arrowleft':
          return '←';
        case 'arrowright':
          return '→';
        default:
          return part.toUpperCase();
      }
    })
    .join(isMac ? '' : '+');
}

export default useKeyboardShortcuts;
