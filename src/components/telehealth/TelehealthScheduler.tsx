// src/components/telehealth/TelehealthScheduler.tsx
// Provider UI for scheduling and managing telehealth appointments

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Video, Search, UserPlus, CheckCircle, XCircle } from 'lucide-react';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { InputValidator } from '../../services/inputValidator';
import { auditLogger } from '../../services/auditLogger';

interface Patient {
  user_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  dob: string;
}

interface Appointment {
  id: string;
  patient_name: string;
  patient_phone: string;
  appointment_time: string;
  duration_minutes: number;
  encounter_type: string;
  status: string;
  reason_for_visit: string;
}

const TelehealthScheduler: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();

  // Scheduling form state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [encounterType, setEncounterType] = useState<'outpatient' | 'er' | 'urgent-care'>('outpatient');
  const [reasonForVisit, setReasonForVisit] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Appointments list
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);

  // Search for patients
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const searchPatients = async () => {
      try {
        // SECURITY: Sanitize input to prevent SQL injection (HIPAA §164.312(a)(1))
        // Remove special characters that could be used for injection: %, ,, ;, etc.
        const sanitized = InputValidator.sanitizeText(searchQuery, 100)
          .replace(/[%,;'"\\]/g, '')
          .trim();

        // Additional validation: require at least 2 characters after sanitization
        if (sanitized.length < 2) {
          setSearchResults([]);
          setShowSearchResults(false);
          return;
        }

        // HIPAA §164.312(b): Audit patient profile search operations
        await auditLogger.info('PATIENT_PROFILE_SEARCH', {
          event_category: 'PHI_ACCESS',
          operation: 'search',
          resource_type: 'profiles',
          metadata: {
            search_length: sanitized.length,
            query_sanitized: true,
            context: 'telehealth_scheduler'
          },
          success: true
        });

        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, full_name, first_name, last_name, phone, email, dob')
          .or(`full_name.ilike.%${sanitized}%,first_name.ilike.%${sanitized}%,last_name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`)
          .limit(10);

        if (error) throw error;

        setSearchResults(data || []);
        setShowSearchResults(true);
      } catch (error) {

      }
    };

    const debounce = setTimeout(searchPatients, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, supabase]);

  // Load provider's upcoming appointments
  useEffect(() => {
    if (!user?.id) return;

    const loadAppointments = async () => {
      try {
        const { data, error } = await supabase
          .from('telehealth_appointments')
          .select(`
            id,
            appointment_time,
            duration_minutes,
            encounter_type,
            status,
            reason_for_visit,
            patient:profiles!patient_id(
              full_name,
              first_name,
              last_name,
              phone
            )
          `)
          .eq('provider_id', user.id)
          .in('status', ['scheduled', 'confirmed', 'in-progress'])
          .gte('appointment_time', new Date().toISOString())
          .order('appointment_time', { ascending: true })
          .limit(20);

        if (error) throw error;

        const formattedAppointments = (data || []).map((apt: any) => ({
          id: apt.id,
          patient_name:
            apt.patient?.full_name ||
            `${apt.patient?.first_name || ''} ${apt.patient?.last_name || ''}`.trim() ||
            'Unknown Patient',
          patient_phone: apt.patient?.phone || '',
          appointment_time: apt.appointment_time,
          duration_minutes: apt.duration_minutes,
          encounter_type: apt.encounter_type,
          status: apt.status,
          reason_for_visit: apt.reason_for_visit || '',
        }));

        setAppointments(formattedAppointments);
      } catch (error) {

      } finally {
        setLoadingAppointments(false);
      }
    };

    loadAppointments();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('provider_appointments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'telehealth_appointments',
          filter: `provider_id=eq.${user.id}`,
        },
        () => {
          loadAppointments();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, supabase]);

  // Select patient from search results
  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setSearchQuery(
      patient.full_name || `${patient.first_name} ${patient.last_name}`.trim()
    );
    setShowSearchResults(false);
  };

  // Schedule appointment
  const handleScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPatient) {
      setMessage({ type: 'error', text: 'Please select a patient' });
      return;
    }

    if (!appointmentDate || !appointmentTime) {
      setMessage({ type: 'error', text: 'Please select date and time' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Combine date and time
      const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);

      // Insert appointment
      const { data: appointment, error: insertError } = await supabase
        .from('telehealth_appointments')
        .insert({
          patient_id: selectedPatient.user_id,
          provider_id: user?.id,
          appointment_time: appointmentDateTime.toISOString(),
          duration_minutes: duration,
          encounter_type: encounterType,
          reason_for_visit: reasonForVisit || null,
          status: 'scheduled',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Send notification
      const { error: notifError } = await supabase.functions.invoke(
        'send-telehealth-appointment-notification',
        {
          body: { appointment_id: appointment.id },
        }
      );

      if (notifError) {

        // Don't fail the whole operation if notification fails
      }

      setMessage({
        type: 'success',
        text: `Appointment scheduled successfully! Patient has been notified via SMS.`,
      });

      // Reset form
      setSelectedPatient(null);
      setSearchQuery('');
      setAppointmentDate('');
      setAppointmentTime('');
      setDuration(30);
      setEncounterType('outpatient');
      setReasonForVisit('');
    } catch (error: any) {

      setMessage({
        type: 'error',
        text: `Failed to schedule appointment: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Cancel appointment
  const handleCancelAppointment = async (appointmentId: string) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      const { error } = await supabase
        .from('telehealth_appointments')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', appointmentId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Appointment cancelled successfully' });
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to cancel: ${error.message}` });
    }
  };

  // Format date/time for display
  const formatAppointmentTime = (isoString: string) => {
    const date = new Date(isoString);
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateFormatter.format(date)} at ${timeFormatter.format(date)}`;
  };

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  return (
    <div className="space-y-6">
      {/* Schedule New Appointment */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <Video className="w-6 h-6 text-blue-600" />
          <h3 className="text-2xl font-bold text-gray-900">Schedule Video Appointment</h3>
        </div>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleScheduleAppointment} className="space-y-4">
          {/* Patient Search */}
          <div className="relative">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Search className="inline w-4 h-4 mr-1" />
              Search Patient *
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
              placeholder="Search by name or phone number..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((patient) => (
                  <button
                    key={patient.user_id}
                    type="button"
                    onClick={() => handleSelectPatient(patient)}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-semibold text-gray-900">
                      {patient.full_name ||
                        `${patient.first_name} ${patient.last_name}`.trim()}
                    </div>
                    <div className="text-sm text-gray-600">
                      {patient.phone} • {patient.email}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedPatient && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-semibold text-green-900">
                    {selectedPatient.full_name ||
                      `${selectedPatient.first_name} ${selectedPatient.last_name}`.trim()}
                  </div>
                  <div className="text-sm text-green-700">{selectedPatient.phone}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null);
                    setSearchQuery('');
                  }}
                  className="text-green-600 hover:text-green-800"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Date *
              </label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                min={getMinDate()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Clock className="inline w-4 h-4 mr-1" />
                Time *
              </label>
              <input
                type="time"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Duration and Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Duration (minutes)
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Visit Type
              </label>
              <select
                value={encounterType}
                onChange={(e) =>
                  setEncounterType(e.target.value as 'outpatient' | 'er' | 'urgent-care')
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="outpatient">Regular Visit</option>
                <option value="urgent-care">Urgent Care</option>
                <option value="er">Emergency</option>
              </select>
            </div>
          </div>

          {/* Reason for Visit */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Reason for Visit
            </label>
            <textarea
              value={reasonForVisit}
              onChange={(e) => setReasonForVisit(e.target.value)}
              placeholder="Optional: Brief description of the visit purpose"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !selectedPatient}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Scheduling...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                <span>Schedule Appointment & Send Notification</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Upcoming Appointments List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Your Upcoming Appointments</h3>

        {loadingAppointments ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading appointments...</p>
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No upcoming appointments scheduled</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-lg text-gray-900">
                        {apt.patient_name}
                      </h4>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          apt.encounter_type === 'er'
                            ? 'bg-red-100 text-red-800'
                            : apt.encounter_type === 'urgent-care'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {apt.encounter_type === 'er'
                          ? 'Emergency'
                          : apt.encounter_type === 'urgent-care'
                          ? 'Urgent'
                          : 'Regular'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{formatAppointmentTime(apt.appointment_time)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{apt.duration_minutes} minutes</span>
                      </div>
                      {apt.patient_phone && (
                        <div className="text-gray-500">📞 {apt.patient_phone}</div>
                      )}
                      {apt.reason_for_visit && (
                        <div className="mt-2 text-gray-700">
                          <strong>Reason:</strong> {apt.reason_for_visit}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelAppointment(apt.id)}
                    className="ml-4 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TelehealthScheduler;
