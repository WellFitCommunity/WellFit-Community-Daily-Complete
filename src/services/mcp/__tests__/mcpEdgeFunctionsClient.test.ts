/**
 * Tests for Edge Functions MCP Client
 */

import {
  getWelfarePriorities,
  calculateReadmissionRisk,
  runSDOHDetection,
  generateEngagementReport,
  generateQualityReport,
  exportPatientFHIR,
  generate837PClaim,
  processShiftHandoff,
  createCareAlert,
  sendSMS,
  EdgeFunctionsMCPClient
} from '../mcpEdgeFunctionsClient';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage: Record<string, string> = {
  'sb-xkybsjnvuohpqpbkikyn-auth-token': JSON.stringify({ access_token: 'test-token' })
};

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage[key] || null,
    setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
    removeItem: (key: string) => { delete mockLocalStorage[key]; },
    clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
  }
});

describe('EdgeFunctionsMCPClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Analytics Functions', () => {
    describe('getWelfarePriorities', () => {
      it('should fetch welfare priorities', async () => {
        const mockData = {
          success: true,
          data: {
            priorities: [
              { patient_id: 'p1', priority_score: 0.95, factors: ['weather', 'missed_checkin'] },
              { patient_id: 'p2', priority_score: 0.85, factors: ['high_risk'] }
            ]
          },
          executionTimeMs: 150
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockData }]
          })
        });

        const result = await getWelfarePriorities('tenant-123', 10);

        expect(result.success).toBe(true);
        expect(result.data?.priorities).toHaveLength(2);
      });
    });

    describe('calculateReadmissionRisk', () => {
      it('should calculate readmission risk for a patient', async () => {
        const mockData = {
          success: true,
          data: {
            risk_30_day: 0.35,
            risk_7_day: 0.15,
            risk_90_day: 0.55,
            factors: ['recent_admission', 'multiple_comorbidities']
          },
          executionTimeMs: 200
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockData }]
          })
        });

        const result = await calculateReadmissionRisk('patient-123');

        expect(result.success).toBe(true);
        expect(result.data?.risk_30_day).toBe(0.35);
      });
    });

    describe('runSDOHDetection', () => {
      it('should run SDOH passive detection', async () => {
        const mockData = {
          success: true,
          data: {
            detected_flags: 15,
            patients_screened: 100
          },
          executionTimeMs: 500
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockData }]
          })
        });

        const result = await runSDOHDetection('tenant-123');

        expect(result.success).toBe(true);
        expect(result.data?.detected_flags).toBe(15);
      });
    });
  });

  describe('Report Functions', () => {
    describe('generateEngagementReport', () => {
      it('should generate engagement report', async () => {
        const mockData = {
          success: true,
          data: {
            check_ins: 25,
            mood_average: 3.8,
            medication_adherence: 0.92,
            activities: 45
          },
          executionTimeMs: 300
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockData }]
          })
        });

        const result = await generateEngagementReport('patient-123', '2024-01-01', '2024-01-31');

        expect(result.success).toBe(true);
        expect(result.data?.check_ins).toBe(25);
        expect(result.data?.medication_adherence).toBe(0.92);
      });
    });

    describe('generateQualityReport', () => {
      it('should generate quality measures report', async () => {
        const mockData = {
          success: true,
          data: {
            measures: [
              { code: 'HEDIS-BPD', name: 'Blood Pressure Control', performance: 78.5 },
              { code: 'HEDIS-HBA1C', name: 'Diabetes Control', performance: 72.3 }
            ]
          },
          executionTimeMs: 400
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockData }]
          })
        });

        const result = await generateQualityReport('tenant-123', 'quarter');

        expect(result.success).toBe(true);
        expect(result.data?.measures).toHaveLength(2);
      });
    });
  });

  describe('Integration Functions', () => {
    describe('exportPatientFHIR', () => {
      it('should export patient data as FHIR bundle', async () => {
        const mockData = {
          success: true,
          data: {
            bundle: { resourceType: 'Bundle', type: 'collection', entry: [] },
            resource_count: 5
          },
          executionTimeMs: 250
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockData }]
          })
        });

        const result = await exportPatientFHIR('patient-123', ['Patient', 'Condition']);

        expect(result.success).toBe(true);
        expect(result.data?.bundle.resourceType).toBe('Bundle');
      });
    });

    describe('generate837PClaim', () => {
      it('should generate 837P claim file', async () => {
        const mockData = {
          success: true,
          data: {
            x12_content: 'ISA*00*...',
            validation_errors: []
          },
          executionTimeMs: 180
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockData }]
          })
        });

        const result = await generate837PClaim('claim-123');

        expect(result.success).toBe(true);
        expect(result.data?.x12_content).toBeDefined();
        expect(result.data?.validation_errors).toHaveLength(0);
      });
    });
  });

  describe('Workflow Functions', () => {
    describe('processShiftHandoff', () => {
      it('should process shift handoff', async () => {
        const mockData = {
          success: true,
          data: {
            status: 'accepted',
            updated_at: '2024-01-15T08:00:00Z'
          },
          executionTimeMs: 100
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockData }]
          })
        });

        const result = await processShiftHandoff('shift-123', 'accept');

        expect(result.success).toBe(true);
        expect(result.data?.status).toBe('accepted');
      });
    });

    describe('createCareAlert', () => {
      it('should create care coordination alert', async () => {
        const mockData = {
          success: true,
          data: {
            alert_id: 'alert-456',
            created_at: '2024-01-15T10:30:00Z'
          },
          executionTimeMs: 80
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockData }]
          })
        });

        const result = await createCareAlert('patient-123', 'high_risk', 'Patient missed 3 consecutive check-ins');

        expect(result.success).toBe(true);
        expect(result.data?.alert_id).toBe('alert-456');
      });
    });
  });

  describe('Utility Functions', () => {
    describe('sendSMS', () => {
      it('should send SMS notification', async () => {
        const mockData = {
          success: true,
          data: {
            message_id: 'msg-789',
            status: 'queued'
          },
          executionTimeMs: 50
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockData }]
          })
        });

        const result = await sendSMS('+15551234567', 'Your appointment is tomorrow at 2pm');

        expect(result.success).toBe(true);
        expect(result.data?.status).toBe('queued');
      });
    });
  });

  describe('Client Methods', () => {
    describe('listFunctions', () => {
      it('should list available functions', async () => {
        const mockData = {
          functions: [
            { name: 'get-welfare-priorities', category: 'analytics', sideEffects: 'read' },
            { name: 'send-sms', category: 'utility', sideEffects: 'write' }
          ],
          total: 2
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockData }]
          })
        });

        const client = EdgeFunctionsMCPClient.getInstance();
        const result = await client.listFunctions();

        expect(result).toHaveLength(2);
      });

      it('should filter functions by category', async () => {
        const mockData = {
          functions: [
            { name: 'get-welfare-priorities', category: 'analytics', sideEffects: 'read' }
          ],
          total: 1
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockData }]
          })
        });

        const client = EdgeFunctionsMCPClient.getInstance();
        const result = await client.listFunctions('analytics');

        expect(result).toHaveLength(1);
        expect(result[0].category).toBe('analytics');
      });
    });

    describe('batchInvoke', () => {
      it('should batch invoke multiple functions', async () => {
        const mockData = {
          results: [
            { function_name: 'calculate-readmission-risk', success: true, executionTimeMs: 100 },
            { function_name: 'generate-engagement-report', success: true, executionTimeMs: 200 }
          ],
          completed: 2,
          total: 2,
          allSucceeded: true
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockData }]
          })
        });

        const client = EdgeFunctionsMCPClient.getInstance();
        const result = await client.batchInvoke([
          { function_name: 'calculate-readmission-risk', payload: { patient_id: 'p1' } },
          { function_name: 'generate-engagement-report', payload: { patient_id: 'p1' } }
        ]);

        expect(result.allSucceeded).toBe(true);
        expect(result.completed).toBe(2);
      });

      it('should stop on error when configured', async () => {
        const mockData = {
          results: [
            { function_name: 'calculate-readmission-risk', success: false, error: 'Not found', executionTimeMs: 50 }
          ],
          completed: 1,
          total: 2,
          allSucceeded: false
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockData }]
          })
        });

        const client = EdgeFunctionsMCPClient.getInstance();
        const result = await client.batchInvoke(
          [
            { function_name: 'calculate-readmission-risk', payload: { patient_id: 'invalid' } },
            { function_name: 'generate-engagement-report', payload: { patient_id: 'p1' } }
          ],
          true // stop on error
        );

        expect(result.allSucceeded).toBe(false);
        expect(result.completed).toBe(1);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getWelfarePriorities('tenant-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Function not found' }
        })
      });

      const result = await calculateReadmissionRisk('invalid-patient');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Function not found');
    });

    it('should handle function execution errors', async () => {
      const mockData = {
        success: false,
        error: 'Patient not found',
        executionTimeMs: 30
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockData }]
        })
      });

      const result = await calculateReadmissionRisk('nonexistent-patient');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Patient not found');
    });
  });
});
