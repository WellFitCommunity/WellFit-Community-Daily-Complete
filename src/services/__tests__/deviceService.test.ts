import { DeviceService } from '../deviceService';
import { supabase } from '../../lib/supabaseClient';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Mock auditLogger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockUser = { id: 'user-123', email: 'test@example.com' };

describe('DeviceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);
  });

  // ===========================================================================
  // CONNECTION MANAGEMENT
  // ===========================================================================

  describe('connectDevice', () => {
    it('creates a new connection when device not previously connected', async () => {
      const mockConnection = {
        id: 'conn-1',
        user_id: mockUser.id,
        device_type: 'smart_scale',
        device_model: 'Smart Scale',
        connected: true,
        last_sync: expect.any(String),
        created_at: '2026-01-28T00:00:00Z',
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: mockConnection, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.connectDevice('smart_scale', 'Smart Scale');

      expect(result.success).toBe(true);
      expect(result.data?.connected).toBe(true);
      expect(result.data?.device_type).toBe('smart_scale');
    });

    it('updates existing connection when device was previously connected', async () => {
      const existingConnection = {
        id: 'conn-existing',
        user_id: mockUser.id,
        device_type: 'smart_scale',
        device_model: 'Old Scale',
        connected: false,
      };

      const updatedConnection = {
        ...existingConnection,
        device_model: 'Smart Scale',
        connected: true,
        last_sync: '2026-01-28T10:00:00Z',
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: existingConnection, error: null }),
        single: vi.fn().mockResolvedValue({ data: updatedConnection, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.connectDevice('smart_scale', 'Smart Scale');

      expect(result.success).toBe(true);
      expect(result.data?.connected).toBe(true);
    });

    it('returns error when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

      const result = await DeviceService.connectDevice('smart_scale', 'Smart Scale');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not authenticated');
    });

    it('returns error when database insert fails', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.connectDevice('smart_scale', 'Smart Scale');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insert failed');
    });
  });

  describe('disconnectDevice', () => {
    it('disconnects a connected device', async () => {
      // Chain: from().update().eq().eq() - need second eq to resolve
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn()
          .mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.disconnectDevice('smart_scale');

      expect(result.success).toBe(true);
      expect(mockBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ connected: false })
      );
    });

    it('returns error when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

      const result = await DeviceService.disconnectDevice('smart_scale');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not authenticated');
    });
  });

  describe('getConnectionStatus', () => {
    it('returns connection data when device is connected', async () => {
      const mockConnection = {
        id: 'conn-1',
        user_id: mockUser.id,
        device_type: 'bp_monitor',
        device_model: 'BP Monitor',
        connected: true,
        last_sync: '2026-01-28T08:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
      };

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockConnection, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.getConnectionStatus('bp_monitor');

      expect(result.success).toBe(true);
      expect(result.data?.connected).toBe(true);
      expect(result.data?.device_type).toBe('bp_monitor');
    });

    it('returns null when device is not connected', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.getConnectionStatus('glucometer');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('getAllConnections', () => {
    it('returns all connected devices for user', async () => {
      const mockConnections = [
        { id: 'conn-1', user_id: mockUser.id, device_type: 'smart_scale', device_model: 'Scale', connected: true, last_sync: null, created_at: '2026-01-01' },
        { id: 'conn-2', user_id: mockUser.id, device_type: 'bp_monitor', device_model: 'BP', connected: true, last_sync: null, created_at: '2026-01-01' },
      ];

      // Chain: from().select().eq().eq() - need second eq to resolve
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn()
          .mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ data: mockConnections, error: null }) }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.getAllConnections();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('returns empty array when no devices connected', async () => {
      // Chain: from().select().eq().eq() - need second eq to resolve
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn()
          .mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.getAllConnections();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  // ===========================================================================
  // WEIGHT READINGS
  // ===========================================================================

  describe('saveWeightReading', () => {
    it('saves a weight reading successfully', async () => {
      const mockReading = {
        id: 'reading-1',
        user_id: mockUser.id,
        device_id: 'device-1',
        vital_type: 'weight',
        value: 165.5,
        unit: 'lbs',
        measured_at: '2026-01-28T08:00:00Z',
        metadata: { bmi: 24.2, body_fat: 18.5 },
      };

      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockReading, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.saveWeightReading({
        device_id: 'device-1',
        weight: 165.5,
        unit: 'lbs',
        bmi: 24.2,
        body_fat: 18.5,
        measured_at: '2026-01-28T08:00:00Z',
      });

      expect(result.success).toBe(true);
      expect(result.data?.weight).toBe(165.5);
    });
  });

  describe('getWeightReadings', () => {
    it('returns weight readings sorted by date', async () => {
      const mockReadings = [
        { id: '1', user_id: mockUser.id, device_id: 'd1', vital_type: 'weight', value: 165, unit: 'lbs', measured_at: '2026-01-28', metadata: {} },
        { id: '2', user_id: mockUser.id, device_id: 'd1', vital_type: 'weight', value: 166, unit: 'lbs', measured_at: '2026-01-27', metadata: {} },
      ];

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockReadings, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.getWeightReadings(10);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].weight).toBe(165);
    });
  });

  // ===========================================================================
  // BLOOD PRESSURE READINGS
  // ===========================================================================

  describe('saveBPReading', () => {
    it('saves a BP reading with systolic, diastolic, and pulse', async () => {
      const mockReading = {
        id: 'bp-1',
        user_id: mockUser.id,
        device_id: 'device-1',
        vital_type: 'blood_pressure',
        value: 120,
        unit: 'mmHg',
        measured_at: '2026-01-28T08:00:00Z',
        metadata: { systolic: 120, diastolic: 80, pulse: 72 },
      };

      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockReading, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.saveBPReading({
        device_id: 'device-1',
        systolic: 120,
        diastolic: 80,
        pulse: 72,
        measured_at: '2026-01-28T08:00:00Z',
      });

      expect(result.success).toBe(true);
      expect(result.data?.systolic).toBe(120);
      expect(result.data?.diastolic).toBe(80);
    });
  });

  describe('getBPReadings', () => {
    it('returns BP readings with proper metadata extraction', async () => {
      const mockReadings = [
        { id: '1', user_id: mockUser.id, device_id: 'd1', vital_type: 'blood_pressure', value: 120, unit: 'mmHg', measured_at: '2026-01-28', metadata: { systolic: 120, diastolic: 80, pulse: 72 } },
      ];

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockReadings, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.getBPReadings(10);

      expect(result.success).toBe(true);
      expect(result.data?.[0].systolic).toBe(120);
      expect(result.data?.[0].diastolic).toBe(80);
      expect(result.data?.[0].pulse).toBe(72);
    });
  });

  // ===========================================================================
  // GLUCOSE READINGS
  // ===========================================================================

  describe('saveGlucoseReading', () => {
    it('saves a glucose reading with meal context', async () => {
      const mockReading = {
        id: 'glucose-1',
        user_id: mockUser.id,
        device_id: 'device-1',
        vital_type: 'glucose',
        value: 98,
        unit: 'mg/dL',
        measured_at: '2026-01-28T07:00:00Z',
        metadata: { meal_context: 'fasting' },
      };

      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockReading, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.saveGlucoseReading({
        device_id: 'device-1',
        value: 98,
        meal_context: 'fasting',
        measured_at: '2026-01-28T07:00:00Z',
      });

      expect(result.success).toBe(true);
      expect(result.data?.value).toBe(98);
      expect(result.data?.meal_context).toBe('fasting');
    });
  });

  describe('getGlucoseReadings', () => {
    it('returns glucose readings with meal context', async () => {
      const mockReadings = [
        { id: '1', user_id: mockUser.id, device_id: 'd1', vital_type: 'glucose', value: 98, unit: 'mg/dL', measured_at: '2026-01-28', metadata: { meal_context: 'fasting' } },
        { id: '2', user_id: mockUser.id, device_id: 'd1', vital_type: 'glucose', value: 145, unit: 'mg/dL', measured_at: '2026-01-28', metadata: { meal_context: 'after_meal' } },
      ];

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockReadings, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.getGlucoseReadings(10);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].meal_context).toBe('fasting');
      expect(result.data?.[1].meal_context).toBe('after_meal');
    });
  });

  // ===========================================================================
  // SPO2 READINGS
  // ===========================================================================

  describe('saveSpO2Reading', () => {
    it('saves an SpO2 reading with pulse rate', async () => {
      const mockReading = {
        id: 'spo2-1',
        user_id: mockUser.id,
        device_id: 'device-1',
        vital_type: 'oxygen_saturation',
        value: 98,
        unit: '%',
        measured_at: '2026-01-28T08:00:00Z',
        metadata: { pulse_rate: 72 },
      };

      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockReading, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.saveSpO2Reading({
        device_id: 'device-1',
        spo2: 98,
        pulse_rate: 72,
        measured_at: '2026-01-28T08:00:00Z',
      });

      expect(result.success).toBe(true);
      expect(result.data?.spo2).toBe(98);
      expect(result.data?.pulse_rate).toBe(72);
    });
  });

  describe('getSpO2Readings', () => {
    it('returns SpO2 readings with pulse rate', async () => {
      const mockReadings = [
        { id: '1', user_id: mockUser.id, device_id: 'd1', vital_type: 'oxygen_saturation', value: 98, unit: '%', measured_at: '2026-01-28', metadata: { pulse_rate: 72 } },
        { id: '2', user_id: mockUser.id, device_id: 'd1', vital_type: 'oxygen_saturation', value: 92, unit: '%', measured_at: '2026-01-27', metadata: { pulse_rate: 78 } },
      ];

      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockReadings, error: null }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.getSpO2Readings(10);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].spo2).toBe(98);
      expect(result.data?.[0].pulse_rate).toBe(72);
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('Error Handling', () => {
    it('handles database errors gracefully for getWeightReadings', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockBuilder as unknown as ReturnType<typeof supabase.from>);

      const result = await DeviceService.getWeightReadings(10);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('handles unauthenticated user for all methods', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

      const methods = [
        () => DeviceService.connectDevice('smart_scale', 'Scale'),
        () => DeviceService.disconnectDevice('smart_scale'),
        () => DeviceService.getConnectionStatus('smart_scale'),
        () => DeviceService.getAllConnections(),
        () => DeviceService.getWeightReadings(10),
        () => DeviceService.getBPReadings(10),
        () => DeviceService.getGlucoseReadings(10),
        () => DeviceService.getSpO2Readings(10),
      ];

      for (const method of methods) {
        const result = await method();
        expect(result.success).toBe(false);
        expect(result.error).toContain('not authenticated');
      }
    });
  });
});
