/**
 * ScribeModeSwitcher.test.tsx - Tests for ScribeModeSwitcher component
 *
 * Purpose: Verify three-way mode toggle (SmartScribe, Compass Riley, Consultation),
 *          accessibility radio semantics, and disabled states.
 * Updated for Session 7: Consultation mode added.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScribeModeSwitcher } from '../ScribeModeSwitcher';

describe('ScribeModeSwitcher', () => {
  describe('Rendering', () => {
    it('should render all three mode buttons', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      expect(screen.getByText('SmartScribe')).toBeInTheDocument();
      expect(screen.getByText('Compass Riley')).toBeInTheDocument();
      expect(screen.getByText('Consultation')).toBeInTheDocument();
    });

    it('should show role sublabels for each mode', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      expect(screen.getByText('(Nurses)')).toBeInTheDocument();
      expect(screen.getByText('(Scribe)')).toBeInTheDocument();
      expect(screen.getByText('(Reasoning)')).toBeInTheDocument();
    });

    it('should use radiogroup role for the container', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      expect(screen.getByRole('radiogroup', { name: /scribe mode selector/i })).toBeInTheDocument();
    });

    it('should render radio buttons for each mode', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
    });
  });

  describe('Mode Selection', () => {
    it('should highlight SmartScribe with blue when active', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="smartscribe" onModeChange={onModeChange} />);

      const smartScribeButton = screen.getByRole('radio', { name: /smartscribe/i });
      expect(smartScribeButton).toHaveClass('bg-blue-600');
    });

    it('should highlight Compass Riley with teal when active', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      const compassButton = screen.getByRole('radio', { name: /compass riley/i });
      expect(compassButton).toHaveClass('bg-[#00857a]');
    });

    it('should highlight Consultation with purple when active', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="consultation" onModeChange={onModeChange} />);

      const consultButton = screen.getByRole('radio', { name: /consultation/i });
      expect(consultButton).toHaveClass('bg-purple-600');
    });

    it('should call onModeChange with smartscribe when SmartScribe clicked', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      fireEvent.click(screen.getByRole('radio', { name: /smartscribe/i }));
      expect(onModeChange).toHaveBeenCalledWith('smartscribe');
    });

    it('should call onModeChange with compass-riley when Compass Riley clicked', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="smartscribe" onModeChange={onModeChange} />);

      fireEvent.click(screen.getByRole('radio', { name: /compass riley/i }));
      expect(onModeChange).toHaveBeenCalledWith('compass-riley');
    });

    it('should call onModeChange with consultation when Consultation clicked', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      fireEvent.click(screen.getByRole('radio', { name: /consultation/i }));
      expect(onModeChange).toHaveBeenCalledWith('consultation');
    });
  });

  describe('Disabled State', () => {
    it('should disable all three buttons when disabled prop is true', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} disabled />);

      const radios = screen.getAllByRole('radio');
      radios.forEach(radio => {
        expect(radio).toBeDisabled();
      });
    });

    it('should not call onModeChange when disabled and clicked', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} disabled />);

      fireEvent.click(screen.getByRole('radio', { name: /smartscribe/i }));
      fireEvent.click(screen.getByRole('radio', { name: /consultation/i }));
      expect(onModeChange).not.toHaveBeenCalled();
    });

    it('should apply opacity styling when disabled', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} disabled />);

      const radios = screen.getAllByRole('radio');
      radios.forEach(radio => {
        expect(radio).toHaveClass('opacity-50');
      });
    });
  });

  describe('Accessibility', () => {
    it('should set aria-checked true on active mode', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="consultation" onModeChange={onModeChange} />);

      const consultButton = screen.getByRole('radio', { name: /consultation/i });
      expect(consultButton).toHaveAttribute('aria-checked', 'true');

      const smartScribeButton = screen.getByRole('radio', { name: /smartscribe/i });
      expect(smartScribeButton).toHaveAttribute('aria-checked', 'false');

      const compassButton = screen.getByRole('radio', { name: /compass riley/i });
      expect(compassButton).toHaveAttribute('aria-checked', 'false');
    });

    it('should have descriptive aria-labels for all modes', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      expect(screen.getByLabelText(/switch to smartscribe mode for nurses/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/switch to compass riley scribe mode for physicians/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/switch to consultation mode for clinical reasoning/i)).toBeInTheDocument();
    });

    it('should have minimum touch target size of 44px on all buttons', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      const radios = screen.getAllByRole('radio');
      radios.forEach(radio => {
        expect(radio).toHaveClass('min-h-[44px]');
        expect(radio).toHaveClass('min-w-[44px]');
      });
    });
  });
});
