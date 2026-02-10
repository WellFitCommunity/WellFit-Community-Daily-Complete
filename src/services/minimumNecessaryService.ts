/**
 * Minimum Necessary Field-Level Filtering Service
 *
 * Purpose: Enforce HIPAA 45 CFR 164.502(b) "minimum necessary" standard
 * at the field level. Defines which database fields each role can access
 * based on table, role, and purpose of the access.
 *
 * Usage: After fetching data from the database, pass records through
 * filterFields() or filterRecordSet() to strip fields the role cannot see.
 *
 * @module services/minimumNecessaryService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type AccessPurpose =
  | 'treatment'
  | 'payment'
  | 'operations'
  | 'research'
  | 'public_health'
  | 'audit';

export interface MinimumNecessaryPolicy {
  id: string;
  tenant_id: string;
  table_name: string;
  role_name: string;
  allowed_fields: string[];
  denied_fields: string[];
  purpose: AccessPurpose;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FieldAccessResult<T> {
  filtered: T;
  fieldsRemoved: string[];
  policyApplied: string | null;
}

export interface CreatePolicyRequest {
  table_name: string;
  role_name: string;
  allowed_fields: string[];
  denied_fields: string[];
  purpose: AccessPurpose;
}

export interface UpdatePolicyRequest {
  allowed_fields?: string[];
  denied_fields?: string[];
  purpose?: AccessPurpose;
  is_active?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

async function getTenantId(): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .single();
  return data?.tenant_id ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Get the field-level access policy for a specific table, role, and purpose.
 */
async function getPolicy(
  tableName: string,
  roleName: string,
  purpose: AccessPurpose
): Promise<ServiceResult<MinimumNecessaryPolicy | null>> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return failure('UNAUTHORIZED', 'No tenant context');

    const { data, error } = await supabase
      .from('minimum_necessary_policies')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('table_name', tableName)
      .eq('role_name', roleName)
      .eq('purpose', purpose)
      .eq('is_active', true)
      .single();

    if (error) {
      // PGRST116 = no rows found — this is a valid "no policy" state
      if (error.code === 'PGRST116') {
        return success(null);
      }
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data as MinimumNecessaryPolicy);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MIN_NECESSARY_GET_POLICY_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to get minimum necessary policy');
  }
}

/**
 * Filter a single record to only include fields allowed by the policy.
 *
 * Logic:
 * 1. If allowed_fields is non-empty, only include those fields.
 * 2. If denied_fields is non-empty, exclude those fields.
 * 3. If no policy found, return all fields (with a warning log).
 * 4. Log the field-level access via auditLogger.
 */
async function filterFields<T>(
  record: T,
  tableName: string,
  roleName: string,
  purpose: AccessPurpose
): Promise<ServiceResult<FieldAccessResult<Partial<T>>>> {
  try {
    if (!isRecord(record)) {
      return failure('VALIDATION_ERROR', 'Record must be a non-null object');
    }

    const policyResult = await getPolicy(tableName, roleName, purpose);
    if (!policyResult.success) {
      return failure(policyResult.error.code, policyResult.error.message);
    }

    const policy = policyResult.data;
    const allKeys = Object.keys(record);
    let filteredRecord: Record<string, unknown>;
    let fieldsRemoved: string[];
    let policyApplied: string | null;

    if (!policy) {
      // No policy found — return all fields but warn
      await auditLogger.warn('MIN_NECESSARY_NO_POLICY', {
        tableName,
        roleName,
        purpose,
        action: 'returning_all_fields',
      });

      filteredRecord = { ...record };
      fieldsRemoved = [];
      policyApplied = null;
    } else if (policy.allowed_fields.length > 0) {
      // Allowlist: only include specified fields
      const allowSet = new Set(policy.allowed_fields);
      filteredRecord = {};
      fieldsRemoved = [];

      for (const key of allKeys) {
        if (allowSet.has(key)) {
          filteredRecord[key] = (record as Record<string, unknown>)[key];
        } else {
          fieldsRemoved.push(key);
        }
      }

      policyApplied = policy.id;
    } else if (policy.denied_fields.length > 0) {
      // Denylist: exclude specified fields
      const denySet = new Set(policy.denied_fields);
      filteredRecord = {};
      fieldsRemoved = [];

      for (const key of allKeys) {
        if (denySet.has(key)) {
          fieldsRemoved.push(key);
        } else {
          filteredRecord[key] = (record as Record<string, unknown>)[key];
        }
      }

      policyApplied = policy.id;
    } else {
      // Policy exists but no fields configured — return all
      filteredRecord = { ...record };
      fieldsRemoved = [];
      policyApplied = policy.id;
    }

    // Audit the field-level access
    await auditLogger.info('MIN_NECESSARY_FIELD_ACCESS', {
      tableName,
      roleName,
      purpose,
      policyApplied,
      totalFields: allKeys.length,
      fieldsReturned: allKeys.length - fieldsRemoved.length,
      fieldsRemoved: fieldsRemoved.length,
    });

    return success({
      filtered: filteredRecord as Partial<T>,
      fieldsRemoved,
      policyApplied,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MIN_NECESSARY_FILTER_FAILED', error, {
      tableName,
      roleName,
      purpose,
    });
    return failure('OPERATION_FAILED', 'Failed to filter fields by minimum necessary policy');
  }
}

