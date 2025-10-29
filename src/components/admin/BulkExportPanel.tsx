import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

interface ExportJob {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalRecords: number;
  processedRecords: number;
  startedAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  error?: string;
}

interface ExportFilters {
  dateFrom: string;
  dateTo: string;
  userTypes: string[];
  includeArchived: boolean;
  format: 'csv' | 'xlsx' | 'json';
  compression: boolean;
}

const BulkExportPanel: React.FC = () => {
  const { adminRole } = useAdminAuth();
  const [activeJobs, setActiveJobs] = useState<ExportJob[]>([]);
  const [filters, setFilters] = useState<ExportFilters>({
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    dateTo: new Date().toISOString().split('T')[0],
    userTypes: ['seniors', 'caregivers'],
    includeArchived: false,
    format: 'csv',
    compression: true
  });

  const exportTypes = [
    {
      key: 'check_ins',
      title: 'Check-ins & Vitals',
      description: 'Patient check-ins, vital signs, and health metrics',
      icon: '📊',
      estimatedSize: '~2MB per 1000 records',
      requiresRole: 'admin'
    },
    {
      key: 'risk_assessments',
      title: 'Risk Assessments',
      description: 'Patient risk assessments and clinical notes',
      icon: '📋',
      estimatedSize: '~5MB per 1000 records',
      requiresRole: 'admin'
    },
    {
      key: 'users_profiles',
      title: 'User Profiles',
      description: 'Demographics and profile information (PHI anonymized)',
      icon: '👥',
      estimatedSize: '~1MB per 1000 records',
      requiresRole: 'admin'
    },
    {
      key: 'billing_claims',
      title: 'Billing & Claims',
      description: 'Claims, encounters, and billing data',
      icon: '💳',
      estimatedSize: '~3MB per 1000 records',
      requiresRole: 'admin'
    },
    {
      key: 'fhir_resources',
      title: 'FHIR Resources',
      description: 'Complete FHIR-compliant patient resources',
      icon: '🔗',
      estimatedSize: '~10MB per 1000 records',
      requiresRole: 'super_admin'
    },
    {
      key: 'audit_logs',
      title: 'Audit Logs',
      description: 'System access and activity logs',
      icon: '📜',
      estimatedSize: '~500KB per 1000 records',
      requiresRole: 'super_admin'
    }
  ];

  const startExport = async (exportType: string) => {
    try {
      const jobId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create new export job
      const newJob: ExportJob = {
        id: jobId,
        type: exportType,
        status: 'pending',
        progress: 0,
        totalRecords: 0,
        processedRecords: 0,
        startedAt: new Date()
      };

      setActiveJobs(prev => [...prev, newJob]);

      // Get current user for audit logging
      const { data: { user } } = await supabase.auth.getUser();
      const isPHIExport = ['check_ins', 'risk_assessments', 'users_profiles', 'fhir_resources'].includes(exportType);

      // Log audit entry for PHI exports
      if (isPHIExport && user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'phi_export_initiated',
          resource_type: exportType,
          resource_id: jobId,
          metadata: {
            export_type: exportType,
            filters: filters,
            timestamp: new Date().toISOString(),
            user_email: user.email,
            user_role: adminRole
          }
        });
      }

      // Start the export process
      const { data, error } = await supabase.functions.invoke('bulk-export', {
        body: {
          jobId,
          exportType,
          filters,
          requestedBy: user?.id || 'admin'
        }
      });

      if (error) {
        throw error;
      }

      // Update job with initial response
      setActiveJobs(prev => prev.map(job =>
        job.id === jobId
          ? { ...job, status: 'processing', totalRecords: data.estimatedRecords }
          : job
      ));

      // Start polling for progress
      pollJobProgress(jobId);

    } catch (error) {

      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const pollJobProgress = async (jobId: string) => {
    const poll = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('export-status', {
          body: { jobId }
        });

        if (error) throw error;

        setActiveJobs(prev => prev.map(job =>
          job.id === jobId ? {
            ...job,
            status: data.status,
            progress: data.progress,
            processedRecords: data.processedRecords,
            downloadUrl: data.downloadUrl,
            completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
            error: data.error
          } : job
        ));

        // Continue polling if still processing
        if (data.status === 'processing') {
          setTimeout(poll, 2000);
        }
      } catch (error) {

        setActiveJobs(prev => prev.map(job =>
          job.id === jobId
            ? { ...job, status: 'failed', error: 'Failed to get job status' }
            : job
        ));
      }
    };

    poll();
  };

  const downloadExport = async (job: ExportJob) => {
    if (job.downloadUrl) {
      // Log audit entry for PHI export downloads
      const { data: { user } } = await supabase.auth.getUser();
      const isPHIExport = ['check_ins', 'risk_assessments', 'users_profiles', 'fhir_resources'].includes(job.type);

      if (isPHIExport && user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'phi_export_downloaded',
          resource_type: job.type,
          resource_id: job.id,
          metadata: {
            export_type: job.type,
            download_timestamp: new Date().toISOString(),
            user_email: user.email,
            user_role: adminRole,
            records_exported: job.totalRecords
          }
        });
      }

      const link = document.createElement('a');
      link.href = job.downloadUrl;
      link.download = `wellfit_${job.type}_${job.startedAt.toISOString().split('T')[0]}.${filters.format}${filters.compression ? '.gz' : ''}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const clearCompletedJobs = () => {
    setActiveJobs(prev => prev.filter(job =>
      !['completed', 'failed'].includes(job.status)
    ));
  };

  const getStatusColor = (status: ExportJob['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (start: Date, end?: Date) => {
    const endTime = end || new Date();
    const duration = Math.round((endTime.getTime() - start.getTime()) / 1000);

    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.round(duration / 60)}m`;
    return `${Math.round(duration / 3600)}h`;
  };

  const availableExports = exportTypes.filter(type =>
    type.requiresRole === 'admin' ||
    (type.requiresRole === 'super_admin' && adminRole === 'super_admin')
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Back Button */}
      <button
        onClick={() => window.history.length > 2 ? window.history.back() : window.location.href = '/admin'}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Admin
      </button>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="mr-3">📤</span>
              Bulk Data Export
            </h1>
            <p className="text-gray-600 mt-1">Export patient data, analytics, and system information securely</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-500">
              Active Jobs: {activeJobs.filter(j => ['pending', 'processing'].includes(j.status)).length}
            </div>
            {activeJobs.some(j => ['completed', 'failed'].includes(j.status)) && (
              <button
                onClick={clearCompletedJobs}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
              >
                Clear Completed
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Export Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Export Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
            <select
              value={filters.format}
              onChange={(e) => setFilters(prev => ({ ...prev, format: e.target.value as 'csv' | 'xlsx' | 'json' }))}
              className="w-full border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (XLSX)</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div className="flex items-center space-x-4 pt-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.compression}
                onChange={(e) => setFilters(prev => ({ ...prev, compression: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Compress</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.includeArchived}
                onChange={(e) => setFilters(prev => ({ ...prev, includeArchived: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Archived</span>
            </label>
          </div>
        </div>
      </div>

      {/* Export Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {availableExports.map((exportType) => (
          <div key={exportType.key} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <span className="text-2xl mr-3">{exportType.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{exportType.title}</h3>
                  {exportType.requiresRole === 'super_admin' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                      Super Admin
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-3">{exportType.description}</p>
            <p className="text-xs text-gray-500 mb-4">{exportType.estimatedSize}</p>

            <button
              onClick={() => startExport(exportType.key)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm font-medium"
            >
              Start Export
            </button>
          </div>
        ))}
      </div>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Export Jobs</h2>
          <div className="space-y-4">
            {activeJobs.map((job) => (
              <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                    <span className="font-medium text-gray-900">
                      {exportTypes.find(t => t.key === job.type)?.title || job.type}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {formatDuration(job.startedAt, job.completedAt)}
                    </span>
                    {job.status === 'completed' && job.downloadUrl && (
                      <button
                        onClick={() => downloadExport(job)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                      >
                        Download
                      </button>
                    )}
                  </div>
                </div>

                {job.status === 'processing' && (
                  <div className="mb-2">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{job.processedRecords} / {job.totalRecords} records</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {job.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {job.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <span className="text-yellow-600 mr-2">⚠️</span>
          <div className="text-sm">
            <p className="font-medium text-yellow-800">Security Notice</p>
            <p className="text-yellow-700 mt-1">
              All exports are encrypted and include audit logging. PHI data is anonymized according to HIPAA requirements.
              Downloads are available for 24 hours only and automatically deleted from temporary storage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkExportPanel;