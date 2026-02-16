/**
 * L&D FHIR Service Tests
 * Tier 2-3: Tests FHIR resource mapping from L&D clinical data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LDProcedureService } from '../LDProcedureService';
import { LDVitalsObservationService } from '../LDVitalsObservationService';
import { LD_SNOMED_CODES, LD_LOINC_CODES } from '../codes';
import type { LDDeliveryRecord, LDPrenatalVisit, LDLaborEvent } from '../../../../types/laborDelivery';

const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    from: () => ({ insert: mockInsert }),
  },
}));

vi.mock('../../../../lib/getErrorMessage', () => ({
  getErrorMessage: (e: unknown) => String(e),
}));

beforeEach(() => {
  mockInsert.mockClear();
});

// =====================================================
// LDProcedureService Tests
// =====================================================

describe('LDProcedureService', () => {
  const vaginalDelivery: LDDeliveryRecord = {
    id: 'del-1',
    patient_id: 'p1',
    tenant_id: 't1',
    pregnancy_id: 'preg-1',
    delivery_datetime: '2026-04-10T14:30:00Z',
    delivery_provider_id: 'prov-1',
    method: 'spontaneous_vaginal',
    anesthesia: 'epidural',
    labor_duration_hours: 12,
    second_stage_duration_min: 45,
    estimated_blood_loss_ml: 350,
    complications: ['shoulder_dystocia'],
    episiotomy: true,
    laceration_degree: 2,
    cord_clamping: 'delayed_60s',
    cord_gases_ph: 7.28,
    cord_gases_base_excess: -3.5,
    placenta_delivery_time: null,
    placenta_intact: true,
    notes: null,
    created_at: new Date().toISOString(),
  };

  it('maps vaginal delivery to FHIR Procedure with correct SNOMED code', async () => {
    const result = await LDProcedureService.createProcedureFromDelivery(vaginalDelivery);
    expect(result.success).toBe(true);
    expect(result.data?.resourceType).toBe('Procedure');
    expect(result.data?.code.coding?.[0]?.code).toBe(LD_SNOMED_CODES.SPONTANEOUS_VAGINAL);
    expect(result.data?.status).toBe('completed');
  });

  it('maps cesarean delivery to FHIR Procedure with cesarean SNOMED code', async () => {
    const cesarean = { ...vaginalDelivery, method: 'cesarean_emergent' as const };
    const result = await LDProcedureService.createProcedureFromDelivery(cesarean);
    expect(result.success).toBe(true);
    expect(result.data?.code.coding?.[0]?.code).toBe(LD_SNOMED_CODES.CESAREAN);
  });

  it('includes performer reference when delivery_provider_id is set', async () => {
    const result = await LDProcedureService.createProcedureFromDelivery(vaginalDelivery);
    expect(result.data?.performer?.[0]?.actor.reference).toBe('Practitioner/prov-1');
  });

  it('includes complications as FHIR complication codes', async () => {
    const result = await LDProcedureService.createProcedureFromDelivery(vaginalDelivery);
    expect(result.data?.complication).toHaveLength(1);
    expect(result.data?.complication?.[0]?.text).toBe('shoulder_dystocia');
  });

  it('includes anesthesia as usedCode', async () => {
    const result = await LDProcedureService.createProcedureFromDelivery(vaginalDelivery);
    expect(result.data?.usedCode).toHaveLength(1);
    expect(result.data?.usedCode?.[0]?.coding?.[0]?.code).toBe(LD_SNOMED_CODES.EPIDURAL);
  });

  it('includes EBL and episiotomy in notes', async () => {
    const result = await LDProcedureService.createProcedureFromDelivery(vaginalDelivery);
    const noteText = result.data?.note?.[0]?.text ?? '';
    expect(noteText).toContain('EBL: 350 mL');
    expect(noteText).toContain('Episiotomy performed');
    expect(noteText).toContain('2° laceration');
  });

  it('stores procedure in fhir_procedures table', async () => {
    await LDProcedureService.createProcedureFromDelivery(vaginalDelivery);
    expect(mockInsert).toHaveBeenCalledOnce();
    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.patient_id).toBe('p1');
    expect(insertArg.resource_type).toBe('Procedure');
    expect(insertArg.snomed_code).toBe(LD_SNOMED_CODES.SPONTANEOUS_VAGINAL);
  });

  it('returns failure on database error', async () => {
    mockInsert.mockRejectedValueOnce(new Error('DB connection failed'));
    const result = await LDProcedureService.createProcedureFromDelivery(vaginalDelivery);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// =====================================================
// LDVitalsObservationService Tests
// =====================================================

describe('LDVitalsObservationService', () => {
  const prenatalVisit: LDPrenatalVisit = {
    id: 'pv-1',
    patient_id: 'p1',
    tenant_id: 't1',
    pregnancy_id: 'preg-1',
    visit_date: '2026-03-15',
    provider_id: 'prov-1',
    gestational_age_weeks: 32,
    gestational_age_days: 4,
    fundal_height_cm: 32,
    fetal_heart_rate: 145,
    fetal_presentation: null,
    weight_kg: 75.5,
    bp_systolic: 130,
    bp_diastolic: 82,
    urine_protein: null,
    urine_glucose: null,
    cervical_dilation_cm: null,
    cervical_effacement_percent: null,
    cervical_station: null,
    edema: false,
    complaints: [],
    notes: null,
    created_at: new Date().toISOString(),
  };

  describe('createObservationsFromPrenatalVisit', () => {
    it('creates observations for BP, weight, FHR, fundal height, and GA', async () => {
      const result = await LDVitalsObservationService.createObservationsFromPrenatalVisit(prenatalVisit);
      expect(result.success).toBe(true);
      // Systolic, Diastolic, Weight, FHR, Fundal Height, GA = 6 observations
      expect(result.data).toHaveLength(6);
    });

    it('maps systolic BP to correct LOINC code', async () => {
      const result = await LDVitalsObservationService.createObservationsFromPrenatalVisit(prenatalVisit);
      const systolic = result.data?.find(
        (o) => o.code.coding?.[0]?.code === LD_LOINC_CODES.MATERNAL_BP_SYSTOLIC
      );
      expect(systolic).toBeDefined();
      expect(systolic?.valueQuantity?.value).toBe(130);
      expect(systolic?.valueQuantity?.unit).toBe('mmHg');
    });

    it('maps fetal heart rate with correct reference range', async () => {
      const result = await LDVitalsObservationService.createObservationsFromPrenatalVisit(prenatalVisit);
      const fhr = result.data?.find(
        (o) => o.code.coding?.[0]?.code === LD_LOINC_CODES.FETAL_HEART_RATE
      );
      expect(fhr).toBeDefined();
      expect(fhr?.valueQuantity?.value).toBe(145);
      expect(fhr?.referenceRange?.[0]?.low?.value).toBe(110);
      expect(fhr?.referenceRange?.[0]?.high?.value).toBe(160);
    });

    it('encodes gestational age as string value', async () => {
      const result = await LDVitalsObservationService.createObservationsFromPrenatalVisit(prenatalVisit);
      const ga = result.data?.find(
        (o) => o.code.coding?.[0]?.code === LD_LOINC_CODES.GESTATIONAL_AGE
      );
      expect(ga).toBeDefined();
      expect(ga?.valueString).toBe('32w4d');
    });

    it('skips optional FHR when not recorded', async () => {
      const noFHR = { ...prenatalVisit, fetal_heart_rate: null };
      const result = await LDVitalsObservationService.createObservationsFromPrenatalVisit(noFHR);
      // Without FHR: Systolic, Diastolic, Weight, Fundal Height, GA = 5
      expect(result.data).toHaveLength(5);
    });

    it('stores observations in fhir_observations table', async () => {
      await LDVitalsObservationService.createObservationsFromPrenatalVisit(prenatalVisit);
      // 6 observations → 6 inserts
      expect(mockInsert).toHaveBeenCalledTimes(6);
    });
  });

  describe('createObservationsFromLaborEvent', () => {
    const laborEvent: LDLaborEvent = {
      id: 'le-1',
      patient_id: 'p1',
      tenant_id: 't1',
      pregnancy_id: 'preg-1',
      event_time: '2026-04-10T08:00:00Z',
      stage: 'active_phase',
      dilation_cm: 7,
      effacement_percent: 90,
      station: 0,
      contraction_frequency_per_10min: 5,
      contraction_duration_seconds: 55,
      contraction_intensity: 'strong',
      membrane_status: 'srom',
      membrane_rupture_time: null,
      fluid_color: 'clear',
      maternal_bp_systolic: 128,
      maternal_bp_diastolic: 78,
      maternal_hr: 92,
      maternal_temp_c: 37.2,
      notes: null,
      created_at: new Date().toISOString(),
    };

    it('creates observations for dilation, station, and maternal vitals', async () => {
      const result = await LDVitalsObservationService.createObservationsFromLaborEvent(laborEvent);
      expect(result.success).toBe(true);
      // Dilation, Station, Systolic, Diastolic, HR, Temp = 6
      expect(result.data).toHaveLength(6);
    });

    it('maps cervical dilation correctly', async () => {
      const result = await LDVitalsObservationService.createObservationsFromLaborEvent(laborEvent);
      const dilation = result.data?.find(
        (o) => o.code.coding?.[0]?.code === '11979-2'
      );
      expect(dilation).toBeDefined();
      expect(dilation?.valueQuantity?.value).toBe(7);
      expect(dilation?.valueQuantity?.unit).toBe('cm');
    });

    it('maps fetal station as string with sign', async () => {
      const result = await LDVitalsObservationService.createObservationsFromLaborEvent(laborEvent);
      const station = result.data?.find(
        (o) => o.code.coding?.[0]?.code === '11980-0'
      );
      expect(station).toBeDefined();
      expect(station?.valueString).toBe('0');
    });

    it('maps positive station with plus sign', async () => {
      const positiveStation = { ...laborEvent, station: 2 };
      const result = await LDVitalsObservationService.createObservationsFromLaborEvent(positiveStation);
      const station = result.data?.find(
        (o) => o.code.coding?.[0]?.code === '11980-0'
      );
      expect(station?.valueString).toBe('+2');
    });

    it('skips optional vitals when not recorded', async () => {
      const minimalEvent = {
        ...laborEvent,
        maternal_bp_systolic: null,
        maternal_bp_diastolic: null,
        maternal_hr: null,
        maternal_temp_c: null,
      };
      const result = await LDVitalsObservationService.createObservationsFromLaborEvent(minimalEvent);
      // Only Dilation + Station = 2
      expect(result.data).toHaveLength(2);
    });

    it('returns failure on error', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Insert failed'));
      const result = await LDVitalsObservationService.createObservationsFromLaborEvent(laborEvent);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
