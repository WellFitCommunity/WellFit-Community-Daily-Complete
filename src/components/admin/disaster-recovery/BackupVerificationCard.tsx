/**
 * BackupVerificationCard - Backup compliance status and history
 *
 * Purpose: Display backup verification metrics, issues, and history table
 * Used by: DisasterRecoveryDashboard
 *
 * Copyright (c) 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState } from 'react';
import {
  Database,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Play,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
} from '../../envision-atlus';
import { getStatusConfig } from './statusHelpers';
import type { BackupComplianceStatus, BackupLog } from './DisasterRecoveryDashboard.types';

interface BackupVerificationCardProps {
  backupStatus: BackupComplianceStatus | null;
  recentBackups: BackupLog[];
  runningVerification: boolean;
  onRunVerification: () => void;
  onRunRestoreTest: () => void;
}

export const BackupVerificationCard: React.FC<BackupVerificationCardProps> = ({
  backupStatus,
  recentBackups,
  runningVerification,
  onRunVerification,
  onRunRestoreTest,
}) => {
  const [showBackupHistory, setShowBackupHistory] = useState(false);

  return (
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
                onClick={onRunVerification}
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
                onClick={onRunRestoreTest}
                disabled={runningVerification}
              >
                <Play className="w-4 h-4 mr-2" />
                Restore Test
              </EAButton>
            </div>

            {/* History Toggle */}
            <button
              onClick={() => setShowBackupHistory(!showBackupHistory)}
              className="flex items-center gap-2 text-sm text-[var(--ea-primary)] hover:text-[var(--ea-primary-hover)]"
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
  );
};
