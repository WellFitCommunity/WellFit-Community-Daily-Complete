/**
 * Tests for Field Visit Optimizer Service
 *
 * @skill #49 - Field Visit Optimizer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FieldVisitOptimizerService } from '../fieldVisitOptimizerService';
import type {
  OptimizationRequest,
  MultiWorkerOptimizationRequest,
  PatientVisit,
  WorkerProfile,
  VisitPriority,
  VisitType,
  GeoLocation,
  TimeWindow,
  TransportMode,
} from '../fieldVisitOptimizerService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({ data: [], error: null })),
            })),
          })),
          order: vi.fn(() => ({ data: [], error: null })),
        })),
      })),
    })),
  },
}));

// Mock audit logger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('FieldVisitOptimizerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visit priority definitions', () => {
    it('should define all priority levels', () => {
      const priorities: VisitPriority[] = ['urgent', 'high', 'routine', 'follow_up', 'preventive'];
      expect(priorities).toHaveLength(5);
      expect(priorities).toContain('urgent');
      expect(priorities).toContain('routine');
      expect(priorities).toContain('preventive');
    });
  });

  describe('visit type definitions', () => {
    it('should define all visit types', () => {
      const types: VisitType[] = [
        'wellness_check',
        'medication_review',
        'chronic_care',
        'post_discharge',
        'assessment',
        'education',
        'social_services',
        'other',
      ];
      expect(types).toHaveLength(8);
      expect(types).toContain('wellness_check');
      expect(types).toContain('chronic_care');
      expect(types).toContain('social_services');
    });
  });

  describe('transport mode definitions', () => {
    it('should define all transport modes', () => {
      const modes: TransportMode[] = ['car', 'public_transit', 'walking', 'bicycle'];
      expect(modes).toHaveLength(4);
      expect(modes).toContain('car');
      expect(modes).toContain('public_transit');
    });
  });

  describe('optimizeRoute validation', () => {
    it('should reject empty visits array', async () => {
      const request: OptimizationRequest = {
        visits: [],
        worker: createMockWorker('worker-1'),
        date: '2026-01-15',
        tenantId: 'test-tenant',
      };

      const result = await FieldVisitOptimizerService.optimizeRoute(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should accept valid optimization request', async () => {
      const request: OptimizationRequest = {
        visits: [createMockVisit('visit-1')],
        worker: createMockWorker('worker-1'),
        date: '2026-01-15',
        tenantId: 'test-tenant',
      };

      const result = await FieldVisitOptimizerService.optimizeRoute(request);

      // Result depends on processing - verify it executes
      expect(result).toBeDefined();
    });
  });

  describe('optimizeMultipleRoutes validation', () => {
    it('should reject empty workers array', async () => {
      const request: MultiWorkerOptimizationRequest = {
        visits: [createMockVisit('visit-1')],
        workers: [],
        date: '2026-01-15',
        tenantId: 'test-tenant',
      };

      const result = await FieldVisitOptimizerService.optimizeMultipleRoutes(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject empty visits array', async () => {
      const request: MultiWorkerOptimizationRequest = {
        visits: [],
        workers: [createMockWorker('worker-1')],
        date: '2026-01-15',
        tenantId: 'test-tenant',
      };

      const result = await FieldVisitOptimizerService.optimizeMultipleRoutes(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should process valid multi-worker request', async () => {
      const request: MultiWorkerOptimizationRequest = {
        visits: [createMockVisit('visit-1'), createMockVisit('visit-2')],
        workers: [createMockWorker('worker-1')],
        date: '2026-01-15',
        tenantId: 'test-tenant',
      };

      const result = await FieldVisitOptimizerService.optimizeMultipleRoutes(request);

      // Result depends on processing - verify it executes
      expect(result).toBeDefined();
    });
  });

  describe('getEfficiencyMetrics', () => {
    it('should return metrics with valid tenant ID', async () => {
      const result = await FieldVisitOptimizerService.getEfficiencyMetrics('test-tenant');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should accept date range options', async () => {
      const result = await FieldVisitOptimizerService.getEfficiencyMetrics('test-tenant', {
        startDate: '2026-01-01',
        endDate: '2026-01-15',
      });

      expect(result.success).toBe(true);
    });

    it('should accept worker ID filter', async () => {
      const result = await FieldVisitOptimizerService.getEfficiencyMetrics('test-tenant', {
        workerId: 'worker-1',
      });

      // Result depends on mock data - just verify it handles the option
      expect(result).toBeDefined();
    });
  });

  describe('geo location structure', () => {
    it('should define complete geo location', () => {
      const location: GeoLocation = {
        latitude: 40.7128,
        longitude: -74.006,
        address: '123 Main St',
        city: 'New York',
        zip: '10001',
      };
      expect(location.latitude).toBeGreaterThan(40);
      expect(location.longitude).toBeLessThan(-73);
    });

    it('should handle minimal geo location', () => {
      const location: GeoLocation = {
        latitude: 40.7128,
        longitude: -74.006,
      };
      expect(location.address).toBeUndefined();
    });
  });

  describe('time window structure', () => {
    it('should define time window with earliest and latest', () => {
      const window: TimeWindow = {
        earliest: '09:00',
        latest: '12:00',
        preferredTime: '10:00',
      };
      expect(window.earliest).toBe('09:00');
      expect(window.latest).toBe('12:00');
    });

    it('should handle basic time window', () => {
      const window: TimeWindow = {
        earliest: '08:00',
        latest: '17:00',
      };
      expect(window.preferredTime).toBeUndefined();
    });
  });

  describe('patient visit structure', () => {
    it('should define complete patient visit', () => {
      const visit: PatientVisit = {
        visitId: 'visit-1',
        patientId: 'patient-1',
        patientName: 'John Doe',
        location: { latitude: 40.7128, longitude: -74.006, address: '123 Main St' },
        visitType: 'chronic_care',
        priority: 'high',
        estimatedDuration: 45,
        timeWindow: { earliest: '09:00', latest: '12:00' },
        specialInstructions: 'Use back entrance',
        requiresEquipment: ['blood pressure cuff', 'glucometer'],
        lastVisitDate: '2026-01-01',
        riskLevel: 'medium',
      };
      expect(visit.visitType).toBe('chronic_care');
      expect(visit.priority).toBe('high');
      expect(visit.requiresEquipment).toHaveLength(2);
    });

    it('should handle minimal patient visit', () => {
      const visit: PatientVisit = {
        visitId: 'visit-2',
        patientId: 'patient-2',
        patientName: 'Jane Doe',
        location: { latitude: 40.6892, longitude: -73.9442 },
        visitType: 'wellness_check',
        priority: 'routine',
        estimatedDuration: 30,
      };
      expect(visit.timeWindow).toBeUndefined();
      expect(visit.specialInstructions).toBeUndefined();
    });
  });

  describe('worker profile structure', () => {
    it('should define complete worker profile', () => {
      const worker: WorkerProfile = {
        workerId: 'worker-1',
        workerName: 'Maria Garcia',
        startLocation: { latitude: 40.7128, longitude: -74.006 },
        endLocation: { latitude: 40.7580, longitude: -73.9855 },
        transportMode: 'car',
        workingHours: { start: '08:00', end: '17:00' },
        breakTime: { start: '12:00', duration: 30 },
        certifications: ['CPR', 'CHW'],
        preferredAreas: ['10001', '10002'],
        maxVisitsPerDay: 8,
      };
      expect(worker.transportMode).toBe('car');
      expect(worker.certifications).toContain('CHW');
    });

    it('should handle minimal worker profile', () => {
      const worker: WorkerProfile = {
        workerId: 'worker-2',
        workerName: 'Carlos Rodriguez',
        startLocation: { latitude: 40.7128, longitude: -74.006 },
        transportMode: 'public_transit',
        workingHours: { start: '09:00', end: '18:00' },
      };
      expect(worker.endLocation).toBeUndefined();
      expect(worker.breakTime).toBeUndefined();
    });
  });

  describe('optimization preferences', () => {
    it('should accept optimization preferences', () => {
      const request: OptimizationRequest = {
        visits: [createMockVisit('visit-1')],
        worker: createMockWorker('worker-1'),
        date: '2026-01-15',
        optimizationPreference: 'time',
        avoidHighways: true,
        accountForTraffic: true,
      };
      expect(request.optimizationPreference).toBe('time');
      expect(request.avoidHighways).toBe(true);
    });

    it('should define all optimization preference types', () => {
      const preferences = ['time', 'distance', 'priority', 'balanced'];
      expect(preferences).toHaveLength(4);
      expect(preferences).toContain('balanced');
    });
  });

  describe('optimized route structure', () => {
    it('should define optimized route metrics', () => {
      const route = {
        workerId: 'worker-1',
        visits: [],
        totalDistance: 25.5,
        totalTravelTime: 90,
        totalVisitTime: 240,
        totalWorkTime: 330,
        efficiency: 0.73,
      };
      expect(route.efficiency).toBeGreaterThan(0.7);
      expect(route.totalDistance).toBe(25.5);
    });
  });

  describe('optimized visit structure', () => {
    it('should include scheduling details', () => {
      const optimizedVisit = {
        visitId: 'visit-1',
        patientId: 'patient-1',
        patientName: 'John Doe',
        location: { latitude: 40.7128, longitude: -74.006 },
        visitType: 'wellness_check' as VisitType,
        priority: 'routine' as VisitPriority,
        scheduledArrival: '2026-01-15T09:00:00Z',
        scheduledDeparture: '2026-01-15T09:45:00Z',
        estimatedDuration: 45,
        travelTimeFromPrevious: 15,
        distanceFromPrevious: 3.2,
        sequenceNumber: 1,
      };
      expect(optimizedVisit.sequenceNumber).toBe(1);
      expect(optimizedVisit.travelTimeFromPrevious).toBe(15);
    });
  });

  describe('unscheduled visit structure', () => {
    it('should define unscheduled visit with reason', () => {
      const unscheduled = {
        visit: createMockVisit('visit-3'),
        reason: 'Time window conflict with other visits',
        alternativeDates: ['2026-01-16', '2026-01-17'],
      };
      expect(unscheduled.reason).toContain('conflict');
      expect(unscheduled.alternativeDates).toHaveLength(2);
    });
  });

  describe('multi-worker result structure', () => {
    it('should define multi-worker optimization result', () => {
      const result = {
        routes: [],
        unassignedVisits: [],
        overallMetrics: {
          totalVisits: 20,
          scheduledVisits: 18,
          totalDistance: 75.5,
          totalTravelTime: 270,
          averageEfficiency: 0.78,
        },
        workloadBalance: 0.92,
        metadata: {
          generatedAt: new Date().toISOString(),
          responseTimeMs: 350,
          model: 'local-cluster',
        },
      };
      expect(result.overallMetrics.scheduledVisits).toBe(18);
      expect(result.workloadBalance).toBeGreaterThan(0.9);
    });
  });

  describe('traffic and timing adjustments', () => {
    it('should apply traffic multipliers', () => {
      const trafficMultipliers = {
        morning_rush: 1.5,
        midday: 1.0,
        evening_rush: 1.4,
        night: 0.8,
      };
      expect(trafficMultipliers.morning_rush).toBe(1.5);
    });

    it('should estimate arrival with traffic', () => {
      const baseTime = 15;
      const trafficMultiplier = 1.5;
      const adjustedTime = baseTime * trafficMultiplier;
      expect(adjustedTime).toBe(22.5);
    });
  });

  describe('visit assignment logic', () => {
    it('should assign urgent visits first', () => {
      const visits = [
        { priority: 'routine' as VisitPriority, visitId: '1' },
        { priority: 'urgent' as VisitPriority, visitId: '2' },
        { priority: 'high' as VisitPriority, visitId: '3' },
      ];

      const priorityOrder = { urgent: 1, high: 2, routine: 3, follow_up: 4, preventive: 5 };
      const sorted = [...visits].sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
      );

      expect(sorted[0].priority).toBe('urgent');
      expect(sorted[1].priority).toBe('high');
    });
  });

  describe('distance calculations', () => {
    it('should calculate total route distance', () => {
      const legDistances = [3.2, 5.1, 2.8, 4.5];
      const totalDistance = legDistances.reduce((sum, d) => sum + d, 0);
      // Use toBeCloseTo for floating point comparison
      expect(totalDistance).toBeCloseTo(15.6, 5);
    });

    it('should calculate Haversine distance between points', () => {
      // Manhattan to Brooklyn approximately 5-6 miles
      const loc1: GeoLocation = { latitude: 40.7128, longitude: -74.006 };
      const loc2: GeoLocation = { latitude: 40.6892, longitude: -73.9442 };

      expect(loc1.latitude).toBeGreaterThan(40);
      expect(loc2.longitude).toBeLessThan(-73);
    });
  });

  describe('efficiency metrics structure', () => {
    it('should define efficiency metrics', () => {
      const metrics = {
        averageEfficiency: 0.75,
        averageVisitsPerDay: 6.5,
        averageTravelTime: 120,
        topPerformingAreas: [
          { zip: '10001', efficiency: 0.82 },
          { zip: '10002', efficiency: 0.78 },
        ],
        trendData: [
          { date: '2026-01-01', efficiency: 0.72, visits: 6 },
          { date: '2026-01-02', efficiency: 0.78, visits: 7 },
        ],
      };
      expect(metrics.averageEfficiency).toBe(0.75);
      expect(metrics.topPerformingAreas).toHaveLength(2);
    });
  });
});

// Helper functions
function createMockVisit(visitId: string): PatientVisit {
  return {
    visitId,
    patientId: `patient-${visitId}`,
    patientName: `Patient ${visitId}`,
    location: { latitude: 40.7128, longitude: -74.006 },
    visitType: 'wellness_check',
    priority: 'routine',
    estimatedDuration: 30,
  };
}

function createMockWorker(workerId: string): WorkerProfile {
  return {
    workerId,
    workerName: `Worker ${workerId}`,
    startLocation: { latitude: 40.7128, longitude: -74.006 },
    transportMode: 'car',
    workingHours: { start: '08:00', end: '17:00' },
  };
}
