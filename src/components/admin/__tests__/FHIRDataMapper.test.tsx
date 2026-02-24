/**
 * FHIRDataMapper Tests
 *
 * Behavioral tests for the FHIR Data Mapping Agent component.
 * Tests form interactions, mapping display, error/warning handling,
 * loading states, view mode toggling, and deploy-to-WellFit options.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { FHIRMappingState, FHIRMappingActions } from '../../../hooks/useFHIRMapping';
import type { DataMapping } from '../../../services/fhirMappingService';

// --- Hoisted mocks ---

const mockActions: FHIRMappingActions = vi.hoisted(() => ({
  setSourceData: vi.fn(),
  setSourceType: vi.fn(),
  validateFile: vi.fn().mockReturnValue({ isValid: true, errors: [], size: 0, type: '.json' }),
  loadFromFile: vi.fn().mockResolvedValue(undefined),
  generateMapping: vi.fn().mockResolvedValue(undefined),
  downloadMapping: vi.fn(),
  clearErrors: vi.fn(),
  clearWarnings: vi.fn(),
  reset: vi.fn(),
}));

const mockUseFHIRMapping = vi.hoisted(() => vi.fn());

// --- Module mocks ---

vi.mock('../../../hooks/useFHIRMapping', () => ({
  useFHIRMapping: mockUseFHIRMapping,
}));

vi.mock('../../../services/fhirCodeGeneration', () => ({
  wellFitCodeGenerator: {
    generateFullCode: vi.fn().mockReturnValue('// Generated integration code\nexport class Transformer {}'),
  },
}));

vi.mock('../../ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// --- Helpers ---

function makeDefaultState(overrides: Partial<FHIRMappingState> = {}): FHIRMappingState {
  return {
    sourceData: '',
    sourceType: 'JSON',
    generatedMapping: null,
    isAnalyzing: false,
    errors: [],
    warnings: [],
    fileValidation: null,
    ...overrides,
  };
}

function makeMappingResult(overrides: Partial<DataMapping> = {}): DataMapping {
  return {
    id: 'mapping-test-001',
    sourceName: 'Test Patient Alpha Data Source',
    sourceType: 'JSON',
    fhirVersion: 'R4',
    mappingRules: [
      {
        sourceField: 'patient_name',
        sourceType: 'string',
        fhirResource: 'Patient',
        fhirPath: 'Patient.name.given',
        transformation: 'Split on space',
        confidence: 92,
      },
      {
        sourceField: 'birth_date',
        sourceType: 'date',
        fhirResource: 'Patient',
        fhirPath: 'Patient.birthDate',
        transformation: 'ISO 8601 format',
        confidence: 98,
      },
      {
        sourceField: 'heart_rate',
        sourceType: 'number',
        fhirResource: 'Observation',
        fhirPath: 'Observation.valueQuantity.value',
        confidence: 85,
      },
    ],
    validationResults: {
      totalFields: 10,
      mappedFields: 8,
      unmappedFields: ['custom_field_1', 'custom_field_2'],
      errors: [],
      confidence: 88,
    },
    ...overrides,
  };
}

function setupHook(stateOverrides: Partial<FHIRMappingState> = {}): void {
  const state = makeDefaultState(stateOverrides);
  mockUseFHIRMapping.mockReturnValue([state, mockActions]);
}

async function renderMapper() {
  // Dynamic import so vi.mock takes effect before module evaluation
  const { default: FHIRDataMapper } = await import('../FHIRDataMapper');
  return render(<FHIRDataMapper />);
}

// --- Tests ---

describe('FHIRDataMapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with source type dropdown defaulting to JSON', async () => {
    setupHook();
    await renderMapper();

    expect(screen.getByText('Intelligent FHIR Data Mapping Agent', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Upload or paste legacy healthcare data', { exact: false })).toBeInTheDocument();

    const sourceTypeSelect = screen.getByRole('combobox');
    expect(sourceTypeSelect).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    const optionValues = options.map(opt => (opt as HTMLOptionElement).value);
    expect(optionValues).toEqual(['JSON', 'CSV', 'HL7v2', 'XML', 'Custom']);

    // Default is JSON (first option selected via defaultValues)
    expect((screen.getByRole('option', { name: 'JSON' }) as HTMLOptionElement).selected).toBe(true);
  });

  it('displays sample data format buttons for HL7v2, CSV, JSON, and XML', async () => {
    setupHook();
    await renderMapper();

    expect(screen.getByText('Sample Data Formats:')).toBeInTheDocument();

    // Each sample format appears as a clickable button with its type name
    expect(screen.getByRole('button', { name: /^HL7v2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^CSV/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^JSON/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^XML/ })).toBeInTheDocument();
  });

  it('disables the Generate FHIR Mapping button when source data is empty', async () => {
    setupHook({ sourceData: '' });
    await renderMapper();

    const generateButton = screen.getByRole('button', { name: /Generate FHIR Mapping/i });
    expect(generateButton).toBeDisabled();
  });

  it('shows error messages with Clear Errors button when state has errors', async () => {
    setupHook({
      errors: [
        'Source data format is invalid',
        'Failed to parse HL7 message segments',
      ],
    });
    await renderMapper();

    expect(screen.getByText('Source data format is invalid')).toBeInTheDocument();
    expect(screen.getByText('Failed to parse HL7 message segments')).toBeInTheDocument();

    const clearButton = screen.getByRole('button', { name: /Clear Errors/i });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(mockActions.clearErrors).toHaveBeenCalledTimes(1);
  });

  it('shows warning messages with Clear Warnings button when state has warnings', async () => {
    setupHook({
      warnings: [
        '2 mapping rules have low confidence scores. Please review these carefully.',
      ],
    });
    await renderMapper();

    expect(
      screen.getByText('2 mapping rules have low confidence scores. Please review these carefully.')
    ).toBeInTheDocument();

    const clearButton = screen.getByRole('button', { name: /Clear Warnings/i });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(mockActions.clearWarnings).toHaveBeenCalledTimes(1);
  });

  it('displays skeleton loading components while analyzing', async () => {
    setupHook({ isAnalyzing: true });
    await renderMapper();

    expect(screen.getByText('Analyzing Data...', { exact: false })).toBeInTheDocument();

    // The Generate button should show analyzing state and be disabled
    const generateButton = screen.getByRole('button', { name: /Analyzing/i });
    expect(generateButton).toBeDisabled();
  });

  it('shows mapping rules table with source fields and FHIR paths after mapping is generated', async () => {
    const mapping = makeMappingResult();
    setupHook({ generatedMapping: mapping });
    await renderMapper();

    expect(screen.getByText('Generated FHIR Mapping')).toBeInTheDocument();
    expect(screen.getByText('Test Patient Alpha Data Source')).toBeInTheDocument();

    // Table column headers - "Confidence" appears in both the table header and
    // validation results summary, so use getAllByText for the shared label
    expect(screen.getByText('Source Field')).toBeInTheDocument();
    expect(screen.getByText('FHIR Resource')).toBeInTheDocument();
    expect(screen.getByText('FHIR Path')).toBeInTheDocument();
    expect(screen.getByText('Transformation')).toBeInTheDocument();
    // Verify "Confidence" appears at least in the table header (also in validation section)
    const confidenceElements = screen.getAllByText('Confidence');
    expect(confidenceElements.length).toBeGreaterThanOrEqual(1);

    // Mapping rule data
    expect(screen.getByText('patient_name')).toBeInTheDocument();
    expect(screen.getByText('Patient.name.given')).toBeInTheDocument();
    expect(screen.getByText('Split on space')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();

    expect(screen.getByText('birth_date')).toBeInTheDocument();
    expect(screen.getByText('Patient.birthDate')).toBeInTheDocument();

    expect(screen.getByText('heart_rate')).toBeInTheDocument();
    expect(screen.getByText('Observation.valueQuantity.value')).toBeInTheDocument();

    // Rule count header
    expect(screen.getByText(/Mapping Rules \(3\)/)).toBeInTheDocument();
  });

  it('displays validation results with Total, Mapped, Unmapped Fields and Confidence', async () => {
    const mapping = makeMappingResult();
    setupHook({ generatedMapping: mapping });
    await renderMapper();

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Total Fields')).toBeInTheDocument();

    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Mapped Fields')).toBeInTheDocument();

    // Unmapped count is unmappedFields.length = 2
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Unmapped Fields')).toBeInTheDocument();

    expect(screen.getByText('88%')).toBeInTheDocument();
    // "Confidence" label appears in both validation stats and table header
    const confidenceLabels = screen.getAllByText('Confidence');
    expect(confidenceLabels.length).toBe(2);
  });

  it('shows Deploy to WellFit section with Real-time Sync, Batch Import, and Custom Pipeline', async () => {
    const mapping = makeMappingResult();
    setupHook({ generatedMapping: mapping });
    await renderMapper();

    expect(screen.getByText('Deploy to WellFit', { exact: false })).toBeInTheDocument();

    expect(screen.getByText('Real-time Sync', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Set up automatic transformation as EHR data arrives')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Configure Pipeline/i })).toBeInTheDocument();

    expect(screen.getByText('Batch Import', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Import historical data using this mapping')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Import/i })).toBeInTheDocument();

    expect(screen.getByText('Custom Pipeline', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Build custom transformation workflows')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Build Pipeline/i })).toBeInTheDocument();
  });

  it('toggles between Mapping Rules, FHIR Preview, and Integration Code view modes', async () => {
    const mapping = makeMappingResult();
    setupHook({ generatedMapping: mapping });
    await renderMapper();

    // Default view is "rules" - mapping table should be visible
    expect(screen.getByText('Source Field')).toBeInTheDocument();
    expect(screen.getByText('patient_name')).toBeInTheDocument();

    // Switch to FHIR Preview
    fireEvent.click(screen.getByRole('button', { name: /FHIR Preview/i }));

    await waitFor(() => {
      expect(screen.getByText('FHIR Resources Preview')).toBeInTheDocument();
    });
    // Mapping rules table should no longer be visible
    expect(screen.queryByText('Source Field')).not.toBeInTheDocument();

    // The preview shows resource types that have rules (Patient, Observation)
    expect(screen.getByText('Patient')).toBeInTheDocument();
    expect(screen.getByText('Observation')).toBeInTheDocument();

    // Switch to Integration Code
    fireEvent.click(screen.getByRole('button', { name: /WellFit Integration Code/i }));

    await waitFor(() => {
      expect(screen.getByText('Generated WellFit Integration Code')).toBeInTheDocument();
    });
    expect(screen.queryByText('FHIR Resources Preview')).not.toBeInTheDocument();

    // Code preview content from mock
    expect(screen.getByText(/Generated integration code/)).toBeInTheDocument();

    // Copy Code button should be present
    expect(screen.getByRole('button', { name: /Copy Code/i })).toBeInTheDocument();
  });

  it('shows Download Mapping button only when a mapping has been generated', async () => {
    // No mapping yet
    setupHook({ generatedMapping: null });
    const { unmount } = await renderMapper();

    expect(screen.queryByRole('button', { name: /Download Mapping/i })).not.toBeInTheDocument();

    unmount();

    // With mapping
    const mapping = makeMappingResult();
    setupHook({ generatedMapping: mapping });
    await renderMapper();

    const downloadButton = screen.getByRole('button', { name: /Download Mapping/i });
    expect(downloadButton).toBeInTheDocument();

    fireEvent.click(downloadButton);
    expect(mockActions.downloadMapping).toHaveBeenCalledTimes(1);
  });

  it('displays unmapped fields alert in Mapping Rules view when unmapped fields exist', async () => {
    const mapping = makeMappingResult({
      validationResults: {
        totalFields: 10,
        mappedFields: 8,
        unmappedFields: ['custom_field_1', 'custom_field_2'],
        errors: [],
        confidence: 88,
      },
    });
    setupHook({ generatedMapping: mapping });
    await renderMapper();

    expect(screen.getByText(/Unmapped Fields:/)).toBeInTheDocument();
    expect(screen.getByText(/custom_field_1, custom_field_2/)).toBeInTheDocument();
  });
});
