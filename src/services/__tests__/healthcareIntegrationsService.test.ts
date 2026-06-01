/**
 * healthcareIntegrationsService tests — validates the decomposed integration
 * facade and each domain service's DB-row → typed-model mapping.
 *
 * Deletion Test: every assertion below checks a specific snake_case → camelCase
 * field translation or a specific facade wiring. If a mapper were reduced to
 * `return {}` or a service method to `return success([])`, these tests FAIL.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

// Per-table terminal result, set per test.
const tableResults: Record<string, { data: unknown; error: unknown }> = {};
const rpcResults: Record<string, { data: unknown; error: unknown }> = {};

function setTable(table: string, data: unknown, error: unknown = null) {
  tableResults[table] = { data, error };
}
function setRpc(fn: string, data: unknown, error: unknown = null) {
  rpcResults[fn] = { data, error };
}

// A chainable thenable: every query-builder method returns `this`, and awaiting
// it resolves to the table's configured result.
function makeBuilder(table: string) {
  const result = () => Promise.resolve(tableResults[table] ?? { data: [], error: null });
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'update', 'upsert', 'eq', 'order', 'limit']) {
    builder[m] = () => builder;
  }
  builder.single = () => result();
  builder.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    result().then(resolve, reject);
  return builder;
}

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: (fn: string) => Promise.resolve(rpcResults[fn] ?? { data: [], error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  },
}));

vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import HealthcareIntegrationsService, {
  LabIntegrationService,
  PharmacyIntegrationService,
  ImagingIntegrationService,
  InsuranceVerificationService,
} from '../healthcareIntegrationsService';

beforeEach(() => {
  for (const k of Object.keys(tableResults)) delete tableResults[k];
  for (const k of Object.keys(rpcResults)) delete rpcResults[k];
});

// ============================================================================
// FACADE WIRING
// ============================================================================

describe('HealthcareIntegrationsService facade', () => {
  it('exposes each domain service under its namespace', () => {
    expect(HealthcareIntegrationsService.Lab).toBe(LabIntegrationService);
    expect(HealthcareIntegrationsService.Pharmacy).toBe(PharmacyIntegrationService);
    expect(HealthcareIntegrationsService.Imaging).toBe(ImagingIntegrationService);
    expect(HealthcareIntegrationsService.Insurance).toBe(InsuranceVerificationService);
  });

  it('getStats coerces RPC numeric strings and fails when tenant missing', async () => {
    setTable('profiles', { tenant_id: 'tenant-1' });
    setRpc('get_healthcare_integration_stats', [
      { lab_orders_total: '7', eligibility_verified: '3' },
    ]);

    const ok = await HealthcareIntegrationsService.getStats();
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.labOrdersTotal).toBe(7);
      expect(ok.data.eligibilityVerified).toBe(3);
      expect(ok.data.prescriptionsSent).toBe(0); // absent → defaulted
    }

    setTable('profiles', null);
    const noTenant = await HealthcareIntegrationsService.getStats();
    expect(noTenant.success).toBe(false);
  });
});

// ============================================================================
// LAB DOMAIN
// ============================================================================

describe('LabIntegrationService', () => {
  it('maps lab connection rows from snake_case to camelCase', async () => {
    setTable('lab_provider_connections', [
      { id: 'lab-1', tenant_id: 't1', provider_code: 'LABCORP', provider_name: 'LabCorp', auto_fetch_results: true, orders_sent: 12 },
    ]);

    const res = await LabIntegrationService.getConnections();
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data[0].providerCode).toBe('LABCORP');
      expect(res.data[0].providerName).toBe('LabCorp');
      expect(res.data[0].autoFetchResults).toBe(true);
      expect(res.data[0].ordersSent).toBe(12);
    }
  });

  it('surfaces DB errors as failure results', async () => {
    setTable('lab_provider_connections', null, { message: 'boom' });
    const res = await LabIntegrationService.getConnections();
    expect(res.success).toBe(false);
  });

  it('maps nested lab_order_tests on a patient order', async () => {
    setTable('lab_orders', [
      {
        id: 'o1', tenant_id: 't1', patient_id: 'p1', internal_order_id: 'LAB-1',
        order_status: 'pending', fasting_required: false,
        lab_order_tests: [{ id: 'ot1', order_id: 'o1', test_code: 'CBC', test_name: 'Complete Blood Count', test_status: 'ordered' }],
      },
    ]);
    const res = await LabIntegrationService.getPatientOrders('p1');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data[0].internalOrderId).toBe('LAB-1');
      expect(res.data[0].tests?.[0].testCode).toBe('CBC');
      expect(res.data[0].tests?.[0].testName).toBe('Complete Blood Count');
    }
  });
});

// ============================================================================
// PHARMACY DOMAIN
// ============================================================================

describe('PharmacyIntegrationService', () => {
  it('maps prescription rows including controlled-substance flag', async () => {
    setTable('e_prescriptions', [
      { id: 'rx1', tenant_id: 't1', patient_id: 'p1', prescriber_npi: '1234567893', internal_rx_id: 'RX-1', medication_name: 'Lisinopril', quantity: 30, quantity_unit: 'EA', refills_authorized: 2, sig: 'Take daily', dispense_as_written: false, substitution_allowed: true, is_controlled_substance: false, rx_status: 'draft', written_at: '2026-01-01' },
    ]);
    const res = await PharmacyIntegrationService.getPatientPrescriptions('p1');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data[0].medicationName).toBe('Lisinopril');
      expect(res.data[0].internalRxId).toBe('RX-1');
      expect(res.data[0].isControlledSubstance).toBe(false);
      expect(res.data[0].refillsAuthorized).toBe(2);
    }
  });
});

// ============================================================================
// IMAGING DOMAIN
// ============================================================================

describe('ImagingIntegrationService', () => {
  it('maps critical imaging findings', async () => {
    setTable('imaging_reports', [
      { id: 'r1', tenant_id: 't1', patient_id: 'p1', report_id: 'RPT-1', report_status: 'final', findings: 'mass', impression: 'urgent', has_critical_finding: true, critical_finding_communicated: false, is_amended: false },
    ]);
    const res = await ImagingIntegrationService.getCriticalFindings();
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data[0].reportId).toBe('RPT-1');
      expect(res.data[0].hasCriticalFinding).toBe(true);
      expect(res.data[0].criticalFindingCommunicated).toBe(false);
    }
  });
});

// ============================================================================
// INSURANCE DOMAIN
// ============================================================================

describe('InsuranceVerificationService', () => {
  it('maps payer connection X12 transaction-set support flags', async () => {
    setTable('insurance_payer_connections', [
      { id: 'pay1', tenant_id: 't1', payer_id: 'P1', payer_name: 'Aetna', payer_type: 'commercial', connection_type: 'clearinghouse', supports_270_271: true, supports_835: false, supports_real_time: true, enabled: true },
    ]);
    const res = await InsuranceVerificationService.getPayerConnections();
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data[0].payerName).toBe('Aetna');
      expect(res.data[0].supports270_271).toBe(true);
      expect(res.data[0].supports835).toBe(false);
      expect(res.data[0].supportsRealTime).toBe(true);
    }
  });

  it('maps the get_patient_active_insurance RPC result shape', async () => {
    setRpc('get_patient_active_insurance', [
      { insurance_id: 'ins1', payer_name: 'BCBS', subscriber_id: 'S1', coverage_priority: 1, verification_status: 'verified' },
    ]);
    const res = await InsuranceVerificationService.getPatientInsurance('p1');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data[0].id).toBe('ins1');
      expect(res.data[0].payerName).toBe('BCBS');
      expect(res.data[0].subscriberRelationship).toBe('SELF');
      expect(res.data[0].verificationStatus).toBe('verified');
    }
  });
});
