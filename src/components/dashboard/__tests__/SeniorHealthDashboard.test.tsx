import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
// src/components/dashboard/__tests__/SeniorHealthDashboard.test.tsx
// Tests for the senior-facing health dashboard component

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SeniorHealthDashboard from '../SeniorHealthDashboard';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../../../BrandingContext';

// Mock dependencies
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

vi.mock('../../../BrandingContext', () => ({
  useBranding: vi.fn(),
}));

// Mock child components - must return object with default for default exports
vi.mock('../../CheckInTracker', () => ({
  default: function MockCheckInTracker() {
    return <div data-testid="check-in-tracker">Check In Tracker</div>;
  },
}));

vi.mock('../../HealthHistory', () => ({
  default: function MockHealthHistory() {
    return <div data-testid="health-history">Health History</div>;
  },
}));

vi.mock('../DashMealOfTheDay', () => ({
  default: function MockDashMealOfTheDay() {
    return <div data-testid="meal-of-day">Meal of the Day</div>;
  },
}));

vi.mock('../WeatherWidget', () => ({
  default: function MockWeatherWidget() {
    return <div data-testid="weather-widget">Weather Widget</div>;
  },
}));

vi.mock('../DailyScripture', () => ({
  default: function MockDailyScripture() {
    return <div data-testid="daily-scripture">Daily Scripture</div>;
  },
}));

vi.mock('../TechTip', () => ({
  default: function MockTechTip() {
    return <div data-testid="tech-tip">Tech Tip</div>;
  },
}));

vi.mock('../../features/EmergencyContact', () => ({
  default: function MockEmergencyContact() {
    return <div data-testid="emergency-contact">Emergency Contact</div>;
  },
}));

vi.mock('../PositiveAffirmations', () => ({
  default: function MockPositiveAffirmations() {
    return <div data-testid="positive-affirmations">Positive Affirmations</div>;
  },
}));

