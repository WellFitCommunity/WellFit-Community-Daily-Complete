/**
 * SOC 2 Audit & Compliance Dashboard
 *
 * Provides audit trail viewing, PHI access monitoring, and compliance status.
 * Tracks who accessed what data, when, and why.
 *
 * Zero tech debt - surgeon not a butcher
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { createSOC2MonitoringService, PHIAccessAudit, AuditSummaryStats, ComplianceStatus } from '../../services/soc2MonitoringService';

// Polling configuration with exponential backoff
const INITIAL_POLL_INTERVAL = 60000; // 60 seconds
const MAX_POLL_INTERVAL = 300000; // 5 minutes max
const MAX_CONSECUTIVE_ERRORS = 5;
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';

export const SOC2AuditDashboard: React.FC = () => {
  const supabase = useSupabaseClient();
  const [phiAccess, setPhiAccess] = useState<PHIAccessAudit[]>([]);
  const [auditStats, setAuditStats] = useState<AuditSummaryStats[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [filterRiskLevel, setFilterRiskLevel] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [pollingPaused, setPollingPaused] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const consecutiveErrorsRef = useRef(0);
  const currentIntervalRef = useRef(INITIAL_POLL_INTERVAL);

  const loadAuditData = async () => {
    // Don't poll if access was denied (403)
    if (accessDenied) return;

    try {
      setError(null);
      const service = createSOC2MonitoringService(supabase);

      const [phiData, statsData, complianceData] = await Promise.all([
        service.getPHIAccessAudit(100),
        service.getAuditSummaryStats(),
        service.getComplianceStatus()
      ]);

      // Check if any data indicates access denied (empty arrays may indicate RLS blocked access)
      // The service wraps errors, so we check if we got valid data

      setPhiAccess(phiData);
      setAuditStats(statsData);
      setComplianceStatus(complianceData);
      setLastRefresh(new Date());

      // Reset error counter on success
      consecutiveErrorsRef.current = 0;
      currentIntervalRef.current = INITIAL_POLL_INTERVAL;
    } catch (err: unknown) {
      // Increment consecutive errors and apply backoff
      consecutiveErrorsRef.current += 1;

      // Check if error indicates access denied
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('403') || errorMessage.includes('401') || errorMessage.includes('permission denied')) {
        setAccessDenied(true);
        setPollingPaused(true);
      } else if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
        setPollingPaused(true);
      } else {
        // Exponential backoff: double the interval up to max
        currentIntervalRef.current = Math.min(
          currentIntervalRef.current * 2,
          MAX_POLL_INTERVAL
        );
      }

      setError('Failed to load audit and compliance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();

    // Dynamic polling interval with backoff
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (pollingPaused) return;
      intervalId = setInterval(() => {
        if (!pollingPaused) {
          loadAuditData();
        }
      }, currentIntervalRef.current);
    };

    startPolling();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Load on mount only, with polling state
  }, [pollingPaused, accessDenied]);

  const getRiskLevelColor = (risk: string) => {
    switch (risk) {
      case 'HIGH':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'LOW':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLIANT':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'NON_COMPLIANT':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'NEEDS_REVIEW':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const filteredPHIAccess = phiAccess.filter(
    access => filterRiskLevel === 'ALL' || access.risk_level === filterRiskLevel
  );

  const compliantControls = complianceStatus.filter(c => c.status === 'COMPLIANT').length;
  const totalControls = complianceStatus.length;
  const complianceScore = totalControls > 0 ? Math.round((compliantControls / totalControls) * 100) : 0;

  // Show access denied message if user lacks permissions
  if (accessDenied) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-6 text-center max-w-lg mx-auto">
          <div className="text-4xl mb-4">🔒</div>
          <h3 className="text-lg font-semibold text-amber-800 mb-2">Access Restricted</h3>
          <p className="text-sm text-amber-700">
            You don&apos;t have permission to view SOC 2 audit and compliance data.
            Contact your administrator if you need access.
          </p>
        </div>
      </div>
    );
  }

  if (loading && phiAccess.length === 0 && auditStats.length === 0) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded-sm w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 gap-4">
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
          <h2 className="text-2xl font-bold text-gray-900">Audit & Compliance Center</h2>
          <p className="text-sm text-gray-600 mt-1">
            SOC 2 compliance monitoring • Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={loadAuditData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Compliance Score Card */}
      <Card className="bg-linear-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="text-xl">SOC 2 Compliance Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-6xl font-bold text-blue-600">{complianceScore}%</div>
              <p className="text-sm text-gray-600 mt-2">
                {compliantControls} of {totalControls} controls compliant
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl">
                {complianceScore === 100 ? '🎯' : complianceScore >= 80 ? '✅' : '⚠️'}
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {complianceScore === 100 ? 'Fully Compliant' :
                 complianceScore >= 80 ? 'Good Standing' :
                 'Needs Attention'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Status Table */}
      <Card>
        <CardHeader>
          <CardTitle>SOC 2 Control Status</CardTitle>
        </CardHeader>
        <CardContent>
          {complianceStatus.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No compliance data available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Control Area
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SOC 2 Criterion
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Test Result
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {complianceStatus.map((control, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {control.control_area}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">
                        {control.soc2_criterion}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                        {control.control_description}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getComplianceStatusColor(control.status)}`}>
                          {control.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-md">
                        {control.details}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          control.test_result === 'PASS' ? 'bg-green-100 text-green-800' :
                          control.test_result === 'FAIL' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {control.test_result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Event Summary (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {auditStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No audit statistics available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event Type
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Events
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Success Rate
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unique Users
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Latest Event
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auditStats.slice(0, 20).map((stat, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {stat.event_category}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {stat.event_type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 font-semibold">
                        {stat.total_events.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                        <span className={`font-semibold ${
                          stat.success_rate_percent >= 95 ? 'text-green-600' :
                          stat.success_rate_percent >= 80 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {stat.success_rate_percent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                        {stat.unique_users}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {formatTimestamp(stat.latest_event)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PHI Access Audit Trail */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>PHI Access Audit Trail</CardTitle>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterRiskLevel('ALL')}
                className={`px-3 py-1 text-xs rounded ${
                  filterRiskLevel === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterRiskLevel('HIGH')}
                className={`px-3 py-1 text-xs rounded ${
                  filterRiskLevel === 'HIGH' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                High Risk
              </button>
              <button
                onClick={() => setFilterRiskLevel('MEDIUM')}
                className={`px-3 py-1 text-xs rounded ${
                  filterRiskLevel === 'MEDIUM' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Medium Risk
              </button>
              <button
                onClick={() => setFilterRiskLevel('LOW')}
                className={`px-3 py-1 text-xs rounded ${
                  filterRiskLevel === 'LOW' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Low Risk
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPHIAccess.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No PHI access events recorded
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Access Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Risk Level
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPHIAccess.map((access) => (
                    <tr key={access.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatTimestamp(access.timestamp)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {access.actor_email}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {access.actor_role || 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {access.access_type}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {access.patient_name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getRiskLevelColor(access.risk_level)}`}>
                          {access.risk_level}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                        {access.actor_ip_address || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
