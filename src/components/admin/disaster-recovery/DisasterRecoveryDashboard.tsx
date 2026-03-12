/**
 * DisasterRecoveryDashboard - DR Compliance Monitoring
 *
 * Purpose: Monitor backup verification, disaster recovery drills, and compliance status
 * Features: Backup status, drill history, compliance metrics, schedule management
 * Compliance: SOC2 CC6.1, CC7.5, HIPAA 164.308(a)(7)
 *
 * Copyright (c) 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React from 'react';
import { Shield, RefreshCw } from 'lucide-react';
import { EAButton, EAAlert } from '../../envision-atlus';
import { useDisasterRecoveryData } from './useDisasterRecoveryData';
import { getStatusConfig } from './statusHelpers';
import { BackupVerificationCard } from './BackupVerificationCard';
import { DrillComplianceCard } from './DrillComplianceCard';
import { ComplianceTargetsCard } from './ComplianceTargetsCard';

export const DisasterRecoveryDashboard: React.FC = () => {
  const {
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
  } = useDisasterRecoveryData();

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
        <BackupVerificationCard
          backupStatus={backupStatus}
          recentBackups={recentBackups}
          runningVerification={runningVerification}
          onRunVerification={runBackupVerification}
          onRunRestoreTest={runRestoreTest}
        />
        <DrillComplianceCard
          drillStatus={drillStatus}
          recentDrills={recentDrills}
        />
      </div>

      {/* Compliance Targets Summary */}
      <ComplianceTargetsCard />
    </div>
  );
};

export default DisasterRecoveryDashboard;
