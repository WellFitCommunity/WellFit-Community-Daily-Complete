// src/components/dashboard/UpcomingAppointmentBanner.tsx
// Shows a prominent banner when patient has an upcoming telehealth appointment

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';

interface UpcomingAppointment {
  id: string;
  appointment_time: string;
  provider_name: string;
  encounter_type: string;
}

const UpcomingAppointmentBanner: React.FC = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const user = useUser();
  const [appointment, setAppointment] = useState<UpcomingAppointment | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const loadUpcomingAppointment = async () => {
      try {
        // Get the next upcoming appointment (within next 24 hours)
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const { data, error } = await supabase
          .from('telehealth_appointments')
          .select('id, appointment_time, encounter_type, provider_id')
          .eq('patient_id', user.id)
          .in('status', ['scheduled', 'confirmed'])
          .gte('appointment_time', now.toISOString())
          .lte('appointment_time', tomorrow.toISOString())
          .order('appointment_time', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error || !data) {
          return;
        }

        // Fetch provider info separately to avoid FK join issues
        let providerName = 'Your Doctor';
        if (data.provider_id) {
          const { data: provider } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', data.provider_id)
            .maybeSingle();

          if (provider) {
            providerName =
              `${provider.first_name || ''} ${provider.last_name || ''}`.trim() ||
              'Your Doctor';
          }
        }

        setAppointment({
          id: data.id,
          appointment_time: data.appointment_time,
          encounter_type: data.encounter_type,
          provider_name: providerName,
        });
      } catch {
        // Silently fail - not critical
      }
    };

    loadUpcomingAppointment();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('upcoming_appointments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'telehealth_appointments',
          filter: `patient_id=eq.${user.id}`,
        },
        () => {
          loadUpcomingAppointment();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, supabase]);

  // Format time remaining
  const getTimeRemaining = (timeString: string) => {
    const appointmentTime = new Date(timeString);
    const now = new Date();
    const diffMinutes = Math.floor((appointmentTime.getTime() - now.getTime()) / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffMinutes < 60) {
      return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
      const remainingMins = diffMinutes % 60;
      if (remainingMins === 0) {
        return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
      }
      return `in ${diffHours}h ${remainingMins}m`;
    }
    return 'today';
  };

  // Format appointment time
  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return formatter.format(date);
  };

  // Check if can join (within 15 minutes)
  const canJoin = (timeString: string) => {
    const appointmentTime = new Date(timeString);
    const now = new Date();
    const diffMinutes = (appointmentTime.getTime() - now.getTime()) / (1000 * 60);
    return diffMinutes <= 15 && diffMinutes >= -30;
  };

  if (!appointment || dismissed) {
    return null;
  }

  const isEmergency = appointment.encounter_type === 'er';
  const joinable = canJoin(appointment.appointment_time);

  return (
    <div
      className={`relative mb-6 rounded-xl shadow-xl overflow-hidden ${
        isEmergency
          ? 'bg-linear-to-r from-red-500 to-red-600'
          : joinable
          ? 'bg-linear-to-r from-green-500 to-emerald-600 animate-pulse'
          : 'bg-linear-to-r from-blue-500 to-indigo-600'
      }`}
      role="alert"
      aria-live="polite"
    >
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss appointment notification"
        className="absolute top-3 right-3 text-white hover:text-gray-200 transition text-2xl z-10"
      >
        ×
      </button>

      <div className="p-6 pr-12">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="text-5xl" aria-hidden="true">
            {isEmergency ? '🚨' : joinable ? '📹' : '📅'}
          </div>

          {/* Content */}
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-white mb-2">
              {joinable
                ? 'Your Appointment is Ready!'
                : `Upcoming ${isEmergency ? 'Emergency ' : ''}Video Visit`}
            </h3>

            <div className="text-lg text-white/90 space-y-1">
              <p>
                <strong>Doctor:</strong> {appointment.provider_name}
              </p>
              <p>
                <strong>Time:</strong> {formatTime(appointment.appointment_time)}{' '}
                <span className="font-semibold">
                  ({getTimeRemaining(appointment.appointment_time)})
                </span>
              </p>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap gap-3">
              {joinable ? (
                <button
                  onClick={() => navigate('/telehealth-appointments')}
                  className="px-6 py-3 bg-white text-green-700 rounded-lg font-bold text-lg hover:bg-gray-100 transition shadow-lg flex items-center gap-2"
                  aria-label="Join video call now"
                >
                  <span className="text-2xl" aria-hidden="true">
                    📹
                  </span>
                  <span>Join Call Now</span>
                </button>
              ) : (
                <button
                  onClick={() => navigate('/telehealth-appointments')}
                  className="px-6 py-3 bg-white/20 backdrop-blur-sm text-white border-2 border-white rounded-lg font-semibold hover:bg-white/30 transition"
                  aria-label="View appointment details"
                >
                  View Details
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Animated bottom border for joinable appointments */}
      {joinable && (
        <div className="h-2 bg-yellow-400 animate-pulse" aria-hidden="true"></div>
      )}
    </div>
  );
};

export default UpcomingAppointmentBanner;
