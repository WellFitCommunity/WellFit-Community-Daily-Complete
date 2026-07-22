/**
 * emsIntegrationService behavioral tests
 *
 * Column-shape pinning lives in transferWriterShape.test.ts; these tests cover
 * flow behavior: auth/tenant gates, temp-patient registration via the
 * register-transfer-patient edge function, severity-driven billing
 * suggestions, and integration status reads.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

const state = {
  user: { id: 'clinician-test-id' } as { id: string } | null,
  tenantId: 'tenant-test-0001' as string | null,
  registerResult: { data: { success: true, patient_id: 'patient-temp-id' }, error: null } as {
    data: Record<string, unknown> | null;
    error: { message: string } | null;
  },
  handoffRow: null as Record<string, unknown> | null,
  observationCount: 0,
};

const invokedFunctions: Array<{ name: string; body: Record<string, unknown> }> = [];
const insertedPayloads: Array<{ table: string; payload: unknown }> = [];

function makeBuilder(table: string) {
  return {
    insert: vi.fn((payload: unknown) => {
      insertedPayloads.push({ table, payload });
      return {
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: `${table}-row-id` }, error: null }),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: [{ id: `${table}-row-id` }], error: null }).then(resolve),
        })),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
      };
    }),
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    select: vi.fn((cols: string, opts?: { count?: string; head?: boolean }) => {
      const chain: Record<string, unknown> = {};
      chain.eq = vi.fn(() => {
        if (opts?.head) {
          return Promise.resolve({ count: state.observationCount, error: null });
        }
        return chain;
      });
      chain.single = vi.fn().mockResolvedValue(
        cols === 'tenant_id'
          ? state.tenantId
            ? { data: { tenant_id: state.tenantId }, error: null }
            : { data: null, error: { message: 'not found' } }
          : state.handoffRow
            ? { data: state.handoffRow, error: null }
            : { data: null, error: { message: 'not found' } }
      );
      return chain;
    }),
  };
}

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => makeBuilder(table)),
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

import { integrateEMSHandoff, getHandoffIntegrationStatus } from '../emsIntegrationService';
import type { PrehospitalHandoff } from '../emsService';

function makeHandoff(overrides: Partial<PrehospitalHandoff> = {}): PrehospitalHandoff {
  return {
    id: 'handoff-test-id',
    patient_age: 70,
    patient_gender: 'M',
    chief_complaint: 'Chest pain',
    eta_hospital: new Date(Date.now() + 600000).toISOString(),
    vitals: { blood_pressure_systolic: 120, heart_rate: 88 },
    paramedic_name: 'Test Paramedic Alpha',
    unit_number: 'TEST-555',
    ems_agency: 'Test EMS Agency',
    receiving_hospital_name: 'Test Receiving Hospital',
    ...overrides,
  };
}

function suggestionCodes(): string[] {
  const row = insertedPayloads.find((p) => p.table === 'encounter_billing_suggestions');
  if (!row) return [];
  return ((row.payload as Record<string, unknown>).suggested_codes as Array<{ code: string }>).map(
    (c) => c.code
  );
}

beforeEach(() => {
  state.user = { id: 'clinician-test-id' };
  state.tenantId = 'tenant-test-0001';
  state.registerResult = { data: { success: true, patient_id: 'patient-temp-id' }, error: null };
  state.handoffRow = null;
  state.observationCount = 0;
  invokedFunctions.length = 0;
  insertedPayloads.length = 0;
});

describe('integrateEMSHandoff', () => {
  it('integrates a handoff end-to-end: temp patient, ER encounter, vitals, suggestions', async () => {
    const result = await integrateEMSHandoff('handoff-test-id', makeHandoff());

    expect(result.success).toBe(true);
    expect(result.patientId).toBe('patient-temp-id');
    expect(result.encounterId).toBe('encounters-row-id');
    expect(insertedPayloads.map((p) => p.table)).toEqual(
      expect.arrayContaining(['encounters', 'fhir_observations', 'encounter_billing_suggestions'])
    );
    const registration = invokedFunctions.find((f) => f.name === 'register-transfer-patient');
    if (!registration) throw new Error('register-transfer-patient was not invoked');
    expect(registration.body.source).toBe('ems');
  });

  it('returns error when user is not authenticated', async () => {
    state.user = null;
    const result = await integrateEMSHandoff('handoff-test-id', makeHandoff());
    expect(result.success).toBe(false);
    expect(result.error).toContain('authenticated');
  });

  it('returns error when the caller tenant cannot be resolved', async () => {
    state.tenantId = null;
    const result = await integrateEMSHandoff('handoff-test-id', makeHandoff());
    expect(result.success).toBe(false);
    expect(result.error).toContain('tenant');
  });

  it('fails when temp-patient registration fails', async () => {
    state.registerResult = { data: null, error: { message: 'forbidden' } };
    const result = await integrateEMSHandoff('handoff-test-id', makeHandoff());
    expect(result.success).toBe(false);
  });

  it('suggests high-severity ED code for STEMI alerts', async () => {
    await integrateEMSHandoff('handoff-test-id', makeHandoff({ stemi_alert: true }));
    expect(suggestionCodes()).toContain('99284');
  });

  it('suggests critical care alongside high-severity ED code for cardiac arrest', async () => {
    await integrateEMSHandoff('handoff-test-id', makeHandoff({ cardiac_arrest: true }));
    expect(suggestionCodes()).toEqual(expect.arrayContaining(['99285', '99291']));
  });

  it('suggests moderate ED code when no alerts are active', async () => {
    await integrateEMSHandoff('handoff-test-id', makeHandoff());
    expect(suggestionCodes()).toEqual(['99283']);
  });
});

describe('getHandoffIntegrationStatus', () => {
  it('returns integrated status with observation count when linked', async () => {
    state.handoffRow = {
      patient_id: 'patient-temp-id',
      encounter_id: 'encounter-id',
      integrated_at: new Date().toISOString(),
    };
    state.observationCount = 3;

    const status = await getHandoffIntegrationStatus('handoff-test-id');
    expect(status.isIntegrated).toBe(true);
    expect(status.patientId).toBe('patient-temp-id');
    expect(status.observationCount).toBe(3);
  });

  it('returns not integrated when handoff is unlinked', async () => {
    state.handoffRow = { patient_id: null, encounter_id: null, integrated_at: null };
    const status = await getHandoffIntegrationStatus('handoff-test-id');
    expect(status.isIntegrated).toBe(false);
  });

  it('returns not integrated when handoff is not found', async () => {
    state.handoffRow = null;
    const status = await getHandoffIntegrationStatus('handoff-test-id');
    expect(status.isIntegrated).toBe(false);
  });
});
