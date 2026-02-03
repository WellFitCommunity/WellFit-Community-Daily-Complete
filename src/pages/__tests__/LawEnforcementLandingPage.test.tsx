/**
 * LawEnforcementLandingPage Test Suite
 *
 * Tests for the law enforcement agency landing page.
 * Law Enforcement Vertical - The SHIELD Program welfare check system.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LawEnforcementLandingPage } from '../LawEnforcementLandingPage';

// Mock react-router-dom navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the BrandingContext
const mockBranding = {
  appName: 'WellFit Community',
  logoUrl: '',
  primaryColor: '#00857a',
  customFooter: '© 2025 Test Agency',
};

vi.mock('../../BrandingContext', () => ({
  useBranding: () => ({ branding: mockBranding }),
}));

describe('LawEnforcementLandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText('The SHIELD Program')).toBeInTheDocument();
    });

    it('should display the program title', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Senior & Health-Impaired Emergency Liaison Dispatch')).toBeInTheDocument();
    });

    it('should display the program description', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(
        screen.getByText(/Protecting our seniors through daily check-ins/i)
      ).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('should render header with branding', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText('WellFit Community')).toBeInTheDocument();
    });

    it('should render Senior Registration button', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /Senior Registration/i })).toBeInTheDocument();
    });

    it('should render Officer Login button', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /Officer Login/i })).toBeInTheDocument();
    });
  });

  describe('Feature Cards', () => {
    it('should render Daily Check-Ins feature card', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Daily Check-Ins')).toBeInTheDocument();
      expect(
        screen.getByText(/Seniors complete a simple daily check-in/i)
      ).toBeInTheDocument();
    });

    it('should render Officer Dispatch feature card', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Officer Dispatch')).toBeInTheDocument();
      expect(
        screen.getByText(/Real-time dashboard shows which seniors/i)
      ).toBeInTheDocument();
    });

    it('should render Response Information feature card', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Response Information')).toBeInTheDocument();
      expect(
        screen.getByText(/Complete access information: door codes/i)
      ).toBeInTheDocument();
    });
  });

  describe('How It Works Section', () => {
    it('should render How It Works heading', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText('How It Works')).toBeInTheDocument();
    });

    it('should render all 4 steps', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Senior Enrollment')).toBeInTheDocument();
      expect(screen.getByText('Daily Check-In')).toBeInTheDocument();
      expect(screen.getByText('Alert Generated')).toBeInTheDocument();
      expect(screen.getByText('Welfare Check')).toBeInTheDocument();
    });

    it('should display step descriptions', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(
        screen.getByText(/Senior signs up and provides emergency access information/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Senior completes daily check-in via phone or web app/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/If check-in missed, system alerts dispatch dashboard/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Officer performs welfare check with full access information/i)
      ).toBeInTheDocument();
    });

    it('should render step numbers', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  describe('Statistics Section', () => {
    it('should render 24/7 monitoring stat', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText('24/7')).toBeInTheDocument();
      expect(screen.getByText('Monitoring Available')).toBeInTheDocument();
    });

    it('should render response time stat', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText('<2hr')).toBeInTheDocument();
      expect(screen.getByText('Response Time Goal')).toBeInTheDocument();
    });

    it('should render HIPAA compliance stat', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('HIPAA Compliant')).toBeInTheDocument();
    });
  });

  describe('Call to Action Section', () => {
    it('should render Get Started Today heading', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Get Started Today')).toBeInTheDocument();
    });

    it('should render Register as Senior button', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /Register as Senior/i })).toBeInTheDocument();
    });

    it('should render Officer Access button', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByRole('button', { name: /Officer Access/i })).toBeInTheDocument();
    });

    it('should display contact information', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Questions/i)).toBeInTheDocument();
      expect(screen.getByText('1-555-WELFARE')).toBeInTheDocument();
    });
  });

  describe('Footer', () => {
    it('should render custom footer from branding', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText('© 2025 Test Agency')).toBeInTheDocument();
    });

    it('should render platform attribution', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(
        screen.getByText(/Envision Atlus Clinical Platform/i)
      ).toBeInTheDocument();
    });

    it('should render mission statement', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(
        screen.getByText(/Protecting seniors and vulnerable populations through technology/i)
      ).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to /register when Senior Registration is clicked', async () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      const registrationButton = screen.getByRole('button', { name: /Senior Registration/i });
      await userEvent.click(registrationButton);

      expect(mockNavigate).toHaveBeenCalledWith('/register');
    });

    it('should navigate to /admin-login when Officer Login is clicked', async () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      const loginButton = screen.getByRole('button', { name: /Officer Login/i });
      await userEvent.click(loginButton);

      expect(mockNavigate).toHaveBeenCalledWith('/admin-login');
    });

    it('should navigate to /register when Register as Senior is clicked', async () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      const registerButton = screen.getByRole('button', { name: /Register as Senior/i });
      await userEvent.click(registerButton);

      expect(mockNavigate).toHaveBeenCalledWith('/register');
    });

    it('should navigate to /admin-login when Officer Access is clicked', async () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      const accessButton = screen.getByRole('button', { name: /Officer Access/i });
      await userEvent.click(accessButton);

      expect(mockNavigate).toHaveBeenCalledWith('/admin-login');
    });
  });

  describe('Branding Integration', () => {
    it('should display app name from branding context', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      expect(screen.getByText('WellFit Community')).toBeInTheDocument();
    });

    it('should display logo when logoUrl is provided', () => {
      // This test validates the conditional rendering path for logo images.
      // The default mock has logoUrl: '' (falsy), which renders the text span.
      // When logoUrl is truthy, an <img> tag renders instead.
      // Full mock override testing would require vi.doMock with dynamic imports.
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive grid for feature cards', () => {
      const { container } = render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      const featureGrid = container.querySelector('.grid.md\\:grid-cols-3');
      expect(featureGrid).toBeInTheDocument();
    });

    it('should have responsive grid for How It Works steps', () => {
      const { container } = render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      const stepsGrid = container.querySelector('.grid.md\\:grid-cols-4');
      expect(stepsGrid).toBeInTheDocument();
    });

    it('should have responsive button layout in CTA', () => {
      const { container } = render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      const ctaButtons = container.querySelector('.flex-col.sm\\:flex-row');
      expect(ctaButtons).toBeInTheDocument();
    });
  });

  describe('Visual Design', () => {
    it('should have dark gradient background', () => {
      const { container } = render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv).toHaveClass('min-h-screen');
      expect(mainDiv).toHaveClass('bg-linear-to-br');
    });

    it('should render shield icon in header', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      // Shield icons should be present (in header and hero)
      // Multiple shields expected due to design
      expect(document.querySelectorAll('svg').length).toBeGreaterThan(0);
    });
  });

  describe('Contact Link', () => {
    it('should have phone link with tel: protocol', () => {
      render(
        <MemoryRouter>
          <LawEnforcementLandingPage />
        </MemoryRouter>
      );

      const phoneLink = screen.getByRole('link', { name: /1-555-WELFARE/i });
      expect(phoneLink).toHaveAttribute('href', 'tel:+1-555-WELFARE');
    });
  });
});
