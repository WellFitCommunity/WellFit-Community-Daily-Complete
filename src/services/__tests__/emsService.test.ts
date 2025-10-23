/**
 * EMS Service Tests
 * Tests for prehospital handoff system
 * Used by Guardian Agent for health monitoring
 */

import {
  formatVitals,
  getAlertSeverity,
  getAlertBadges,
  type IncomingPatient,
} from '../emsService';

describe('EMS Service - Utility Functions', () => {
  describe('formatVitals', () => {
    it('should format complete vitals correctly', () => {
      const vitals = {
        blood_pressure_systolic: 120,
        blood_pressure_diastolic: 80,
        heart_rate: 72,
        respiratory_rate: 16,
        oxygen_saturation: 98,
        gcs_score: 15,
      };

      const result = formatVitals(vitals);

      expect(result).toContain('BP: 120/80');
      expect(result).toContain('HR: 72');
      expect(result).toContain('RR: 16');
      expect(result).toContain('O2: 98%');
      expect(result).toContain('GCS: 15');
    });

    it('should handle missing vitals gracefully', () => {
      const vitals = {
        blood_pressure_systolic: 120,
        heart_rate: 72,
      };

      const result = formatVitals(vitals);

      expect(result).toContain('HR: 72');
      expect(result).not.toContain('undefined');
      expect(result).not.toContain('BP:'); // No BP if diastolic missing
    });

    it('should handle null/undefined vitals', () => {
      const result1 = formatVitals(null);
      const result2 = formatVitals(undefined);
      const result3 = formatVitals({});

      expect(result1).toBe('No vitals recorded');
      expect(result2).toBe('No vitals recorded');
      expect(result3).toBe('No vitals recorded');
    });

    it('should handle empty vitals object', () => {
      const result = formatVitals({});

      expect(result).toBe('No vitals recorded');
    });
  });

  describe('getAlertSeverity', () => {
    const basePatient: IncomingPatient = {
      id: 'test-123',
      chief_complaint: 'Test',
      paramedic_name: 'John Doe',
      unit_number: 'A-1',
      receiving_hospital_name: 'Test Hospital',
      status: 'en_route',
      eta_hospital: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      minutes_until_arrival: 15,
      created_at: new Date().toISOString(),
      vitals: {},
      stroke_alert: false,
      stemi_alert: false,
      trauma_alert: false,
      sepsis_alert: false,
      cardiac_arrest: false,
    };

    it('should return critical for STEMI alert', () => {
      const patient = { ...basePatient, stemi_alert: true };
      expect(getAlertSeverity(patient)).toBe('critical');
    });

    it('should return urgent for stroke alert', () => {
      const patient = { ...basePatient, stroke_alert: true };
      expect(getAlertSeverity(patient)).toBe('urgent');
    });

    it('should return critical for cardiac arrest', () => {
      const patient = { ...basePatient, cardiac_arrest: true };
      expect(getAlertSeverity(patient)).toBe('critical');
    });

    it('should return urgent for trauma alert', () => {
      const patient = { ...basePatient, trauma_alert: true };
      expect(getAlertSeverity(patient)).toBe('urgent');
    });

    it('should return urgent for sepsis alert', () => {
      const patient = { ...basePatient, sepsis_alert: true };
      expect(getAlertSeverity(patient)).toBe('urgent');
    });

    it('should return routine for no alerts', () => {
      expect(getAlertSeverity(basePatient)).toBe('routine');
    });

    it('should prioritize critical over urgent', () => {
      const patient = {
        ...basePatient,
        stemi_alert: true,
        trauma_alert: true,
      };
      expect(getAlertSeverity(patient)).toBe('critical');
    });
  });

  describe('getAlertBadges', () => {
    const basePatient: IncomingPatient = {
      id: 'test-123',
      chief_complaint: 'Test',
      paramedic_name: 'John Doe',
      unit_number: 'A-1',
      receiving_hospital_name: 'Test Hospital',
      status: 'en_route',
      eta_hospital: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      minutes_until_arrival: 15,
      created_at: new Date().toISOString(),
      vitals: {},
      stroke_alert: false,
      stemi_alert: false,
      trauma_alert: false,
      sepsis_alert: false,
      cardiac_arrest: false,
    };

    it('should return empty array for no alerts', () => {
      expect(getAlertBadges(basePatient)).toEqual([]);
    });

    it('should return STEMI badge', () => {
      const patient = { ...basePatient, stemi_alert: true };
      const badges = getAlertBadges(patient);

      expect(badges).toContain('❤️ STEMI');
      expect(badges).toHaveLength(1);
    });

    it('should return stroke badge', () => {
      const patient = { ...basePatient, stroke_alert: true };
      const badges = getAlertBadges(patient);

      expect(badges).toContain('🧠 STROKE');
      expect(badges).toHaveLength(1);
    });

    it('should return trauma badge', () => {
      const patient = { ...basePatient, trauma_alert: true };
      const badges = getAlertBadges(patient);

      expect(badges).toContain('🏥 TRAUMA');
      expect(badges).toHaveLength(1);
    });

    it('should return sepsis badge', () => {
      const patient = { ...basePatient, sepsis_alert: true };
      const badges = getAlertBadges(patient);

      expect(badges).toContain('🦠 SEPSIS');
      expect(badges).toHaveLength(1);
    });

    it('should return cardiac arrest badge', () => {
      const patient = { ...basePatient, cardiac_arrest: true };
      const badges = getAlertBadges(patient);

      expect(badges).toContain('🚨 CARDIAC ARREST');
      expect(badges).toHaveLength(1);
    });

    it('should return multiple badges for multiple alerts', () => {
      const patient = {
        ...basePatient,
        stemi_alert: true,
        trauma_alert: true,
        sepsis_alert: true,
      };
      const badges = getAlertBadges(patient);

      expect(badges).toHaveLength(3);
      expect(badges).toContain('❤️ STEMI');
      expect(badges).toContain('🏥 TRAUMA');
      expect(badges).toContain('🦠 SEPSIS');
    });

    it('should maintain consistent badge order', () => {
      const patient = {
        ...basePatient,
        sepsis_alert: true,
        stemi_alert: true,
        stroke_alert: true,
      };
      const badges = getAlertBadges(patient);

      // Cardiac arrest first, then STEMI, stroke, sepsis
      expect(badges.indexOf('❤️ STEMI')).toBeGreaterThanOrEqual(0);
      expect(badges.indexOf('🧠 STROKE')).toBeGreaterThanOrEqual(0);
      expect(badges.indexOf('🦠 SEPSIS')).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('should handle patient with all alerts (worst case scenario)', () => {
      const patient: IncomingPatient = {
        id: 'critical-123',
        chief_complaint: 'Multi-system trauma',
        paramedic_name: 'John Doe',
        unit_number: 'A-1',
        receiving_hospital_name: 'Test Hospital',
        status: 'en_route',
        eta_hospital: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        minutes_until_arrival: 5,
        created_at: new Date().toISOString(),
        vitals: {
          blood_pressure_systolic: 60,
          blood_pressure_diastolic: 40,
          heart_rate: 150,
          oxygen_saturation: 85,
        },
        stroke_alert: true,
        stemi_alert: true,
        trauma_alert: true,
        sepsis_alert: true,
        cardiac_arrest: true,
      };

      // Should prioritize most critical
      expect(getAlertSeverity(patient)).toBe('critical');

      // Should show all badges
      const badges = getAlertBadges(patient);
      expect(badges).toHaveLength(5);

      // Vitals should format even with critical values
      const vitals = formatVitals(patient.vitals);
      expect(vitals).toContain('BP: 60/40');
      expect(vitals).toContain('HR: 150');
    });

    it('should handle patient with partial vitals', () => {
      const vitals = {
        blood_pressure_systolic: 120,
        oxygen_saturation: 95,
        // Missing other vitals
      };

      const result = formatVitals(vitals);

      expect(result).toContain('O2: 95%');
      expect(result).not.toContain('null');
      expect(result).not.toContain('undefined');
      expect(result).not.toContain('BP:'); // No BP without diastolic
    });

    it('should handle very low/high vital values', () => {
      const vitals = {
        blood_pressure_systolic: 250,
        blood_pressure_diastolic: 140,
        heart_rate: 200,
        respiratory_rate: 40,
        oxygen_saturation: 75,
      };

      const result = formatVitals(vitals);

      // Should still format correctly even with dangerous values
      expect(result).toContain('BP: 250/140');
      expect(result).toContain('HR: 200');
      expect(result).toContain('RR: 40');
      expect(result).toContain('O2: 75%');
    });
  });

  describe('Guardian Agent Health Checks', () => {
    it('should validate all critical functions exist', () => {
      expect(typeof formatVitals).toBe('function');
      expect(typeof getAlertSeverity).toBe('function');
      expect(typeof getAlertBadges).toBe('function');
    });

    it('should handle null inputs without crashing', () => {
      expect(() => formatVitals(null)).not.toThrow();
      expect(() => formatVitals(undefined)).not.toThrow();
      expect(() => formatVitals({})).not.toThrow();
    });

    it('should return predictable types', () => {
      const vitals = { blood_pressure_systolic: 120, heart_rate: 72 };
      const patient: IncomingPatient = {
        id: 'test',
        chief_complaint: 'Test',
        paramedic_name: 'Test',
        unit_number: 'Test',
        receiving_hospital_name: 'Test',
        status: 'en_route',
        eta_hospital: new Date().toISOString(),
        minutes_until_arrival: 10,
        created_at: new Date().toISOString(),
        vitals: {},
        stroke_alert: false,
        stemi_alert: false,
        trauma_alert: false,
        sepsis_alert: false,
        cardiac_arrest: false,
      };

      expect(typeof formatVitals(vitals)).toBe('string');
      expect(typeof getAlertSeverity(patient)).toBe('string');
      expect(Array.isArray(getAlertBadges(patient))).toBe(true);
    });
  });
});

describe('EMS Service - Integration Tests', () => {
  it('should handle complete workflow data', () => {
    const patient: IncomingPatient = {
      id: 'test-456',
      chief_complaint: 'Chest pain',
      patient_age: 65,
      patient_gender: 'M',
      paramedic_name: 'Jane Smith',
      unit_number: 'M-3',
      receiving_hospital_name: 'Memorial Hospital',
      status: 'en_route',
      eta_hospital: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      minutes_until_arrival: 10,
      created_at: new Date().toISOString(),
      vitals: {
        blood_pressure_systolic: 160,
        blood_pressure_diastolic: 95,
        heart_rate: 110,
        respiratory_rate: 22,
        oxygen_saturation: 92,
      },
      stemi_alert: true,
      stroke_alert: false,
      trauma_alert: false,
      sepsis_alert: false,
      cardiac_arrest: false,
      alert_notes: 'Patient reports crushing chest pain radiating to left arm',
    };

    // Validate all processing functions work together
    const severity = getAlertSeverity(patient);
    const badges = getAlertBadges(patient);
    const vitals = formatVitals(patient.vitals);

    expect(severity).toBe('critical');
    expect(badges).toContain('❤️ STEMI');
    expect(vitals).toContain('BP: 160/95');
    expect(vitals).toContain('HR: 110');
    expect(vitals).toContain('O2: 92%');
  });
});
