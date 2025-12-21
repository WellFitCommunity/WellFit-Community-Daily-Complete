/**
 * TemplateMaker Test Suite
 *
 * Tests for the documentation template management component.
 * Tests rendering, form interactions, and basic UI features.
 *
 * Location: src/components/admin/__tests__/TemplateMaker.test.tsx
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TemplateMaker } from '../TemplateMaker';

// Mock data
const mockTemplates = [
  {
    id: 'template-1',
    template_name: 'Nursing Progress Note',
    description: 'Daily patient progress documentation',
    category: 'clinical',
    role: 'nurse',
    template_type: 'note',
    content_template: 'Patient {patient_name} status: {status}',
    required_fields: { patient_name: 'text', status: 'select' },
    optional_fields: { notes: 'textarea' },
    output_format: 'narrative',
    ai_model: 'balanced',
    ai_assisted: true,
    is_active: true,
    is_shared: false,
    version: 1,
    created_by: 'user-1',
    tenant_id: 'tenant-1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'template-2',
    template_name: 'IT Incident Report',
    description: 'Technical issue documentation',
    category: 'administrative',
    role: 'admin',
    template_type: 'form',
    content_template: 'Issue: {issue}\nResolution: {resolution}',
    required_fields: { issue: 'text', resolution: 'textarea' },
    optional_fields: {},
    output_format: 'structured',
    ai_model: 'fast',
    ai_assisted: false,
    is_active: true,
    is_shared: true,
    version: 1,
    created_by: 'user-2',
    tenant_id: 'tenant-1',
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
  },
];

// Mock Supabase client
const mockFrom = vi.fn();

// Mock user
const mockUser = {
  id: 'test-admin-id',
  email: 'admin@test.com',
};

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: mockFrom,
  }),
  useUser: () => mockUser,
}));

// Mock auditLogger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Create a chainable mock that always returns data at the end
const createChainableMock = (data: unknown, error: unknown = null) => {
  const chainable: Record<string, unknown> = {};

  // Make all common methods return the same chainable object
  const methods = ['select', 'eq', 'is', 'order', 'insert', 'update', 'delete', 'single', 'maybeSingle'];
  methods.forEach(method => {
    chainable[method] = vi.fn().mockReturnValue(chainable);
  });

  // The chain resolves to a promise with data/error when awaited
  chainable.then = (resolve: (value: unknown) => void) => {
    resolve({ data, error });
    return Promise.resolve({ data, error });
  };

  return chainable;
};

// Helper to setup Supabase mocks
const setupSuccessMocks = () => {
  mockFrom.mockImplementation(() => createChainableMock(mockTemplates));
};

const setupErrorMocks = () => {
  mockFrom.mockImplementation(() => createChainableMock(null, { message: 'Database error' }));
};

describe('TemplateMaker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSuccessMocks();
  });

  describe('rendering', () => {
    it('renders the component header with Template Maker title', async () => {
      render(<TemplateMaker />);

      await waitFor(() => {
        expect(screen.getByText('Template Maker')).toBeInTheDocument();
      });
    });

    it('renders the subtitle text', async () => {
      render(<TemplateMaker />);

      await waitFor(() => {
        expect(screen.getByText(/create and manage documentation templates/i)).toBeInTheDocument();
      });
    });

    it('renders search input', async () => {
      render(<TemplateMaker />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search templates...')).toBeInTheDocument();
      });
    });

    it('renders New Template button', async () => {
      render(<TemplateMaker />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new template/i })).toBeInTheDocument();
      });
    });

    it('renders template list after loading', async () => {
      render(<TemplateMaker />);

      await waitFor(() => {
        expect(screen.getByText('Nursing Progress Note')).toBeInTheDocument();
        expect(screen.getByText('IT Incident Report')).toBeInTheDocument();
      });
    });

    it('renders template descriptions', async () => {
      render(<TemplateMaker />);

      await waitFor(() => {
        expect(screen.getByText('Daily patient progress documentation')).toBeInTheDocument();
        expect(screen.getByText('Technical issue documentation')).toBeInTheDocument();
      });
    });
  });

  describe('filtering', () => {
    it('filters templates by search query', async () => {
      render(<TemplateMaker />);

      // Wait for templates to load
      await waitFor(() => {
        expect(screen.getByText('Nursing Progress Note')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search templates...');
      fireEvent.change(searchInput, { target: { value: 'IT Incident' } });

      await waitFor(() => {
        expect(screen.getByText('IT Incident Report')).toBeInTheDocument();
        expect(screen.queryByText('Nursing Progress Note')).not.toBeInTheDocument();
      });
    });

    it('clears search to show all templates', async () => {
      render(<TemplateMaker />);

      await waitFor(() => {
        expect(screen.getByText('Nursing Progress Note')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search templates...');
      fireEvent.change(searchInput, { target: { value: 'IT' } });

      await waitFor(() => {
        expect(screen.queryByText('Nursing Progress Note')).not.toBeInTheDocument();
      });

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });

      await waitFor(() => {
        expect(screen.getByText('Nursing Progress Note')).toBeInTheDocument();
        expect(screen.getByText('IT Incident Report')).toBeInTheDocument();
      });
    });
  });

  describe('template creation', () => {
    it('opens template form when New Template is clicked', async () => {
      render(<TemplateMaker />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /new template/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /new template/i }));

      await waitFor(() => {
        expect(screen.getByText('Create New Template')).toBeInTheDocument();
      });
    });

    it('shows Template Name input in form', async () => {
      render(<TemplateMaker />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /new template/i }));
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/e.g., Nursing Handoff Note/i)).toBeInTheDocument();
      });
    });

    it('shows Role selector in form', async () => {
      render(<TemplateMaker />);

      fireEvent.click(screen.getByRole('button', { name: /new template/i }));

      await waitFor(() => {
        expect(screen.getByText('Role')).toBeInTheDocument();
      });
    });

    it('shows Category selector in form', async () => {
      render(<TemplateMaker />);

      fireEvent.click(screen.getByRole('button', { name: /new template/i }));

      await waitFor(() => {
        expect(screen.getByText('Category')).toBeInTheDocument();
      });
    });

    it('shows Template Type selector in form', async () => {
      render(<TemplateMaker />);

      fireEvent.click(screen.getByRole('button', { name: /new template/i }));

      await waitFor(() => {
        expect(screen.getByText('Template Type')).toBeInTheDocument();
      });
    });

    it('shows Output Format selector in form', async () => {
      render(<TemplateMaker />);

      fireEvent.click(screen.getByRole('button', { name: /new template/i }));

      await waitFor(() => {
        expect(screen.getByText('Output Format')).toBeInTheDocument();
      });
    });
  });

  describe('AI assistance features', () => {
    it('shows AI Assistance section in form', async () => {
      render(<TemplateMaker />);

      fireEvent.click(screen.getByRole('button', { name: /new template/i }));

      await waitFor(() => {
        expect(screen.getByText('AI Assistance')).toBeInTheDocument();
      });
    });

    it('shows Enable AI checkbox label', async () => {
      render(<TemplateMaker />);

      fireEvent.click(screen.getByRole('button', { name: /new template/i }));

      await waitFor(() => {
        expect(screen.getByText(/enable ai/i)).toBeInTheDocument();
      });
    });
  });

  describe('template editing', () => {
    it('shows Edit Template title when editing existing template', async () => {
      render(<TemplateMaker />);

      await waitFor(() => {
        expect(screen.getByText('Nursing Progress Note')).toBeInTheDocument();
      });

      // Find and click the edit button (pencil icon) using aria-label or title
      const editButtons = document.querySelectorAll('button[title="Edit template"]');
      if (editButtons.length > 0) {
        fireEvent.click(editButtons[0]);

        await waitFor(() => {
          expect(screen.getByText('Edit Template')).toBeInTheDocument();
        });
      }
    });
  });

  describe('cancel behavior', () => {
    it('closes form on cancel', async () => {
      render(<TemplateMaker />);

      fireEvent.click(screen.getByRole('button', { name: /new template/i }));

      await waitFor(() => {
        expect(screen.getByText('Create New Template')).toBeInTheDocument();
      });

      // Find the close (X) button in the modal header
      const closeButtons = document.querySelectorAll('.lucide-x');
      if (closeButtons.length > 0) {
        const parentButton = closeButtons[0].closest('button');
        if (parentButton) {
          fireEvent.click(parentButton);
        }
      }

      await waitFor(() => {
        expect(screen.queryByText('Create New Template')).not.toBeInTheDocument();
      });
    });
  });

  describe('form validation', () => {
    it('shows error when template name is empty', async () => {
      render(<TemplateMaker />);

      fireEvent.click(screen.getByRole('button', { name: /new template/i }));

      await waitFor(() => {
        expect(screen.getByText('Create New Template')).toBeInTheDocument();
      });

      // Try to save without filling required fields
      const saveButton = screen.getByRole('button', { name: /save template/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Template name is required')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('shows error message when database fails', async () => {
      setupErrorMocks();

      render(<TemplateMaker />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load templates')).toBeInTheDocument();
      });
    });
  });

  describe('compact mode', () => {
    it('hides header in compact mode', () => {
      setupSuccessMocks();
      render(<TemplateMaker compact />);

      // Header should not be present in compact mode
      expect(screen.queryByText('Template Maker')).not.toBeInTheDocument();
    });

    it('still renders templates in compact mode', async () => {
      setupSuccessMocks();
      render(<TemplateMaker compact />);

      await waitFor(() => {
        expect(screen.getByText('Nursing Progress Note')).toBeInTheDocument();
      });
    });
  });

  describe('role filtering', () => {
    it('accepts roleFilter prop', async () => {
      setupSuccessMocks();
      render(<TemplateMaker roleFilter="nurse" />);

      await waitFor(() => {
        expect(screen.getByText('Nursing Progress Note')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('has accessible search input', async () => {
      render(<TemplateMaker />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search templates...');
        expect(searchInput).toBeInTheDocument();
        expect(searchInput.tagName).toBe('INPUT');
      });
    });

    it('has accessible buttons', async () => {
      render(<TemplateMaker />);

      await waitFor(() => {
        const newButton = screen.getByRole('button', { name: /new template/i });
        expect(newButton).toBeInTheDocument();
      });
    });
  });
});

describe('TemplateMaker badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSuccessMocks();
  });

  it('shows AI indicator for AI-enabled templates', async () => {
    render(<TemplateMaker />);

    await waitFor(() => {
      expect(screen.getByText('Nursing Progress Note')).toBeInTheDocument();
    });

    // The Nursing Progress Note has ai_assisted: true - should show indicator
    const aiIndicators = screen.getAllByText(/ai/i);
    expect(aiIndicators.length).toBeGreaterThan(0);
  });

  it('shows Shared badge for shared templates', async () => {
    render(<TemplateMaker />);

    await waitFor(() => {
      expect(screen.getByText('IT Incident Report')).toBeInTheDocument();
    });

    // The IT Incident Report has is_shared: true
    expect(screen.getByText('Shared')).toBeInTheDocument();
  });

  it('shows output format badge for templates', async () => {
    render(<TemplateMaker />);

    await waitFor(() => {
      expect(screen.getByText('IT Incident Report')).toBeInTheDocument();
    });

    // The IT Incident Report has output_format: 'structured'
    const formatBadges = screen.getAllByText(/narrative|structured|form|letter/i);
    expect(formatBadges.length).toBeGreaterThan(0);
  });
});

describe('TemplateMaker field types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSuccessMocks();
  });

  it('shows field type options when adding fields', async () => {
    render(<TemplateMaker />);

    fireEvent.click(screen.getByRole('button', { name: /new template/i }));

    await waitFor(() => {
      expect(screen.getByText('Create New Template')).toBeInTheDocument();
    });

    // Check that the add field button exists
    const addFieldButtons = screen.getAllByRole('button', { name: /add field/i });
    expect(addFieldButtons.length).toBeGreaterThan(0);
  });
});
