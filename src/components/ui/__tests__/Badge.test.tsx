/**
 * Tests for Badge Component
 *
 * UI Design System: Badge component for status and labels
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge } from '../badge';

describe('Badge', () => {
  describe('Rendering', () => {
    it('should render badge with text content', () => {
      render(<Badge>Status</Badge>);
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('should render with default variant styles', () => {
      render(<Badge>Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge.className).toContain('bg-gray-900');
      expect(badge.className).toContain('text-gray-50');
    });

    it('should have rounded-full class', () => {
      render(<Badge>Rounded</Badge>);
      const badge = screen.getByText('Rounded');
      expect(badge.className).toContain('rounded-full');
    });
  });

  describe('Variants', () => {
    it('should apply secondary variant styles', () => {
      render(<Badge variant="secondary">Secondary</Badge>);
      const badge = screen.getByText('Secondary');
      expect(badge.className).toContain('bg-gray-100');
      expect(badge.className).toContain('text-gray-900');
    });

    it('should apply destructive variant styles', () => {
      render(<Badge variant="destructive">Error</Badge>);
      const badge = screen.getByText('Error');
      expect(badge.className).toContain('bg-red-500');
      expect(badge.className).toContain('text-gray-50');
    });

    it('should apply outline variant styles', () => {
      render(<Badge variant="outline">Outline</Badge>);
      const badge = screen.getByText('Outline');
      expect(badge.className).toContain('border');
      expect(badge.className).toContain('text-gray-950');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      render(<Badge className="my-custom-badge">Custom</Badge>);
      const badge = screen.getByText('Custom');
      expect(badge.className).toContain('my-custom-badge');
    });

    it('should merge custom className with default styles', () => {
      render(<Badge className="custom-class">Merged</Badge>);
      const badge = screen.getByText('Merged');
      expect(badge.className).toContain('custom-class');
      expect(badge.className).toContain('inline-flex');
    });
  });

  describe('Ref Forwarding', () => {
    it('should forward ref to div element', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Badge ref={ref}>Ref Badge</Badge>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Accessibility', () => {
    it('should have proper font sizing for readability', () => {
      render(<Badge>Readable</Badge>);
      const badge = screen.getByText('Readable');
      expect(badge.className).toContain('text-xs');
      expect(badge.className).toContain('font-semibold');
    });

    it('should have focus ring styles', () => {
      render(<Badge>Focusable</Badge>);
      const badge = screen.getByText('Focusable');
      expect(badge.className).toContain('focus:ring-2');
    });
  });

  describe('Semantic Usage', () => {
    it('should render as div element', () => {
      const { container } = render(<Badge>Div</Badge>);
      expect(container.firstChild?.nodeName).toBe('DIV');
    });

    it('should pass through additional props', () => {
      render(<Badge data-testid="test-badge" title="Test Title">Props</Badge>);
      const badge = screen.getByTestId('test-badge');
      expect(badge).toHaveAttribute('title', 'Test Title');
    });
  });
});
