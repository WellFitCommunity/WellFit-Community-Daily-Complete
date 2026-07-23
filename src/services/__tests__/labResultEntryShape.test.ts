/**
 * Lab-result writer column-shape guard (intake/labs tracker L-1/L-2, 2026-07-23)
 *
 * The lab subsystem shipped with ZERO working ingestion and the write-path
 * classes that killed the readmission + transfer writers (columns that don't
 * exist, missing tenant_id, silent error swallow) had no guard here. These
 * tests pin labResultEntryService.saveLabResult's three insert payloads to the
 * live column sets (verified via psql information_schema, 2026-07-23) and the
 * escalation-engine call contract.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Live lab_results columns the writer uses (subset of the live 40+)
const LAB_RESULTS_LIVE = new Set([
  'patient_id', 'patient_mrn', 'test_name', 'test_code', 'test_category',
  'value', 'value_numeric', 'unit', 'reference_range', 'abnormal_flag',
  'collection_date', 'result_date', 'status', 'performing_lab_name', 'notes',
  'tenant_id', 'fhir_diagnostic_report_id',
]);

// Live fhir_observations columns the writer uses (subset of the live 77)
const FHIR_OBS_LIVE = new Set([
  'fhir_id', 'status', 'category', 'code', 'code_system', 'code_display',
  'code_text', 'patient_id', 'effective_datetime', 'issued',
  'value_quantity_value', 'value_quantity_unit', 'interpretation_code',
  'interpretation_display', 'reference_range_text', 'sync_source', 'tenant_id',
]);

// Live fhir_diagnostic_reports columns the writer uses (complete live set is 32)
const FHIR_DR_LIVE = new Set([
  'fhir_id', 'status', 'category', 'code', 'code_system', 'code_display',
  'code_text', 'patient_id', 'effective_datetime', 'issued',
  'result_observation_ids', 'conclusion', 'report_priority', 'sync_source',
  'tenant_id',
]);

interface Captured {
  table: string;
  payload: Record<string, unknown>;
}
const capturedInserts: Captured[] = [];
const capturedUpdates: Captured[] = [];
let labInsertError: { message: string } | null = null;

function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {};
  builder.insert = vi.fn((payload: Record<string, unknown>) => {
    capturedInserts.push({ table, payload });
    return {
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue(
          table === 'lab_results' && labInsertError
            ? { data: null, error: labInsertError }
            : { data: { id: `${table}-row-id` }, error: null }
        ),
      })),
    };
  });
  builder.update = vi.fn((payload: Record<string, unknown>) => {
    capturedUpdates.push({ table, payload });
    return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
  });
  builder.select = vi.fn(() => {
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn(() => chain);
    chain.single = vi.fn().mockResolvedValue({
      data: { tenant_id: 'tenant-test-0001' }, error: null,
    });
    return chain;
  });
  return builder;
}

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => makeBuilder(table)),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'clinician-test-id' } },
        error: null,
      }),
    },
  },
}));

const evaluateResultMock = vi.fn().mockResolvedValue({ success: true, data: [] });
vi.mock('../resultEscalationService', () => ({
  resultEscalationService: {
    evaluateResult: (...args: unknown[]) => evaluateResultMock(...args),
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

import { labResultEntryService } from '../labResultEntryService';

function mustFind(list: Captured[], table: string): Captured {
  const found = list.find(c => c.table === table);
  if (!found) throw new Error(`expected a captured write for ${table}`);
  return found;
}

const INPUT = {
  patientId: 'patient-test-alpha-id',
  testKey: 'potassium',
  testDisplay: 'Potassium',
  loincCode: '2823-3',
  testCategory: 'chemistry' as const,
  valueNumeric: 6.2,
  unit: 'mmol/L',
  referenceRange: '3.5-5.1',
  abnormalFlag: 'critical_high' as const,
};

beforeEach(() => {
  capturedInserts.length = 0;
  capturedUpdates.length = 0;
  labInsertError = null;
  evaluateResultMock.mockClear();
  evaluateResultMock.mockResolvedValue({ success: true, data: [] });
});

describe('labResultEntryService.saveLabResult — write shapes', () => {
  it('inserts lab_results with only live columns, tenant stamped, MRN non-null', async () => {
    const result = await labResultEntryService.saveLabResult(INPUT);
    expect(result.success).toBe(true);

    const labInsert = mustFind(capturedInserts, 'lab_results');
    for (const key of Object.keys(labInsert.payload)) {
      expect(LAB_RESULTS_LIVE.has(key), `lab_results.${key} is not a live column`).toBe(true);
    }
    expect(labInsert.payload.tenant_id).toBe('tenant-test-0001');
    expect(labInsert.payload.patient_mrn).toBeTruthy();
    expect(labInsert.payload.status).toBe('final');
    expect(labInsert.payload.abnormal_flag).toBe('critical_high');
  });

  it('mirrors to fhir_observations with laboratory category and live columns only', async () => {
    await labResultEntryService.saveLabResult(INPUT);

    const obsInsert = mustFind(capturedInserts, 'fhir_observations');
    for (const key of Object.keys(obsInsert.payload)) {
      expect(FHIR_OBS_LIVE.has(key), `fhir_observations.${key} is not a live column`).toBe(true);
    }
    expect(obsInsert.payload.category).toEqual(['laboratory']);
    expect(obsInsert.payload.value_quantity_value).toBe(6.2);
    // interpretation_* are text[] on the live table
    expect(obsInsert.payload.interpretation_code).toEqual(['HH']);
    expect(obsInsert.payload.tenant_id).toBe('tenant-test-0001');
  });

  it('creates the acknowledgment-queue fhir_diagnostic_reports row (stat priority for critical)', async () => {
    await labResultEntryService.saveLabResult(INPUT);

    const drInsert = mustFind(capturedInserts, 'fhir_diagnostic_reports');
    for (const key of Object.keys(drInsert.payload)) {
      expect(FHIR_DR_LIVE.has(key), `fhir_diagnostic_reports.${key} is not a live column`).toBe(true);
    }
    expect(drInsert.payload.report_priority).toBe('stat');
    expect(drInsert.payload.status).toBe('final');
    expect(drInsert.payload.result_observation_ids).toEqual(['fhir_observations-row-id']);
    expect(drInsert.payload.issued).toBeTruthy();
  });

  it('routine (non-critical) results get routine priority', async () => {
    await labResultEntryService.saveLabResult({ ...INPUT, abnormalFlag: 'normal', valueNumeric: 4.2 });
    const drInsert = mustFind(capturedInserts, 'fhir_diagnostic_reports');
    expect(drInsert.payload.report_priority).toBe('routine');
  });

  it('calls the escalation engine with the normalized test key and lab_results source', async () => {
    await labResultEntryService.saveLabResult(INPUT);
    expect(evaluateResultMock).toHaveBeenCalledWith(
      'potassium', 6.2, 'mmol/L', 'patient-test-alpha-id',
      'lab_results-row-id', 'lab_results', 'tenant-test-0001'
    );
  });

  it('fails loud (no silent swallow) when the lab_results insert errors', async () => {
    labInsertError = { message: 'permission denied for table lab_results' };
    const result = await labResultEntryService.saveLabResult(INPUT);
    expect(result.success).toBe(false);
    // and nothing downstream ran
    expect(capturedInserts.find(c => c.table === 'fhir_observations')).toBeUndefined();
    expect(evaluateResultMock).not.toHaveBeenCalled();
  });

  it('links the lab row to its diagnostic report id', async () => {
    await labResultEntryService.saveLabResult(INPUT);
    const labUpdate = mustFind(capturedUpdates, 'lab_results');
    expect(labUpdate.payload.fhir_diagnostic_report_id).toBe('dr-lab-lab_results-row-id');
  });
});
