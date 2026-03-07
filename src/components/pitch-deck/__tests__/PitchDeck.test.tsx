import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PitchDeck from '../PitchDeck';

// Mock all slide components to keep test focused on navigation
vi.mock('../SlideHero', () => ({
  default: ({ isActive }: { isActive: boolean }) =>
    isActive ? <div data-testid="slide-hero">Hero Slide</div> : null,
}));
vi.mock('../SlideProblem', () => ({
  default: ({ isActive }: { isActive: boolean }) =>
    isActive ? <div data-testid="slide-problem">Problem Slide</div> : null,
}));
vi.mock('../SlideSolution', () => ({
  default: ({ isActive }: { isActive: boolean }) =>
    isActive ? <div data-testid="slide-solution">Solution Slide</div> : null,
}));
vi.mock('../SlideAIPlatform', () => ({
  default: ({ isActive }: { isActive: boolean }) =>
    isActive ? <div data-testid="slide-ai">AI Slide</div> : null,
}));
vi.mock('../SlideDeployment', () => ({
  default: ({ isActive }: { isActive: boolean }) =>
    isActive ? <div data-testid="slide-deployment">Deployment Slide</div> : null,
}));
vi.mock('../SlideMetrics', () => ({
  default: ({ isActive }: { isActive: boolean }) =>
    isActive ? <div data-testid="slide-metrics">Metrics Slide</div> : null,
}));
vi.mock('../SlideRoadmap', () => ({
  default: ({ isActive }: { isActive: boolean }) =>
    isActive ? <div data-testid="slide-roadmap">Roadmap Slide</div> : null,
}));
vi.mock('../SlideCTA', () => ({
  default: ({ isActive }: { isActive: boolean }) =>
    isActive ? <div data-testid="slide-cta">CTA Slide</div> : null,
}));

describe('PitchDeck', () => {
  it('renders the hero slide initially', () => {
    render(<PitchDeck />);
    expect(screen.getByTestId('slide-hero')).toBeInTheDocument();
    expect(screen.queryByTestId('slide-problem')).not.toBeInTheDocument();
  });

  it('shows slide counter starting at 1/8', () => {
    render(<PitchDeck />);
    expect(screen.getByText('1 / 8')).toBeInTheDocument();
  });

  it('navigates to next slide with right arrow key', async () => {
    render(<PitchDeck />);
    expect(screen.getByTestId('slide-hero')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByTestId('slide-problem')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('slide-hero')).not.toBeInTheDocument();
    expect(screen.getByText('2 / 8')).toBeInTheDocument();
  });

  it('navigates back with left arrow key', async () => {
    render(<PitchDeck />);

    // Go forward first
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByTestId('slide-problem')).toBeInTheDocument();
    });

    // Then go back
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(screen.getByTestId('slide-hero')).toBeInTheDocument();
    });
  });

  it('does not go before the first slide', () => {
    render(<PitchDeck />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('slide-hero')).toBeInTheDocument();
    expect(screen.getByText('1 / 8')).toBeInTheDocument();
  });

  it('navigates via dot indicators', async () => {
    render(<PitchDeck />);
    const dotButtons = screen.getAllByRole('button', { name: /go to slide/i });
    expect(dotButtons).toHaveLength(8);

    // Click the "Metrics" dot (index 5)
    fireEvent.click(dotButtons[5]);
    await waitFor(() => {
      expect(screen.getByTestId('slide-metrics')).toBeInTheDocument();
    });
    expect(screen.getByText('6 / 8')).toBeInTheDocument();
  });

  it('navigates forward with the next arrow button', async () => {
    render(<PitchDeck />);
    const nextButton = screen.getByRole('button', { name: /next slide/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByTestId('slide-problem')).toBeInTheDocument();
    });
  });

  it('hides previous arrow on first slide', () => {
    render(<PitchDeck />);
    expect(screen.queryByRole('button', { name: /previous slide/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next slide/i })).toBeInTheDocument();
  });

  it('advances with Space key', async () => {
    render(<PitchDeck />);
    fireEvent.keyDown(window, { key: ' ' });

    await waitFor(() => {
      expect(screen.getByTestId('slide-problem')).toBeInTheDocument();
    });
  });
});
