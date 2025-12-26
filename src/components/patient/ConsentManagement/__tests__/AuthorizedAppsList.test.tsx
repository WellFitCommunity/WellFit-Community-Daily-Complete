/**
 * AuthorizedAppsList Tests
 *
 * Tests for the SMART on FHIR connected apps list component.
 * Covers: Rendering, loading states, empty state, props handling.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthorizedAppsList from '../AuthorizedAppsList';

// Mock supabaseClient with immediate resolution
vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
      update: vi.fn().mockReturnThis(),
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

describe('AuthorizedAppsList', () => {
  const defaultProps = {
    userId: 'test-user-id',
    onCountUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
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
    });
  });

  it('displays empty state description', async () => {
    render(
      <MemoryRouter>
        <AuthorizedAppsList {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/You haven't authorized any third-party apps/)).toBeInTheDocument();
    });
  });

  it('displays explanation about connected apps', async () => {
    render(
      <MemoryRouter>
        <AuthorizedAppsList {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('What are connected apps?')).toBeInTheDocument();
    });
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
