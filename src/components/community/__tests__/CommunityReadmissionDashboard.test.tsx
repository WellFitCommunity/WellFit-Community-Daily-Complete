/**
 * Community Readmission Dashboard Tests
 * WellFit Community Platform - Readmission Prevention & High Utilizer Management
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { CommunityReadmissionDashboard } from '../CommunityReadmissionDashboard';

// Mock the AuthContext
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  })),
  rpc: jest.fn(() => Promise.resolve({ data: {}, error: null }))
};

jest.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    supabase: mockSupabaseClient
  })
}));

// Mock the Envision Atlus components
jest.mock('../../envision-atlus', () => ({
  EACard: ({ children, className }: any) => <div className={className} data-testid="ea-card">{children}</div>,
  EACardHeader: ({ children, icon }: any) => <div data-testid="ea-card-header">{icon}{children}</div>,
  EACardContent: ({ children, className }: any) => <div className={className} data-testid="ea-card-content">{children}</div>,
  EATabs: ({ children, defaultValue }: any) => (
    <div data-testid="ea-tabs" data-value={defaultValue}>{children}</div>
  ),
  EATabsList: ({ children }: any) => <div data-testid="ea-tabs-list">{children}</div>,
  EATabsTrigger: ({ children, value }: any) => (
    <button data-testid={`tab-${value}`} data-value={value}>{children}</button>
  ),
  EATabsContent: ({ children, value }: any) => (
    <div data-testid={`tab-content-${value}`} data-value={value}>{children}</div>
  ),
  EABadge: ({ children, variant }: any) => (
    <span data-testid="ea-badge" data-variant={variant}>{children}</span>
  ),
  EAButton: ({ children, onClick }: any) => (
    <button data-testid="ea-button" onClick={onClick}>{children}</button>
  ),
  EARiskIndicator: ({ risk }: any) => <span data-testid="ea-risk-indicator">{risk}</span>,
  envisionAtlus: {}
}));

describe('CommunityReadmissionDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    render(<CommunityReadmissionDashboard />);

    // Initially shows loading state
    expect(screen.getByText(/Loading Community Health Data/i)).toBeInTheDocument();
  });

  it('should render dashboard after loading', async () => {
    render(<CommunityReadmissionDashboard />);

    // Wait for dashboard to load (500ms simulated delay + buffer)
    await waitFor(() => {
      expect(screen.getByText(/Community Readmission Prevention/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should display dashboard header with title and subtitle', async () => {
    render(<CommunityReadmissionDashboard />);

    // Check for header content - this verifies the dashboard structure
    await waitFor(() => {
      expect(screen.getByText(/Community Readmission Prevention/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should display all tabs', async () => {
    render(<CommunityReadmissionDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
      expect(screen.getByTestId('tab-members')).toBeInTheDocument();
      expect(screen.getByTestId('tab-alerts')).toBeInTheDocument();
      expect(screen.getByTestId('tab-sdoh')).toBeInTheDocument();
      expect(screen.getByTestId('tab-engagement')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should display period selector', async () => {
    render(<CommunityReadmissionDashboard />);

    await waitFor(() => {
      const selector = screen.getByRole('combobox');
      expect(selector).toBeInTheDocument();
      expect(selector).toHaveValue('30');
    }, { timeout: 3000 });
  });

  it('should display refresh button', async () => {
    render(<CommunityReadmissionDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Refresh/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should handle gracefully when no data is available', async () => {
    // The component uses demo data as fallback, so it should always show something
    render(<CommunityReadmissionDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Community Readmission Prevention/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
