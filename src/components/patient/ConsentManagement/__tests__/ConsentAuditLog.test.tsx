/**
 * ConsentAuditLog Tests
 *
 * Tests for the consent access history/audit log component.
 * Covers: Rendering, loading states, filtering, empty state.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConsentAuditLog from '../ConsentAuditLog';

// Mock supabaseClient with immediate resolution
vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
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

describe('ConsentAuditLog', () => {
  const defaultProps = {
    userId: 'test-user-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <ConsentAuditLog {...defaultProps} />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(
      <MemoryRouter>
        <ConsentAuditLog {...defaultProps} />
      </MemoryRouter>
    );
    // Loading skeleton should be present
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('displays Access History title after loading', async () => {
    render(
      <MemoryRouter>
        <ConsentAuditLog {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Access History')).toBeInTheDocument();
    });
  });

  it('displays empty state title when no entries', async () => {
    render(
      <MemoryRouter>
        <ConsentAuditLog {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No Access History')).toBeInTheDocument();
    });
  });

  it('displays empty state message', async () => {
    render(
      <MemoryRouter>
        <ConsentAuditLog {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No one has accessed your health data yet/)).toBeInTheDocument();
    });
  });

  it('displays All Activity filter button', async () => {
    render(
      <MemoryRouter>
        <ConsentAuditLog {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('All Activity')).toBeInTheDocument();
    });
  });

  it('displays App Access filter button', async () => {
    render(
      <MemoryRouter>
        <ConsentAuditLog {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('App Access')).toBeInTheDocument();
    });
  });

  it('accepts userId prop', () => {
    const { container } = render(
      <MemoryRouter>
        <ConsentAuditLog userId="custom-user-id" />
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });
});
