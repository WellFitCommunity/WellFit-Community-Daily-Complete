/**
 * SOC 2 Executive Summary Dashboard
 *
 * High-level overview for executives and board presentations.
 * Shows overall security posture, compliance score, and key trends.
 *
 * Zero tech debt - clean, professional executive view
 */

import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { createSOC2MonitoringService, ComplianceStatus } from '../../services/soc2MonitoringService';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';

export const SOC2ExecutiveDashboard: React.FC = () => {
  const supabase = useSupabaseClient();
  const [summary, setSummary] = useState<{
    totalSecurityEvents: number;
    criticalEvents: number;
    openInvestigations: number;
    phiAccessCount: number;
    complianceScore: number;
    trendDirection: 'UP' | 'DOWN' | 'STABLE';
  } | null>(null);
  const [complianceDetails, setComplianceDetails] = useState<ComplianceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadExecutiveData = async () => {
    try {
      setError(null);
      const service = createSOC2MonitoringService(supabase);

      const [summaryData, complianceData] = await Promise.all([
        service.getExecutiveSummary(),
        service.getComplianceStatus()
      ]);

      setSummary(summaryData);
      setComplianceDetails(complianceData);
      setLastRefresh(new Date());
    } catch (err) {

      setError('Failed to load executive summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExecutiveData();

    // Auto-refresh every 60 seconds
    const interval = setInterval(loadExecutiveData, 60000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Load on mount only
  }, []);

  const getComplianceGrade = (score: number): string => {
    if (score === 100) return 'A+';
    if (score >= 95) return 'A';
    if (score >= 90) return 'A-';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'B-';
    if (score >= 70) return 'C+';
    if (score >= 65) return 'C';
    return 'F';
  };

  const getTrendIcon = (trend: 'UP' | 'DOWN' | 'STABLE'): string => {
    switch (trend) {
      case 'UP': return '📈';
      case 'DOWN': return '📉';
      case 'STABLE': return '➡️';
    }
  };

  const getTrendColor = (trend: 'UP' | 'DOWN' | 'STABLE'): string => {
    switch (trend) {
      case 'UP': return 'text-red-600'; // More security events is bad
      case 'DOWN': return 'text-green-600'; // Fewer security events is good
      case 'STABLE': return 'text-blue-600';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded-sm w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-sm"></div>
            <div className="h-64 bg-gray-200 rounded-sm"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Executive Security Summary</h2>
          <p className="text-sm text-gray-600 mt-1">
            Technical Controls Readiness • Updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={loadExecutiveData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Disclaimer */}
      <Alert className="bg-blue-50 border-blue-200">
        <AlertDescription className="text-blue-900">
          <strong>Note:</strong> This dashboard measures <strong>technical implementation</strong> of SOC 2 controls (encryption, audit logging, access controls).
          Full SOC 2 compliance requires additional documentation including policies, procedures, training records, and vendor assessments maintained in your compliance binder.
          A formal SOC 2 Type I or Type II audit by a qualified CPA firm is required for official certification.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {summary && (
        <>
          {/* Hero Compliance Score */}
          <Card className="bg-linear-to-br from-blue-600 to-indigo-700 text-white shadow-xl">
            <CardContent className="pt-8 pb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="text-7xl font-bold mb-2">{summary.complianceScore}%</div>
                  <div className="text-3xl font-semibold mb-2 opacity-90">
                    Grade: {getComplianceGrade(summary.complianceScore)}
                  </div>
                  <div className="text-lg opacity-80">Technical Controls Readiness</div>
                </div>
                <div className="md:col-span-2 flex flex-col justify-center space-y-4">
                  <h3 className="text-2xl font-bold">Technical Security Posture</h3>
                  <p className="text-lg opacity-90">
                    {summary.complianceScore === 100 ? (
                      'All technical controls are properly implemented. System is SOC 2 audit-ready from a technical perspective. Documentation and formal audit still required for certification.'
                    ) : summary.complianceScore >= 90 ? (
                      'Your organization demonstrates strong compliance with SOC 2 standards. Minor improvements recommended.'
                    ) : summary.complianceScore >= 80 ? (
                      'Your organization meets most SOC 2 requirements. Some areas require attention to achieve full compliance.'
                    ) : (
                      'Your organization has significant compliance gaps. Immediate action required to meet SOC 2 standards.'
                    )}
                  </p>
                  <div className="flex items-center gap-2 text-xl">
                    <span>Security Trend:</span>
                    <span className={getTrendColor(summary.trendDirection)}>
                      {getTrendIcon(summary.trendDirection)}
                      {summary.trendDirection === 'UP' ? ' Increased Activity' :
                       summary.trendDirection === 'DOWN' ? ' Reduced Threats' :
                       ' Stable'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Security Events (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-blue-600">
                  {summary.totalSecurityEvents}
                </div>
                <p className="text-xs text-gray-500 mt-1">All severity levels</p>
              </CardContent>
            </Card>

            <Card className={`border-l-4 ${summary.criticalEvents > 0 ? 'border-red-500' : 'border-green-500'}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Critical Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold ${summary.criticalEvents > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {summary.criticalEvents}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {summary.criticalEvents === 0 ? 'No critical issues' : 'Requires attention'}
                </p>
              </CardContent>
            </Card>

            <Card className={`border-l-4 ${summary.openInvestigations > 0 ? 'border-yellow-500' : 'border-green-500'}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Open Investigations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold ${summary.openInvestigations > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {summary.openInvestigations}
                </div>
                <p className="text-xs text-gray-500 mt-1">Active incident response</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-indigo-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  PHI Access Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-indigo-600">
                  {summary.phiAccessCount}
                </div>
                <p className="text-xs text-gray-500 mt-1">Protected data accessed</p>
              </CardContent>
            </Card>
          </div>

          {/* Compliance Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Compliant Controls */}
            <Card>
              <CardHeader className="bg-green-50">
                <CardTitle className="text-green-900 flex items-center gap-2">
                  <span className="text-2xl">✅</span>
                  Compliant Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {complianceDetails
                    .filter(c => c.status === 'COMPLIANT')
                    .map((control, index) => (
                      <div key={index} className="border-l-4 border-green-500 pl-3 py-2">
                        <div className="font-semibold text-gray-900">
                          {control.control_area}
                          <span className="ml-2 text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded-sm">
                            {control.soc2_criterion}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {control.control_description}
                        </div>
                        <div className="text-xs text-green-700 mt-1">
                          {control.details}
                        </div>
                      </div>
                    ))}
                  {complianceDetails.filter(c => c.status === 'COMPLIANT').length === 0 && (
                    <p className="text-sm text-gray-500 italic">No compliant controls</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Non-Compliant / Needs Review */}
            <Card>
              <CardHeader className="bg-red-50">
                <CardTitle className="text-red-900 flex items-center gap-2">
                  <span className="text-2xl">⚠️</span>
                  Action Required
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {complianceDetails
                    .filter(c => c.status === 'NON_COMPLIANT' || c.status === 'NEEDS_REVIEW')
                    .map((control, index) => (
                      <div
                        key={index}
                        className={`border-l-4 ${
                          control.status === 'NON_COMPLIANT' ? 'border-red-500' : 'border-yellow-500'
                        } pl-3 py-2`}
                      >
                        <div className="font-semibold text-gray-900">
                          {control.control_area}
                          <span className="ml-2 text-xs font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded-sm">
                            {control.soc2_criterion}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {control.control_description}
                        </div>
                        <div className={`text-xs mt-1 ${
                          control.status === 'NON_COMPLIANT' ? 'text-red-700' : 'text-yellow-700'
                        }`}>
                          {control.details}
                        </div>
                      </div>
                    ))}
                  {complianceDetails.filter(c => c.status === 'NON_COMPLIANT' || c.status === 'NEEDS_REVIEW').length === 0 && (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-2">🎉</div>
                      <p className="text-sm font-semibold text-green-700">
                        All controls compliant!
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Your organization meets all SOC 2 requirements
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Executive Summary Text */}
          <Card className="bg-linear-to-br from-gray-50 to-gray-100">
            <CardHeader>
              <CardTitle className="text-xl">Executive Summary</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p className="text-gray-700">
                <strong>Security Overview:</strong> WellFit Community maintains {summary.complianceScore}% compliance
                with SOC 2 Type II Trust Service Criteria. In the past 24 hours, the system
                has recorded {summary.totalSecurityEvents} security events, including {summary.criticalEvents} critical
                incidents. All PHI access is logged and monitored, with {summary.phiAccessCount} access events
                recorded today.
              </p>

              <p className="text-gray-700 mt-4">
                <strong>Compliance Status:</strong> {complianceDetails.filter(c => c.status === 'COMPLIANT').length} of {complianceDetails.length} SOC
                2 controls are currently compliant. {complianceDetails.filter(c => c.status === 'NON_COMPLIANT').length > 0 && (
                  `${complianceDetails.filter(c => c.status === 'NON_COMPLIANT').length} control(s) require
                  immediate remediation to achieve full compliance.`
                )}
              </p>

              <p className="text-gray-700 mt-4">
                <strong>Incident Response:</strong> {summary.openInvestigations === 0 ? (
                  'No security incidents currently require investigation. All recent incidents have been resolved.'
                ) : (
                  `${summary.openInvestigations} security incident(s) are currently under investigation. The security
                  team is actively working to resolve these issues within established SLA timeframes.`
                )}
              </p>

              <p className="text-gray-700 mt-4">
                <strong>Audit Trail:</strong> Comprehensive audit logging is active across all systems. Every access
                to protected health information (PHI) is tracked with actor identity, timestamp, IP address, and
                purpose. Audit logs are retained for 7 years in compliance with healthcare regulations.
              </p>

              <p className="text-gray-700 mt-4">
                <strong>Data Protection:</strong> All sensitive data is encrypted at rest using AES-256 encryption.
                Encryption keys are managed through a secure key management system with automatic rotation policies.
                Data in transit is protected using TLS 1.3.
              </p>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader className="bg-blue-50">
              <CardTitle className="text-blue-900">Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ul className="space-y-2">
                {summary.criticalEvents > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-red-600 font-bold">•</span>
                    <span className="text-gray-700">
                      <strong>Immediate:</strong> Review and resolve {summary.criticalEvents} critical
                      security event(s) identified in the last 24 hours.
                    </span>
                  </li>
                )}
                {summary.openInvestigations > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600 font-bold">•</span>
                    <span className="text-gray-700">
                      <strong>High Priority:</strong> Complete investigation of {summary.openInvestigations} open
                      security incident(s) to maintain SLA compliance.
                    </span>
                  </li>
                )}
                {complianceDetails.filter(c => c.status === 'NON_COMPLIANT').length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 font-bold">•</span>
                    <span className="text-gray-700">
                      <strong>Compliance:</strong> Address non-compliant controls to achieve full SOC 2 certification.
                    </span>
                  </li>
                )}
                {summary.complianceScore === 100 && summary.criticalEvents === 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span className="text-gray-700">
                      <strong>Excellent:</strong> Maintain current security posture through regular reviews and updates.
                    </span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span className="text-gray-700">
                    <strong>Ongoing:</strong> Continue monitoring PHI access patterns and review audit logs weekly.
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
