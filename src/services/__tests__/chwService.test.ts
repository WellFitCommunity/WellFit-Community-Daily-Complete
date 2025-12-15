import { type Mock } from 'vitest';
/**
 * CHW Service Test Suite
 * Comprehensive tests for Community Health Worker kiosk operations
 * Focus: Critical vitals validation, SDOH scoring, offline sync, HIPAA compliance
 */

import { CHWService, VitalsData, SDOHData } from '../chwService';
import { supabase } from '../../lib/supabaseClient';
import { offlineSync } from '../specialist-workflow-engine/OfflineDataSync';

// Mock dependencies
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../specialist-workflow-engine/OfflineDataSync', () => ({
  offlineSync: {
    initialize: vi.fn(),
    startAutoSync: vi.fn(),
    saveOffline: vi.fn(),
    syncAll: vi.fn(),
    getSyncStatus: vi.fn(),
  },
}));

describe('CHWService', () => {
  let chwService: CHWService;
  let mockSupabaseFrom: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    chwService = new CHWService();
    mockSupabaseFrom = vi.fn();
    (supabase.from as ReturnType<typeof vi.fn>) = mockSupabaseFrom;
  });

  describe('Initialize', () => {
    it('should initialize offline sync on service creation', async () => {
      await chwService.initialize();

      expect(offlineSync.initialize).toHaveBeenCalledTimes(1);
      expect(offlineSync.startAutoSync).toHaveBeenCalledWith(30000);
    });
  });

  describe('Critical Vitals Validation - HIPAA Safety Critical', () => {
    describe('Blood Pressure - Critical High (>180 systolic)', () => {
      it('should generate CRITICAL alert for systolic BP > 180', () => {
        const vitals: VitalsData = {
          systolic: 190,
          diastolic: 100,
          captured_at: new Date().toISOString(),
        };

        const alerts = (chwService as any).validateVitals(vitals);

        expect(alerts).toHaveLength(1);
        expect(alerts[0].severity).toBe('critical');
        expect(alerts[0].alert_rule_id).toBe('critical-bp-high');
        expect(alerts[0].notify_role).toBe('physician');
        expect(alerts[0].message).toContain('190/100');
        expect(alerts[0].message).toContain('Immediate physician review required');
      });

      it('should generate CRITICAL alert for systolic BP exactly 181', () => {
        const vitals: VitalsData = {
          systolic: 181,
          diastolic: 95,
          captured_at: new Date().toISOString(),
        };

        const alerts = (chwService as any).validateVitals(vitals);

        expect(alerts.length).toBeGreaterThanOrEqual(1);
        const criticalAlert = alerts.find((a: any) => a.alert_rule_id === 'critical-bp-high');
        expect(criticalAlert).toBeDefined();
        expect(criticalAlert?.severity).toBe('critical');
      });

      it('should NOT generate critical-bp-high alert for systolic BP = 180', () => {
        const vitals: VitalsData = {
          systolic: 180,
          diastolic: 95,
          captured_at: new Date().toISOString(),
        };

        const alerts = (chwService as any).validateVitals(vitals);

        const criticalHighAlert = alerts.find((a: any) => a.alert_rule_id === 'critical-bp-high');
        expect(criticalHighAlert).toBeUndefined();
      });
    });

    describe('Blood Pressure - Critical Low (<90 systolic)', () => {
      it('should generate CRITICAL alert for systolic BP < 90 (shock risk)', () => {
        const vitals: VitalsData = {
          systolic: 85,
          diastolic: 55,
          captured_at: new Date().toISOString(),
        };

        const alerts = (chwService as any).validateVitals(vitals);

        expect(alerts.length).toBeGreaterThanOrEqual(1);
        const shockAlert = alerts.find((a: any) => a.alert_rule_id === 'critical-bp-low');
        expect(shockAlert).toBeDefined();
        expect(shockAlert?.severity).toBe('critical');
        expect(shockAlert?.message).toContain('shock');
        expect(shockAlert?.notify_role).toBe('physician');
      });

      it('should generate CRITICAL alert for systolic BP exactly 89', () => {
        const vitals: VitalsData = {
          systolic: 89,
          diastolic: 60,
          captured_at: new Date().toISOString(),
        };

        const alerts = (chwService as any).validateVitals(vitals);

        const criticalLowAlert = alerts.find((a: any) => a.alert_rule_id === 'critical-bp-low');
        expect(criticalLowAlert).toBeDefined();
      });

      it('should NOT generate critical-bp-low alert for systolic BP = 90', () => {
        const vitals: VitalsData = {
          systolic: 90,
          diastolic: 60,
          captured_at: new Date().toISOString(),
        };

        const alerts = (chwService as any).validateVitals(vitals);

        const criticalLowAlert = alerts.find((a: any) => a.alert_rule_id === 'critical-bp-low');
        expect(criticalLowAlert).toBeUndefined();
      });
    });

    describe('Oxygen Saturation - Critical Low (<88%)', () => {
      it('should generate CRITICAL alert for O2 saturation < 88%', () => {
        const vitals: VitalsData = {
          oxygen_saturation: 85,
          captured_at: new Date().toISOString(),
        };

        const alerts = (chwService as any).validateVitals(vitals);

        expect(alerts.length).toBeGreaterThanOrEqual(1);
        const o2Alert = alerts.find((a: any) => a.alert_rule_id === 'critical-o2-low');
        expect(o2Alert).toBeDefined();
        expect(o2Alert?.severity).toBe('critical');
        expect(o2Alert?.message).toContain('85%');
        expect(o2Alert?.message).toContain('Immediate intervention needed');
      });

      it('should generate CRITICAL alert for O2 saturation exactly 87%', () => {
        const vitals: VitalsData = {
          oxygen_saturation: 87,
          captured_at: new Date().toISOString(),
        };

        const alerts = (chwService as any).validateVitals(vitals);

        const o2Alert = alerts.find((a: any) => a.alert_rule_id === 'critical-o2-low');
        expect(o2Alert).toBeDefined();
      });

      it('should NOT generate critical O2 alert for saturation = 88%', () => {
        const vitals: VitalsData = {
          oxygen_saturation: 88,
          captured_at: new Date().toISOString(),
        };

        const alerts = (chwService as any).validateVitals(vitals);

        const o2Alert = alerts.find((a: any) => a.alert_rule_id === 'critical-o2-low');
        expect(o2Alert).toBeUndefined();
      });
    });

    describe('Blood Pressure - Elevated (161-180 systolic)', () => {
      it('should generate HIGH severity alert for systolic BP between 161-180', () => {
        const vitals: VitalsData = {
          systolic: 165,
          diastolic: 95,
          captured_at: new Date().toISOString(),
        };

        const alerts = (chwService as any).validateVitals(vitals);

        const elevatedAlert = alerts.find((a: any) => a.alert_rule_id === 'high-bp-elevated');
        expect(elevatedAlert).toBeDefined();
        expect(elevatedAlert?.severity).toBe('high');
        expect(elevatedAlert?.message).toContain('within 4 hours');
      });

      it('should generate HIGH alert for systolic BP exactly 161', () => {
        const vitals: VitalsData = {
          systolic: 161,
          diastolic: 90,
          captured_at: new Date().toISOString(),
        };

        const alerts = (chwService as any).validateVitals(vitals);

        const elevatedAlert = alerts.find((a: any) => a.alert_rule_id === 'high-bp-elevated');
        expect(elevatedAlert).toBeDefined();
      });

      it('should NOT generate elevated alert for systolic BP = 160', () => {
        const vitals: VitalsData = {
          systolic: 160,
          diastolic: 90,
          captured_at: new Date().toISOString(),
        };

        const alerts = (chwService as any).validateVitals(vitals);

        const elevatedAlert = alerts.find((a: any) => a.alert_rule_id === 'high-bp-elevated');
        expect(elevatedAlert).toBeUndefined();
      });
    });

    describe('Multiple Simultaneous Critical Values', () => {
      it('should generate multiple alerts when multiple critical values present', () => {
        const vitals: VitalsData = {
          systolic: 85, // Critical low
          diastolic: 50,
          oxygen_saturation: 85, // Critical low
          captured_at: new Date().toISOString(),
        };

        const alerts = (chwService as any).validateVitals(vitals);

        expect(alerts.length).toBeGreaterThanOrEqual(2);
        const bpAlert = alerts.find((a: any) => a.alert_rule_id === 'critical-bp-low');
        const o2Alert = alerts.find((a: any) => a.alert_rule_id === 'critical-o2-low');
        expect(bpAlert).toBeDefined();
        expect(o2Alert).toBeDefined();
      });
    });

    describe('Normal Vitals - No Alerts', () => {
      it('should NOT generate alerts for normal vitals', () => {
        const vitals: VitalsData = {
          systolic: 120,
          diastolic: 80,
          heart_rate: 72,
          oxygen_saturation: 98,
          temperature: 98.6,
          captured_at: new Date().toISOString(),
        };

        const alerts = (chwService as any).validateVitals(vitals);

        expect(alerts).toHaveLength(0);
      });
    });

    describe('Alert Data Integrity - HIPAA Audit Trail', () => {
      it('should include all required fields for HIPAA audit compliance', () => {
        const vitals: VitalsData = {
          systolic: 190,
          diastolic: 100,
          captured_at: new Date().toISOString(),
        };

        const alerts = (chwService as any).validateVitals(vitals);

        expect(alerts[0]).toHaveProperty('id');
        expect(alerts[0]).toHaveProperty('triggered_at');
        expect(alerts[0]).toHaveProperty('triggered_by');
        expect(alerts[0]).toHaveProperty('severity');
        expect(alerts[0]).toHaveProperty('notify_role');
        expect(alerts[0]).toHaveProperty('message');
        expect(alerts[0].triggered_by).toEqual({ vitals });
      });
    });
  });

  describe('SDOH Risk Score Calculation', () => {
    it('should calculate risk score of 0 for no barriers', () => {
      const sdoh: SDOHData = {
        food_insecurity: false,
        food_worry: false,
        housing_worry: false,
        transportation_barrier: false,
        utility_shutoff_threat: false,
        financial_strain: false,
        safety_concerns: false,
        social_isolation_frequency: 'never',
        assessed_at: new Date().toISOString(),
      };

      const score = (chwService as any).calculateSDOHRiskScore(sdoh);

      expect(score).toBe(0);
    });

    it('should calculate maximum risk score correctly (capped at 10)', () => {
      const sdoh: SDOHData = {
        food_insecurity: true, // +2
        food_worry: true, // +1
        housing_worry: true, // +2
        transportation_barrier: true, // +1
        utility_shutoff_threat: true, // +2
        financial_strain: true, // +1
        safety_concerns: true, // +2
        social_isolation_frequency: 'always', // +1
        assessed_at: new Date().toISOString(),
      };

      const score = (chwService as any).calculateSDOHRiskScore(sdoh);

      // Total would be 12, but should cap at 10
      expect(score).toBe(10);
    });

    it('should calculate moderate risk score correctly', () => {
      const sdoh: SDOHData = {
        food_insecurity: true, // +2
        transportation_barrier: true, // +1
        financial_strain: true, // +1
        assessed_at: new Date().toISOString(),
      };

      const score = (chwService as any).calculateSDOHRiskScore(sdoh);

      expect(score).toBe(4);
    });

    it('should weight high-impact factors correctly', () => {
      const sdoh: SDOHData = {
        food_insecurity: true, // +2 (high impact)
        housing_worry: true, // +2 (high impact)
        safety_concerns: true, // +2 (high impact)
        assessed_at: new Date().toISOString(),
      };

      const score = (chwService as any).calculateSDOHRiskScore(sdoh);

      expect(score).toBe(6);
    });

    it('should count social isolation correctly based on frequency', () => {
      const alwaysIsolated: SDOHData = {
        social_isolation_frequency: 'always',
        assessed_at: new Date().toISOString(),
      };

      const oftenIsolated: SDOHData = {
        social_isolation_frequency: 'often',
        assessed_at: new Date().toISOString(),
      };

      const sometimesIsolated: SDOHData = {
        social_isolation_frequency: 'sometimes',
        assessed_at: new Date().toISOString(),
      };

      expect((chwService as any).calculateSDOHRiskScore(alwaysIsolated)).toBe(1);
      expect((chwService as any).calculateSDOHRiskScore(oftenIsolated)).toBe(1);
      expect((chwService as any).calculateSDOHRiskScore(sometimesIsolated)).toBe(0);
    });
  });

  describe('SDOH Barrier Count', () => {
    it('should count zero barriers correctly', () => {
      const sdoh: SDOHData = {
        assessed_at: new Date().toISOString(),
      };

      const count = (chwService as any).countSDOHBarriers(sdoh);

      expect(count).toBe(0);
    });

    it('should count all major barriers', () => {
      const sdoh: SDOHData = {
        food_insecurity: true,
        housing_worry: true,
        transportation_barrier: true,
        utility_shutoff_threat: true,
        financial_strain: true,
        safety_concerns: true,
        assessed_at: new Date().toISOString(),
      };

      const count = (chwService as any).countSDOHBarriers(sdoh);

      expect(count).toBe(6);
    });
  });

  describe('SDOH Alert Generation', () => {
    it('should generate food insecurity alert with correct severity and role', () => {
      const sdoh: SDOHData = {
        food_insecurity: true,
        assessed_at: new Date().toISOString(),
      };

      const alerts = (chwService as any).generateSDOHAlerts('visit-123', sdoh);

      const foodAlert = alerts.find((a: any) => a.alert_rule_id === 'food-insecurity');
      expect(foodAlert).toBeDefined();
      expect(foodAlert?.severity).toBe('medium');
      expect(foodAlert?.notify_role).toBe('case_manager');
      expect(foodAlert?.message).toContain('food resources');
    });

    it('should generate housing instability alert with HIGH severity', () => {
      const sdoh: SDOHData = {
        housing_worry: true,
        assessed_at: new Date().toISOString(),
      };

      const alerts = (chwService as any).generateSDOHAlerts('visit-123', sdoh);

      const housingAlert = alerts.find((a: any) => a.alert_rule_id === 'housing-unstable');
      expect(housingAlert).toBeDefined();
      expect(housingAlert?.severity).toBe('high');
      expect(housingAlert?.notify_role).toBe('case_manager');
      expect(housingAlert?.message).toContain('Urgent case management');
    });

    it('should generate safety concern alert with CRITICAL severity', () => {
      const sdoh: SDOHData = {
        safety_concerns: true,
        assessed_at: new Date().toISOString(),
      };

      const alerts = (chwService as any).generateSDOHAlerts('visit-123', sdoh);

      const safetyAlert = alerts.find((a: any) => a.alert_rule_id === 'safety-concern');
      expect(safetyAlert).toBeDefined();
      expect(safetyAlert?.severity).toBe('critical');
      expect(safetyAlert?.notify_role).toBe('case_manager');
      expect(safetyAlert?.message).toContain('Immediate intervention required');
    });

    it('should generate no alerts for no SDOH issues', () => {
      const sdoh: SDOHData = {
        food_insecurity: false,
        housing_worry: false,
        safety_concerns: false,
        assessed_at: new Date().toISOString(),
      };

      const alerts = (chwService as any).generateSDOHAlerts('visit-123', sdoh);

      expect(alerts).toHaveLength(0);
    });

    it('should include visit_id in all generated alerts', () => {
      const sdoh: SDOHData = {
        food_insecurity: true,
        housing_worry: true,
        safety_concerns: true,
        assessed_at: new Date().toISOString(),
      };

      const alerts = (chwService as any).generateSDOHAlerts('visit-xyz-789', sdoh);

      expect(alerts.length).toBe(3);
      alerts.forEach((alert: any) => {
        expect(alert.visit_id).toBe('visit-xyz-789');
      });
    });
  });

  describe('Offline Data Handling - Network Resilience', () => {
    it('should save data offline when navigator.onLine is false', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      // Mock supabase to provide select and insert methods for offline scenario
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { patient_id: 'patient-123' }, error: null })
        })
      });

      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseFrom.mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
      });

      const visitId = 'offline-visit-123';
      const vitals: VitalsData = {
        systolic: 120,
        diastolic: 80,
        captured_at: new Date().toISOString(),
      };

      await chwService.captureVitals(visitId, vitals);

      expect(offlineSync.saveOffline).toHaveBeenCalled();
    });

    it('should attempt server save when online', async () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { patient_id: 'patient-123' }, error: null })
        })
      });

      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseFrom.mockReturnValue({
        update: mockUpdate,
        select: mockSelect,
        insert: mockInsert,
      });

      const visitId = 'online-visit-123';
      const vitals: VitalsData = {
        systolic: 120,
        diastolic: 80,
        captured_at: new Date().toISOString(),
      };

      await chwService.captureVitals(visitId, vitals);

      expect(mockSupabaseFrom).toHaveBeenCalledWith('field_visits');
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('UUID Generation', () => {
    it('should generate valid UUID format', () => {
      const uuid = (chwService as any).generateUUID();

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = (chwService as any).generateUUID();
      const uuid2 = (chwService as any).generateUUID();
      const uuid3 = (chwService as any).generateUUID();

      expect(uuid1).not.toBe(uuid2);
      expect(uuid2).not.toBe(uuid3);
      expect(uuid1).not.toBe(uuid3);
    });
  });

  describe('Sync Status', () => {
    it('should return pending sync status', async () => {
      const mockStatus = {
        pending: {
          visits: 3,
          assessments: 2,
          photos: 5,
          alerts: 1,
        },
        lastSync: Date.now() - 60000,
      };

      (offlineSync.getSyncStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatus);

      const status = await chwService.getSyncStatus();

      expect(status).toEqual(mockStatus);
      expect(offlineSync.getSyncStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('Manual Sync', () => {
    it('should trigger manual sync and return results', async () => {
      const mockSyncResult = {
        visits: 3,
        assessments: 2,
        photos: 5,
        alerts: 1,
        errors: [],
      };

      (offlineSync.syncAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockSyncResult);

      const result = await chwService.syncOfflineData();

      expect(result).toEqual(mockSyncResult);
      expect(offlineSync.syncAll).toHaveBeenCalledTimes(1);
    });
  });
});
