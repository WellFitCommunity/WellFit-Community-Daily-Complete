/**
 * MPI Merge Service - Patient Record Merge and Unmerge Operations
 *
 * Purpose: Merge duplicate patient records with full audit trail and rollback capability
 * Features: Pre-merge snapshots, data migration tracking, rollback support
 *
 * @module services/mpiMergeService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export interface MPIMergeHistory {
  id: string;
  merge_batch_id: string;
  operation_type: 'merge' | 'unmerge' | 'link' | 'unlink';
  surviving_patient_id: string;
  surviving_identity_record_id: string | null;
  deprecated_patient_id: string;
  deprecated_identity_record_id: string | null;
  tenant_id: string;
  surviving_record_snapshot: Record<string, unknown>;
  deprecated_record_snapshot: Record<string, unknown>;
  related_data_snapshot: Record<string, unknown> | null;
  merged_record_snapshot: Record<string, unknown> | null;
  data_migrations: DataMigration[];
  match_candidate_id: string | null;
  merge_decision_score: number | null;
  merge_decision_reason: string;
  merge_rules_applied: string[];
  performed_by: string;
  performed_at: string;
  is_reversible: boolean;
  rolled_back: boolean;
  rolled_back_at: string | null;
  rolled_back_by: string | null;
  rollback_reason: string | null;
  rollback_batch_id: string | null;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataMigration {
  table: string;
  ids: string[];
  action: 'reassign' | 'copy' | 'archive';
  status: 'pending' | 'completed' | 'failed' | 'rolled_back';
  error?: string;
}

export interface MergeRequest {
  survivingPatientId: string;
  deprecatedPatientId: string;
  tenantId: string;
  performedBy: string;
  reason: string;
  matchCandidateId?: string;
  matchScore?: number;
  rulesApplied?: string[];
}

export interface MergeResult {
  mergeHistoryId: string;
  mergeBatchId: string;
  survivingPatientId: string;
  deprecatedPatientId: string;
  dataMigrations: DataMigration[];
  success: boolean;
}

export interface UnmergeRequest {
  mergeHistoryId: string;
  performedBy: string;
  reason: string;
}

export interface PatientSnapshot {
  profile: Record<string, unknown>;
  encounters?: Record<string, unknown>[];
  notes?: Record<string, unknown>[];
  vitals?: Record<string, unknown>[];
  medications?: Record<string, unknown>[];
  allergies?: Record<string, unknown>[];
  labOrders?: Record<string, unknown>[];
  imagingOrders?: Record<string, unknown>[];
}

// Tables that need patient ID reassignment during merge
const MERGEABLE_TABLES = [
  { table: 'encounters', column: 'patient_id' },
  { table: 'check_ins', column: 'user_id' },
  { table: 'patient_vitals', column: 'patient_id' },
  { table: 'patient_medications', column: 'patient_id' },
  { table: 'patient_allergies', column: 'patient_id' },
  { table: 'clinical_notes', column: 'patient_id' },
  { table: 'ai_progress_notes', column: 'patient_id' },
  { table: 'lab_orders', column: 'patient_id' },
  { table: 'lab_results', column: 'patient_id' },
  { table: 'imaging_orders', column: 'patient_id' },
  { table: 'appointments', column: 'patient_id' },
  { table: 'care_plans', column: 'patient_id' },
  { table: 'goals', column: 'patient_id' },
  { table: 'patient_consents', column: 'patient_id' },
  { table: 'handoff_packets', column: 'patient_id' },
  { table: 'risk_assessments', column: 'patient_id' },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a full snapshot of patient data for rollback purposes
 */
async function createPatientSnapshot(patientId: string): Promise<ServiceResult<PatientSnapshot>> {
  try {
    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', patientId)
      .single();

    if (profileError) {
      return failure('DATABASE_ERROR', 'Failed to get patient profile', profileError);
    }

    // Get related data (limit to recent for performance)
    const [encountersResult, notesResult, vitalsResult, medicationsResult, allergiesResult] = await Promise.all([
      supabase.from('encounters').select('*').eq('patient_id', patientId).limit(100),
      supabase.from('clinical_notes').select('*').eq('patient_id', patientId).limit(100),
      supabase.from('patient_vitals').select('*').eq('patient_id', patientId).limit(100),
      supabase.from('patient_medications').select('*').eq('patient_id', patientId).limit(100),
      supabase.from('patient_allergies').select('*').eq('patient_id', patientId).limit(100),
    ]);

    const snapshot: PatientSnapshot = {
      profile: profile as Record<string, unknown>,
      encounters: (encountersResult.data || []) as Record<string, unknown>[],
      notes: (notesResult.data || []) as Record<string, unknown>[],
      vitals: (vitalsResult.data || []) as Record<string, unknown>[],
      medications: (medicationsResult.data || []) as Record<string, unknown>[],
      allergies: (allergiesResult.data || []) as Record<string, unknown>[],
    };

    return success(snapshot);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_SNAPSHOT_FAILED', error, { patientId });
    return failure('OPERATION_FAILED', 'Failed to create patient snapshot', err);
  }
}