describe('SeniorHealthDashboard - Senior Facing Component', () => {
  let mockNavigate: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockNavigate = vi.fn();
    (useNavigate as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigate);
    (useBranding as ReturnType<typeof vi.fn>).mockReturnValue({
      branding: {
        gradient: 'linear-gradient(to bottom, #E0F2FE, #FFFFFF)',
        primaryColor: '#4F46E5',
        appName: 'WellFit',
      },
    });
  });

  describe('Component Rendering', () => {
    it('should render the senior health dashboard', () => {
      render(<SeniorHealthDashboard />);

      expect(screen.getByText(/Your Health Today/i)).toBeInTheDocument();
    });

    it('should display welcoming header message', () => {
      render(<SeniorHealthDashboard />);

      expect(screen.getByText(/check in today/i)).toBeInTheDocument();
    });

    it('should render all dashboard widgets', () => {
      render(<SeniorHealthDashboard />);

      expect(screen.getByTestId('check-in-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('health-history')).toBeInTheDocument();
      expect(screen.getByTestId('weather-widget')).toBeInTheDocument();
      expect(screen.getByTestId('daily-scripture')).toBeInTheDocument();
      expect(screen.getByTestId('tech-tip')).toBeInTheDocument();
      expect(screen.getByTestId('emergency-contact')).toBeInTheDocument();
      expect(screen.getByTestId('positive-affirmations')).toBeInTheDocument();
      expect(screen.getByTestId('meal-of-day')).toBeInTheDocument();
    });
  });

  describe('Dashboard Sections', () => {
    it('should display weather widget', () => {
      render(<SeniorHealthDashboard />);

      expect(screen.getByTestId('weather-widget')).toBeInTheDocument();
    });

    it('should display daily scripture widget', () => {
      render(<SeniorHealthDashboard />);

      expect(screen.getByTestId('daily-scripture')).toBeInTheDocument();
    });

    it('should display daily check-in section', () => {
      render(<SeniorHealthDashboard />);

      expect(screen.getByTestId('check-in-tracker')).toBeInTheDocument();
    });

    it('should display health history section', () => {
      render(<SeniorHealthDashboard />);

      expect(screen.getByTestId('health-history')).toBeInTheDocument();
    });

    it('should display emergency contact section', () => {
      render(<SeniorHealthDashboard />);

      expect(screen.getByTestId('emergency-contact')).toBeInTheDocument();
    });

    it('should display positive affirmations widget', () => {
      render(<SeniorHealthDashboard />);

      expect(screen.getByTestId('positive-affirmations')).toBeInTheDocument();
    });

    it('should display tech tips widget', () => {
      render(<SeniorHealthDashboard />);

      expect(screen.getByTestId('tech-tip')).toBeInTheDocument();
    });

    it('should display meal of the day section', () => {
      render(<SeniorHealthDashboard />);

      expect(screen.getByTestId('meal-of-day')).toBeInTheDocument();
    });
  });

  describe('Navigation Actions', () => {
    it('should have self-report button', () => {
      render(<SeniorHealthDashboard />);

      expect(screen.getByText(/Self Report/i)).toBeInTheDocument();
    });

    it('should navigate to self-reporting page when button is clicked', () => {
      render(<SeniorHealthDashboard />);

      const selfReportButton = screen.getByText(/Report Symptoms/i);
      fireEvent.click(selfReportButton);

      expect(mockNavigate).toHaveBeenCalledWith('/self-reporting');
    });

    it('should have word search game button', () => {
      render(<SeniorHealthDashboard />);

      expect(screen.getByText(/Word Search/i)).toBeInTheDocument();
    });
  });

  describe('Senior-Friendly UI', () => {
    it('should display large emoji icons', () => {
      render(<SeniorHealthDashboard />);

      // Check for emoji icons in various cards
      const icons = screen.getAllByText(/📋|🧩/);
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have large, readable buttons', () => {
      render(<SeniorHealthDashboard />);

      const reportButton = screen.getByText(/Report Symptoms/i);
      expect(reportButton).toHaveClass('text-lg', 'sm:text-xl');
    });

    it('should have clear section headings', () => {
      render(<SeniorHealthDashboard />);

      const heading = screen.getByText(/Your Health Today/i);
      expect(heading.tagName).toBe('H1');
      expect(heading).toHaveClass('text-2xl', 'sm:text-3xl', 'lg:text-4xl');
    });

    it('should use card layout for easy scanning', () => {
      render(<SeniorHealthDashboard />);

      const heading = screen.getByText(/Your Health Today/i);
      expect(heading).toBeInTheDocument();
    });

    it('should have descriptive text for each section', () => {
      render(<SeniorHealthDashboard />);

      expect(screen.getByText(/Share how you're feeling with your care team/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have semantic HTML structure', () => {
      render(<SeniorHealthDashboard />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it('should have accessible buttons', () => {
      render(<SeniorHealthDashboard />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach(button => {
        expect(button).toBeEnabled();
      });
    });

    it('should support keyboard navigation', () => {
      render(<SeniorHealthDashboard />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).not.toHaveAttribute('tabIndex', '-1');
      });
    });

    it('should have sufficient color contrast', () => {
      render(<SeniorHealthDashboard />);

      const reportButton = screen.getByText(/Report Symptoms/i);
      // Blue button with white text should have good contrast
      expect(reportButton).toHaveClass('bg-blue-600', 'text-white');
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive grid layout', () => {
      const { container } = render(<SeniorHealthDashboard />);

      const grid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');
      expect(grid).toBeInTheDocument();
    });

    it('should have responsive text sizes', () => {
      render(<SeniorHealthDashboard />);

      const heading = screen.getByText(/Your Health Today/i);
      expect(heading).toHaveClass('text-2xl', 'sm:text-3xl', 'lg:text-4xl');
    });

    it('should have responsive padding', () => {
      const { container } = render(<SeniorHealthDashboard />);

      const paddedContainer = container.querySelector('.px-3.sm\\:px-4');
      expect(paddedContainer).toBeInTheDocument();
    });

    it('should have responsive spacing between cards', () => {
      const { container } = render(<SeniorHealthDashboard />);

      const grid = container.querySelector('.gap-4.sm\\:gap-6');
      expect(grid).toBeInTheDocument();
    });
  });

  describe('Branding Integration', () => {
    it('should use branding gradient background', () => {
      const { container } = render(<SeniorHealthDashboard />);

      const mainDiv = container.querySelector('.min-h-screen');
      expect(mainDiv).toHaveStyle({
        background: 'linear-gradient(to bottom, #E0F2FE, #FFFFFF)',
      });
    });

    it('should handle missing branding gracefully', () => {
      (useBranding as ReturnType<typeof vi.fn>).mockReturnValue({
        branding: {},
      });

      render(<SeniorHealthDashboard />);

      expect(screen.getByText(/Your Health Today/i)).toBeInTheDocument();
    });
  });

  describe('Content Organization', () => {
    it('should place check-in at prominent position', () => {
      render(<SeniorHealthDashboard />);

      // Check-in should be rendered
      expect(screen.getByTestId('check-in-tracker')).toBeInTheDocument();
    });

    it('should group related health information together', () => {
      render(<SeniorHealthDashboard />);

      // All health-related components should be present
      expect(screen.getByTestId('check-in-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('health-history')).toBeInTheDocument();
    });

    it('should provide multiple engagement options', () => {
      render(<SeniorHealthDashboard />);

      // Multiple interactive elements
      expect(screen.getByText(/Self Report/i)).toBeInTheDocument();
      expect(screen.getByText(/Word Search/i)).toBeInTheDocument();
    });
  });

  describe('User Experience', () => {
    it('should minimize clicks to important actions', () => {
      render(<SeniorHealthDashboard />);

      // One-click access to self-reporting
      const reportButton = screen.getByText(/Report Symptoms/i);
      expect(reportButton).toBeInTheDocument();
      fireEvent.click(reportButton);
      expect(mockNavigate).toHaveBeenCalledWith('/self-reporting');
    });

    it('should provide clear visual hierarchy', () => {
      const { container } = render(<SeniorHealthDashboard />);

      // Main heading should be largest
      const h1 = container.querySelector('h1');
      expect(h1).toHaveClass('text-2xl', 'sm:text-3xl', 'lg:text-4xl');

      // Section headings should be smaller
      const h3Elements = container.querySelectorAll('h3');
      h3Elements.forEach(h3 => {
        const classes = h3.className;
        expect(
          classes.includes('text-lg') ||
          classes.includes('text-xl') ||
          classes.includes('text-2xl')
        ).toBe(true);
      });
    });

    it('should use encouraging, positive language', () => {
      render(<SeniorHealthDashboard />);

      expect(screen.getByText(/Your Health Today/i)).toBeInTheDocument();
      expect(screen.getByText(/check in today/i)).toBeInTheDocument();
    });
  });

  describe('Interactive Elements', () => {
    it('should have clickable cards for actions', () => {
      render(<SeniorHealthDashboard />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach(button => {
        expect(button).toBeEnabled();
      });
    });

    it('should provide visual feedback on hover', () => {
      render(<SeniorHealthDashboard />);

      const reportButton = screen.getByText(/Report Symptoms/i);
      expect(reportButton).toHaveClass('hover:bg-blue-700');
    });
  });
});
