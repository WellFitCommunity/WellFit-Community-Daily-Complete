/**
 * ScribeModeSwitcher.test.tsx - Tests for ScribeModeSwitcher component
 *
 * Purpose: Verify mode toggle functionality, accessibility, and disabled states
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScribeModeSwitcher } from '../ScribeModeSwitcher';

describe('ScribeModeSwitcher', () => {
  describe('Rendering', () => {
    it('should render both mode buttons', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      expect(screen.getByText('SmartScribe')).toBeInTheDocument();
      expect(screen.getByText('Compass Riley')).toBeInTheDocument();
    });

    it('should show nurse label for SmartScribe', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      expect(screen.getByText('(Nurses)')).toBeInTheDocument();
    });

    it('should show physician label for Compass Riley', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      expect(screen.getByText('(Physicians)')).toBeInTheDocument();
    });
  });

  describe('Mode Selection', () => {
    it('should highlight SmartScribe when in smartscribe mode', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="smartscribe" onModeChange={onModeChange} />);

      const smartScribeButton = screen.getByRole('button', { name: /switch to smartscribe/i });
      expect(smartScribeButton).toHaveClass('bg-blue-600');
    });

    it('should highlight Compass Riley when in compass-riley mode', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      const compassButton = screen.getByRole('button', { name: /switch to compass riley/i });
      expect(compassButton).toHaveClass('bg-[#00857a]');
    });

    it('should call onModeChange with smartscribe when SmartScribe clicked', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      const smartScribeButton = screen.getByRole('button', { name: /switch to smartscribe/i });
      fireEvent.click(smartScribeButton);

      expect(onModeChange).toHaveBeenCalledWith('smartscribe');
    });

    it('should call onModeChange with compass-riley when Compass Riley clicked', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="smartscribe" onModeChange={onModeChange} />);

      const compassButton = screen.getByRole('button', { name: /switch to compass riley/i });
      fireEvent.click(compassButton);

      expect(onModeChange).toHaveBeenCalledWith('compass-riley');
    });
  });

  describe('Disabled State', () => {
    it('should disable both buttons when disabled prop is true', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} disabled />);

      const smartScribeButton = screen.getByRole('button', { name: /switch to smartscribe/i });
      const compassButton = screen.getByRole('button', { name: /switch to compass riley/i });

      expect(smartScribeButton).toBeDisabled();
      expect(compassButton).toBeDisabled();
    });

    it('should not call onModeChange when disabled and clicked', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} disabled />);

      const smartScribeButton = screen.getByRole('button', { name: /switch to smartscribe/i });
      fireEvent.click(smartScribeButton);

      expect(onModeChange).not.toHaveBeenCalled();
    });

    it('should apply opacity styling when disabled', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} disabled />);

      const smartScribeButton = screen.getByRole('button', { name: /switch to smartscribe/i });
      expect(smartScribeButton).toHaveClass('opacity-50');
    });
  });

  describe('Accessibility', () => {
    it('should have aria-pressed attribute on buttons', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="smartscribe" onModeChange={onModeChange} />);

      const smartScribeButton = screen.getByRole('button', { name: /switch to smartscribe/i });
      const compassButton = screen.getByRole('button', { name: /switch to compass riley/i });

      expect(smartScribeButton).toHaveAttribute('aria-pressed', 'true');
      expect(compassButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should have descriptive aria-labels', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      expect(screen.getByLabelText(/switch to smartscribe mode for nurses/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/switch to compass riley mode for physicians/i)).toBeInTheDocument();
    });

    it('should have minimum touch target size of 44px', () => {
      const onModeChange = vi.fn();
      render(<ScribeModeSwitcher mode="compass-riley" onModeChange={onModeChange} />);

      const smartScribeButton = screen.getByRole('button', { name: /switch to smartscribe/i });
      expect(smartScribeButton).toHaveClass('min-h-[44px]');
      expect(smartScribeButton).toHaveClass('min-w-[44px]');
    });
  });
});
