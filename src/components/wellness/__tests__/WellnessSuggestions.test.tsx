/**
 * WellnessSuggestions Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WellnessSuggestions, useWellnessSuggestions } from '../WellnessSuggestions';
import { renderHook } from '@testing-library/react';

describe('WellnessSuggestions', () => {
  describe('rendering', () => {
    it('renders nothing when mood is positive', () => {
      const { container } = render(<WellnessSuggestions mood="Great" />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when mood is Good', () => {
      const { container } = render(<WellnessSuggestions mood="Good" />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when mood is Okay', () => {
      const { container } = render(<WellnessSuggestions mood="Okay" />);
      expect(container.firstChild).toBeNull();
    });

    it('renders suggestions when mood is Not Great', async () => {
      render(<WellnessSuggestions mood="Not Great" />);
      await waitFor(() => {
        expect(screen.getByText('We Care About You')).toBeInTheDocument();
      });
    });

    it('renders suggestions when mood is Sad', async () => {
      render(<WellnessSuggestions mood="Sad" />);
      await waitFor(() => {
        expect(screen.getByText('We Care About You')).toBeInTheDocument();
      });
    });

    it('renders suggestions when mood is Anxious', async () => {
      render(<WellnessSuggestions mood="Anxious" />);
      await waitFor(() => {
        expect(screen.getByText('We Care About You')).toBeInTheDocument();
      });
    });

    it('renders suggestions when mood is Tired', async () => {
      render(<WellnessSuggestions mood="Tired" />);
      await waitFor(() => {
        expect(screen.getByText('We Care About You')).toBeInTheDocument();
      });
    });

    it('renders suggestions when mood is Stressed', async () => {
      render(<WellnessSuggestions mood="Stressed" />);
      await waitFor(() => {
        expect(screen.getByText('We Care About You')).toBeInTheDocument();
      });
    });
  });

  describe('suggestion cards', () => {
    it('shows all 6 suggestion cards', async () => {
      render(<WellnessSuggestions mood="Sad" />);
      await waitFor(() => {
        expect(screen.getByText('Call a Friend or Family Member')).toBeInTheDocument();
        expect(screen.getByText('Take a Walk Outside')).toBeInTheDocument();
        expect(screen.getByText('Read a Good Book')).toBeInTheDocument();
        expect(screen.getByText('Turn Off the News')).toBeInTheDocument();
        expect(screen.getByText('Watch Something Funny')).toBeInTheDocument();
        expect(screen.getByText('Think on Positive Things')).toBeInTheDocument();
      });
    });

    it('allows clicking on suggestion cards', async () => {
      render(<WellnessSuggestions mood="Sad" />);
      await waitFor(() => {
        const walkButton = screen.getByRole('button', { name: /Take a Walk Outside/i });
        fireEvent.click(walkButton);
        // Card should be selected (highlighted)
        expect(walkButton).toHaveClass('bg-[#8cc63f]');
      });
    });
  });

  describe('mood-specific messages', () => {
    it('shows sad-specific message', async () => {
      render(<WellnessSuggestions mood="Sad" />);
      await waitFor(() => {
        expect(screen.getByText(/sorry you're feeling sad/i)).toBeInTheDocument();
      });
    });

    it('shows anxious-specific message', async () => {
      render(<WellnessSuggestions mood="Anxious" />);
      await waitFor(() => {
        expect(screen.getByText(/Feeling anxious can be tough/i)).toBeInTheDocument();
      });
    });

    it('shows tired-specific message', async () => {
      render(<WellnessSuggestions mood="Tired" />);
      await waitFor(() => {
        expect(screen.getByText(/When you're feeling tired/i)).toBeInTheDocument();
      });
    });

    it('shows stressed-specific message', async () => {
      render(<WellnessSuggestions mood="Stressed" />);
      await waitFor(() => {
        expect(screen.getByText(/Stress happens to everyone/i)).toBeInTheDocument();
      });
    });
  });

  describe('crisis resources', () => {
    it('shows 988 crisis hotline info', async () => {
      render(<WellnessSuggestions mood="Sad" />);
      await waitFor(() => {
        expect(screen.getByText(/988/)).toBeInTheDocument();
        expect(screen.getByText(/Suicide & Crisis Lifeline/i)).toBeInTheDocument();
      });
    });
  });

  describe('close functionality', () => {
    it('calls onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      render(<WellnessSuggestions mood="Sad" onClose={onClose} />);
      await waitFor(() => {
        const closeButton = screen.getByRole('button', { name: /close wellness suggestions/i });
        fireEvent.click(closeButton);
      });
      expect(onClose).toHaveBeenCalled();
    });
  });
});

describe('useWellnessSuggestions hook', () => {
  it('returns shouldShow true for down moods', () => {
    const { result } = renderHook(() => useWellnessSuggestions('Sad'));
    expect(result.current.shouldShow).toBe(true);
    expect(result.current.isDownMood).toBe(true);
  });

  it('returns shouldShow false for positive moods', () => {
    const { result } = renderHook(() => useWellnessSuggestions('Great'));
    expect(result.current.shouldShow).toBe(false);
    expect(result.current.isDownMood).toBe(false);
  });

  it('includes all down moods in list', () => {
    const { result } = renderHook(() => useWellnessSuggestions(''));
    expect(result.current.downMoods).toContain('Not Great');
    expect(result.current.downMoods).toContain('Sad');
    expect(result.current.downMoods).toContain('Anxious');
    expect(result.current.downMoods).toContain('Tired');
    expect(result.current.downMoods).toContain('Stressed');
  });
});
