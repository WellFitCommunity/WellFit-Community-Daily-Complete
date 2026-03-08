/**
 * Tests for PostgreSQL MCP Client
 */

import {
  getDashboardMetrics,
  getPatientRiskDistribution,
  getReadmissionRiskSummary,
  getClaimsStatusSummary,
  getBedAvailability,
} from '../mcpPostgresClient';

// Mock import.meta.env
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage: Record<string, string> = {
  'sb-test-auth-token': JSON.stringify({ access_token: 'test-token' })
};

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage[key] || null,
    setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
    removeItem: (key: string) => { delete mockLocalStorage[key]; },
    clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
  }
});

/** Helper: mock a successful MCP JSON-RPC response */
function mockMCPResponse<T>(data: T) {
  return {
    ok: true,
    json: async () => ({
      jsonrpc: '2.0',
      result: {
        content: [{ type: 'text', text: JSON.stringify(data) }],
        metadata: { rowsReturned: 1, executionTimeMs: 30 },
      },
      id: 1,
    }),
  };
}

describe('PostgresMCPClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDashboardMetrics', () => {
    it('should fetch dashboard metrics successfully', async () => {
      const mockData = {
        active_members: 150,
        high_risk_patients: 12,
        todays_encounters: 45,
        pending_tasks: 23,
        active_sdoh_flags: 8
      };

      mockFetch.mockResolvedValueOnce(mockMCPResponse([mockData]));

      const result = await getDashboardMetrics('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockData]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/mcp-postgres-server'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          })
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Query failed' }
        })
      });

      const result = await getDashboardMetrics('tenant-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query failed');
    });
  });

  describe('getPatientRiskDistribution', () => {
    it('should fetch patient risk distribution', async () => {
      const mockData = [
        { risk_level: 'high', count: 10 },
        { risk_level: 'medium', count: 25 },
        { risk_level: 'low', count: 65 }
      ];

      mockFetch.mockResolvedValueOnce(mockMCPResponse(mockData));

      const result = await getPatientRiskDistribution('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
    });
  });

  describe('getReadmissionRiskSummary', () => {
    it('should fetch readmission risk summary', async () => {
      const mockData = [
        { risk_category: 'high', patient_count: 15 },
        { risk_category: 'medium', patient_count: 30 },
        { risk_category: 'low', patient_count: 55 }
      ];

      mockFetch.mockResolvedValueOnce(mockMCPResponse(mockData));

      const result = await getReadmissionRiskSummary('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
    });
  });

  describe('getClaimsStatusSummary', () => {
    it('should fetch claims status summary', async () => {
      const mockData = [
        { status: 'pending', count: 20, total_charges: 50000 },
        { status: 'approved', count: 80, total_charges: 200000 },
        { status: 'denied', count: 5, total_charges: 12000 }
      ];

      mockFetch.mockResolvedValueOnce(mockMCPResponse(mockData));

      const result = await getClaimsStatusSummary('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data?.[1].total_charges).toBe(200000);
    });
  });

  describe('getBedAvailability', () => {
    it('should fetch bed availability by unit', async () => {
      const mockData = [
        { unit: 'ICU', status: 'available', count: 5 },
        { unit: 'ICU', status: 'occupied', count: 10 },
        { unit: 'Med-Surg', status: 'available', count: 20 },
        { unit: 'Med-Surg', status: 'occupied', count: 30 }
      ];

      mockFetch.mockResolvedValueOnce(mockMCPResponse(mockData));

      const result = await getBedAvailability('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(4);
    });
  });

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getDashboardMetrics('tenant-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle missing auth token gracefully', async () => {
      delete mockLocalStorage['sb-test-auth-token'];

      mockFetch.mockResolvedValueOnce(mockMCPResponse([]));

      const _result = await getDashboardMetrics('tenant-123');

      expect(mockFetch).toHaveBeenCalled();

      mockLocalStorage['sb-test-auth-token'] = JSON.stringify({ access_token: 'test-token' });
    });
  });
});