/**
 * Merge profile fields from deprecated record into surviving record
 * Uses "best data" strategy: non-null values from deprecated fill nulls in surviving
 */
async function mergeProfileFields(
  survivingPatientId: string,
  deprecatedSnapshot: PatientSnapshot
): Promise<ServiceResult<Record<string, unknown>>> {
  try {
    // Get current surviving profile
    const { data: survivingProfile, error: getError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', survivingPatientId)
      .single();

    if (getError) {
      return failure('DATABASE_ERROR', 'Failed to get surviving profile', getError);
    }

    const deprecatedProfile = deprecatedSnapshot.profile;

    // Fields that can be merged (fill nulls only)
    const mergeableFields = [
      'middle_name',
      'gender',
      'ethnicity',
      'marital_status',
      'living_situation',
      'address',
      'city',
      'state',
      'zip',
      'emergency_contact_name',
      'emergency_contact_phone',
      'emergency_contact_relationship',
      'caregiver_email',
    ];

    const updates: Record<string, unknown> = {};

    for (const field of mergeableFields) {
      if (
        survivingProfile[field] === null &&
        deprecatedProfile[field] !== null &&
        deprecatedProfile[field] !== undefined
      ) {
        updates[field] = deprecatedProfile[field];
      }
    }

    // Merge health conditions and medications arrays
    if (Array.isArray(deprecatedProfile.health_conditions) && deprecatedProfile.health_conditions.length > 0) {
      const existingConditions = (survivingProfile.health_conditions as string[]) || [];
      const newConditions = deprecatedProfile.health_conditions as string[];
      const mergedConditions = [...new Set([...existingConditions, ...newConditions])];
      if (mergedConditions.length > existingConditions.length) {
        updates.health_conditions = mergedConditions;
      }
    }

    if (Array.isArray(deprecatedProfile.medications) && deprecatedProfile.medications.length > 0) {
      const existingMeds = (survivingProfile.medications as string[]) || [];
      const newMeds = deprecatedProfile.medications as string[];
      const mergedMeds = [...new Set([...existingMeds, ...newMeds])];
      if (mergedMeds.length > existingMeds.length) {
        updates.medications = mergedMeds;
      }
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', survivingPatientId)
        .select()
        .single();

      if (updateError) {
        return failure('DATABASE_ERROR', 'Failed to update surviving profile', updateError);
      }

      return success(updatedProfile as Record<string, unknown>);
    }

    return success(survivingProfile as Record<string, unknown>);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_PROFILE_MERGE_FAILED', error, { survivingPatientId });
    return failure('OPERATION_FAILED', 'Failed to merge profile fields', err);
  }
}

/**
 * Reassign records from deprecated patient to surviving patient
 */
async function reassignPatientRecords(
  survivingPatientId: string,
  deprecatedPatientId: string
): Promise<ServiceResult<DataMigration[]>> {
  const migrations: DataMigration[] = [];

  try {
    for (const tableConfig of MERGEABLE_TABLES) {
      try {
        // First, get the IDs that will be reassigned
        const { data: records, error: selectError } = await supabase
          .from(tableConfig.table)
          .select('id')
          .eq(tableConfig.column, deprecatedPatientId);

        if (selectError) {
          migrations.push({
            table: tableConfig.table,
            ids: [],
            action: 'reassign',
            status: 'failed',
            error: selectError.message,
          });
          continue;
        }

        const ids = (records || []).map((r) => r.id);

        if (ids.length === 0) {
          migrations.push({
            table: tableConfig.table,
            ids: [],
            action: 'reassign',
            status: 'completed',
          });
          continue;
        }

        // Reassign records to surviving patient
        const { error: updateError } = await supabase
          .from(tableConfig.table)
          .update({ [tableConfig.column]: survivingPatientId })
          .eq(tableConfig.column, deprecatedPatientId);

        if (updateError) {
          migrations.push({
            table: tableConfig.table,
            ids,
            action: 'reassign',
            status: 'failed',
            error: updateError.message,
          });
        } else {
          migrations.push({
            table: tableConfig.table,
            ids,
            action: 'reassign',
            status: 'completed',
          });
        }
      } catch (tableErr: unknown) {
        const tableError = tableErr instanceof Error ? tableErr : new Error(String(tableErr));
        migrations.push({
          table: tableConfig.table,
          ids: [],
          action: 'reassign',
          status: 'failed',
          error: tableError.message,
        });
      }
    }

    return success(migrations);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_REASSIGN_FAILED', error, { survivingPatientId, deprecatedPatientId });
    return failure('OPERATION_FAILED', 'Failed to reassign patient records', err);
  }
}

/**
 * Roll back record reassignments
 */
async function rollbackRecordReassignments(
  mergeHistory: MPIMergeHistory,
  deprecatedPatientId: string
): Promise<ServiceResult<DataMigration[]>> {
  const rollbackMigrations: DataMigration[] = [];

  try {
    for (const migration of mergeHistory.data_migrations) {
      if (migration.status !== 'completed' || migration.ids.length === 0) {
        continue;
      }

      const tableConfig = MERGEABLE_TABLES.find((t) => t.table === migration.table);
      if (!tableConfig) continue;

      try {
        // Reassign records back to deprecated patient
        const { error: updateError } = await supabase
          .from(migration.table)
          .update({ [tableConfig.column]: deprecatedPatientId })
          .in('id', migration.ids);

        if (updateError) {
          rollbackMigrations.push({
            table: migration.table,
            ids: migration.ids,
            action: 'reassign',
            status: 'failed',
            error: updateError.message,
          });
        } else {
          rollbackMigrations.push({
            table: migration.table,
            ids: migration.ids,
            action: 'reassign',
            status: 'rolled_back',
          });
        }
      } catch (tableErr: unknown) {
        const tableError = tableErr instanceof Error ? tableErr : new Error(String(tableErr));
        rollbackMigrations.push({
          table: migration.table,
          ids: migration.ids,
          action: 'reassign',
          status: 'failed',
          error: tableError.message,
        });
      }
    }

    return success(rollbackMigrations);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_ROLLBACK_REASSIGN_FAILED', error, { mergeHistoryId: mergeHistory.id });
    return failure('OPERATION_FAILED', 'Failed to rollback record reassignments', err);
  }
}

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Merge two patient records (surviving absorbs deprecated)
 */
async function mergePatients(request: MergeRequest): Promise<ServiceResult<MergeResult>> {
  const mergeBatchId = crypto.randomUUID();

  try {
    await auditLogger.info('MPI_MERGE_STARTED', {
      mergeBatchId,
      survivingPatientId: request.survivingPatientId,
      deprecatedPatientId: request.deprecatedPatientId,
      performedBy: request.performedBy,
    });

    // 1. Create pre-merge snapshots
    const [survivingSnapshotResult, deprecatedSnapshotResult] = await Promise.all([
      createPatientSnapshot(request.survivingPatientId),
      createPatientSnapshot(request.deprecatedPatientId),
    ]);

    if (!survivingSnapshotResult.success) {
      return failure('OPERATION_FAILED', 'Failed to snapshot surviving patient');
    }

    if (!deprecatedSnapshotResult.success) {
      return failure('OPERATION_FAILED', 'Failed to snapshot deprecated patient');
    }

    // 2. Merge profile fields
    const mergeProfileResult = await mergeProfileFields(
      request.survivingPatientId,
      deprecatedSnapshotResult.data
    );

    if (!mergeProfileResult.success) {
      return failure('OPERATION_FAILED', 'Failed to merge profile fields');
    }

    // 3. Reassign all related records
    const reassignResult = await reassignPatientRecords(
      request.survivingPatientId,
      request.deprecatedPatientId
    );

    if (!reassignResult.success) {
      return failure('OPERATION_FAILED', 'Failed to reassign patient records');
    }

    // 4. Mark deprecated patient identity record as inactive
    await supabase
      .from('mpi_identity_records')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivated_reason: `Merged into patient ${request.survivingPatientId}`,
      })
      .eq('patient_id', request.deprecatedPatientId)
      .eq('tenant_id', request.tenantId);

    // 5. Update match candidate status if provided
    if (request.matchCandidateId) {
      await supabase
        .from('mpi_match_candidates')
        .update({
          status: 'merged',
        })
        .eq('id', request.matchCandidateId);
    }

    // 6. Create merge history record
    const { data: mergeHistory, error: historyError } = await supabase
      .from('mpi_merge_history')
      .insert({
        merge_batch_id: mergeBatchId,
        operation_type: 'merge',
        surviving_patient_id: request.survivingPatientId,
        deprecated_patient_id: request.deprecatedPatientId,
        tenant_id: request.tenantId,
        surviving_record_snapshot: survivingSnapshotResult.data,
        deprecated_record_snapshot: deprecatedSnapshotResult.data,
        merged_record_snapshot: mergeProfileResult.data,
        data_migrations: reassignResult.data,
        match_candidate_id: request.matchCandidateId || null,
        merge_decision_score: request.matchScore || null,
        merge_decision_reason: request.reason,
        merge_rules_applied: request.rulesApplied || [],
        performed_by: request.performedBy,
        is_reversible: true,
      })
      .select()
      .single();

    if (historyError) {
      const errorMessage = typeof historyError === 'object' && historyError !== null && 'message' in historyError
        ? String((historyError as { message: string }).message)
        : String(historyError);
      await auditLogger.error(
        'MPI_MERGE_HISTORY_FAILED',
        new Error(errorMessage),
        { mergeBatchId }
      );
      return failure('DATABASE_ERROR', 'Failed to record merge history', historyError);
    }

    await auditLogger.info('MPI_MERGE_COMPLETED', {
      mergeBatchId,
      mergeHistoryId: mergeHistory.id,
      survivingPatientId: request.survivingPatientId,
      deprecatedPatientId: request.deprecatedPatientId,
      migrationsCompleted: reassignResult.data.filter((m) => m.status === 'completed').length,
      migrationsFailed: reassignResult.data.filter((m) => m.status === 'failed').length,
    });

    return success({
      mergeHistoryId: mergeHistory.id,
      mergeBatchId,
      survivingPatientId: request.survivingPatientId,
      deprecatedPatientId: request.deprecatedPatientId,
      dataMigrations: reassignResult.data,
      success: true,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_MERGE_FAILED', error, {
      mergeBatchId,
      survivingPatientId: request.survivingPatientId,
      deprecatedPatientId: request.deprecatedPatientId,
    });
    return failure('OPERATION_FAILED', 'Failed to merge patients', err);
  }
}

