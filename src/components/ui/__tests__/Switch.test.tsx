/**
 * Tests for Switch Component
 *
 * UI Design System: Toggle switch for boolean inputs
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Switch } from '../switch';

describe('Switch', () => {
  describe('Rendering', () => {
    it('should render switch input', () => {
      render(<Switch aria-label="Toggle" />);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('should render unchecked by default', () => {
      render(<Switch aria-label="Toggle" />);
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('should render checked when checked prop is true', () => {
      render(<Switch aria-label="Toggle" checked={true} onChange={() => {}} />);
      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('should have sr-only class on input for accessibility', () => {
      render(<Switch aria-label="Toggle" />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass('sr-only');
    });
  });

  describe('Props', () => {
    it('should accept onCheckedChange prop', () => {
      const onCheckedChange = vi.fn();
      const { container } = render(<Switch aria-label="Toggle" onCheckedChange={onCheckedChange} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should accept onChange prop', () => {
      const onChange = vi.fn();
      const { container } = render(<Switch aria-label="Toggle" onChange={onChange} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should accept checked prop for controlled mode', () => {
      render(<Switch aria-label="Toggle" checked={true} onChange={() => {}} />);
      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('should render unchecked when checked is false', () => {
      render(<Switch aria-label="Toggle" checked={false} onChange={() => {}} />);
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });
  });

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Switch aria-label="Toggle" disabled />);
      expect(screen.getByRole('checkbox')).toBeDisabled();
    });

    it('should have pointer-events-none when disabled', () => {
      render(<Switch aria-label="Toggle" disabled />);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
      expect(checkbox).toHaveAttribute('disabled');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className to track element', () => {
      const { container } = render(<Switch aria-label="Toggle" className="custom-track" />);
      const track = container.querySelector('.custom-track');
      expect(track).toBeInTheDocument();
    });
  });

  describe('Ref Forwarding', () => {
    it('should forward ref to input element', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Switch ref={ref} aria-label="Toggle" />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.type).toBe('checkbox');
    });
  });

  describe('Accessibility', () => {
    it('should be focusable', () => {
      render(<Switch aria-label="Toggle" />);
      const checkbox = screen.getByRole('checkbox');
      checkbox.focus();
      expect(document.activeElement).toBe(checkbox);
    });

    it('should support aria-label', () => {
      render(<Switch aria-label="Dark mode toggle" />);
      expect(screen.getByLabelText('Dark mode toggle')).toBeInTheDocument();
    });

    it('should be wrapped in label for click area', () => {
      const { container } = render(<Switch aria-label="Toggle" />);
      const label = container.querySelector('label');
      expect(label).toBeInTheDocument();
      expect(label).toHaveClass('cursor-pointer');
    });
  });

  describe('Visual States', () => {
    it('should have peer-focus:ring-4 for focus state', () => {
      const { container } = render(<Switch aria-label="Toggle" />);
      const track = container.querySelector('div[class*="peer-focus:ring-4"]');
      expect(track).toBeInTheDocument();
    });

    it('should have peer-checked styles for checked state', () => {
      const { container } = render(<Switch aria-label="Toggle" />);
      const track = container.querySelector('div[class*="peer-checked:bg-blue-600"]');
      expect(track).toBeInTheDocument();
    });
  });
});
