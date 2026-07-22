/**
 * hospitalTransferIntegrationService behavioral tests
 *
 * Column-shape pinning lives in transferWriterShape.test.ts; these tests cover
 * the flow behavior: auth gate, MRN match vs edge-fn registration, decrypt
 * failure, urgency-driven billing suggestions, and step-failure surfacing.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

const state = {
  user: { id: 'clinician-test-id' } as { id: string } | null,
  tenantId: 'tenant-test-0001' as string | null,
  mrnMatches: [] as Array<{ user_id: string }>,
  decryptError: null as { message: string } | null,
  registerResult: { data: { success: true, patient_id: 'patient-new-id' }, error: null } as {
    data: Record<string, unknown> | null;
    error: { message: string } | null;
  },
  encounterError: null as { message: string } | null,
};

const invokedFunctions: Array<{ name: string; body: Record<string, unknown> }> = [];
const insertedTables: string[] = [];

function makeBuilder(table: string) {
  return {
    insert: vi.fn(() => {
      insertedTables.push(table);
      const err = table === 'encounters' ? state.encounterError : null;
      return {
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue(
            err ? { data: null, error: err } : { data: { id: `${table}-row-id` }, error: null }
          ),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [{ id: `${table}-row-id` }], error: null }).then(resolve),
        })),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: null, error: err }).then(resolve),
      };
    }),
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    select: vi.fn((cols: string) => {
      const chain: Record<string, unknown> = {};
      chain.eq = vi.fn(() => chain);
      chain.limit = vi.fn().mockResolvedValue({ data: state.mrnMatches, error: null });
      chain.single = vi.fn().mockResolvedValue(
        cols === 'tenant_id'
          ? state.tenantId
            ? { data: { tenant_id: state.tenantId }, error: null }
            : { data: null, error: { message: 'not found' } }
          : { data: null, error: null }
      );
      return chain;
    }),
  };
}

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => makeBuilder(table)),
    rpc: vi.fn(() =>
      Promise.resolve(
        state.decryptError
          ? { data: null, error: state.decryptError }
          : { data: 'Test Patient Alpha', error: null }
      )
    ),
    functions: {
      invoke: vi.fn((name: string, opts: { body: Record<string, unknown> }) => {
        invokedFunctions.push({ name, body: opts.body });
        return Promise.resolve(state.registerResult);
      }),
    },
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: state.user }, error: null })),
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
import type { HandoffPacket } from '../../types/handoff';

function makePacket(overrides: Partial<HandoffPacket> = {}): HandoffPacket {
  return {
    id: 'packet-test-id',
    packet_number: 'HT-TEST-0001',
    patient_name_encrypted: 'enc-name',
    patient_dob_encrypted: 'enc-dob',
    patient_mrn: 'TEST-MRN-0001',
    patient_gender: 'F',
    sending_facility: 'Test Sending Hospital',
    receiving_facility: 'Test Receiving Hospital',
    urgency_level: 'routine',
    reason_for_transfer: 'Continued care',
    sender_notes: 'Synthetic test packet',
    clinical_data: { vitals: { heart_rate: 80 } },
    status: 'sent',
    ...overrides,
  } as unknown as HandoffPacket;
}

beforeEach(() => {
  state.user = { id: 'clinician-test-id' };
  state.tenantId = 'tenant-test-0001';
  state.mrnMatches = [];
  state.decryptError = null;
  state.registerResult = { data: { success: true, patient_id: 'patient-new-id' }, error: null };
  state.encounterError = null;
  invokedFunctions.length = 0;
  insertedTables.length = 0;
});

describe('integrateHospitalTransfer', () => {
  it('integrates a transfer end-to-end: patient, encounter, vitals, suggestions, linkage', async () => {
    const result = await integrateHospitalTransfer('packet-test-id', makePacket());

    expect(result.success).toBe(true);
    expect(result.patientId).toBe('patient-new-id');
    expect(result.encounterId).toBe('encounters-row-id');
    expect(insertedTables).toContain('encounters');
    expect(insertedTables).toContain('fhir_observations');
    expect(insertedTables).toContain('encounter_billing_suggestions');
  });

  it('returns error when user is not authenticated', async () => {
    state.user = null;
    const result = await integrateHospitalTransfer('packet-test-id', makePacket());
    expect(result.success).toBe(false);
    expect(result.error).toContain('authenticated');
  });

  it('returns error when the caller tenant cannot be resolved', async () => {
    state.tenantId = null;
    const result = await integrateHospitalTransfer('packet-test-id', makePacket());
    expect(result.success).toBe(false);
    expect(result.error).toContain('tenant');
  });

  it('uses the MRN-matched patient instead of registering a new one', async () => {
    state.mrnMatches = [{ user_id: 'existing-patient-id' }];
    const result = await integrateHospitalTransfer('packet-test-id', makePacket());

    expect(result.success).toBe(true);
    expect(result.patientId).toBe('existing-patient-id');
    expect(invokedFunctions.find((f) => f.name === 'register-transfer-patient')).toBeUndefined();
  });

  it('fails when PHI decryption fails for an unmatched patient', async () => {
    state.decryptError = { message: 'decryption failed' };
    const result = await integrateHospitalTransfer('packet-test-id', makePacket());
    expect(result.success).toBe(false);
    expect(result.error).toContain('patient');
  });

  it('fails when patient registration fails', async () => {
    state.registerResult = { data: null, error: { message: 'registration rejected' } };
    const result = await integrateHospitalTransfer('packet-test-id', makePacket());
    expect(result.success).toBe(false);
  });

  it('suggests critical-care codes only for critical transfers', async () => {
    const critical = await integrateHospitalTransfer(
      'packet-test-id',
      makePacket({ urgency_level: 'critical' } as Partial<HandoffPacket>)
    );
    expect(critical.billingCodes).toEqual(expect.arrayContaining(['99223', '99291']));

    const routine = await integrateHospitalTransfer('packet-test-id', makePacket());
    expect(routine.billingCodes).toEqual(['99221']);
  });

  it('surfaces encounter failure with the patient already resolved', async () => {
    state.encounterError = { message: 'row-level security violation' };
    const result = await integrateHospitalTransfer('packet-test-id', makePacket());
    expect(result.success).toBe(false);
    expect(result.patientId).toBe('patient-new-id');
    expect(result.error).toContain('encounter');
  });
});
