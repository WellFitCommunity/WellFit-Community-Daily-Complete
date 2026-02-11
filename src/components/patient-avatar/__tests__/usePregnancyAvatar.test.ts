/**
 * usePregnancyAvatar Hook Tests
 *
 * Tests trimester derivation from EDD, OB status marker generation,
 * error handling, and loading states.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { usePregnancyAvatar } from '../hooks/usePregnancyAvatar';

// Mock LaborDeliveryService
const mockGetActivePregnancy = vi.fn();
vi.mock('../../../services/laborDelivery', () => ({
  LaborDeliveryService: {
    getActivePregnancy: (...args: unknown[]) => mockGetActivePregnancy(...args),
  },
}));

// Mock auditLogger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

function buildPregnancy(eddOffset: number, overrides: Record<string, unknown> = {}) {
  const edd = new Date(Date.now() + eddOffset * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: 'preg-1',
    patient_id: 'p-1',
    tenant_id: 't-1',
    gravida: 2,
    para: 1,
    ab: 0,
    living: 1,
    edd,
    lmp: null,
    blood_type: 'O+',
    rh_factor: 'positive',
    gbs_status: 'negative',
    risk_level: 'low',
    risk_factors: [],
    status: 'active',
    primary_provider_id: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('usePregnancyAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null context when no active pregnancy exists', async () => {
    mockGetActivePregnancy.mockResolvedValue({ success: true, data: null });

    const { result } = renderHook(() => usePregnancyAvatar('p-1', 't-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pregnancyContext).toBeNull();
    expect(result.current.trimester).toBeNull();
    expect(result.current.obStatusMarkers).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('derives trimester 1 for EDD ~250 days away (GA ~4 weeks)', async () => {
    // EDD 250 days out = 280 - 250 = 30 days GA = ~4 weeks (T1)
    mockGetActivePregnancy.mockResolvedValue({
      success: true,
      data: buildPregnancy(250),
    });

    const { result } = renderHook(() => usePregnancyAvatar('p-1', 't-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.trimester).toBe(1);
    expect(result.current.pregnancyContext?.trimester).toBe(1);
  });

  it('derives trimester 2 for EDD ~120 days away (GA ~23 weeks)', async () => {
    // EDD 120 days out = 280 - 120 = 160 days GA = ~22-23 weeks (T2: 14-27 weeks)
    mockGetActivePregnancy.mockResolvedValue({
      success: true,
      data: buildPregnancy(120),
    });

    const { result } = renderHook(() => usePregnancyAvatar('p-1', 't-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.trimester).toBe(2);
  });

  it('derives trimester 3 for EDD ~30 days away (GA ~35 weeks)', async () => {
    // EDD 30 days out = 280 - 30 = 250 days GA = ~35 weeks (T3: 28+)
    mockGetActivePregnancy.mockResolvedValue({
      success: true,
      data: buildPregnancy(30),
    });

    const { result } = renderHook(() => usePregnancyAvatar('p-1', 't-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.trimester).toBe(3);
  });

  it('generates OB risk marker when risk level is not low', async () => {
    mockGetActivePregnancy.mockResolvedValue({
      success: true,
      data: buildPregnancy(30, { risk_level: 'high', risk_factors: ['Preeclampsia'] }),
    });

    const { result } = renderHook(() => usePregnancyAvatar('p-1', 't-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const riskMarker = result.current.obStatusMarkers.find(
      (m) => m.marker_type === 'ob_risk_level'
    );
    expect(riskMarker).toBeDefined();
    expect(riskMarker?.display_name).toContain('HIGH');
    expect(riskMarker?.category).toBe('obstetric');
  });

  it('does not generate OB risk marker for low-risk pregnancy', async () => {
    mockGetActivePregnancy.mockResolvedValue({
      success: true,
      data: buildPregnancy(30, { risk_level: 'low' }),
    });

    const { result } = renderHook(() => usePregnancyAvatar('p-1', 't-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const riskMarker = result.current.obStatusMarkers.find(
      (m) => m.marker_type === 'ob_risk_level'
    );
    expect(riskMarker).toBeUndefined();
  });

  it('generates GBS positive marker when gbs_status is positive', async () => {
    mockGetActivePregnancy.mockResolvedValue({
      success: true,
      data: buildPregnancy(30, { gbs_status: 'positive' }),
    });

    const { result } = renderHook(() => usePregnancyAvatar('p-1', 't-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const gbsMarker = result.current.obStatusMarkers.find(
      (m) => m.marker_type === 'gbs_positive'
    );
    expect(gbsMarker).toBeDefined();
    expect(gbsMarker?.display_name).toBe('GBS Positive');
    expect(gbsMarker?.details?.notes).toContain('penicillin G');
  });

  it('populates pregnancyContext with correct fields', async () => {
    mockGetActivePregnancy.mockResolvedValue({
      success: true,
      data: buildPregnancy(70, { blood_type: 'AB-', rh_factor: 'negative', gravida: 3, para: 2 }),
    });

    const { result } = renderHook(() => usePregnancyAvatar('p-1', 't-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const ctx = result.current.pregnancyContext;
    expect(ctx).not.toBeNull();
    expect(ctx?.pregnancyId).toBe('preg-1');
    expect(ctx?.bloodType).toBe('AB-');
    expect(ctx?.rhFactor).toBe('negative');
    expect(ctx?.gravida).toBe(3);
    expect(ctx?.para).toBe(2);
    expect(ctx?.edd).toBeDefined();
  });

  it('sets error state when service call fails', async () => {
    mockGetActivePregnancy.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePregnancyAvatar('p-1', 't-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.pregnancyContext).toBeNull();
  });

  it('skips fetch when patientId is empty', async () => {
    const { result } = renderHook(() => usePregnancyAvatar('', 't-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetActivePregnancy).not.toHaveBeenCalled();
  });

  it('skips fetch when tenantId is empty', async () => {
    const { result } = renderHook(() => usePregnancyAvatar('p-1', ''));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetActivePregnancy).not.toHaveBeenCalled();
  });
});
