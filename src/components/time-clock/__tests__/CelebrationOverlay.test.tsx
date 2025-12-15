/**
 * CelebrationOverlay Component Tests
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { CelebrationOverlay } from '../CelebrationOverlay';

// Mock react-confetti
vi.mock('react-confetti', () => {
  return function MockConfetti() {
    return <div data-testid="confetti">Confetti</div>;
  };
});

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe('CelebrationOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not render when show is false', () => {
    render(
      <CelebrationOverlay
        show={false}
        message="Test message"
      />
    );

    expect(screen.queryByTestId('celebration-overlay')).not.toBeInTheDocument();
  });

  it('should render when show is true', () => {
    render(
      <CelebrationOverlay
        show={true}
        message="Great start to the day!"
      />
    );

    expect(screen.getByTestId('celebration-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('celebration-message')).toBeInTheDocument();
    expect(screen.getByTestId('celebration-text')).toHaveTextContent('Great start to the day!');
  });

  it('should display streak badge when streak > 0', () => {
    render(
      <CelebrationOverlay
        show={true}
        message="You're on a roll!"
        streak={5}
      />
    );

    expect(screen.getByText(/5 day streak/)).toBeInTheDocument();
  });

  it('should show confetti', () => {
    render(
      <CelebrationOverlay
        show={true}
        message="Test"
      />
    );

    expect(screen.getByTestId('confetti')).toBeInTheDocument();
  });

  it('should call onComplete after duration', async () => {
    const onComplete = vi.fn();

    render(
      <CelebrationOverlay
        show={true}
        message="Test"
        onComplete={onComplete}
        duration={2000}
      />
    );

    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('should not call onComplete if not provided', () => {
    render(
      <CelebrationOverlay
        show={true}
        message="Test"
        duration={1000}
      />
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should not throw
    expect(screen.getByTestId('celebration-overlay')).toBeInTheDocument();
  });

  it('should display special crown emoji for 30+ day streaks', () => {
    render(
      <CelebrationOverlay
        show={true}
        message="Champion!"
        streak={30}
      />
    );

    expect(screen.getByText(/👑/)).toBeInTheDocument();
  });

  it('should display trophy emoji for 10-29 day streaks', () => {
    render(
      <CelebrationOverlay
        show={true}
        message="Unstoppable!"
        streak={10}
      />
    );

    expect(screen.getByText(/🏆/)).toBeInTheDocument();
  });

  it('should display fire emoji for 5-9 day streaks', () => {
    render(
      <CelebrationOverlay
        show={true}
        message="On fire!"
        streak={5}
      />
    );

    expect(screen.getByText(/🔥/)).toBeInTheDocument();
  });
});
