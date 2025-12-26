/**
 * AuthorizedAppsList Tests
 *
 * Tests for the SMART on FHIR connected apps list component.
 * Covers: Rendering, loading states, empty state, props handling.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Create mock before any imports
const mockSupabaseQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({
    data: [],
    error: null,
  }),
  update: vi.fn().mockReturnThis(),
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
import AuthorizedAppsList from '../AuthorizedAppsList';

describe('AuthorizedAppsList', () => {
  const defaultProps = {
    userId: 'test-user-id',
    onCountUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Note: Don't use vi.resetModules() here as it breaks dynamic import mocks
  });

  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <AuthorizedAppsList {...defaultProps} />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(
      <MemoryRouter>
        <AuthorizedAppsList {...defaultProps} />
      </MemoryRouter>
    );
    // Loading skeleton should be present
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('displays empty state title when no apps', async () => {
    render(
      <MemoryRouter>
        <AuthorizedAppsList {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No Connected Apps')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('displays empty state description', async () => {
    render(
      <MemoryRouter>
        <AuthorizedAppsList {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/You haven't authorized any third-party apps/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('displays explanation about connected apps', async () => {
    render(
      <MemoryRouter>
        <AuthorizedAppsList {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('What are connected apps?')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('accepts userId prop', () => {
    const { container } = render(
      <MemoryRouter>
        <AuthorizedAppsList userId="custom-user-id" />
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });

  it('accepts onCountUpdate callback prop', () => {
    const onCountUpdate = vi.fn();
    render(
      <MemoryRouter>
        <AuthorizedAppsList userId="test-id" onCountUpdate={onCountUpdate} />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });
});
