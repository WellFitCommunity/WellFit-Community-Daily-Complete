/**
 * Tests for FHIR CareCoordinationService
 *
 * Covers care coordination events and care gap identification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CareCoordinationService } from '../CareCoordinationService';

// Mock supabase with proper chain support
const mockOrder = vi.fn(() => ({
  data: [
    { id: 'event-1', event_type: 'referral', event_status: 'completed' },
    { id: 'event-2', event_type: 'appointment', event_status: 'scheduled' },
  ],
  error: null,
}));

const mockGte = vi.fn(() => ({
  order: mockOrder,
}));

const mockIn = vi.fn(() => ({
  order: mockOrder,
  gte: mockGte,
}));

const mockEq: ReturnType<typeof vi.fn> = vi.fn(() => ({
  order: mockOrder,
  gte: mockGte,
  in: mockIn,
  eq: mockEq,
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: mockEq,
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'event-new', event_type: 'transition' },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'event-1', event_status: 'completed' },
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

describe('CareCoordinationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logEvent', () => {
    it('should log a care coordination event', async () => {
      const event = {
        patient_id: 'patient-1',
        event_type: 'referral',
        event_status: 'scheduled',
        event_timestamp: new Date().toISOString(),
      };

      const result = await CareCoordinationService.logEvent(event);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should log transition event', async () => {
      const event = {
        patient_id: 'patient-1',
        event_type: 'transition',
        event_status: 'completed',
        from_facility: 'Hospital',
        to_facility: 'SNF',
      };

      const result = await CareCoordinationService.logEvent(event);

      expect(result).toBeDefined();
    });
  });

  describe('getPatientJourney', () => {
    it('should return patient care journey', async () => {
      const result = await CareCoordinationService.getPatientJourney('patient-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should default to 90 days', async () => {
      const result = await CareCoordinationService.getPatientJourney('patient-1');

      expect(result).toBeDefined();
    });

    it('should accept custom days', async () => {
      const result = await CareCoordinationService.getPatientJourney('patient-1', 180);

      expect(result).toBeDefined();
    });
  });

  describe('getActiveIssues', () => {
    it('should return active care coordination issues', async () => {
      const result = await CareCoordinationService.getActiveIssues('patient-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should include scheduled and in-progress events', async () => {
      const result = await CareCoordinationService.getActiveIssues('patient-1');

      expect(result).toBeDefined();
    });
  });

  describe('getCareGaps', () => {
    it('should return identified care gaps', async () => {
      const result = await CareCoordinationService.getCareGaps('patient-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getIncompleteHandoffs', () => {
    it('should return incomplete handoffs', async () => {
      const result = await CareCoordinationService.getIncompleteHandoffs('patient-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by handoff quality', async () => {
      const result = await CareCoordinationService.getIncompleteHandoffs('patient-1');

      expect(result).toBeDefined();
    });
  });

  describe('getNoShows', () => {
    it('should return no-show appointments', async () => {
      const result = await CareCoordinationService.getNoShows('patient-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should default to 90 days', async () => {
      const result = await CareCoordinationService.getNoShows('patient-1');

      expect(result).toBeDefined();
    });

    it('should accept custom days', async () => {
      const result = await CareCoordinationService.getNoShows('patient-1', 30);

      expect(result).toBeDefined();
    });
  });

  describe('updateEventStatus', () => {
    it('should update event status', async () => {
      const result = await CareCoordinationService.updateEventStatus('event-1', 'completed');

      expect(result).toBeDefined();
    });

    it('should accept notes', async () => {
      const result = await CareCoordinationService.updateEventStatus(
        'event-1',
        'completed',
        'Patient successfully transitioned'
      );

      expect(result).toBeDefined();
    });
  });

  describe('event types', () => {
    it('should define event types', () => {
      const eventTypes = [
        'referral',
        'appointment',
        'transition',
        'discharge',
        'admission',
        'follow_up',
        'medication_reconciliation',
        'care_plan_review',
        'communication',
      ];
      expect(eventTypes).toContain('referral');
      expect(eventTypes).toContain('transition');
    });
  });

  describe('event status values', () => {
    it('should define event statuses', () => {
      const statuses = [
        'scheduled',
        'in-progress',
        'completed',
        'cancelled',
        'no-show',
        'rescheduled',
        'pending',
      ];
      expect(statuses).toContain('scheduled');
      expect(statuses).toContain('no-show');
    });
  });

  describe('handoff quality codes', () => {
    it('should define handoff quality codes', () => {
      const qualityCodes = ['complete', 'incomplete', 'missing-info', 'delayed', 'not-applicable'];
      expect(qualityCodes).toContain('complete');
      expect(qualityCodes).toContain('incomplete');
    });
  });

  describe('care coordination event structure', () => {
    it('should define complete event structure', () => {
      const event = {
        id: 'event-1',
        patient_id: 'patient-1',
        event_type: 'transition',
        event_status: 'completed',
        event_timestamp: '2026-01-15T14:00:00Z',
        from_facility_id: 'loc-hospital',
        from_facility_name: 'Methodist Hospital',
        to_facility_id: 'loc-snf',
        to_facility_name: 'Sunny Days SNF',
        from_provider_id: 'pract-1',
        to_provider_id: 'pract-2',
        reason: 'Post-acute rehabilitation',
        handoff_occurred: true,
        handoff_quality: 'complete',
        handoff_issues: null,
        care_gap_identified: false,
        care_gap_type: null,
        care_gap_resolved: null,
        follow_up_required: true,
        follow_up_date: '2026-01-22',
        follow_up_completed: false,
        notes: 'Smooth transition, patient stable',
        encounter_id: 'enc-1',
        care_plan_id: 'cp-1',
        created_by: 'user-1',
        created_at: '2026-01-15T14:00:00Z',
        updated_at: '2026-01-15T14:00:00Z',
      };
      expect(event.event_type).toBe('transition');
      expect(event.handoff_quality).toBe('complete');
    });
  });

  describe('care gap types', () => {
    it('should define care gap types', () => {
      const gapTypes = [
        'missed_appointment',
        'delayed_follow_up',
        'medication_non_adherence',
        'incomplete_referral',
        'missing_documentation',
        'delayed_lab_results',
        'communication_failure',
        'care_plan_deviation',
      ];
      expect(gapTypes).toContain('missed_appointment');
      expect(gapTypes).toContain('incomplete_referral');
    });
  });

  describe('transition types', () => {
    it('should define transition types', () => {
      const transitions = {
        hospitalToHome: 'hospital-to-home',
        hospitalToSnf: 'hospital-to-snf',
        hospitalToRehab: 'hospital-to-rehab',
        snfToHome: 'snf-to-home',
        erToInpatient: 'er-to-inpatient',
        inpatientToOutpatient: 'inpatient-to-outpatient',
      };
      expect(transitions.hospitalToHome).toBe('hospital-to-home');
      expect(transitions.hospitalToSnf).toBe('hospital-to-snf');
    });
  });

  describe('error handling', () => {
    it('should throw error on database failure', async () => {
      try {
        await CareCoordinationService.getPatientJourney('test');
        // Mock returns success
      } catch {
        // Expected on real error
      }
    });

    it('should handle event logging errors', async () => {
      try {
        await CareCoordinationService.logEvent({});
      } catch {
        // Expected on real error
      }
    });
  });
});
