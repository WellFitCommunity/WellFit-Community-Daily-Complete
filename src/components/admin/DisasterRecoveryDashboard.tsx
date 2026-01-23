/**
 * Disaster Recovery Dashboard - DR Compliance Monitoring
 *
 * Purpose: Monitor backup verification, disaster recovery drills, and compliance status
 * Features: Backup status, drill history, compliance metrics, schedule management
 * Compliance: SOC2 CC6.1, CC7.5, HIPAA § 164.308(a)(7)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Calendar,
  Play,
  FileText,
  TrendingUp,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  Users,
  Target,
} from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EAAlert,
} from '../envision-atlus';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';

// =============================================================================
// TYPES
// =============================================================================

interface BackupComplianceStatus {
  compliance_status: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT';
  last_successful_backup: string | null;
  last_restore_test: string | null;
  backup_success_rate: number;
  total_backups_30d: number;
  failed_backups_30d: number;
  issues: string[];
  targets: {
    backup_frequency: string;
    restore_test_frequency: string;
    success_rate_target: string;
    rpo_target: string;
    rto_target: string;
  };
}

interface DrillComplianceStatus {
  compliance_status: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT';
  last_weekly_drill: string | null;
  last_monthly_drill: string | null;
  last_quarterly_drill: string | null;
  drills_30d: number;
  drills_passed_30d: number;
  pass_rate: number;
  avg_score: number | null;
  issues: string[];
  targets: {
    weekly_frequency: string;
    monthly_frequency: string;
    quarterly_frequency: string;
    pass_rate_target: string;
    avg_score_target: string;
  };
}

interface Drill {
  id: string;
  drill_name: string;
  drill_type: string;
  drill_scenario: string;
  scheduled_start: string;
  actual_start: string | null;
  actual_end: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  drill_passed: boolean | null;
  overall_score: number | null;
  rto_met: boolean | null;
  rpo_met: boolean | null;
}

interface BackupLog {
  id: string;
  backup_type: string;
  backup_timestamp: string;
  verification_status: 'success' | 'failure' | 'warning' | 'pending';
  restore_tested: boolean;
  restore_status: string | null;
  data_integrity_check_passed: boolean | null;
}

// =============================================================================
// STATUS HELPERS
// =============================================================================

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'COMPLIANT':
      return { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Compliant' };
    case 'WARNING':
      return { color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle, label: 'Warning' };
    case 'NON_COMPLIANT':
      return { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Non-Compliant' };
    default:
      return { color: 'bg-gray-100 text-gray-800', icon: AlertOctagon, label: 'Unknown' };
  }
};

const getDrillTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    weekly_automated: 'Weekly Automated',
    monthly_simulation: 'Monthly Simulation',
    quarterly_tabletop: 'Quarterly Tabletop',
    annual_full_scale: 'Annual Full-Scale',
    ad_hoc: 'Ad Hoc',
  };
  return labels[type] || type;
};

const getScenarioLabel = (scenario: string): string => {
  const labels: Record<string, string> = {
    database_loss: 'Database Loss',
    security_breach: 'Security Breach',
    infrastructure_failure: 'Infrastructure Failure',
    ransomware_attack: 'Ransomware Attack',
    natural_disaster: 'Natural Disaster',
    insider_threat: 'Insider Threat',
    multi_region_outage: 'Multi-Region Outage',
    supply_chain_attack: 'Supply Chain Attack',
  };
  return labels[scenario] || scenario;
};

// =============================================================================
// COMPONENT
// =============================================================================

export const DisasterRecoveryDashboard: React.FC = () => {
  const [backupStatus, setBackupStatus] = useState<BackupComplianceStatus | null>(null);
  const [drillStatus, setDrillStatus] = useState<DrillComplianceStatus | null>(null);
  const [recentDrills, setRecentDrills] = useState<Drill[]>([]);
  const [recentBackups, setRecentBackups] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBackupHistory, setShowBackupHistory] = useState(false);
  const [showDrillHistory, setShowDrillHistory] = useState(false);
  const [runningVerification, setRunningVerification] = useState(false);

  // Fetch compliance status
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
        .select('*')
        .order('scheduled_start', { ascending: false })
        .limit(10);

      if (!drillsError && drills) {
        setRecentDrills(drills as Drill[]);
      }

      // Fetch recent backup logs
      const { data: backups, error: backupsError } = await supabase
        .from('backup_verification_logs')
        .select('*')
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

  // Run manual backup verification
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

  // Run restore test
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-500">Loading disaster recovery status...</span>
      </div>
    );
  }

  const overallStatus =
    backupStatus?.compliance_status === 'NON_COMPLIANT' || drillStatus?.compliance_status === 'NON_COMPLIANT'
      ? 'NON_COMPLIANT'
      : backupStatus?.compliance_status === 'WARNING' || drillStatus?.compliance_status === 'WARNING'
      ? 'WARNING'
      : 'COMPLIANT';

  const overallConfig = getStatusConfig(overallStatus);
  const OverallIcon = overallConfig.icon;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            Disaster Recovery Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Monitor backup verification, recovery drills, and compliance status
          </p>
        </div>
        <EAButton variant="secondary" onClick={fetchComplianceStatus} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </EAButton>
      </div>

      {/* Error Alert */}
      {error && (
        <EAAlert variant="critical" onDismiss={() => setError(null)} dismissible>
          {error}
        </EAAlert>
      )}

      {/* Overall Status Banner */}
      <div className={`p-4 rounded-lg ${overallConfig.color} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <OverallIcon className="w-6 h-6" />
          <div>
            <span className="font-semibold">Overall DR Compliance: </span>
            <span>{overallConfig.label}</span>
          </div>
        </div>
        <div className="text-sm">
          Last Updated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backup Compliance Card */}
        <EACard>
          <EACardHeader className="bg-blue-50">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                <Database className="w-5 h-5" />
                Backup Verification
              </h3>
              {backupStatus && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusConfig(backupStatus.compliance_status).color}`}>
                  {getStatusConfig(backupStatus.compliance_status).label}
                </span>
              )}
            </div>
          </EACardHeader>
          <EACardContent className="p-4 space-y-4">
            {backupStatus ? (
              <>
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-500">Success Rate (30d)</div>
                    <div className="text-xl font-bold text-gray-900">
                      {backupStatus.backup_success_rate}%
                    </div>
                    <div className="text-xs text-gray-400">
                      Target: {backupStatus.targets.success_rate_target}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-500">Total Verifications</div>
                    <div className="text-xl font-bold text-gray-900">
                      {backupStatus.total_backups_30d}
                    </div>
                    <div className="text-xs text-gray-400">
                      {backupStatus.failed_backups_30d} failed
                    </div>
                  </div>
                </div>

                {/* Last Verification Times */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Last Successful Backup:</span>
                    <span className="font-medium">
                      {backupStatus.last_successful_backup
                        ? new Date(backupStatus.last_successful_backup).toLocaleString()
                        : 'Never'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Last Restore Test:</span>
                    <span className="font-medium">
                      {backupStatus.last_restore_test
                        ? new Date(backupStatus.last_restore_test).toLocaleString()
                        : 'Never'}
                    </span>
                  </div>
                </div>

                {/* Issues */}
                {backupStatus.issues.length > 0 && (
                  <div className="bg-yellow-50 p-3 rounded">
                    <div className="text-sm font-medium text-yellow-800 mb-1">Issues:</div>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {backupStatus.issues.map((issue, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <EAButton
                    variant="primary"
                    onClick={runBackupVerification}
                    disabled={runningVerification}
                  >
                    {runningVerification ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Verify Now
                      </>
                    )}
                  </EAButton>
                  <EAButton
                    variant="secondary"
                    onClick={runRestoreTest}
                    disabled={runningVerification}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Restore Test
                  </EAButton>
                </div>

                {/* History Toggle */}
                <button
                  onClick={() => setShowBackupHistory(!showBackupHistory)}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  {showBackupHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showBackupHistory ? 'Hide' : 'Show'} Recent History
                </button>

                {/* History Table */}
                {showBackupHistory && recentBackups.length > 0 && (
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Time</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Restore</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBackups.map((log) => (
                          <tr key={log.id} className="border-t">
                            <td className="px-3 py-2">{new Date(log.backup_timestamp).toLocaleDateString()}</td>
                            <td className="px-3 py-2 capitalize">{log.backup_type}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                log.verification_status === 'success'
                                  ? 'bg-green-100 text-green-800'
                                  : log.verification_status === 'warning'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {log.verification_status}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {log.restore_tested ? (
                                <span className={`text-xs ${
                                  log.restore_status === 'success' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {log.restore_status}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-gray-500 py-4">
                No backup verification data available
              </div>
            )}
          </EACardContent>
        </EACard>

        {/* Drill Compliance Card */}
        <EACard>
          <EACardHeader className="bg-purple-50">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-purple-900 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Recovery Drills
              </h3>
              {drillStatus && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusConfig(drillStatus.compliance_status).color}`}>
                  {getStatusConfig(drillStatus.compliance_status).label}
                </span>
              )}
            </div>
          </EACardHeader>
          <EACardContent className="p-4 space-y-4">
            {drillStatus ? (
              <>
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-500">Pass Rate (30d)</div>
                    <div className="text-xl font-bold text-gray-900">
                      {drillStatus.pass_rate}%
                    </div>
                    <div className="text-xs text-gray-400">
                      Target: {drillStatus.targets.pass_rate_target}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm text-gray-500">Avg Score</div>
                    <div className="text-xl font-bold text-gray-900">
                      {drillStatus.avg_score ?? 'N/A'}
                    </div>
                    <div className="text-xs text-gray-400">
                      Target: {drillStatus.targets.avg_score_target}
                    </div>
                  </div>
                </div>

                {/* Last Drill Times */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Last Weekly:</span>
                    <span className={`font-medium ${
                      !drillStatus.last_weekly_drill ? 'text-red-600' : ''
                    }`}>
                      {drillStatus.last_weekly_drill
                        ? new Date(drillStatus.last_weekly_drill).toLocaleDateString()
                        : 'Never'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Last Monthly:</span>
                    <span className={`font-medium ${
                      !drillStatus.last_monthly_drill ? 'text-red-600' : ''
                    }`}>
                      {drillStatus.last_monthly_drill
                        ? new Date(drillStatus.last_monthly_drill).toLocaleDateString()
                        : 'Never'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Last Quarterly:</span>
                    <span className={`font-medium ${
                      !drillStatus.last_quarterly_drill ? 'text-red-600' : ''
                    }`}>
                      {drillStatus.last_quarterly_drill
                        ? new Date(drillStatus.last_quarterly_drill).toLocaleDateString()
                        : 'Never'}
                    </span>
                  </div>
                </div>

                {/* Issues */}
                {drillStatus.issues.length > 0 && (
                  <div className="bg-yellow-50 p-3 rounded">
                    <div className="text-sm font-medium text-yellow-800 mb-1">Issues:</div>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {drillStatus.issues.map((issue, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <EAButton variant="primary">
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Drill
                  </EAButton>
                  <EAButton variant="secondary">
                    <FileText className="w-4 h-4 mr-2" />
                    View Reports
                  </EAButton>
                </div>

                {/* History Toggle */}
                <button
                  onClick={() => setShowDrillHistory(!showDrillHistory)}
                  className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800"
                >
                  {showDrillHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showDrillHistory ? 'Hide' : 'Show'} Recent Drills
                </button>

                {/* Drill History Table */}
                {showDrillHistory && recentDrills.length > 0 && (
                  <div className="border rounded overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-left">Scenario</th>
                          <th className="px-3 py-2 text-left">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentDrills.map((drill) => (
                          <tr key={drill.id} className="border-t">
                            <td className="px-3 py-2">{new Date(drill.scheduled_start).toLocaleDateString()}</td>
                            <td className="px-3 py-2">{getDrillTypeLabel(drill.drill_type)}</td>
                            <td className="px-3 py-2">{getScenarioLabel(drill.drill_scenario)}</td>
                            <td className="px-3 py-2">
                              {drill.status === 'completed' ? (
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  drill.drill_passed
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {drill.drill_passed ? 'Passed' : 'Failed'}
                                  {drill.overall_score !== null && ` (${drill.overall_score}%)`}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 capitalize">
                                  {drill.status}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-gray-500 py-4">
                No drill data available
              </div>
            )}
          </EACardContent>
        </EACard>
      </div>

      {/* Compliance Targets Summary */}
      <EACard>
        <EACardHeader>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Compliance Targets
          </h3>
        </EACardHeader>
        <EACardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-blue-600">15 min</div>
              <div className="text-sm text-gray-500">RPO Target</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-blue-600">4 hrs</div>
              <div className="text-sm text-gray-500">RTO Target</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-blue-600">95%</div>
              <div className="text-sm text-gray-500">Backup Success</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-blue-600">90%</div>
              <div className="text-sm text-gray-500">Drill Pass Rate</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-blue-600">Weekly</div>
              <div className="text-sm text-gray-500">Drill Frequency</div>
            </div>
          </div>
        </EACardContent>
      </EACard>
    </div>
  );
};

export default DisasterRecoveryDashboard;
