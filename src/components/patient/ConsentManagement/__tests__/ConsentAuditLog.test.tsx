/**
 * ConsentAuditLog Tests
 *
 * Tests for the consent access history/audit log component.
 * Covers: Rendering, loading states, filtering, empty state, data display.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock audit entry data
const mockAuditEntry = {
  id: 'audit-1',
  event_type: 'resource_accessed',
  resource_type: 'Patient',
  details: { resource_id: 'patient-123' },
  ip_address: '192.168.1.1',
  created_at: '2025-01-20T14:30:00Z',
  app: {
    client_name: 'Test Health App',
  },
};

// Create chainable mock query builder
const createMockQueryBuilder = (resolveData: unknown[] | null = [], error: Error | null = null) => {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      return Promise.resolve({ data: resolveData, error });
    }),
  };
  return queryBuilder;
};

// Default mock that returns empty data
let mockQueryBuilder = createMockQueryBuilder([]);

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
import ConsentAuditLog from '../ConsentAuditLog';

describe('ConsentAuditLog', () => {
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
          <ConsentAuditLog {...defaultProps} />
        </MemoryRouter>
      );
      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Header and Filters', () => {
    it('displays Access History title after loading', async () => {
      render(
        <MemoryRouter>
          <ConsentAuditLog {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('Access History')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays All Activity filter button', async () => {
      render(
        <MemoryRouter>
          <ConsentAuditLog {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('All Activity')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays App Access filter button', async () => {
      render(
        <MemoryRouter>
          <ConsentAuditLog {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('App Access')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays Data Views filter button', async () => {
      render(
        <MemoryRouter>
          <ConsentAuditLog {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('Data Views')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays Consent Changes filter button', async () => {
      render(
        <MemoryRouter>
          <ConsentAuditLog {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('Consent Changes')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Empty State', () => {
    it('displays empty state title when no entries', async () => {
      render(
        <MemoryRouter>
          <ConsentAuditLog {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('No Access History')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays empty state message', async () => {
      render(
        <MemoryRouter>
          <ConsentAuditLog {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(
            screen.getByText(/No one has accessed your health data yet/)
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Props', () => {
    it('accepts userId prop', () => {
      const { container } = render(
        <MemoryRouter>
          <ConsentAuditLog userId="custom-user-id" />
        </MemoryRouter>
      );
      expect(container).toBeInTheDocument();
    });

    it('accepts onCountUpdate callback prop', () => {
      const onCountUpdate = vi.fn();
      render(
        <MemoryRouter>
          <ConsentAuditLog userId="test-id" onCountUpdate={onCountUpdate} />
        </MemoryRouter>
      );
      expect(document.body).toBeInTheDocument();
    });

    it('calls onCountUpdate with correct count when no entries', async () => {
      const onCountUpdate = vi.fn();
      render(
        <MemoryRouter>
          <ConsentAuditLog userId="test-id" onCountUpdate={onCountUpdate} />
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

  describe('With Audit Data', () => {
    beforeEach(() => {
      mockQueryBuilder = createMockQueryBuilder([mockAuditEntry]);
    });

    it('displays audit entry description', async () => {
      render(
        <MemoryRouter>
          <ConsentAuditLog {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText(/Test Health App accessed Patient/)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays resource type', async () => {
      render(
        <MemoryRouter>
          <ConsentAuditLog {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText(/Resource: Patient/)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('displays export button', async () => {
      render(
        <MemoryRouter>
          <ConsentAuditLog {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('Export access history')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('calls onCountUpdate with correct count', async () => {
      const onCountUpdate = vi.fn();
      render(
        <MemoryRouter>
          <ConsentAuditLog userId="test-id" onCountUpdate={onCountUpdate} />
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

  describe('Filter Interaction', () => {
    it('filter buttons are clickable', async () => {
      render(
        <MemoryRouter>
          <ConsentAuditLog {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('App Access')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const appAccessButton = screen.getByText('App Access');
      fireEvent.click(appAccessButton);

      // After clicking, verify filter buttons still render (component didn't crash)
      await waitFor(
        () => {
          expect(screen.getByText('All Activity')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Expandable Details', () => {
    beforeEach(() => {
      mockQueryBuilder = createMockQueryBuilder([mockAuditEntry]);
    });

    it('expands entry on click', async () => {
      render(
        <MemoryRouter>
          <ConsentAuditLog {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText(/Test Health App accessed Patient/)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Click the entry to expand
      const entry = screen.getByText(/Test Health App accessed Patient/).closest('.cursor-pointer');
      if (entry) {
        fireEvent.click(entry);
      }

      // Expanded content should show app name and IP address
      await waitFor(
        () => {
          expect(screen.getByText('App:')).toBeInTheDocument();
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
          <ConsentAuditLog {...defaultProps} />
        </MemoryRouter>
      );

      await waitFor(
        () => {
          expect(screen.getByText('No Access History')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });
});
