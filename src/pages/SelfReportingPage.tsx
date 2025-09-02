// src/pages/SelfReportingPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useSession } from '../lib/supabaseClient';
import { useBranding } from '../BrandingContext';
import type { User } from '@supabase/supabase-js';

type SourceType = 'self' | 'staff';

interface SelfReportData {
  id: number;
  created_at: string;              // ISO string (from DB)
  mood: string;
  symptoms?: string | null;
  activity_description?: string | null;
  user_id: string;
  submitted_by: string;            // user id of submitter
  entry_type: string;              // e.g., 'self_report'
}

interface SelfReportLog extends SelfReportData {
  source_type: SourceType;         // client-added for color coding
}

const MOOD_OPTIONS = ['Happy', 'Okay', 'Sad', 'Anxious', 'Tired'] as const;

const SelfReportingPage: React.FC = () => {
  const branding = useBranding();
  const supabase = useSupabaseClient();
  const session = useSession();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [mood, setMood] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [activity, setActivity] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selfReports, setSelfReports] = useState<SelfReportLog[]>([]);

  // --- Auth bootstrap + listener (uses single app client)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!mounted) return;
        if (error) {
          setErrorMessage('Error fetching user: ' + error.message);
          setCurrentUser(null);
        } else {
          setCurrentUser(data.user ?? null);
        }
      } catch (e) {
        if (!mounted) return;
        const err = e instanceof Error ? e : new Error('An unexpected error occurred.');
        setErrorMessage(err.message);
        setCurrentUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setCurrentUser(newSession?.user ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [supabase]);

  // --- Fetch self reports for the current user
  const fetchReports = useCallback(
    async (uid: string) => {
      try {
        const { data, error } = await supabase
          .from('self_reports')
          .select('id, created_at, mood, symptoms, activity_description, user_id, submitted_by, entry_type')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });

        if (error) {
          setErrorMessage('Error loading reports: ' + error.message);
          setSelfReports([]);
          return;
        }

        const reports: SelfReportLog[] = (data ?? []).map((r: SelfReportData) => ({
          ...r,
          source_type: r.user_id === r.submitted_by ? 'self' : 'staff',
        }));
        setSelfReports(reports);
      } catch (e) {
        const err = e instanceof Error ? e : new Error('An unexpected error occurred while fetching reports.');
        setErrorMessage(err.message);
        setSelfReports([]);
      }
    },
    [supabase]
  );

  // When logged-in user changes, refresh their reports
  useEffect(() => {
    if (!currentUser?.id) return;
    fetchReports(currentUser.id);
  }, [currentUser?.id, fetchReports]);

  // --- Submit handler
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFeedbackMessage(null);
    setErrorMessage(null);

    if (!currentUser?.id) {
      setErrorMessage('You must be logged in to submit a report.');
      return;
    }

    const chosenMood = mood.trim();
    if (!chosenMood) {
      setErrorMessage('Please select your current mood.');
      return;
    }
    if (!MOOD_OPTIONS.includes(chosenMood as (typeof MOOD_OPTIONS)[number])) {
      setErrorMessage('Invalid mood selection.');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        user_id: currentUser.id,
        submitted_by: currentUser.id, // required for source coloring and audit
        entry_type: 'self_report',
        mood: chosenMood,
        symptoms: symptoms.trim() || null,
        activity_description: activity.trim() || null,
      };

      const { error } = await supabase.from('self_reports').insert(payload);
      if (error) throw error;

      setFeedbackMessage('Report saved successfully!');
      setMood('');
      setSymptoms('');
      setActivity('');

      await fetchReports(currentUser.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      setErrorMessage(`Error saving report: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- UI helpers
  const colorForSource = (type: SourceType | string): string => {
    if (type === 'self') return '#8cc63f'; // WellFit Green
    if (type === 'staff') return '#ff9800'; // Orange
    return '#bdbdbd';
  };

  if (isLoading && !currentUser) {
    return (
      <div className="text-center p-8 text-xl" style={{ color: branding.primaryColor }}>
        Loading...
      </div>
    );
  }

  if (!currentUser && errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-6 text-center">
        <p className="text-2xl font-semibold mb-4" style={{ color: branding.primaryColor }}>
          Access Denied
        </p>
        <p className="text-lg" style={{ color: branding.textColor }}>
          {errorMessage}
        </p>
        <p className="text-md mt-4" style={{ color: branding.textColor }}>
          Please{' '}
          <a href="/" className="underline" style={{ color: branding.secondaryColor }}>
            log in
          </a>{' '}
          to access this page.
        </p>
      </div>
    );
  }

  return (
    <div
      className="p-4 md:p-8 max-w-2xl mx-auto rounded-xl shadow-md"
      style={{
        background:
          branding.gradient ||
          `linear-gradient(to bottom right, ${branding.primaryColor}, ${branding.secondaryColor})`,
        color: branding.textColor,
        border: `1px solid ${branding.primaryColor}`,
      }}
    >
      <h1
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center"
        style={{ color: branding.primaryColor }}
      >
        Self Health Report
      </h1>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        <div>
          <label htmlFor="mood" className="block text-sm font-medium text-gray-700 mb-1">
            How are you feeling today?
          </label>
          <select
            id="mood"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            disabled={isLoading}
            aria-required="true"
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
          >
            <option value="" disabled>
              Select a mood...
            </option>
            {MOOD_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="symptoms" className="block text-sm font-medium text-gray-700 mb-1">
            Any symptoms you're experiencing? (optional)
          </label>
          <textarea
            id="symptoms"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            rows={3}
            disabled={isLoading}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
            placeholder="e.g., headache, fatigue"
            maxLength={500}
          />
        </div>

        <div>
          <label htmlFor="activity" className="block text-sm font-medium text-gray-700 mb-1">
            Briefly describe your main activity today (optional)
          </label>
          <textarea
            id="activity"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            rows={3}
            disabled={isLoading}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-50"
            placeholder="e.g., light walk, reading, gardening"
            maxLength={500}
          />
        </div>

        {/* Feedback messages */}
        {feedbackMessage && (
          <p
            role="status"
            className="text-green-600 bg-green-100 p-3 rounded-lg text-base sm:text-lg text-center font-medium"
          >
            {feedbackMessage}
          </p>
        )}
        {errorMessage && !feedbackMessage && (
          <p role="alert" className="text-red-600 bg-red-100 p-3 rounded-lg text-base sm:text-lg text-center font-medium">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading || !currentUser}
          className="w-full text-white font-semibold py-3 px-6 rounded-lg text-xl shadow-md transition-opacity duration-300 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
          style={{
            background:
              branding.gradient ||
              `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`,
            color: 'white',
            border: 'none',
          }}
        >
          {isLoading ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>

      {/* History */}
      <div className="mt-8">
        <h2 className="text-lg sm:text-xl font-semibold mb-4" style={{ color: branding.primaryColor }}>
          Your Previous Reports
        </h2>
        {selfReports.length === 0 ? (
          <p style={{ color: branding.textColor }}>No reports yet.</p>
        ) : (
          selfReports.map((log) => (
            <div
              key={log.id}
              style={{
                borderLeft: `8px solid ${colorForSource(log.source_type)}`,
                padding: '8px',
                marginBottom: '4px',
                background: '#fff',
              }}
            >
              <strong>{new Date(log.created_at).toLocaleString()}</strong>
              <span
                style={{
                  color: colorForSource(log.source_type),
                  fontWeight: 'bold',
                  marginLeft: 8,
                }}
              >
                {log.source_type === 'self' ? 'Self' : 'Staff'}
              </span>
              <br />
              Mood: {log.mood}
              <br />
              Symptoms: {log.symptoms || '—'}
              <br />
              Activity: {log.activity_description || '—'}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SelfReportingPage;
