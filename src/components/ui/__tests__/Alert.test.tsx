/**
 * Tests for Alert Component
 *
 * UI Design System: Alert component for notifications and messages
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Alert, AlertDescription } from '../alert';

describe('Alert', () => {
  describe('Rendering', () => {
    it('should render alert with content', () => {
      render(<Alert>Alert message</Alert>);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Alert message')).toBeInTheDocument();
    });

    it('should render with default variant styles', () => {
      render(<Alert>Default Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('border-gray-200');
      expect(alert.className).toContain('bg-white');
    });

    it('should have rounded-lg class', () => {
      render(<Alert>Rounded</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('rounded-lg');
    });

    it('should have border and padding', () => {
      render(<Alert>Styled</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('border');
      expect(alert.className).toContain('p-4');
    });
  });

  describe('Variants', () => {
    it('should apply default variant styles explicitly', () => {
      render(<Alert variant="default">Default</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('border-gray-200');
      expect(alert.className).toContain('bg-white');
      expect(alert.className).toContain('text-gray-950');
    });

    it('should apply destructive variant styles', () => {
      render(<Alert variant="destructive">Error</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('border-red-200');
      expect(alert.className).toContain('bg-red-50');
      expect(alert.className).toContain('text-red-900');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      render(<Alert className="my-custom-alert">Custom</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('my-custom-alert');
    });

    it('should merge custom className with default styles', () => {
      render(<Alert className="custom-class">Merged</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('custom-class');
      expect(alert.className).toContain('rounded-lg');
    });
  });

  describe('Ref Forwarding', () => {
    it('should forward ref to div element', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Alert ref={ref}>Ref Alert</Alert>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Accessibility', () => {
    it('should have role="alert"', () => {
      render(<Alert>Accessible</Alert>);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should pass through aria attributes', () => {
      render(<Alert aria-label="Test alert" aria-describedby="desc">Aria</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-label', 'Test alert');
      expect(alert).toHaveAttribute('aria-describedby', 'desc');
    });
  });
});

describe('AlertDescription', () => {
  describe('Rendering', () => {
    it('should render description text', () => {
      render(<AlertDescription>Description text</AlertDescription>);
      expect(screen.getByText('Description text')).toBeInTheDocument();
    });

    it('should have text-sm class', () => {
      render(<AlertDescription>Small text</AlertDescription>);
      const description = screen.getByText('Small text');
      expect(description.className).toContain('text-sm');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      render(<AlertDescription className="my-desc">Custom</AlertDescription>);
      const description = screen.getByText('Custom');
      expect(description.className).toContain('my-desc');
    });
  });

  describe('Ref Forwarding', () => {
    it('should forward ref to paragraph element', () => {
      const ref = React.createRef<HTMLParagraphElement>();
      render(<AlertDescription ref={ref}>Ref Desc</AlertDescription>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Nested Content', () => {
    it('should render with nested paragraph elements', () => {
      render(
        <AlertDescription>
          <p>First paragraph</p>
          <p>Second paragraph</p>
        </AlertDescription>
      );
      expect(screen.getByText('First paragraph')).toBeInTheDocument();
      expect(screen.getByText('Second paragraph')).toBeInTheDocument();
    });
  });
});
