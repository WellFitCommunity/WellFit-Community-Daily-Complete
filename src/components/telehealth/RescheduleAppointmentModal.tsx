/**
 * RescheduleAppointmentModal - Modal for rescheduling appointments
 *
 * Purpose: Allow providers to reschedule existing appointments with
 * conflict checking and audit trail
 * Used by: TelehealthScheduler
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AppointmentService,
  type RescheduleInput,
  type ConflictingAppointment,
} from '../../services/appointmentService';
import {
  AvailabilityService,
  type TimeSlot,
} from '../../services/availabilityService';
import { auditLogger } from '../../services/auditLogger';

export interface AppointmentToReschedule {
  id: string;
  patientName: string;
  providerId: string;
  currentTime: Date;
  durationMinutes: number;
  encounterType: string;
  reasonForVisit?: string;
}

interface RescheduleAppointmentModalProps {
  appointment: AppointmentToReschedule;
  isOpen: boolean;
  onClose: () => void;
  onRescheduled: () => void;
}

const RESCHEDULE_REASONS = [
  { value: 'patient_request', label: 'Patient requested' },
  { value: 'provider_unavailable', label: 'Provider unavailable' },
  { value: 'scheduling_conflict', label: 'Scheduling conflict' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'weather', label: 'Weather/external factors' },
  { value: 'other', label: 'Other' },
];

export const RescheduleAppointmentModal: React.FC<RescheduleAppointmentModalProps> = ({
  appointment,
  isOpen,
  onClose,
  onRescheduled,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [newDuration, setNewDuration] = useState<number>(appointment.durationMinutes);
  const [reason, setReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<ConflictingAppointment[]>([]);

  // Reset state when modal opens with new appointment
  useEffect(() => {
    if (isOpen && appointment) {
      const appointmentDate = new Date(appointment.currentTime);
      setSelectedDate(appointmentDate.toISOString().split('T')[0]);
      setSelectedTime('');
      setNewDuration(appointment.durationMinutes);
      setReason('');
      setCustomReason('');
      setError(null);
      setConflictWarning([]);
    }
  }, [isOpen, appointment]);

  // Load available slots when date changes
  const loadAvailableSlots = useCallback(async () => {
    if (!selectedDate || !appointment.providerId) return;

    setLoadingSlots(true);
    setError(null);

    try {
      const result = await AvailabilityService.getAvailableSlots(
        appointment.providerId,
        new Date(selectedDate),
        newDuration,
        15 // 15-minute slot intervals
      );

      if (result.success) {
        // Filter out slots that are in the past
        const now = new Date();
        const futureSlots = result.data.filter(
          (slot) => slot.slotStart > now && slot.isAvailable
        );
        setAvailableSlots(futureSlots);
      } else {
        setError(result.error?.message || 'Failed to load available slots');
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'RESCHEDULE_LOAD_SLOTS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { appointmentId: appointment.id, date: selectedDate }
      );
      setError('Failed to load available time slots');
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedDate, appointment.providerId, appointment.id, newDuration]);

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedDate, loadAvailableSlots]);

  // Check for conflicts when time is selected
  const checkForConflicts = useCallback(async () => {
    if (!selectedDate || !selectedTime) return;

    const newDateTime = new Date(`${selectedDate}T${selectedTime}`);

    const result = await AppointmentService.checkAppointmentAvailability(
      appointment.providerId,
      newDateTime,
      newDuration,
      appointment.id // Exclude current appointment
    );

    if (result.success && result.data.hasConflict) {
      setConflictWarning(result.data.conflictingAppointments);
    } else {
      setConflictWarning([]);
    }
  }, [selectedDate, selectedTime, appointment.providerId, appointment.id, newDuration]);

  useEffect(() => {
    if (selectedTime) {
      checkForConflicts();
    }
  }, [selectedTime, checkForConflicts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate || !selectedTime) {
      setError('Please select a new date and time');
      return;
    }

    if (!reason) {
      setError('Please select a reason for rescheduling');
      return;
    }

    if (conflictWarning.length > 0) {
      setError('Cannot reschedule - there is a conflict at the selected time');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const newDateTime = new Date(`${selectedDate}T${selectedTime}`);
      const reasonText = reason === 'other' ? customReason : RESCHEDULE_REASONS.find(r => r.value === reason)?.label || reason;

      const input: RescheduleInput = {
        appointmentId: appointment.id,
        newAppointmentTime: newDateTime,
        newDurationMinutes: newDuration !== appointment.durationMinutes ? newDuration : undefined,
        changeReason: reasonText,
        changedByRole: 'provider',
      };

      const result = await AppointmentService.rescheduleAppointment(input);

      if (result.success) {
        await auditLogger.info('APPOINTMENT_RESCHEDULE_UI_SUCCESS', {
          appointmentId: appointment.id,
          previousTime: appointment.currentTime.toISOString(),
          newTime: newDateTime.toISOString(),
        });
        onRescheduled();
        onClose();
      } else {
        setError(result.error?.message || 'Failed to reschedule appointment');
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'APPOINTMENT_RESCHEDULE_UI_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { appointmentId: appointment.id }
      );
      setError('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Get min date (today)
  const minDate = new Date().toISOString().split('T')[0];
  // Get max date (3 months from now)
  const maxDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Reschedule Appointment
              </h3>

              {/* Current appointment info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Current Appointment</h4>
                <div className="text-sm text-gray-600">
                  <p><span className="font-medium">Patient:</span> {appointment.patientName}</p>
                  <p><span className="font-medium">Date:</span> {formatDate(appointment.currentTime)}</p>
                  <p><span className="font-medium">Time:</span> {formatTime(appointment.currentTime)}</p>
                  <p><span className="font-medium">Duration:</span> {appointment.durationMinutes} minutes</p>
                  <p><span className="font-medium">Type:</span> {appointment.encounterType}</p>
                </div>
              </div>

              {/* Reschedule form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New date */}
                <div>
                  <label htmlFor="reschedule-date" className="block text-sm font-medium text-gray-700 mb-1">
                    New Date
                  </label>
                  <input
                    type="date"
                    id="reschedule-date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedTime('');
                    }}
                    min={minDate}
                    max={maxDate}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                {/* Available slots */}
                {selectedDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Available Time Slots
                    </label>
                    {loadingSlots ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                        <span className="ml-2 text-sm text-gray-500">Loading slots...</span>
                      </div>
                    ) : availableSlots.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot.slotStart.toISOString()}
                            type="button"
                            onClick={() => setSelectedTime(
                              slot.slotStart.toTimeString().slice(0, 5)
                            )}
                            className={`px-3 py-2 text-sm rounded-md transition-colors ${
                              selectedTime === slot.slotStart.toTimeString().slice(0, 5)
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {formatTime(slot.slotStart)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 py-2">
                        No available slots for this date. Please select another date.
                      </p>
                    )}
                  </div>
                )}

                {/* Conflict warning */}
                {conflictWarning.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-700 font-medium">Conflict Detected</p>
                    <p className="text-sm text-red-600 mt-1">
                      There is an existing appointment at this time:
                    </p>
                    <ul className="text-sm text-red-600 mt-1 list-disc list-inside">
                      {conflictWarning.map((conflict) => (
                        <li key={conflict.id}>
                          {conflict.patient_name} at {new Date(conflict.appointment_time).toLocaleTimeString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* New duration */}
                <div>
                  <label htmlFor="reschedule-duration" className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes)
                  </label>
                  <select
                    id="reschedule-duration"
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                  </select>
                </div>

                {/* Reason */}
                <div>
                  <label htmlFor="reschedule-reason" className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Rescheduling
                  </label>
                  <select
                    id="reschedule-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a reason...</option>
                    {RESCHEDULE_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                {/* Custom reason */}
                {reason === 'other' && (
                  <div>
                    <label htmlFor="custom-reason" className="block text-sm font-medium text-gray-700 mb-1">
                      Please specify
                    </label>
                    <input
                      type="text"
                      id="custom-reason"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter reason..."
                      required
                    />
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="submit"
                    disabled={submitting || !selectedTime || conflictWarning.length > 0}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Rescheduling...
                      </>
                    ) : (
                      'Confirm Reschedule'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RescheduleAppointmentModal;
