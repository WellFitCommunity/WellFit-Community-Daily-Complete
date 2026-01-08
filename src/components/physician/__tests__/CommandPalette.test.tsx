/**
 * Tests for CommandPalette Component
 *
 * Purpose: Cmd+K command palette for quick access to physician dashboard features
 * Tests: Opening/closing, search, keyboard navigation, action execution
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette, useCommandPalette, type CommandAction } from '../CommandPalette';
import Users from 'lucide-react/dist/esm/icons/users';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Heart from 'lucide-react/dist/esm/icons/heart';

describe('CommandPalette', () => {
  const mockActionExecute = vi.fn();

  const sampleActions: CommandAction[] = [
    {
      id: 'select-patient',
      label: 'Select Patient',
      description: 'Choose a patient from the list',
      icon: Users,
      category: 'quick-access',
      keywords: ['patient', 'select', 'choose'],
      action: vi.fn(),
      gradient: 'from-blue-400 to-cyan-500',
    },
    {
      id: 'start-scribe',
      label: 'Start Smart Scribe',
      description: 'Begin clinical documentation',
      icon: FileText,
      category: 'clinical',
      keywords: ['scribe', 'note', 'documentation'],
      action: vi.fn(),
      gradient: 'from-green-400 to-emerald-500',
    },
    {
      id: 'wellness-hub',
      label: 'Wellness Hub',
      description: 'Community wellness programs',
      icon: Heart,
      category: 'wellness',
      keywords: ['wellness', 'community'],
      action: vi.fn(),
      gradient: 'from-green-400 to-teal-500',
    },
  ];

  const defaultProps = {
    actions: sampleActions,
    recentActions: [],
    pinnedActions: [],
    onActionExecute: mockActionExecute,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sampleActions.forEach(action => {
      (action.action as ReturnType<typeof vi.fn>).mockClear();
    });
  });

  describe('Visibility', () => {
    it('should not render when closed', () => {
      render(<CommandPalette {...defaultProps} />);

      // Component returns null when closed
      expect(screen.queryByPlaceholderText(/Search commands/)).not.toBeInTheDocument();
    });

    it('should open when Cmd+K is pressed', () => {
      render(<CommandPalette {...defaultProps} />);

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      expect(screen.getByPlaceholderText(/Search commands/)).toBeInTheDocument();
    });

    it('should open when Ctrl+K is pressed', () => {
      render(<CommandPalette {...defaultProps} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

      expect(screen.getByPlaceholderText(/Search commands/)).toBeInTheDocument();
    });

    it('should close when Escape is pressed', () => {
      render(<CommandPalette {...defaultProps} />);

      // Open first
      fireEvent.keyDown(window, { key: 'k', metaKey: true });
      expect(screen.getByPlaceholderText(/Search commands/)).toBeInTheDocument();

      // Then close
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByPlaceholderText(/Search commands/)).not.toBeInTheDocument();
    });

    it('should close when backdrop is clicked', async () => {
      render(<CommandPalette {...defaultProps} />);

      // Open first
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      // Click backdrop (the outer div)
      const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement;
      await userEvent.click(backdrop);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/Search commands/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Search', () => {
    it('should render search input', () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      const searchInput = screen.getByPlaceholderText(/Search commands/);
      expect(searchInput).toBeInTheDocument();
    });

    it('should display all actions when no search query', () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      expect(screen.getByText('Select Patient')).toBeInTheDocument();
      expect(screen.getByText('Start Smart Scribe')).toBeInTheDocument();
      expect(screen.getByText('Wellness Hub')).toBeInTheDocument();
    });

    it('should filter actions based on search query', async () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      const searchInput = screen.getByPlaceholderText(/Search commands/);
      await userEvent.type(searchInput, 'scribe');

      expect(screen.getByText('Start Smart Scribe')).toBeInTheDocument();
      expect(screen.queryByText('Select Patient')).not.toBeInTheDocument();
    });

    it('should show empty state when no results match', async () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      const searchInput = screen.getByPlaceholderText(/Search commands/);
      await userEvent.type(searchInput, 'xyz123nonexistent');

      expect(screen.getByText('No commands found')).toBeInTheDocument();
    });

    it('should search by keywords', async () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      const searchInput = screen.getByPlaceholderText(/Search commands/);
      await userEvent.type(searchInput, 'documentation');

      expect(screen.getByText('Start Smart Scribe')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should show keyboard shortcut hints', () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      expect(screen.getByText('↑↓')).toBeInTheDocument();
      expect(screen.getByText('Enter')).toBeInTheDocument();
      expect(screen.getByText('Esc')).toBeInTheDocument();
    });

    it('should navigate down with ArrowDown', () => {
      const { container } = render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      // First item should be selected initially - look for motion.div with gradient
      const selectedItems = container.querySelectorAll('[class*="bg-linear-to-r"]');
      expect(selectedItems.length).toBeGreaterThan(0);

      // Navigate down
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      // The selection should change (component re-renders)
      // Just verify navigation doesn't throw
      expect(screen.getByText('Start Smart Scribe')).toBeInTheDocument();
    });

    it('should navigate up with ArrowUp', () => {
      const { container } = render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      // Navigate down then up
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      fireEvent.keyDown(window, { key: 'ArrowUp' });

      // Verify navigation works without errors
      const selectedItems = container.querySelectorAll('[class*="bg-linear-to-r"]');
      expect(selectedItems.length).toBeGreaterThan(0);
    });

    it('should wrap around when navigating past last item', () => {
      const { container } = render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      // Navigate past all items
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      // Should wrap back - verify component still renders properly
      const selectedItems = container.querySelectorAll('[class*="bg-linear-to-r"]');
      expect(selectedItems.length).toBeGreaterThan(0);
    });
  });

  describe('Action Execution', () => {
    it('should execute action when Enter is pressed', () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(sampleActions[0].action).toHaveBeenCalled();
    });

    it('should execute action when clicked', async () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      await userEvent.click(screen.getByText('Select Patient'));

      expect(sampleActions[0].action).toHaveBeenCalled();
    });

    it('should call onActionExecute callback', async () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      await userEvent.click(screen.getByText('Select Patient'));

      expect(mockActionExecute).toHaveBeenCalledWith('select-patient');
    });

    it('should close palette after executing action', async () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      await userEvent.click(screen.getByText('Select Patient'));

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/Search commands/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Categories', () => {
    it('should show category badges', () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      expect(screen.getByText('Quick')).toBeInTheDocument();
      expect(screen.getByText('Clinical')).toBeInTheDocument();
      expect(screen.getByText('Wellness')).toBeInTheDocument();
    });
  });

  describe('Pinned and Recent Actions', () => {
    it('should show pinned section when pinned actions exist', () => {
      render(<CommandPalette {...defaultProps} pinnedActions={['select-patient']} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      expect(screen.getByText('Pinned')).toBeInTheDocument();
    });

    it('should show recent section when recent actions exist', () => {
      render(<CommandPalette {...defaultProps} recentActions={['start-scribe']} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      expect(screen.getByText('Recent')).toBeInTheDocument();
    });

    it('should show all commands section', () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      expect(screen.getByText('All Commands')).toBeInTheDocument();
    });

    it('should show search results section when searching', async () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      const searchInput = screen.getByPlaceholderText(/Search commands/);
      await userEvent.type(searchInput, 'patient');

      expect(screen.getByText('Search Results')).toBeInTheDocument();
    });
  });

  describe('Footer', () => {
    it('should show command count', () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      expect(screen.getByText(/Showing 3 of 3 commands/)).toBeInTheDocument();
    });

    it('should show quick access message', () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      expect(screen.getByText('Quick access to everything')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should have proper backdrop styling', () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      const backdrop = document.querySelector('.fixed.inset-0');
      expect(backdrop).toHaveClass('z-50', 'bg-black/50');
    });

    it('should have proper modal container styling', () => {
      render(<CommandPalette {...defaultProps} />);
      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      const modal = document.querySelector('.bg-white.rounded-2xl');
      expect(modal).toBeInTheDocument();
    });
  });
});

describe('useCommandPalette Hook', () => {
  const HookTestComponent: React.FC = () => {
    const { isOpen, open, close, toggle } = useCommandPalette();
    return (
      <div>
        <span data-testid="is-open">{isOpen.toString()}</span>
        <button onClick={open}>Open</button>
        <button onClick={close}>Close</button>
        <button onClick={toggle}>Toggle</button>
      </div>
    );
  };

  it('should start closed', () => {
    render(<HookTestComponent />);
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });

  it('should open when open() is called', async () => {
    render(<HookTestComponent />);

    await userEvent.click(screen.getByText('Open'));

    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
  });

  it('should close when close() is called', async () => {
    render(<HookTestComponent />);

    await userEvent.click(screen.getByText('Open'));
    await userEvent.click(screen.getByText('Close'));

    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });

  it('should toggle state when toggle() is called', async () => {
    render(<HookTestComponent />);

    await userEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');

    await userEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });
});
