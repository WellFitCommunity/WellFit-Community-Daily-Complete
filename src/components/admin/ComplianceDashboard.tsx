import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Shield, AlertTriangle, CheckCircle, Clock, Activity, FileText, TrendingUp } from 'lucide-react';

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
      console.error('Error fetching compliance data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLIANT':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'WARNING':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'NON_COMPLIANT':
      case 'CRITICAL':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'HIGH':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLIANT':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'WARNING':
        return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
      default:
        return <AlertTriangle className="w-6 h-6 text-red-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading compliance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
            <div>
              <h3 className="text-red-900 font-semibold">Error Loading Compliance Data</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Compliance & Security Dashboard
        </h1>
        <p className="text-gray-600">
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
              <p>Avg Score: {drillCompliance.avg_score.toFixed(1)}</p>
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
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-blue-600" />
              Backup & Recovery Details
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-600">Total Backups (30d)</p>
                  <p className="text-2xl font-bold text-gray-900">{backupCompliance.total_backups_30d}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-600">Failed Backups</p>
                  <p className="text-2xl font-bold text-gray-900">{backupCompliance.failed_backups_30d}</p>
                </div>
              </div>

              {backupCompliance.issues && backupCompliance.issues.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Issues Requiring Attention:</h4>
                  <ul className="space-y-2">
                    {backupCompliance.issues.map((issue, index) => (
                      <li key={index} className="flex items-start">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-900 mb-2">Compliance Targets:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
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
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-blue-600" />
              Disaster Recovery Drills
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-600">Drills Completed (30d)</p>
                  <p className="text-2xl font-bold text-gray-900">{drillCompliance.drills_30d}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm text-gray-600">Drills Passed</p>
                  <p className="text-2xl font-bold text-gray-900">{drillCompliance.drills_passed_30d}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-900 mb-2">Recent Drill Dates:</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  {drillCompliance.last_weekly_drill && (
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>Last Weekly: {new Date(drillCompliance.last_weekly_drill).toLocaleDateString()}</span>
                    </div>
                  )}
                  {drillCompliance.last_monthly_drill && (
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>Last Monthly: {new Date(drillCompliance.last_monthly_drill).toLocaleDateString()}</span>
                    </div>
                  )}
                  {drillCompliance.last_quarterly_drill && (
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>Last Quarterly: {new Date(drillCompliance.last_quarterly_drill).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {drillCompliance.issues && drillCompliance.issues.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Issues Requiring Attention:</h4>
                  <ul className="space-y-2">
                    {drillCompliance.issues.map((issue, index) => (
                      <li key={index} className="flex items-start">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-900 mb-2">Compliance Targets:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
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
          <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-blue-600" />
              Security Vulnerability Summary
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`p-4 rounded border-2 ${vulnerabilities.open_critical > 0 ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                <p className="text-sm text-gray-600 mb-1">Critical Open</p>
                <p className="text-3xl font-bold text-gray-900">{vulnerabilities.open_critical}</p>
              </div>
              <div className={`p-4 rounded border-2 ${vulnerabilities.open_high > 0 ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
                <p className="text-sm text-gray-600 mb-1">High Open</p>
                <p className="text-3xl font-bold text-gray-900">{vulnerabilities.open_high}</p>
              </div>
              <div className={`p-4 rounded border-2 ${vulnerabilities.total_overdue > 0 ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 bg-gray-50'}`}>
                <p className="text-sm text-gray-600 mb-1">Overdue</p>
                <p className="text-3xl font-bold text-gray-900">{vulnerabilities.total_overdue}</p>
              </div>
              <div className="p-4 rounded border-2 border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-600 mb-1">Avg Remediation</p>
                <p className="text-3xl font-bold text-gray-900">{vulnerabilities.avg_remediation_days || 0}<span className="text-sm ml-1">days</span></p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
              <div className="flex items-start">
                <FileText className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">Penetration Testing Schedule</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
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
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center"
        >
          <TrendingUp className="w-5 h-5 mr-2" />
          Refresh Data
        </button>
        <button
          onClick={() => window.location.href = '/admin/backup-logs'}
          className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
        >
          View Backup Logs
        </button>
        <button
          onClick={() => window.location.href = '/admin/drill-reports'}
          className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
        >
          View Drill Reports
        </button>
        <button
          onClick={() => window.location.href = '/admin/vulnerabilities'}
          className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
        >
          Manage Vulnerabilities
        </button>
      </div>

      {/* Compliance Footer */}
      <div className="mt-8 p-4 bg-gray-100 border border-gray-300 rounded-lg">
        <div className="flex items-start">
          <Shield className="w-5 h-5 text-gray-600 mr-3 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-700">
            <p className="font-semibold mb-1">Compliance Standards</p>
            <p>This dashboard monitors compliance with HIPAA Security Rule (§164.308), SOC2 Trust Service Criteria (CC7.1), and industry best practices for healthcare data protection.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceDashboard;
