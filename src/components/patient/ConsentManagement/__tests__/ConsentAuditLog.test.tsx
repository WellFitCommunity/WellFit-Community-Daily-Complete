/**
 * ConsentAuditLog Tests
 *
 * Tests for the consent access history/audit log component.
 * Covers: Rendering, loading states, filtering, empty state.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Create mock before any imports
const mockSupabaseQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({
    data: [],
    error: null,
  }),
};

const mockSupabase = {
  from: vi.fn(() => mockSupabaseQuery),
};

// Mock supabaseClient - must be before component import
vi.mock('../../../../lib/supabaseClient', () => ({
  __esModule: true,
  supabase: mockSupabase,
  default: { supabase: mockSupabase },
}));

// Mock auditLogger
vi.mock('../../../../services/auditLogger', () => ({
  __esModule: true,
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import component after mocks
import ConsentAuditLog from '../ConsentAuditLog';

describe('ConsentAuditLog', () => {
  const defaultProps = {
    userId: 'test-user-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Note: Don't use vi.resetModules() here as it can break dynamic import mocks
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
    }, { timeout: 3000 });
  });

  it('displays empty state title when no entries', async () => {
    render(
      <MemoryRouter>
        <ConsentAuditLog {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No Access History')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('displays empty state message', async () => {
    render(
      <MemoryRouter>
        <ConsentAuditLog {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No one has accessed your health data yet/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('displays All Activity filter button', async () => {
    render(
      <MemoryRouter>
        <ConsentAuditLog {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('All Activity')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('displays App Access filter button', async () => {
    render(
      <MemoryRouter>
        <ConsentAuditLog {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('App Access')).toBeInTheDocument();
    }, { timeout: 3000 });
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
