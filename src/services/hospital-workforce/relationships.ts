/**
 * Hospital Workforce — Reporting Relationships & EHR Mappings
 *
 * Extracted from hospitalWorkforceService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — functions moved verbatim.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { getErrorMessage } from './shared';
import {
  HCStaffReporting,
  HCStaffReportingInsert,
  HCStaffEHRMapping,
  HCStaffEHRMappingInsert,
} from '../../types/hospitalWorkforce';

// ============================================================================
// REPORTING RELATIONSHIPS
// ============================================================================

export async function getDirectReports(supervisorId: string): Promise<ServiceResult<HCStaffReporting[]>> {
  try {
    const { data, error } = await supabase
      .from('hc_staff_reporting')
      .select('reporting_id, staff_id, supervisor_id, relationship_type, effective_date, end_date, source_system, source_id, created_at, updated_at')
      .eq('supervisor_id', supervisorId)
      .is('end_date', null);

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get direct reports', getErrorMessage(err), { supervisorId });
    return failure('UNKNOWN_ERROR', 'Failed to get direct reports', err);
  }
}

export async function getSupervisorChain(staffId: string): Promise<ServiceResult<HCStaffReporting[]>> {
  try {
    const { data, error } = await supabase
      .from('hc_staff_reporting')
      .select('reporting_id, staff_id, supervisor_id, relationship_type, effective_date, end_date, source_system, source_id, created_at, updated_at')
      .eq('staff_id', staffId)
      .is('end_date', null);

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get supervisor chain', getErrorMessage(err), { staffId });
    return failure('UNKNOWN_ERROR', 'Failed to get supervisor chain', err);
  }
}

export async function assignSupervisor(reporting: HCStaffReportingInsert): Promise<ServiceResult<HCStaffReporting>> {
  try {
    const { data, error } = await supabase.from('hc_staff_reporting').insert(reporting).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Supervisor assigned', {
      staffId: reporting.staff_id,
      supervisorId: reporting.supervisor_id,
      relationshipType: reporting.relationship_type,
    });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to assign supervisor', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to assign supervisor', err);
  }
}

// ============================================================================
// EHR MAPPINGS
// ============================================================================

export async function getStaffEHRMappings(staffId: string): Promise<ServiceResult<HCStaffEHRMapping[]>> {
  try {
    const { data, error } = await supabase.from('hc_staff_ehr_mapping').select('mapping_id, staff_id, ehr_system, ehr_user_id, ehr_provider_id, ehr_login, ehr_department_id, is_active, last_login, created_at, updated_at').eq('staff_id', staffId);

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get staff EHR mappings', getErrorMessage(err), { staffId });
    return failure('UNKNOWN_ERROR', 'Failed to get staff EHR mappings', err);
  }
}

export async function addStaffEHRMapping(mapping: HCStaffEHRMappingInsert): Promise<ServiceResult<HCStaffEHRMapping>> {
  try {
    const { data, error } = await supabase.from('hc_staff_ehr_mapping').insert(mapping).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Staff EHR mapping added', { staffId: mapping.staff_id, ehrSystem: mapping.ehr_system });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to add staff EHR mapping', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to add staff EHR mapping', err);
  }
}