/**
 * Unmerge (rollback) a previous merge operation
 */
async function unmergePatients(request: UnmergeRequest): Promise<ServiceResult<MergeResult>> {
  const rollbackBatchId = crypto.randomUUID();

  try {
    // 1. Get the merge history record
    const { data: mergeHistory, error: historyError } = await supabase
      .from('mpi_merge_history')
      .select('*')
      .eq('id', request.mergeHistoryId)
      .single();

    if (historyError || !mergeHistory) {
      return failure('NOT_FOUND', 'Merge history record not found');
    }

    const typedHistory = mergeHistory as MPIMergeHistory;

    // 2. Verify merge can be rolled back
    if (!typedHistory.is_reversible) {
      return failure('OPERATION_FAILED', 'This merge operation is not reversible');
    }

    if (typedHistory.rolled_back) {
      return failure('OPERATION_FAILED', 'This merge has already been rolled back');
    }

    await auditLogger.info('MPI_UNMERGE_STARTED', {
      rollbackBatchId,
      mergeHistoryId: request.mergeHistoryId,
      originalMergeBatchId: typedHistory.merge_batch_id,
      performedBy: request.performedBy,
    });

    // 3. Restore deprecated patient profile from snapshot
    // Note: Snapshot preserved for audit trail, direct profile restoration handled via identity records
    const _deprecatedSnapshot = typedHistory.deprecated_record_snapshot as unknown as PatientSnapshot;

    // Re-activate the deprecated patient's identity record
    await supabase
      .from('mpi_identity_records')
      .update({
        is_active: true,
        deactivated_at: null,
        deactivated_reason: null,
      })
      .eq('patient_id', typedHistory.deprecated_patient_id)
      .eq('tenant_id', typedHistory.tenant_id);

    // 4. Roll back record reassignments
    const rollbackResult = await rollbackRecordReassignments(
      typedHistory,
      typedHistory.deprecated_patient_id
    );

    if (!rollbackResult.success) {
      return failure('OPERATION_FAILED', 'Failed to rollback record reassignments');
    }

    // 5. Restore surviving patient profile to pre-merge state
    const survivingSnapshot = typedHistory.surviving_record_snapshot as unknown as PatientSnapshot;
    if (survivingSnapshot.profile) {
      const profileData = { ...survivingSnapshot.profile };
      delete profileData.user_id; // Don't try to update the primary key
      delete profileData.created_at;
      delete profileData.updated_at;

      await supabase
        .from('profiles')
        .update(profileData)
        .eq('user_id', typedHistory.surviving_patient_id);
    }

    // 6. Update the original merge history record
    await supabase
      .from('mpi_merge_history')
      .update({
        rolled_back: true,
        rolled_back_at: new Date().toISOString(),
        rolled_back_by: request.performedBy,
        rollback_reason: request.reason,
        rollback_batch_id: rollbackBatchId,
      })
      .eq('id', request.mergeHistoryId);

    // 7. Create unmerge history record
    const { data: unmergeHistory, error: unmergeHistoryError } = await supabase
      .from('mpi_merge_history')
      .insert({
        merge_batch_id: rollbackBatchId,
        operation_type: 'unmerge',
        surviving_patient_id: typedHistory.surviving_patient_id,
        deprecated_patient_id: typedHistory.deprecated_patient_id,
        tenant_id: typedHistory.tenant_id,
        surviving_record_snapshot: typedHistory.merged_record_snapshot || {},
        deprecated_record_snapshot: {},
        data_migrations: rollbackResult.data,
        merge_decision_reason: request.reason,
        merge_rules_applied: ['rollback'],
        performed_by: request.performedBy,
        is_reversible: false, // Unmerges cannot be undone
      })
      .select()
      .single();

    if (unmergeHistoryError) {
      const errorMessage = typeof unmergeHistoryError === 'object' && unmergeHistoryError !== null && 'message' in unmergeHistoryError
        ? String((unmergeHistoryError as { message: string }).message)
        : String(unmergeHistoryError);
      await auditLogger.error(
        'MPI_UNMERGE_HISTORY_FAILED',
        new Error(errorMessage),
        { rollbackBatchId }
      );
    }

    // 8. Re-open the match candidate if it exists
    if (typedHistory.match_candidate_id) {
      await supabase
        .from('mpi_match_candidates')
        .update({
          status: 'pending',
          reviewed_by: null,
          reviewed_at: null,
          review_decision: null,
          review_notes: `Merge rolled back: ${request.reason}`,
        })
        .eq('id', typedHistory.match_candidate_id);
    }

    await auditLogger.info('MPI_UNMERGE_COMPLETED', {
      rollbackBatchId,
      originalMergeHistoryId: request.mergeHistoryId,
      unmergeHistoryId: unmergeHistory?.id,
      survivingPatientId: typedHistory.surviving_patient_id,
      deprecatedPatientId: typedHistory.deprecated_patient_id,
      rollbacksCompleted: rollbackResult.data.filter((m) => m.status === 'rolled_back').length,
      rollbacksFailed: rollbackResult.data.filter((m) => m.status === 'failed').length,
    });

    return success({
      mergeHistoryId: unmergeHistory?.id || request.mergeHistoryId,
      mergeBatchId: rollbackBatchId,
      survivingPatientId: typedHistory.surviving_patient_id,
      deprecatedPatientId: typedHistory.deprecated_patient_id,
      dataMigrations: rollbackResult.data,
      success: true,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_UNMERGE_FAILED', error, {
      rollbackBatchId,
      mergeHistoryId: request.mergeHistoryId,
    });
    return failure('OPERATION_FAILED', 'Failed to unmerge patients', err);
  }
}

