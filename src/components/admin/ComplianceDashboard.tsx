import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
// Optimized imports for tree-shaking (saves ~12KB)
import Shield from 'lucide-react/dist/esm/icons/shield';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Activity from 'lucide-react/dist/esm/icons/activity';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';

interface BackupCompliance {
  compliance_status: string;
  last_successful_backup: string;
  last_restore_test: string;
  backup_success_rate: number;
  total_backups_30d: number;
  failed_backups_30d: number;
  issues: string[];
}

interface DrillCompliance {
  compliance_status: string;
  last_weekly_drill: string;
  last_monthly_drill: string;
  last_quarterly_drill: string;
  drills_30d: number;
  drills_passed_30d: number;
  pass_rate: number;
  avg_score: number;
  issues: string[];
}

interface VulnerabilitySum {
  open_critical: number;
  open_high: number;
  total_overdue: number;
  avg_remediation_days: number;
  risk_level: string;
}

const ComplianceDashboard: React.FC = () => {
  const [backupCompliance, setBackupCompliance] = useState<BackupCompliance | null>(null);
  const [drillCompliance, setDrillCompliance] = useState<DrillCompliance | null>(null);
  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilitySum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchComplianceData();
  }, []);

  const fetchComplianceData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch backup compliance status
      const { data: backupData, error: backupError } = await supabase
        .rpc('get_backup_compliance_status');

      if (backupError) throw backupError;
      setBackupCompliance(backupData);

      // Fetch drill compliance status
      const { data: drillData, error: drillError } = await supabase
        .rpc('get_drill_compliance_status');

      if (drillError) throw drillError;
      setDrillCompliance(drillData);

      // Fetch vulnerability summary
      const { data: vulnData, error: vulnError } = await supabase
        .rpc('get_vulnerability_summary');

      if (vulnError) throw vulnError;
      setVulnerabilities(vulnData);

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLIANT':
        return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'WARNING':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'NON_COMPLIANT':
      case 'CRITICAL':
        return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'HIGH':
        return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      default:
        return 'text-slate-400 bg-slate-700/50 border-slate-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLIANT':
        return <CheckCircle className="w-6 h-6 text-green-400" />;
      case 'WARNING':
        return <AlertTriangle className="w-6 h-6 text-yellow-400" />;
      default:
        return <AlertTriangle className="w-6 h-6 text-red-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <Activity className="w-12 h-12 text-[#00857a] animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading compliance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 min-h-screen bg-slate-900">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-red-400 mr-3" />
            <div>
              <h3 className="text-red-300 font-semibold">Error Loading Compliance Data</h3>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Compliance & Security Dashboard
        </h1>
        <p className="text-slate-400">
          SOC2, HIPAA, and Security Compliance Monitoring
        </p>
      </div>

      {/* Overall Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Backup Compliance Card */}
        {backupCompliance && (
          <div className={`border rounded-lg p-6 ${getStatusColor(backupCompliance.compliance_status)}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Shield className="w-8 h-8 mr-3" />
                <h2 className="text-lg font-semibold">Backup Compliance</h2>
              </div>
              {getStatusIcon(backupCompliance.compliance_status)}
            </div>
            <p className="text-2xl font-bold mb-2">{backupCompliance.compliance_status}</p>
            <div className="text-sm space-y-1">
              <p>Success Rate: {backupCompliance.backup_success_rate}%</p>
              <p>Last Backup: {new Date(backupCompliance.last_successful_backup).toLocaleDateString()}</p>
              <p>Last Restore Test: {new Date(backupCompliance.last_restore_test).toLocaleDateString()}</p>
            </div>
          </div>
        )}

        {/* Drill Compliance Card */}
        {drillCompliance && (
          <div className={`border rounded-lg p-6 ${getStatusColor(drillCompliance.compliance_status)}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Activity className="w-8 h-8 mr-3" />
                <h2 className="text-lg font-semibold">Drill Compliance</h2>
              </div>
              {getStatusIcon(drillCompliance.compliance_status)}
            </div>
            <p className="text-2xl font-bold mb-2">{drillCompliance.compliance_status}</p>
            <div className="text-sm space-y-1">
              <p>Pass Rate: {drillCompliance.pass_rate}%</p>
              <p>Avg Score: {(drillCompliance.avg_score ?? 0).toFixed(1)}</p>
              <p>Drills (30d): {drillCompliance.drills_30d}</p>
            </div>
          </div>
        )}

        {/* Vulnerability Status Card */}
        {vulnerabilities && (
          <div className={`border rounded-lg p-6 ${getStatusColor(vulnerabilities.risk_level)}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 mr-3" />
                <h2 className="text-lg font-semibold">Security Vulnerabilities</h2>
              </div>
              {getStatusIcon(vulnerabilities.risk_level)}
            </div>
            <p className="text-2xl font-bold mb-2">{vulnerabilities.risk_level} Risk</p>
            <div className="text-sm space-y-1">
              <p>Critical Open: {vulnerabilities.open_critical}</p>
              <p>High Open: {vulnerabilities.open_high}</p>
              <p>Overdue: {vulnerabilities.total_overdue}</p>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backup Details */}
        {backupCompliance && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center text-white">
              <Shield className="w-5 h-5 mr-2 text-[#00857a]" />
              Backup & Recovery Details
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700/50 p-3 rounded-sm border border-slate-600">
                  <p className="text-sm text-slate-400">Total Backups (30d)</p>
                  <p className="text-2xl font-bold text-white">{backupCompliance.total_backups_30d}</p>
                </div>
                <div className="bg-slate-700/50 p-3 rounded-sm border border-slate-600">
                  <p className="text-sm text-slate-400">Failed Backups</p>
                  <p className="text-2xl font-bold text-white">{backupCompliance.failed_backups_30d}</p>
                </div>
              </div>

              {backupCompliance.issues && backupCompliance.issues.length > 0 && (
                <div className="border-t border-slate-700 pt-4">
                  <h4 className="font-semibold text-white mb-2">Issues Requiring Attention:</h4>
                  <ul className="space-y-2">
                    {backupCompliance.issues.map((issue, index) => (
                      <li key={index} className="flex items-start">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 mr-2 mt-0.5 shrink-0" />
                        <span className="text-sm text-slate-300">{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t border-slate-700 pt-4">
                <h4 className="font-semibold text-white mb-2">Compliance Targets:</h4>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>• Backup Frequency: Daily</li>
                  <li>• Restore Test Frequency: Weekly</li>
                  <li>• Success Rate Target: 95%</li>
                  <li>• RPO Target: 15 minutes</li>
                  <li>• RTO Target: 4 hours</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Drill Details */}
        {drillCompliance && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center text-white">
              <Activity className="w-5 h-5 mr-2 text-[#00857a]" />
              Disaster Recovery Drills
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700/50 p-3 rounded-sm border border-slate-600">
                  <p className="text-sm text-slate-400">Drills Completed (30d)</p>
                  <p className="text-2xl font-bold text-white">{drillCompliance.drills_30d}</p>
                </div>
                <div className="bg-slate-700/50 p-3 rounded-sm border border-slate-600">
                  <p className="text-sm text-slate-400">Drills Passed</p>
                  <p className="text-2xl font-bold text-white">{drillCompliance.drills_passed_30d}</p>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <h4 className="font-semibold text-white mb-2">Recent Drill Dates:</h4>
                <div className="space-y-2 text-sm text-slate-400">
                  {drillCompliance.last_weekly_drill && (
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2 text-slate-500" />
                      <span>Last Weekly: {new Date(drillCompliance.last_weekly_drill).toLocaleDateString()}</span>
                    </div>
                  )}
                  {drillCompliance.last_monthly_drill && (
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2 text-slate-500" />
                      <span>Last Monthly: {new Date(drillCompliance.last_monthly_drill).toLocaleDateString()}</span>
                    </div>
                  )}
                  {drillCompliance.last_quarterly_drill && (
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2 text-slate-500" />
                      <span>Last Quarterly: {new Date(drillCompliance.last_quarterly_drill).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {drillCompliance.issues && drillCompliance.issues.length > 0 && (
                <div className="border-t border-slate-700 pt-4">
                  <h4 className="font-semibold text-white mb-2">Issues Requiring Attention:</h4>
                  <ul className="space-y-2">
                    {drillCompliance.issues.map((issue, index) => (
                      <li key={index} className="flex items-start">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 mr-2 mt-0.5 shrink-0" />
                        <span className="text-sm text-slate-300">{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t border-slate-700 pt-4">
                <h4 className="font-semibold text-white mb-2">Compliance Targets:</h4>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>• Weekly Frequency: Every 7 days</li>
                  <li>• Monthly Frequency: Every 30 days</li>
                  <li>• Quarterly Frequency: Every 90 days</li>
                  <li>• Pass Rate Target: 90%</li>
                  <li>• Avg Score Target: 85</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Vulnerability Details */}
        {vulnerabilities && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 lg:col-span-2">
            <h3 className="text-xl font-semibold mb-4 flex items-center text-white">
              <AlertTriangle className="w-5 h-5 mr-2 text-[#00857a]" />
              Security Vulnerability Summary
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`p-4 rounded-sm border-2 ${vulnerabilities.open_critical > 0 ? 'border-red-500/50 bg-red-500/10' : 'border-slate-600 bg-slate-700/50'}`}>
                <p className="text-sm text-slate-400 mb-1">Critical Open</p>
                <p className={`text-3xl font-bold ${vulnerabilities.open_critical > 0 ? 'text-red-400' : 'text-white'}`}>{vulnerabilities.open_critical}</p>
              </div>
              <div className={`p-4 rounded-sm border-2 ${vulnerabilities.open_high > 0 ? 'border-orange-500/50 bg-orange-500/10' : 'border-slate-600 bg-slate-700/50'}`}>
                <p className="text-sm text-slate-400 mb-1">High Open</p>
                <p className={`text-3xl font-bold ${vulnerabilities.open_high > 0 ? 'text-orange-400' : 'text-white'}`}>{vulnerabilities.open_high}</p>
              </div>
              <div className={`p-4 rounded-sm border-2 ${vulnerabilities.total_overdue > 0 ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-slate-600 bg-slate-700/50'}`}>
                <p className="text-sm text-slate-400 mb-1">Overdue</p>
                <p className={`text-3xl font-bold ${vulnerabilities.total_overdue > 0 ? 'text-yellow-400' : 'text-white'}`}>{vulnerabilities.total_overdue}</p>
              </div>
              <div className="p-4 rounded-sm border-2 border-slate-600 bg-slate-700/50">
                <p className="text-sm text-slate-400 mb-1">Avg Remediation</p>
                <p className="text-3xl font-bold text-white">{vulnerabilities.avg_remediation_days || 0}<span className="text-sm ml-1">days</span></p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-[#00857a]/10 border border-[#00857a]/30 rounded-sm">
              <div className="flex items-start">
                <FileText className="w-5 h-5 text-[#00857a] mr-3 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-semibold text-[#33bfb7] mb-1">Penetration Testing Schedule</h4>
                  <ul className="text-sm text-slate-300 space-y-1">
                    <li>• Daily: Automated security scans</li>
                    <li>• Weekly: Comprehensive DAST scans</li>
                    <li>• Quarterly: Manual penetration testing</li>
                    <li>• Annually: External security assessment</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-wrap gap-4">
        <button
          onClick={fetchComplianceData}
          className="px-6 py-3 bg-[#00857a] text-white rounded-lg hover:bg-[#006d64] transition flex items-center"
        >
          <TrendingUp className="w-5 h-5 mr-2" />
          Refresh Data
        </button>
        <button
          onClick={() => window.location.href = '/admin/backup-logs'}
          className="px-6 py-3 bg-slate-800 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition"
        >
          View Backup Logs
        </button>
        <button
          onClick={() => window.location.href = '/admin/drill-reports'}
          className="px-6 py-3 bg-slate-800 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition"
        >
          View Drill Reports
        </button>
        <button
          onClick={() => window.location.href = '/admin/vulnerabilities'}
          className="px-6 py-3 bg-slate-800 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition"
        >
          Manage Vulnerabilities
        </button>
      </div>

      {/* Compliance Footer */}
      <div className="mt-8 p-4 bg-slate-800 border border-slate-700 rounded-lg">
        <div className="flex items-start">
          <Shield className="w-5 h-5 text-[#00857a] mr-3 mt-0.5 shrink-0" />
          <div className="text-sm text-slate-400">
            <p className="font-semibold mb-1 text-slate-300">Compliance Standards</p>
            <p>This dashboard monitors compliance with HIPAA Security Rule (§164.308), SOC2 Trust Service Criteria (CC7.1), and industry best practices for healthcare data protection.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceDashboard;
