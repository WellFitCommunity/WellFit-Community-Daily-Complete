/**
 * TrainingComplianceDashboard - HIPAA Workforce Training Compliance
 *
 * Purpose: Admin dashboard for tracking workforce security awareness training compliance
 * Used by: Admin compliance section (sectionDefinitions.tsx)
 * Auth: admin/super_admin/hr_admin only
 * Regulation: 45 CFR 164.308(a)(5)
 *
 * Features:
 *  - Compliance rate stats (% compliant, overdue count, expiring soon)
 *  - Employee training status list with overdue highlighting
 *  - Filter by course and compliance status
 *  - Visual compliance rate indicator
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  trainingTrackingService,
  type EmployeeTrainingStatus,
  type TenantComplianceRate,
  type TrainingCourse,
} from '../../services/trainingTrackingService';
import { auditLogger } from '../../services/auditLogger';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';

// =============================================================================
// TYPES
// =============================================================================

type ComplianceFilter = 'all' | 'overdue' | 'expiring' | 'current';

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getComplianceColor(rate: number): string {
  if (rate >= 90) return 'text-green-600';
  if (rate >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

function getComplianceBg(rate: number): string {
  if (rate >= 90) return 'bg-green-500';
  if (rate >= 70) return 'bg-yellow-500';
  return 'bg-red-500';
}

function filterStatuses(
  statuses: EmployeeTrainingStatus[],
  complianceFilter: ComplianceFilter,
  courseFilter: string
): EmployeeTrainingStatus[] {
  let filtered = statuses;

  // Filter by course
  if (courseFilter !== 'all') {
    filtered = filtered.filter(s => s.course_id === courseFilter);
  }

  // Filter by compliance status
  switch (complianceFilter) {
    case 'overdue':
      return filtered.filter(s => s.is_overdue);
    case 'expiring':
      return filtered.filter(s => s.is_expiring_soon);
    case 'current':
      return filtered.filter(s => !s.is_overdue && !s.is_expiring_soon);
    default:
      return filtered;
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

const TrainingComplianceDashboard: React.FC = () => {
  const { theme } = useDashboardTheme();
  const [compliance, setCompliance] = useState<TenantComplianceRate | null>(null);
  const [statuses, setStatuses] = useState<EmployeeTrainingStatus[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>('all');
  const [courseFilter, setCourseFilter] = useState('all');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [compResult, statusResult, courseResult] = await Promise.all([
        trainingTrackingService.getTenantComplianceRate(),
        trainingTrackingService.getTrainingStatus(),
        trainingTrackingService.listCourses(),
      ]);

      if (!compResult.success) {
        setError(compResult.error.message);
        return;
      }

      setCompliance(compResult.data);
      setStatuses(statusResult.success ? statusResult.data : []);
      setCourses(courseResult.success ? courseResult.data : []);

      await auditLogger.info('TRAINING_DASHBOARD_LOADED', {
        complianceRate: compResult.data.compliance_rate,
        totalEmployees: compResult.data.total_employees,
        overdueCount: compResult.data.overdue_count,
      });
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('TRAINING_DASHBOARD_LOAD_FAILED', e);
      setError('Failed to load training compliance data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredStatuses = filterStatuses(statuses, complianceFilter, courseFilter);

  // -- Loading State --
  if (loading) {
    return (
      <div
        className="flex items-center justify-center p-12"
        role="status"
        aria-label="Loading training compliance data"
      >
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--ea-primary,#00857a)]" />
        <span className="ml-3 text-gray-600 text-lg">Loading training data...</span>
      </div>
    );
  }

  // -- Error State (no data) --
  if (error && !compliance) {
    return (
      <div className="p-6" role="alert">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Unable to load training compliance data</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 min-h-[44px] min-w-[44px] px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-base font-medium"
            aria-label="Retry loading training data"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Training Compliance Dashboard</h2>
          <p className="text-gray-500 mt-1">45 CFR 164.308(a)(5) - Security Awareness Training</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className={`min-h-[44px] min-w-[44px] px-4 py-2 ${theme.buttonPrimary} rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] text-base font-medium disabled:opacity-50`}
          aria-label="Refresh training data"
        >
          Refresh
        </button>
      </div>

      {/* Inline error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!compliance || statuses.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500 text-lg">No training data available.</p>
          <p className="text-gray-400 text-sm mt-1">
            Configure training courses and enroll employees to see compliance data.
          </p>
        </div>
      ) : (
        <>
          {/* Compliance Rate Visual */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Overall Compliance Rate</h3>
              <span
                className={`text-4xl font-bold ${getComplianceColor(compliance.compliance_rate)}`}
                aria-label={`Compliance rate: ${compliance.compliance_rate.toFixed(0)} percent`}
              >
                {compliance.compliance_rate.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4" role="progressbar"
              aria-valuenow={Math.round(compliance.compliance_rate)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Compliance rate progress bar"
            >
              <div
                className={`h-4 rounded-full transition-all duration-500 ${getComplianceBg(compliance.compliance_rate)}`}
                style={{ width: `${Math.min(compliance.compliance_rate, 100)}%` }}
              />
            </div>
            <p className="text-gray-500 text-sm mt-2">
              {compliance.compliant_employees} of {compliance.total_employees} employees fully compliant
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setComplianceFilter('all')}
              className={`p-4 rounded-lg border-2 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] ${
                complianceFilter === 'all' ? 'border-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/10' : 'border-gray-200 bg-white'
              }`}
              aria-pressed={complianceFilter === 'all'}
              aria-label={`Show all: ${compliance.total_employees} employees`}
            >
              <p className="text-sm text-gray-500">Total Employees</p>
              <p className="text-3xl font-bold text-gray-900">{compliance.total_employees}</p>
            </button>

            <button
              onClick={() => setComplianceFilter('current')}
              className={`p-4 rounded-lg border-2 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] ${
                complianceFilter === 'current' ? 'border-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/10' : 'border-gray-200 bg-white'
              }`}
              aria-pressed={complianceFilter === 'current'}
              aria-label={`Show compliant: ${compliance.compliant_employees} employees`}
            >
              <p className="text-sm text-gray-500">Compliant</p>
              <p className="text-3xl font-bold text-green-600">
                {compliance.compliant_employees}
              </p>
            </button>

            <button
              onClick={() => setComplianceFilter('overdue')}
              className={`p-4 rounded-lg border-2 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] ${
                complianceFilter === 'overdue' ? 'border-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/10' : 'border-gray-200 bg-white'
              }`}
              aria-pressed={complianceFilter === 'overdue'}
              aria-label={`Show overdue: ${compliance.overdue_count} items`}
            >
              <p className="text-sm text-gray-500">Overdue Items</p>
              <p className={`text-3xl font-bold ${compliance.overdue_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {compliance.overdue_count}
              </p>
            </button>

            <button
              onClick={() => setComplianceFilter('expiring')}
              className={`p-4 rounded-lg border-2 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] ${
                complianceFilter === 'expiring' ? 'border-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/10' : 'border-gray-200 bg-white'
              }`}
              aria-pressed={complianceFilter === 'expiring'}
              aria-label={`Show expiring soon: ${compliance.expiring_soon_count} items`}
            >
              <p className="text-sm text-gray-500">Expiring Soon</p>
              <p className="text-3xl font-bold text-amber-600">
                {compliance.expiring_soon_count}
              </p>
            </button>
          </div>

          {/* Course Filter */}
          <div className="flex items-center gap-3">
            <label htmlFor="course-filter" className="text-sm font-medium text-gray-700">
              Filter by Course:
            </label>
            <select
              id="course-filter"
              value={courseFilter}
              onChange={e => setCourseFilter(e.target.value)}
              className="border border-gray-300 rounded-lg p-2 text-base focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)] min-h-[44px]"
              aria-label="Filter training records by course"
            >
              <option value="all">All Courses</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.course_name}
                </option>
              ))}
            </select>
          </div>

          {/* Training Status List */}
          {filteredStatuses.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500 text-lg">
                No training records match the selected filters.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full" role="table" aria-label="Employee training compliance">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        Employee
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        Course
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        Last Completed
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                        Expires
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStatuses.map((status, idx) => (
                      <tr
                        key={`${status.employee_id}-${status.course_id}-${idx}`}
                        className={status.is_overdue ? 'bg-red-50' : status.is_expiring_soon ? 'bg-amber-50' : ''}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {status.employee_name ?? 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {status.course_name}
                        </td>
                        <td className="px-4 py-3">
                          {status.is_overdue ? (
                            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                              Overdue
                            </span>
                          ) : status.is_expiring_soon ? (
                            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                              Expiring Soon
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              Current
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {status.last_completed ? formatDate(status.last_completed) : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {status.expires_at ? formatDate(status.expires_at) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Summary Footer */}
          {compliance.overdue_count > 0 && (
            <div
              className="bg-red-50 border border-red-200 rounded-lg p-4"
              role="alert"
              aria-label="Overdue training warning"
            >
              <p className="text-red-800 font-semibold">
                {compliance.overdue_count} overdue training item{compliance.overdue_count !== 1 ? 's' : ''} require
                immediate attention
              </p>
              <p className="text-red-600 text-sm mt-1">
                HIPAA requires workforce members to complete security awareness training.
                Non-compliance may result in regulatory findings.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TrainingComplianceDashboard;