/**
 * Filter an array of records, applying the same policy to each.
 * Fetches the policy once and applies it to all records for efficiency.
 */
async function filterRecordSet<T>(
  records: T[],
  tableName: string,
  roleName: string,
  purpose: AccessPurpose
): Promise<ServiceResult<FieldAccessResult<Partial<T>>[]>> {
  try {
    if (!Array.isArray(records)) {
      return failure('VALIDATION_ERROR', 'Records must be an array');
    }

    if (records.length === 0) {
      return success([]);
    }

    // Fetch the policy once for all records
    const policyResult = await getPolicy(tableName, roleName, purpose);
    if (!policyResult.success) {
      return failure(policyResult.error.code, policyResult.error.message);
    }

    const policy = policyResult.data;
    const results: FieldAccessResult<Partial<T>>[] = [];

    if (!policy) {
      await auditLogger.warn('MIN_NECESSARY_NO_POLICY', {
        tableName,
        roleName,
        purpose,
        action: 'returning_all_fields_for_set',
        recordCount: records.length,
      });

      for (const record of records) {
        results.push({
          filtered: { ...record } as Partial<T>,
          fieldsRemoved: [],
          policyApplied: null,
        });
      }
    } else {
      const allowSet = policy.allowed_fields.length > 0
        ? new Set(policy.allowed_fields)
        : null;
      const denySet = policy.denied_fields.length > 0
        ? new Set(policy.denied_fields)
        : null;

      for (const record of records) {
        if (!isRecord(record)) {
          results.push({
            filtered: record as Partial<T>,
            fieldsRemoved: [],
            policyApplied: policy.id,
          });
          continue;
        }

        const allKeys = Object.keys(record);
        const filteredRecord: Record<string, unknown> = {};
        const fieldsRemoved: string[] = [];

        if (allowSet) {
          for (const key of allKeys) {
            if (allowSet.has(key)) {
              filteredRecord[key] = (record as Record<string, unknown>)[key];
            } else {
              fieldsRemoved.push(key);
            }
          }
        } else if (denySet) {
          for (const key of allKeys) {
            if (denySet.has(key)) {
              fieldsRemoved.push(key);
            } else {
              filteredRecord[key] = (record as Record<string, unknown>)[key];
            }
          }
        } else {
          Object.assign(filteredRecord, record);
        }

        results.push({
          filtered: filteredRecord as Partial<T>,
          fieldsRemoved,
          policyApplied: policy.id,
        });
      }
    }

    // Audit the batch access
    await auditLogger.info('MIN_NECESSARY_BATCH_ACCESS', {
      tableName,
      roleName,
      purpose,
      policyApplied: policy?.id ?? null,
      recordCount: records.length,
    });

    return success(results);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MIN_NECESSARY_BATCH_FILTER_FAILED', error, {
      tableName,
      roleName,
      purpose,
    });
    return failure('OPERATION_FAILED', 'Failed to filter record set by minimum necessary policy');
  }
}

/**
 * List all active minimum necessary policies for the current tenant.
 */
async function listPolicies(): Promise<ServiceResult<MinimumNecessaryPolicy[]>> {
  try {
    const { data, error } = await supabase
      .from('minimum_necessary_policies')
      .select('*')
      .eq('is_active', true)
      .order('table_name', { ascending: true });

    if (error) return failure('DATABASE_ERROR', error.message, error);
    return success((data ?? []) as MinimumNecessaryPolicy[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MIN_NECESSARY_LIST_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to list minimum necessary policies');
  }
}

/**
 * Create a new minimum necessary field-level policy.
 */
async function createPolicy(
  request: CreatePolicyRequest
): Promise<ServiceResult<MinimumNecessaryPolicy>> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return failure('UNAUTHORIZED', 'No tenant context');

    const { data, error } = await supabase
      .from('minimum_necessary_policies')
      .insert({
        tenant_id: tenantId,
        table_name: request.table_name,
        role_name: request.role_name,
        allowed_fields: request.allowed_fields,
        denied_fields: request.denied_fields,
        purpose: request.purpose,
        is_active: true,
      })
      .select()
      .single();

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.info('MIN_NECESSARY_POLICY_CREATED', {
      policyId: data.id,
      tableName: request.table_name,
      roleName: request.role_name,
      purpose: request.purpose,
      allowedFieldCount: request.allowed_fields.length,
      deniedFieldCount: request.denied_fields.length,
    });

    return success(data as MinimumNecessaryPolicy);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MIN_NECESSARY_POLICY_CREATE_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to create minimum necessary policy');
  }
}

/**
 * Update an existing minimum necessary policy.
 */
async function updatePolicy(
  policyId: string,
  updates: UpdatePolicyRequest
): Promise<ServiceResult<MinimumNecessaryPolicy>> {
  try {
    const { data, error } = await supabase
      .from('minimum_necessary_policies')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', policyId)
      .select()
      .single();

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.info('MIN_NECESSARY_POLICY_UPDATED', {
      policyId,
      updatedFields: Object.keys(updates),
    });

    return success(data as MinimumNecessaryPolicy);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MIN_NECESSARY_POLICY_UPDATE_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to update minimum necessary policy');
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const minimumNecessaryService = {
  getPolicy,
  filterFields,
  filterRecordSet,
  listPolicies,
  createPolicy,
  updatePolicy,
};
