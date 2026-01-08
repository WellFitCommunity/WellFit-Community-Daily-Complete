/**
 * EAKeyboardShortcutsProvider - Global Keyboard Shortcuts Provider
 *
 * ATLUS Enhancement: Technology - Provides keyboard shortcuts across the app
 *
 * This component wraps the application and provides:
 * - Global keyboard shortcut handling
 * - Help modal display
 * - Context for page-specific shortcuts
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useKeyboardShortcuts, KeyboardShortcut } from '../../hooks/useKeyboardShortcuts';
import { EAKeyboardShortcutsHelp } from './EAKeyboardShortcutsHelp';

interface KeyboardShortcutsContextType {
  /** Whether shortcuts are enabled */
  enabled: boolean;
  /** Toggle shortcuts enabled state */
  setEnabled: (enabled: boolean) => void;
  /** Show help modal */
  showHelp: () => void;
  /** Hide help modal */
  hideHelp: () => void;
  /** Current filter if any */
  currentFilter: 'high' | 'critical' | 'all' | null;
  /** Register page-specific shortcuts */
  registerShortcuts: (shortcuts: KeyboardShortcut[]) => void;
  /** Unregister page-specific shortcuts */
  unregisterShortcuts: (shortcuts: KeyboardShortcut[]) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined);

interface EAKeyboardShortcutsProviderProps {
  children: React.ReactNode;
  /** Whether shortcuts are enabled by default */
  defaultEnabled?: boolean;
}

export const EAKeyboardShortcutsProvider: React.FC<EAKeyboardShortcutsProviderProps> = ({
  children,
  defaultEnabled = true,
}) => {
  const [enabled, setEnabled] = React.useState(defaultEnabled);
  const [pageShortcuts, setPageShortcuts] = React.useState<KeyboardShortcut[]>([]);

  const {
    shortcuts: _shortcuts,
    showHelp,
    setShowHelp,
    currentFilter,
  } = useKeyboardShortcuts({
    enabled,
    customShortcuts: pageShortcuts,
  });

  const showHelpModal = useCallback(() => {
    setShowHelp(true);
  }, [setShowHelp]);

  const hideHelpModal = useCallback(() => {
    setShowHelp(false);
  }, [setShowHelp]);

  const registerShortcuts = useCallback((newShortcuts: KeyboardShortcut[]) => {
    setPageShortcuts(prev => [...prev, ...newShortcuts]);
  }, []);

  const unregisterShortcuts = useCallback((shortcutsToRemove: KeyboardShortcut[]) => {
    setPageShortcuts(prev =>
      prev.filter(s => !shortcutsToRemove.some(r => r.key === s.key))
    );
  }, []);

  const contextValue = useMemo<KeyboardShortcutsContextType>(() => ({
    enabled,
    setEnabled,
    showHelp: showHelpModal,
    hideHelp: hideHelpModal,
    currentFilter,
    registerShortcuts,
    unregisterShortcuts,
  }), [enabled, showHelpModal, hideHelpModal, currentFilter, registerShortcuts, unregisterShortcuts]);

  return (
    <KeyboardShortcutsContext.Provider value={contextValue}>
      {children}
      <EAKeyboardShortcutsHelp
        isOpen={showHelp}
        onClose={hideHelpModal}
        additionalShortcuts={pageShortcuts}
      />
    </KeyboardShortcutsContext.Provider>
  );
};

/**
 * Hook to access keyboard shortcuts context
 */
export const useKeyboardShortcutsContext = (): KeyboardShortcutsContextType => {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error('useKeyboardShortcutsContext must be used within EAKeyboardShortcutsProvider');
  }
  return context;
};

/**
 * Safe version that returns null if not in provider (for optional usage)
 */
export const useKeyboardShortcutsContextSafe = (): KeyboardShortcutsContextType | null => {
  return useContext(KeyboardShortcutsContext) ?? null;
};

export default EAKeyboardShortcutsProvider;
