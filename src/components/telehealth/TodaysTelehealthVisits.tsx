/**
 * TodaysTelehealthVisits - Provider's telehealth day view (S3.1b entry point)
 *
 * Purpose: Lists the signed-in provider's telehealth appointments for today and lets
 *   them start each one. "Start Visit" navigates to /provider/telehealth/:appointmentId,
 *   which joins the SAME pre-created Daily room the senior joins from WellFit — and runs
 *   the Compass-Riley scribe against the appointment's encounter so the SOAP note and
 *   billing codes are captured exactly like an in-person visit.
 * Used by: route /provider/telehealth (provider/clinical roles).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/AuthContext';
import { getProviderAppointments, type ConflictingAppointment } from '../../services/appointmentService';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; visits: ConflictingAppointment[] };

const ENCOUNTER_LABELS: Record<string, { text: string; className: string }> = {
  outpatient: { text: 'Outpatient', className: 'bg-blue-100 text-blue-800' },
  er: { text: 'ER Telehealth', className: 'bg-red-100 text-red-800' },
  'urgent-care': { text: 'Urgent Care', className: 'bg-orange-100 text-orange-800' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export const TodaysTelehealthVisits: React.FC = () => {
  const user = useUser();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const loadVisits = useCallback(async () => {
    if (!user?.id) {
      setState({ status: 'error', message: 'You must be signed in to view telehealth visits.' });
      return;
    }

    setState({ status: 'loading' });

    // Today, provider-local: midnight → 23:59:59.999.
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const result = await getProviderAppointments(user.id, start, end);
    if (!result.success) {
      // Surface the real failure — never silently show an empty list (telehealth T-5).
      setState({ status: 'error', message: result.error.message || 'Failed to load your telehealth visits.' });
      return;
    }

    setState({ status: 'ready', visits: result.data });
  }, [user?.id]);

  useEffect(() => {
    void loadVisits();
  }, [loadVisits]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Today&apos;s Telehealth Visits</h1>
          <p className="mt-1 text-gray-600">
            Start a scheduled video visit. You&apos;ll join the same room the patient is waiting in.
          </p>
        </header>

        {state.status === 'loading' && (
          <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow-sm">
            Loading your visits…
          </div>
        )}

        {state.status === 'error' && (
          <div
            role="alert"
            className="rounded-lg border-l-4 border-red-500 bg-red-50 p-6 text-red-800"
          >
            <p className="font-semibold">Unable to load telehealth visits</p>
            <p className="mt-1 text-sm">{state.message}</p>
            <button
              onClick={() => void loadVisits()}
              className="mt-4 min-h-[44px] rounded-lg bg-red-600 px-5 py-2 font-medium text-white hover:bg-red-700"
            >
              Try again
            </button>
          </div>
        )}

        {state.status === 'ready' && state.visits.length === 0 && (
          <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow-sm">
            No telehealth visits scheduled for today.
          </div>
        )}

        {state.status === 'ready' && state.visits.length > 0 && (
          <ul className="space-y-4">
            {state.visits.map((visit) => {
              const badge = ENCOUNTER_LABELS[visit.encounter_type] ?? {
                text: visit.encounter_type,
                className: 'bg-gray-100 text-gray-800',
              };
              return (
                <li
                  key={visit.id}
                  className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-gray-900">{formatTime(visit.appointment_time)}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}>
                        {badge.text}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-gray-700">
                      {visit.patient_name} · {visit.duration_minutes} min
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/provider/telehealth/${visit.id}`)}
                    className="min-h-[44px] shrink-0 rounded-lg bg-green-600 px-6 py-3 text-lg font-bold text-white transition-colors hover:bg-green-700"
                  >
                    Start Visit
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TodaysTelehealthVisits;
