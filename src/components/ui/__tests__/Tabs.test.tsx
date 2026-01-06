/**
 * Tabs.test.tsx - Tests for Tabs component and sub-components
 *
 * Purpose: Verify tab navigation, state management, accessibility, and controlled/uncontrolled modes
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs';

describe('Tabs', () => {
  describe('Uncontrolled Mode', () => {
    it('should render with default value', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });

    it('should switch tabs when trigger is clicked', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      // Initially shows Content 1
      expect(screen.getByText('Content 1')).toBeInTheDocument();

      // Click Tab 2
      fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));

      // Now shows Content 2
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });

    it('should start with empty state when no defaultValue', () => {
      render(
        <Tabs>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
        </Tabs>
      );

      // No content shown initially
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
    });
  });

  describe('Controlled Mode', () => {
    it('should use controlled value', () => {
      render(
        <Tabs value="tab2">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });

    it('should call onValueChange when tab is clicked', () => {
      const onValueChange = vi.fn();

      render(
        <Tabs value="tab1" onValueChange={onValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));

      expect(onValueChange).toHaveBeenCalledWith('tab2');
    });

    it('should not change internal state in controlled mode', () => {
      const { rerender } = render(
        <Tabs value="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      // Click Tab 2 (but value is controlled)
      fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));

      // Still shows Content 1 because value is controlled
      expect(screen.getByText('Content 1')).toBeInTheDocument();

      // Update via prop
      rerender(
        <Tabs value="tab2">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should apply custom className to Tabs', () => {
      const { container } = render(
        <Tabs className="custom-tabs" defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );

      expect(container.querySelector('.custom-tabs')).toBeInTheDocument();
    });

    it('should apply custom className to TabsList', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList className="custom-list">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      );

      expect(screen.getByRole('tablist')).toHaveClass('custom-list');
    });
  });
});

describe('TabsList', () => {
  it('should render with tablist role', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>
    );

    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('should apply base styles', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList data-testid="list">
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>
    );

    const list = screen.getByTestId('list');
    expect(list).toHaveClass('inline-flex');
    expect(list).toHaveClass('bg-gray-100');
    expect(list).toHaveClass('rounded-md');
  });

  it('should forward ref', () => {
    const ref = vi.fn();

    render(
      <Tabs defaultValue="tab1">
        <TabsList ref={ref}>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>
    );

    expect(ref).toHaveBeenCalled();
  });
});

describe('TabsTrigger', () => {
  it('should render with tab role', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>
    );

    expect(screen.getByRole('tab', { name: 'Tab 1' })).toBeInTheDocument();
  });

  it('should have aria-selected=true when active', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>
    );

    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute('aria-selected', 'false');
  });

  it('should apply active styles when selected', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" data-testid="trigger1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2" data-testid="trigger2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>
    );

    const trigger1 = screen.getByTestId('trigger1');
    const trigger2 = screen.getByTestId('trigger2');

    expect(trigger1).toHaveClass('bg-white');
    expect(trigger1).toHaveClass('text-gray-950');
    expect(trigger2).not.toHaveClass('bg-white');
  });

  it('should throw error when used outside Tabs', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TabsTrigger value="tab1">Tab 1</TabsTrigger>);
    }).toThrow('TabsTrigger must be used within Tabs');

    consoleSpy.mockRestore();
  });

  it('should forward ref', () => {
    const ref = vi.fn();

    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" ref={ref}>Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>
    );

    expect(ref).toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" className="custom-trigger">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>
    );

    expect(screen.getByRole('tab')).toHaveClass('custom-trigger');
  });
});

describe('TabsContent', () => {
  it('should render with tabpanel role when active', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>
    );

    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('should not render when not active', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    // Only one tabpanel visible
    const panels = screen.getAllByRole('tabpanel');
    expect(panels).toHaveLength(1);
    expect(panels[0]).toHaveTextContent('Content 1');
  });

  it('should throw error when used outside Tabs', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TabsContent value="tab1">Content</TabsContent>);
    }).toThrow('TabsContent must be used within Tabs');

    consoleSpy.mockRestore();
  });

  it('should forward ref', () => {
    const ref = vi.fn();

    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" ref={ref}>Content</TabsContent>
      </Tabs>
    );

    expect(ref).toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="custom-content">Content</TabsContent>
      </Tabs>
    );

    expect(screen.getByRole('tabpanel')).toHaveClass('custom-content');
  });
});

describe('Tabs Accessibility', () => {
  it('should have proper ARIA structure', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    // Has tablist
    expect(screen.getByRole('tablist')).toBeInTheDocument();

    // Has tabs
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);

    // Has tabpanel
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('should maintain selection state correctly', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
        <TabsContent value="tab3">Content 3</TabsContent>
      </Tabs>
    );

    // Initially Tab 1 is selected
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('aria-selected', 'true');

    // Switch to Tab 3
    fireEvent.click(screen.getByRole('tab', { name: 'Tab 3' }));

    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Tab 3' })).toHaveAttribute('aria-selected', 'true');
  });
});
