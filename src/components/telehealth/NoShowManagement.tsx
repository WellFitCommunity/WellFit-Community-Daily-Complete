/**
 * NoShowManagement - Provider dashboard for managing appointment no-shows
 *
 * Purpose: Allow providers to view, mark, and manage no-show appointments
 * Used by: Provider telehealth dashboard, admin panels
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Clock,
  User,
  Calendar,
  RefreshCw,
  CheckCircle,
  XCircle,
  Ban,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  NoShowDetectionService,
  type ExpiredAppointment,
  type NoShowMarkResult,
} from '../../services/noShowDetectionService';
import { auditLogger } from '../../services/auditLogger';
import PatientNoShowBadge from './PatientNoShowBadge';

interface NoShowManagementProps {
  tenantId?: string;
  providerId?: string;
  onNoShowMarked?: (result: NoShowMarkResult) => void;
}

interface ProcessingState {
  [appointmentId: string]: 'marking' | 'marked' | 'error';
}

export const NoShowManagement: React.FC<NoShowManagementProps> = ({
  tenantId,
  providerId,
  onNoShowMarked,
}) => {
  const [expiredAppointments, setExpiredAppointments] = useState<ExpiredAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load expired appointments
  const loadExpiredAppointments = useCallback(async () => {
    setError(null);
    try {
      const result = await NoShowDetectionService.detectExpiredAppointments(
        tenantId,
        50
      );
      if (result.success) {
        // Filter by provider if specified
        let appointments = result.data;
        if (providerId) {
          appointments = appointments.filter((apt) => apt.providerId === providerId);
        }
        setExpiredAppointments(appointments);
      } else {
        setError(result.error?.message || 'Failed to load expired appointments');
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'LOAD_EXPIRED_APPOINTMENTS_FAILED',
        err instanceof Error ? err : new Error(String(err))
      );
      setError('Failed to load expired appointments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenantId, providerId]);

  useEffect(() => {
    loadExpiredAppointments();
  }, [loadExpiredAppointments]);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadExpiredAppointments();
  };

  // Mark appointment as no-show
  const handleMarkNoShow = async (appointmentId: string, notes?: string) => {
    setProcessing((prev) => ({ ...prev, [appointmentId]: 'marking' }));
    setError(null);

    try {
      const result = await NoShowDetectionService.markAppointmentNoShow(
        appointmentId,
        'manual_provider',
        notes
      );

      if (result.success && result.data) {
        setProcessing((prev) => ({ ...prev, [appointmentId]: 'marked' }));
        setSuccessMessage('Appointment marked as no-show');
        setTimeout(() => setSuccessMessage(null), 3000);

        // Remove from list after a delay
        setTimeout(() => {
          setExpiredAppointments((prev) =>
            prev.filter((apt) => apt.appointmentId !== appointmentId)
          );
          setProcessing((prev) => {
            const newState = { ...prev };
            delete newState[appointmentId];
            return newState;
          });
        }, 2000);

        onNoShowMarked?.(result.data);
      } else {
        setProcessing((prev) => ({ ...prev, [appointmentId]: 'error' }));
        setError(result.error?.message || 'Failed to mark as no-show');
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'MARK_NO_SHOW_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { appointmentId }
      );
      setProcessing((prev) => ({ ...prev, [appointmentId]: 'error' }));
      setError('Failed to mark as no-show');
    }
  };

  // Toggle row expansion
  const toggleRow = (appointmentId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(appointmentId)) {
        newSet.delete(appointmentId);
      } else {
        newSet.add(appointmentId);
      }
      return newSet;
    });
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Loading expired appointments...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900">
              Potential No-Shows
            </h3>
            {expiredAppointments.length > 0 && (
              <span className="bg-orange-100 text-orange-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                {expiredAppointments.length}
              </span>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600
                     hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Appointments that have passed their grace period without patient attendance
        </p>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {successMessage}
        </div>
      )}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Content */}
      {expiredAppointments.length === 0 ? (
        <div className="p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No overdue appointments</p>
          <p className="text-sm text-gray-500 mt-1">
            All appointments are accounted for
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {expiredAppointments.map((apt) => {
            const isExpanded = expandedRows.has(apt.appointmentId);
            const processState = processing[apt.appointmentId];

            return (
              <div
                key={apt.appointmentId}
                className={`p-4 ${
                  processState === 'marked'
                    ? 'bg-green-50'
                    : processState === 'error'
                    ? 'bg-red-50'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Appointment info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {apt.patientName}
                      </span>
                      <PatientNoShowBadge
                        patientId={apt.patientId}
                        tenantId={apt.tenantId || undefined}
                        size="sm"
                      />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatTime(apt.appointmentTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {apt.durationMinutes} min
                      </span>
                    </div>
                    <div className="mt-1 text-sm">
                      <span className="text-gray-500">Provider: </span>
                      <span className="text-gray-700">{apt.providerName}</span>
                    </div>
                  </div>

                  {/* Overdue indicator */}
                  <div className="text-right">
                    <div className="text-orange-600 font-medium">
                      {apt.minutesOverdue} min overdue
                    </div>
                    <div className="text-xs text-gray-500">
                      Grace: {apt.gracePeriodMinutes} min
                    </div>
                  </div>

                  {/* Expand/collapse button */}
                  <button
                    onClick={() => toggleRow(apt.appointmentId)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Previous no-shows:</span>{' '}
                          {apt.patientNoShowCount}
                        </p>
                        {apt.patientPhone && (
                          <p>
                            <span className="font-medium">Phone:</span>{' '}
                            {apt.patientPhone}
                          </p>
                        )}
                        {apt.patientEmail && (
                          <p>
                            <span className="font-medium">Email:</span>{' '}
                            {apt.patientEmail}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {processState === 'marked' ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            Marked as no-show
                          </span>
                        ) : processState === 'error' ? (
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="w-4 h-4" />
                            Failed
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              handleMarkNoShow(
                                apt.appointmentId,
                                `Patient did not attend. ${apt.minutesOverdue} minutes past appointment end.`
                              )
                            }
                            disabled={processState === 'marking'}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white
                                     rounded-lg hover:bg-red-700 disabled:opacity-50
                                     disabled:cursor-not-allowed transition-colors"
                          >
                            {processState === 'marking' ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                Marking...
                              </>
                            ) : (
                              <>
                                <Ban className="w-4 h-4" />
                                Mark as No-Show
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer with info */}
      <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Appointments are detected as potential no-shows after the scheduled end time
          plus the configured grace period has passed without patient check-in.
        </p>
      </div>
    </div>
  );
};

export default NoShowManagement;
