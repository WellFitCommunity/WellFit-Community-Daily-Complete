/**
 * SOC2 Monitoring Service Tests
 *
 * Tests for SOC 2 compliance monitoring and security event tracking.
 * Verifies proper data fetching, error handling, and compliance reporting.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SOC2MonitoringService,
  createSOC2MonitoringService,
  type SecurityMetrics,
  type SecurityEvent,
  type AuditLog,
  type PHIAccessAudit,
  type SecurityEventsAnalysis,
  type AuditSummaryStats,
  type EncryptionStatus,
  type IncidentResponseItem,
  type ComplianceStatus,
} from '../soc2MonitoringService';

// Mock the pagination module
vi.mock('../../utils/pagination', () => ({
  PAGINATION_LIMITS: {
    AUDIT_LOGS: 100,
    ALERTS: 100,
    DEFAULT: 50,
  },
  applyLimit: vi.fn(),
}));

import { applyLimit } from '../../utils/pagination';

const mockApplyLimit = applyLimit as ReturnType<typeof vi.fn>;

// Create mock Supabase client
function createMockSupabase() {
  const mockSingle = vi.fn();
  const mockLimit = vi.fn();
  const mockOrder = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockGetUser = vi.fn();

  // Chain setup
  mockSelect.mockReturnValue({
    limit: mockLimit,
    order: mockOrder,
    eq: mockEq,
    single: mockSingle,
  });
  mockLimit.mockReturnValue({
    single: mockSingle,
  });
  mockOrder.mockReturnValue({
    limit: mockLimit,
    eq: mockEq,
  });
  mockEq.mockReturnValue({
    eq: mockEq,
    limit: mockLimit,
    order: mockOrder,
  });
  mockUpdate.mockReturnValue({
    eq: mockEq,
  });
  mockFrom.mockReturnValue({
    select: mockSelect,
    update: mockUpdate,
  });

  return {
    from: mockFrom,
    rpc: mockRpc,
    auth: {
      getUser: mockGetUser,
    },
    // Expose mocks for test assertions
    _mocks: {
      mockFrom,
      mockSelect,
      mockLimit,
      mockOrder,
      mockEq,
      mockSingle,
      mockUpdate,
      mockRpc,
      mockGetUser,
    },
  };
}

// Mock data generators
function createMockSecurityMetrics(overrides?: Partial<SecurityMetrics>): SecurityMetrics {
  return {
    security_events_24h: 150,
    critical_events_24h: 5,
    high_events_24h: 12,
    medium_events_24h: 45,
    low_events_24h: 88,
    failed_logins_24h: 23,
    failed_logins_1h: 3,
    unauthorized_access_24h: 2,
    auto_blocked_24h: 8,
    open_investigations: 4,
    audit_events_24h: 1250,
    failed_operations_24h: 15,
    phi_access_24h: 320,
    last_updated: new Date().toISOString(),
    ...overrides,
  };
}

function createMockSecurityEvent(overrides?: Partial<SecurityEvent>): SecurityEvent {
  return {
    id: 'event-uuid-123',
    event_type: 'FAILED_LOGIN',
    severity: 'MEDIUM',
    actor_user_id: 'user-uuid-456',
    actor_ip_address: '192.168.1.100',
    actor_user_agent: 'Mozilla/5.0',
    timestamp: new Date().toISOString(),
    description: 'Failed login attempt detected',
    metadata: { attempts: 3 },
    auto_blocked: false,
    requires_investigation: false,
    investigated: false,
    investigated_by: null,
    investigated_at: null,
    resolution: null,
    related_audit_log_id: null,
    correlation_id: 'corr-123',
    alert_sent: false,
    alert_sent_at: null,
    alert_recipients: null,
    ...overrides,
  };
}

function createMockAuditLog(overrides?: Partial<AuditLog>): AuditLog {
  return {
    id: 'audit-uuid-789',
    actor_user_id: 'user-uuid-123',
    actor_role: 'nurse',
    actor_ip_address: '10.0.0.50',
    actor_user_agent: 'Mozilla/5.0',
    event_type: 'PHI_VIEW',
    event_category: 'CLINICAL',
    resource_type: 'patient',
    resource_id: 'patient-uuid-456',
    table_name: 'patients',
    timestamp: new Date().toISOString(),
    target_user_id: 'patient-uuid-456',
    operation: 'SELECT',
    metadata: {},
    success: true,
    error_code: null,
    error_message: null,
    retention_date: null,
    checksum: 'abc123',
    ...overrides,
  };
}

function createMockPHIAccessAudit(overrides?: Partial<PHIAccessAudit>): PHIAccessAudit {
  return {
    id: 'phi-uuid-123',
    timestamp: new Date().toISOString(),
    actor_user_id: 'user-uuid-123',
    actor_role: 'physician',
    actor_ip_address: '10.0.0.100',
    event_type: 'PHI_VIEW',
    resource_type: 'patient',
    resource_id: 'patient-uuid-789',
    target_user_id: 'patient-uuid-789',
    operation: 'VIEW',
    metadata: {},
    success: true,
    error_message: null,
    actor_email: 'doctor@hospital.com',
    patient_name: 'John Doe',
    access_type: 'View Medical Record',
    risk_level: 'LOW',
    ...overrides,
  };
}

function createMockSecurityEventsAnalysis(overrides?: Partial<SecurityEventsAnalysis>): SecurityEventsAnalysis {
  return {
    hour: new Date().toISOString(),
    event_type: 'FAILED_LOGIN',
    severity: 'MEDIUM',
    event_count: 15,
    unique_actors: 8,
    unique_ips: 5,
    auto_blocked_count: 2,
    investigation_required_count: 1,
    latest_occurrence: new Date().toISOString(),
    ...overrides,
  };
}

function createMockAuditSummaryStats(overrides?: Partial<AuditSummaryStats>): AuditSummaryStats {
  return {
    event_category: 'CLINICAL',
    event_type: 'PHI_ACCESS',
    total_events: 500,
    successful_events: 495,
    failed_events: 5,
    unique_users: 25,
    unique_roles: 5,
    earliest_event: '2025-01-01T00:00:00Z',
    latest_event: new Date().toISOString(),
    success_rate_percent: 99.0,
    ...overrides,
  };
}

function createMockEncryptionStatus(overrides?: Partial<EncryptionStatus>): EncryptionStatus {
  return {
    id: 1,
    key_name: 'phi_encryption_key',
    key_purpose: 'phi',
    key_algorithm: 'AES-256-GCM',
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    rotated_at: '2025-06-01T00:00:00Z',
    expires_at: '2026-06-01T00:00:00Z',
    days_since_rotation: 180,
    expiration_status: 'VALID',
    days_until_expiration: 180,
    ...overrides,
  };
}

function createMockIncidentResponseItem(overrides?: Partial<IncidentResponseItem>): IncidentResponseItem {
  return {
    id: 'incident-uuid-123',
    event_type: 'UNAUTHORIZED_ACCESS',
    severity: 'CRITICAL',
    timestamp: new Date().toISOString(),
    actor_user_id: 'user-uuid-456',
    actor_ip_address: '192.168.1.200',
    description: 'Unauthorized access attempt to admin panel',
    metadata: { attempted_resource: '/admin/users' },
    requires_investigation: true,
    investigated: false,
    investigated_by: null,
    investigated_at: null,
    resolution: null,
    auto_blocked: true,
    alert_sent: true,
    correlation_id: 'corr-456',
    hours_since_event: 2,
    priority_score: 95,
    sla_status: 'WITHIN_SLA',
    ...overrides,
  };
}

function createMockComplianceStatus(overrides?: Partial<ComplianceStatus>): ComplianceStatus {
  return {
    control_area: 'Access Control',
    soc2_criterion: 'CC6.1',
    control_description: 'Logical and physical access controls',
    status: 'COMPLIANT',
    details: 'All access controls are properly configured',
    test_result: 'PASS',
    last_checked: new Date().toISOString(),
    ...overrides,
  };
}

describe('SOC2MonitoringService', () => {
  let service: SOC2MonitoringService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new SOC2MonitoringService(mockSupabase as any);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getSecurityMetrics Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getSecurityMetrics', () => {
    it('should return security metrics on success', async () => {
      const mockMetrics = createMockSecurityMetrics();
      mockSupabase._mocks.mockSingle.mockResolvedValue({
        data: mockMetrics,
        error: null,
      });

      const result = await service.getSecurityMetrics();

      expect(result).toEqual(mockMetrics);
      expect(mockSupabase.from).toHaveBeenCalledWith('security_monitoring_dashboard');
      expect(mockSupabase._mocks.mockSelect).toHaveBeenCalledWith('*');
      expect(mockSupabase._mocks.mockLimit).toHaveBeenCalledWith(1);
    });

    it('should return null on database error', async () => {
      mockSupabase._mocks.mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await service.getSecurityMetrics();

      expect(result).toBeNull();
    });

    it('should return null on exception', async () => {
      mockSupabase._mocks.mockSingle.mockRejectedValue(new Error('Network error'));

      const result = await service.getSecurityMetrics();

      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getSecurityEvents Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getSecurityEvents', () => {
    it('should return security events with no filters', async () => {
      const mockEvents = [createMockSecurityEvent(), createMockSecurityEvent({ id: 'event-2' })];
      mockSupabase._mocks.mockOrder.mockResolvedValue({
        data: mockEvents,
        error: null,
      });

      const result = await service.getSecurityEvents();

      expect(result).toEqual(mockEvents);
      expect(mockSupabase.from).toHaveBeenCalledWith('security_events');
      expect(mockSupabase._mocks.mockOrder).toHaveBeenCalledWith('timestamp', { ascending: false });
    });

    it('should apply limit filter', async () => {
      const mockEvents = [createMockSecurityEvent()];
      mockSupabase._mocks.mockLimit.mockResolvedValue({
        data: mockEvents,
        error: null,
      });

      const result = await service.getSecurityEvents({ limit: 10 });

      expect(result).toEqual(mockEvents);
      expect(mockSupabase._mocks.mockLimit).toHaveBeenCalledWith(10);
    });

    it('should apply severity filter', async () => {
      const mockEvents = [createMockSecurityEvent({ severity: 'CRITICAL' })];
      mockSupabase._mocks.mockEq.mockResolvedValue({
        data: mockEvents,
        error: null,
      });

      const result = await service.getSecurityEvents({ severity: 'CRITICAL' });

      expect(result).toEqual(mockEvents);
      expect(mockSupabase._mocks.mockEq).toHaveBeenCalledWith('severity', 'CRITICAL');
    });

    it('should apply eventType filter', async () => {
      const mockEvents = [createMockSecurityEvent({ event_type: 'BRUTE_FORCE' })];
      mockSupabase._mocks.mockEq.mockResolvedValue({
        data: mockEvents,
        error: null,
      });

      const result = await service.getSecurityEvents({ eventType: 'BRUTE_FORCE' });

      expect(result).toEqual(mockEvents);
      expect(mockSupabase._mocks.mockEq).toHaveBeenCalledWith('event_type', 'BRUTE_FORCE');
    });

    it('should apply investigated filter', async () => {
      const mockEvents = [createMockSecurityEvent({ investigated: true })];
      mockSupabase._mocks.mockEq.mockResolvedValue({
        data: mockEvents,
        error: null,
      });

      const result = await service.getSecurityEvents({ investigated: true });

      expect(result).toEqual(mockEvents);
      expect(mockSupabase._mocks.mockEq).toHaveBeenCalledWith('investigated', true);
    });

    it('should apply multiple filters', async () => {
      const mockEvents = [createMockSecurityEvent({ severity: 'HIGH', investigated: false })];

      // When multiple filters are applied, the final .eq() call is awaited directly
      // Create a thenable mock that returns data when awaited
      const thenableMock = {
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => {
          resolve({ data: mockEvents, error: null });
          return Promise.resolve({ data: mockEvents, error: null });
        },
      };

      mockSupabase._mocks.mockLimit.mockReturnValue(thenableMock);

      const result = await service.getSecurityEvents({
        severity: 'HIGH',
        investigated: false,
        limit: 50,
      });

      expect(result).toEqual(mockEvents);
    });

    it('should return empty array on error', async () => {
      mockSupabase._mocks.mockOrder.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      const result = await service.getSecurityEvents();

      expect(result).toEqual([]);
    });

    it('should return empty array on exception', async () => {
      mockSupabase._mocks.mockOrder.mockRejectedValue(new Error('Network error'));

      const result = await service.getSecurityEvents();

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getAuditLogs Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getAuditLogs', () => {
    it('should return audit logs with no filters', async () => {
      const mockLogs = [createMockAuditLog(), createMockAuditLog({ id: 'audit-2' })];
      mockSupabase._mocks.mockOrder.mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await service.getAuditLogs();

      expect(result).toEqual(mockLogs);
      expect(mockSupabase.from).toHaveBeenCalledWith('audit_logs');
      expect(mockSupabase._mocks.mockOrder).toHaveBeenCalledWith('timestamp', { ascending: false });
    });

    it('should apply eventCategory filter', async () => {
      const mockLogs = [createMockAuditLog({ event_category: 'BILLING' })];
      mockSupabase._mocks.mockEq.mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await service.getAuditLogs({ eventCategory: 'BILLING' });

      expect(result).toEqual(mockLogs);
      expect(mockSupabase._mocks.mockEq).toHaveBeenCalledWith('event_category', 'BILLING');
    });

    it('should apply success filter', async () => {
      const mockLogs = [createMockAuditLog({ success: false })];
      mockSupabase._mocks.mockEq.mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await service.getAuditLogs({ success: false });

      expect(result).toEqual(mockLogs);
      expect(mockSupabase._mocks.mockEq).toHaveBeenCalledWith('success', false);
    });

    it('should apply actorUserId filter', async () => {
      const mockLogs = [createMockAuditLog({ actor_user_id: 'user-specific' })];
      mockSupabase._mocks.mockEq.mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const result = await service.getAuditLogs({ actorUserId: 'user-specific' });

      expect(result).toEqual(mockLogs);
      expect(mockSupabase._mocks.mockEq).toHaveBeenCalledWith('actor_user_id', 'user-specific');
    });

    it('should return empty array on error', async () => {
      mockSupabase._mocks.mockOrder.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      const result = await service.getAuditLogs();

      expect(result).toEqual([]);
    });

    it('should return empty array on exception', async () => {
      mockSupabase._mocks.mockOrder.mockRejectedValue(new Error('Network error'));

      const result = await service.getAuditLogs();

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getPHIAccessAudit Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getPHIAccessAudit', () => {
    it('should return PHI access audit with default limit', async () => {
      const mockAudits = [createMockPHIAccessAudit()];
      mockSupabase._mocks.mockLimit.mockResolvedValue({
        data: mockAudits,
        error: null,
      });

      const result = await service.getPHIAccessAudit();

      expect(result).toEqual(mockAudits);
      expect(mockSupabase.from).toHaveBeenCalledWith('phi_access_audit');
      expect(mockSupabase._mocks.mockLimit).toHaveBeenCalledWith(100);
    });

    it('should apply custom limit', async () => {
      const mockAudits = [createMockPHIAccessAudit()];
      mockSupabase._mocks.mockLimit.mockResolvedValue({
        data: mockAudits,
        error: null,
      });

      const result = await service.getPHIAccessAudit(50);

      expect(result).toEqual(mockAudits);
      expect(mockSupabase._mocks.mockLimit).toHaveBeenCalledWith(50);
    });

    it('should return empty array on error', async () => {
      mockSupabase._mocks.mockLimit.mockResolvedValue({
        data: null,
        error: { message: 'Access denied' },
      });

      const result = await service.getPHIAccessAudit();

      expect(result).toEqual([]);
    });

    it('should return empty array on exception', async () => {
      mockSupabase._mocks.mockLimit.mockRejectedValue(new Error('Network error'));

      const result = await service.getPHIAccessAudit();

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getSecurityEventsAnalysis Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getSecurityEventsAnalysis', () => {
    it('should return security events analysis with default limit', async () => {
      const mockAnalysis = [createMockSecurityEventsAnalysis()];
      mockSupabase._mocks.mockLimit.mockResolvedValue({
        data: mockAnalysis,
        error: null,
      });

      const result = await service.getSecurityEventsAnalysis();

      expect(result).toEqual(mockAnalysis);
      expect(mockSupabase.from).toHaveBeenCalledWith('security_events_analysis');
      expect(mockSupabase._mocks.mockLimit).toHaveBeenCalledWith(168);
    });

    it('should apply custom limit', async () => {
      const mockAnalysis = [createMockSecurityEventsAnalysis()];
      mockSupabase._mocks.mockLimit.mockResolvedValue({
        data: mockAnalysis,
        error: null,
      });

      const result = await service.getSecurityEventsAnalysis(48);

      expect(result).toEqual(mockAnalysis);
      expect(mockSupabase._mocks.mockLimit).toHaveBeenCalledWith(48);
    });

    it('should return empty array on error', async () => {
      mockSupabase._mocks.mockLimit.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      const result = await service.getSecurityEventsAnalysis();

      expect(result).toEqual([]);
    });

    it('should return empty array on exception', async () => {
      mockSupabase._mocks.mockLimit.mockRejectedValue(new Error('Network error'));

      const result = await service.getSecurityEventsAnalysis();

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getAuditSummaryStats Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getAuditSummaryStats', () => {
    it('should return audit summary stats using applyLimit', async () => {
      const mockStats = [createMockAuditSummaryStats()];
      mockApplyLimit.mockResolvedValue(mockStats);

      const result = await service.getAuditSummaryStats();

      expect(result).toEqual(mockStats);
      expect(mockSupabase.from).toHaveBeenCalledWith('audit_summary_stats');
      expect(mockApplyLimit).toHaveBeenCalled();
    });

    it('should return empty array on exception', async () => {
      mockApplyLimit.mockRejectedValue(new Error('Query failed'));

      const result = await service.getAuditSummaryStats();

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getEncryptionStatus Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getEncryptionStatus', () => {
    it('should return encryption status using applyLimit', async () => {
      const mockStatus = [createMockEncryptionStatus()];
      mockApplyLimit.mockResolvedValue(mockStatus);

      const result = await service.getEncryptionStatus();

      expect(result).toEqual(mockStatus);
      expect(mockSupabase.from).toHaveBeenCalledWith('encryption_status_view');
      expect(mockApplyLimit).toHaveBeenCalled();
    });

    it('should return empty array on exception', async () => {
      mockApplyLimit.mockRejectedValue(new Error('Query failed'));

      const result = await service.getEncryptionStatus();

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getIncidentResponseQueue Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getIncidentResponseQueue', () => {
    it('should return incident response queue using applyLimit', async () => {
      const mockQueue = [createMockIncidentResponseItem()];
      mockApplyLimit.mockResolvedValue(mockQueue);

      const result = await service.getIncidentResponseQueue();

      expect(result).toEqual(mockQueue);
      expect(mockSupabase.from).toHaveBeenCalledWith('incident_response_queue');
      expect(mockApplyLimit).toHaveBeenCalled();
    });

    it('should return empty array on exception', async () => {
      mockApplyLimit.mockRejectedValue(new Error('Query failed'));

      const result = await service.getIncidentResponseQueue();

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getComplianceStatus Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getComplianceStatus', () => {
    it('should return compliance status using applyLimit', async () => {
      const mockCompliance = [createMockComplianceStatus()];
      mockApplyLimit.mockResolvedValue(mockCompliance);

      const result = await service.getComplianceStatus();

      expect(result).toEqual(mockCompliance);
      expect(mockSupabase.from).toHaveBeenCalledWith('compliance_status');
      expect(mockApplyLimit).toHaveBeenCalled();
    });

    it('should return empty array on exception', async () => {
      mockApplyLimit.mockRejectedValue(new Error('Query failed'));

      const result = await service.getComplianceStatus();

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // markEventInvestigated Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('markEventInvestigated', () => {
    it('should mark event as investigated successfully', async () => {
      const mockUserId = 'investigator-uuid-123';
      mockSupabase._mocks.mockGetUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });
      mockSupabase._mocks.mockEq.mockResolvedValue({
        data: {},
        error: null,
      });

      const result = await service.markEventInvestigated('event-uuid-123', 'False positive - verified user');

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('security_events');
      expect(mockSupabase._mocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          investigated: true,
          investigated_by: mockUserId,
          resolution: 'False positive - verified user',
        })
      );
      expect(mockSupabase._mocks.mockEq).toHaveBeenCalledWith('id', 'event-uuid-123');
    });

    it('should return false on database error', async () => {
      mockSupabase._mocks.mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });
      mockSupabase._mocks.mockEq.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      const result = await service.markEventInvestigated('event-uuid-123', 'Test resolution');

      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      mockSupabase._mocks.mockGetUser.mockRejectedValue(new Error('Auth error'));

      const result = await service.markEventInvestigated('event-uuid-123', 'Test resolution');

      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // createSecurityEvent Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createSecurityEvent', () => {
    it('should create security event successfully', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await service.createSecurityEvent(
        'SUSPICIOUS_ACTIVITY',
        'HIGH',
        'Unusual access pattern detected'
      );

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_security_event', {
        p_event_type: 'SUSPICIOUS_ACTIVITY',
        p_severity: 'HIGH',
        p_description: 'Unusual access pattern detected',
        p_metadata: {},
        p_auto_block: false,
        p_requires_investigation: true,
      });
    });

    it('should create security event with metadata', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const metadata = { source: 'api', endpoint: '/admin/users' };
      const result = await service.createSecurityEvent(
        'API_ABUSE',
        'CRITICAL',
        'Excessive API calls',
        metadata
      );

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_security_event', {
        p_event_type: 'API_ABUSE',
        p_severity: 'CRITICAL',
        p_description: 'Excessive API calls',
        p_metadata: metadata,
        p_auto_block: false,
        p_requires_investigation: true,
      });
    });

    it('should set requires_investigation for CRITICAL severity', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await service.createSecurityEvent('TEST', 'CRITICAL', 'Test');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_security_event',
        expect.objectContaining({
          p_requires_investigation: true,
        })
      );
    });

    it('should set requires_investigation for HIGH severity', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await service.createSecurityEvent('TEST', 'HIGH', 'Test');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_security_event',
        expect.objectContaining({
          p_requires_investigation: true,
        })
      );
    });

    it('should not require investigation for MEDIUM severity', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await service.createSecurityEvent('TEST', 'MEDIUM', 'Test');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_security_event',
        expect.objectContaining({
          p_requires_investigation: false,
        })
      );
    });

    it('should not require investigation for LOW severity', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await service.createSecurityEvent('TEST', 'LOW', 'Test');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_security_event',
        expect.objectContaining({
          p_requires_investigation: false,
        })
      );
    });

    it('should return false on RPC error', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

      const result = await service.createSecurityEvent('TEST', 'LOW', 'Test');

      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      mockSupabase._mocks.mockRpc.mockRejectedValue(new Error('Network error'));

      const result = await service.createSecurityEvent('TEST', 'LOW', 'Test');

      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getExecutiveSummary Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getExecutiveSummary', () => {
    it('should return executive summary with calculated compliance score', async () => {
      const mockMetrics = createMockSecurityMetrics({
        security_events_24h: 100,
        critical_events_24h: 3,
        open_investigations: 2,
        phi_access_24h: 250,
        failed_logins_1h: 5,
      });
      const mockCompliance = [
        createMockComplianceStatus({ status: 'COMPLIANT' }),
        createMockComplianceStatus({ status: 'COMPLIANT' }),
        createMockComplianceStatus({ status: 'NON_COMPLIANT' }),
        createMockComplianceStatus({ status: 'COMPLIANT' }),
      ];

      // Mock getSecurityMetrics
      mockSupabase._mocks.mockSingle.mockResolvedValue({
        data: mockMetrics,
        error: null,
      });

      // Mock getComplianceStatus (via applyLimit)
      mockApplyLimit.mockResolvedValue(mockCompliance);

      const result = await service.getExecutiveSummary();

      expect(result).not.toBeNull();
      expect(result?.totalSecurityEvents).toBe(100);
      expect(result?.criticalEvents).toBe(3);
      expect(result?.openInvestigations).toBe(2);
      expect(result?.phiAccessCount).toBe(250);
      expect(result?.complianceScore).toBe(75); // 3/4 = 75%
    });

    it('should return UP trend when events are high', async () => {
      const mockMetrics = createMockSecurityMetrics({
        failed_logins_1h: 10,
        critical_events_24h: 5,
      });
      const mockCompliance = [createMockComplianceStatus()];

      mockSupabase._mocks.mockSingle.mockResolvedValue({
        data: mockMetrics,
        error: null,
      });
      mockApplyLimit.mockResolvedValue(mockCompliance);

      const result = await service.getExecutiveSummary();

      expect(result?.trendDirection).toBe('UP');
    });

    it('should return DOWN trend when events are low', async () => {
      const mockMetrics = createMockSecurityMetrics({
        failed_logins_1h: 1,
        critical_events_24h: 0,
      });
      const mockCompliance = [createMockComplianceStatus()];

      mockSupabase._mocks.mockSingle.mockResolvedValue({
        data: mockMetrics,
        error: null,
      });
      mockApplyLimit.mockResolvedValue(mockCompliance);

      const result = await service.getExecutiveSummary();

      expect(result?.trendDirection).toBe('DOWN');
    });

    it('should return STABLE trend when events are moderate', async () => {
      const mockMetrics = createMockSecurityMetrics({
        failed_logins_1h: 3,
        critical_events_24h: 3,
      });
      const mockCompliance = [createMockComplianceStatus()];

      mockSupabase._mocks.mockSingle.mockResolvedValue({
        data: mockMetrics,
        error: null,
      });
      mockApplyLimit.mockResolvedValue(mockCompliance);

      const result = await service.getExecutiveSummary();

      expect(result?.trendDirection).toBe('STABLE');
    });

    it('should return 0 compliance score when no controls exist', async () => {
      const mockMetrics = createMockSecurityMetrics();

      mockSupabase._mocks.mockSingle.mockResolvedValue({
        data: mockMetrics,
        error: null,
      });
      mockApplyLimit.mockResolvedValue([]); // No compliance controls

      const result = await service.getExecutiveSummary();

      expect(result?.complianceScore).toBe(0);
    });

    it('should return null when metrics fetch fails', async () => {
      mockSupabase._mocks.mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      const result = await service.getExecutiveSummary();

      expect(result).toBeNull();
    });

    it('should return null on exception', async () => {
      mockSupabase._mocks.mockSingle.mockRejectedValue(new Error('Network error'));

      const result = await service.getExecutiveSummary();

      expect(result).toBeNull();
    });

    it('should calculate 100% compliance when all controls are compliant', async () => {
      const mockMetrics = createMockSecurityMetrics();
      const mockCompliance = [
        createMockComplianceStatus({ status: 'COMPLIANT' }),
        createMockComplianceStatus({ status: 'COMPLIANT' }),
        createMockComplianceStatus({ status: 'COMPLIANT' }),
      ];

      mockSupabase._mocks.mockSingle.mockResolvedValue({
        data: mockMetrics,
        error: null,
      });
      mockApplyLimit.mockResolvedValue(mockCompliance);

      const result = await service.getExecutiveSummary();

      expect(result?.complianceScore).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Factory Function Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createSOC2MonitoringService', () => {
    it('should create a new SOC2MonitoringService instance', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instance = createSOC2MonitoringService(mockSupabase as any);

      expect(instance).toBeInstanceOf(SOC2MonitoringService);
    });

    it('should create functional service that can query data', async () => {
      const mockMetrics = createMockSecurityMetrics();
      mockSupabase._mocks.mockSingle.mockResolvedValue({
        data: mockMetrics,
        error: null,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instance = createSOC2MonitoringService(mockSupabase as any);
      const result = await instance.getSecurityMetrics();

      expect(result).toEqual(mockMetrics);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration Scenarios
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenarios', () => {
    it('should handle full security investigation workflow', async () => {
      // Step 1: Get open security events
      const mockEvents = [
        createMockSecurityEvent({ id: 'event-1', investigated: false, severity: 'CRITICAL' }),
      ];
      mockSupabase._mocks.mockEq.mockResolvedValueOnce({
        data: mockEvents,
        error: null,
      });

      const openEvents = await service.getSecurityEvents({ investigated: false });
      expect(openEvents.length).toBe(1);

      // Step 2: Mark event as investigated
      mockSupabase._mocks.mockGetUser.mockResolvedValue({
        data: { user: { id: 'investigator-123' } },
        error: null,
      });
      mockSupabase._mocks.mockEq.mockResolvedValueOnce({
        data: {},
        error: null,
      });

      const marked = await service.markEventInvestigated('event-1', 'Verified as false positive');
      expect(marked).toBe(true);
    });

    it('should handle compliance dashboard data fetch', async () => {
      const mockMetrics = createMockSecurityMetrics();
      const mockCompliance = [createMockComplianceStatus()];
      const mockEncryption = [createMockEncryptionStatus()];

      mockSupabase._mocks.mockSingle.mockResolvedValue({
        data: mockMetrics,
        error: null,
      });

      // Different calls to applyLimit for different views
      mockApplyLimit
        .mockResolvedValueOnce(mockCompliance)
        .mockResolvedValueOnce(mockEncryption);

      const metrics = await service.getSecurityMetrics();
      const compliance = await service.getComplianceStatus();
      const encryption = await service.getEncryptionStatus();

      expect(metrics).not.toBeNull();
      expect(compliance.length).toBeGreaterThan(0);
      expect(encryption.length).toBeGreaterThan(0);
    });

    it('should handle security event creation and tracking', async () => {
      // Create new security event
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const created = await service.createSecurityEvent(
        'MANUAL_SECURITY_ALERT',
        'HIGH',
        'Security team flagged suspicious activity',
        { flagged_by: 'security-team', ticket_id: 'SEC-123' }
      );

      expect(created).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_security_event', expect.objectContaining({
        p_event_type: 'MANUAL_SECURITY_ALERT',
        p_severity: 'HIGH',
        p_requires_investigation: true,
      }));
    });
  });
});
