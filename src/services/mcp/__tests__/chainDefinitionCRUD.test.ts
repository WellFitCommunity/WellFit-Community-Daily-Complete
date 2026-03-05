/**
 * Chain Definition CRUD — Service Tests
 *
 * Tests the create/update/delete methods added to chainOrchestrationService:
 * - Create chain definition
 * - Update chain definition
 * - Delete chain definition (with run protection)
 * - Create/update/delete step definitions
 */

import { chainOrchestrationService } from '../chainOrchestrationService';
import { supabase } from '../../../lib/supabaseClient';

// Mock supabase client
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

const mockFrom = vi.mocked(supabase.from);

// Helper to build chainable query mock
function createQueryMock(resolveWith: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const terminal = {
    then: (fn: (v: unknown) => unknown) => Promise.resolve(fn(resolveWith)),
  };
  const proxy = new Proxy(chain, {
    get: (_target, prop) => {
      if (prop === 'then') return terminal.then;
      if (!chain[prop as string]) {
        chain[prop as string] = vi.fn().mockReturnValue(proxy);
      }
      return chain[prop as string];
    },
  });
  return proxy;
}

describe('Chain Definition CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createChainDefinition', () => {
    it('should create a new chain definition', async () => {
      const mockChain = {
        id: 'def-new',
        chain_key: 'test_chain',
        display_name: 'Test Chain',
        description: 'A test chain',
        version: 1,
        is_active: true,
      };

      mockFrom.mockReturnValue(
        createQueryMock({ data: mockChain, error: null }) as unknown as ReturnType<typeof supabase.from>
      );

      const result = await chainOrchestrationService.createChainDefinition(
        'test_chain',
        'Test Chain',
        'A test chain'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.chain_key).toBe('test_chain');
        expect(result.data.display_name).toBe('Test Chain');
      }
    });

    it('should reject empty chain_key', async () => {
      const result = await chainOrchestrationService.createChainDefinition('', 'Name', null);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('required');
      }
    });

    it('should reject empty display_name', async () => {
      const result = await chainOrchestrationService.createChainDefinition('key', '', null);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('required');
      }
    });

    it('should handle database errors', async () => {
      mockFrom.mockReturnValue(
        createQueryMock({
          data: null,
          error: { message: 'duplicate key value violates unique constraint' },
        }) as unknown as ReturnType<typeof supabase.from>
      );

      const result = await chainOrchestrationService.createChainDefinition(
        'dup_chain',
        'Duplicate',
        null
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('duplicate');
      }
    });
  });

  describe('updateChainDefinition', () => {
    it('should update chain definition fields', async () => {
      const mockUpdated = {
        id: 'def-001',
        chain_key: 'test_chain',
        display_name: 'Updated Name',
        description: 'Updated description',
        version: 1,
        is_active: true,
      };

      mockFrom.mockReturnValue(
        createQueryMock({ data: mockUpdated, error: null }) as unknown as ReturnType<typeof supabase.from>
      );

      const result = await chainOrchestrationService.updateChainDefinition('def-001', {
        display_name: 'Updated Name',
        description: 'Updated description',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.display_name).toBe('Updated Name');
      }
    });

    it('should reject empty id', async () => {
      const result = await chainOrchestrationService.updateChainDefinition('', {
        display_name: 'Test',
      });

      expect(result.success).toBe(false);
    });

    it('should support deactivating a chain', async () => {
      mockFrom.mockReturnValue(
        createQueryMock({
          data: { id: 'def-001', is_active: false },
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      const result = await chainOrchestrationService.updateChainDefinition('def-001', {
        is_active: false,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('deleteChainDefinition', () => {
    it('should delete chain with no runs', async () => {
      // First call: check for runs (returns empty)
      // Second call: delete steps
      // Third call: delete chain
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Check for runs
          return createQueryMock({ data: [], error: null }) as unknown as ReturnType<typeof supabase.from>;
        }
        // Delete steps or definition
        return createQueryMock({ data: null, error: null }) as unknown as ReturnType<typeof supabase.from>;
      });

      const result = await chainOrchestrationService.deleteChainDefinition('def-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deleted).toBe(true);
      }
    });

    it('should prevent deletion when runs exist', async () => {
      mockFrom.mockReturnValue(
        createQueryMock({
          data: [{ id: 'run-001' }],
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      const result = await chainOrchestrationService.deleteChainDefinition('def-001');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('existing runs');
      }
    });

    it('should reject empty id', async () => {
      const result = await chainOrchestrationService.deleteChainDefinition('');

      expect(result.success).toBe(false);
    });
  });

  describe('createStepDefinition', () => {
    it('should create a step definition', async () => {
      const mockStep = {
        id: 'stepdef-new',
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
      };

      mockFrom.mockReturnValue(
        createQueryMock({ data: mockStep, error: null }) as unknown as ReturnType<typeof supabase.from>
      );

      const result = await chainOrchestrationService.createStepDefinition('def-001', {
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
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.step_key).toBe('validate');
      }
    });

    it('should reject empty chain_definition_id', async () => {
      const result = await chainOrchestrationService.createStepDefinition('', {
        step_order: 1,
        step_key: 'test',
        display_name: 'Test',
        mcp_server: 'mcp-fhir-server',
        tool_name: 'test',
        requires_approval: false,
        approval_role: null,
        is_conditional: false,
        is_placeholder: false,
        placeholder_message: null,
        timeout_ms: 30000,
        max_retries: 0,
        input_mapping: {},
      });

      expect(result.success).toBe(false);
    });
  });

  describe('updateStepDefinition', () => {
    it('should update step definition fields', async () => {
      mockFrom.mockReturnValue(
        createQueryMock({
          data: { id: 'stepdef-001', display_name: 'Updated Step', timeout_ms: 60000 },
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      const result = await chainOrchestrationService.updateStepDefinition('stepdef-001', {
        display_name: 'Updated Step',
        timeout_ms: 60000,
      });

      expect(result.success).toBe(true);
    });

    it('should reject empty step id', async () => {
      const result = await chainOrchestrationService.updateStepDefinition('', {
        display_name: 'Test',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('deleteStepDefinition', () => {
    it('should delete a step definition', async () => {
      mockFrom.mockReturnValue(
        createQueryMock({ data: null, error: null }) as unknown as ReturnType<typeof supabase.from>
      );

      const result = await chainOrchestrationService.deleteStepDefinition('stepdef-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deleted).toBe(true);
      }
    });

    it('should reject empty step id', async () => {
      const result = await chainOrchestrationService.deleteStepDefinition('');

      expect(result.success).toBe(false);
    });
  });
});
