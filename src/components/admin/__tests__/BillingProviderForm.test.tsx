/**
 * Tests for BillingProviderForm
 *
 * Tests NPI-validated provider registration flow:
 * - NPI input with format validation
 * - Registry lookup and auto-populate
 * - Form submission and duplicate detection
 * - Error handling for invalid/deactivated NPIs
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BillingProviderForm from '../BillingProviderForm';

// Mock the NPI validation hook
const mockValidateAndLookup = vi.fn();
const mockReset = vi.fn();
const mockCheckFormat = vi.fn();

vi.mock('../../../hooks/useNPIValidation', () => ({
  useNPIValidation: () => ({
    status: mockNpiStatus,
    validation: mockValidation,
    provider: mockProvider,
    error: mockError,
    formatValid: mockFormatValid,
    validateAndLookup: mockValidateAndLookup,
    reset: mockReset,
    checkFormat: mockCheckFormat,
  }),
}));

// Mock billing data hooks
const mockCreateMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();
vi.mock('../../../hooks/useBillingData', () => ({
  useCreateBillingProvider: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateBillingProvider: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
  useBillingProviders: () => ({
    data: mockExistingProviders,
    isLoading: false,
  }),
}));

// Mock NPI format check
vi.mock('../../../services/mcp/mcpNPIRegistryClient', () => ({
  isValidNPIFormat: vi.fn().mockReturnValue(true),
}));

// Mock audit logger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    clinical: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

// State variables that mocks read from
let mockNpiStatus = 'idle';
let mockValidation: Record<string, unknown> | null = null;
let mockProvider: Record<string, unknown> | null = null;
let mockError: string | null = null;
let mockFormatValid = false;
let mockExistingProviders: Array<{ id: string; npi: string; organization_name: string }> = [];

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('BillingProviderForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNpiStatus = 'idle';
    mockValidation = null;
    mockProvider = null;
    mockError = null;
    mockFormatValid = false;
    mockExistingProviders = [];
  });

  it('renders NPI input field and verify button', () => {
    renderWithQueryClient(<BillingProviderForm />);

    expect(screen.getByLabelText(/NPI Number/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verify NPI/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Register Provider/i })).toBeInTheDocument();
  });

  it('disables verify button when NPI is empty', () => {
    renderWithQueryClient(<BillingProviderForm />);

    const verifyBtn = screen.getByRole('button', { name: /Verify NPI/i });
    expect(verifyBtn).toBeDisabled();
  });

  it('calls validateAndLookup when verify button is clicked with 10-digit NPI', async () => {
    renderWithQueryClient(<BillingProviderForm />);
    const user = userEvent.setup();

    const npiInput = screen.getByLabelText(/NPI Number/i);
    await user.type(npiInput, '1234567893');

    const verifyBtn = screen.getByRole('button', { name: /Verify NPI/i });
    await user.click(verifyBtn);

    expect(mockValidateAndLookup).toHaveBeenCalledWith('1234567893');
  });

  it('displays provider registry data when NPI is validated', () => {
    mockNpiStatus = 'valid';
    mockProvider = {
      name: 'Dr. Jane Doe',
      type: 'Individual',
      credential: 'MD',
      status: 'A',
      enumeration_date: '2015-03-20',
      last_updated: '2024-01-01',
      taxonomies: [{ code: '207R00000X', description: 'Internal Medicine', primary: true }],
      addresses: [{ type: 'LOCATION', address_1: '100 Med Ln', city: 'Dallas', state: 'TX', postal_code: '75001' }],
      identifiers: [],
    };
    mockValidation = { provider_name: 'Dr. Jane Doe', is_active: true };

    renderWithQueryClient(<BillingProviderForm />);

    expect(screen.getByText(/Registry Data/i)).toBeInTheDocument();
    // Provider name appears in both the registry card and status line
    expect(screen.getAllByText(/Dr. Jane Doe/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Internal Medicine/i)).toBeInTheDocument();
  });

  it('shows error message for inactive NPI', () => {
    mockNpiStatus = 'invalid';
    mockError = 'NPI deactivated: This provider is no longer active';

    renderWithQueryClient(<BillingProviderForm />);

    expect(screen.getByText(/deactivated/i)).toBeInTheDocument();
  });

  it('shows error message for API failure', () => {
    mockNpiStatus = 'error';
    mockError = 'Could not reach NPI Registry';

    renderWithQueryClient(<BillingProviderForm />);

    expect(screen.getByText(/Could not reach NPI Registry/i)).toBeInTheDocument();
  });

  it('submits form and calls createBillingProvider mutation', async () => {
    mockCreateMutateAsync.mockResolvedValue({ id: 'new-123', npi: '1234567893' });

    renderWithQueryClient(<BillingProviderForm />);
    const user = userEvent.setup();

    // Fill NPI
    const npiInput = screen.getByLabelText(/NPI Number/i);
    await user.type(npiInput, '1234567893');

    // Fill org name
    const nameInput = screen.getByLabelText(/Organization/i);
    await user.type(nameInput, 'Test Clinic');

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Register Provider/i });
    await user.click(submitBtn);

    expect(mockCreateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        npi: '1234567893',
        organization_name: 'Test Clinic',
      })
    );
  });

  it('prevents duplicate NPI registration', async () => {
    mockExistingProviders = [
      { id: 'existing-1', npi: '1234567893', organization_name: 'Existing Clinic' },
    ];

    renderWithQueryClient(<BillingProviderForm />);
    const user = userEvent.setup();

    const npiInput = screen.getByLabelText(/NPI Number/i);
    await user.type(npiInput, '1234567893');

    const submitBtn = screen.getByRole('button', { name: /Register Provider/i });
    await user.click(submitBtn);

    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/already registered/i)).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn();
    renderWithQueryClient(<BillingProviderForm onCancel={onCancel} />);
    const user = userEvent.setup();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelBtn);

    expect(onCancel).toHaveBeenCalled();
  });

  it('shows existing providers when toggle is clicked', async () => {
    mockExistingProviders = [
      { id: 'p1', npi: '1111111111', organization_name: 'Alpha Clinic' },
      { id: 'p2', npi: '2222222222', organization_name: 'Beta Hospital' },
    ];

    renderWithQueryClient(<BillingProviderForm />);
    const user = userEvent.setup();

    const toggleBtn = screen.getByText(/Show registered providers/i);
    await user.click(toggleBtn);

    expect(screen.getByText('Alpha Clinic')).toBeInTheDocument();
    expect(screen.getByText('Beta Hospital')).toBeInTheDocument();
    expect(screen.getByText('1111111111')).toBeInTheDocument();
  });

  it('shows Update Provider button when editing existing provider', () => {
    const provider = {
      id: 'edit-1',
      npi: '9876543210',
      organization_name: 'Edit Clinic',
      taxonomy_code: '207R00000X',
      ein: null,
      submitter_id: null,
      contact_phone: null,
      address_line1: null,
      city: null,
      state: null,
      zip: null,
      user_id: null,
      created_by: 'user-1',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    renderWithQueryClient(<BillingProviderForm editingProvider={provider} />);

    expect(screen.getByRole('button', { name: /Update Provider/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('9876543210')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Edit Clinic')).toBeInTheDocument();
  });
});
