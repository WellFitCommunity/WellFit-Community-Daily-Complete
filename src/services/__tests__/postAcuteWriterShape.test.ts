/**
 * Post-acute transfer column-shape guard (transfer tracker P-3, 2026-07-23)
 *
 * postAcuteTransferService previously read 3 NONEXISTENT tables
 * (patient_medications / patient_allergies / functional_assessments) and dead
 * profile columns (full_name/date_of_birth/facility_name) — every composition
 * was runtime-dead and no test caught it. These tests pin every read to the
 * live column sets (verified via psql information_schema, 2026-07-23) and the
 * discharge-flow draft-composition contract.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Live column sets (subset the service reads)
const LIVE_COLUMNS: Record<string, Set<string>> = {
  profiles: new Set(['user_id', 'first_name', 'last_name', 'dob', 'mrn', 'gender', 'phone', 'tenant_id']),
  encounters: new Set(['id', 'patient_id', 'encounter_type', 'status', 'chief_complaint', 'date_of_service', 'arrived_at', 'visit_ended_at']),
  medications: new Set(['id', 'medication_name', 'dosage', 'frequency', 'route', 'instructions', 'status', 'user_id']),
  allergy_intolerances: new Set(['id', 'allergen_name', 'reaction_description', 'reaction_manifestation', 'severity', 'clinical_status', 'user_id']),
  fhir_observations: new Set(['id', 'code', 'code_display', 'value_quantity_value', 'value_quantity_unit', 'effective_datetime']),
  encounter_diagnoses: new Set(['id', 'code', 'description', 'sequence']),
  risk_assessments_decrypted: new Set(['id', 'mobility_risk_score', 'cognitive_risk_score', 'overall_score', 'risk_level', 'walking_ability', 'bathing_ability', 'medication_management', 'created_at']),
  tenants: new Set(['id', 'name']),
};

const capturedSelects: Array<{ table: string; columns: string }> = [];
const capturedUpdates: Array<{ table: string; payload: Record<string, unknown> }> = [];

function makeBuilder(table: string) {
  const rowFor = (t: string): Record<string, unknown> | null => {
    switch (t) {
      case 'profiles':
        return { user_id: 'u', first_name: 'Test', last_name: 'Patient Alpha', dob: '2000-01-01', mrn: 'TEST-1', gender: 'U', phone: '555-0100', tenant_id: 'tenant-1' };
      case 'encounters':
        return { id: 'enc-1', patient_id: 'u', encounter_type: 'inpatient', status: 'completed', chief_complaint: 'test', date_of_service: '2026-07-23', arrived_at: null, visit_ended_at: null };
      case 'tenants':
        return { id: 'tenant-1', name: 'Test Hospital' };
      case 'discharge_plans':
        return null; // draft path: no plan on file
      case 'risk_assessments_decrypted':
        return null; // no assessment — service must say so, not fabricate
      default:
        return null;
    }
  };

  const chain: Record<string, unknown> = {};
  const resolve = () => Promise.resolve({ data: rowFor(table), error: null });
  const resolveList = () => Promise.resolve({ data: [], error: null });
  chain.select = vi.fn((columns: string) => {
    capturedSelects.push({ table, columns });
    return chain;
  });
  chain.update = vi.fn((payload: Record<string, unknown>) => {
    capturedUpdates.push({ table, payload });
    return chain;
  });
  chain.eq = vi.fn(() => chain);
  chain.contains = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => ({
    maybeSingle: vi.fn(resolve),
    then: (r: (v: unknown) => unknown) => resolveList().then(r),
  }));
  chain.maybeSingle = vi.fn(resolve);
  chain.single = vi.fn(resolve);
  chain.then = (r: (v: unknown) => unknown) => resolveList().then(r);
  return chain;
}

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => makeBuilder(table)),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'clinician-1', email: 'clinician@test.example' } },
        error: null,
      }),
    },
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    phi: vi.fn().mockResolvedValue(undefined),
  },
}));

const createPacketMock = vi.fn().mockResolvedValue({
  packet: { id: 'packet-1' },
  access_url: 'https://example.test/handoff/view/packet-1',
});
vi.mock('../handoffService', () => ({
  HandoffService: {
    createPacket: (...args: unknown[]) => createPacketMock(...args),
    sendPacket: vi.fn().mockResolvedValue({}),
  },
}));

import { PostAcuteTransferService } from '../postAcuteTransferService';

beforeEach(() => {
  capturedSelects.length = 0;
  capturedUpdates.length = 0;
  createPacketMock.mockClear();
});

describe('postAcuteTransferService — read shapes (P-1)', () => {
  it('every table read uses only live columns (no dead tables, no dead columns)', async () => {
    const result = await PostAcuteTransferService.composeDraftForDischarge('u', 'Skilled Nursing Facility');
    expect(result.success).toBe(true);

    // The dead tables must never be touched
    const tablesRead = new Set(capturedSelects.map(c => c.table));
    expect(tablesRead.has('patient_medications')).toBe(false);
    expect(tablesRead.has('patient_allergies')).toBe(false);
    expect(tablesRead.has('functional_assessments')).toBe(false);
    expect(tablesRead.has('ehr_observations')).toBe(false);

    for (const { table, columns } of capturedSelects) {
      const live = LIVE_COLUMNS[table];
      if (!live) continue; // discharge_plans / handoff_packets pinned by transferWriterShape
      for (const col of columns.split(',').map(c => c.trim())) {
        expect(live.has(col), `${table}.${col} is not a live column`).toBe(true);
      }
    }
  });

  it('composes a DRAFT packet with chart sections and honest empty-state notes', async () => {
    const result = await PostAcuteTransferService.composeDraftForDischarge('u', 'Hospice');
    expect(result.success).toBe(true);
    expect(result.handoff_packet_id).toBe('packet-1');

    const packetRequest = createPacketMock.mock.calls[0][0] as Record<string, unknown>;
    expect(packetRequest.patient_name).toBe('Test Patient Alpha');
    expect(packetRequest.patient_dob).toBe('2000-01-01');
    expect(packetRequest.sending_facility).toBe('Test Hospital');

    const clinical = packetRequest.clinical_data as Record<string, unknown>;
    // No plan + no assessment on file → honest notes, never fabricated values
    expect((clinical.discharge_needs as Record<string, unknown>).note).toContain('No discharge plan');
    expect((clinical.functional_status as Record<string, unknown>).note).toContain('No functional/risk assessment');
  });

  it('rejects non-post-acute dispositions without touching the chart', async () => {
    const result = await PostAcuteTransferService.composeDraftForDischarge('u', 'Home');
    expect(result.success).toBe(false);
    expect(createPacketMock).not.toHaveBeenCalled();
  });

  it('marks the packet as post-acute with the mapped facility type', async () => {
    await PostAcuteTransferService.composeDraftForDischarge('u', 'Inpatient Rehab');
    const flagUpdate = capturedUpdates.find(u => u.table === 'handoff_packets');
    expect(flagUpdate).toBeDefined();
    expect(flagUpdate?.payload.is_post_acute_transfer).toBe(true);
    expect(flagUpdate?.payload.post_acute_facility_type).toBe('inpatient_rehab');
  });
});