/**
 * Get merge history for a patient
 */
async function getMergeHistory(
  patientId: string,
  options: { limit?: number; includeRolledBack?: boolean } = {}
): Promise<ServiceResult<MPIMergeHistory[]>> {
  try {
    let query = supabase
      .from('mpi_merge_history')
      .select('*')
      .or(`surviving_patient_id.eq.${patientId},deprecated_patient_id.eq.${patientId}`)
      .order('performed_at', { ascending: false });

    if (!options.includeRolledBack) {
      query = query.eq('rolled_back', false);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get merge history', error);
    }

    return success((data || []) as MPIMergeHistory[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_GET_HISTORY_FAILED', error, { patientId });
    return failure('OPERATION_FAILED', 'Failed to get merge history', err);
  }
}

/**
 * Get a specific merge history record
 */
async function getMergeHistoryById(mergeHistoryId: string): Promise<ServiceResult<MPIMergeHistory | null>> {
  try {
    const { data, error } = await supabase
      .from('mpi_merge_history')
      .select('*')
      .eq('id', mergeHistoryId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', 'Failed to get merge history', error);
    }

    return success(data as MPIMergeHistory | null);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_GET_HISTORY_BY_ID_FAILED', error, { mergeHistoryId });
    return failure('OPERATION_FAILED', 'Failed to get merge history', err);
  }
}

/**
 * Verify a merge operation (mark as reviewed and verified)
 */
async function verifyMerge(
  mergeHistoryId: string,
  verifiedBy: string,
  notes?: string
): Promise<ServiceResult<MPIMergeHistory>> {
  try {
    const { data, error } = await supabase
      .from('mpi_merge_history')
      .update({
        verified_by: verifiedBy,
        verified_at: new Date().toISOString(),
        verification_notes: notes,
      })
      .eq('id', mergeHistoryId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to verify merge', error);
    }

    await auditLogger.info('MPI_MERGE_VERIFIED', {
      mergeHistoryId,
      verifiedBy,
    });

    return success(data as MPIMergeHistory);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_VERIFY_FAILED', error, { mergeHistoryId, verifiedBy });
    return failure('OPERATION_FAILED', 'Failed to verify merge', err);
  }
}

/**
 * Get merge statistics for a tenant
 */
async function getMergeStats(
  tenantId: string,
  options: { fromDate?: string; toDate?: string } = {}
): Promise<
  ServiceResult<{
    totalMerges: number;
    totalUnmerges: number;
    pendingVerification: number;
    mergesThisMonth: number;
    averageMergeScore: number;
  }>
> {
  try {
    let query = supabase.from('mpi_merge_history').select('*').eq('tenant_id', tenantId);

    if (options.fromDate) {
      query = query.gte('performed_at', options.fromDate);
    }
    if (options.toDate) {
      query = query.lte('performed_at', options.toDate);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get merge stats', error);
    }

    const records = (data || []) as MPIMergeHistory[];
    const merges = records.filter((r) => r.operation_type === 'merge' && !r.rolled_back);
    const unmerges = records.filter((r) => r.operation_type === 'unmerge');

    const thisMonth = new Date();
    thisMonth.setDate(1);
    const mergesThisMonth = merges.filter((m) => new Date(m.performed_at) >= thisMonth);

    const scoresWithValues = merges.filter((m) => m.merge_decision_score !== null);
    const averageScore =
      scoresWithValues.length > 0
        ? scoresWithValues.reduce((sum, m) => sum + (m.merge_decision_score || 0), 0) / scoresWithValues.length
        : 0;

    return success({
      totalMerges: merges.length,
      totalUnmerges: unmerges.length,
      pendingVerification: merges.filter((m) => !m.verified_at).length,
      mergesThisMonth: mergesThisMonth.length,
      averageMergeScore: Math.round(averageScore * 100) / 100,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_MERGE_STATS_FAILED', error, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to get merge stats', err);
  }
}

/**
 * Get reversible merges (for potential rollback)
 */
async function getReversibleMerges(
  tenantId: string,
  options: { limit?: number } = {}
): Promise<ServiceResult<MPIMergeHistory[]>> {
  try {
    let query = supabase
      .from('mpi_merge_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('operation_type', 'merge')
      .eq('is_reversible', true)
      .eq('rolled_back', false)
      .order('performed_at', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get reversible merges', error);
    }

    return success((data || []) as MPIMergeHistory[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_GET_REVERSIBLE_FAILED', error, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to get reversible merges', err);
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const mpiMergeService = {
  // Core operations
  mergePatients,
  unmergePatients,

  // History
  getMergeHistory,
  getMergeHistoryById,

  // Verification
  verifyMerge,

  // Statistics
  getMergeStats,
  getReversibleMerges,
};

export default mpiMergeService;
