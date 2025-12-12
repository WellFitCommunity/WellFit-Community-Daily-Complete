/**
 * Tests for EAKeyboardShortcutsHelp Component
 *
 * ATLUS: Technology - Keyboard shortcuts help modal tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EAKeyboardShortcutsHelp } from '../EAKeyboardShortcutsHelp';

// Mock the hook
jest.mock('../../../hooks/useKeyboardShortcuts', () => ({
  formatKeyCombo: (combo: string) => {
    const parts = combo.split('+');
    return parts.map(p => p === 'ctrl' ? 'Ctrl' : p.toUpperCase()).join('+');
  },
  GLOBAL_SHORTCUTS: [
    { key: 'ctrl+1', description: 'Admin Dashboard', category: 'navigation' },
    { key: 'ctrl+2', description: 'Patient List', category: 'navigation' },
    { key: 'shift+h', description: 'Filter: High Risk', category: 'filters' },
    { key: 'shift+a', description: 'Filter: Show All', category: 'filters' },
    { key: 'ctrl+k', description: 'Quick Search', category: 'actions' },
    { key: '?', description: 'Show Keyboard Shortcuts', category: 'help' },
  ],
}));

// ============================================================================
// TESTS
// ============================================================================

describe('EAKeyboardShortcutsHelp', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render nothing when closed', () => {
      const { container } = render(
        <EAKeyboardShortcutsHelp {...defaultProps} isOpen={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render modal when open', () => {
      render(<EAKeyboardShortcutsHelp {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have correct aria attributes', () => {
      render(<EAKeyboardShortcutsHelp {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'shortcuts-title');
    });

    it('should display title', () => {
      render(<EAKeyboardShortcutsHelp {...defaultProps} />);
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });

    it('should display subtitle', () => {
      render(<EAKeyboardShortcutsHelp {...defaultProps} />);
      expect(screen.getByText('Navigate faster with these shortcuts')).toBeInTheDocument();
    });
  });

  describe('Shortcut Categories', () => {
    it('should display Navigation category', () => {
      render(<EAKeyboardShortcutsHelp {...defaultProps} />);
      expect(screen.getByText('Navigation')).toBeInTheDocument();
    });

    it('should display Filters category', () => {
      render(<EAKeyboardShortcutsHelp {...defaultProps} />);
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('should display Actions category', () => {
      render(<EAKeyboardShortcutsHelp {...defaultProps} />);
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should display Help category', () => {
      render(<EAKeyboardShortcutsHelp {...defaultProps} />);
      expect(screen.getByText('Help')).toBeInTheDocument();
    });
  });

  describe('Shortcut Display', () => {
    it('should display shortcut descriptions', () => {
      render(<EAKeyboardShortcutsHelp {...defaultProps} />);
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Patient List')).toBeInTheDocument();
      expect(screen.getByText('Filter: High Risk')).toBeInTheDocument();
    });

    it('should display formatted key combinations', () => {
      const { container } = render(<EAKeyboardShortcutsHelp {...defaultProps} />);
      // Formatted keys should be in kbd elements
      const kbdElements = container.querySelectorAll('kbd');
      expect(kbdElements.length).toBeGreaterThan(0);
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button is clicked', async () => {
      const onClose = jest.fn();
      render(<EAKeyboardShortcutsHelp {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByLabelText('Close');
      await userEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', async () => {
      const onClose = jest.fn();
      render(<EAKeyboardShortcutsHelp {...defaultProps} onClose={onClose} />);

      // The backdrop is the first fixed element
      const backdrop = document.querySelector('.fixed.inset-0');
      expect(backdrop).toBeInTheDocument();

      await userEvent.click(backdrop!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pro Tips Section', () => {
    it('should display Pro Tips heading', () => {
      render(<EAKeyboardShortcutsHelp {...defaultProps} />);
      expect(screen.getByText('Pro Tips')).toBeInTheDocument();
    });

    it('should mention the ? shortcut', () => {
      render(<EAKeyboardShortcutsHelp {...defaultProps} />);
      expect(screen.getByText(/anytime to show this help/i)).toBeInTheDocument();
    });

    it('should mention Ctrl+K for quick search', () => {
      render(<EAKeyboardShortcutsHelp {...defaultProps} />);
      expect(screen.getByText(/for quick search/i)).toBeInTheDocument();
    });

    it('should mention voice commands', () => {
      render(<EAKeyboardShortcutsHelp {...defaultProps} />);
      expect(screen.getByText(/Hey Riley/i)).toBeInTheDocument();
    });
  });

  describe('Footer', () => {
    it('should display Esc to close instruction', () => {
      render(<EAKeyboardShortcutsHelp {...defaultProps} />);
      expect(screen.getByText(/to close/i)).toBeInTheDocument();
    });
  });

  describe('Additional Shortcuts', () => {
    it('should display additional shortcuts when provided', () => {
      const additionalShortcuts = [
        { key: 'ctrl+s', description: 'Save Patient', category: 'actions' as const, action: jest.fn() },
      ];

      render(
        <EAKeyboardShortcutsHelp
          {...defaultProps}
          additionalShortcuts={additionalShortcuts}
        />
      );

      expect(screen.getByText('Save Patient')).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      render(<EAKeyboardShortcutsHelp {...defaultProps} className="my-custom-class" />);
      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('my-custom-class');
    });
  });
});
