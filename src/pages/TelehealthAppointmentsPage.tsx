// src/pages/TelehealthAppointmentsPage.tsx
// Patient-facing page to view and join telehealth appointments

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';

// Lazy-load TelehealthConsultation (313 kB) - only downloaded when user joins a call
const TelehealthConsultation = lazy(() => import('../components/telehealth/TelehealthConsultation'));

interface Appointment {
  id: string;
  appointment_time: string;
  duration_minutes: number;
  encounter_type: 'outpatient' | 'er' | 'urgent-care';
  status: string;
  reason_for_visit: string | null;
  provider_name: string;
  provider_specialty: string | null;
  daily_room_url: string | null;
}

const TelehealthAppointmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const user = useUser();
  const { branding } = useBranding();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [patientName, setPatientName] = useState('');

  // Load appointments
  useEffect(() => {
    if (!user?.id) return;

    const loadAppointments = async () => {
      try {
        // Get patient info
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          setPatientName(
            `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
            'Patient'
          );
        }

        // Get appointments (no FK join - provider_id doesn't have FK to profiles)
        const { data, error } = await supabase
          .from('telehealth_appointments')
          .select(`
            id,
            appointment_time,
            duration_minutes,
            encounter_type,
            status,
            reason_for_visit,
            daily_room_url,
            provider_id
          `)
          .eq('patient_id', user.id)
          .in('status', ['scheduled', 'confirmed', 'in-progress'])
          .gte('appointment_time', new Date().toISOString())
          .order('appointment_time', { ascending: true });

        if (error) throw error;

        // Type the database row shape
        interface AppointmentRow {
          id: string;
          appointment_time: string;
          duration_minutes: number;
          encounter_type: 'outpatient' | 'er' | 'urgent-care';
          status: string;
          reason_for_visit: string | null;
          daily_room_url: string | null;
          provider_id: string | null;
        }

        // Fetch provider names separately (no FK relationship exists)
        const providerIds = [...new Set((data as AppointmentRow[] || [])
          .map(apt => apt.provider_id)
          .filter((id): id is string => id !== null))];

        const providerMap = new Map<string, string>();
        if (providerIds.length > 0) {
          const { data: providers } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name')
            .in('user_id', providerIds);

          if (providers) {
            for (const p of providers) {
              const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Your Doctor';
              providerMap.set(p.user_id, name);
            }
          }
        }

        const formattedAppointments = (data as AppointmentRow[] || []).map((apt) => ({
          id: apt.id,
          appointment_time: apt.appointment_time,
          duration_minutes: apt.duration_minutes,
          encounter_type: apt.encounter_type,
          status: apt.status,
          reason_for_visit: apt.reason_for_visit,
          provider_name: apt.provider_id ? providerMap.get(apt.provider_id) || 'Your Doctor' : 'Your Doctor',
          provider_specialty: null, // profiles table doesn't have specialty column
          daily_room_url: apt.daily_room_url,
        }));

        setAppointments(formattedAppointments);
      } catch (error) {

      } finally {
        setLoading(false);
      }
    };

    loadAppointments();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('telehealth_appointments_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'telehealth_appointments',
          filter: `patient_id=eq.${user.id}`,
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

  // Format appointment time
  const formatAppointmentTime = (timeString: string) => {
    const date = new Date(timeString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow =
      new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === date.toDateString();

    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    if (isToday) {
      return `Today at ${timeFormatter.format(date)}`;
    } else if (isTomorrow) {
      return `Tomorrow at ${timeFormatter.format(date)}`;
    } else {
      return `${dateFormatter.format(date)} at ${timeFormatter.format(date)}`;
    }
  };

  // Check if appointment is ready to join (within 15 minutes of start time)
  const canJoinAppointment = (timeString: string) => {
    const appointmentTime = new Date(timeString);
    const now = new Date();
    const diffMinutes = (appointmentTime.getTime() - now.getTime()) / (1000 * 60);

    // Can join 15 minutes before until appointment time + duration
    return diffMinutes <= 15 && diffMinutes >= -30;
  };

  // Get time until appointment
  const getTimeUntil = (timeString: string) => {
    const appointmentTime = new Date(timeString);
    const now = new Date();
    const diffMinutes = Math.floor((appointmentTime.getTime() - now.getTime()) / (1000 * 60));

    if (diffMinutes < 0) return 'Started';
    if (diffMinutes === 0) return 'Starting now';
    if (diffMinutes < 60) return `in ${diffMinutes} minutes`;
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    if (mins === 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    return `in ${hours}h ${mins}m`;
  };

  // Join appointment
  const handleJoinAppointment = (appointment: Appointment) => {
    setActiveAppointment(appointment);
  };

  // End appointment
  const handleEndAppointment = () => {
    setActiveAppointment(null);
  };

  // Get encounter badge
  const getEncounterBadge = (encounterType: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      outpatient: { label: 'Regular Visit', color: 'bg-blue-500' },
      er: { label: 'ER Visit', color: 'bg-red-600' },
      'urgent-care': { label: 'Urgent Care', color: 'bg-orange-500' },
    };
    return badges[encounterType] || badges.outpatient;
  };

  // If in active call, show telehealth component (lazy-loaded)
  if (activeAppointment) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
              <div className="text-lg text-white">Loading video call...</div>
            </div>
          </div>
        }
      >
        <TelehealthConsultation
          patientId={user?.id || ''}
          patientName={patientName}
          encounterType={activeAppointment.encounter_type}
          onEndCall={handleEndAppointment}
        />
      </Suspense>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div
        className="min-h-screen pb-20"
        style={{ background: branding.gradient }}
      >
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <div className="text-lg text-gray-700">Loading your appointments...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-20"
      style={{ background: branding.gradient }}
    >
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4" aria-hidden="true">
            📹
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 drop-shadow-lg">
            My Appointments
          </h1>
          <p className="text-xl text-white/90">
            View and join your scheduled video visits
          </p>
        </div>

        {/* Appointments List */}
        {appointments.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-4" aria-hidden="true">
              📅
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              No Upcoming Appointments
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              You don't have any scheduled video appointments at this time.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {appointments.map((appointment) => {
              const badge = getEncounterBadge(appointment.encounter_type);
              const canJoin = canJoinAppointment(appointment.appointment_time);
              const timeUntil = getTimeUntil(appointment.appointment_time);

              return (
                <div
                  key={appointment.id}
                  className="bg-white rounded-2xl shadow-xl p-6 sm:p-8"
                >
                  {/* Appointment Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-bold text-gray-900">
                          Video Visit with {appointment.provider_name}
                        </h2>
                      </div>
                      {appointment.provider_specialty && (
                        <p className="text-gray-600 mb-2">
                          {appointment.provider_specialty}
                        </p>
                      )}
                    </div>
                    <span className={`${badge.color} text-white px-3 py-1 rounded-full text-sm font-semibold`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Appointment Time */}
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl" aria-hidden="true">
                        🕒
                      </span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatAppointmentTime(appointment.appointment_time)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 ml-8">
                      Duration: {appointment.duration_minutes} minutes
                      {canJoin && (
                        <span className="ml-3 text-green-600 font-semibold">
                          • Ready to join {timeUntil}
                        </span>
                      )}
                      {!canJoin && timeUntil !== 'Started' && (
                        <span className="ml-3 text-gray-500">
                          • Starts {timeUntil}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reason for Visit */}
                  {appointment.reason_for_visit && (
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-700 mb-1">Reason for Visit:</h3>
                      <p className="text-gray-600">{appointment.reason_for_visit}</p>
                    </div>
                  )}

                  {/* Join Button */}
                  {canJoin ? (
                    <button
                      onClick={() => handleJoinAppointment(appointment)}
                      className="w-full py-4 bg-linear-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg flex items-center justify-center gap-3"
                    >
                      <span className="text-2xl" aria-hidden="true">
                        📹
                      </span>
                      <span>Join Video Call</span>
                    </button>
                  ) : (
                    <div className="text-center p-4 bg-gray-100 rounded-lg">
                      <p className="text-gray-600">
                        You can join this appointment 15 minutes before the scheduled time
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Check back {timeUntil}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/my-health')}
            className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold text-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <span className="text-2xl" aria-hidden="true">
              ←
            </span>
            <span>Back to Health Hub</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TelehealthAppointmentsPage;
