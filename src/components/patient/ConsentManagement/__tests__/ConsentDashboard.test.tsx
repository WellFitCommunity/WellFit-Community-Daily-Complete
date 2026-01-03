/**
 * ConsentDashboard Tests
 *
 * Tests for the main consent management portal component.
 * Covers: Rendering, tabs, data display.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConsentDashboard from '../ConsentDashboard';

// Mock AuthContext
vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

// Mock child components
vi.mock('../AuthorizedAppsList', () => ({
  default: () => <div data-testid="authorized-apps-list">AuthorizedAppsList Mock</div>,
}));

vi.mock('../ConsentAuditLog', () => ({
  default: () => <div data-testid="consent-audit-log">ConsentAuditLog Mock</div>,
}));

vi.mock('../GrantAccessModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="grant-access-modal">
      Grant Data Access
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock supabaseClient
vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

// Mock auditLogger
vi.mock('../../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ConsentDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the main title', () => {
    render(
      <MemoryRouter>
        <ConsentDashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('Consent Management')).toBeInTheDocument();
  });

  it('displays Grant Access button', () => {
    render(
      <MemoryRouter>
        <ConsentDashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('Grant Access')).toBeInTheDocument();
  });

  it('opens grant access modal when button clicked', async () => {
    render(
      <MemoryRouter>
        <ConsentDashboard />
      </MemoryRouter>
    );

    const grantButton = screen.getByText('Grant Access');
    fireEvent.click(grantButton);

    await waitFor(() => {
      expect(screen.getByTestId('grant-access-modal')).toBeInTheDocument();
    });
  });

  it('switches to apps tab when clicked', async () => {
    render(
      <MemoryRouter>
        <ConsentDashboard />
      </MemoryRouter>
    );

    // Use getAllByText since "Connected Apps" appears in both tab and stat card
    const connectedAppsElements = screen.getAllByText('Connected Apps');
    // The tab button should be the one in the nav
    const appsTab = connectedAppsElements.find(el => el.closest('nav'));
    if (appsTab) {
      fireEvent.click(appsTab);
    }

    await waitFor(() => {
      expect(screen.getByTestId('authorized-apps-list')).toBeInTheDocument();
    });
  });

  it('switches to audit log tab when clicked', async () => {
    render(
      <MemoryRouter>
        <ConsentDashboard />
      </MemoryRouter>
    );

    const auditTab = screen.getByText('Access Log');
    fireEvent.click(auditTab);

    await waitFor(() => {
      expect(screen.getByTestId('consent-audit-log')).toBeInTheDocument();
    });
  });

  it('displays Your Data Rights section', () => {
    render(
      <MemoryRouter>
        <ConsentDashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('Your Data Rights')).toBeInTheDocument();
  });

  it('displays 21st Century Cures Act reference', () => {
    render(
      <MemoryRouter>
        <ConsentDashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('21st Century Cures Act')).toBeInTheDocument();
  });
});
