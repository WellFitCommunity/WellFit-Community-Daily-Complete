/**
 * ChainDefinitionEditor — Behavioral Tests
 *
 * Tier 1-3: behavior, state, and integration.
 * Tests create/edit chain definitions with step management.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type {
  ChainDefinition,
  ChainStepDefinition,
} from '../../../services/mcp/chainOrchestration.types';

// Mock chain orchestration service
const mockListChainSteps = vi.fn();
const mockCreateChainDefinition = vi.fn();
const mockUpdateChainDefinition = vi.fn();
const mockDeleteStepDefinition = vi.fn();
const mockCreateStepDefinition = vi.fn();
const mockUpdateStepDefinition = vi.fn();

vi.mock('../../../services/mcp/chainOrchestrationService', () => ({
  chainOrchestrationService: {
    listChainSteps: (...args: unknown[]) => mockListChainSteps(...args),
    createChainDefinition: (...args: unknown[]) => mockCreateChainDefinition(...args),
    updateChainDefinition: (...args: unknown[]) => mockUpdateChainDefinition(...args),
    deleteStepDefinition: (...args: unknown[]) => mockDeleteStepDefinition(...args),
    createStepDefinition: (...args: unknown[]) => mockCreateStepDefinition(...args),
    updateStepDefinition: (...args: unknown[]) => mockUpdateStepDefinition(...args),
  },
}));

// Import after mock
import { ChainDefinitionEditor } from '../mcp-chains/ChainDefinitionEditor';

// ============================================================
// Test data
// ============================================================

function makeChain(overrides: Partial<ChainDefinition> = {}): ChainDefinition {
  return {
    id: 'def-001',
    chain_key: 'test_pipeline',
    display_name: 'Test Pipeline',
    description: 'A test chain',
    version: 1,
    is_active: true,
    ...overrides,
  };
}

function makeStep(overrides: Partial<ChainStepDefinition> = {}): ChainStepDefinition {
  return {
    id: 'step-001',
    chain_definition_id: 'def-001',
    step_order: 1,
    step_key: 'validate',
    display_name: 'Validate Data',
    mcp_server: 'mcp-fhir-server',
    tool_name: 'validate_resource',
    requires_approval: false,
    approval_role: null,
    is_conditional: false,
    is_placeholder: false,
    placeholder_message: null,
    timeout_ms: 30000,
    max_retries: 0,
    input_mapping: {},
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('ChainDefinitionEditor', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockListChainSteps.mockResolvedValue({ success: true, data: [] });
    mockCreateChainDefinition.mockResolvedValue({ success: true, data: makeChain() });
    mockCreateStepDefinition.mockResolvedValue({ success: true, data: makeStep() });
    mockUpdateChainDefinition.mockResolvedValue({ success: true, data: makeChain() });
    mockUpdateStepDefinition.mockResolvedValue({ success: true, data: makeStep() });
    mockDeleteStepDefinition.mockResolvedValue({ success: true, data: { deleted: true } });
  });

  describe('Create mode', () => {
    it('should render create form with empty fields', () => {
      render(
        <ChainDefinitionEditor chain={null} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      expect(screen.getByText('Create Chain Definition')).toBeInTheDocument();
      expect(screen.getByTestId('chain-key-input')).toHaveValue('');
      expect(screen.getByTestId('chain-display-name-input')).toHaveValue('');
      expect(screen.getByText('Create Chain')).toBeInTheDocument();
    });

    it('should show validation error when required fields are empty', async () => {
      render(
        <ChainDefinitionEditor chain={null} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      fireEvent.click(screen.getByTestId('save-chain-btn'));

      await waitFor(() => {
        expect(screen.getByText(/chain key and display name are required/i)).toBeInTheDocument();
      });
    });

    it('should show validation error when no steps are defined', async () => {
      render(
        <ChainDefinitionEditor chain={null} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      fireEvent.change(screen.getByTestId('chain-key-input'), { target: { value: 'test_chain' } });
      fireEvent.change(screen.getByTestId('chain-display-name-input'), { target: { value: 'Test Chain' } });
      fireEvent.click(screen.getByTestId('save-chain-btn'));

      await waitFor(() => {
        expect(screen.getByText(/at least one step is required/i)).toBeInTheDocument();
      });
    });

    it('should add a step when clicking Add Step', () => {
      render(
        <ChainDefinitionEditor chain={null} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      expect(screen.getByText('Steps (0)')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('add-step-btn'));

      expect(screen.getByText('Steps (1)')).toBeInTheDocument();
      expect(screen.getByTestId('chain-step-editor')).toBeInTheDocument();
    });

    it('should create chain with steps on save', async () => {
      render(
        <ChainDefinitionEditor chain={null} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Fill chain fields
      fireEvent.change(screen.getByTestId('chain-key-input'), { target: { value: 'new_chain' } });
      fireEvent.change(screen.getByTestId('chain-display-name-input'), { target: { value: 'New Chain' } });
      fireEvent.change(screen.getByTestId('chain-description-input'), { target: { value: 'A new chain' } });

      // Add and configure a step
      fireEvent.click(screen.getByTestId('add-step-btn'));
      fireEvent.change(screen.getByTestId('step-key-input'), { target: { value: 'step_1' } });
      fireEvent.change(screen.getByTestId('step-display-name-input'), { target: { value: 'Step One' } });
      fireEvent.change(screen.getByTestId('step-server-select'), { target: { value: 'mcp-fhir-server' } });
      fireEvent.change(screen.getByTestId('step-tool-input'), { target: { value: 'get_patient' } });
      fireEvent.click(screen.getByTestId('save-step-btn'));

      // Save chain
      fireEvent.click(screen.getByTestId('save-chain-btn'));

      await waitFor(() => {
        expect(mockCreateChainDefinition).toHaveBeenCalledWith('new_chain', 'New Chain', 'A new chain');
      });

      await waitFor(() => {
        expect(mockCreateStepDefinition).toHaveBeenCalled();
      });
    });
  });

  describe('Edit mode', () => {
    it('should render edit form with existing chain data', async () => {
      const chain = makeChain();
      mockListChainSteps.mockResolvedValue({
        success: true,
        data: [makeStep()],
      });

      render(
        <ChainDefinitionEditor chain={chain} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      expect(screen.getByText('Edit Chain Definition')).toBeInTheDocument();
      expect(screen.getByTestId('chain-key-input')).toHaveValue('test_pipeline');
      expect(screen.getByTestId('chain-key-input')).toBeDisabled();
      expect(screen.getByText('Save Changes')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Steps (1)')).toBeInTheDocument();
      });
    });

    it('should load existing steps in edit mode', async () => {
      const chain = makeChain();
      mockListChainSteps.mockResolvedValue({
        success: true,
        data: [
          makeStep({ step_order: 1, step_key: 'step_a', display_name: 'Step A' }),
          makeStep({ id: 'step-002', step_order: 2, step_key: 'step_b', display_name: 'Step B' }),
        ],
      });

      render(
        <ChainDefinitionEditor chain={chain} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        expect(screen.getByText('Steps (2)')).toBeInTheDocument();
        expect(screen.getByText('Step A')).toBeInTheDocument();
        expect(screen.getByText('Step B')).toBeInTheDocument();
      });
    });
  });

  describe('Step management', () => {
    it('should remove a step when clicking Remove', async () => {
      render(
        <ChainDefinitionEditor chain={null} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Add a step
      fireEvent.click(screen.getByTestId('add-step-btn'));

      // Save the step first
      fireEvent.change(screen.getByTestId('step-key-input'), { target: { value: 'test' } });
      fireEvent.change(screen.getByTestId('step-display-name-input'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByTestId('step-server-select'), { target: { value: 'mcp-fhir-server' } });
      fireEvent.change(screen.getByTestId('step-tool-input'), { target: { value: 'get_patient' } });
      fireEvent.click(screen.getByTestId('save-step-btn'));

      expect(screen.getByText('Steps (1)')).toBeInTheDocument();

      // Remove the step
      fireEvent.click(screen.getByTestId('remove-step-0'));

      expect(screen.getByText('Steps (0)')).toBeInTheDocument();
    });
  });

  describe('Cancel', () => {
    it('should call onCancel when clicking Cancel', () => {
      render(
        <ChainDefinitionEditor chain={null} onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      fireEvent.click(screen.getByTestId('cancel-editor'));

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });
});
