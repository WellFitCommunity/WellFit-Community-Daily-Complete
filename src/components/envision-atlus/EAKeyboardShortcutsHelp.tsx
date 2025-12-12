/**
 * EAKeyboardShortcutsHelp - Keyboard Shortcuts Help Modal
 *
 * ATLUS Enhancement: Technology - Shows all available keyboard shortcuts
 *
 * This component displays a modal with all available keyboard shortcuts
 * organized by category. It can be toggled with the ? key.
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { KeyboardShortcut, formatKeyCombo, GLOBAL_SHORTCUTS } from '../../hooks/useKeyboardShortcuts';
import { X, Keyboard, Navigation, Filter, Zap, HelpCircle } from 'lucide-react';

interface EAKeyboardShortcutsHelpProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Additional shortcuts to display */
  additionalShortcuts?: KeyboardShortcut[];
  /** Additional class names */
  className?: string;
}

const categoryIcons = {
  navigation: Navigation,
  filters: Filter,
  actions: Zap,
  help: HelpCircle,
};

const categoryLabels = {
  navigation: 'Navigation',
  filters: 'Filters',
  actions: 'Actions',
  help: 'Help',
};

export const EAKeyboardShortcutsHelp: React.FC<EAKeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
  additionalShortcuts = [],
  className,
}) => {
  if (!isOpen) return null;

  // Combine global shortcuts with additional ones
  const allShortcuts = [...GLOBAL_SHORTCUTS, ...additionalShortcuts];

  // Group shortcuts by category
  const grouped = allShortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof allShortcuts>);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-2xl max-h-[80vh] overflow-hidden',
          'bg-slate-800 border border-slate-700 rounded-xl shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-200',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/90">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-500/30">
              <Keyboard className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h2 id="shortcuts-title" className="text-lg font-semibold text-slate-100">
                Keyboard Shortcuts
              </h2>
              <p className="text-sm text-slate-400">
                Navigate faster with these shortcuts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(grouped).map(([category, shortcuts]) => {
              const Icon = categoryIcons[category as keyof typeof categoryIcons] || HelpCircle;
              const label = categoryLabels[category as keyof typeof categoryLabels] || category;

              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Icon className="w-4 h-4" />
                    <h3 className="text-sm font-medium uppercase tracking-wider">
                      {label}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {shortcuts.map((shortcut, index) => (
                      <div
                        key={`${category}-${index}`}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                      >
                        <span className="text-sm text-slate-300">
                          {shortcut.description}
                        </span>
                        <kbd className="px-2 py-1 text-xs font-mono bg-slate-900 border border-slate-600 rounded text-slate-200 shadow-sm">
                          {formatKeyCombo(shortcut.key)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tips Section */}
          <div className="mt-6 p-4 rounded-lg bg-teal-900/20 border border-teal-800/50">
            <h4 className="text-sm font-medium text-teal-300 mb-2">
              Pro Tips
            </h4>
            <ul className="text-sm text-slate-300 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-0.5">•</span>
                <span>Press <kbd className="px-1 py-0.5 text-xs font-mono bg-slate-800 rounded">?</kbd> anytime to show this help</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-0.5">•</span>
                <span>Use <kbd className="px-1 py-0.5 text-xs font-mono bg-slate-800 rounded">Ctrl+K</kbd> for quick search</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 mt-0.5">•</span>
                <span>Voice commands also work - say &quot;Hey Riley&quot; to activate</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700 bg-slate-900/50">
          <p className="text-xs text-slate-500 text-center">
            Press <kbd className="px-1 py-0.5 text-xs font-mono bg-slate-800 rounded">Esc</kbd> to close
          </p>
        </div>
      </div>
    </>
  );
};

export default EAKeyboardShortcutsHelp;
