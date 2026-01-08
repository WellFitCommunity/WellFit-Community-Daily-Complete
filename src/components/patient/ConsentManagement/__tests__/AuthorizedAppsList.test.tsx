/**
 * AuthorizedAppsList Tests
 *
 * Tests for the SMART on FHIR connected apps list component.
 * Covers: Rendering, loading states, empty state, app display, revoke functionality.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock data
const mockApp = {
  id: 'auth-1',
  scopes_granted: ['patient/Patient.read', 'patient/Observation.read'],
  authorized_at: '2025-01-15T10:00:00Z',
  last_access_at: '2025-01-20T14:30:00Z',
  access_count: 5,
  status: 'active',
  app: {
    id: 'app-1',
    client_name: 'Test Health App',
    client_description: 'A test health application',
    logo_uri: null,
    client_uri: 'https://testhealthapp.com',
  },
};

// Create chainable mock query builder
const createMockQueryBuilder = (resolveData: unknown[] | null = [], error: Error | null = null) => {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockImplementation(() => {
      return Promise.resolve({ data: resolveData, error });
    }),
    update: vi.fn().mockReturnThis(),
  };
  return queryBuilder;
};

// Default mock that returns empty data
let mockQueryBuilder = createMockQueryBuilder([]);

const _mockSupabase = {
  from: vi.fn(() => mockQueryBuilder),
};

// Mock supabaseClient - must be before component import
vi.mock('../../../../lib/supabaseClient', () => ({
  __esModule: true,
  supabase: {
    from: vi.fn(() => mockQueryBuilder),
  },
  default: {
    supabase: {
      from: vi.fn(() => mockQueryBuilder),
    },
  },
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
    // Reset to empty data by default
    mockQueryBuilder = createMockQueryBuilder([]);
  });

  describe('Rendering', () => {
    it('shows loading state initially', () => {
      render(
        <MemoryRouter>
          <AuthorizedAppsList {...defaultProps} />
        </MemoryRouter>
      );
      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('displays empty state title when no apps', async () => {
      render(
        <MemoryRouter>
          <AuthorizedAppsList {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('No Connected Apps')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays empty state description', async () => {
      render(
        <MemoryRouter>
          <AuthorizedAppsList {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(
            screen.getByText(/You haven't authorized any third-party apps/)
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays explanation about connected apps', async () => {
      render(
        <MemoryRouter>
          <AuthorizedAppsList {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('What are connected apps?')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays info box about SMART on FHIR', async () => {
      render(
        <MemoryRouter>
          <AuthorizedAppsList {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText(/Apps like Apple Health/)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Props', () => {
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

    it('calls onCountUpdate with correct count when no apps', async () => {
      const onCountUpdate = vi.fn();
      render(
        <MemoryRouter>
          <AuthorizedAppsList userId="test-id" onCountUpdate={onCountUpdate} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(onCountUpdate).toHaveBeenCalledWith(0);
        },
        { timeout: 3000 }
      );
    });
  });

  describe('With Apps Data', () => {
    beforeEach(() => {
      mockQueryBuilder = createMockQueryBuilder([mockApp]);
    });

    it('displays connected apps header when apps exist', async () => {
      render(
        <MemoryRouter>
          <AuthorizedAppsList {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('Connected Apps')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays app count', async () => {
      render(
        <MemoryRouter>
          <AuthorizedAppsList {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('1 app connected')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays app name', async () => {
      render(
        <MemoryRouter>
          <AuthorizedAppsList {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('Test Health App')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays app description', async () => {
      render(
        <MemoryRouter>
          <AuthorizedAppsList {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('A test health application')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays permissions label', async () => {
      render(
        <MemoryRouter>
          <AuthorizedAppsList {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('Permissions:')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays formatted scope names', async () => {
      render(
        <MemoryRouter>
          <AuthorizedAppsList {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('Basic Info')).toBeInTheDocument();
          expect(screen.getByText('Vitals & Labs')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays revoke button', async () => {
      render(
        <MemoryRouter>
          <AuthorizedAppsList {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('Revoke')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays warning message about app access', async () => {
      render(
        <MemoryRouter>
          <AuthorizedAppsList {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(
            screen.getByText(/These apps can access your health data/)
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('calls onCountUpdate with correct count', async () => {
      const onCountUpdate = vi.fn();
      render(
        <MemoryRouter>
          <AuthorizedAppsList userId="test-id" onCountUpdate={onCountUpdate} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(onCountUpdate).toHaveBeenCalledWith(1);
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Error Handling', () => {
    it('shows empty state on database error', async () => {
      mockQueryBuilder = createMockQueryBuilder(null, new Error('DB Error'));

      render(
        <MemoryRouter>
          <AuthorizedAppsList {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('No Connected Apps')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });
});
