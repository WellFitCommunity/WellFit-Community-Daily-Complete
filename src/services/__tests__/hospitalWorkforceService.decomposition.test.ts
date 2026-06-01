/**
 * Hospital Workforce Service — decomposition behavioral tests.
 *
 * Verifies the post-decomposition module split preserves behavior:
 * - each domain module's query returns mapped success / failure ServiceResults
 * - NPI validation gates createStaff before insert
 * - the aggregate HospitalWorkforceService object wires every function
 *
 * Deletion Test: each assertion fails if the underlying function were reduced
 * to `return success([])` / removed from the aggregator.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Per-table terminal result + RPC results, set per test.
const tableResults: Record<string, { data: unknown; error: unknown }> = {};
const rpcResults: Record<string, { data: unknown; error: unknown }> = {};
const insertedPayloads: Record<string, unknown> = {};

function setTable(table: string, data: unknown, error: unknown = null) {
  tableResults[table] = { data, error };
}
function setRpc(fn: string, data: unknown, error: unknown = null) {
  rpcResults[fn] = { data, error };
}

// Chainable thenable: every builder method returns `this`; awaiting resolves to
// the configured table result. `.insert()` records the payload for assertions.
function makeBuilder(table: string) {
  const result = () => Promise.resolve(tableResults[table] ?? { data: [], error: null });
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'update', 'upsert', 'eq', 'is', 'or', 'range', 'order']) {
    builder[m] = () => builder;
  }
  builder.insert = (payload: unknown) => {
    insertedPayloads[table] = payload;
    return builder;
  };
  builder.single = () => result();
  builder.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
    result().then(resolve, reject);
  return builder;
}

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: (fn: string) => Promise.resolve(rpcResults[fn] ?? { data: null, error: null }),
  },
}));

vi.mock('../../services/auditLogger', () => ({
  auditLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import HospitalWorkforceService, {
  getStaffCategories,
  getOrganizations,
  createStaff,
  getActiveStaff,
  hasActiveLicense,
  getExpiringCredentials,
  validateNPI,
} from '../hospitalWorkforceService';

beforeEach(() => {
  for (const k of Object.keys(tableResults)) delete tableResults[k];
  for (const k of Object.keys(rpcResults)) delete rpcResults[k];
  for (const k of Object.keys(insertedPayloads)) delete insertedPayloads[k];
});

describe('HospitalWorkforceService aggregator', () => {
  it('wires every domain function onto the service object', () => {
    const expected = [
      'getStaffCategories', 'getRoleTypes', 'getCredentialTypes', 'getLicenseTypes',
      'getOrganizations', 'getOrganization', 'createOrganization', 'updateOrganization',
      'getDepartments', 'createDepartment', 'updateDepartment',
      'getFacilities', 'createFacility', 'updateFacility',
      'searchStaff', 'getStaff', 'getStaffByNPI', 'createStaff', 'updateStaff',
      'deactivateStaff', 'getActiveStaff',
      'getStaffRoles', 'assignStaffRole', 'endStaffRole',
      'getStaffCredentials', 'addStaffCredential', 'updateStaffCredential', 'getStaffCredentialsDisplay',
      'getStaffLicenses', 'addStaffLicense', 'updateStaffLicense', 'hasActiveLicense',
      'getStaffBoardCertifications', 'addStaffBoardCertification',
      'getStaffPrivileges', 'addStaffPrivilege',
      'getDirectReports', 'getSupervisorChain', 'assignSupervisor',
      'getStaffEHRMappings', 'addStaffEHRMapping',
      'getExpiringCredentials', 'createMigrationBatch', 'getMigrationBatch',
      'updateMigrationBatch', 'addMigrationLog', 'getMigrationLogs',
      'getProviderGroups', 'createProviderGroup', 'validateNPI',
    ];
    for (const name of expected) {
      expect(typeof (HospitalWorkforceService as Record<string, unknown>)[name]).toBe('function');
    }
    expect(Object.keys(HospitalWorkforceService)).toHaveLength(expected.length);
  });
});

describe('referenceData module', () => {
  it('returns reference rows on success', async () => {
    setTable('ref_staff_category', [{ category_id: 'c1', category_code: 'PHYS', category_name: 'Physician' }]);
    const res = await getStaffCategories();
    expect(res.success).toBe(true);
    if (res.success) expect(res.data[0].category_code).toBe('PHYS');
  });

  it('surfaces DB errors as failure', async () => {
    setTable('ref_staff_category', null, { message: 'db down' });
    const res = await getStaffCategories();
    expect(res.success).toBe(false);
  });
});

describe('organizations module', () => {
  it('returns active organizations', async () => {
    setTable('hc_organization', [{ organization_id: 'o1', organization_name: 'General Hospital' }]);
    const res = await getOrganizations();
    expect(res.success).toBe(true);
    if (res.success) expect(res.data[0].organization_name).toBe('General Hospital');
  });
});

describe('staff module', () => {
  it('rejects an invalid NPI before inserting', async () => {
    setRpc('validate_hc_npi', false);
    const res = await createStaff({ organization_id: 'o1', npi: '0000000000' } as never);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe('VALIDATION_ERROR');
    expect(insertedPayloads['hc_staff']).toBeUndefined(); // never reached insert
  });

  it('inserts staff when NPI passes validation', async () => {
    setRpc('validate_hc_npi', true);
    setTable('hc_staff', { staff_id: 's1', organization_id: 'o1' });
    const res = await createStaff({ organization_id: 'o1', npi: '1234567893', last_name: 'Doe' } as never);
    expect(res.success).toBe(true);
    expect(insertedPayloads['hc_staff']).toMatchObject({ organization_id: 'o1' });
  });

  it('reads the active-staff view', async () => {
    setTable('vw_hc_active_staff', [{ staff_id: 's1', full_name_display: 'Jane Doe', is_clinical: true }]);
    const res = await getActiveStaff('o1');
    expect(res.success).toBe(true);
    if (res.success) expect(res.data[0].full_name_display).toBe('Jane Doe');
  });
});

describe('credentials module', () => {
  it('maps has_hc_active_license RPC to a boolean (null → false)', async () => {
    setRpc('has_hc_active_license', null);
    const res = await hasActiveLicense('s1', 'TX');
    expect(res.success).toBe(true);
    if (res.success) expect(res.data).toBe(false);
  });
});

describe('migration module', () => {
  it('filters expiring credentials by a non-default daysAhead window', async () => {
    setTable('vw_hc_expiring_credentials', [
      { staff_id: 's1', days_until_expiration: 10 },
      { staff_id: 's2', days_until_expiration: 200 },
      { staff_id: 's3', days_until_expiration: -5 },
    ]);
    const res = await getExpiringCredentials('o1', 30);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toHaveLength(1);
      expect(res.data[0].staff_id).toBe('s1');
    }
  });

  it('validateNPI returns the RPC boolean', async () => {
    setRpc('validate_hc_npi', true);
    const res = await validateNPI('1234567893');
    expect(res.success).toBe(true);
    if (res.success) expect(res.data).toBe(true);
  });
});
