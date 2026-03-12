/**
 * Disaster Recovery Dashboard - Data Fetching Hook
 *
 * Purpose: Encapsulates all data fetching and mutation logic for DR dashboard
 *
 * Copyright (c) 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { auditLogger } from '../../../services/auditLogger';
import type {
  BackupComplianceStatus,
  DrillComplianceStatus,
  Drill,
  BackupLog,
} from './DisasterRecoveryDashboard.types';

export interface DisasterRecoveryData {
  backupStatus: BackupComplianceStatus | null;
  drillStatus: DrillComplianceStatus | null;
  recentDrills: Drill[];
  recentBackups: BackupLog[];
  loading: boolean;
  error: string | null;
  runningVerification: boolean;
  setError: (error: string | null) => void;
  fetchComplianceStatus: () => Promise<void>;
  runBackupVerification: () => Promise<void>;
  runRestoreTest: () => Promise<void>;
}

export function useDisasterRecoveryData(): DisasterRecoveryData {
  const [backupStatus, setBackupStatus] = useState<BackupComplianceStatus | null>(null);
  const [drillStatus, setDrillStatus] = useState<DrillComplianceStatus | null>(null);
  const [recentDrills, setRecentDrills] = useState<Drill[]>([]);
  const [recentBackups, setRecentBackups] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningVerification, setRunningVerification] = useState(false);

  const fetchComplianceStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch backup compliance status
      const { data: backupData, error: backupError } = await supabase.rpc('get_backup_compliance_status');
      if (backupError) {
        await auditLogger.error('BACKUP_STATUS_FETCH_FAILED', new Error(backupError.message), {});
      } else {
        setBackupStatus(backupData as BackupComplianceStatus);
      }

      // Fetch drill compliance status
      const { data: drillData, error: drillError } = await supabase.rpc('get_drill_compliance_status');
      if (drillError) {
        await auditLogger.error('DRILL_STATUS_FETCH_FAILED', new Error(drillError.message), {});
      } else {
        setDrillStatus(drillData as DrillComplianceStatus);
      }

      // Fetch recent drills
      const { data: drills, error: drillsError } = await supabase
        .from('disaster_recovery_drills')
        .select('id, drill_name, drill_type, drill_scenario, scheduled_start, actual_start, actual_end, status, drill_passed, overall_score, rto_met, rpo_met')
        .order('scheduled_start', { ascending: false })
        .limit(10);

      if (!drillsError && drills) {
        setRecentDrills(drills as Drill[]);
      }

      // Fetch recent backup logs
      const { data: backups, error: backupsError } = await supabase
        .from('backup_verification_logs')
        .select('id, backup_type, backup_timestamp, verification_status, restore_tested, restore_status, data_integrity_check_passed')
        .order('verification_timestamp', { ascending: false })
        .limit(10);

      if (!backupsError && backups) {
        setRecentBackups(backups as BackupLog[]);
      }
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('DR_DASHBOARD_LOAD_FAILED', errorObj, {});
      setError('Failed to load disaster recovery status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComplianceStatus();
  }, [fetchComplianceStatus]);

  const runBackupVerification = async () => {
    setRunningVerification(true);
    try {
      const { data, error } = await supabase.rpc('verify_database_backup');
      if (error) {
        setError('Failed to run backup verification');
        await auditLogger.error('MANUAL_BACKUP_VERIFY_FAILED', new Error(error.message), {});
      } else {
        await auditLogger.info('MANUAL_BACKUP_VERIFY_SUCCESS', { result: data });
        await fetchComplianceStatus();
      }
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('MANUAL_BACKUP_VERIFY_FAILED', errorObj, {});
      setError('Failed to run backup verification');
    } finally {
      setRunningVerification(false);
    }
  };

  const runRestoreTest = async () => {
    setRunningVerification(true);
    try {
      const { data, error } = await supabase.rpc('test_backup_restore', { p_backup_type: 'database' });
      if (error) {
        setError('Failed to run restore test');
        await auditLogger.error('RESTORE_TEST_FAILED', new Error(error.message), {});
      } else {
        await auditLogger.info('RESTORE_TEST_SUCCESS', { result: data });
        await fetchComplianceStatus();
      }
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('RESTORE_TEST_FAILED', errorObj, {});
      setError('Failed to run restore test');
    } finally {
      setRunningVerification(false);
    }
  };

  return {
    backupStatus,
    drillStatus,
    recentDrills,
    recentBackups,
    loading,
    error,
    runningVerification,
    setError,
    fetchComplianceStatus,
    runBackupVerification,
    runRestoreTest,
  };
}
