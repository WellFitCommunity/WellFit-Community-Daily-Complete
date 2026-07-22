/**
 * Transfer writer column-shape guard (tracker E-6 + H-4, 2026-07-22)
 *
 * Both transfer integration writers previously inserted columns that do not
 * exist on the live tables (encounters.start_time/location/notes/metadata,
 * per-column vitals into the 7-column ehr_observations jsonb cache, the
 * nonexistent billing_codes table) and omitted NOT NULL tenant_id +
 * date_of_service — every integration failed and no test caught it because
 * none asserted the column set. These tests pin the insert payloads to the
 * live schema (verified via `supabase db query --linked`, 2026-07-22).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Live encounters column set (complete — pulled 2026-07-22)
const ENCOUNTERS_LIVE = new Set([
  'id', 'patient_id', 'provider_id', 'encounter_type', 'date_of_service',
  'place_of_service', 'status', 'chief_complaint', 'clinical_notes',
  'claim_frequency_code', 'subscriber_relation_code', 'created_by',
  'created_at', 'updated_at', 'visit_mode', 'telehealth_session_id',
  'tenant_id', 'facility_id', 'status_changed_at', 'status_changed_by',
  'appointment_id', 'arrived_at', 'triaged_at', 'visit_started_at',
  'visit_ended_at', 'signed_at', 'signed_by', 'coverage_verified_at',
  'coverage_status', 'coverage_details',
]);

// fhir_observations columns the vitals writers use (subset of the live 77)
const FHIR_OBS_LIVE = new Set([
  'patient_id', 'encounter_id', 'tenant_id', 'status', 'category', 'code',
  'code_system', 'code_display', 'value_quantity_value', 'value_quantity_unit',
  'effective_datetime', 'sync_source', 'note',
]);

// Live encounter_billing_suggestions column set (complete — pulled 2026-07-22)
const BILLING_SUGGESTIONS_LIVE = new Set([
  'id', 'tenant_id', 'encounter_id', 'patient_id', 'encounter_start',
  'encounter_end', 'encounter_duration_minutes', 'encounter_type',
  'chief_complaint', 'suggested_codes', 'overall_confidence', 'requires_review',
  'review_reason', 'status', 'provider_id', 'provider_accepted_at',
  'provider_modifications', 'final_codes_used', 'ai_model_used', 'ai_cost',
  'from_cache', 'ai_prediction_tracking_id', 'created_at', 'updated_at',
]);

interface Captured {
  table: string;
  payload: Record<string, unknown> | Record<string, unknown>[];
}
const capturedInserts: Captured[] = [];
const capturedUpdates: Captured[] = [];
const invokedFunctions: Array<{ name: string; body: Record<string, unknown> }> = [];

let encountersInsertError: { message: string } | null = null;

function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {};
  builder.insert = vi.fn((payload: Record<string, unknown>) => {
    capturedInserts.push({ table, payload });
    const insertResult = table === 'encounters' && encountersInsertError
      ? { data: null, error: encountersInsertError }
      : { data: null, error: null };
    return {
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue(
          encountersInsertError && table === 'encounters'
            ? { data: null, error: encountersInsertError }
            : { data: { id: `${table}-row-id` }, error: null }
        ),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: [{ id: `${table}-row-id` }], error: null }).then(resolve),
      })),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(insertResult).then(resolve),
    };
  });
  builder.update = vi.fn((payload: Record<string, unknown>) => {
    capturedUpdates.push({ table, payload });
    return {
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });
  builder.select = vi.fn((cols: string) => {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.limit = vi.fn().mockResolvedValue({ data: [], error: null }); // no MRN match
    chain.single = vi.fn().mockResolvedValue(
      cols === 'tenant_id'
        ? { data: { tenant_id: 'tenant-test-0001' }, error: null }
        : { data: null, error: null }
    );
    return chain;
  });
  return builder;
}

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => makeBuilder(table)),
    rpc: vi.fn().mockResolvedValue({ data: 'Decrypted Value', error: null }),
    functions: {
      invoke: vi.fn((name: string, opts: { body: Record<string, unknown> }) => {
        invokedFunctions.push({ name, body: opts.body });
        return Promise.resolve({ data: { success: true, patient_id: 'patient-test-id' }, error: null });
      }),
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'clinician-test-id' } },
        error: null,
      }),
    },
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    error: vi.fn().mockResolvedValue(undefined),
    phi: vi.fn().mockResolvedValue(undefined),
    clinical: vi.fn(),
  },
}));

import { integrateHospitalTransfer } from '../hospitalTransferIntegrationService';
import { integrateEMSHandoff } from '../emsIntegrationService';
import type { HandoffPacket } from '../../types/handoff';
import type { PrehospitalHandoff } from '../emsService';

const TEST_PACKET = {
  id: 'packet-test-id',
  packet_number: 'HT-TEST-0001',
  patient_name_encrypted: 'enc-name',
  patient_dob_encrypted: 'enc-dob',
  patient_mrn: 'TEST-MRN-0001',
  patient_gender: 'F',
  sending_facility: 'Test Sending Hospital',
  receiving_facility: 'Test Receiving Hospital',
  urgency_level: 'critical',
  reason_for_transfer: 'Higher level of care',
  sender_notes: 'Synthetic test packet',
  clinical_data: {
    vitals: {
      blood_pressure_systolic: 150,
      blood_pressure_diastolic: 90,
      heart_rate: 110,
      oxygen_saturation: 93,
      temperature: 100.2,
      temperature_unit: 'F',
      respiratory_rate: 22,
    },
  },
  status: 'sent',
} as unknown as HandoffPacket;

const TEST_HANDOFF: PrehospitalHandoff = {
  id: 'handoff-test-id',
  patient_age: 70,
  patient_gender: 'M',
  chief_complaint: 'Chest pain',
  eta_hospital: new Date(Date.now() + 600000).toISOString(),
  vitals: { blood_pressure_systolic: 90, heart_rate: 130, oxygen_saturation: 88 },
  stemi_alert: true,
  cardiac_arrest: false,
  paramedic_name: 'Test Paramedic Alpha',
  unit_number: 'TEST-555',
  ems_agency: 'Test EMS Agency',
  receiving_hospital_name: 'Test Receiving Hospital',
};

function insertsFor(table: string): Captured[] {
  return capturedInserts.filter((c) => c.table === table);
}

beforeEach(() => {
  capturedInserts.length = 0;
  capturedUpdates.length = 0;
  invokedFunctions.length = 0;
  encountersInsertError = null;
});

describe('hospitalTransferIntegrationService write shapes', () => {
  it('writes encounters with only live columns, tenant-stamped, no dead columns', async () => {
    const result = await integrateHospitalTransfer('packet-test-id', TEST_PACKET);
    expect(result.success).toBe(true);

    const encounterInserts = insertsFor('encounters');
    expect(encounterInserts).toHaveLength(1);
    const payload = encounterInserts[0].payload as Record<string, unknown>;
    for (const key of Object.keys(payload)) {
      expect(ENCOUNTERS_LIVE.has(key), `encounters.${key} is not a live column`).toBe(true);
    }
    expect(payload.tenant_id).toBe('tenant-test-0001');
    expect(payload.date_of_service).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.status).toBe('arrived');
    expect(payload).not.toHaveProperty('start_time');
    expect(payload).not.toHaveProperty('location');
    expect(payload).not.toHaveProperty('notes');
    expect(payload).not.toHaveProperty('metadata');
  });

  it('writes vitals to fhir_observations (never ehr_observations) with live columns', async () => {
    await integrateHospitalTransfer('packet-test-id', TEST_PACKET);

    expect(insertsFor('ehr_observations')).toHaveLength(0);
    const obsInserts = insertsFor('fhir_observations');
    expect(obsInserts).toHaveLength(1);
    const rows = obsInserts[0].payload as Record<string, unknown>[];
    expect(rows.length).toBe(6); // all six mapped vitals present in TEST_PACKET
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        expect(FHIR_OBS_LIVE.has(key), `fhir_observations.${key} is not in the pinned live set`).toBe(true);
      }
      expect(row.tenant_id).toBe('tenant-test-0001');
      expect(row.code_system).toBe('http://loinc.org');
    }
  });

  it('stores advisory billing suggestions with live columns and no unconditional G0390', async () => {
    const result = await integrateHospitalTransfer('packet-test-id', TEST_PACKET);

    expect(insertsFor('billing_codes')).toHaveLength(0);
    const suggInserts = insertsFor('encounter_billing_suggestions');
    expect(suggInserts).toHaveLength(1);
    const payload = suggInserts[0].payload as Record<string, unknown>;
    for (const key of Object.keys(payload)) {
      expect(BILLING_SUGGESTIONS_LIVE.has(key), `encounter_billing_suggestions.${key} is not a live column`).toBe(true);
    }
    expect(payload.requires_review).toBe(true);
    expect(payload.status).toBe('pending');
    const codes = (payload.suggested_codes as Array<{ code: string }>).map((c) => c.code);
    expect(codes).not.toContain('G0390');
    expect(codes).toContain('99223'); // critical transfer
    expect(result.billingCodes).toContain('99291');
  });

  it('links the packet with exactly the live linkage columns', async () => {
    await integrateHospitalTransfer('packet-test-id', TEST_PACKET);
    const link = capturedUpdates.find((u) => u.table === 'handoff_packets');
    if (!link) throw new Error('handoff_packets update was not captured');
    expect(Object.keys(link.payload as Record<string, unknown>).sort()).toEqual(
      ['encounter_id', 'integrated_at', 'patient_id']
    );
  });

  it('creates the patient via the register-transfer-patient edge function, never browser admin APIs', async () => {
    await integrateHospitalTransfer('packet-test-id', TEST_PACKET);
    const registration = invokedFunctions.find((f) => f.name === 'register-transfer-patient');
    if (!registration) throw new Error('register-transfer-patient was not invoked');
    expect(registration.body.source).toBe('hospital_transfer');
    expect(registration.body.source_reference).toBe('packet-test-id');
  });

  it('fails loudly when the encounter insert is rejected', async () => {
    encountersInsertError = { message: 'permission denied' };
    const result = await integrateHospitalTransfer('packet-test-id', TEST_PACKET);
    expect(result.success).toBe(false);
    expect(result.error).toContain('encounter');
  });
});

describe('emsIntegrationService write shapes', () => {
  it('writes encounters with only live columns, tenant-stamped', async () => {
    const result = await integrateEMSHandoff('handoff-test-id', TEST_HANDOFF);
    expect(result.success).toBe(true);

    const encounterInserts = insertsFor('encounters');
    expect(encounterInserts).toHaveLength(1);
    const payload = encounterInserts[0].payload as Record<string, unknown>;
    for (const key of Object.keys(payload)) {
      expect(ENCOUNTERS_LIVE.has(key), `encounters.${key} is not a live column`).toBe(true);
    }
    expect(payload.tenant_id).toBe('tenant-test-0001');
    expect(payload.encounter_type).toBe('emergency');
    expect(payload.status).toBe('arrived');
    expect(payload).not.toHaveProperty('started_at');
    expect(payload).not.toHaveProperty('urgency');
    expect(payload).not.toHaveProperty('metadata');
  });

  it('writes EMS vitals to fhir_observations with live columns', async () => {
    await integrateEMSHandoff('handoff-test-id', TEST_HANDOFF);
    expect(insertsFor('ehr_observations')).toHaveLength(0);
    const rows = insertsFor('fhir_observations')[0].payload as Record<string, unknown>[];
    expect(rows.length).toBe(3); // systolic, HR, SpO2 present in TEST_HANDOFF
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        expect(FHIR_OBS_LIVE.has(key), `fhir_observations.${key} is not in the pinned live set`).toBe(true);
      }
      expect(row.sync_source).toBe('ems_handoff');
    }
  });

  it('registers the temp patient through the edge function with source ems', async () => {
    await integrateEMSHandoff('handoff-test-id', TEST_HANDOFF);
    const registration = invokedFunctions.find((f) => f.name === 'register-transfer-patient');
    if (!registration) throw new Error('register-transfer-patient was not invoked');
    expect(registration.body.source).toBe('ems');
    expect(registration.body.first_name).toBe('EMS-TEST-555');
  });

  it('stores advisory EMS billing suggestions in encounter_billing_suggestions', async () => {
    await integrateEMSHandoff('handoff-test-id', TEST_HANDOFF);
    const suggInserts = insertsFor('encounter_billing_suggestions');
    expect(suggInserts).toHaveLength(1);
    const payload = suggInserts[0].payload as Record<string, unknown>;
    for (const key of Object.keys(payload)) {
      expect(BILLING_SUGGESTIONS_LIVE.has(key), `encounter_billing_suggestions.${key} is not a live column`).toBe(true);
    }
    const codes = (payload.suggested_codes as Array<{ code: string }>).map((c) => c.code);
    expect(codes).toContain('99284'); // STEMI alert → moderate-to-high severity
  });

  it('links the handoff with exactly the live linkage columns', async () => {
    await integrateEMSHandoff('handoff-test-id', TEST_HANDOFF);
    const link = capturedUpdates.find((u) => u.table === 'prehospital_handoffs');
    if (!link) throw new Error('prehospital_handoffs update was not captured');
    expect(Object.keys(link.payload as Record<string, unknown>).sort()).toEqual(
      ['encounter_id', 'integrated_at', 'patient_id']
    );
  });
});
