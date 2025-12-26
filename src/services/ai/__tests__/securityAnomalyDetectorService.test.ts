/**
 * Tests for Security Anomaly Detector Service
 *
 * Covers ML-powered behavioral analysis and threat detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SecurityAnomalyDetectorService,
  SecurityAnomalyRequest,
  SecurityAnomalyResponse,
  AccessEvent,
  DetectedAnomaly,
} from '../securityAnomalyDetectorService';

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

function createMockAccessEvent(overrides?: Partial<AccessEvent>): AccessEvent {
  return {
    timestamp: new Date().toISOString(),
    userId: 'user-123',
    userEmail: 'user@example.com',
    userRole: 'nurse',
    action: 'view',
    resource: 'patient_record',
    resourceType: 'PHI',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
    location: { country: 'US', region: 'CA', city: 'Los Angeles' },
    sessionId: 'session-123',
    success: true,
    ...overrides,
  };
}

function createMockAnomaly(): DetectedAnomaly {
  return {
    anomalyId: 'anomaly-123',
    detectedAt: new Date().toISOString(),
    anomalyType: 'bulk_access',
    severity: 'high',
    userId: 'user-123',
    userEmail: 'user@example.com',
    ipAddress: '192.168.1.100',
    resourceAccessed: 'patient_records',
    riskScore: 85,
    description: 'Unusual bulk access to patient records detected',
    baselineDeviation: {
      metric: 'daily_access_count',
      expected: '50',
      observed: '500',
      deviationPercent: 900,
    },
    relatedEvents: [createMockAccessEvent()],
    indicators: ['10x normal access volume', 'Off-hours activity'],
    recommendations: ['Review user access permissions', 'Contact user for verification'],
    status: 'open',
  };
}

function createMockSecurityRequest(overrides?: Partial<SecurityAnomalyRequest>): SecurityAnomalyRequest {
  return {
    events: [createMockAccessEvent()],
    timeWindowHours: 24,
    includeCorrelation: true,
    tenantId: 'test-tenant',
    ...overrides,
  };
}

function createMockSecurityResponse(): SecurityAnomalyResponse {
  return {
    result: {
      anomalies: [createMockAnomaly()],
      threatAssessment: {
        overallThreatLevel: 'elevated',
        activeThreats: 3,
        recentAnomalies24h: 5,
        topAnomalyTypes: [
          { type: 'bulk_access', count: 2 },
          { type: 'off_hours_access', count: 2 },
          { type: 'unusual_location', count: 1 },
        ],
        riskiestUsers: [
          { userId: 'user-123', riskScore: 85, anomalyCount: 3 },
        ],
        systemHealth: {
          authenticationHealth: 90,
          accessControlHealth: 75,
          dataProtectionHealth: 85,
        },
        recommendations: [
          'Review access for user-123',
          'Enable geo-blocking',
        ],
      },
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      model: 'claude-sonnet-4.5',
      responseTimeMs: 800,
      eventsAnalyzed: 100,
    },
  };
}

// =====================================================
// TESTS
// =====================================================

describe('SecurityAnomalyDetectorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeEvents', () => {
    it('should return failure when events array is empty', async () => {
      const request = createMockSecurityRequest({ events: [] });
      const result = await SecurityAnomalyDetectorService.analyzeEvents(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should return failure when events is undefined', async () => {
      const request = createMockSecurityRequest({ events: undefined as unknown as AccessEvent[] });
      const result = await SecurityAnomalyDetectorService.analyzeEvents(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_INPUT');
    });

    it('should handle edge function errors gracefully', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Edge function error' },
      });

      const request = createMockSecurityRequest();
      const result = await SecurityAnomalyDetectorService.analyzeEvents(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ANALYSIS_FAILED');
    });

    it('should successfully analyze events', async () => {
      const mockResponse = createMockSecurityResponse();
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const request = createMockSecurityRequest();
      const result = await SecurityAnomalyDetectorService.analyzeEvents(request);

      expect(result.success).toBe(true);
      expect(result.data?.result.anomalies.length).toBeGreaterThan(0);
      expect(result.data?.result.threatAssessment.overallThreatLevel).toBe('elevated');
    });
  });

  describe('saveAnomaly', () => {
    it('should save anomaly successfully', async () => {
      const anomaly = createMockAnomaly();
      const result = await SecurityAnomalyDetectorService.saveAnomaly(anomaly, 'tenant-123');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('test-id');
    });
  });

  describe('getOpenAnomalies', () => {
    it('should fetch open anomalies', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockData = [{ result: createMockAnomaly() }];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as never);

      const result = await SecurityAnomalyDetectorService.getOpenAnomalies('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data?.length).toBeGreaterThan(0);
    });

    it('should filter by severity when provided', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockFrom = vi.mocked(supabase.from);

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as never);

      await SecurityAnomalyDetectorService.getOpenAnomalies('tenant-123', 'critical');

      expect(mockFrom).toHaveBeenCalled();
    });
  });

  describe('updateAnomalyStatus', () => {
    it('should update anomaly status', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      } as never);

      const result = await SecurityAnomalyDetectorService.updateAnomalyStatus(
        'anomaly-123',
        'resolved',
        'admin-user',
        'Verified as authorized access'
      );

      expect(result.success).toBe(true);
    });

    it('should update to investigating status', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      } as never);

      const result = await SecurityAnomalyDetectorService.updateAnomalyStatus(
        'anomaly-123',
        'investigating'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('getThreatAssessment', () => {
    it('should return threat assessment', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockAnomalies = [
        { anomaly_type: 'bulk_access', severity: 'high', risk_score: 85, user_id: 'user-1', status: 'open' },
        { anomaly_type: 'off_hours_access', severity: 'medium', risk_score: 60, user_id: 'user-2', status: 'open' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockAnomalies, error: null }),
      } as never);

      const result = await SecurityAnomalyDetectorService.getThreatAssessment('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('overallThreatLevel');
      expect(result.data).toHaveProperty('activeThreats');
      expect(result.data).toHaveProperty('topAnomalyTypes');
    });

    it('should calculate threat level based on severity', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockCriticalAnomalies = [
        { anomaly_type: 'data_exfiltration', severity: 'critical', risk_score: 95, user_id: 'user-1', status: 'open' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockCriticalAnomalies, error: null }),
      } as never);

      const result = await SecurityAnomalyDetectorService.getThreatAssessment('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data?.overallThreatLevel).toBe('critical');
    });

    it('should return low threat level when no anomalies', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as never);

      const result = await SecurityAnomalyDetectorService.getThreatAssessment('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data?.overallThreatLevel).toBe('low');
    });
  });

  describe('getUserRiskProfile', () => {
    it('should return user risk profile', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockData = [
        { result: createMockAnomaly(), risk_score: 85, anomaly_type: 'bulk_access' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as never);

      const result = await SecurityAnomalyDetectorService.getUserRiskProfile('user-123', 'tenant-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('riskScore');
      expect(result.data).toHaveProperty('anomalyCount');
      expect(result.data).toHaveProperty('riskFactors');
    });

    it('should return zero risk for user with no anomalies', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as never);

      const result = await SecurityAnomalyDetectorService.getUserRiskProfile('clean-user', 'tenant-123');

      expect(result.success).toBe(true);
      expect(result.data?.riskScore).toBe(0);
      expect(result.data?.anomalyCount).toBe(0);
    });
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations for brute force', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockAnomalies = [
        { anomaly_type: 'brute_force', severity: 'high', risk_score: 80, user_id: 'user-1', status: 'open' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockAnomalies, error: null }),
      } as never);

      const result = await SecurityAnomalyDetectorService.getThreatAssessment('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data?.recommendations).toContain('Enable account lockout policies after failed attempts');
    });

    it('should generate recommendations for privilege escalation', async () => {
      const { supabase } = await import('../../../lib/supabaseClient');
      const mockAnomalies = [
        { anomaly_type: 'privilege_escalation', severity: 'critical', risk_score: 90, user_id: 'user-1', status: 'open' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: mockAnomalies, error: null }),
      } as never);

      const result = await SecurityAnomalyDetectorService.getThreatAssessment('tenant-123');

      expect(result.success).toBe(true);
      expect(result.data?.recommendations).toContain('Review role assignments and permission boundaries');
    });
  });
});
