/**
 * Tests for Audit Report Generator Service
 *
 * Covers SOC2, HIPAA compliance report generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditReportGeneratorService, AuditReportRequest, AuditReportResponse, AuditFinding } from '../auditReportGeneratorService';

// Mock supabaseClient
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    })),
  },
}));

// =====================================================
// MOCK DATA FACTORIES
// =====================================================

function createMockAuditRequest(overrides?: Partial<AuditReportRequest>): AuditReportRequest {
  return {
    reportType: 'hipaa',
    periodStart: '2025-01-01',
    periodEnd: '2025-12-31',
    tenantId: 'test-tenant',
    ...overrides,
  };
}

function createMockAuditResponse(): AuditReportResponse {
  return {
    result: {
      reportId: 'report-123',
      reportType: 'hipaa',
      title: 'HIPAA Compliance Audit Report',
      executiveSummary: 'Overall compliance score: 92%',
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
      overallComplianceScore: 92,
      overallStatus: 'compliant',
      controlCategories: [
        { category: 'Access Control', score: 95, controlCount: 10, findingCount: 1 },
      ],
      controlAssessments: [],
      findings: [
        {
          id: 'finding-1',
          title: 'Incomplete audit logging',
          description: 'Some actions not logged',
          severity: 'medium',
          status: 'open',
          controlId: 'AC-1',
          controlName: 'Access Control Policy',
          evidence: ['Log analysis'],
          recommendation: 'Enable comprehensive logging',
        },
      ],
      recommendations: [
        {
          priority: 'high',
          recommendation: 'Implement MFA',
          impactedControls: ['AC-1'],
          estimatedEffort: '2 weeks',
        },
      ],
      riskSummary: {
        criticalRisks: 0,
        highRisks: 1,
        mediumRisks: 2,
        lowRisks: 3,
        acceptedRisks: 0,
      },
      appendices: [],
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      model: 'claude-haiku-4.5',
      responseTimeMs: 1500,
      dataSourceCount: 5,
    },
  };
}

// =====================================================
// TESTS
// =====================================================

describe('AuditReportGeneratorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateReport', () => {
    it('should return failure when reportType is missing', async () => {
      const request = createMockAuditRequest({ reportType: undefined as unknown as 'hipaa' });
      const result = await AuditReportGeneratorService.generateReport(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return failure when periodStart is missing', async () => {
      const request = createMockAuditRequest({ periodStart: '' });
      const result = await AuditReportGeneratorService.generateReport(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return failure when periodEnd is missing', async () => {
      const request = createMockAuditRequest({ periodEnd: '' });
      const result = await AuditReportGeneratorService.generateReport(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should handle edge function errors gracefully', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Edge function error' },
      });

      const request = createMockAuditRequest();
      const result = await AuditReportGeneratorService.generateReport(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('REPORT_GENERATION_FAILED');
    });

    it('should successfully generate a report', async () => {
      const mockResponse = createMockAuditResponse();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request = createMockAuditRequest();
      const result = await AuditReportGeneratorService.generateReport(request);

      expect(result.success).toBe(true);
      expect(result.data?.result.reportId).toBe('report-123');
      expect(result.data?.result.overallComplianceScore).toBe(92);
    });
  });

  describe('saveReport', () => {
    it('should save report successfully', async () => {
      const request = createMockAuditRequest();
      const response = createMockAuditResponse();

      const result = await AuditReportGeneratorService.saveReport(request, response, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('test-id');
    });
  });

  describe('getReportHistory', () => {
    it('should fetch report history', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockData = [{ result: createMockAuditResponse().result }];

      // Create a mock that properly handles the chain including the conditional .eq()
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve({ data: mockData, error: null })),
      };
      vi.mocked(supabase.from).mockReturnValue(mockQuery as never);

      const result = await AuditReportGeneratorService.getReportHistory('tenant-123');

      expect(result.success).toBe(true);
    });
  });

  describe('updateFindingStatus', () => {
    it('should update finding status', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockFindings: AuditFinding[] = [
        {
          id: 'finding-1',
          title: 'Test Finding',
          description: 'Test',
          severity: 'medium',
          status: 'open',
          controlId: 'AC-1',
          controlName: 'Access Control',
          evidence: [],
          recommendation: 'Fix it',
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { findings: mockFindings }, error: null }),
      } as never);

      const result = await AuditReportGeneratorService.updateFindingStatus(
        'report-123',
        'finding-1',
        'remediated'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('getComplianceTrends', () => {
    it('should fetch compliance trends', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockData = [
        { period_end: '2025-01-01', compliance_score: 90 },
        { period_end: '2025-06-01', compliance_score: 92 },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as never);

      const result = await AuditReportGeneratorService.getComplianceTrends('tenant-123', 'hipaa');

      expect(result.success).toBe(true);
    });
  });
});
