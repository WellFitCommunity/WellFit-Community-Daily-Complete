import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SystemAdminDashboard } from '../SystemAdminDashboard';

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null, count: 0 }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
  useUser: () => ({ id: 'test-user-id' }),
}));

// Mock AdminAuthContext
vi.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    isAdminAuthenticated: true,
    adminRole: 'admin',
    hasAccess: vi.fn(() => true),
  }),
}));

// Mock auditLogger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SystemAdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton with animated pulse elements', () => {
    render(
      <MemoryRouter>
        <SystemAdminDashboard />
      </MemoryRouter>
    );

    // Should show loading skeleton with animate-pulse class
    const pulseElements = document.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders dashboard header after loading', async () => {
    render(
      <MemoryRouter>
        <SystemAdminDashboard />
      </MemoryRouter>
    );

    // Wait for loading to complete and check for header
    await waitFor(() => {
      expect(screen.getByText('System Administration')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('displays refresh button', async () => {
    render(
      <MemoryRouter>
        <SystemAdminDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('renders loading or content state', async () => {
    render(
      <MemoryRouter>
        <SystemAdminDashboard />
      </MemoryRouter>
    );

    // Should show either loading skeleton or System Administration content
    await waitFor(() => {
      const hasContent =
        document.querySelector('.animate-pulse') ||
        screen.queryByText('System Administration');
      expect(hasContent).toBeTruthy();
    }, { timeout: 3000 });
  });
});
