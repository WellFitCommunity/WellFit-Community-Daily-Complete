/**
 * dischargeTrigger tests — bed-board disposition mapping and the
 * fire-at-discharge prediction path (skip semantics, tenant resolution,
 * failure isolation).
 */

import {
  mapBedBoardDisposition,
  triggerDischargeReadmissionPrediction,
} from '../dischargeTrigger';

const mockPredict = vi.fn();

vi.mock('../../readmissionRiskPredictor', () => ({
  readmissionRiskPredictor: {
    predictReadmissionRisk: (...args: unknown[]) => mockPredict(...args),
  },
}));

const mockProfileSingle = vi.fn();

vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'clinician-uuid' } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: (...args: unknown[]) => mockProfileSingle(...args),
    })),
  },
}));

vi.mock('../../../auditLogger', () => ({
  auditLogger: {
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    info: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('mapBedBoardDisposition', () => {
  it('maps every community discharge label to the predictor enum', () => {
    expect(mapBedBoardDisposition('Home')).toBe('home');
    expect(mapBedBoardDisposition('Home with Home Health')).toBe('home_health');
    expect(mapBedBoardDisposition('Skilled Nursing Facility')).toBe('snf');
    expect(mapBedBoardDisposition('Inpatient Rehab')).toBe('rehab');
    expect(mapBedBoardDisposition('Long-Term Acute Care')).toBe('ltac');
    expect(mapBedBoardDisposition('Hospice')).toBe('hospice');
    expect(mapBedBoardDisposition('Against Medical Advice')).toBe('home');
  });

  it('returns null for deceased patients and inpatient transfers', () => {
    expect(mapBedBoardDisposition('Expired')).toBeNull();
    expect(mapBedBoardDisposition('Transfer to Another Hospital')).toBeNull();
    expect(mapBedBoardDisposition('Something Unknown')).toBeNull();
  });
});

describe('triggerDischargeReadmissionPrediction', () => {
  beforeEach(() => {
    mockPredict.mockReset();
    mockProfileSingle.mockReset();
    mockProfileSingle.mockResolvedValue({
      data: { tenant_id: '00000000-0000-4000-8000-0000000000aa' },
      error: null,
    });
  });

  it('skips (success, no prediction) for non-community dispositions', async () => {
    const result = await triggerDischargeReadmissionPrediction('patient-1', 'Expired');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skipped).toBe(true);
    }
    expect(mockPredict).not.toHaveBeenCalled();
  });

  it('runs the prediction with resolved tenant and mapped disposition', async () => {
    mockPredict.mockResolvedValue({
      predictionId: 'row-id-1',
      riskCategory: 'high',
      readmissionRisk30Day: 0.68,
    });

    const result = await triggerDischargeReadmissionPrediction(
      'patient-1',
      'Skilled Nursing Facility',
      'Test Hospital'
    );

    expect(mockPredict).toHaveBeenCalledTimes(1);
    const context = mockPredict.mock.calls[0][0] as Record<string, unknown>;
    expect(context.dischargeDisposition).toBe('snf');
    expect(context.tenantId).toBe('00000000-0000-4000-8000-0000000000aa');
    expect(context.patientId).toBe('patient-1');
    expect(context.dischargeFacility).toBe('Test Hospital');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skipped).toBe(false);
      expect(result.data.riskCategory).toBe('high');
      expect(result.data.predictionId).toBe('row-id-1');
    }
  });

  it('returns failure (never throws) when the predictor errors', async () => {
    mockPredict.mockRejectedValue(new Error('AI unavailable'));

    const result = await triggerDischargeReadmissionPrediction('patient-1', 'Home');
    expect(result.success).toBe(false);
  });

  it('returns failure when the tenant cannot be resolved', async () => {
    mockProfileSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

    const result = await triggerDischargeReadmissionPrediction('patient-1', 'Home');
    expect(result.success).toBe(false);
    expect(mockPredict).not.toHaveBeenCalled();
  });
});
