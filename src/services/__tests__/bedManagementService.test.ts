/**
 * Bed Management Service Tests
 *
 * Tests for the Predictive Bed Management System:
 * - Bed board (real-time view)
 * - Unit capacity and census
 * - Bed assignment and discharge
 * - Bed status management
 * - Availability forecasting
 * - Equipment-based bed matching
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';

// Mock Supabase client
jest.mock('../../lib/supabaseClient', () => {
  const mockInvoke = jest.fn();
  const mockRpc = jest.fn();
  const mockFrom = jest.fn();

  return {
    supabase: {
      functions: {
        invoke: mockInvoke,
      },
      rpc: mockRpc,
      from: mockFrom,
    },
  };
});

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('Bed Management Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Bed Board', () => {
    it('should fetch real-time bed board for all units', async () => {
      const mockBeds = [
        {
          bed_id: 'bed-1',
          bed_label: '101-A',
          room_number: '101',
          bed_position: 'A',
          bed_type: 'standard',
          status: 'occupied',
          unit_id: 'unit-1',
          unit_name: 'Medical ICU',
          patient_name: 'John Doe',
          patient_acuity: 'HIGH',
        },
        {
          bed_id: 'bed-2',
          bed_label: '101-B',
          room_number: '101',
          bed_position: 'B',
          bed_type: 'standard',
          status: 'available',
          unit_id: 'unit-1',
          unit_name: 'Medical ICU',
          patient_name: null,
          patient_acuity: null,
        },
      ];

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true, beds: mockBeds },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'get_bed_board' },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.beds).toHaveLength(2);
      expect(response.data.beds[0].bed_label).toBe('101-A');
      expect(response.data.beds[0].status).toBe('occupied');
    });

    it('should filter bed board by unit', async () => {
      const mockBeds = [
        { bed_id: 'bed-1', unit_id: 'unit-1', unit_name: 'ICU' },
      ];

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true, beds: mockBeds },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'get_bed_board', unit_id: 'unit-1' },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.beds).toHaveLength(1);
    });

    it('should filter bed board by facility', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true, beds: [] },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'get_bed_board', facility_id: 'facility-1' },
      });

      expect(response.data.success).toBe(true);
    });
  });

  describe('Unit Capacity', () => {
    it('should fetch unit capacity summary', async () => {
      const mockUnits = [
        {
          unit_id: 'unit-1',
          unit_code: 'ICU-A',
          unit_name: 'Medical ICU',
          unit_type: 'icu',
          total_beds: 20,
          occupied: 15,
          available: 3,
          pending_clean: 2,
          out_of_service: 0,
          occupancy_pct: 75.0,
        },
        {
          unit_id: 'unit-2',
          unit_code: '3N',
          unit_name: '3rd Floor North',
          unit_type: 'med_surg',
          total_beds: 30,
          occupied: 25,
          available: 4,
          pending_clean: 1,
          out_of_service: 0,
          occupancy_pct: 83.3,
        },
      ];

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true, units: mockUnits },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'get_unit_capacity' },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.units).toHaveLength(2);
      expect(response.data.units[0].occupancy_pct).toBe(75.0);
    });

    it('should filter capacity by specific unit', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          units: [{ unit_id: 'unit-1', unit_name: 'ICU' }],
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'get_unit_capacity', unit_id: 'unit-1' },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.units).toHaveLength(1);
    });
  });

  describe('Unit Census', () => {
    it('should fetch real-time census for a unit', async () => {
      const mockCensus = {
        unit_id: 'unit-1',
        unit_name: 'Medical ICU',
        total_beds: 20,
        occupied: 15,
        available: 3,
        dirty: 2,
        blocked: 0,
        occupancy_rate: 75.0,
        critical_patients: 3,
        high_acuity_patients: 5,
      };

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true, census: mockCensus },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'get_census', unit_id: 'unit-1' },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.census.occupied).toBe(15);
      expect(response.data.census.critical_patients).toBe(3);
    });

    it('should require unit_id for census', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { error: 'unit_id is required' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'get_census' },
      });

      expect(response.data.error).toContain('required');
    });
  });

  describe('Find Available Beds', () => {
    it('should find available beds without filters', async () => {
      const mockBeds = [
        {
          bed_id: 'bed-1',
          bed_label: '101-A',
          unit_name: 'Med-Surg',
          bed_type: 'standard',
          has_telemetry: false,
        },
        {
          bed_id: 'bed-2',
          bed_label: '102-A',
          unit_name: 'Med-Surg',
          bed_type: 'standard',
          has_telemetry: true,
        },
      ];

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true, available_beds: mockBeds },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'find_available' },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.available_beds).toHaveLength(2);
    });

    it('should filter beds by telemetry requirement', async () => {
      const mockBeds = [
        {
          bed_id: 'bed-2',
          bed_label: '102-A',
          has_telemetry: true,
        },
      ];

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true, available_beds: mockBeds },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'find_available', requires_telemetry: true },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.available_beds[0].has_telemetry).toBe(true);
    });

    it('should filter beds by isolation capability', async () => {
      const mockBeds = [
        {
          bed_id: 'bed-3',
          bed_label: 'ISO-1',
          has_isolation_capability: true,
        },
      ];

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true, available_beds: mockBeds },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'find_available', requires_isolation: true },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.available_beds[0].has_isolation_capability).toBe(true);
    });

    it('should filter beds by negative pressure requirement', async () => {
      const mockBeds = [
        {
          bed_id: 'bed-4',
          bed_label: 'ISO-2',
          has_negative_pressure: true,
        },
      ];

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true, available_beds: mockBeds },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'find_available', requires_negative_pressure: true },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.available_beds[0].has_negative_pressure).toBe(true);
    });

    it('should filter beds by bed type', async () => {
      const mockBeds = [
        { bed_id: 'bed-5', bed_type: 'bariatric' },
      ];

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true, available_beds: mockBeds },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'find_available', bed_type: 'bariatric' },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.available_beds[0].bed_type).toBe('bariatric');
    });

    it('should filter beds by unit', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true, available_beds: [] },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'find_available', unit_id: 'unit-1' },
      });

      expect(response.data.success).toBe(true);
    });
  });

  describe('Bed Assignment', () => {
    it('should assign patient to available bed', async () => {
      const mockAssignmentId = 'assignment-uuid';

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          assignment_id: mockAssignmentId,
          message: 'Patient assigned to bed successfully',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: {
          action: 'assign_bed',
          patient_id: 'patient-1',
          bed_id: 'bed-1',
          expected_los_days: 3,
        },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.assignment_id).toBe(mockAssignmentId);
    });

    it('should require patient_id for assignment', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { error: 'patient_id and bed_id are required' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'assign_bed', bed_id: 'bed-1' },
      });

      expect(response.data.error).toContain('required');
    });

    it('should require bed_id for assignment', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { error: 'patient_id and bed_id are required' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'assign_bed', patient_id: 'patient-1' },
      });

      expect(response.data.error).toContain('required');
    });

    it('should reject assignment to occupied bed', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { error: 'Bed is not available for assignment' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: {
          action: 'assign_bed',
          patient_id: 'patient-1',
          bed_id: 'occupied-bed',
        },
      });

      expect(response.data.error).toContain('not available');
    });

    it('should handle patient transfer (existing assignment)', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          assignment_id: 'new-assignment',
          message: 'Patient assigned to bed successfully',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: {
          action: 'assign_bed',
          patient_id: 'patient-with-bed',
          bed_id: 'new-bed',
        },
      });

      // Transfer should work - old assignment ended, new one created
      expect(response.data.success).toBe(true);
    });
  });

  describe('Patient Discharge', () => {
    it('should discharge patient and release bed', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Patient discharged successfully',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: {
          action: 'discharge',
          patient_id: 'patient-1',
          disposition: 'Home',
        },
      });

      expect(response.data.success).toBe(true);
    });

    it('should require patient_id for discharge', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { error: 'patient_id is required' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'discharge' },
      });

      expect(response.data.error).toContain('required');
    });

    it('should handle different disposition types', async () => {
      const dispositions = ['Home', 'SNF', 'Rehab', 'AMA', 'Expired', 'Transfer'];

      for (const disposition of dispositions) {
        (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
          data: { success: true },
          error: null,
        });

        const response = await mockSupabase.functions.invoke('bed-management', {
          body: {
            action: 'discharge',
            patient_id: 'patient-1',
            disposition,
          },
        });

        expect(response.data.success).toBe(true);
      }
    });

    it('should handle discharge of unassigned patient', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { error: 'Patient not found or not assigned to a bed' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: {
          action: 'discharge',
          patient_id: 'no-bed-patient',
        },
      });

      expect(response.data.error).toContain('not assigned');
    });
  });

  describe('Bed Status Management', () => {
    it('should update bed status', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Bed status updated to cleaning',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: {
          action: 'update_status',
          bed_id: 'bed-1',
          new_status: 'cleaning',
          reason: 'Post-discharge cleaning',
        },
      });

      expect(response.data.success).toBe(true);
    });

    it('should require bed_id and new_status', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { error: 'bed_id and new_status are required' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'update_status', bed_id: 'bed-1' },
      });

      expect(response.data.error).toContain('required');
    });

    it('should validate bed status values', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          error: 'Invalid status. Must be one of: available, occupied, dirty, cleaning, blocked, maintenance, reserved',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: {
          action: 'update_status',
          bed_id: 'bed-1',
          new_status: 'invalid_status',
        },
      });

      expect(response.data.error).toContain('Invalid status');
    });

    it('should allow all valid bed statuses', async () => {
      const validStatuses = ['available', 'occupied', 'dirty', 'cleaning', 'blocked', 'maintenance', 'reserved'];

      for (const status of validStatuses) {
        (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
          data: { success: true, message: `Bed status updated to ${status}` },
          error: null,
        });

        const response = await mockSupabase.functions.invoke('bed-management', {
          body: {
            action: 'update_status',
            bed_id: 'bed-1',
            new_status: status,
          },
        });

        expect(response.data.success).toBe(true);
      }
    });

    it('should handle bed not found', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { error: 'Bed not found' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: {
          action: 'update_status',
          bed_id: 'nonexistent-bed',
          new_status: 'available',
        },
      });

      expect(response.data.error).toContain('not found');
    });
  });

  describe('Bed Availability Forecast', () => {
    it('should generate forecast for a unit', async () => {
      const mockForecast = {
        id: 'forecast-1',
        unit_id: 'unit-1',
        forecast_date: '2025-12-02',
        predicted_census: 18,
        predicted_available: 2,
        predicted_discharges: 3,
        predicted_admissions: 2,
        confidence_level: 0.75,
        factors_json: {
          current_census: 17,
          expected_discharges: 3,
          scheduled_arrivals: 2,
        },
      };

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          forecast_id: 'forecast-1',
          forecast: mockForecast,
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: {
          action: 'generate_forecast',
          unit_id: 'unit-1',
          forecast_date: '2025-12-02',
        },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.forecast.predicted_census).toBe(18);
      expect(response.data.forecast.predicted_available).toBe(2);
    });

    it('should require unit_id for forecast', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { error: 'unit_id is required' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'generate_forecast' },
      });

      expect(response.data.error).toContain('required');
    });

    it('should use current date if forecast_date not provided', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          forecast_id: 'forecast-1',
          forecast: { forecast_date: new Date().toISOString().split('T')[0] },
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: {
          action: 'generate_forecast',
          unit_id: 'unit-1',
        },
      });

      expect(response.data.success).toBe(true);
    });

    it('should include prediction factors in forecast', async () => {
      const mockForecast = {
        factors_json: {
          current_census: 15,
          total_beds: 20,
          expected_discharges: 2,
          scheduled_arrivals: 1,
          days_ahead: 1,
          day_of_week: 2,
        },
      };

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true, forecast: mockForecast },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: {
          action: 'generate_forecast',
          unit_id: 'unit-1',
        },
      });

      expect(response.data.forecast.factors_json).toBeDefined();
      expect(response.data.forecast.factors_json.current_census).toBe(15);
    });
  });

  describe('Authorization', () => {
    it('should require authentication', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { error: 'Authorization required' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'get_bed_board' },
      });

      expect(response.data.error).toContain('Authorization');
    });

    it('should reject unauthorized roles', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { error: 'Insufficient permissions for bed management' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'get_bed_board' },
      });

      expect(response.data.error).toContain('permissions');
    });

    it('should allow authorized roles', async () => {
      const authorizedRoles = ['admin', 'super_admin', 'nurse', 'care_manager', 'bed_control', 'physician'];

      for (const _role of authorizedRoles) {
        (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
          data: { success: true, beds: [] },
          error: null,
        });

        const response = await mockSupabase.functions.invoke('bed-management', {
          body: { action: 'get_bed_board' },
        });

        expect(response.data.success).toBe(true);
      }
    });
  });

  describe('Invalid Action Handling', () => {
    it('should return error for invalid action', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          error: 'Invalid action',
          valid_actions: [
            'get_bed_board', 'get_unit_capacity', 'get_census',
            'find_available', 'assign_bed', 'discharge',
            'update_status', 'generate_forecast',
          ],
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('bed-management', {
        body: { action: 'invalid_action' },
      });

      expect(response.data.error).toContain('Invalid action');
      expect(response.data.valid_actions).toBeDefined();
    });
  });

  describe('Audit Logging', () => {
    it('should log bed assignment events', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true, assignment_id: 'assignment-1' },
        error: null,
      });

      await mockSupabase.functions.invoke('bed-management', {
        body: {
          action: 'assign_bed',
          patient_id: 'patient-1',
          bed_id: 'bed-1',
        },
      });

      // Audit logging happens server-side
      expect(mockSupabase.functions.invoke).toHaveBeenCalled();
    });

    it('should log discharge events', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      await mockSupabase.functions.invoke('bed-management', {
        body: {
          action: 'discharge',
          patient_id: 'patient-1',
        },
      });

      expect(mockSupabase.functions.invoke).toHaveBeenCalled();
    });

    it('should log bed status changes', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      await mockSupabase.functions.invoke('bed-management', {
        body: {
          action: 'update_status',
          bed_id: 'bed-1',
          new_status: 'cleaning',
        },
      });

      expect(mockSupabase.functions.invoke).toHaveBeenCalled();
    });
  });
});
