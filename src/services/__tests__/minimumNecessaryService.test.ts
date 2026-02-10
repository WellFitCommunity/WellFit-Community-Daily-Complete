/**
 * Minimum Necessary Field-Level Filtering Service Tests
 *
 * Tests for HIPAA 45 CFR 164.502(b) field-level access control:
 * - filterFields with allowed_fields returns only those fields
 * - filterFields with denied_fields excludes those fields
 * - filterFields with no policy returns all fields (warning logged)
 * - filterRecordSet applies policy to each record in array
 * - listPolicies returns active policies for tenant
 * - createPolicy inserts new policy with correct tenant
 * - Error handling returns failure (not exceptions)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  minimumNecessaryService,
} from '../minimumNecessaryService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

vi.mock('../../lib/supabaseClient', () => {
  const mockFrom = vi.fn();
  return {
    supabase: {
      from: mockFrom,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-user-1' } },
        }),
      },
    },
  };
});

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    security: vi.fn().mockResolvedValue(undefined),
    phi: vi.fn().mockResolvedValue(undefined),
    clinical: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  auth: { getUser: ReturnType<typeof vi.fn> };
};

function createChainableMock(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

// =============================================================================
// SAMPLE DATA
// =============================================================================

const samplePatientRecord = {
  user_id: 'patient-123',
  first_name: 'Jane',
  last_name: 'Doe',
  date_of_birth: '1945-06-15',
  gender: 'female',
  blood_type: 'O+',
  ssn_last_four: '1234',
  email: 'jane@example.com',
  phone: '555-0123',
  emergency_contact_name: 'John Doe',
  emergency_contact_phone: '555-9999',
  billing_account_number: 'BILL-001',
  insurance_provider: 'Medicare',
  insurance_id: 'MED-12345',
  primary_physician: 'Dr. Smith',
};

const nursePolicy = {
  id: 'policy-nurse-treatment',
  tenant_id: 'tenant-1',
  table_name: 'profiles',
  role_name: 'nurse',
  allowed_fields: [
    'user_id', 'first_name', 'last_name', 'date_of_birth',
    'gender', 'blood_type', 'emergency_contact_name',
    'emergency_contact_phone', 'primary_physician',
  ],
  denied_fields: [],
  purpose: 'treatment',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const billingPolicy = {
  id: 'policy-billing-payment',
  tenant_id: 'tenant-1',
  table_name: 'profiles',
  role_name: 'billing_staff',
  allowed_fields: [],
  denied_fields: [
    'blood_type', 'emergency_contact_name', 'emergency_contact_phone',
    'primary_physician', 'medical_notes',
  ],
  purpose: 'payment',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// =============================================================================
// TESTS
// =============================================================================

describe('minimumNecessaryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // filterFields — allowed_fields
  // ---------------------------------------------------------------------------
  describe('filterFields with allowed_fields', () => {
    it('returns only the allowed fields from the record', async () => {
      // Call 1: getTenantId -> profiles
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      // Call 2: getPolicy -> minimum_necessary_policies
      const policyChain = createChainableMock({
        data: nursePolicy,
        error: null,
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : policyChain;
      });

      const result = await minimumNecessaryService.filterFields(
        samplePatientRecord,
        'profiles',
        'nurse',
        'treatment'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const { filtered, fieldsRemoved, policyApplied } = result.data;
        // Should include allowed fields
        expect(filtered.first_name).toBe('Jane');
        expect(filtered.last_name).toBe('Doe');
        expect(filtered.blood_type).toBe('O+');
        expect(filtered.primary_physician).toBe('Dr. Smith');
        // Should NOT include disallowed fields
        expect(filtered).not.toHaveProperty('ssn_last_four');
        expect(filtered).not.toHaveProperty('email');
        expect(filtered).not.toHaveProperty('billing_account_number');
        expect(filtered).not.toHaveProperty('insurance_provider');
        // Removed fields tracked
        expect(fieldsRemoved).toContain('ssn_last_four');
        expect(fieldsRemoved).toContain('email');
        expect(fieldsRemoved).toContain('billing_account_number');
        expect(policyApplied).toBe('policy-nurse-treatment');
      }
    });

    it('logs field-level access via auditLogger', async () => {
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const policyChain = createChainableMock({
        data: nursePolicy,
        error: null,
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : policyChain;
      });

      await minimumNecessaryService.filterFields(
        samplePatientRecord,
        'profiles',
        'nurse',
        'treatment'
      );

      expect(auditLogger.info).toHaveBeenCalledWith(
        'MIN_NECESSARY_FIELD_ACCESS',
        expect.objectContaining({
          tableName: 'profiles',
          roleName: 'nurse',
          purpose: 'treatment',
          policyApplied: 'policy-nurse-treatment',
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // filterFields — denied_fields
  // ---------------------------------------------------------------------------
  describe('filterFields with denied_fields', () => {
    it('excludes denied fields and keeps all others', async () => {
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const policyChain = createChainableMock({
        data: billingPolicy,
        error: null,
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : policyChain;
      });

      const result = await minimumNecessaryService.filterFields(
        samplePatientRecord,
        'profiles',
        'billing_staff',
        'payment'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const { filtered, fieldsRemoved, policyApplied } = result.data;
        // Should include non-denied fields
        expect(filtered.first_name).toBe('Jane');
        expect(filtered.billing_account_number).toBe('BILL-001');
        expect(filtered.insurance_provider).toBe('Medicare');
        // Should NOT include denied fields
        expect(filtered).not.toHaveProperty('blood_type');
        expect(filtered).not.toHaveProperty('emergency_contact_name');
        expect(filtered).not.toHaveProperty('primary_physician');
        // Removed fields tracked
        expect(fieldsRemoved).toContain('blood_type');
        expect(fieldsRemoved).toContain('emergency_contact_name');
        expect(fieldsRemoved).toContain('primary_physician');
        expect(policyApplied).toBe('policy-billing-payment');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // filterFields — no policy found
  // ---------------------------------------------------------------------------
  describe('filterFields with no policy', () => {
    it('returns all fields and logs a warning when no policy exists', async () => {
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      // PGRST116 = no rows found
      const policyChain = createChainableMock({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : policyChain;
      });

      const result = await minimumNecessaryService.filterFields(
        samplePatientRecord,
        'profiles',
        'unknown_role',
        'treatment'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const { filtered, fieldsRemoved, policyApplied } = result.data;
        // All fields returned
        expect(filtered.first_name).toBe('Jane');
        expect(filtered.ssn_last_four).toBe('1234');
        expect(filtered.billing_account_number).toBe('BILL-001');
        expect(fieldsRemoved).toEqual([]);
        expect(policyApplied).toBeNull();
      }

      // Warning logged
      expect(auditLogger.warn).toHaveBeenCalledWith(
        'MIN_NECESSARY_NO_POLICY',
        expect.objectContaining({
          tableName: 'profiles',
          roleName: 'unknown_role',
          purpose: 'treatment',
          action: 'returning_all_fields',
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // filterRecordSet
  // ---------------------------------------------------------------------------
  describe('filterRecordSet', () => {
    it('applies the same policy to each record in the array', async () => {
      const records = [
        { user_id: 'p1', first_name: 'Alice', ssn_last_four: '1111', gender: 'female' },
        { user_id: 'p2', first_name: 'Bob', ssn_last_four: '2222', gender: 'male' },
      ];

      const allowPolicy = {
        ...nursePolicy,
        allowed_fields: ['user_id', 'first_name', 'gender'],
      };

      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const policyChain = createChainableMock({
        data: allowPolicy,
        error: null,
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : policyChain;
      });

      const result = await minimumNecessaryService.filterRecordSet(
        records,
        'profiles',
        'nurse',
        'treatment'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);

        // Record 1
        expect(result.data[0].filtered.first_name).toBe('Alice');
        expect(result.data[0].filtered).not.toHaveProperty('ssn_last_four');
        expect(result.data[0].fieldsRemoved).toContain('ssn_last_four');

        // Record 2
        expect(result.data[1].filtered.first_name).toBe('Bob');
        expect(result.data[1].filtered).not.toHaveProperty('ssn_last_four');
        expect(result.data[1].fieldsRemoved).toContain('ssn_last_four');
      }
    });

    it('returns empty array for empty input', async () => {
      const result = await minimumNecessaryService.filterRecordSet(
        [],
        'profiles',
        'nurse',
        'treatment'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('logs batch access event', async () => {
      const records = [
        { user_id: 'p1', first_name: 'Alice' },
      ];

      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const policyChain = createChainableMock({
        data: { ...nursePolicy, allowed_fields: ['user_id', 'first_name'] },
        error: null,
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : policyChain;
      });

      await minimumNecessaryService.filterRecordSet(
        records,
        'profiles',
        'nurse',
        'treatment'
      );

      expect(auditLogger.info).toHaveBeenCalledWith(
        'MIN_NECESSARY_BATCH_ACCESS',
        expect.objectContaining({
          tableName: 'profiles',
          roleName: 'nurse',
          purpose: 'treatment',
          recordCount: 1,
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // listPolicies
  // ---------------------------------------------------------------------------
  describe('listPolicies', () => {
    it('returns array of active policies for the tenant', async () => {
      const mockPolicies = [
        { ...nursePolicy, id: 'p1' },
        { ...billingPolicy, id: 'p2' },
      ];

      const chain = createChainableMock({ data: mockPolicies, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await minimumNecessaryService.listPolicies();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].role_name).toBe('nurse');
        expect(result.data[1].role_name).toBe('billing_staff');
      }
      expect(mockSupabase.from).toHaveBeenCalledWith('minimum_necessary_policies');
      expect(chain.eq).toHaveBeenCalledWith('is_active', true);
      expect(chain.order).toHaveBeenCalledWith('table_name', { ascending: true });
    });

    it('returns empty array when no policies exist', async () => {
      const chain = createChainableMock({ data: [], error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await minimumNecessaryService.listPolicies();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('returns failure on database error', async () => {
      const chain = createChainableMock({
        data: null,
        error: { message: 'Connection refused' },
      });
      mockSupabase.from.mockReturnValue(chain);

      const result = await minimumNecessaryService.listPolicies();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Connection refused');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // createPolicy
  // ---------------------------------------------------------------------------
  describe('createPolicy', () => {
    it('inserts a new policy with correct tenant and fields', async () => {
      const createdPolicy = {
        id: 'policy-new',
        tenant_id: 'tenant-1',
        table_name: 'check_ins',
        role_name: 'caregiver',
        allowed_fields: ['check_in_date', 'mood', 'overall_status'],
        denied_fields: [],
        purpose: 'treatment',
        is_active: true,
        created_at: '2026-02-10T00:00:00Z',
        updated_at: '2026-02-10T00:00:00Z',
      };

      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const insertChain = createChainableMock({ data: createdPolicy, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : insertChain;
      });

      const result = await minimumNecessaryService.createPolicy({
        table_name: 'check_ins',
        role_name: 'caregiver',
        allowed_fields: ['check_in_date', 'mood', 'overall_status'],
        denied_fields: [],
        purpose: 'treatment',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.table_name).toBe('check_ins');
        expect(result.data.role_name).toBe('caregiver');
        expect(result.data.allowed_fields).toEqual(['check_in_date', 'mood', 'overall_status']);
      }

      expect(auditLogger.info).toHaveBeenCalledWith(
        'MIN_NECESSARY_POLICY_CREATED',
        expect.objectContaining({
          policyId: 'policy-new',
          tableName: 'check_ins',
          roleName: 'caregiver',
          purpose: 'treatment',
          allowedFieldCount: 3,
          deniedFieldCount: 0,
        })
      );
    });

    it('returns failure when no tenant context', async () => {
      const profileChain = createChainableMock({ data: null, error: null });
      mockSupabase.from.mockReturnValue(profileChain);

      const result = await minimumNecessaryService.createPolicy({
        table_name: 'profiles',
        role_name: 'nurse',
        allowed_fields: ['first_name'],
        denied_fields: [],
        purpose: 'treatment',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // updatePolicy
  // ---------------------------------------------------------------------------
  describe('updatePolicy', () => {
    it('updates policy fields and logs the change', async () => {
      const updatedPolicy = {
        ...nursePolicy,
        allowed_fields: ['user_id', 'first_name', 'last_name'],
        updated_at: '2026-02-10T12:00:00Z',
      };

      const chain = createChainableMock({ data: updatedPolicy, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await minimumNecessaryService.updatePolicy(
        'policy-nurse-treatment',
        { allowed_fields: ['user_id', 'first_name', 'last_name'] }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowed_fields).toEqual(['user_id', 'first_name', 'last_name']);
      }

      expect(auditLogger.info).toHaveBeenCalledWith(
        'MIN_NECESSARY_POLICY_UPDATED',
        expect.objectContaining({
          policyId: 'policy-nurse-treatment',
          updatedFields: ['allowed_fields'],
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe('error handling', () => {
    it('filterFields returns failure when getPolicy throws an exception', async () => {
      // When supabase.from throws, getPolicy catches it and returns failure,
      // which filterFields propagates as a failure result.
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected DB failure');
      });

      const result = await minimumNecessaryService.filterFields(
        samplePatientRecord,
        'profiles',
        'nurse',
        'treatment'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OPERATION_FAILED');
      }
      expect(auditLogger.error).toHaveBeenCalledWith(
        'MIN_NECESSARY_GET_POLICY_FAILED',
        expect.any(Error)
      );
    });

    it('filterRecordSet returns failure on thrown exception', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected DB failure');
      });

      const result = await minimumNecessaryService.filterRecordSet(
        [samplePatientRecord],
        'profiles',
        'nurse',
        'treatment'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OPERATION_FAILED');
      }
    });

    it('createPolicy returns failure on database insert error', async () => {
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const insertChain = createChainableMock({
        data: null,
        error: { message: 'Unique constraint violation' },
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : insertChain;
      });

      const result = await minimumNecessaryService.createPolicy({
        table_name: 'profiles',
        role_name: 'nurse',
        allowed_fields: ['first_name'],
        denied_fields: [],
        purpose: 'treatment',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Unique constraint violation');
      }
    });

    it('filterFields returns failure for non-object input', async () => {
      const result = await minimumNecessaryService.filterFields(
        'not-an-object' as unknown as Record<string, unknown>,
        'profiles',
        'nurse',
        'treatment'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });
});
