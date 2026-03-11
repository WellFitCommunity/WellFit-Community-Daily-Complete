/**
 * FHIRResourcesTab + FHIRResourceForm Tests
 *
 * Behavioral tests for FHIR CRUD UI:
 * - Resource search with filters
 * - Create resource form with validation
 * - Edit resource form
 * - Detail view
 * - Error handling
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- Hoisted mocks ---
const mockSearchResources = vi.hoisted(() => vi.fn());
const mockCreateResource = vi.hoisted(() => vi.fn());
const mockUpdateResource = vi.hoisted(() => vi.fn());
const mockValidateResource = vi.hoisted(() => vi.fn());
const mockGetInstance = vi.hoisted(() => vi.fn());

vi.mock('../../../services/mcp/mcpFHIRClient', () => ({
  FHIRMCPClient: {
    getInstance: mockGetInstance,
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

// --- Imports (after mocks) ---
import { ResourcesTab } from '../fhir-interoperability/ResourcesTab';
import { FHIRResourceForm } from '../fhir-interoperability/FHIRResourceForm';

// --- Setup ---
beforeEach(() => {
  vi.clearAllMocks();
  mockGetInstance.mockReturnValue({
    searchResources: mockSearchResources,
    createResource: mockCreateResource,
    updateResource: mockUpdateResource,
    validateResource: mockValidateResource,
  });
});

// =====================================================
// ResourcesTab Tests
// =====================================================

describe('ResourcesTab', () => {
  it('renders search interface with resource type selector and search button', () => {
    render(<ResourcesTab />);

    expect(screen.getByText('FHIR Resources')).toBeInTheDocument();
    expect(screen.getByLabelText('Resource Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Patient ID')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create resource/i })).toBeInTheDocument();
  });

  it('shows empty state when no search has been performed', () => {
    render(<ResourcesTab />);

    expect(screen.getByText('Search for FHIR resources or create a new one')).toBeInTheDocument();
  });

  it('searches resources and displays results', async () => {
    mockSearchResources.mockResolvedValue({
      success: true,
      data: {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 2,
        entry: [
          {
            fullUrl: 'Condition/cond-001',
            resource: {
              id: 'cond-001',
              resourceType: 'Condition',
              clinical_status: 'active',
              code_display: 'Type 2 diabetes',
            },
          },
          {
            fullUrl: 'Condition/cond-002',
            resource: {
              id: 'cond-002',
              resourceType: 'Condition',
              clinical_status: 'resolved',
              code_display: 'Hypertension',
            },
          },
        ],
      },
    });

    render(<ResourcesTab />);
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('2 resources found')).toBeInTheDocument();
    });

    expect(screen.getByText('Type 2 diabetes')).toBeInTheDocument();
    expect(screen.getByText('Hypertension')).toBeInTheDocument();
  });

  it('shows error when search fails', async () => {
    mockSearchResources.mockResolvedValue({
      success: false,
      error: 'FHIR server unavailable',
    });

    render(<ResourcesTab />);
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('FHIR server unavailable')).toBeInTheDocument();
    });
  });

  it('switches to create mode when Create Resource is clicked', () => {
    render(<ResourcesTab />);
    fireEvent.click(screen.getByRole('button', { name: /create resource/i }));

    expect(screen.getByText('Create FHIR Resource')).toBeInTheDocument();
  });

  it('switches to detail view when view button is clicked', async () => {
    mockSearchResources.mockResolvedValue({
      success: true,
      data: {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 1,
        entry: [
          {
            fullUrl: 'Condition/cond-001',
            resource: {
              id: 'cond-001',
              resourceType: 'Condition',
              clinical_status: 'active',
              code_display: 'Test Condition Alpha',
            },
          },
        ],
      },
    });

    render(<ResourcesTab />);
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    const viewBtn = await screen.findByLabelText('View Condition cond-001');
    fireEvent.click(viewBtn);

    expect(screen.getByText(/Condition — cond-001/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('creates resource and shows success message', async () => {
    mockCreateResource.mockResolvedValue({ success: true });

    render(<ResourcesTab />);
    fireEvent.click(screen.getByRole('button', { name: /create resource/i }));

    // Fill required fields for Condition
    fireEvent.change(screen.getByLabelText(/Patient ID/), { target: { value: 'patient-test-123' } });
    fireEvent.change(screen.getByLabelText(/ICD-10 Code/), { target: { value: 'E11.9' } });
    fireEvent.change(screen.getByLabelText(/Display Name/), { target: { value: 'Test Diabetes Alpha' } });
    fireEvent.change(screen.getByLabelText(/Code System/), { target: { value: 'http://hl7.org/fhir/sid/icd-10-cm' } });
    fireEvent.change(screen.getByLabelText(/Clinical Status/), { target: { value: 'active' } });
    fireEvent.change(screen.getByLabelText(/Verification Status/), { target: { value: 'confirmed' } });

    fireEvent.click(screen.getByRole('button', { name: /create resource/i }));

    await waitFor(() => {
      expect(screen.getByText(/created successfully/)).toBeInTheDocument();
    });

    expect(mockCreateResource).toHaveBeenCalledWith(
      'Condition',
      expect.objectContaining({
        code: 'E11.9',
        code_display: 'Test Diabetes Alpha',
        clinical_status: 'active',
      }),
      'patient-test-123'
    );
  });

  it('passes correct filters to searchResources', async () => {
    mockSearchResources.mockResolvedValue({
      success: true,
      data: { resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] },
    });

    render(<ResourcesTab />);

    // Change resource type
    fireEvent.change(screen.getByLabelText('Resource Type'), { target: { value: 'MedicationRequest' } });
    fireEvent.change(screen.getByLabelText('Patient ID'), { target: { value: 'patient-abc' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'active' } });

    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(mockSearchResources).toHaveBeenCalledWith(
        'MedicationRequest',
        expect.objectContaining({
          patientId: 'patient-abc',
          status: 'active',
          limit: 50,
        })
      );
    });
  });
});

// =====================================================
// FHIRResourceForm Tests
// =====================================================

describe('FHIRResourceForm', () => {
  const defaultProps = {
    mode: 'create' as const,
    onSave: vi.fn().mockResolvedValue(undefined),
    onValidate: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    onCancel: vi.fn(),
  };

  it('renders resource type selector in create mode', () => {
    render(<FHIRResourceForm {...defaultProps} />);

    expect(screen.getByText('Create FHIR Resource')).toBeInTheDocument();
    expect(screen.getByLabelText('Resource Type')).toBeInTheDocument();
  });

  it('shows correct fields for Condition resource type', () => {
    render(<FHIRResourceForm {...defaultProps} />);

    expect(screen.getByLabelText(/ICD-10 Code/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Display Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Clinical Status/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Verification Status/)).toBeInTheDocument();
  });

  it('changes fields when resource type is changed', () => {
    render(<FHIRResourceForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Resource Type'), { target: { value: 'MedicationRequest' } });

    expect(screen.getByLabelText(/Medication Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Dosage Instructions/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/ICD-10 Code/)).not.toBeInTheDocument();
  });

  it('shows Observation fields including value and unit', () => {
    render(<FHIRResourceForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Resource Type'), { target: { value: 'Observation' } });

    expect(screen.getByLabelText(/LOINC Code/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Value/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Unit/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/)).toBeInTheDocument();
  });

  it('shows required field errors when saving without filling required fields', async () => {
    render(<FHIRResourceForm {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /create resource/i }));

    await waitFor(() => {
      expect(screen.getByText('Required fields missing')).toBeInTheDocument();
    });

    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('validates resource before save when Validate is clicked', async () => {
    defaultProps.onValidate.mockResolvedValue({ valid: true, errors: [] });

    render(<FHIRResourceForm {...defaultProps} />);

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/Patient ID/), { target: { value: 'patient-test-abc' } });
    fireEvent.change(screen.getByLabelText(/ICD-10 Code/), { target: { value: 'J06.9' } });
    fireEvent.change(screen.getByLabelText(/Display Name/), { target: { value: 'Test URI Alpha' } });
    fireEvent.change(screen.getByLabelText(/Code System/), { target: { value: 'http://hl7.org/fhir/sid/icd-10-cm' } });
    fireEvent.change(screen.getByLabelText(/Clinical Status/), { target: { value: 'active' } });
    fireEvent.change(screen.getByLabelText(/Verification Status/), { target: { value: 'confirmed' } });

    fireEvent.click(screen.getByRole('button', { name: /validate/i }));

    await waitFor(() => {
      expect(screen.getByText('Resource is valid')).toBeInTheDocument();
    });
  });

  it('shows validation errors when resource is invalid', async () => {
    defaultProps.onValidate.mockResolvedValue({
      valid: false,
      errors: ['Missing required field: code', 'Invalid code_system URI'],
    });

    render(<FHIRResourceForm {...defaultProps} />);

    // Fill required fields to pass client-side check
    fireEvent.change(screen.getByLabelText(/Patient ID/), { target: { value: 'patient-test-abc' } });
    fireEvent.change(screen.getByLabelText(/ICD-10 Code/), { target: { value: 'BAD' } });
    fireEvent.change(screen.getByLabelText(/Display Name/), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/Code System/), { target: { value: 'bad-uri' } });
    fireEvent.change(screen.getByLabelText(/Clinical Status/), { target: { value: 'active' } });
    fireEvent.change(screen.getByLabelText(/Verification Status/), { target: { value: 'confirmed' } });

    fireEvent.click(screen.getByRole('button', { name: /validate/i }));

    await waitFor(() => {
      expect(screen.getByText('Validation issues found')).toBeInTheDocument();
    });
    expect(screen.getByText('Missing required field: code')).toBeInTheDocument();
    expect(screen.getByText('Invalid code_system URI')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    render(<FHIRResourceForm {...defaultProps} />);

    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButtons[cancelButtons.length - 1]);

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('renders edit mode with initial data', () => {
    render(
      <FHIRResourceForm
        mode="edit"
        initialResourceType="Condition"
        initialData={{
          patient_id: 'patient-test-123',
          code: 'E11.9',
          code_display: 'Test Diabetes Alpha',
          clinical_status: 'active',
        }}
        resourceId="cond-001"
        onSave={defaultProps.onSave}
        onValidate={defaultProps.onValidate}
        onCancel={defaultProps.onCancel}
      />
    );

    expect(screen.getByText(/Edit Condition cond-001/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('E11.9')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Diabetes Alpha')).toBeInTheDocument();
    // Resource type selector should not show in edit mode
    expect(screen.queryByLabelText('Resource Type')).not.toBeInTheDocument();
  });

  it('shows AllergyIntolerance fields when type is changed', () => {
    render(<FHIRResourceForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Resource Type'), { target: { value: 'AllergyIntolerance' } });

    expect(screen.getByLabelText(/Substance Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Criticality/)).toBeInTheDocument();
  });

  it('clears form data when resource type is changed', () => {
    render(<FHIRResourceForm {...defaultProps} />);

    // Fill a Condition field
    fireEvent.change(screen.getByLabelText(/ICD-10 Code/), { target: { value: 'E11.9' } });

    // Switch to MedicationRequest
    fireEvent.change(screen.getByLabelText('Resource Type'), { target: { value: 'MedicationRequest' } });

    // Old data should be gone
    expect(screen.queryByDisplayValue('E11.9')).not.toBeInTheDocument();
  });
});
