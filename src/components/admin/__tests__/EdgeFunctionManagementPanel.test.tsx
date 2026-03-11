/**
 * EdgeFunctionManagementPanel Tests
 *
 * Behavioral tests for edge function management UI:
 * - Function listing and filtering
 * - Single function invocation with payload
 * - Batch invocation
 * - Error handling
 * - Execution history display
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- Hoisted mocks ---
const mockListFunctions = vi.hoisted(() => vi.fn());
const mockInvokeFunction = vi.hoisted(() => vi.fn());
const mockBatchInvoke = vi.hoisted(() => vi.fn());
const mockGetInstance = vi.hoisted(() => vi.fn());

vi.mock('../../../services/mcp/mcpEdgeFunctionsClient', () => ({
  EdgeFunctionsMCPClient: {
    getInstance: mockGetInstance,
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

// --- Import (after mocks) ---
import EdgeFunctionManagementPanel from '../EdgeFunctionManagementPanel';

// --- Test Data ---
const mockFunctions = [
  {
    name: 'get-welfare-priorities',
    description: 'Calculate welfare priorities for a patient',
    category: 'analytics',
    parameters: { patient_id: 'string' },
    hasSideEffects: false,
  },
  {
    name: 'send-sms',
    description: 'Send an SMS message',
    category: 'utility',
    parameters: { phone: 'string', message: 'string' },
    hasSideEffects: true,
  },
  {
    name: 'generate-engagement-report',
    description: 'Generate patient engagement report',
    category: 'reports',
    parameters: {},
    hasSideEffects: false,
  },
];

// --- Setup ---
beforeEach(() => {
  vi.clearAllMocks();
  mockGetInstance.mockReturnValue({
    listFunctions: mockListFunctions,
    invokeFunction: mockInvokeFunction,
    batchInvoke: mockBatchInvoke,
  });
  mockListFunctions.mockResolvedValue({
    success: true,
    data: mockFunctions,
  });
});

describe('EdgeFunctionManagementPanel', () => {
  it('renders header and loads function list', async () => {
    render(<EdgeFunctionManagementPanel />);

    expect(screen.getByText('Edge Function Management')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('get-welfare-priorities')).toBeInTheDocument();
    });
    expect(screen.getByText('send-sms')).toBeInTheDocument();
    expect(screen.getByText('generate-engagement-report')).toBeInTheDocument();
  });

  it('shows function table with category, description, and side effects', async () => {
    render(<EdgeFunctionManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('get-welfare-priorities')).toBeInTheDocument();
    });

    expect(screen.getByText('Calculate welfare priorities for a patient')).toBeInTheDocument();
    expect(screen.getByText('analytics')).toBeInTheDocument();
    // Side effects column
    const yesElements = screen.getAllByText('Yes');
    expect(yesElements.length).toBeGreaterThan(0);
  });

  it('filters functions by category', async () => {
    mockListFunctions.mockResolvedValueOnce({
      success: true,
      data: mockFunctions,
    }).mockResolvedValueOnce({
      success: true,
      data: [mockFunctions[0]], // Only analytics
    });

    render(<EdgeFunctionManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('get-welfare-priorities')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Category:'), { target: { value: 'analytics' } });

    await waitFor(() => {
      expect(mockListFunctions).toHaveBeenCalledWith('analytics');
    });
  });

  it('shows invoke mode with payload editor when Invoke is clicked', async () => {
    render(<EdgeFunctionManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('get-welfare-priorities')).toBeInTheDocument();
    });

    const invokeButtons = screen.getAllByText('Invoke');
    fireEvent.click(invokeButtons[0]);

    expect(screen.getByText(/Invoke: get-welfare-priorities/)).toBeInTheDocument();
    expect(screen.getByLabelText('JSON Payload')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /execute function/i })).toBeInTheDocument();
  });

  it('invokes a function and shows result in execution history', async () => {
    mockInvokeFunction.mockResolvedValue({
      success: true,
      data: { priorities: ['Test Priority Alpha'] },
      executionTimeMs: 142,
    });

    render(<EdgeFunctionManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('get-welfare-priorities')).toBeInTheDocument();
    });

    const invokeButtons = screen.getAllByText('Invoke');
    fireEvent.click(invokeButtons[0]);

    fireEvent.click(screen.getByRole('button', { name: /execute function/i }));

    await waitFor(() => {
      expect(screen.getByText('Execution History')).toBeInTheDocument();
    });
    expect(screen.getByText('142ms')).toBeInTheDocument();
  });

  it('shows error when invocation fails', async () => {
    mockInvokeFunction.mockResolvedValue({
      success: false,
      error: 'Function timed out',
      executionTimeMs: 30000,
    });

    render(<EdgeFunctionManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('get-welfare-priorities')).toBeInTheDocument();
    });

    const invokeButtons = screen.getAllByText('Invoke');
    fireEvent.click(invokeButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /execute function/i }));

    await waitFor(() => {
      expect(screen.getByText('Function timed out')).toBeInTheDocument();
    });
  });

  it('handles invalid JSON payload gracefully', async () => {
    mockInvokeFunction.mockImplementation(() => {
      throw new SyntaxError('Unexpected token');
    });

    render(<EdgeFunctionManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('get-welfare-priorities')).toBeInTheDocument();
    });

    const invokeButtons = screen.getAllByText('Invoke');
    fireEvent.click(invokeButtons[0]);

    fireEvent.change(screen.getByLabelText('JSON Payload'), {
      target: { value: '{invalid json}' },
    });

    fireEvent.click(screen.getByRole('button', { name: /execute function/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('switches to batch mode and allows function selection', async () => {
    render(<EdgeFunctionManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('get-welfare-priorities')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Batch'));

    expect(screen.getByText('Batch Invocation')).toBeInTheDocument();
    expect(screen.getByText(/Select functions to execute/)).toBeInTheDocument();

    // Select two functions
    fireEvent.click(screen.getByRole('checkbox', { name: /get-welfare-priorities/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /send-sms/i }));

    expect(screen.getByRole('button', { name: /run 2 functions/i })).toBeInTheDocument();
  });

  it('executes batch invocation and shows results', async () => {
    mockBatchInvoke.mockResolvedValue({
      success: true,
      data: {
        results: [
          { functionName: 'get-welfare-priorities', success: true, data: {}, executionTimeMs: 100 },
          { functionName: 'send-sms', success: true, data: {}, executionTimeMs: 200 },
        ],
      },
    });

    render(<EdgeFunctionManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('get-welfare-priorities')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Batch'));
    fireEvent.click(screen.getByRole('checkbox', { name: /get-welfare-priorities/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /send-sms/i }));
    fireEvent.click(screen.getByRole('button', { name: /run 2 functions/i }));

    await waitFor(() => {
      expect(screen.getByText('Execution History')).toBeInTheDocument();
    });
  });

  it('shows error state when function list fails to load', async () => {
    mockListFunctions.mockResolvedValue({
      success: false,
      error: 'MCP server unavailable',
    });

    render(<EdgeFunctionManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('MCP server unavailable')).toBeInTheDocument();
    });
  });

  it('shows back button in invoke mode that returns to browse', async () => {
    render(<EdgeFunctionManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('get-welfare-priorities')).toBeInTheDocument();
    });

    const invokeButtons = screen.getAllByText('Invoke');
    fireEvent.click(invokeButtons[0]);

    expect(screen.getByText(/Invoke: get-welfare-priorities/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Back to Browse'));

    await waitFor(() => {
      expect(screen.getByText('get-welfare-priorities')).toBeInTheDocument();
    });
    // Should be back in table view
    expect(screen.queryByText('JSON Payload')).not.toBeInTheDocument();
  });

  it('disables batch run button when no functions selected', async () => {
    render(<EdgeFunctionManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('get-welfare-priorities')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Batch'));

    const runButton = screen.getByRole('button', { name: /run 0 functions/i });
    expect(runButton).toBeDisabled();
  });

  it('toggles batch function selection on and off', async () => {
    render(<EdgeFunctionManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('get-welfare-priorities')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Batch'));

    // Select
    fireEvent.click(screen.getByRole('checkbox', { name: /get-welfare-priorities/i }));
    expect(screen.getByRole('button', { name: /run 1 functions/i })).toBeInTheDocument();

    // Deselect
    fireEvent.click(screen.getByRole('checkbox', { name: /get-welfare-priorities/i }));
    expect(screen.getByRole('button', { name: /run 0 functions/i })).toBeInTheDocument();
  });
});
